import { useEffect, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Field, Input, Textarea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { SubjectSelect } from '@/components/ui/SubjectSelect';
import { useEventMutations } from '@/hooks/useEvents';
import { cn } from '@/lib/cn';
import type { CalendarEvent, EventType } from '@/types/models';
import { EVENT_META, EVENT_TYPES } from './eventMeta';

interface EventFormModalProps {
  open: boolean;
  onClose: () => void;
  /** sem evento = criar */
  event?: CalendarEvent;
  defaultDate: string;
}

export function EventFormModal({ open, onClose, event, defaultDate }: EventFormModalProps) {
  const { create, update } = useEventMutations();
  const [title, setTitle] = useState('');
  const [type, setType] = useState<EventType>('estudo');
  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<{ title?: string; date?: string }>({});

  useEffect(() => {
    if (!open) return;
    setTitle(event?.title ?? '');
    setType(event?.type ?? 'estudo');
    setDate(event?.date ?? defaultDate);
    setTime(event?.time ?? '');
    setSubjectId(event?.subjectId ?? '');
    setNotes(event?.notes ?? '');
    setErrors({});
  }, [open, event, defaultDate]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const errs: typeof errors = {};
    if (!title.trim()) errs.title = 'Dê um título (ex.: “Revisar Direito Civil”).';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) errs.date = 'Escolha a data.';
    setErrors(errs);
    if (Object.keys(errs).length) return;

    const data = {
      title: title.trim(),
      type,
      date,
      time: time || null,
      subjectId: subjectId || null,
      notes: notes.trim(),
    };
    try {
      if (event) {
        // Mudou a data: os lembretes recomeçam (7, 3, 1 dia e no dia)
        await update.mutateAsync({ id: event.id, data: event.date !== date ? { ...data, reminders: {} } : data });
        toast.success('Evento atualizado.');
      } else {
        await create.mutateAsync({ ...data, done: false });
        toast.success('Evento criado.');
      }
      onClose();
    } catch {
      /* toast já exibido */
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={event ? 'Editar evento' : 'Novo evento'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="event-form" loading={create.isPending || update.isPending}>
            {event ? 'Salvar' : 'Criar evento'}
          </Button>
        </>
      }
    >
      <form id="event-form" onSubmit={submit} className="space-y-4" noValidate>
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-text">Tipo</legend>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
            {EVENT_TYPES.map((t) => {
              const meta = EVENT_META[t];
              const Icon = meta.icon;
              return (
                <button
                  key={t}
                  type="button"
                  aria-pressed={type === t}
                  onClick={() => setType(t)}
                  className={cn(
                    'flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-sm font-medium transition-colors',
                    type === t ? 'border-primary bg-primary-soft text-primary-text' : 'border-border text-text-muted hover:bg-primary-soft hover:text-text',
                  )}
                >
                  <Icon className="size-4" style={{ color: type === t ? undefined : meta.color }} aria-hidden />
                  {meta.label}
                </button>
              );
            })}
          </div>
        </fieldset>

        <Field label="Título" error={errors.title}>
          {(id, d) => (
            <Input
              id={id}
              autoFocus
              value={title}
              aria-describedby={d}
              aria-invalid={!!errors.title}
              placeholder={type === 'prova' ? 'Ex.: 1ª fase da OAB' : 'Ex.: Revisar responsabilidade civil'}
              onChange={(e) => setTitle(e.target.value)}
            />
          )}
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Data" error={errors.date}>
            {(id, d) => <Input id={id} type="date" value={date} aria-describedby={d} onChange={(e) => setDate(e.target.value)} />}
          </Field>
          <Field label="Horário (opcional)">
            {(id) => <Input id={id} type="time" value={time} onChange={(e) => setTime(e.target.value)} />}
          </Field>
        </div>

        <Field label="Matéria (opcional)">
          {(id) => <SubjectSelect id={id} value={subjectId} emptyLabel="Nenhuma" onChange={setSubjectId} />}
        </Field>

        <Field label="Observações (opcional)">
          {(id) => <Textarea id={id} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />}
        </Field>
      </form>
    </Modal>
  );
}
