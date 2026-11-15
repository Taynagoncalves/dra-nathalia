import { CheckCircle2, ListChecks, NotebookPen, Play, Timer } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { SubjectSelect } from '@/components/ui/SubjectSelect';
import { useStudyTimer } from '@/contexts/StudyTimerContext';
import { newSession } from '@/lib/solveSession';
import type { Question } from '@/types/models';

/** Quantas questões cabem no tempo (≈ 1,5 min por questão). */
const questionsFor = (minutes: number) => Math.max(3, Math.floor(minutes / 1.5));

interface QuickStudyModalProps {
  minutes: number | null;
  onClose: () => void;
  defaultSubjectId?: string;
  suggestedQuestions: (subjectId: string, max: number) => Question[];
  pendingErrorCount: (subjectId: string) => number;
}

/** Estudo rápido (5/10/15 min): liga o timer com duração e sugere questões ou erros pendentes. */
export function QuickStudyModal({ minutes, onClose, defaultSubjectId, suggestedQuestions, pendingErrorCount }: QuickStudyModalProps) {
  const navigate = useNavigate();
  const timer = useStudyTimer();
  const [subjectId, setSubjectId] = useState('');
  const [started, setStarted] = useState(false);

  useEffect(() => {
    if (minutes) {
      setSubjectId(defaultSubjectId ?? '');
      setStarted(false);
    }
  }, [minutes, defaultSubjectId]);

  if (!minutes) return null;
  const qs = subjectId ? suggestedQuestions(subjectId, questionsFor(minutes)) : [];
  const errs = subjectId ? pendingErrorCount(subjectId) : 0;
  const busy = !!timer.state && !started;

  const start = () => {
    timer.start(subjectId, 'Estudo rápido', minutes);
    setStarted(true);
  };

  return (
    <Modal open onClose={onClose} title={`Estudo rápido · ${minutes} min`} description="O timer conta o tempo e avisa quando acabar." size="md">
      {!started ? (
        <div className="space-y-4">
          <Field label="Matéria" hint={defaultSubjectId ? 'Já escolhemos a matéria que mais precisa de atenção — troque se quiser.' : undefined}>
            {(id, d) => <SubjectSelect id={id} value={subjectId} emptyLabel="Escolha…" onChange={setSubjectId} aria-label={d} />}
          </Field>
          {busy && <p className="text-sm text-warning">Há um timer ativo. Encerre-o antes de começar outro.</p>}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button onClick={start} disabled={!subjectId || busy}>
              <Timer className="size-4" /> Começar {minutes} min
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="flex items-center gap-2 text-sm text-success">
            <CheckCircle2 className="size-4" /> Timer ligado. O que fazer nesses {minutes} minutos:
          </p>
          <div className="grid gap-2">
            {qs.length > 0 && (
              <Button
                className="justify-start"
                onClick={() => {
                  newSession(qs.map((q) => q.id), `Estudo rápido · ${minutes} min`, '/');
                  onClose();
                  navigate('/questoes/resolver');
                }}
              >
                <ListChecks className="size-4" /> Resolver {qs.length} {qs.length === 1 ? 'questão' : 'questões'} (erradas primeiro)
              </Button>
            )}
            {errs > 0 && (
              <Button variant="secondary" className="justify-start" onClick={() => (onClose(), navigate(`/erros?materia=${subjectId}`))}>
                <NotebookPen className="size-4" /> Revisar {errs} {errs === 1 ? 'erro pendente' : 'erros pendentes'}
              </Button>
            )}
            <Button variant="secondary" className="justify-start" onClick={() => (onClose(), navigate(`/materias/${subjectId}`))}>
              <Play className="size-4" /> Ler os materiais da matéria
            </Button>
          </div>
          {!qs.length && !errs && <p className="text-xs text-text-muted">Esta matéria ainda não tem questões nem erros pendentes — aproveite para revisar os materiais.</p>}
        </div>
      )}
    </Modal>
  );
}
