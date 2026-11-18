import { randomInt } from 'node:crypto';
import { Router } from 'express';
import { FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';
import { generateStructured } from '../ai/client.js';
import { LEVELS, loadDeck, taynaAnswer } from '../ai/teacher.js';
import { adminAuth } from '../lib/firebaseAdmin.js';
import { requireDb } from '../lib/firestoreAdmin.js';
import { rateLimitOrThrow } from '../lib/rateLimit.js';
import { HttpError } from '../middleware/errorHandler.js';

/**
 * Tayna de verdade (multiplayer): a apresentadora cria uma sessão com código;
 * outra pessoa entra pelo celular (login anônimo), vê o slide atual e as
 * perguntas sugeridas pela IA, com o gabarito escondido.
 * Coleção: liveSessions/{código}.
 */
export const liveRouter = Router();

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem 0/O/1/I para não confundir
const newCode = () => Array.from({ length: 6 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');
const codeSchema = z.string().regex(/^[A-Z0-9]{6}$/, 'Código inválido');
const SESSION_HOURS = 6;

async function getSession(code: string) {
  const db = requireDb();
  const ref = db.collection('liveSessions').doc(code);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpError(404, 'Sessão não encontrada. Confira o código.');
  const data = snap.data() as { ownerUid: string; deckId: string; status: string; expiresAt: FirebaseFirestore.Timestamp; questions: LiveQuestion[]; participants: Record<string, string> };
  return { db, ref, data };
}

interface LiveQuestion {
  id: string;
  slideIndex: number;
  text: string;
  expectedAnswer: string | null;
  askedBy: string;
  askedByName: string;
  result: 'certa' | 'errada' | null;
  aiVerdict?: string;
  aiNote?: string;
  createdAt: number;
}

/** POST /api/live — cria a sessão para um deck (só a dona, com conta). */
liveRouter.post('/', async (req, res) => {
  const { deckId } = z.object({ deckId: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/) }).parse(req.body);
  const user = await adminAuth!.getUser(req.uid!);
  if (!user.providerData.length) throw new HttpError(403, 'Entre com a sua conta para criar uma sessão ao vivo.');
  const db = requireDb();
  const deck = await loadDeck(db, req.uid!, deckId);

  let code = newCode();
  for (let i = 0; i < 5 && (await db.collection('liveSessions').doc(code).get()).exists; i++) code = newCode();
  await db
    .collection('liveSessions')
    .doc(code)
    .set({
      ownerUid: req.uid,
      ownerName: user.displayName ?? 'Apresentadora',
      deckId,
      deckTitle: deck.title,
      // o convidado vê o slide (sem o roteiro de fala)
      slides: deck.slides.map((s) => ({ title: s.title, bullets: s.bullets, highlight: s.highlight, image: s.image ?? null })),
      currentSlide: 0,
      status: 'ativa',
      participants: {},
      questions: [],
      suggestions: {},
      createdAt: FieldValue.serverTimestamp(),
      expiresAt: new Date(Date.now() + SESSION_HOURS * 3600_000),
    });
  res.json({ code });
});

const Suggestions = z.object({ questions: z.array(z.object({ question: z.string(), answer: z.string() })) });

/** POST /api/live/:code/suggest — a IA sugere perguntas (com gabarito) para o slide. */
liveRouter.post('/:code/suggest', async (req, res) => {
  const code = codeSchema.parse(req.params.code);
  const { slideIndex, level } = z.object({ slideIndex: z.number().int().min(0), level: z.enum(LEVELS).default('intermediario') }).parse(req.body);
  const { db, ref, data } = await getSession(code);
  if (data.ownerUid !== req.uid) throw new HttpError(403, 'Só quem apresenta pode pedir sugestões.');
  rateLimitOrThrow(`live-suggest:${code}`, 60, 3600_000);
  const deck = await loadDeck(db, data.ownerUid, data.deckId);
  const s = deck.slides[slideIndex];
  if (!s) throw new HttpError(404, 'Slide não encontrado.');
  const r = await generateStructured({
    schema: Suggestions,
    system: `Você ajuda uma pessoa (sem formação jurídica, talvez) a fazer perguntas para uma estudante de Direito que está apresentando. Crie 3 perguntas curtas, em português, sobre o slide (nível ${level}), cada uma com a resposta esperada em 1 a 3 frases, fiel ao conteúdo. Não invente artigos ou julgados.`,
    effort: 'low',
    maxTokens: 3000,
    content: [{ text: `Slide: ${s.title}\n- ${s.bullets.join('\n- ')}\n${s.highlight ?? ''}\nRoteiro: ${s.notes}` }],
  });
  await ref.update({ [`suggestions.${slideIndex}`]: r.questions.slice(0, 3) });
  res.json({ ok: true });
});

/** POST /api/live/:code/evaluate — a IA avalia a resposta dada a uma pergunta. */
liveRouter.post('/:code/evaluate', async (req, res) => {
  const code = codeSchema.parse(req.params.code);
  const { questionId, answer } = z.object({ questionId: z.string().max(64), answer: z.string().trim().min(1).max(4000) }).parse(req.body);
  const { db, ref, data } = await getSession(code);
  const isOwner = data.ownerUid === req.uid;
  if (!isOwner && !data.participants?.[req.uid!]) throw new HttpError(403, 'Entre na sessão primeiro.');
  if (data.status !== 'ativa') throw new HttpError(409, 'A sessão já foi encerrada.');
  rateLimitOrThrow(`live-eval:${code}`, 60, 3600_000);
  const q = data.questions.find((x) => x.id === questionId);
  if (!q) throw new HttpError(404, 'Pergunta não encontrada.');
  const deck = await loadDeck(db, data.ownerUid, data.deckId);
  const s = deck.slides[q.slideIndex];
  const r = await taynaAnswer({
    deckId: data.deckId,
    slideIndex: q.slideIndex,
    question: q.text,
    expectedAnswer: q.expectedAnswer ?? (s ? `${s.notes}\n${s.bullets.join('; ')}` : ''),
    answer,
    personality: 'curiosa',
    isFollowUp: true,
  });
  await db.runTransaction(async (tx) => {
    const cur = ((await tx.get(ref)).get('questions') as LiveQuestion[]) ?? [];
    tx.update(ref, {
      questions: cur.map((x) => (x.id === questionId ? { ...x, aiVerdict: r.verdict, aiNote: r.note, result: r.verdict === 'boa' ? 'certa' : 'errada' } : x)),
    });
  });
  res.json(r);
});

/** POST /api/live/:code/end — encerra a sessão. */
liveRouter.post('/:code/end', async (req, res) => {
  const code = codeSchema.parse(req.params.code);
  const { ref, data } = await getSession(code);
  if (data.ownerUid !== req.uid) throw new HttpError(403, 'Só quem apresenta pode encerrar.');
  await ref.update({ status: 'encerrada', endedAt: FieldValue.serverTimestamp() });
  res.json({ ok: true });
});
