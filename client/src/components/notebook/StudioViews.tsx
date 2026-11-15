import { ChevronDown, Network } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/cn';
import type { NotebookCitation, StudioContent } from '@/types/models';
import { SourceTag } from './Citation';

/** Cores dos ramos do mapa mental (as do tema, então seguem claro/escuro). */
const BRANCH_COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)'];

export function ResumoView({ c, subjectId }: { c: StudioContent['resumo']; subjectId: string }) {
  return (
    <div className="space-y-5">
      <p className="text-sm leading-relaxed text-text">{c.overview}</p>
      <ol className="space-y-3">
        {c.keyPoints.map((p, i) => (
          <li key={i} className="flex gap-3">
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary-soft text-xs font-bold text-primary-text">{i + 1}</span>
            <div className="min-w-0 space-y-1">
              <p className="font-medium text-text">{p.point}</p>
              <p className="text-sm text-text-muted">{p.detail}</p>
              <SourceTag citation={p.citation} subjectId={subjectId} />
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function GuiaView({ c, subjectId }: { c: StudioContent['guia']; subjectId: string }) {
  return (
    <div className="space-y-6">
      {c.objectives.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-semibold tracking-wide text-text-muted uppercase">Objetivos</h3>
          <ul className="list-disc space-y-1 pl-5 text-sm text-text">
            {c.objectives.map((o, i) => (
              <li key={i}>{o}</li>
            ))}
          </ul>
        </section>
      )}
      {c.sections.map((s, i) => (
        <section key={i} className="space-y-2 rounded-xl border border-border p-4">
          <h3 className="font-semibold text-text">{s.topic}</h3>
          <p className="text-sm leading-relaxed whitespace-pre-line text-text">{s.explanation}</p>
          {s.keyTerms.length > 0 && (
            <dl className="grid gap-x-4 gap-y-1.5 text-sm sm:grid-cols-[auto_1fr]">
              {s.keyTerms.map((t, j) => (
                <div key={j} className="contents">
                  <dt className="font-medium text-primary-text">{t.term}</dt>
                  <dd className="text-text-muted">{t.definition}</dd>
                </div>
              ))}
            </dl>
          )}
          <SourceTag citation={s.citation} subjectId={subjectId} />
        </section>
      ))}
      {c.selfCheck.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-semibold tracking-wide text-text-muted uppercase">Teste-se</h3>
          <QA items={c.selfCheck.map((q) => ({ question: q.question, answer: q.answer, citation: null }))} subjectId={subjectId} />
        </section>
      )}
    </div>
  );
}

function QA({ items, subjectId }: { items: { question: string; answer: string; citation: NotebookCitation | null }[]; subjectId: string }) {
  return (
    <ul className="space-y-2">
      {items.map((q, i) => (
        <li key={i}>
          <details className="group rounded-xl border border-border bg-surface">
            <summary className="flex cursor-pointer list-none items-start gap-2 p-3 text-sm font-medium text-text">
              <ChevronDown className="mt-0.5 size-4 shrink-0 text-text-muted transition-transform group-open:rotate-180" />
              {q.question}
            </summary>
            <div className="space-y-2 px-3 pb-3 pl-9">
              <p className="text-sm whitespace-pre-line text-text-muted">{q.answer}</p>
              <SourceTag citation={q.citation} subjectId={subjectId} />
            </div>
          </details>
        </li>
      ))}
    </ul>
  );
}

export function FaqView({ c, subjectId }: { c: StudioContent['faq']; subjectId: string }) {
  return <QA items={c.items} subjectId={subjectId} />;
}

export function TimelineView({ c, subjectId }: { c: StudioContent['linha_do_tempo']; subjectId: string }) {
  return (
    <ol className="relative space-y-5 border-l-2 border-primary/40 pl-6">
      {c.events.map((e, i) => (
        <li key={i} className="relative">
          <span className="absolute top-1 -left-[1.95rem] size-3.5 rounded-full border-2 border-surface bg-primary" aria-hidden />
          <p className="text-xs font-semibold tracking-wide text-primary-text uppercase">{e.when}</p>
          <p className="font-medium text-text">{e.what}</p>
          {e.why && <p className="text-sm text-text-muted">{e.why}</p>}
          <SourceTag citation={e.citation} subjectId={subjectId} className="mt-1" />
        </li>
      ))}
    </ol>
  );
}

type Selected = { label: string; summary: string; citation: NotebookCitation | null; color: string } | null;

/** Mapa mental: nó central, ramos coloridos e sub-ramos clicáveis que mostram a explicação. */
export function MindMapView({ c, subjectId }: { c: StudioContent['mapa_mental']; subjectId: string }) {
  const [selected, setSelected] = useState<Selected>(null);

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_18rem]">
      <div className="space-y-4">
        <div className="flex justify-center">
          <span className="inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-3 text-center font-semibold text-on-primary shadow-card">
            <Network className="size-5" /> {c.root}
          </span>
        </div>
        <div className="mx-auto h-4 w-0.5 bg-border" aria-hidden />
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {c.branches.map((b, i) => {
            const color = BRANCH_COLORS[i % BRANCH_COLORS.length]!;
            const pick = (label: string, summary: string, citation: NotebookCitation | null) => setSelected({ label, summary, citation, color });
            return (
              <li key={i} className="rounded-xl border border-border bg-surface p-3" style={{ borderTop: `4px solid ${color}` }}>
                <button
                  type="button"
                  onClick={() => pick(b.label, b.summary, b.citation)}
                  aria-pressed={selected?.label === b.label}
                  className="w-full text-left font-semibold text-text hover:underline"
                >
                  {b.label}
                </button>
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {b.children.map((ch, j) => (
                    <li key={j}>
                      <button
                        type="button"
                        onClick={() => pick(ch.label, ch.summary, ch.citation)}
                        aria-pressed={selected?.label === ch.label}
                        className={cn(
                          'rounded-full border px-2.5 py-1 text-xs transition-colors',
                          selected?.label === ch.label ? 'border-primary bg-primary-soft font-medium text-primary-text' : 'border-border text-text hover:bg-primary-soft',
                        )}
                        style={{ borderColor: selected?.label === ch.label ? undefined : `color-mix(in srgb, ${color} 45%, var(--border))` }}
                      >
                        {ch.label}
                      </button>
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ul>
      </div>

      <aside className="h-fit rounded-xl border border-border bg-bg p-4 lg:sticky lg:top-20" aria-live="polite">
        {selected ? (
          <div className="space-y-2">
            <p className="flex items-center gap-2 font-semibold text-text">
              <span className="size-2.5 rounded-full" style={{ backgroundColor: selected.color }} aria-hidden />
              {selected.label}
            </p>
            <p className="text-sm leading-relaxed text-text-muted">{selected.summary}</p>
            <SourceTag citation={selected.citation} subjectId={subjectId} />
          </div>
        ) : (
          <p className="text-sm text-text-muted">Toque num ramo ou sub-ramo para ver a explicação e a fonte.</p>
        )}
      </aside>
    </div>
  );
}
