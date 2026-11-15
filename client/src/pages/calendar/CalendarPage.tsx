import { addMonths, addWeeks, format, isSameMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { EventFormModal } from '@/components/calendar/EventFormModal';
import { EventItem } from '@/components/calendar/EventItem';
import { EVENT_META, EVENT_TYPES } from '@/components/calendar/eventMeta';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Spinner } from '@/components/ui/Feedback';
import { ErrorBlock } from '@/components/ui/States';
import { useEventMutations, useEventsInRange } from '@/hooks/useEvents';
import { useAllSubjects } from '@/hooks/useStudyData';
import { eventsByDay, fromKey, isOverdue, monthGrid, toKey, weekDays } from '@/lib/calendar';
import { cn } from '@/lib/cn';
import type { CalendarEvent } from '@/types/models';

type View = 'mes' | 'semana';
const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const VIEW_KEY = 'calendario-visao';

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export default function CalendarPage() {
  const [params, setParams] = useSearchParams();
  const todayKey = toKey(new Date());
  const anchorKey = /^\d{4}-\d{2}-\d{2}$/.test(params.get('data') ?? '') ? params.get('data')! : todayKey;
  const anchor = fromKey(anchorKey);
  const view: View =
    params.get('visao') === 'semana' || params.get('visao') === 'mes'
      ? (params.get('visao') as View)
      : ((() => {
          try {
            return localStorage.getItem(VIEW_KEY) as View | null;
          } catch {
            return null;
          }
        })() ?? 'mes');

  const [selectedKey, setSelectedKey] = useState(anchorKey);
  const [form, setForm] = useState<{ event?: CalendarEvent; date: string } | null>(null);
  const [deleting, setDeleting] = useState<CalendarEvent | null>(null);

  const days = useMemo(() => (view === 'mes' ? monthGrid(anchor) : weekDays(anchor)), [view, anchorKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const events = useEventsInRange(toKey(days[0]!), toKey(days.at(-1)!));
  const byDay = useMemo(() => eventsByDay(events.data ?? []), [events.data]);
  const subjects = useAllSubjects();
  const subjectName = (id?: string | null) => (id ? subjects.data?.find((s) => s.id === id)?.name : undefined);
  const { update, remove } = useEventMutations();

  const go = (next: { date?: Date; view?: View }) => {
    const p = new URLSearchParams(params);
    if (next.date) p.set('data', toKey(next.date));
    if (next.view) {
      p.set('visao', next.view);
      try {
        localStorage.setItem(VIEW_KEY, next.view);
      } catch {
        /* ignore */
      }
    }
    setParams(p, { replace: true });
  };
  const step = (dir: 1 | -1) => {
    const date = view === 'mes' ? addMonths(anchor, dir) : addWeeks(anchor, dir);
    go({ date });
    setSelectedKey(toKey(view === 'mes' ? new Date(date.getFullYear(), date.getMonth(), 1) : date));
  };

  const label =
    view === 'mes'
      ? cap(format(anchor, "MMMM 'de' yyyy", { locale: ptBR }))
      : `${format(days[0]!, "d 'de' MMM", { locale: ptBR })} – ${format(days[6]!, "d 'de' MMM 'de' yyyy", { locale: ptBR })}`;

  const handlers = (e: CalendarEvent) => ({
    onToggleDone: () =>
      update.mutate({ id: e.id, data: { done: !e.done } }, { onSuccess: () => !e.done && toast.success('Feito! ✓') }),
    onEdit: () => setForm({ event: e, date: e.date }),
    onDelete: () => setDeleting(e),
  });

  const selectedEvents = byDay.get(selectedKey) ?? [];

  return (
    <>
      <PageHeader
        title="Calendário"
        description="Planeje estudos, revisões e provas. Marque o que já fez."
        actions={
          <Button onClick={() => setForm({ date: selectedKey })}>
            <Plus className="size-4" /> Novo evento
          </Button>
        }
      />

      {/* Barra de navegação */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <Button variant="secondary" size="icon" onClick={() => step(-1)} aria-label={view === 'mes' ? 'Mês anterior' : 'Semana anterior'}>
            <ChevronLeft className="size-4" />
          </Button>
          <Button variant="secondary" size="icon" onClick={() => step(1)} aria-label={view === 'mes' ? 'Próximo mês' : 'Próxima semana'}>
            <ChevronRight className="size-4" />
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              go({ date: new Date() });
              setSelectedKey(todayKey);
            }}
          >
            Hoje
          </Button>
        </div>
        <h2 className="min-w-0 flex-1 truncate text-lg font-semibold text-text" aria-live="polite">
          {label}
        </h2>
        {events.isFetching && <Spinner className="size-4" label="Carregando eventos…" />}
        <div className="flex rounded-lg border border-border bg-surface p-0.5" role="group" aria-label="Visão">
          {(['mes', 'semana'] as View[]).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => go({ view: v })}
              className={cn('rounded-md px-3 py-1.5 text-sm font-medium', view === v ? 'bg-primary-soft text-primary-text' : 'text-text-muted hover:text-text')}
            >
              {v === 'mes' ? 'Mês' : 'Semana'}
            </button>
          ))}
        </div>
      </div>

      {/* Legenda dos tipos */}
      <ul className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-muted" aria-label="Tipos de evento">
        {EVENT_TYPES.map((t) => {
          const Icon = EVENT_META[t].icon;
          return (
            <li key={t} className="inline-flex items-center gap-1">
              <Icon className="size-3.5" style={{ color: EVENT_META[t].color }} aria-hidden /> {EVENT_META[t].label}
            </li>
          );
        })}
      </ul>

      {events.isError ? (
        <ErrorBlock error={events.error} onRetry={() => events.refetch()} />
      ) : view === 'mes' ? (
        <div className="grid gap-4 xl:grid-cols-[1fr_20rem]">
          {/* Visão mensal */}
          <Card className="overflow-hidden p-0">
            <div className="grid grid-cols-7 border-b border-border bg-surface text-center text-xs font-medium text-text-muted">
              {WEEKDAYS.map((d) => (
                <div key={d} className="py-2">
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {days.map((d, i) => {
                const key = toKey(d);
                const list = byDay.get(key) ?? [];
                const inMonth = isSameMonth(d, anchor);
                const isToday = key === todayKey;
                const selected = key === selectedKey;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSelectedKey(key)}
                    onDoubleClick={() => setForm({ date: key })}
                    aria-pressed={selected}
                    aria-label={`${format(d, "d 'de' MMMM", { locale: ptBR })}, ${list.length} ${list.length === 1 ? 'evento' : 'eventos'}`}
                    className={cn(
                      'flex min-h-16 flex-col items-stretch gap-1 border-border p-1 text-left transition-colors md:min-h-28 md:p-1.5',
                      i % 7 !== 6 && 'border-r',
                      i < days.length - 7 && 'border-b',
                      inMonth ? 'bg-bg' : 'bg-surface/60',
                      selected ? 'ring-2 ring-primary ring-inset' : 'hover:bg-primary-soft/40',
                    )}
                  >
                    <span
                      className={cn(
                        'grid size-6 place-items-center self-center rounded-full text-xs md:self-start',
                        isToday ? 'bg-primary font-semibold text-on-primary' : inMonth ? 'text-text' : 'text-text-muted',
                      )}
                    >
                      {format(d, 'd')}
                    </span>
                    {/* celular: só pontinhos */}
                    {list.length > 0 && (
                      <span className="flex justify-center gap-0.5 md:hidden" aria-hidden>
                        {list.slice(0, 3).map((e) => (
                          <span key={e.id} className={cn('size-1.5 rounded-full', e.done && 'opacity-40')} style={{ backgroundColor: EVENT_META[e.type].color }} />
                        ))}
                      </span>
                    )}
                    {/* telas maiores: títulos */}
                    <span className="hidden space-y-0.5 md:block">
                      {list.slice(0, 3).map((e) => (
                        <span
                          key={e.id}
                          className={cn(
                            'flex items-center gap-1 truncate rounded px-1 py-0.5 text-[11px] leading-tight text-text',
                            e.done && 'text-text-muted line-through',
                            isOverdue(e, todayKey) && 'font-medium',
                          )}
                          style={{ backgroundColor: `color-mix(in srgb, ${EVENT_META[e.type].color} 14%, transparent)` }}
                        >
                          {e.time && <span className="text-text-muted">{e.time}</span>}
                          <span className="truncate">{e.title}</span>
                        </span>
                      ))}
                      {list.length > 3 && <span className="block px-1 text-[11px] text-text-muted">+{list.length - 3} mais</span>}
                    </span>
                  </button>
                );
              })}
            </div>
          </Card>

          {/* Dia selecionado */}
          <Card className="h-fit space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-semibold text-text">{cap(format(fromKey(selectedKey), "EEEE, d 'de' MMMM", { locale: ptBR }))}</h3>
              <Button variant="ghost" size="sm" onClick={() => setForm({ date: selectedKey })}>
                <Plus className="size-4" /> Adicionar
              </Button>
            </div>
            {selectedEvents.length ? (
              <ul className="space-y-2">
                {selectedEvents.map((e) => (
                  <li key={e.id}>
                    <EventItem event={e} subjectName={subjectName(e.subjectId)} overdue={isOverdue(e, todayKey)} {...handlers(e)} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="flex items-center gap-2 py-4 text-sm text-text-muted">
                <CalendarDays className="size-4" /> Nada marcado para este dia.
              </p>
            )}
            <p className="text-xs text-text-muted">Dica: dois cliques num dia criam um evento nele.</p>
          </Card>
        </div>
      ) : (
        /* Visão semanal: colunas no computador, lista no celular */
        <div className="grid gap-2 md:grid-cols-7">
          {days.map((d) => {
            const key = toKey(d);
            const list = byDay.get(key) ?? [];
            const isToday = key === todayKey;
            return (
              <section key={key} aria-label={format(d, "EEEE, d 'de' MMMM", { locale: ptBR })} className={cn('flex flex-col rounded-xl border bg-surface p-2', isToday ? 'border-primary' : 'border-border')}>
                <header className="mb-2 flex items-center justify-between gap-1">
                  <span className="text-sm">
                    <span className="text-text-muted capitalize">{format(d, 'EEE', { locale: ptBR })}</span>{' '}
                    <span className={cn('font-semibold', isToday ? 'text-primary-text' : 'text-text')}>{format(d, 'd')}</span>
                  </span>
                  <Button variant="ghost" size="icon" className="size-7" onClick={() => setForm({ date: key })} aria-label={`Adicionar evento em ${format(d, "d 'de' MMMM", { locale: ptBR })}`}>
                    <Plus className="size-4" />
                  </Button>
                </header>
                <ul className="space-y-1.5">
                  {list.map((e) => (
                    <li key={e.id}>
                      <EventItem compact event={e} subjectName={subjectName(e.subjectId)} overdue={isOverdue(e, todayKey)} {...handlers(e)} />
                    </li>
                  ))}
                  {!list.length && <li className="py-2 text-center text-xs text-text-muted md:py-6">—</li>}
                </ul>
              </section>
            );
          })}
        </div>
      )}

      <EventFormModal open={!!form} onClose={() => setForm(null)} event={form?.event} defaultDate={form?.date ?? selectedKey} />
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title={`Excluir “${deleting?.title}”?`}
        confirmLabel="Excluir"
        danger
        onConfirm={() => {
          if (deleting) remove.mutate(deleting.id, { onSuccess: () => toast.success('Evento excluído.') });
          setDeleting(null);
        }}
      />
    </>
  );
}
