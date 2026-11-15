import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Field, Select, Textarea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { SubjectSelect } from '@/components/ui/SubjectSelect';
import { useErrorMutations } from '@/hooks/useQuestions';
import { useTopics } from '@/hooks/useStudyData';
import { ERROR_CATEGORIES, type ErrorCategory, type ErrorEntry } from '@/types/models';

interface ErrorFormModalProps {
  open: boolean;
  onClose: () => void;
  /** sem erro = novo registro manual (ex.: erro de um simulado em papel) */
  entry?: ErrorEntry;
}

/** Criar um erro à mão ou editar categoria/anotação de um erro existente. */
export function ErrorFormModal({ open, onClose, entry }: ErrorFormModalProps) {
  const { create, update } = useErrorMutations();
  const [subjectId, setSubjectId] = useState('');
  const [topicId, setTopicId] = useState('');
  const [category, setCategory] = useState<ErrorCategory | ''>('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string>();
  const topics = useTopics(subjectId || undefined);

  useEffect(() => {
    if (!open) return;
    setSubjectId(entry?.subjectId ?? '');
    setTopicId(entry?.topicId ?? '');
    setCategory(entry?.category ?? '');
    setNote(entry?.note ?? '');
    setError(undefined);
  }, [open, entry]);

  const save = async () => {
    if (!subjectId) return setError('Escolha a matéria.');
    if (!category) return setError('Escolha a categoria do erro.');
    try {
      if (entry) {
        await update.mutateAsync({ id: entry.id, data: { category, note: note.trim() } });
        toast.success('Registro atualizado.');
      } else {
        await create.mutateAsync({ questionId: null, subjectId, topicId: topicId || null, category, note: note.trim() });
        toast.success('Erro registrado.');
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
      title={entry ? 'Editar registro' : 'Novo registro no caderno'}
      description={entry ? undefined : 'Para erros fora do banco de questões (simulados, provas antigas, aulas…).'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={save} loading={create.isPending || update.isPending}>
            Salvar
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {!entry && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Matéria">
              {(id) => (
                <SubjectSelect
                  id={id}
                  value={subjectId}
                  emptyLabel="Escolha…"
                  onChange={(v) => {
                    setSubjectId(v);
                    setTopicId('');
                  }}
                />
              )}
            </Field>
            <Field label="Assunto (opcional)">
              {(id) => (
                <Select id={id} value={topicId} onChange={(e) => setTopicId(e.target.value)} disabled={!topics.data?.length}>
                  <option value="">Sem assunto</option>
                  {topics.data?.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>
        )}
        <Field label="Por que errou?">
          {(id) => (
            <Select id={id} value={category} onChange={(e) => setCategory(e.target.value as ErrorCategory)}>
              <option value="">Escolha a categoria…</option>
              {ERROR_CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Anotação" hint="O que você precisa lembrar? Ex.: “prazo é decadencial, não prescricional”.">
          {(id, d) => <Textarea id={id} rows={4} value={note} aria-describedby={d} onChange={(e) => setNote(e.target.value)} />}
        </Field>
        {error && <p className="text-sm text-error">{error}</p>}
      </div>
    </Modal>
  );
}
