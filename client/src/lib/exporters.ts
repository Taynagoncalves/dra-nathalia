/**
 * Exportação (Etapa 5): anotações em Markdown / Word / PDF e relatórios em CSV / PDF.
 * Tudo acontece no navegador; nada sai para servidores.
 */

/* ── HTML do TipTap → Markdown ───────────────────────────────────── */

interface HNode {
  tag: string;
  attrs: Record<string, string>;
  children: (HNode | string)[];
}

const VOID = new Set(['br', 'hr', 'img']);

const decode = (s: string) =>
  s
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, '&');

function parseHtml(html: string): HNode {
  const root: HNode = { tag: 'root', attrs: {}, children: [] };
  const stack = [root];
  const re = /<(\/?)([a-zA-Z0-9]+)([^>]*?)(\/?)>|([^<]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const top = stack[stack.length - 1]!;
    if (m[5] !== undefined) {
      top.children.push(decode(m[5]));
      continue;
    }
    const tag = m[2]!.toLowerCase();
    if (m[1]) {
      // fecha até achar a tag correspondente
      const idx = stack.map((n) => n.tag).lastIndexOf(tag);
      if (idx > 0) stack.length = idx;
      continue;
    }
    const attrs: Record<string, string> = {};
    for (const a of m[3]!.matchAll(/([a-zA-Z-]+)="([^"]*)"/g)) attrs[a[1]!.toLowerCase()] = decode(a[2]!);
    const node: HNode = { tag, attrs, children: [] };
    top.children.push(node);
    if (!VOID.has(tag) && !m[4]) stack.push(node);
  }
  return root;
}

function inline(nodes: (HNode | string)[]): string {
  return nodes
    .map((n) => {
      if (typeof n === 'string') return n.replace(/\s+/g, ' ');
      const inner = inline(n.children);
      switch (n.tag) {
        case 'strong':
        case 'b':
          return inner.trim() ? `**${inner}**` : inner;
        case 'em':
        case 'i':
          return inner.trim() ? `*${inner}*` : inner;
        case 's':
        case 'del':
          return `~~${inner}~~`;
        case 'code':
          return `\`${inner}\``;
        case 'a':
          return n.attrs.href ? `[${inner}](${n.attrs.href})` : inner;
        case 'br':
          return '  \n';
        default:
          return inner;
      }
    })
    .join('');
}

function block(node: HNode, depth = 0): string {
  const out: string[] = [];
  for (const c of node.children) {
    if (typeof c === 'string') {
      if (c.trim()) out.push(c.trim());
      continue;
    }
    switch (c.tag) {
      case 'h1':
      case 'h2':
      case 'h3':
      case 'h4':
        out.push(`${'#'.repeat(Number(c.tag[1]))} ${inline(c.children).trim()}`);
        break;
      case 'p':
        out.push(inline(c.children).trim());
        break;
      case 'blockquote':
        out.push(
          block(c, depth)
            .split('\n')
            .map((l) => (l ? `> ${l}` : '>'))
            .join('\n'),
        );
        break;
      case 'pre':
        out.push('```\n' + inline(c.children).replace(/^`|`$/g, '') + '\n```');
        break;
      case 'hr':
        out.push('---');
        break;
      case 'ul':
      case 'ol': {
        const items = c.children.filter((x): x is HNode => typeof x !== 'string' && x.tag === 'li');
        const lines = items.map((li, i) => {
          const marker = c.tag === 'ol' ? `${i + 1}.` : '-';
          const pad = '  '.repeat(depth);
          const own = li.children.filter((x) => typeof x === 'string' || !['ul', 'ol'].includes(x.tag));
          const nested = li.children.filter((x): x is HNode => typeof x !== 'string' && ['ul', 'ol'].includes(x.tag));
          const text = own.map((x) => (typeof x === 'string' ? x : x.tag === 'p' ? inline(x.children) : inline([x]))).join(' ').trim();
          const sub = nested.map((n) => block({ tag: 'root', attrs: {}, children: [n] }, depth + 1)).join('\n');
          return `${pad}${marker} ${text}${sub ? `\n${sub}` : ''}`;
        });
        out.push(lines.join('\n'));
        break;
      }
      default:
        out.push(inline([c]).trim());
    }
  }
  return out.filter((x) => x !== '').join(depth ? '\n' : '\n\n');
}

export function htmlToMarkdown(html: string): string {
  return block(parseHtml(html)).trim() + '\n';
}

/* ── Arquivos ────────────────────────────────────────────────────── */

/** Nome de arquivo seguro: "Direito Civil — Contratos" → "direito-civil-contratos". */
export function safeFileName(name: string) {
  return (
    name
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 80) || 'arquivo'
  );
}

export function downloadFile(fileName: string, content: string | Blob, mime: string) {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const PRINT_CSS = `
  body { font-family: Georgia, 'Times New Roman', serif; color: #1a1a1a; line-height: 1.6; max-width: 46rem; margin: 2rem auto; padding: 0 1.5rem; }
  h1 { font-size: 1.7rem; margin: 0 0 .25rem; } h2 { font-size: 1.3rem; margin-top: 1.8rem; } h3 { font-size: 1.1rem; }
  .meta { color: #555; font-size: .85rem; margin-bottom: 1.5rem; }
  table { border-collapse: collapse; width: 100%; font-family: system-ui, sans-serif; font-size: .85rem; margin: .5rem 0 1rem; }
  th, td { border: 1px solid #ccc; padding: .35rem .5rem; text-align: left; } th { background: #f3f0fa; }
  blockquote { border-left: 3px solid #7c3aed; margin: 0; padding-left: 1rem; color: #444; }
  .page-break { page-break-before: always; }
  @media print { body { margin: 0 auto; } }
`;

/** Documento HTML completo (serve para imprimir/PDF e para abrir no Word). */
export function htmlDocument(title: string, bodyHtml: string, meta?: string) {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>${PRINT_CSS}</style></head><body><h1>${escapeHtml(title)}</h1>${meta ? `<p class="meta">${escapeHtml(meta)}</p>` : ''}${bodyHtml}</body></html>`;
}

/** Word abre HTML com a extensão .doc (mantém títulos, listas e negrito). */
export function downloadWord(fileName: string, title: string, bodyHtml: string, meta?: string) {
  downloadFile(`${fileName}.doc`, '﻿' + htmlDocument(title, bodyHtml, meta), 'application/msword');
}

/** Abre a versão para impressão; no diálogo, escolha "Salvar como PDF". */
export function printAsPdf(title: string, bodyHtml: string, meta?: string) {
  const w = window.open('', '_blank');
  if (!w) throw new Error('O navegador bloqueou a janela de impressão. Permita pop-ups para este site.');
  w.document.open();
  w.document.write(htmlDocument(title, bodyHtml, meta));
  w.document.close();
  w.focus();
  window.setTimeout(() => w.print(), 300);
}

/* ── CSV ─────────────────────────────────────────────────────────── */

/** CSV com ";" (o Excel em português abre direto) e BOM para os acentos. */
export function toCsv(rows: (string | number | boolean | null | undefined)[][]) {
  const cell = (v: string | number | boolean | null | undefined) => {
    const s = v === null || v === undefined ? '' : typeof v === 'number' ? String(v).replace('.', ',') : String(v);
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return '﻿' + rows.map((r) => r.map(cell).join(';')).join('\r\n');
}

export { escapeHtml };
