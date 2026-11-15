import { useQueryClient } from '@tanstack/react-query';
import { doc, writeBatch } from 'firebase/firestore';
import { Wand2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { useUpcomingEvents } from '@/hooks/useEvents';
import { useAttempts, useErrors } from '@/hooks/useQuestions';
import { useAllSubjects } from '@/hooks/useStudyData';
import { useUid } from '@/hooks/useUid';
import { cn } from '@/lib/cn';
import { addDaysToKey, dateKey } from '@/lib/dates';
import { friendlyError } from '@/lib/firebaseErrors';
import { accuracyBy } from '@/lib/stats';
import { buildStudyPlan, SESSION_MINUTES, weaknessOf } from '@/lib/studyPlan';
import { getDb } from '@/services/firebase/app';
import { chunk, userCol } from '@/services/firebase/db';

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const fmt = (key: string) => `${key.slice(8, 10)}/${key.slice(5, 7)}`;

const weaknessLabel = (w: number) => (w >= 0.6 ? { text: 'Precisa de reforço', variant: 'error' as const } : w >= 0.35 ? { text: 'Médio', variant: 'warning' as const } : { text: 'Bom domínio', variant: 'success' as const });

/**
 * Calendário inteligente: cria o cronograma até a prova, com mais sessões
 * para as matérias mais fracas e revisão geral nos últimos dias.
 */
export function StudyPlanModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const uid = useUid();
  const qc = useQueryClient();
  const today = dateKey();
  const subjects = useAllSubjects();
  const attempts = useAttempts();
  const errors = useErrors();
  const upcoming = useUpcomingEvents(30);
  const exams = (upcoming.data ?? []).filter((e) => e.type === 'prova' && e.date > today);

  const [examId, setExamId] = useState('');
  const [customTitle, setCustomTitle] = useState('');
  const [customDate, setCustomDate] = useState(addDaysToKey(today, 21));
  const [selected, setSelected] = useState<string[]>([]);
  const [minutes, setMinutes] = useState(100);
  const [weekdays, setWeekdays] = useState([1, 2, 3, 4, 5, 6]);
  const [saving, setSaving] = useState(false);

  // pré-seleciona a prova mais próxima e a matéria dela
  useEffect(() => {
    if (!open || examId) return;
    const first = exams[0];
    if (first) {
      setExamId(first.id);
      if (first.subjectId) setSelected([first.subjectId]);
    } else setExamId('outra');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, exams.length]);

  const weakness = useMemo(() => {
    const acc = accuracyBy(attempts.data ?? [], (a) => a.subjectId);
    const pending = new Map<string, number>();
    for (const e of errors.data ?? []) if (!e.resolved) pending.set(e.subjectId, (pending.get(e.subjectId) ?? 0) + 1);
    return new Map(
      (subjects.data ?? []).map((s) => {
        const a = acc.get(s.id);
        return [s.id, weaknessOf(a && a.total >= 3 ? a.pct : null, pending.get(s.id) ?? 0)];
      }),
    );
  }, [attempts.data, errors.data, subjects.data]);

  const exam = exams.find((e) => e.id === examId);
  const examTitle = exam?.title ?? (customTitle.trim() || 'Prova');
  const examDate = exam?.date ?? customDate;

  const plan = useMemo(
    () =>
      buildStudyPlan({
        today,
        examDate,
        examTitle,
        minutesPerDay: minutes,
        weekdays,
        subjects: (subjects.data ?? []).filter((s) => selected.includes(s.id)).map((s) => ({ id: s.id, name: s.name, weakness: weakness.get(s.id) ?? 0.5 })),
      }),
    [today, examDate, examTitle, minutes, weekdays, subjects.data, selected, weakness],
  );

  const perSubject = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of plan) if (e.subjectId) m.set(e.subjectId, (m.get(e.subjectId) ?? 0) + 1);
    return m;
  }, [plan]);

  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const create = async () => {
    setSaving(true);
    try {
      const db = getDb();
      for (const part of chunk(plan, 400)) {
        const batch = writeBatch(db);
        for (const e of part) {
          batch.set(doc(userCol(uid, 'events')), {
            ...e,
            time: null,
            done: false,
            // cronograma gera muitos eventos: só avisa no próprio dia (sem 7/3/1 dias antes)
            reminders: { '7': true, '3': true, '1': true },
          });
        }
        await batch.commit();
      }
      qc.invalidateQueries({ queryKey: ['events', uid] });
      toast.success(`${plan.length} eventos criados no calendário.`);
      onClose();
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Cronograma até a prova"
      description="O calendário distribui as matérias até a data da prova, com mais tempo para as que você mais erra."
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={create} disabled={!plan.length} loading={saving}>
            <Wand2 className="size-4" /> Criar {plan.length} eventos
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Prova">
            {(id) => (
              <Select id={id} value={examId} onChange={(e) => setExamId(e.target.value)}>
                {exams.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.title} — {fmt(e.date)}
                  </option>
                ))}
                <option value="outra">Outra data…</option>
              </Select>
            )}
          </Field>
          {examId === 'outra' && (
            <div className="grid grid-cols-2 gap-2">
              <Field label="Nome">{(id) => <Input id={id} value={customTitle} onChange={(e) => setCustomTitle(e.target.value)} placeholder="Ex.: OAB 1ª fase" maxLength={80} />}</Field>
              <Field label="Data">{(id) => <Input id={id} type="date" value={customDate} min={addDaysToKey(today, 2)} onChange={(e) => setCustomDate(e.target.value)} />}</Field>
            </div>
          )}
        </div>

        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-text">Matérias</legend>
          {!subjects.data?.length ? (
            <p className="text-sm text-text-muted">Crie matérias em Projetos primeiro.</p>
          ) : (
            <ul className="grid max-h-56 gap-1.5 overflow-y-auto sm:grid-cols-2">
              {subjects.data.map((s) => {
                const w = weaknessLabel(weakness.get(s.id) ?? 0.5);
                const on = selected.includes(s.id);
                return (
                  <li key={s.id}>
                    <label className={cn('flex cursor-pointer items-center gap-2 rounded-lg border p-2 text-sm', on ? 'border-primary bg-primary-soft' : 'border-border')}>
                      <input type="checkbox" checked={on} onChange={() => setSelected((l) => toggle(l, s.id))} className="accent-(--primary)" />
                      <span className="size-2.5 shrink-0 rounded-full" style={{ background: s.color }} aria-hidden />
                      <span className="flex-1 truncate text-text">{s.name}</span>
                      <Badge variant={w.variant}>{on && perSubject.get(s.id) ? `${perSubject.get(s.id)} sessões` : w.text}</Badge>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </fieldset>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Tempo por dia">
            {(id) => (
              <Select id={id} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))}>
                {[50, 100, 150, 200].map((m) => (
                  <option key={m} value={m}>
                    {m / SESSION_MINUTES} sessão(ões) de {SESSION_MINUTES} min
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <fieldset>
            <legend className="mb-1.5 text-sm font-medium text-text">Dias de estudo</legend>
            <div className="flex flex-wrap gap-1">
              {WEEKDAYS.map((d, i) => (
                <button
                  key={d}
                  type="button"
                  aria-pressed={weekdays.includes(i)}
                  onClick={() => setWeekdays((l) => toggle(l, i))}
                  className={cn('h-8 rounded-lg border px-2 text-xs font-medium', weekdays.includes(i) ? 'border-primary bg-primary text-on-primary' : 'border-border text-text hover:bg-primary-soft')}
                >
                  {d}
                </button>
              ))}
            </div>
          </fieldset>
        </div>

        {selected.length > 0 && !plan.length && <Alert variant="warning">Não há dias disponíveis antes da prova com os dias da semana escolhidos.</Alert>}
        {plan.length > 0 && (
          <div className="rounded-lg border border-border p-3">
            <p className="mb-2 text-sm font-medium text-text">Prévia (primeiros dias)</p>
            <ul className="space-y-1 text-sm">
              {plan.slice(0, 8).map((e, i) => (
                <li key={i} className="flex gap-2">
                  <span className="w-12 shrink-0 text-text-muted tabular-nums">{fmt(e.date)}</span>
                  <span className={cn(e.type === 'revisao' ? 'text-primary-text' : 'text-text')}>{e.title}</span>
                </li>
              ))}
            </ul>
            {plan.length > 8 && <p className="mt-1 text-xs text-text-muted">…e mais {plan.length - 8}. Os 2 últimos dias são de revisão geral.</p>}
            <p className="mt-2 text-xs text-text-muted">Para não lotar o celular, os eventos do cronograma só notificam no próprio dia.</p>
          </div>
        )}
      </div>
    </Modal>
  );
}
