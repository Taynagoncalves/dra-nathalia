import JSZip from 'jszip';
import mammoth from 'mammoth';
import { PDFParse } from 'pdf-parse';

/** Um pedaço de texto com a sua origem (página do PDF, slide do PowerPoint…). */
export interface Segment {
  /** número da página/slide (null quando o formato não tem páginas, como Word) */
  page: number | null;
  /** "p. 12", "slide 3", "parte 2" */
  label: string;
  text: string;
}

const CHUNK_CHARS = 2000;

const clean = (s: string) =>
  s
    .replace(/\u0000/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();

/** Quebra textos longos em trechos de ~2000 caracteres, sem cortar palavras. */
export function chunkSegments(segments: Segment[]): Segment[] {
  const out: Segment[] = [];
  for (const s of segments) {
    let text = clean(s.text);
    while (text.length > CHUNK_CHARS) {
      let cut = text.lastIndexOf('\n', CHUNK_CHARS);
      if (cut < CHUNK_CHARS * 0.5) cut = text.lastIndexOf(' ', CHUNK_CHARS);
      if (cut <= 0) cut = CHUNK_CHARS;
      out.push({ ...s, text: text.slice(0, cut).trim() });
      text = text.slice(cut).trim();
    }
    if (text) out.push({ ...s, text });
  }
  return out;
}

async function fromPdf(buffer: Buffer): Promise<Segment[]> {
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const result = await parser.getText();
    return result.pages.map((p) => ({ page: p.num, label: `p. ${p.num}`, text: p.text }));
  } finally {
    await parser.destroy();
  }
}

async function fromDocx(buffer: Buffer): Promise<Segment[]> {
  const { value } = await mammoth.extractRawText({ buffer });
  // Word não tem páginas fixas: dividimos em partes numeradas.
  return chunkSegments([{ page: null, label: 'parte', text: value }]).map((s, i) => ({ ...s, label: `parte ${i + 1}` }));
}

async function fromPptx(buffer: Buffer): Promise<Segment[]> {
  const zip = await JSZip.loadAsync(buffer);
  const slides = Object.keys(zip.files)
    .map((name) => ({ name, n: Number(name.match(/^ppt\/slides\/slide(\d+)\.xml$/)?.[1]) }))
    .filter((s) => s.n)
    .sort((a, b) => a.n - b.n);
  const out: Segment[] = [];
  for (const s of slides) {
    const xml = await zip.file(s.name)!.async('string');
    // cada parágrafo (<a:p>) vira uma linha; o texto fica em <a:t>
    const text = xml
      .split(/<\/a:p>/)
      .map((p) => [...p.matchAll(/<a:t[^>]*>([^<]*)<\/a:t>/g)].map((m) => m[1]).join(''))
      .filter(Boolean)
      .join('\n')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;|&apos;/g, "'");
    if (text.trim()) out.push({ page: s.n, label: `slide ${s.n}`, text });
  }
  return out;
}

/** Texto de uma anotação (HTML do editor). */
export function fromNoteHtml(html: string): Segment[] {
  const text = html
    .replace(/<\/(p|h[1-6]|li|blockquote|pre)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  return chunkSegments([{ page: null, label: 'anotação', text }]);
}

export class UnsupportedFormatError extends Error {}

/** Extrai o texto de um arquivo de material, em trechos com página/slide. */
export async function extractSegments(buffer: Buffer, format: string): Promise<Segment[]> {
  const f = format.toLowerCase();
  if (f === 'pdf') return chunkSegments(await fromPdf(buffer));
  if (f === 'docx') return fromDocx(buffer);
  if (f === 'pptx') return chunkSegments(await fromPptx(buffer));
  if (f === 'doc' || f === 'ppt') {
    throw new UnsupportedFormatError('Formato antigo (.doc/.ppt): salve como .docx/.pptx para usar com a IA.');
  }
  throw new UnsupportedFormatError('Este tipo de arquivo não tem texto para a IA ler.');
}
