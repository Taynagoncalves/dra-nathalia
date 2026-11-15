import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { useAuth } from '@/contexts/AuthContext';
import { useSaveGoals } from '@/hooks/useStats';
import { updateUserSettings } from '@/services/firebase/users';
import type { Goal } from '@/types/models';

interface GoalsModalProps {
  open: boolean;
  onClose: () => void;
  goals: Goal[];
}

type Values = { dayMin: string; dayQ: string; weekMin: string; weekQ: string };

/** Metas: minutos e questões por dia e por semana (0 ou vazio = sem meta). */
export function GoalsModal({ open, onClose, goals }: GoalsModalProps) {
  const { user, profile, refreshProfile } = useAuth();
  const save = useSaveGoals();
  const target = (period: Goal['period'], metric: Goal['metric']) =>
    goals.find((g) => g.period === period && g.metric === metric)?.target ?? 0;
  const [v, setV] = useState<Values>({ dayMin: '', dayQ: '', weekMin: '', weekQ: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const str = (n: number) => (n ? String(n) : '');
    setV({
      dayMin: str(profile?.settings?.dailyGoalMinutes ?? 0),
      dayQ: str(target('diaria', 'questoes')),
      weekMin: str(target('semanal', 'minutos')),
      weekQ: str(target('semanal', 'questoes')),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const num = (s: string) => Math.max(0, Math.min(10000, Math.round(Number(s) || 0)));

  const submit = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await Promise.all([
        // a meta diária de minutos fica no perfil (aparece também na página Perfil)
        updateUserSettings(user.uid, { dailyGoalMinutes: num(v.dayMin) }),
        save.mutateAsync([
          { period: 'diaria', metric: 'questoes', target: num(v.dayQ) },
          { period: 'semanal', metric: 'minutos', target: num(v.weekMin) },
          { period: 'semanal', metric: 'questoes', target: num(v.weekQ) },
        ]),
      ]);
      await refreshProfile();
      toast.success('Metas atualizadas.');
      onClose();
    } catch {
      /* toast já exibido */
    } finally {
      setSaving(false);
    }
  };

  const fields: { key: keyof Values; label: string; suffix: string }[] = [
    { key: 'dayMin', label: 'Por dia — tempo', suffix: 'min' },
    { key: 'dayQ', label: 'Por dia — questões', suffix: 'questões' },
    { key: 'weekMin', label: 'Por semana — tempo', suffix: 'min' },
    { key: 'weekQ', label: 'Por semana — questões', suffix: 'questões' },
  ];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Metas de estudo"
      description="Deixe em branco para não usar uma meta. A semana vai de domingo a sábado."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={submit} loading={saving}>
            Salvar metas
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {fields.map((f) => (
          <Field key={f.key} label={f.label}>
            {(id) => (
              <div className="flex items-center gap-2">
                <Input id={id} type="number" inputMode="numeric" min={0} value={v[f.key]} onChange={(e) => setV((s) => ({ ...s, [f.key]: e.target.value }))} />
                <span className="shrink-0 text-sm text-text-muted">{f.suffix}</span>
              </div>
            )}
          </Field>
        ))}
      </div>
    </Modal>
  );
}
