import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { deleteRefs, userCol } from '../lib/firestoreAdmin.js';
import { HttpError } from '../middleware/errorHandler.js';
import { extractSegments, fromNoteHtml, UnsupportedFormatError, type Segment } from './extract.js';

const MIN_CHARS = 200;

/**
 * Extrai o texto de um material (PDF, Word, PowerPoint) e guarda em
 * materials/{id}/chunks (texto, página e ordem). É o contexto que a IA lê.
 * Status no card: processando → pronto | erro.
 */
export async function processMaterial(db: Firestore, uid: string, materialId: string) {
  const ref = userCol(db, uid, 'materials').doc(materialId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpError(404, 'Material não encontrado.');
  const m = snap.data() as { kind: string; cloudinary?: { url: string; format?: string | null; originalFilename?: string } };

  if (m.kind === 'note' || m.kind === 'link') {
    // anotações são lidas na hora (texto sempre atualizado); links não têm conteúdo próprio
    await ref.update({ aiStatus: m.kind === 'note' ? 'pronto' : 'indisponivel' });
    return { status: m.kind === 'note' ? 'pronto' : 'indisponivel' };
  }
  if (m.kind === 'image' || !m.cloudinary) {
    await ref.update({ aiStatus: 'indisponivel', aiError: 'Imagens ainda não são lidas pela IA.' });
    return { status: 'indisponivel' };
  }

  await ref.update({ aiStatus: 'processando', aiError: FieldValue.delete() });
  try {
    const res = await fetch(m.cloudinary.url);
    if (!res.ok) {
      throw new UnsupportedFormatError(
        res.status === 401
          ? 'O Cloudinary bloqueou o arquivo. Ative "Allow delivery of PDF and ZIP files" (veja o README).'
          : `Não foi possível baixar o arquivo (${res.status}).`,
      );
    }
    const format = m.cloudinary.format || m.cloudinary.originalFilename?.split('.').pop() || '';
    const segments = await extractSegments(Buffer.from(await res.arrayBuffer()), format);
    const chars = segments.reduce((t, s) => t + s.text.length, 0);
    if (chars < MIN_CHARS) {
      throw new UnsupportedFormatError('Não encontramos texto no arquivo (pode ser um PDF escaneado, só com imagens).');
    }

    // Substitui os trechos antigos
    const chunks = ref.collection('chunks');
    const old = await chunks.get();
    await deleteRefs(db, old.docs.map((d) => d.ref));
    const batchSize = 400;
    for (let i = 0; i < segments.length; i += batchSize) {
      const batch = db.batch();
      segments.slice(i, i + batchSize).forEach((s, j) => {
        batch.set(chunks.doc(String(i + j).padStart(5, '0')), { order: i + j, page: s.page, label: s.label, text: s.text });
      });
      await batch.commit();
    }
    const pages = new Set(segments.map((s) => s.page).filter((p) => p !== null)).size;
    await ref.update({ aiStatus: 'pronto', aiChars: chars, aiPages: pages || null, aiProcessedAt: FieldValue.serverTimestamp() });
    return { status: 'pronto', chars, chunks: segments.length };
  } catch (err) {
    const message = err instanceof UnsupportedFormatError ? err.message : 'Falha ao ler o arquivo.';
    if (!(err instanceof UnsupportedFormatError)) console.error('Falha ao processar material:', err);
    await ref.update({ aiStatus: 'erro', aiError: message });
    return { status: 'erro', error: message };
  }
}

export interface SourceDoc {
  /** referência curta usada no prompt: M1, M2… */
  ref: string;
  materialId: string;
  title: string;
  kind: string;
  segments: Segment[];
}

/** Carrega o texto dos materiais (trechos já extraídos ou anotação ao vivo). */
export async function loadSourceDocs(db: Firestore, uid: string, materialIds: string[]): Promise<SourceDoc[]> {
  const docs: SourceDoc[] = [];
  for (const id of materialIds) {
    const ref = userCol(db, uid, 'materials').doc(id);
    const snap = await ref.get();
    if (!snap.exists) continue;
    const m = snap.data() as { title: string; kind: string; aiStatus?: string };
    let segments: Segment[] = [];
    if (m.kind === 'note') {
      const note = await userCol(db, uid, 'notes').doc(id).get();
      segments = fromNoteHtml(String(note.get('content') ?? ''));
    } else if (m.aiStatus === 'pronto') {
      const chunks = await ref.collection('chunks').orderBy('order').get();
      segments = chunks.docs.map((d) => ({ page: d.get('page'), label: d.get('label'), text: d.get('text') }));
    }
    if (segments.length) docs.push({ ref: `M${docs.length + 1}`, materialId: id, title: m.title, kind: m.kind, segments });
  }
  return docs;
}

/**
 * Monta o contexto em XML para o prompt. Se passar do orçamento, escolhe
 * trechos espalhados de forma uniforme por todos os materiais (sem cortar o meio
 * de um trecho) e avisa.
 */
export function formatSourceDocs(docs: SourceDoc[], budgetChars = 180_000) {
  const all = docs.flatMap((d) => d.segments.map((s) => ({ d, s })));
  const total = all.reduce((t, x) => t + x.s.text.length, 0);
  let picked = all;
  if (total > budgetChars) {
    // de cada material, trechos igualmente espaçados na proporção que cabe
    const ratio = budgetChars / total;
    picked = docs.flatMap((d) => {
      const n = Math.max(1, Math.floor(d.segments.length * ratio));
      const idx = [...new Set(Array.from({ length: n }, (_, k) => Math.floor((k * d.segments.length) / n)))];
      return idx.map((i) => ({ d, s: d.segments[i]! }));
    });
  }
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const parts: string[] = ['<documentos>'];
  for (const d of docs) {
    const segs = picked.filter((x) => x.d === d);
    if (!segs.length) continue;
    parts.push(`<documento ref="${d.ref}" titulo="${esc(d.title)}" tipo="${d.kind}">`);
    for (const { s } of segs) {
      const attr = s.page !== null ? `pagina="${s.page}"` : `parte="${esc(s.label)}"`;
      parts.push(`<trecho ${attr}>\n${esc(s.text)}\n</trecho>`);
    }
    parts.push('</documento>');
  }
  parts.push('</documentos>');
  return { xml: parts.join('\n'), truncated: total > budgetChars };
}
