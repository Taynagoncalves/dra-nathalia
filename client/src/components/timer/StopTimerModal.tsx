import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { useStudyTimer } from '@/contexts/StudyTimerContext';
import { formatClock, formatMinutes } from '@/lib/dates';
import { friendlyError } from '@/lib/firebaseErrors';

const LONG_SESSION_MIN = 240;

/** Encerrar o timer: confere/ajusta os minutos e salva (ou descarta). */
export function StopTimerModal({ open, onClose, subjectName }: { open: boolean; onClose: () => void; subjectName?: string }) {
  const timer = useStudyTimer();
  const [minutes, setMinutes] = useState<number | ''>(0);
  const [saving, setSaving] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const elapsed = timer.elapsedMs();

  useEffect(() => {
    if (open) {
      setMinutes(Math.round(timer.elapsedMs() / 60000));
      setConfirmDiscard(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const valid = typeof minutes === 'number' && minutes >= 1 && minutes <= 960;

  const keepStudying = () => {
    timer.resume();
    onClose();
  };

  const save = async () => {
    if (!valid) return;
    setSaving(true);
    try {
      const { streak } = await timer.save(minutes);
      toast.success(
        `${formatMinutes(minutes)} de ${subjectName ?? 'estudo'} salvos. Sequência: ${streak} ${streak === 1 ? 'dia' : 'dias'}.`,
      );
      onClose();
    } catch (err) {
      toast.error(friendlyError(err, 'Não foi possível salvar a sessão.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={keepStudying}
      title="Encerrar sessão"
      description={subjectName ? `${subjectName} · ${timer.state?.activity ?? ''}` : undefined}
      size="sm"
      footer={
        confirmDiscard ? (
          <>
            <Button variant="secondary" onClick={() => setConfirmDiscard(false)}>
              Voltar
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                timer.discard();
                onClose();
                toast('Sessão descartada.');
              }}
            >
              Sim, descartar
            </Button>
          </>
        ) : (
          <>
            <Button variant="ghost" className="mr-auto text-error" onClick={() => setConfirmDiscard(true)}>
              Descartar
            </Button>
            <Button variant="secondary" onClick={keepStudying}>
              Continuar
            </Button>
            <Button onClick={save} loading={saving} disabled={!valid}>
              Salvar
            </Button>
          </>
        )
      }
    >
      {confirmDiscard ? (
        <p className="text-sm text-text-muted">O tempo desta sessão não será registrado. Tem certeza?</p>
      ) : (
        <div className="space-y-4">
          <p className="text-center font-mono text-4xl font-bold tabular-nums text-text">{formatClock(elapsed)}</p>
          <Field label="Minutos a registrar" hint="Ajuste se esqueceu o timer ligado ou pausado.">
            {(id, d) => (
              <Input
                id={id}
                type="number"
                inputMode="numeric"
                min={1}
                max={960}
                value={minutes}
                aria-describedby={d}
                onChange={(e) => setMinutes(e.target.value === '' ? '' : Number(e.target.value))}
              />
            )}
          </Field>
          {typeof minutes === 'number' && minutes < 1 && (
            <Alert variant="info">Sessões com menos de 1 minuto não são salvas.</Alert>
          )}
          {typeof minutes === 'number' && minutes > LONG_SESSION_MIN && (
            <Alert variant="warning" title="Sessão longa">
              Mais de {formatMinutes(LONG_SESSION_MIN)} seguidas. Confira se o tempo está certo.
            </Alert>
          )}
        </div>
      )}
    </Modal>
  );
}
