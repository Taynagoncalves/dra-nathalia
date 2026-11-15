import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { z } from 'zod';
import { userCol } from '../lib/firestoreAdmin.js';
import { HttpError } from '../middleware/errorHandler.js';
import { generateStructured } from './client.js';
import { formatSourceDocs, loadSourceDocs } from './materials.js';
import { LEGAL_INTEGRITY } from './prompts.js';

/**
 * Etapa 3 — Modo Professora: slides gerados pela IA, avaliação do ensino oral
 * e a "Tayna", aluna virtual que faz perguntas durante a apresentação.
 */

const id = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/);

/* ── Slides ─────────────────────────────────────────────────────── */

export const TEMPLATES = ['tradicional', 'visual', 'revisao', 'juridica', 'ensinar'] as const;
const TEMPLATE_TEXT: Record<(typeof TEMPLATES)[number], string> = {
  tradicional: 'aula tradicional: conceito → elementos → requisitos → exemplos → conclusão',
  visual: 'visual: poucas palavras por slide (3 tópicos curtos), destaque forte e comparações em formato de esquema',
  revisao: 'revisão rápida: cada slide é um ponto que mais cai em prova, com pegadinhas comuns no destaque',
  juridica: 'jurídica: fundamento legal (artigos presentes nos documentos), doutrina e jurisprudência citadas nos documentos, aplicação prática',
  ensinar: 'para ensinar outra pessoa: linguagem simples, analogias do dia a dia e uma pergunta de checagem no destaque',
};

export const deckSchema = z.object({
  subjectId: id,
  topicId: id.nullable().optional(),
  materialIds: z.array(id).max(50).default([]),
  template: z.enum(TEMPLATES),
  count: z.number().int().min(3).max(20),
  theme: z.string().trim().max(200).optional(),
});

const Slide = z.object({
  title: z.string(),
  bullets: z.array(z.string()),
  /** o que falar neste slide (roteiro da apresentadora) */
  notes: z.string(),
  /** destaque: exemplo, esquema, pegadinha ou pergunta de checagem */
  highlight: z.string().nullable(),
});
const Deck = z.object({ title: z.string(), slides: z.array(Slide) });

const SLIDES_SYSTEM = `Você é uma professora de Direito que prepara slides de aula claros e corretos.

${LEGAL_INTEGRITY}

- Cada slide: título curto, 2 a 5 tópicos (bullets) objetivos, roteiro de fala (notes, 2 a 4 frases, como a aluna deve explicar) e um destaque opcional (highlight).
- Base: os documentos do aluno quando fornecidos. Não acrescente artigos, súmulas ou julgados que não estejam neles.
- Primeiro slide: o que será visto. Último slide: síntese.`;

export async function generateDeck(db: Firestore, uid: string, input: z.infer<typeof deckSchema>) {
  const subject = await userCol(db, uid, 'subjects').doc(input.subjectId).get();
  if (!subject.exists) throw new HttpError(404, 'Matéria não encontrada.');
  let ids = input.materialIds;
  if (!ids.length) {
    const all = await userCol(db, uid, 'materials').where('subjectId', '==', input.subjectId).get();
    ids = all.docs
      .filter((d) => (d.get('kind') === 'note' || d.get('aiStatus') === 'pronto') && (!input.topicId || d.get('topicId') === input.topicId))
      .map((d) => d.id);
  }
  const docs = await loadSourceDocs(db, uid, ids.slice(0, 40));
  const topic = input.topicId ? (await userCol(db, uid, 'topics').doc(input.topicId).get()).get('name') : null;
  if (!docs.length && !input.theme && !topic) {
    throw new HttpError(422, 'Sem material pronto para a IA nesta matéria. Envie PDFs/anotações ou informe um tema.');
  }
  const { xml } = docs.length ? formatSourceDocs(docs, 150_000) : { xml: '' };
  const r = await generateStructured({
    schema: Deck,
    system: SLIDES_SYSTEM,
    effort: 'medium',
    maxTokens: 16000,
    content: [
      ...(xml ? [{ text: xml, cache: true }] : []),
      {
        text: [
          `Matéria: ${subject.get('name')}.`,
          topic ? `Assunto: ${topic}.` : '',
          input.theme ? `Tema pedido: ${input.theme}.` : '',
          `Crie exatamente ${input.count} slides no modelo ${TEMPLATE_TEXT[input.template]}.`,
          docs.length ? '' : 'Não há documentos do aluno: use só conhecimento consolidado e evite números de artigos de que não tenha certeza.',
        ]
          .filter(Boolean)
          .join('\n'),
      },
    ],
  });
  const ref = userCol(db, uid, 'decks').doc();
  const deck = {
    title: r.title.slice(0, 150),
    subjectId: input.subjectId,
    topicId: input.topicId ?? null,
    template: input.template,
    slides: r.slides.slice(0, input.count).map((s) => ({ ...s, bullets: s.bullets.slice(0, 6) })),
    sourceMaterialIds: docs.map((d) => d.materialId),
    noMaterial: !docs.length,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };
  await ref.set(deck);
  return { id: ref.id, ...deck, createdAt: null, updatedAt: null };
}

/** Carrega um deck do usuário (ou do dono de uma sessão ao vivo). */
export async function loadDeck(db: Firestore, ownerUid: string, deckId: string) {
  const snap = await userCol(db, ownerUid, 'decks').doc(deckId).get();
  if (!snap.exists) throw new HttpError(404, 'Apresentação não encontrada.');
  return snap.data() as { title: string; subjectId: string; slides: z.infer<typeof Slide>[] };
}

const slideText = (s: z.infer<typeof Slide>, i: number) =>
  `Slide ${i + 1} (slideIndex=${i}): ${s.title}\n- ${s.bullets.join('\n- ')}${s.highlight ? `\nDestaque: ${s.highlight}` : ''}\nRoteiro esperado: ${s.notes}`;

/* ── Avaliação do ensino oral ───────────────────────────────────── */

export const evaluateSchema = z.object({
  deckId: id,
  transcripts: z.array(z.object({ slideIndex: z.number().int().min(0), text: z.string().max(20000) })).max(40),
});

const Evaluation = z.object({
  scores: z.object({ accuracy: z.number().int(), coverage: z.number().int(), clarity: z.number().int(), coherence: z.number().int() }),
  summary: z.string(),
  perSlide: z.array(z.object({ slideIndex: z.number().int(), correct: z.array(z.string()), errors: z.array(z.string()), omissions: z.array(z.string()) })),
  strengths: z.array(z.string()),
  toReview: z.array(z.string()),
});

const EVAL_SYSTEM = `Você avalia um aluno de Direito que apresentou slides falando (a fala foi transcrita automaticamente, então ignore erros de digitação/transcrição e repetições).

${LEGAL_INTEGRITY}

Para cada slide (use em perSlide.slideIndex o valor de slideIndex informado, que começa em 0), compare a fala com o conteúdo e o roteiro: liste o que ele explicou corretamente (correct), erros conceituais (errors) e conceitos importantes que ele pulou (omissions). Dê notas de 0 a 10: accuracy (correção dos conceitos), coverage (cobriu o essencial), clarity (clareza), coherence (encadeamento lógico). summary: 2 a 4 frases. strengths: pontos fortes. toReview: assuntos curtos para revisar.`;

export async function evaluateTeaching(db: Firestore, uid: string, input: z.infer<typeof evaluateSchema>) {
  const deck = await loadDeck(db, uid, input.deckId);
  const said = new Map(input.transcripts.map((t) => [t.slideIndex, t.text]));
  const r = await generateStructured({
    schema: Evaluation,
    system: EVAL_SYSTEM,
    effort: 'medium',
    maxTokens: 12000,
    content: [
      {
        text: deck.slides
          .map((s, i) => `${slideText(s, i)}\nFALA DO ALUNO: ${said.get(i)?.trim() || '(não falou nada neste slide)'}`)
          .join('\n\n'),
      },
    ],
  });
  const clamp = (n: number) => Math.max(0, Math.min(10, n));
  // Se a IA numerou a partir de 1 (1..n), converte para 0..n-1
  const idx = r.perSlide.map((p) => p.slideIndex);
  const oneBased = idx.length > 0 && Math.min(...idx) >= 1 && Math.max(...idx) === deck.slides.length;
  const perSlide = r.perSlide.map((p) => ({ ...p, slideIndex: oneBased ? p.slideIndex - 1 : p.slideIndex })).filter((p) => p.slideIndex >= 0 && p.slideIndex < deck.slides.length);
  return { ...r, perSlide, scores: { accuracy: clamp(r.scores.accuracy), coverage: clamp(r.scores.coverage), clarity: clamp(r.scores.clarity), coherence: clamp(r.scores.coherence) } };
}

/* ── Tayna: a aluna que pergunta ────────────────────────────────── */

export const LEVELS = ['basico', 'intermediario', 'avancado', 'pegadinha', 'oab', 'concurso'] as const;
export const PERSONALITIES = ['curiosa', 'rigorosa', 'advogada_do_diabo'] as const;
const PERSONA: Record<(typeof PERSONALITIES)[number], string> = {
  curiosa: 'uma aluna curiosa, que faz perguntas simples e práticas ("e na prática, como fica?")',
  rigorosa: 'uma examinadora rigorosa, que cobra precisão técnica, requisitos e exceções',
  advogada_do_diabo: 'uma advogada do diabo, que contesta os argumentos e propõe contraexemplos',
};
const LEVEL: Record<(typeof LEVELS)[number], string> = {
  basico: 'básico',
  intermediario: 'intermediário',
  avancado: 'avançado',
  pegadinha: 'pegadinha (confusões comuns entre institutos)',
  oab: 'nível OAB',
  concurso: 'nível concurso',
};

const TAYNA_BASE = `Você é a Tayna, uma estudante de Direito assistindo à apresentação de uma colega. Fale em português, em 1ª pessoa, de forma natural e curta (como numa sala de aula).

${LEGAL_INTEGRITY}`;

export const questionSchema = z.object({
  deckId: id,
  slideIndex: z.number().int().min(0).nullable(),
  transcript: z.string().max(20000).default(''),
  level: z.enum(LEVELS),
  personality: z.enum(PERSONALITIES),
  asked: z.array(z.string().max(500)).max(30).default([]),
});

const Question = z.object({ question: z.string(), expectedAnswer: z.string(), concept: z.string() });

/** Uma pergunta da Tayna sobre o slide (ou sobre a apresentação inteira, se slideIndex = null). */
export async function taynaQuestion(db: Firestore, ownerUid: string, input: z.infer<typeof questionSchema>) {
  const deck = await loadDeck(db, ownerUid, input.deckId);
  const scope = input.slideIndex === null ? deck.slides.map(slideText).join('\n\n') : slideText(deck.slides[input.slideIndex] ?? deck.slides[0]!, input.slideIndex);
  return generateStructured({
    schema: Question,
    system: `${TAYNA_BASE}\n\nPersonalidade: ${PERSONA[input.personality]}. Nível das perguntas: ${LEVEL[input.level]}.\nFaça UMA pergunta curta. Mire nas lacunas: algo que a apresentadora não explicou, explicou de forma vaga ou errada na fala. Não repita perguntas já feitas. expectedAnswer: a resposta esperada (2 a 4 frases, fiel ao conteúdo). concept: o conceito cobrado (curto).`,
    effort: 'low',
    maxTokens: 3000,
    content: [
      {
        text: `${scope}\n\nO QUE A APRESENTADORA FALOU: ${input.transcript.trim() || '(nada transcrito)'}\n\nPerguntas já feitas: ${input.asked.join(' | ') || 'nenhuma'}`,
      },
    ],
  });
}

export const answerSchema = z.object({
  deckId: id,
  slideIndex: z.number().int().min(0).nullable(),
  question: z.string().max(1000),
  expectedAnswer: z.string().max(3000),
  answer: z.string().max(8000),
  personality: z.enum(PERSONALITIES),
  isFollowUp: z.boolean().default(false),
});

const Reaction = z.object({
  verdict: z.enum(['boa', 'incompleta', 'errada']),
  /** o que a Tayna diz em voz alta */
  reaction: z.string(),
  /** pergunta de acompanhamento (só quando incompleta e não for já um acompanhamento) */
  followUp: z.string().nullable(),
  /** anotação para o feedback final (o erro ou o que faltou) */
  note: z.string(),
});

/** Avalia a resposta: boa → "entendi!"; incompleta → acompanhamento; errada → não corrige agora, só anota. */
export async function taynaAnswer(input: z.infer<typeof answerSchema>) {
  const r = await generateStructured({
    schema: Reaction,
    system: `${TAYNA_BASE}\n\nPersonalidade: ${PERSONA[input.personality]}.
Avalie a resposta da apresentadora comparando com a resposta esperada (aceite outras palavras se o conteúdo estiver certo).
- boa: reaja como colega satisfeita ("Ah, entendi!"), curto.
- incompleta: reaja e faça UMA pergunta de acompanhamento curta em followUp${input.isFollowUp ? ' — mas esta já é um acompanhamento, então followUp = null' : ''}.
- errada: NÃO corrija agora; reaja de forma neutra ("Hum, entendi… vou anotar") e explique o erro só em note.
note: para o feedback final, diga objetivamente o que estava certo, errado ou faltando.`,
    effort: 'low',
    maxTokens: 2000,
    content: [{ text: `Pergunta: ${input.question}\nResposta esperada: ${input.expectedAnswer}\nResposta da apresentadora: ${input.answer.trim() || '(não respondeu)'}` }],
  });
  return { ...r, followUp: input.isFollowUp || r.verdict !== 'incompleta' ? null : r.followUp };
}

export const feedbackSchema = z.object({
  deckId: id,
  interactions: z
    .array(
      z.object({
        slideIndex: z.number().int().nullable(),
        question: z.string().max(1000),
        answer: z.string().max(8000),
        verdict: z.enum(['boa', 'incompleta', 'errada', 'sem_resposta']),
        note: z.string().max(2000),
      }),
    )
    .max(60),
  transcripts: z.array(z.object({ slideIndex: z.number().int(), text: z.string().max(20000) })).max(40),
});

const Final = z.object({
  summary: z.string(),
  wellAnswered: z.array(z.string()),
  poorlyAnswered: z.array(z.string()),
  confident: z.array(z.string()),
  skippedConcepts: z.array(z.string()),
  toReview: z.array(z.string()),
});

export async function taynaFeedback(db: Firestore, uid: string, input: z.infer<typeof feedbackSchema>) {
  const deck = await loadDeck(db, uid, input.deckId);
  const said = new Map(input.transcripts.map((t) => [t.slideIndex, t.text]));
  return generateStructured({
    schema: Final,
    system: `${TAYNA_BASE}\n\nAgora a apresentação acabou. Escreva o feedback final para a colega, honesto e encorajador: summary (2 a 4 frases); wellAnswered e poorlyAnswered (perguntas, curtas); confident (o que ela explicou com segurança); skippedConcepts (conceitos importantes dos slides que ela não mencionou na fala); toReview (assuntos curtos para revisar).`,
    effort: 'medium',
    maxTokens: 8000,
    content: [
      {
        text: `SLIDES E FALA:\n${deck.slides.map((s, i) => `${slideText(s, i)}\nFALA: ${said.get(i)?.trim() || '(nada)'}`).join('\n\n')}\n\nPERGUNTAS DA TAYNA:\n${input.interactions
          .map((x) => `- ${x.question}\n  Resposta: ${x.answer || '(sem resposta)'}\n  Avaliação: ${x.verdict} — ${x.note}`)
          .join('\n')}`,
      },
    ],
  });
}
