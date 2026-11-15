import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Field, Textarea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { useErrorMutations } from '@/hooks/useQuestions';
import { cn } from '@/lib/cn';
import { ERROR_CATEGORIES, type ErrorCategory } from '@/types/models';

export interface ErrorContext {
  questionId: string | null;
  subjectId: string;
  topicId: string | null;
}

interface RegisterErrorModalProps {
  context: ErrorContext | null;
  onClose: () => void;
  /** Etapa 2: categoria sugerida pela IA */
  suggested?: ErrorCategory;
  onSaved?: () => void;
}

/** "Registrar no caderno de erros": por que errei + anotação. */
export function RegisterErrorModal({ context, onClose, suggested, onSaved }: RegisterErrorModalProps) {
  const { create } = useErrorMutations();
  const [category, setCategory] = useState<ErrorCategory | null>(suggested ?? null);
  const [note, setNote] = useState('');

  useEffect(() => {
    if (context) {
      setCategory(suggested ?? null);
      setNote('');
    }
  }, [context, suggested]);

  const save = async () => {
    if (!context || !category) return;
    try {
      await create.mutateAsync({ ...context, category, note: note.trim() });
      toast.success('Registrado no caderno de erros.');
      onSaved?.();
      onClose();
    } catch {
      /* toast já exibido */
    }
  };

  return (
    <Modal
      open={!!context}
      onClose={onClose}
      title="Registrar no caderno de erros"
      description="Entender por que errou é o que evita errar de novo."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Agora não
          </Button>
          <Button onClick={save} disabled={!category} loading={create.isPending}>
            Registrar
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-text">Por que você errou?</legend>
          <div role="radiogroup" className="grid gap-1.5 sm:grid-cols-2">
            {ERROR_CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={category === c}
                onClick={() => setCategory(c)}
                className={cn(
                  'rounded-lg border px-3 py-2 text-left text-sm transition-colors',
                  category === c ? 'border-primary bg-primary-soft font-medium text-primary-text' : 'border-border text-text hover:bg-primary-soft',
                )}
              >
                {c}
              </button>
            ))}
          </div>
        </fieldset>
        <Field label="Anotação (opcional)" hint="O que você precisa lembrar da próxima vez?">
          {(id, d) => <Textarea id={id} rows={3} value={note} aria-describedby={d} onChange={(e) => setNote(e.target.value)} />}
        </Field>
      </div>
    </Modal>
  );
}
