import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { z } from 'zod';
import { userCol } from '../lib/firestoreAdmin.js';
import { jobErrorMessage, notifyUser } from '../lib/notify.js';
import { HttpError } from '../middleware/errorHandler.js';
import { generateStructured } from './client.js';
import { processMaterial } from './materials.js';

/**
 * Importar questões de uma prova (PDF oficial da banca enviado como material,
 * ou texto escrito pela própria pessoa). A IA só ORGANIZA o que está no texto:
 * enunciado, alternativas, gabarito, banca, ano, órgão e cargo. Roda em segundo
 * plano em questionImports/{id}; a pessoa revisa antes de salvar no banco.
 * (Do QConcursos e de outras plataformas, guardamos só o link — regra do projeto.)
 */

const id = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/);

export const importSchema = z
  .object({
    subjectId: id,
    materialId: id.optional(),
    text: z.string().trim().max(80_000).optional(),
    /** gabarito oficial: outro PDF (material) ou texto colado */
    answerKeyMaterialId: id.optional(),
    answerKeyText: z.string().trim().max(20_000).optional(),
  })
  .refine((v) => !!v.materialId !== !!v.text, 'Envie um PDF da prova ou cole o texto (um dos dois).');

const BATCH_CHARS = 14_000;
const MAX_BATCHES = 20;
const MAX_QUESTIONS = 150;

const Extracted = z.object({
  meta: z.object({ board: z.string().nullable(), year: z.number().int().nullable(), institution: z.string().nullable(), role: z.string().nullable() }),
  questions: z.array(
    z.object({
      number: z.number().int().nullable(),
      type: z.enum(['multipla', 'certo_errado']),
      statement: z.string(),
      options: z.array(z.string()),
      /** "A".."E", "certo", "errado" ou null quando o gabarito não está no texto */
      answer: z.string().nullable(),
      annulled: z.boolean(),
      topic: z.string().nullable(),
    }),
  ),
});

const EXTRACT_SYSTEM = `Você transforma o texto de uma prova de concurso/OAB (extraído de PDF, pode vir com quebras de linha erradas, cabeçalhos e rodapés) em questões estruturadas.

Regras:
- Copie o enunciado e as alternativas FIELMENTE (corrija só quebras de linha e hifenização do PDF). Não reescreva, não resuma, não invente.
- Se várias questões usam o mesmo texto-base ("Leia o texto para responder às questões 3 a 5"), inclua o texto-base no início do enunciado de cada uma.
- Múltipla escolha: type "multipla", options na ordem (A, B, C, D, E), SEM a letra na frente.
- Itens de certo/errado (estilo Cebraspe, "julgue os itens"): cada item vira uma questão type "certo_errado" com options = [], e o enunciado = texto-base (se houver) + o item.
- number: o número da questão/item na prova (ou null).
- answer: só preencha se o gabarito estiver no texto ("A".."E", "certo" ou "errado"); senão null. Não deduza a resposta.
- annulled: true se o texto disser que a questão foi anulada.
- topic: o assunto jurídico em poucas palavras (ex.: "Prescrição", "Controle de constitucionalidade").
- Ignore questões que começam neste trecho mas estão cortadas no final (continuam no próximo trecho), e as que já foram extraídas (lista informada).
- meta: banca, ano (número), órgão/instituição e cargo, se aparecerem no cabeçalho ou na capa; senão null.`;

const AnswerKey = z.object({ answers: z.array(z.object({ number: z.number().int(), answer: z.string() })) });

type Q = z.infer<typeof Extracted>['questions'][number];

/** Divide as páginas em trechos de ~14 mil caracteres (sem cortar páginas). */
function batchesOf(pages: string[]) {
  const out: string[] = [];
  let cur = '';
  for (const p of pages) {
    if (cur && cur.length + p.length > BATCH_CHARS) {
      out.push(cur);
      cur = '';
    }
    cur += (cur ? '\n\n' : '') + p;
  }
  if (cur) out.push(cur);
  return out;
}

async function textOfMaterial(db: Firestore, uid: string, materialId: string) {
  const ref = userCol(db, uid, 'materials').doc(materialId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpError(404, 'Material não encontrado.');
  if (snap.get('kind') !== 'pdf' && snap.get('kind') !== 'word' && snap.get('kind') !== 'note') throw new HttpError(422, 'Escolha um PDF (ou Word) da prova.');
  if (snap.get('kind') === 'note') {
    const note = await userCol(db, uid, 'notes').doc(materialId).get();
    return { title: String(snap.get('title')), pages: [String(note.get('content') ?? '').replace(/<[^>]+>/g, '\n')] };
  }
  if (snap.get('aiStatus') !== 'pronto') {
    const r = await processMaterial(db, uid, materialId);
    if (r.status !== 'pronto') throw new HttpError(422, `Não consegui ler o texto do arquivo: ${'error' in r && r.error ? r.error : 'formato não suportado'}. PDFs escaneados (só imagem) não têm texto.`);
  }
  const chunks = await ref.collection('chunks').orderBy('order').get();
  const byPage = new Map<string, string[]>();
  for (const d of chunks.docs) {
    const k = String(d.get('page') ?? d.id);
    byPage.set(k, [...(byPage.get(k) ?? []), String(d.get('text') ?? '')]);
  }
  return { title: String(snap.get('title')), pages: [...byPage.values()].map((t) => t.join('\n')) };
}

const normAnswer = (a: string | null, type: Q['type'], nOptions: number): string | null => {
  if (!a) return null;
  const v = a.trim().toLowerCase();
  if (type === 'certo_errado') return v.startsWith('c') ? 'certo' : v.startsWith('e') ? 'errado' : null;
  const i = 'abcde'.indexOf(v[0] ?? '');
  return i >= 0 && i < nOptions ? String(i) : null;
};

export async function startQuestionImport(db: Firestore, uid: string, input: z.infer<typeof importSchema>, onFail: () => Promise<void>) {
  const subject = await userCol(db, uid, 'subjects').doc(input.subjectId).get();
  if (!subject.exists) throw new HttpError(404, 'Matéria não encontrada.');
  const source = input.materialId ? await textOfMaterial(db, uid, input.materialId) : { title: 'Texto colado', pages: [input.text!] };
  const answerKey = input.answerKeyMaterialId ? (await textOfMaterial(db, uid, input.answerKeyMaterialId)).pages.join('\n').slice(0, 20_000) : (input.answerKeyText ?? '');
  const batches = batchesOf(source.pages).slice(0, MAX_BATCHES);
  if (!batches.join('').trim()) throw new HttpError(422, 'Não encontrei texto para importar.');

  const ref = userCol(db, uid, 'questionImports').doc();
  await ref.set({
    subjectId: input.subjectId,
    materialId: input.materialId ?? null,
    title: source.title,
    status: 'processando',
    progress: { done: 0, total: batches.length },
    meta: { board: null, year: null, institution: null, role: null },
    questions: [],
    jobStartedAt: Date.now(),
    createdAt: FieldValue.serverTimestamp(),
  });

  const run = async () => {
    const found: Q[] = [];
    const meta: Record<string, string | number | null> = { board: null, year: null, institution: null, role: null };
    for (let i = 0; i < batches.length && found.length < MAX_QUESTIONS; i++) {
      const done = found.map((q) => q.number).filter((n) => n !== null);
      const r = await generateStructured({
        schema: Extracted,
        system: EXTRACT_SYSTEM,
        effort: 'low',
        maxTokens: 24000,
        content: [{ text: `Trecho ${i + 1} de ${batches.length}.\nQuestões já extraídas (números): ${done.join(', ') || 'nenhuma'}\n\n${batches[i]}` }],
      });
      for (const [k, v] of Object.entries(r.meta)) if (meta[k] === null && v !== null && v !== '') meta[k] = v;
      for (const q of r.questions) {
        if (q.number !== null && done.includes(q.number)) continue;
        if (q.statement.trim().length < 10) continue;
        if (q.type === 'multipla' && q.options.filter((o) => o.trim()).length < 2) continue;
        found.push(q);
      }
      await ref.update({ progress: { done: i + 1, total: batches.length }, meta, questions: found.slice(0, MAX_QUESTIONS).map(toStored) });
    }

    // gabarito: do arquivo/texto informado, ou da seção "gabarito" no fim da própria prova
    const missing = found.filter((q) => !q.answer && q.number !== null);
    const all = source.pages.join('\n');
    const tail = answerKey || (/gabarito/i.test(all) ? all.slice(all.toLowerCase().lastIndexOf('gabarito')).slice(0, 15_000) : '');
    if (missing.length && tail.trim()) {
      const r = await generateStructured({
        schema: AnswerKey,
        system: 'Você lê o gabarito oficial de uma prova e devolve a resposta de cada número pedido: "A".."E" para múltipla escolha, "certo"/"errado" (ou "C"/"E") para itens de certo/errado. Use SOMENTE o que está no gabarito; números que não aparecem ficam de fora. Questões anuladas: answer = "X".',
        effort: 'low',
        maxTokens: 6000,
        content: [{ text: `Números pedidos: ${missing.map((q) => q.number).join(', ')}\n\nGABARITO:\n${tail}` }],
      });
      const key = new Map(r.answers.map((a) => [a.number, a.answer]));
      for (const q of found) {
        const a = q.number !== null ? key.get(q.number) : undefined;
        if (!q.answer && a) {
          if (/^x$/i.test(a.trim()) || /anul/i.test(a)) q.annulled = true;
          else q.answer = a;
        }
      }
    }
    const stored = found.slice(0, MAX_QUESTIONS).map(toStored);
    await ref.update({ status: 'revisar', meta, questions: stored, progress: { done: batches.length, total: batches.length } });
    return stored.length;
  };

  const toStored = (q: Q) => ({
    number: q.number,
    type: q.type,
    statement: q.statement.trim(),
    options: q.type === 'multipla' ? q.options.map((o) => o.trim().replace(/^\(?[A-Ea-e][).:-]\s+/, '')).filter(Boolean).slice(0, 5) : [],
    answer: normAnswer(q.answer, q.type, q.options.length),
    annulled: q.annulled,
    topic: q.topic,
  });

  const url = `/questoes/importar/${ref.id}`;
  run()
    .then((n) =>
      notifyUser(db, uid, {
        title: n ? `${n} questões prontas para revisar` : 'Nenhuma questão encontrada',
        body: n ? `${source.title}: confira o gabarito e salve no seu banco de questões.` : `Não encontrei questões em ${source.title}.`,
        url,
        tag: `import-${ref.id}`,
      }),
    )
    .catch(async (err) => {
      const error = jobErrorMessage(err, 'Não foi possível importar as questões.');
      await ref.update({ status: 'erro', error }).catch(() => {});
      await onFail().catch(() => {});
      await notifyUser(db, uid, { title: 'A importação não terminou', body: error, url, tag: `import-${ref.id}` });
    });
  return ref.id;
}
