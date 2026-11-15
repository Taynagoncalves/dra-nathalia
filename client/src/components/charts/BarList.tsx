import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface BarListItem {
  key: string;
  label: ReactNode;
  value: number;
  /** texto do valor (ex.: "72% · 18 questões") */
  display: string;
  /** cor do marcador ao lado do nome (identidade, ex.: cor da matéria) */
  swatch?: string;
}

interface BarListProps {
  items: BarListItem[];
  /** valor que representa a barra cheia (padrão: o maior valor da lista) */
  max?: number;
  emptyText?: string;
  className?: string;
  'aria-label': string;
}

/**
 * Gráfico de barras horizontais em HTML: legível no celular com nomes longos.
 * Série única → uma cor só (a principal do tema); valores em texto, nunca só na cor.
 */
export function BarList({ items, max, emptyText = 'Sem dados ainda.', className, ...aria }: BarListProps) {
  if (!items.length) return <p className="py-4 text-sm text-text-muted">{emptyText}</p>;
  const top = max ?? Math.max(...items.map((i) => i.value), 1);
  return (
    <ul className={cn('space-y-3', className)} aria-label={aria['aria-label']}>
      {items.map((i) => (
        <li key={i.key} title={`${typeof i.label === 'string' ? i.label : ''} ${i.display}`.trim()}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-center gap-1.5 text-text">
              {i.swatch && <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: i.swatch }} aria-hidden />}
              <span className="truncate">{i.label}</span>
            </span>
            <span className="shrink-0 tabular-nums text-text-muted">{i.display}</span>
          </div>
          <div className="h-2 w-full rounded-full bg-primary-soft">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-300"
              style={{ width: `${i.value > 0 ? Math.max(3, (i.value / top) * 100) : 0}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
