import { BookOpen, ExternalLink } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import type { NotebookCitation } from '@/types/models';

/** Link para abrir o material na página citada (em nova aba). */
export function citationHref(subjectId: string, c: NotebookCitation) {
  if (!c.materialId) return null;
  const p = new URLSearchParams({ abrir: c.materialId });
  if (c.page) p.set('pagina', String(c.page));
  return `/materias/${subjectId}?${p}`;
}

export const citationLabel = (c: NotebookCitation) => `${c.title}${c.page ? `, p. ${c.page}` : ''}`;

/** [n] clicável: mostra o trecho citado e o link para o material. */
export function CitationChip({ n, citation, subjectId }: { n: number | string; citation?: NotebookCitation | null; subjectId: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  if (!citation) return <sup className="text-text-muted">[{n}]</sup>;
  const href = citationHref(subjectId, citation);
  return (
    <span ref={ref} className="relative inline-block align-baseline">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={`Fonte ${n}: ${citationLabel(citation)}`}
        className="mx-0.5 inline-grid min-w-5 place-items-center rounded-full bg-primary-soft px-1.5 text-[11px] leading-5 font-semibold text-primary-text hover:bg-primary hover:text-on-primary"
      >
        {n}
      </button>
      {open && (
        <span className="absolute bottom-full left-1/2 z-30 mb-2 block w-72 -translate-x-1/2 rounded-xl border border-border bg-surface-elevated p-3 text-left shadow-card">
          <span className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-text">
            <BookOpen className="size-3.5 text-primary-text" /> {citationLabel(citation)}
          </span>
          <span className="block border-l-2 border-primary pl-2 text-xs text-text-muted italic">“{citation.quote}”</span>
          {href && (
            <a href={href} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary-text hover:underline">
              Abrir no material <ExternalLink className="size-3" />
            </a>
          )}
        </span>
      )}
    </span>
  );
}

/** Fonte única (sem número), usada nos itens do estúdio. */
export function SourceTag({ citation, subjectId, className }: { citation: NotebookCitation | null | undefined; subjectId: string; className?: string }) {
  if (!citation) return null;
  const href = citationHref(subjectId, citation);
  const content = (
    <>
      <BookOpen className="size-3 shrink-0" /> <span className="truncate">{citationLabel(citation)}</span>
    </>
  );
  const cls = cn('inline-flex max-w-full items-center gap-1 rounded-full bg-primary-soft px-2 py-0.5 text-[11px] font-medium text-primary-text', className);
  return href ? (
    <a href={href} target="_blank" rel="noopener noreferrer" title={`“${citation.quote}”`} className={cn(cls, 'hover:underline')}>
      {content}
    </a>
  ) : (
    <span title={`“${citation.quote}”`} className={cls}>
      {content}
    </span>
  );
}
