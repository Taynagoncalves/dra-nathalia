import { Lightbulb } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { Slide } from '@/types/models';

/** Slide em tamanho de apresentação (proporção 16:9, texto que escala com a tela). */
export function SlideView({ slide, index, total, className }: { slide: Pick<Slide, 'title' | 'bullets' | 'highlight'>; index: number; total: number; className?: string }) {
  return (
    <div
      className={cn(
        'relative flex aspect-video w-full flex-col overflow-hidden rounded-2xl border border-border bg-surface p-[4%] shadow-card',
        className,
      )}
      style={{ containerType: 'inline-size' }}
    >
      <div className="absolute inset-x-0 top-0 h-1.5 bg-primary" aria-hidden />
      <h2 className="mb-[3%] font-bold text-text" style={{ fontSize: 'clamp(1rem, 4.2cqw, 2.6rem)', lineHeight: 1.15 }}>
        {slide.title}
      </h2>
      <ul className="flex-1 space-y-[1.6%]" style={{ fontSize: 'clamp(0.8rem, 2.4cqw, 1.5rem)' }}>
        {slide.bullets.map((b, i) => (
          <li key={i} className="flex gap-[1.5%] text-text">
            <span className="mt-[0.55em] size-[0.45em] shrink-0 rounded-full bg-primary" aria-hidden />
            <span>{b}</span>
          </li>
        ))}
      </ul>
      {slide.highlight && (
        <p className="mt-[2%] flex items-start gap-[1.2%] rounded-xl bg-primary-soft p-[2%] text-primary-text" style={{ fontSize: 'clamp(0.75rem, 2cqw, 1.25rem)' }}>
          <Lightbulb className="mt-[0.15em] size-[1.1em] shrink-0" aria-hidden /> {slide.highlight}
        </p>
      )}
      <span className="absolute right-[3%] bottom-[3%] text-text-muted" style={{ fontSize: 'clamp(0.65rem, 1.4cqw, 0.9rem)' }}>
        {index + 1}/{total}
      </span>
    </div>
  );
}
