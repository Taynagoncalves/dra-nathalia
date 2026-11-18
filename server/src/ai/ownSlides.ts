import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { z } from 'zod';
import { userCol } from '../lib/firestoreAdmin.js';
import { notifyUser } from '../lib/notify.js';
import { HttpError } from '../middleware/errorHandler.js';
import { generateStructured } from './client.js';
import { processMaterial } from './materials.js';
import { LEGAL_INTEGRITY } from './prompts.js';

/**
 * Modo Professora com os slides da própria pessoa (PDF ou PowerPoint já enviado
 * como material). A apresentação é criada na hora a partir do texto de cada
 * página/slide; no PDF, cada slide mostra a imagem da página original.
 * Depois, em segundo plano, a IA organiza o texto e escreve o roteiro de fala
 * (o que os modos Tayna e "Apresentar para a IA" usam para comparar com a fala).
 */

const id = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/);
export const ownSlidesSchema = z.object({ materialId: id });

const MAX_SLIDES = 60;

export interface OwnSlide {
  title: string;
  bullets: string[];
  notes: string;
  highlight: string | null;
  image: string | null;
  page: number;
}

/** Imagem de uma página do PDF pelo Cloudinary (mesma técnica da miniatura dos materiais). */
const pageImage = (url: string, page: number) => url.replace('/upload/', `/upload/pg_${page},w_1600,c_limit,f_jpg,q_auto/`).replace(/\.pdf$/i, '.jpg');

const cut = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

/** Primeira linha vira título; as seguintes viram tópicos (sem IA, instantâneo). */
export function slideFromText(text: string, page: number, image: string | null): OwnSlide {
  const lines = text
    .split(/\n+/)
    .map((l) => l.replace(/^[\s•▪●◦\-–*]+/, '').trim())
    .filter((l) => l.length > 1);
  const title = cut(lines[0] ?? `Slide ${page}`, 120);
  const bullets = lines.slice(1, 9).map((l) => cut(l, 220));
  return { title, bullets, notes: '', highlight: null, image, page };
}

export async function createDeckFromMaterial(db: Firestore, uid: string, materialId: string) {
  const ref = userCol(db, uid, 'materials').doc(materialId);
  let snap = await ref.get();
  if (!snap.exists) throw new HttpError(404, 'Material não encontrado.');
  const m = snap.data() as { title: string; kind: string; subjectId: string; topicId?: string | null; aiStatus?: string; aiError?: string; cloudinary?: { url: string; resourceType?: string; format?: string | null } };
  if (m.kind !== 'pdf' && m.kind !== 'slides') throw new HttpError(422, 'Escolha um PDF ou um PowerPoint (.pptx).');

  // extrai o texto agora, se ainda não foi extraído (não usa a IA)
  if (m.aiStatus !== 'pronto') {
    const r = await processMaterial(db, uid, materialId);
    if (r.status !== 'pronto') {
      throw new HttpError(422, `Não consegui ler o texto dos slides: ${'error' in r && r.error ? r.error : 'formato não suportado.'} Se for .ppt antigo, salve como .pptx ou PDF.`);
    }
    snap = await ref.get();
  }

  const chunks = await ref.collection('chunks').orderBy('order').get();
  const byPage = new Map<number, string[]>();
  for (const d of chunks.docs) {
    const page = Number(d.get('page') ?? 0) || byPage.size + 1;
    byPage.set(page, [...(byPage.get(page) ?? []), String(d.get('text') ?? '')]);
  }
  const pages = [...byPage.keys()].sort((a, b) => a - b).slice(0, MAX_SLIDES);
  if (!pages.length) throw new HttpError(422, 'Não encontrei texto nos slides.');

  const isImagePdf = m.kind === 'pdf' && m.cloudinary?.resourceType === 'image' && !!m.cloudinary.url;
  const slides = pages.map((p) => slideFromText(byPage.get(p)!.join('\n'), p, isImagePdf ? pageImage(m.cloudinary!.url, p) : null));

  const deckRef = userCol(db, uid, 'decks').doc();
  await deckRef.set({
    title: cut(m.title.replace(/\.(pdf|pptx?)$/i, ''), 150),
    subjectId: m.subjectId,
    topicId: m.topicId ?? null,
    template: 'proprio',
    slides,
    sourceMaterialIds: [materialId],
    noMaterial: false,
    ownSlides: true,
    truncated: byPage.size > MAX_SLIDES,
    aiStatus: 'pendente',
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  return { deckId: deckRef.id, slides };
}

const Organized = z.object({
  title: z.string(),
  slides: z.array(z.object({ page: z.number().int(), title: z.string(), bullets: z.array(z.string()), notes: z.string() })),
});

const ORGANIZE_SYSTEM = `Você ajuda uma estudante de Direito a ensaiar a apresentação dos PRÓPRIOS slides. Recebe o texto extraído de cada slide (pode vir bagunçado: quebras de linha erradas, cabeçalhos, números de página).

${LEGAL_INTEGRITY}

Para cada slide (use o mesmo número em page):
- title: o título do slide (curto, como está no slide).
- bullets: os tópicos do slide, limpos e fiéis ao texto (2 a 6). NÃO acrescente conteúdo que não está no slide.
- notes: o roteiro do que ela deveria explicar ao apresentar este slide (2 a 4 frases), desenvolvendo o que está no slide com conhecimento jurídico consolidado. É a referência para conferir se a fala dela está certa e completa.
title (geral): um título curto para a apresentação.`;

/**
 * Em segundo plano: organiza o texto e escreve o roteiro, sem desfazer o que a pessoa já editou.
 * `original` = os slides como foram importados; sem ele (nova tentativa), só preenche roteiros vazios.
 */
export async function organizeOwnDeck(db: Firestore, uid: string, deckId: string, original: OwnSlide[] | null, onFail: () => Promise<void>) {
  const deckRef = userCol(db, uid, 'decks').doc(deckId);
  const retry = original === null;
  await deckRef.update({ aiStatus: 'organizando', jobStartedAt: Date.now() });
  try {
    if (!original) original = ((await deckRef.get()).get('slides') as OwnSlide[]) ?? [];
    const r = await generateStructured({
      schema: Organized,
      system: ORGANIZE_SYSTEM,
      effort: 'medium',
      maxTokens: 16000,
      content: [{ text: original.map((s) => `SLIDE page=${s.page}\n${[s.title, ...s.bullets].join('\n')}`).join('\n\n') }],
    });
    const byPage = new Map(r.slides.map((s) => [s.page, s]));
    const before = new Map(original.map((s) => [s.page, s]));
    await db.runTransaction(async (tx) => {
      const cur = await tx.get(deckRef);
      if (!cur.exists) return;
      const slides = (cur.get('slides') as OwnSlide[]).map((s) => {
        const ai = byPage.get(s.page);
        const orig = before.get(s.page);
        if (!ai) return s;
        // só troca título/tópicos se a pessoa ainda não mexeu neste slide
        const untouched = !retry && !!orig && s.title === orig.title && JSON.stringify(s.bullets) === JSON.stringify(orig.bullets);
        return {
          ...s,
          ...(untouched ? { title: ai.title.slice(0, 150) || s.title, bullets: ai.bullets.slice(0, 8) } : {}),
          notes: s.notes.trim() ? s.notes : ai.notes,
        };
      });
      tx.update(deckRef, { slides, aiStatus: 'pronto', updatedAt: FieldValue.serverTimestamp() });
    });
    await notifyUser(db, uid, { title: 'Seus slides estão prontos para ensaiar', body: 'A IA organizou o texto e escreveu o roteiro de fala de cada slide.', url: `/professora/${deckId}`, tag: `deck-${deckId}` });
  } catch (err) {
    console.warn('Falha ao organizar slides próprios:', err);
    await deckRef.update({ aiStatus: 'erro' }).catch(() => {});
    await onFail().catch(() => {});
  }
}
