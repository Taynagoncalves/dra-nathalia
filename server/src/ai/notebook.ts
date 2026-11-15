import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { z } from 'zod';
import { userCol } from '../lib/firestoreAdmin.js';
import { HttpError } from '../middleware/errorHandler.js';
import { generateStructured } from './client.js';
import { formatSourceDocs, loadSourceDocs, type SourceDoc } from './materials.js';
import { LEGAL_INTEGRITY } from './prompts.js';

/**
 * Caderno IA (estilo NotebookLM): conversar com os materiais da matéria e
 * gerar resumo, guia de estudo, perguntas frequentes, linha do tempo e mapa
 * mental — sempre citando a fonte e a página.
 */

const id = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/);

/* ── Fontes ─────────────────────────────────────────────────────── */

/** Materiais escolhidos (ou todos os prontos da matéria). */
async function sourcesFor(db: Firestore, uid: string, subjectId: string, materialIds: string[]) {
  const subject = await userCol(db, uid, 'subjects').doc(subjectId).get();
  if (!subject.exists) throw new HttpError(404, 'Matéria não encontrada.');
  let ids = materialIds;
  if (!ids.length) {
    const all = await userCol(db, uid, 'materials').where('subjectId', '==', subjectId).get();
    ids = all.docs.filter((d) => d.get('kind') === 'note' || d.get('aiStatus') === 'pronto').map((d) => d.id);
  }
  const docs = await loadSourceDocs(db, uid, ids.slice(0, 50));
  if (!docs.length) {
    throw new HttpError(422, 'Nenhuma fonte pronta: envie PDFs, Word ou PowerPoint (e espere ficar “Pronto para IA”) ou escreva anotações.');
  }
  return { subjectName: String(subject.get('name')), docs };
}

const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
const STOP = new Set('para pelo pela como qual quais quando onde sobre entre esse essa este esta isso isto sao nao mais muito uma umas uns dos das nos nas com sem que por art'.split(' '));
const terms = (s: string) => normalize(s).match(/[a-z0-9]{3,}/g)?.filter((w) => !STOP.has(w)) ?? [];

/**
 * Busca simples: quando os materiais não cabem inteiros, mantém os trechos que
 * mais combinam com a pergunta (e os vizinhos, para não perder contexto).
 */
function focusDocs(docs: SourceDoc[], question: string, budgetChars: number): SourceDoc[] {
  const total = docs.reduce((t, d) => t + d.segments.reduce((u, s) => u + s.text.length, 0), 0);
  if (total <= budgetChars) return docs;
  const q = new Set(terms(question));
  const scored = docs.flatMap((d, di) =>
    d.segments.map((s, si) => {
      const words = terms(s.text);
      const hits = words.filter((w) => q.has(w)).length;
      return { di, si, score: hits / Math.sqrt(words.length + 20), len: s.text.length };
    }),
  );
  const keep = new Set<string>();
  let used = 0;
  for (const c of [...scored].sort((a, b) => b.score - a.score)) {
    for (const si of [c.si, c.si - 1, c.si + 1]) {
      const key = `${c.di}:${si}`;
      const seg = docs[c.di]!.segments[si];
      if (!seg || keep.has(key)) continue;
      if (used + seg.text.length > budgetChars) return pick();
      keep.add(key);
      used += seg.text.length;
    }
  }
  return pick();
  function pick() {
    return docs
      .map((d, di) => ({ ...d, segments: d.segments.filter((_, si) => keep.has(`${di}:${si}`)) }))
      .filter((d) => d.segments.length);
  }
}

/* ── Citações ───────────────────────────────────────────────────── */

const Citation = z.object({ ref: z.string(), page: z.number().int().nullable(), quote: z.string() });

export interface ResolvedCitation {
  materialId: string | null;
  title: string;
  page: number | null;
  quote: string;
}

const resolver = (docs: SourceDoc[]) => {
  const byRef = new Map(docs.map((d) => [d.ref, d]));
  return (c: z.infer<typeof Citation> | null | undefined): ResolvedCitation | null => {
    if (!c) return null;
    const d = byRef.get(c.ref);
    if (!d) return null;
    return { materialId: d.materialId, title: d.title, page: c.page, quote: c.quote.slice(0, 400) };
  };
};

const CITE_RULES = `Citações: cada afirmação importante deve indicar de onde veio, com o documento (ref, ex.: "M1"), a página (número do atributo pagina do trecho, ou null) e uma citação literal curta (até ~200 caracteres) copiada do trecho.`;

/* ── Chat ───────────────────────────────────────────────────────── */

export const chatSchema = z.object({
  subjectId: id,
  materialIds: z.array(id).max(50).default([]),
  message: z.string().trim().min(1).max(4000),
});

const ChatAnswer = z.object({
  answer: z.string(),
  citations: z.array(Citation.extend({ n: z.number().int() })),
  followUps: z.array(z.string()),
  /** a resposta saiu (em parte) de conhecimento geral, não dos materiais */
  usedGeneralKnowledge: z.boolean(),
});

const CHAT_SYSTEM = `Você é a assistente de estudos do aluno, no estilo NotebookLM: responde com base nos documentos dele.

${LEGAL_INTEGRITY}

Como responder:
- Responda em português, de forma clara e didática, em parágrafos curtos (pode usar listas com "- ").
- Use SOMENTE os documentos fornecidos. Marque cada afirmação apoiada nos documentos com [n] no texto (ex.: "… é de 3 anos [1]."), e liste em citations o n, o documento, a página e o trecho.
- Se a resposta não estiver nos documentos, diga claramente: "Não encontrei isso nos seus materiais." Se ajudar, complemente com conhecimento geral consolidado, deixando explícito que não veio dos materiais, e marque usedGeneralKnowledge = true.
- followUps: 2 ou 3 perguntas curtas que o aluno poderia fazer em seguida.
${CITE_RULES}`;

const MAX_HISTORY = 40;

export async function notebookChat(db: Firestore, uid: string, input: z.infer<typeof chatSchema>) {
  const { subjectName, docs } = await sourcesFor(db, uid, input.subjectId, input.materialIds);
  const chatRef = userCol(db, uid, 'notebookChats').doc(input.subjectId);
  const history = (((await chatRef.get()).get('messages') as { role: string; text: string }[] | undefined) ?? []).slice(-10);

  const focused = focusDocs(docs, `${history.filter((m) => m.role === 'user').slice(-2).map((m) => m.text).join(' ')} ${input.message}`, 100_000);
  const { xml } = formatSourceDocs(focused, 100_000);
  const convo = history.map((m) => `${m.role === 'user' ? 'Aluno' : 'Assistente'}: ${m.text.slice(0, 1500)}`).join('\n\n');

  const r = await generateStructured({
    schema: ChatAnswer,
    system: CHAT_SYSTEM,
    effort: 'medium',
    maxTokens: 8000,
    content: [
      { text: xml, cache: true },
      {
        text: `Matéria: ${subjectName}.${convo ? `\n\nConversa até agora:\n${convo}` : ''}\n\nNova pergunta do aluno: ${input.message}`,
      },
    ],
  });

  const resolve = resolver(focused);
  const citations = r.citations
    .map((c) => ({ n: c.n, ...resolve(c) }))
    .filter((c): c is { n: number } & ResolvedCitation => !!c.title);
  const reply = {
    role: 'assistant',
    text: r.answer,
    citations,
    followUps: r.followUps.slice(0, 3),
    generalKnowledge: r.usedGeneralKnowledge,
  };
  const all = [...(((await chatRef.get()).get('messages') as unknown[]) ?? []), { role: 'user', text: input.message }, reply].slice(-MAX_HISTORY);
  await chatRef.set({ subjectId: input.subjectId, messages: all, updatedAt: FieldValue.serverTimestamp() });
  return reply;
}

export async function clearNotebookChat(db: Firestore, uid: string, subjectId: string) {
  await userCol(db, uid, 'notebookChats').doc(subjectId).delete();
}

/* ── Estúdio: resumo, guia, FAQ, linha do tempo, mapa mental ───── */

export const STUDIO_KINDS = ['resumo', 'guia', 'faq', 'linha_do_tempo', 'mapa_mental'] as const;
export type StudioKind = (typeof STUDIO_KINDS)[number];

export const studioSchema = z.object({
  subjectId: id,
  materialIds: z.array(id).max(50).default([]),
  kind: z.enum(STUDIO_KINDS),
});

const C = Citation.nullable();
const SCHEMAS = {
  resumo: z.object({
    title: z.string(),
    overview: z.string(),
    keyPoints: z.array(z.object({ point: z.string(), detail: z.string(), citation: C })),
  }),
  guia: z.object({
    title: z.string(),
    objectives: z.array(z.string()),
    sections: z.array(
      z.object({
        topic: z.string(),
        explanation: z.string(),
        keyTerms: z.array(z.object({ term: z.string(), definition: z.string() })),
        citation: C,
      }),
    ),
    selfCheck: z.array(z.object({ question: z.string(), answer: z.string() })),
  }),
  faq: z.object({
    title: z.string(),
    items: z.array(z.object({ question: z.string(), answer: z.string(), citation: C })),
  }),
  linha_do_tempo: z.object({
    title: z.string(),
    events: z.array(z.object({ when: z.string(), what: z.string(), why: z.string(), citation: C })),
  }),
  mapa_mental: z.object({
    title: z.string(),
    root: z.string(),
    branches: z.array(
      z.object({
        label: z.string(),
        summary: z.string(),
        citation: C,
        children: z.array(z.object({ label: z.string(), summary: z.string(), citation: C })),
      }),
    ),
  }),
} satisfies Record<StudioKind, z.ZodType>;

const TASKS: Record<StudioKind, string> = {
  resumo: 'Escreva um RESUMO: um panorama (overview, 1 parágrafo) e de 6 a 12 pontos-chave, cada um com um detalhe explicativo.',
  guia: 'Monte um GUIA DE ESTUDO: objetivos de aprendizagem; seções por tema com explicação didática e termos-chave com definição; e 5 a 8 perguntas de autoavaliação com resposta.',
  faq: 'Crie PERGUNTAS FREQUENTES: 8 a 12 perguntas que um aluno faria sobre o conteúdo, com respostas objetivas.',
  linha_do_tempo:
    'Monte uma LINHA DO TEMPO dos marcos do conteúdo (leis, alterações legislativas, fases de um procedimento, prazos ou etapas em ordem). Em "when" use a data ou a etapa (ex.: "1988", "Fase postulatória", "Prazo de 15 dias"). Se o conteúdo não tiver ordem temporal, use a ordem lógica do procedimento.',
  mapa_mental:
    'Monte um MAPA MENTAL: um nó central (root) com 4 a 8 ramos principais; cada ramo com resumo curto e 2 a 6 sub-ramos (children), cada um com resumo curto. Rótulos curtos (até ~6 palavras).',
};

const STUDIO_SYSTEM = `Você é uma professora de Direito que transforma os materiais do aluno em material de estudo, no estilo do NotebookLM.

${LEGAL_INTEGRITY}

- Use SOMENTE os documentos fornecidos. Não acrescente conteúdo que eles não sustentam.
- Linguagem clara e didática, em português.
- Preencha citation quando o item vier de um trecho específico (ou null).
${CITE_RULES}`;

export async function generateStudio(db: Firestore, uid: string, input: z.infer<typeof studioSchema>) {
  const { subjectName, docs } = await sourcesFor(db, uid, input.subjectId, input.materialIds);
  const { xml, truncated } = formatSourceDocs(docs, 180_000);
  const schema = SCHEMAS[input.kind];
  const raw = (await generateStructured({
    schema,
    system: STUDIO_SYSTEM,
    effort: 'medium',
    maxTokens: 16000,
    content: [{ text: xml, cache: true }, { text: `Matéria: ${subjectName}.\n\n${TASKS[input.kind]}` }],
  })) as Record<string, unknown>;

  // Troca as referências (M1…) pelos materiais reais, em qualquer nível
  const resolve = resolver(docs);
  const walk = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(walk);
    if (!node || typeof node !== 'object') return node;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node)) out[k] = k === 'citation' ? resolve(v as z.infer<typeof Citation> | null) : walk(v);
    return out;
  };
  const content = walk(raw) as Record<string, unknown>;

  const ref = userCol(db, uid, 'notebookItems').doc();
  const item = {
    subjectId: input.subjectId,
    kind: input.kind,
    title: String(content.title ?? '').slice(0, 150),
    content,
    sourceMaterialIds: docs.map((d) => d.materialId),
    truncated,
    createdAt: FieldValue.serverTimestamp(),
  };
  await ref.set(item);
  return { id: ref.id, ...item, createdAt: null };
}
