import { ArrowRight, CheckCircle2, Clock, ExternalLink, NotebookPen, RotateCcw, Sparkles, Trophy, X, XCircle } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { RegisterErrorModal, type ErrorContext } from '@/components/errors/RegisterErrorModal';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Textarea } from '@/components/ui/Field';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { ErrorBlock, LoadingBlock } from '@/components/ui/States';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { questionKeys, useAttemptMutation, useErrorMutations, useErrors, useQuestions } from '@/hooks/useQuestions';
import { useUid } from '@/hooks/useUid';
import { examMeta } from '@/lib/boards';
import { friendlyError } from '@/lib/firebaseErrors';
import { commentQuestionAi } from '@/services/questionsAi';
import { useAllSubjects, useAllTopics } from '@/hooks/useStudyData';
import { cn } from '@/lib/cn';
import { formatClock } from '@/lib/dates';
import { answerLabel, DIFFICULTY_LABELS, isCorrectAnswer, LETTERS } from '@/lib/questions';
import { clearSession, loadSession, newSession, saveSession, type SolveSession } from '@/lib/solveSession';
import type { Question } from '@/types/models';

export default function SolvePage() {
  const [session, setSession] = useState<SolveSession | null>(loadSession);
  const questions = useQuestions();

  if (!session) return <Navigate to="/questoes" replace />;
  if (questions.isLoading) return <LoadingBlock label="Preparando questões…" />;
  if (questions.isError) return <ErrorBlock error={questions.error} onRetry={() => questions.refetch()} />;

  return <Solver session={session} setSession={setSession} allQuestions={questions.data ?? []} />;
}

interface SolverProps {
  session: SolveSession;
  setSession: (s: SolveSession | null) => void;
  allQuestions: Question[];
}

function Solver({ session, setSession, allQuestions }: SolverProps) {
  const navigate = useNavigate();
  const attempt = useAttemptMutation();
  const subjects = useAllSubjects();
  const topics = useAllTopics();

  // Questões da sessão (as excluídas no meio do caminho são ignoradas).
  const byId = useMemo(() => new Map(allQuestions.map((q) => [q.id, q])), [allQuestions]);
  const list = useMemo(() => session.ids.map((id) => byId.get(id)).filter((q): q is Question => !!q), [session.ids, byId]);

  const update = useCallback(
    (s: SolveSession) => {
      saveSession(s);
      setSession(s);
    },
    [setSession],
  );

  const finished = session.results.length >= list.length;
  if (list.length === 0) return <Navigate to={session.returnTo} replace />;
  if (finished) {
    return <Results session={session} list={list} onExit={() => { clearSession(); navigate(session.returnTo); }} onRedo={(ids) => { const s = newSession(ids, 'Refazer as erradas', session.returnTo); setSession(s); }} />;
  }

  const index = Math.min(session.results.length, list.length - 1);
  const question = list[index]!;
  const subject = subjects.data?.find((s) => s.id === question.subjectId);
  const topic = question.topicId ? topics.data?.find((t) => t.id === question.topicId) : undefined;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex justify-between text-xs text-text-muted">
            <span className="truncate">{session.title}</span>
            <span>
              Questão {index + 1} de {list.length}
            </span>
          </div>
          <ProgressBar value={(session.results.length / list.length) * 100} label="Progresso" />
        </div>
        <Button variant="ghost" size="sm" onClick={() => navigate(session.returnTo)} title="Seu progresso fica salvo">
          <X className="size-4" /> Sair
        </Button>
      </div>

      <QuestionStep
        key={question.id}
        question={question}
        subjectName={subject?.name}
        topicName={topic?.name}
        isLast={session.results.length + 1 >= list.length}
        onAnswered={(answer, correct, timeSpentSec) => {
          attempt.mutate({
            questionId: question.id,
            subjectId: question.subjectId,
            topicId: question.topicId ?? null,
            quizId: null,
            answer,
            isCorrect: correct,
            timeSpentSec,
          });
          return { answer, correct, timeSpentSec };
        }}
        onNext={(r) => update({ ...session, index: index + 1, results: [...session.results, { questionId: question.id, ...r }] })}
      />
    </div>
  );
}

interface StepResult {
  answer: string;
  correct: boolean;
  timeSpentSec: number;
}

interface QuestionStepProps {
  question: Question;
  subjectName?: string;
  topicName?: string;
  isLast: boolean;
  onAnswered: (answer: string, correct: boolean, timeSpentSec: number) => StepResult;
  onNext: (r: StepResult) => void;
}

function QuestionStep({ question: q, subjectName, topicName, isLast, onAnswered, onNext }: QuestionStepProps) {
  const startedAt = useRef(Date.now());
  const [selected, setSelected] = useState<string>('');
  const [text, setText] = useState('');
  const [revealed, setRevealed] = useState(false); // discursiva: gabarito à mostra, aguardando autoavaliação
  const [result, setResult] = useState<StepResult | null>(null);
  const [errorCtx, setErrorCtx] = useState<ErrorContext | null>(null);
  const [registered, setRegistered] = useState(false);
  const [commenting, setCommenting] = useState(false);
  const uid = useUid();
  const qc = useQueryClient();

  /** Comentário da IA para questões sem comentário (estilo dos comentários de professores). */
  const askComment = async () => {
    setCommenting(true);
    try {
      await commentQuestionAi(q.id);
      await qc.invalidateQueries({ queryKey: questionKeys.questions(uid) });
    } catch (err) {
      toast.error(friendlyError(err, 'Não foi possível comentar agora.'));
    } finally {
      setCommenting(false);
    }
  };
  const errors = useErrors();
  const { update: updateError } = useErrorMutations();
  // Erros pendentes desta questão no caderno (para "marcar como resolvido" ao acertar)
  const openErrors = (errors.data ?? []).filter((e) => e.questionId === q.id && !e.resolved);

  const elapsed = () => Math.round((Date.now() - startedAt.current) / 1000);
  const errorContext: ErrorContext = { questionId: q.id, subjectId: q.subjectId, topicId: q.topicId ?? null };

  const confirm = useCallback(
    (answer: string, correctOverride?: boolean) => {
      if (result) return;
      const correct = correctOverride ?? isCorrectAnswer(q, answer);
      setResult(onAnswered(answer, correct, elapsed()));
      if (!correct) setErrorCtx(errorContext); // errou → abre o caderno de erros
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [result, q, onAnswered],
  );

  // Atalhos: A–E escolhem, C/E no certo/errado, Enter confirma ou avança.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (errorCtx || e.ctrlKey || e.metaKey || e.altKey) return;
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'TEXTAREA' || tag === 'INPUT' || tag === 'SELECT') return;
      const key = e.key.toUpperCase();

      if (e.key === 'Enter') {
        e.preventDefault();
        if (result) onNext(result);
        else if (q.type !== 'discursiva' && selected) confirm(selected);
        return;
      }
      if (result) return;
      if (q.type === 'multipla') {
        const i = LETTERS.indexOf(key as (typeof LETTERS)[number]);
        if (i >= 0 && i < q.options.length) setSelected(String(i));
      }
      if (q.type === 'certo_errado') {
        if (key === 'C') setSelected('certo');
        if (key === 'E') setSelected('errado');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [q, selected, result, errorCtx, confirm, onNext]);

  const optionState = (value: string) => {
    if (!result) return selected === value ? 'selected' : 'idle';
    if (value === q.correctAnswer) return 'correct';
    if (value === result.answer) return 'wrong';
    return 'idle';
  };
  const optionClass = {
    idle: 'border-border bg-surface hover:bg-primary-soft',
    selected: 'border-primary bg-primary-soft ring-1 ring-primary',
    correct: 'border-success bg-success/10',
    wrong: 'border-error bg-error/10',
  };

  return (
    <>
      <Card className="space-y-5 p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-1.5">
          {subjectName && <Badge variant="primary">{subjectName}</Badge>}
          {topicName && <Badge variant="neutral">{topicName}</Badge>}
          <Badge variant="neutral">{DIFFICULTY_LABELS[q.difficulty]}</Badge>
          {examMeta(q) && <Badge variant="info">{examMeta(q)}</Badge>}
        </div>

        <p className="text-base leading-relaxed whitespace-pre-line text-text">{q.statement}</p>

        {q.type === 'multipla' && (
          <div role="radiogroup" aria-label="Alternativas" className="space-y-2">
            {q.options.map((opt, i) => {
              const state = optionState(String(i));
              return (
                <button
                  key={i}
                  type="button"
                  role="radio"
                  aria-checked={selected === String(i)}
                  disabled={!!result}
                  onClick={() => setSelected(String(i))}
                  className={cn('flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors disabled:cursor-default', optionClass[state])}
                >
                  <span
                    className={cn(
                      'grid size-7 shrink-0 place-items-center rounded-full border text-sm font-semibold',
                      state === 'correct' ? 'border-success text-success' : state === 'wrong' ? 'border-error text-error' : state === 'selected' ? 'border-primary text-primary-text' : 'border-border text-text-muted',
                    )}
                  >
                    {LETTERS[i]}
                  </span>
                  <span className="pt-0.5 text-sm text-text">{opt}</span>
                  {state === 'correct' && <CheckCircle2 className="ml-auto size-5 shrink-0 text-success" aria-label="Correta" />}
                  {state === 'wrong' && <XCircle className="ml-auto size-5 shrink-0 text-error" aria-label="Sua resposta" />}
                </button>
              );
            })}
          </div>
        )}

        {q.type === 'certo_errado' && (
          <div role="radiogroup" aria-label="Certo ou errado" className="grid grid-cols-2 gap-2">
            {(['certo', 'errado'] as const).map((v) => (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={selected === v}
                disabled={!!result}
                onClick={() => setSelected(v)}
                className={cn('rounded-xl border p-3 text-sm font-semibold text-text transition-colors disabled:cursor-default', optionClass[optionState(v)])}
              >
                {v === 'certo' ? 'Certo' : 'Errado'} <span className="ml-1 text-xs font-normal text-text-muted">({v === 'certo' ? 'C' : 'E'})</span>
              </button>
            ))}
          </div>
        )}

        {q.type === 'discursiva' && (
          <div className="space-y-3">
            <Textarea
              rows={6}
              value={text}
              disabled={revealed}
              onChange={(e) => setText(e.target.value)}
              placeholder="Escreva sua resposta…"
              aria-label="Sua resposta"
            />
            {revealed && (
              <div className="rounded-xl border border-border bg-bg p-4">
                <p className="mb-1 text-xs font-semibold tracking-wide text-text-muted uppercase">Resposta esperada</p>
                <p className="text-sm whitespace-pre-line text-text">{q.correctAnswer}</p>
              </div>
            )}
          </div>
        )}

        {/* Resultado */}
        {result && (
          <div className="space-y-3">
            {q.type !== 'discursiva' &&
              (result.correct ? (
                <Alert variant="success" title="Você acertou!" />
              ) : (
                <Alert variant="error" title={`Resposta errada. Gabarito: ${answerLabel(q)}`} />
              ))}
            {q.type === 'discursiva' && (
              <Alert variant={result.correct ? 'success' : 'error'} title={result.correct ? 'Marcada como acerto' : 'Marcada como erro'} />
            )}
            {q.explanation ? (
              <div className="rounded-xl border border-border bg-bg p-4">
                <p className="mb-1 flex items-center gap-1 text-xs font-semibold tracking-wide text-text-muted uppercase">
                  {q.explanationByAi && <Sparkles className="size-3.5 text-primary-text" aria-hidden />} {q.explanationByAi ? 'Comentário da IA' : 'Comentário'}
                </p>
                <p className="text-sm whitespace-pre-line text-text">{q.explanation}</p>
              </div>
            ) : (
              <Button variant="secondary" size="sm" onClick={askComment} loading={commenting}>
                <Sparkles className="size-4" /> {commenting ? 'A IA está comentando…' : 'Comentário da IA'}
              </Button>
            )}
            {q.externalUrl && (
              <a href={q.externalUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-primary-text hover:underline">
                <ExternalLink className="size-4" /> Ver na plataforma de origem
              </a>
            )}
          </div>
        )}
      </Card>

      {/* Barra de ação */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <span className="hidden text-xs text-text-muted sm:block">
          {q.type === 'multipla' && !result && 'Atalhos: A–E para escolher, Enter para confirmar'}
          {q.type === 'certo_errado' && !result && 'Atalhos: C ou E para escolher, Enter para confirmar'}
          {result && 'Enter para continuar'}
        </span>
        <div className="ml-auto flex flex-wrap gap-2">
          {result?.correct && openErrors.length > 0 && (
            <Button
              variant="secondary"
              onClick={() => {
                openErrors.forEach((e) => updateError.mutate({ id: e.id, data: { resolved: true } }));
                toast.success('Erro marcado como resolvido no caderno.');
              }}
            >
              <CheckCircle2 className="size-4" /> Marcar erro como resolvido
            </Button>
          )}
          {result && !result.correct && (
            <Button variant="secondary" onClick={() => setErrorCtx(errorContext)} disabled={registered}>
              <NotebookPen className="size-4" /> {registered ? 'Registrado' : 'Caderno de erros'}
            </Button>
          )}

          {!result && q.type !== 'discursiva' && (
            <Button onClick={() => confirm(selected)} disabled={!selected}>
              Confirmar
            </Button>
          )}
          {!result && q.type === 'discursiva' && !revealed && (
            <Button onClick={() => setRevealed(true)} disabled={!text.trim()}>
              Ver gabarito
            </Button>
          )}
          {!result && q.type === 'discursiva' && revealed && (
            <>
              <Button variant="danger" onClick={() => confirm(text, false)}>
                <XCircle className="size-4" /> Errei
              </Button>
              <Button onClick={() => confirm(text, true)}>
                <CheckCircle2 className="size-4" /> Acertei
              </Button>
            </>
          )}
          {result && (
            <Button onClick={() => onNext(result)} autoFocus>
              {isLast ? 'Ver resultado' : 'Próxima'} <ArrowRight className="size-4" />
            </Button>
          )}
        </div>
      </div>

      <RegisterErrorModal
        context={errorCtx}
        onClose={() => {
          setErrorCtx(null);
        }}
        onSaved={() => setRegistered(true)}
      />
    </>
  );
}

function Results({ session, list, onExit, onRedo }: { session: SolveSession; list: Question[]; onExit: () => void; onRedo: (ids: string[]) => void }) {
  const byId = new Map(list.map((q) => [q.id, q]));
  const results = session.results.filter((r) => byId.has(r.questionId));
  const correct = results.filter((r) => r.correct).length;
  const pct = results.length ? Math.round((correct / results.length) * 100) : 0;
  const totalSec = results.reduce((s, r) => s + r.timeSpentSec, 0);
  const wrongIds = results.filter((r) => !r.correct).map((r) => r.questionId);

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Card className="p-6 text-center">
        <span className="mx-auto mb-3 grid size-14 place-items-center rounded-2xl bg-primary-soft text-primary-text">
          <Trophy className="size-7" />
        </span>
        <h1 className="text-2xl font-bold text-text">{pct}% de acertos</h1>
        <p className="mt-1 text-text-muted">
          {correct} de {results.length} · <Clock className="inline size-4 align-[-2px]" /> {formatClock(totalSec * 1000)}
        </p>
        <ProgressBar value={pct} tone={pct >= 70 ? 'success' : pct >= 50 ? 'warning' : 'error'} className="mx-auto mt-4 max-w-xs" label="Acertos" />
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {wrongIds.length > 0 && (
            <Button onClick={() => onRedo(wrongIds)}>
              <RotateCcw className="size-4" /> Refazer só as erradas ({wrongIds.length})
            </Button>
          )}
          <Button variant="secondary" onClick={onExit}>
            Voltar
          </Button>
        </div>
      </Card>

      <ul className="space-y-2">
        {results.map((r, i) => {
          const q = byId.get(r.questionId)!;
          return (
            <li key={`${r.questionId}-${i}`}>
              <Card className="flex items-start gap-3 p-3">
                {r.correct ? (
                  <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" aria-label="Acertou" />
                ) : (
                  <XCircle className="mt-0.5 size-5 shrink-0 text-error" aria-label="Errou" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm text-text">{q.statement}</p>
                  {q.type !== 'discursiva' && (
                    <p className="mt-1 text-xs text-text-muted">
                      Sua resposta: {answerLabel(q, r.answer)} · Gabarito: {answerLabel(q)}
                    </p>
                  )}
                </div>
                <span className="shrink-0 text-xs text-text-muted">{formatClock(r.timeSpentSec * 1000)}</span>
              </Card>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
