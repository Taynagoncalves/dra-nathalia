import { CheckCircle2, ChevronDown, Clock, Flag, NotebookPen, RotateCcw, Save, Sparkles, Trophy, XCircle } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { BarList } from '@/components/charts/BarList';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Card, CardTitle } from '@/components/ui/Card';
import { Select } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { useUid } from '@/hooks/useUid';
import { cn } from '@/lib/cn';
import { formatClock } from '@/lib/dates';
import { friendlyError } from '@/lib/firebaseErrors';
import { LETTERS } from '@/lib/questions';
import { createQuiz } from '@/services/ai';
import { createError } from '@/services/firebase/errors';
import { createQuestion } from '@/services/firebase/questions';
import { updateDoc } from 'firebase/firestore';
import { userDoc } from '@/services/firebase/db';
import { ERROR_CATEGORIES, type ErrorCategory, type Quiz, type QuizItem } from '@/types/models';
import { ItemExplanation, SourceQuote } from './QuizPlayer';

export interface ResultData {
  score: number;
  total: number;
  correct: number;
  timeSpentSec: number;
  feedback: string;
  weakTopics: string[];
  byTopic: { topic: string; correct: number; total: number }[];
  contested: number[];
  answers?: { index: number; answer: string; correct: boolean; contested: boolean }[];
  suggestions?: { index: number; category: ErrorCategory }[];
}

const answerText = (item: QuizItem, a: string) => {
  if (!a) return '— (sem resposta)';
  if (item.type === 'multipla' || item.type === 'lacunas') return `${LETTERS[Number(a)]}) ${item.options[Number(a)] ?? ''}`;
  if (item.type === 'certo_errado') return a === 'certo' ? 'Certo' : 'Errado';
  return a;
};

export function QuizResults({ quiz, result }: { quiz: Quiz; result: ResultData }) {
  const navigate = useNavigate();
  const uid = useUid();
  const [savingBank, setSavingBank] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [errorsOpen, setErrorsOpen] = useState(false);
  const [open, setOpen] = useState<number | null>(null);

  const answers = new Map((result.answers ?? []).map((a) => [a.index, a]));
  const wrong = (result.answers ?? []).filter((a) => !a.correct && !a.contested).map((a) => a.index);
  const savedToBank = (quiz.questionIds ?? []).length > 0;

  const regenerate = async () => {
    setRegenerating(true);
    try {
      const { quizId } = await createQuiz(
        { type: 'quiz_erros', subjectId: quiz.subjectId, fromQuizId: quiz.id, indices: wrong },
        { ...quiz.config, count: Math.max(3, Math.min(30, wrong.length * 2)) },
      );
      navigate(`/quizzes/${quizId}`);
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setRegenerating(false);
    }
  };

  const saveToBank = async () => {
    setSavingBank(true);
    try {
      const ids: string[] = [];
      for (const it of quiz.items) {
        const optionNotes = it.optionExplanations.map((e, i) => `${LETTERS[i]}) ${e}`).join('\n');
        ids.push(
          await createQuestion(uid, {
            subjectId: quiz.subjectId,
            topicId: it.topicId,
            statement: it.statement,
            // o banco não tem "lacunas": vira múltipla escolha (o enunciado mantém o _____)
            type: it.type === 'lacunas' ? 'multipla' : it.type,
            options: it.options,
            correctAnswer: it.correctAnswer,
            explanation: [it.explanation, optionNotes, it.sourceQuote ? `Fonte: “${it.sourceQuote}” (${it.sourceMaterialTitle ?? ''}${it.sourcePage ? `, p. ${it.sourcePage}` : ''})` : '']
              .filter(Boolean)
              .join('\n\n'),
            source: 'ia',
            externalUrl: '',
            difficulty: it.difficulty,
          }),
        );
      }
      await updateDoc(userDoc(uid, 'quizzes', quiz.id), { questionIds: ids });
      toast.success(`${ids.length} questões salvas no banco de questões.`);
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setSavingBank(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Card className="p-6 text-center">
        <span className="mx-auto mb-3 grid size-14 place-items-center rounded-2xl bg-primary-soft text-primary-text">
          <Trophy className="size-7" />
        </span>
        <h1 className="text-2xl font-bold text-text">{result.score}% de acertos</h1>
        <p className="mt-1 text-text-muted">
          {result.correct} de {result.total} · <Clock className="inline size-4 align-[-2px]" /> {formatClock(result.timeSpentSec * 1000)}
          {result.contested.length > 0 && ` · ${result.contested.length} contestada(s)`}
        </p>
        <ProgressBar value={result.score} tone={result.score >= 70 ? 'success' : result.score >= 50 ? 'warning' : 'error'} className="mx-auto mt-4 max-w-xs" label="Nota" />
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {wrong.length > 0 && (
            <Button onClick={regenerate} loading={regenerating}>
              <RotateCcw className="size-4" /> Novo quiz só com o que errei
            </Button>
          )}
          {wrong.length > 0 && (
            <Button variant="secondary" onClick={() => setErrorsOpen(true)}>
              <NotebookPen className="size-4" /> Registrar erros no caderno
            </Button>
          )}
          <Button variant="secondary" onClick={saveToBank} loading={savingBank} disabled={savedToBank}>
            <Save className="size-4" /> {savedToBank ? 'Salvas no banco ✓' : 'Salvar questões no banco'}
          </Button>
          <ButtonLink to="/quizzes" variant="ghost">
            Meus quizzes
          </ButtonLink>
        </div>
      </Card>

      {result.feedback && (
        <Card className="space-y-2">
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary-text" /> Feedback da IA
          </CardTitle>
          <p className="text-sm whitespace-pre-line text-text">{result.feedback}</p>
          {result.weakTopics.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1">
              <span className="text-xs text-text-muted">Revisar:</span>
              {result.weakTopics.map((t) => (
                <Badge key={t} variant="warning">
                  {t}
                </Badge>
              ))}
            </div>
          )}
        </Card>
      )}

      {result.byTopic.length > 0 && (
        <Card>
          <CardTitle className="mb-4">Acertos por assunto</CardTitle>
          <BarList
            aria-label="Acertos por assunto neste quiz"
            max={100}
            items={result.byTopic.map((t) => ({
              key: t.topic,
              label: t.topic,
              value: Math.round((t.correct / t.total) * 100),
              display: `${t.correct}/${t.total}`,
            }))}
          />
        </Card>
      )}

      {quiz.noMaterial && <Alert variant="info">Este quiz foi gerado sem os seus materiais (tema livre). Confira os fundamentos na legislação.</Alert>}

      {/* Revisão das questões */}
      <section aria-label="Revisão">
        <h2 className="mb-3 text-lg font-semibold text-text">Revisão</h2>
        <ul className="space-y-2">
          {quiz.items.map((it, i) => {
            const a = answers.get(i);
            const contested = a?.contested || result.contested.includes(i);
            const ok = a?.correct;
            const expanded = open === i;
            return (
              <li key={i}>
                <Card className="p-0">
                  <button type="button" onClick={() => setOpen(expanded ? null : i)} aria-expanded={expanded} className="flex w-full items-start gap-3 p-4 text-left">
                    {contested ? (
                      <Flag className="mt-0.5 size-5 shrink-0 text-warning" aria-label="Contestada" />
                    ) : ok ? (
                      <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" aria-label="Acertou" />
                    ) : (
                      <XCircle className="mt-0.5 size-5 shrink-0 text-error" aria-label="Errou" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className={cn('block text-sm text-text', !expanded && 'line-clamp-2')}>{it.statement}</span>
                      <span className="mt-1 block text-xs text-text-muted">{it.topicName}</span>
                    </span>
                    <ChevronDown className={cn('mt-0.5 size-4 shrink-0 text-text-muted transition-transform', expanded && 'rotate-180')} />
                  </button>
                  {expanded && (
                    <div className="space-y-3 border-t border-border p-4">
                      {it.type !== 'discursiva' && it.options.length > 0 && (
                        <ul className="space-y-1 text-sm">
                          {it.options.map((o, j) => (
                            <li key={j} className={cn('rounded-lg px-2 py-1', String(j) === it.correctAnswer ? 'bg-success/10 font-medium text-text' : 'text-text')}>
                              {LETTERS[j]}) {o}
                            </li>
                          ))}
                        </ul>
                      )}
                      <p className="text-sm">
                        <span className="text-text-muted">Sua resposta: </span>
                        <span className="text-text">{a ? answerText(it, a.answer) : '—'}</span>
                      </p>
                      <p className="text-sm">
                        <span className="text-text-muted">Gabarito: </span>
                        <span className="font-medium text-text">{answerText(it, it.correctAnswer)}</span>
                      </p>
                      <ItemExplanation item={it} chosen={a?.answer} />
                      <SourceQuote subjectId={quiz.subjectId} item={it} />
                    </div>
                  )}
                </Card>
              </li>
            );
          })}
        </ul>
      </section>

      <RegisterQuizErrors open={errorsOpen} onClose={() => setErrorsOpen(false)} quiz={quiz} wrong={wrong} suggestions={result.suggestions ?? []} answers={answers} />
    </div>
  );
}

/** Registra as questões erradas no caderno de erros, com a categoria sugerida pela IA (editável). */
function RegisterQuizErrors({
  open,
  onClose,
  quiz,
  wrong,
  suggestions,
  answers,
}: {
  open: boolean;
  onClose: () => void;
  quiz: Quiz;
  wrong: number[];
  suggestions: { index: number; category: ErrorCategory }[];
  answers: Map<number, { answer: string }>;
}) {
  const uid = useUid();
  const suggested = new Map(suggestions.map((s) => [s.index, s.category]));
  const [rows, setRows] = useState<Record<number, { include: boolean; category: ErrorCategory | '' }>>(() =>
    Object.fromEntries(wrong.map((i) => [i, { include: true, category: suggested.get(i) ?? '' }])),
  );
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const chosen = wrong.filter((i) => rows[i]?.include && rows[i]?.category);
    if (!chosen.length) return toast.error('Escolha a categoria de pelo menos uma questão.');
    setSaving(true);
    try {
      for (const i of chosen) {
        const it = quiz.items[i]!;
        await createError(uid, {
          questionId: null,
          subjectId: quiz.subjectId,
          topicId: it.topicId,
          category: rows[i]!.category as ErrorCategory,
          note: `Quiz “${quiz.title}”: ${it.statement.slice(0, 300)}\nMinha resposta: ${answerText(it, answers.get(i)?.answer ?? '')}\nGabarito: ${answerText(it, it.correctAnswer)}`,
        });
      }
      toast.success(`${chosen.length} erro(s) registrados no caderno.`);
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
      title="Registrar no caderno de erros"
      description="A IA sugeriu o motivo de cada erro. Troque se não concordar."
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={save} loading={saving}>
            Registrar
          </Button>
        </>
      }
    >
      <ul className="space-y-3">
        {wrong.map((i) => {
          const it = quiz.items[i]!;
          const row = rows[i] ?? { include: true, category: '' };
          return (
            <li key={i} className="rounded-xl border border-border p-3">
              <label className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={row.include}
                  onChange={(e) => setRows((r) => ({ ...r, [i]: { ...row, include: e.target.checked } }))}
                  className="mt-1 accent-(--primary)"
                />
                <span className="line-clamp-2 text-sm text-text">{it.statement}</span>
              </label>
              <div className="mt-2 flex items-center gap-2 pl-6">
                {suggested.has(i) && (
                  <Badge variant="primary">
                    <Sparkles className="size-3" /> IA
                  </Badge>
                )}
                <Select
                  value={row.category}
                  onChange={(e) => setRows((r) => ({ ...r, [i]: { ...row, category: e.target.value as ErrorCategory } }))}
                  aria-label="Categoria do erro"
                  className="h-9"
                >
                  <option value="">Escolha a categoria…</option>
                  {ERROR_CATEGORIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </Select>
              </div>
            </li>
          );
        })}
      </ul>
    </Modal>
  );
}
