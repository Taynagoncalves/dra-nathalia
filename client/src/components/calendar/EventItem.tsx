import { Check, Clock, Pencil, Trash2 } from 'lucide-react';
import { ActionMenuButton } from '@/components/ui/ActionMenu';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/cn';
import type { CalendarEvent } from '@/types/models';
import { EVENT_META } from './eventMeta';

interface EventItemProps {
  event: CalendarEvent;
  subjectName?: string;
  overdue?: boolean;
  compact?: boolean;
  onToggleDone: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

/** Evento com caixa de "feito", tipo (ícone + nome), horário e matéria. */
export function EventItem({ event, subjectName, overdue, compact, onToggleDone, onEdit, onDelete }: EventItemProps) {
  const meta = EVENT_META[event.type];
  const Icon = meta.icon;

  return (
    <div
      className={cn(
        'group flex items-start gap-2 rounded-lg border border-border bg-surface p-2',
        event.done && 'opacity-60',
      )}
      style={{ borderLeft: `3px solid ${meta.color}` }}
    >
      <button
        type="button"
        role="checkbox"
        aria-checked={event.done}
        aria-label={event.done ? `Desmarcar “${event.title}”` : `Marcar “${event.title}” como feito`}
        onClick={onToggleDone}
        className={cn(
          'mt-0.5 grid size-5 shrink-0 place-items-center rounded-md border transition-colors',
          event.done ? 'border-success bg-success text-bg' : 'border-border hover:border-primary',
        )}
      >
        {event.done && <Check className="size-3.5" strokeWidth={3} />}
      </button>

      <button type="button" onClick={onEdit} className="min-w-0 flex-1 text-left">
        <span className={cn('block text-sm font-medium text-text', compact && 'truncate', event.done && 'line-through')}>
          {event.title}
        </span>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-text-muted">
          <span className="inline-flex items-center gap-1">
            <Icon className="size-3" style={{ color: meta.color }} aria-hidden />
            {meta.label}
          </span>
          {event.time && (
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3" aria-hidden /> {event.time}
            </span>
          )}
          {subjectName && !compact && <span className="truncate">{subjectName}</span>}
        </span>
      </button>

      {overdue && <Badge variant="warning">Atrasado</Badge>}
      <ActionMenuButton
        label={`Ações de ${event.title}`}
        className="size-7"
        actions={[
          { label: event.done ? 'Desmarcar' : 'Marcar como feito', icon: <Check className="size-4" />, onSelect: onToggleDone },
          { label: 'Editar', icon: <Pencil className="size-4" />, onSelect: onEdit },
          { label: 'Excluir', icon: <Trash2 className="size-4" />, onSelect: onDelete, danger: true, separator: true },
        ]}
      />
    </div>
  );
}
