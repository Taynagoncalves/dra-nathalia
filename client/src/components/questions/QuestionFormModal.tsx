import { Plus, Trash2 } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { normalizeUrl } from '@/components/materials/LinkFormModal';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { SubjectSelect } from '@/components/ui/SubjectSelect';
import { useQuestionMutations } from '@/hooks/useQuestions';
import { useTopics } from '@/hooks/useStudyData';
import { cn } from '@/lib/cn';
import { DIFFICULTY_LABELS, LETTERS, QUESTION_TYPE_LABELS } from '@/lib/questions';
import type { QuestionInput } from '@/services/firebase/questions';
import type { Difficulty, Question, QuestionSource, QuestionType } from '@/types/models';

const SOURCE_LABELS: Record<Exclude<QuestionSource, 'ia'>, string> = {
  propria: 'Criada por mim',
  material: 'Tirada de um material meu',
  externa: 'Plataforma externa (só o link)',
};

interface QuestionFormModalProps {
  open: boolean;
  onClose: () => void;
  /** sem questão = criar */
  question?: Question;
  defaultSubjectId?: string;
}

interface FormState {
  subjectId: string;
  topicId: string;
  type: QuestionType;
  statement: string;
  options: string[];
  correct: string;
  modelAnswer: string;
  explanation: string;
  difficulty: Difficulty;
  source: Exclude<QuestionSource, 'ia'>;
  externalUrl: string;
}

const fromQuestion = (q: Question | undefined, subjectId = ''): FormState => ({
  subjectId: q?.subjectId ?? subjectId,
  topicId: q?.topicId ?? '',
  type: q?.type ?? 'multipla',
  statement: q?.statement ?? '',
  options: q?.type === 'multipla' && q.options.length ? q.options : ['', '', '', ''],
  correct: q && q.type !== 'discursiva' ? q.correctAnswer : '',
  modelAnswer: q?.type === 'discursiva' ? q.correctAnswer : '',
  explanation: q?.explanation ?? '',
  difficulty: q?.difficulty ?? 'medio',
  source: q?.source && q.source !== 'ia' ? q.source : 'propria',
  externalUrl: q?.externalUrl ?? '',
});

export function QuestionFormModal({ open, onClose, question, defaultSubjectId }: QuestionFormModalProps) {
  const { create, update } = useQuestionMutations();
  const [f, setF] = useState<FormState>(() => fromQuestion(question, defaultSubjectId));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const topics = useTopics(f.subjectId || undefined);
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setF((s) => ({ ...s, [key]: value }));

  useEffect(() => {
    if (open) {
      setF(fromQuestion(question, defaultSubjectId));
      setErrors({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!f.subjectId) errs.subject = 'Escolha a matéria.';
    if (f.statement.trim().length < 10) errs.statement = 'Escreva o enunciado (mínimo de 10 caracteres).';
    const options = f.options.map((o) => o.trim());
    if (f.type === 'multipla') {
      if (options.length < 2 || options.some((o) => !o)) errs.options = 'Preencha todas as alternativas (mínimo 2).';
      else if (f.correct === '' || Number(f.correct) >= options.length) errs.correct = 'Marque a alternativa correta.';
    }
    if (f.type === 'certo_errado' && f.correct !== 'certo' && f.correct !== 'errado') errs.correct = 'Marque o gabarito.';
    if (f.type === 'discursiva' && f.modelAnswer.trim().length < 5) errs.model = 'Escreva a resposta esperada (gabarito).';
    const url = f.externalUrl.trim() ? normalizeUrl(f.externalUrl) : '';
    if (url === null) errs.url = 'Link inválido.';
    setErrors(errs);
    if (Object.keys(errs).length) return;

    const data: QuestionInput = {
      subjectId: f.subjectId,
      topicId: f.topicId || null,
      type: f.type,
      statement: f.statement.trim(),
      options: f.type === 'multipla' ? options : [],
      correctAnswer: f.type === 'discursiva' ? f.modelAnswer.trim() : f.correct,
      explanation: f.explanation.trim(),
      difficulty: f.difficulty,
      source: f.source,
      externalUrl: url ?? '',
    };
    try {
      if (question) {
        await update.mutateAsync({ id: question.id, data });
        toast.success('Questão atualizada.');
      } else {
        await create.mutateAsync(data);
        toast.success('Questão criada.');
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
      title={question ? 'Editar questão' : 'Nova questão'}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="question-form" loading={create.isPending || update.isPending}>
            {question ? 'Salvar' : 'Criar questão'}
          </Button>
        </>
      }
    >
      <form id="question-form" onSubmit={submit} className="space-y-5" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Matéria" error={errors.subject}>
            {(id) => (
              <SubjectSelect
                id={id}
                value={f.subjectId}
                emptyLabel="Escolha…"
                aria-invalid={!!errors.subject}
                onChange={(v) => setF((s) => ({ ...s, subjectId: v, topicId: '' }))}
              />
            )}
          </Field>
          <Field label="Assunto (opcional)">
            {(id) => (
              <Select id={id} value={f.topicId} onChange={(e) => set('topicId', e.target.value)} disabled={!topics.data?.length}>
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

        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-text">Tipo</legend>
          <div className="inline-flex flex-wrap rounded-xl border border-border bg-surface p-1">
            {(Object.keys(QUESTION_TYPE_LABELS) as QuestionType[]).map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={f.type === t}
                onClick={() => setF((s) => ({ ...s, type: t, correct: '' }))}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                  f.type === t ? 'bg-primary text-on-primary' : 'text-text-muted hover:bg-primary-soft hover:text-text',
                )}
              >
                {QUESTION_TYPE_LABELS[t]}
              </button>
            ))}
          </div>
        </fieldset>

        <Field label={f.type === 'certo_errado' ? 'Afirmação' : 'Enunciado'} error={errors.statement}>
          {(id, d) => (
            <Textarea
              id={id}
              rows={4}
              value={f.statement}
              aria-describedby={d}
              aria-invalid={!!errors.statement}
              onChange={(e) => set('statement', e.target.value)}
            />
          )}
        </Field>

        {f.type === 'multipla' && (
          <fieldset className="space-y-2">
            <legend className="mb-1.5 text-sm font-medium text-text">Alternativas · marque a correta</legend>
            {f.options.map((opt, i) => (
              <div key={i} className="flex items-center gap-2">
                <label className="flex cursor-pointer items-center" title="Marcar como correta">
                  <input
                    type="radio"
                    name="correct"
                    checked={f.correct === String(i)}
                    onChange={() => set('correct', String(i))}
                    className="peer sr-only"
                  />
                  <span
                    className={cn(
                      'grid size-8 place-items-center rounded-full border text-sm font-semibold transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-ring',
                      f.correct === String(i) ? 'border-success bg-success/15 text-success' : 'border-border text-text-muted hover:bg-primary-soft',
                    )}
                  >
                    {LETTERS[i]}
                  </span>
                  <span className="sr-only">Alternativa {LETTERS[i]} é a correta</span>
                </label>
                <Input
                  value={opt}
                  aria-label={`Alternativa ${LETTERS[i]}`}
                  onChange={(e) => set('options', f.options.map((o, j) => (j === i ? e.target.value : o)))}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 shrink-0"
                  disabled={f.options.length <= 2}
                  aria-label={`Remover alternativa ${LETTERS[i]}`}
                  onClick={() => {
                    const options = f.options.filter((_, j) => j !== i);
                    const c = Number(f.correct);
                    setF((s) => ({ ...s, options, correct: s.correct === '' || c === i ? '' : String(c > i ? c - 1 : c) }));
                  }}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
            {f.options.length < 5 && (
              <Button variant="ghost" size="sm" onClick={() => set('options', [...f.options, ''])}>
                <Plus className="size-4" /> Alternativa {LETTERS[f.options.length]}
              </Button>
            )}
            {(errors.options || errors.correct) && <p className="text-xs text-error">{errors.options ?? errors.correct}</p>}
          </fieldset>
        )}

        {f.type === 'certo_errado' && (
          <fieldset>
            <legend className="mb-1.5 text-sm font-medium text-text">Gabarito</legend>
            <div className="flex gap-2">
              {(['certo', 'errado'] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={f.correct === v}
                  onClick={() => set('correct', v)}
                  className={cn(
                    'rounded-lg border px-4 py-2 text-sm font-medium transition-colors',
                    f.correct === v
                      ? v === 'certo'
                        ? 'border-success bg-success/15 text-success'
                        : 'border-error bg-error/10 text-error'
                      : 'border-border text-text-muted hover:bg-primary-soft',
                  )}
                >
                  {v === 'certo' ? 'Certo' : 'Errado'}
                </button>
              ))}
            </div>
            {errors.correct && <p className="mt-1 text-xs text-error">{errors.correct}</p>}
          </fieldset>
        )}

        {f.type === 'discursiva' && (
          <Field label="Resposta esperada (gabarito)" error={errors.model} hint="Você vai comparar sua resposta com este texto.">
            {(id, d) => (
              <Textarea id={id} rows={4} value={f.modelAnswer} aria-describedby={d} onChange={(e) => set('modelAnswer', e.target.value)} />
            )}
          </Field>
        )}

        <Field label="Comentário / explicação (opcional)" hint="Por que a resposta é essa? Fundamento, artigo, súmula…">
          {(id, d) => (
            <Textarea id={id} rows={3} value={f.explanation} aria-describedby={d} onChange={(e) => set('explanation', e.target.value)} />
          )}
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Dificuldade">
            {(id) => (
              <Select id={id} value={f.difficulty} onChange={(e) => set('difficulty', e.target.value as Difficulty)}>
                {(Object.keys(DIFFICULTY_LABELS) as Difficulty[]).map((d) => (
                  <option key={d} value={d}>
                    {DIFFICULTY_LABELS[d]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Origem">
            {(id) => (
              <Select id={id} value={f.source} onChange={(e) => set('source', e.target.value as FormState['source'])}>
                {Object.entries(SOURCE_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>

        <Field
          label="Link externo (opcional)"
          error={errors.url}
          hint="QConcursos, Gran etc. Guardamos só o link — não copie o conteúdo dessas plataformas."
        >
          {(id, d) => (
            <Input
              id={id}
              inputMode="url"
              placeholder="https://…"
              value={f.externalUrl}
              aria-describedby={d}
              aria-invalid={!!errors.url}
              onChange={(e) => set('externalUrl', e.target.value)}
            />
          )}
        </Field>
      </form>
    </Modal>
  );
}
