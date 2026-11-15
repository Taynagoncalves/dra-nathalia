import { ArrowRight, BookOpen, CheckCircle2, Flag, Loader2, Timer, XCircle } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Textarea } from '@/components/ui/Field';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { useUid } from '@/hooks/useUid';
import { cn } from '@/lib/cn';
import { friendlyError } from '@/lib/firebaseErrors';
import { LETTERS } from '@/lib/questions';
import { finishQuiz, gradeDiscursive, type FinishResponse, type GradeResponse } from '@/services/ai';
import { createAttempt } from '@/services/firebase/attempts';
import type { Quiz, QuizItem } from '@/types/models';

export interface PlayerAnswer {
  answer: string;
  /** null = discursiva ainda não corrigida (modo prova) */
  correct: boolean | null;
  contested: boolean;
  timeSpentSec: number;
  grade?: GradeResponse;
}

const DIFF: Record<QuizItem['difficulty'], string> = { facil: 'Fácil', medio: 'Médio', dificil: 'Difícil' };

/** Link para abrir o material na página do trecho de origem (em nova aba, sem perder o quiz). */
export function sourceHref(subjectId: string, item: QuizItem) {
  if (!item.sourceMaterialId) return null;
  const params = new URLSearchParams({ abrir: item.sourceMaterialId });
  if (item.sourcePage) params.set('pagina', String(item.sourcePage));
  return `/materias/${subjectId}?${params}`;
}

export function SourceQuote({ subjectId, item }: { subjectId: string; item: QuizItem }) {
  if (!item.sourceQuote && !item.sourceMaterialTitle) return null;
  const href = sourceHref(subjectId, item);
  return (
    <div className="rounded-xl border border-border bg-bg p-3 text-sm">
      <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-text-muted uppercase">
        <BookOpen className="size-3.5" /> Trecho de origem
      </p>
      {item.sourceQuote && <blockquote className="border-l-2 border-primary pl-3 text-text italic">“{item.sourceQuote}”</blockquote>}
      {item.sourceMaterialTitle && (
        <p className="mt-1.5 text-xs text-text-muted">
          {href ? (
            <a href={href} target="_blank" rel="noopener noreferrer" className="font-medium text-primary-text hover:underline">
              {item.sourceMaterialTitle}
              {item.sourcePage ? `, p. ${item.sourcePage}` : ''} ↗
            </a>
          ) : (
            item.sourceMaterialTitle
          )}
        </p>
      )}
    </div>
  );
}

/** Explicação: comentário geral + por que cada alternativa está certa/errada. */
export function ItemExplanation({ item, chosen }: { item: QuizItem; chosen?: string }) {
  return (
    <div className="space-y-2">
      {item.explanation && (
        <div className="rounded-xl border border-border bg-bg p-3">
          <p className="mb-1 text-xs font-semibold tracking-wide text-text-muted uppercase">Comentário</p>
          <p className="text-sm whitespace-pre-line text-text">{item.explanation}</p>
        </div>
      )}
      {item.optionExplanations.length > 0 && (
        <ul className="space-y-1 text-sm">
          {item.optionExplanations.map((e, i) => (
            <li key={i} className={cn('flex gap-2 rounded-lg px-2 py-1', String(i) === item.correctAnswer ? 'bg-success/10' : String(i) === chosen ? 'bg-error/10' : '')}>
              <span className={cn('font-semibold', String(i) === item.correctAnswer ? 'text-success' : 'text-text-muted')}>{LETTERS[i]})</span>
              <span className="text-text">{e}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

interface QuizPlayerProps {
  quiz: Quiz;
  onFinished: (result: FinishResponse) => void;
}

const storageKey = (id: string) => `quiz-respostas-${id}`;

export function QuizPlayer({ quiz, onFinished }: QuizPlayerProps) {
  const uid = useUid();
  const items = quiz.items;
  const mode = quiz.config.mode;
  const reveal = mode !== 'prova';

  // Respostas ficam no navegador: recarregar a página não perde o progresso.
  const [answers, setAnswers] = useState<Record<number, PlayerAnswer>>(() => {
    try {
      return JSON.parse(sessionStorage.getItem(storageKey(quiz.id)) ?? '{}');
    } catch {
      return {};
    }
  });
  const firstUnanswered = items.findIndex((_, i) => !answers[i]);
  const [index, setIndex] = useState(firstUnanswered === -1 ? items.length - 1 : firstUnanswered);
  const [selected, setSelected] = useState('');
  const [text, setText] = useState('');
  const [grading, setGrading] = useState(false);
  const [finishing, setFinishing] = useState<string | null>(null);
  const startedAt = useRef(Date.now());
  const quizStart = useRef(Date.now());
  const [remaining, setRemaining] = useState<number | null>(null);

  const item = items[index]!;
  const current = answers[index];
  const isLast = index === items.length - 1;
  const hasOptions = item.type === 'multipla' || item.type === 'lacunas';

  useEffect(() => {
    try {
      sessionStorage.setItem(storageKey(quiz.id), JSON.stringify(answers));
    } catch {
      /* ignore */
    }
  }, [answers, quiz.id]);

  // Nova questão: zera seleção e cronômetro
  useEffect(() => {
    setSelected('');
    setText('');
    startedAt.current = Date.now();
    setRemaining(mode === 'relampago' && !answers[index] ? (quiz.config.timerSec ?? 60) : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  const save = (a: PlayerAnswer) => setAnswers((prev) => ({ ...prev, [index]: a }));

  const confirm = useCallback(
    async (forced?: string) => {
      if (answers[index] || grading) return;
      const answer = forced ?? (item.type === 'discursiva' ? text.trim() : selected);
      const timeSpentSec = Math.round((Date.now() - startedAt.current) / 1000);
      setRemaining(null);
      if (item.type === 'discursiva') {
        if (!answer || !reveal) {
          save({ answer, correct: answer ? null : false, contested: false, timeSpentSec });
          if (!reveal && !isLast) setIndex((i) => i + 1);
          return;
        }
        setGrading(true);
        try {
          const grade = await gradeDiscursive(quiz.id, index, answer);
          save({ answer, correct: grade.correct, contested: false, timeSpentSec, grade });
        } catch (err) {
          toast.error(friendlyError(err, 'Não foi possível corrigir agora.'));
          save({ answer, correct: null, contested: false, timeSpentSec });
        } finally {
          setGrading(false);
        }
        return;
      }
      save({ answer, correct: answer === item.correctAnswer, contested: false, timeSpentSec });
      if (!reveal && !isLast) setIndex((i) => i + 1);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [answers, index, item, selected, text, reveal, isLast, grading],
  );

  // Relâmpago: contagem regressiva; zerou, confirma o que tiver
  useEffect(() => {
    if (remaining === null) return;
    if (remaining <= 0) {
      confirm(item.type === 'discursiva' ? text.trim() : selected);
      return;
    }
    const t = window.setTimeout(() => setRemaining((r) => (r === null ? null : r - 1)), 1000);
    return () => window.clearTimeout(t);
  }, [remaining, confirm, item.type, selected, text]);

  const contest = () => {
    const timeSpentSec = Math.round((Date.now() - startedAt.current) / 1000);
    save({ ...(current ?? { answer: '', correct: null, timeSpentSec }), contested: true });
    toast('Questão contestada: ela não conta como erro e fica marcada para revisão.');
    if (!reveal && !isLast && !current) setIndex((i) => i + 1);
  };

  const finish = async () => {
    try {
      const final = { ...answers };
      // Prova: corrige as discursivas no final
      const pending = Object.entries(final).filter(([i, a]) => a.correct === null && !a.contested && a.answer && items[Number(i)]?.type === 'discursiva');
      for (const [k, [i, a]] of pending.entries()) {
        setFinishing(`Corrigindo discursivas (${k + 1}/${pending.length})…`);
        try {
          const grade = await gradeDiscursive(quiz.id, Number(i), a.answer);
          final[Number(i)] = { ...a, correct: grade.correct, grade };
        } catch {
          final[Number(i)] = { ...a, correct: false };
        }
      }
      setAnswers(final);
      setFinishing('Calculando o resultado e preparando o feedback…');
      const list = items.map((_, i) => final[i] ?? { answer: '', correct: false, contested: false, timeSpentSec: 0 });
      const totalSec = Math.round((Date.now() - quizStart.current) / 1000) || list.reduce((t, a) => t + a.timeSpentSec, 0);
      const result = await finishQuiz(
        quiz.id,
        list.map((a, i) => ({ index: i, answer: a.answer, correct: !!a.correct, contested: a.contested })),
        totalSec,
      );
      // Cada resposta vira uma tentativa (alimenta o Desempenho)
      await Promise.all(
        list.map((a, i) =>
          a.contested
            ? null
            : createAttempt(uid, {
                questionId: `quiz:${quiz.id}:${i}`,
                subjectId: quiz.subjectId,
                topicId: items[i]!.topicId,
                quizId: quiz.id,
                answer: a.answer.slice(0, 2000),
                isCorrect: !!a.correct,
                timeSpentSec: a.timeSpentSec,
              }).catch(() => null),
        ),
      );
      sessionStorage.removeItem(storageKey(quiz.id));
      onFinished(result);
    } catch (err) {
      toast.error(friendlyError(err, 'Não foi possível finalizar o quiz.'));
    } finally {
      setFinishing(null);
    }
  };

  // Atalhos: A–E, C/E, Enter
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'TEXTAREA' || tag === 'INPUT' || e.ctrlKey || e.metaKey || e.altKey || finishing) return;
      const key = e.key.toUpperCase();
      if (e.key === 'Enter') {
        e.preventDefault();
        if (current) isLast ? finish() : setIndex((i) => i + 1);
        else if (selected) confirm();
        return;
      }
      if (current) return;
      if (hasOptions) {
        const i = LETTERS.indexOf(key as (typeof LETTERS)[number]);
        if (i >= 0 && i < item.options.length) setSelected(String(i));
      }
      if (item.type === 'certo_errado') {
        if (key === 'C') setSelected('certo');
        if (key === 'E') setSelected('errado');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const answeredCount = Object.keys(answers).length;
  const showResult = !!current && reveal;
  const optionClass = (value: string) => {
    if (showResult && !current?.contested) {
      if (value === item.correctAnswer) return 'border-success bg-success/10';
      if (value === current?.answer) return 'border-error bg-error/10';
      return 'border-border bg-surface opacity-80';
    }
    return (current?.answer ?? selected) === value ? 'border-primary bg-primary-soft ring-1 ring-primary' : 'border-border bg-surface hover:bg-primary-soft';
  };

  if (finishing) {
    return (
      <Card className="mx-auto flex max-w-xl flex-col items-center gap-3 py-12 text-center">
        <Loader2 className="size-8 animate-spin text-primary-text" />
        <p className="text-sm text-text">{finishing}</p>
      </Card>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4">
        <div className="mb-1.5 flex items-center justify-between gap-2 text-xs text-text-muted">
          <span>
            Questão {index + 1} de {items.length} · {mode === 'treino' ? 'Treino' : mode === 'prova' ? 'Prova' : 'Relâmpago'}
          </span>
          {remaining !== null && (
            <span className={cn('inline-flex items-center gap-1 font-mono font-semibold tabular-nums', remaining <= 10 ? 'text-error' : 'text-text')}>
              <Timer className="size-3.5" /> {remaining}s
            </span>
          )}
        </div>
        <ProgressBar value={(answeredCount / items.length) * 100} label="Progresso do quiz" />
      </div>

      <Card className="space-y-5 p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="primary">{item.topicName}</Badge>
          <Badge variant="neutral">{DIFF[item.difficulty]}</Badge>
          {current?.contested && <Badge variant="warning">Contestada</Badge>}
        </div>

        <p className="text-base leading-relaxed whitespace-pre-line text-text">{item.statement}</p>

        {hasOptions && (
          <div role="radiogroup" aria-label="Alternativas" className="space-y-2">
            {item.options.map((opt, i) => (
              <button
                key={i}
                type="button"
                role="radio"
                aria-checked={(current?.answer ?? selected) === String(i)}
                disabled={!!current}
                onClick={() => setSelected(String(i))}
                className={cn('flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors disabled:cursor-default', optionClass(String(i)))}
              >
                <span className="grid size-7 shrink-0 place-items-center rounded-full border border-border text-sm font-semibold text-text-muted">{LETTERS[i]}</span>
                <span className="pt-0.5 text-sm text-text">{opt}</span>
              </button>
            ))}
          </div>
        )}

        {item.type === 'certo_errado' && (
          <div role="radiogroup" aria-label="Certo ou errado" className="grid grid-cols-2 gap-2">
            {(['certo', 'errado'] as const).map((v) => (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={(current?.answer ?? selected) === v}
                disabled={!!current}
                onClick={() => setSelected(v)}
                className={cn('rounded-xl border p-3 text-sm font-semibold text-text transition-colors disabled:cursor-default', optionClass(v))}
              >
                {v === 'certo' ? 'Certo' : 'Errado'} <span className="text-xs font-normal text-text-muted">({v === 'certo' ? 'C' : 'E'})</span>
              </button>
            ))}
          </div>
        )}

        {item.type === 'discursiva' && (
          <Textarea
            rows={6}
            value={current ? current.answer : text}
            disabled={!!current}
            onChange={(e) => setText(e.target.value)}
            placeholder="Escreva sua resposta (3 a 6 linhas)…"
            aria-label="Sua resposta"
          />
        )}

        {/* Resultado da questão (treino e relâmpago) */}
        {showResult && !current!.contested && (
          <div className="space-y-3">
            {item.type === 'discursiva' ? (
              current!.grade ? (
                <Alert
                  variant={current!.grade.verdict === 'correta' ? 'success' : current!.grade.verdict === 'parcial' ? 'warning' : 'error'}
                  title={`Nota ${current!.grade.score}/10 — ${current!.grade.verdict === 'correta' ? 'boa resposta' : current!.grade.verdict === 'parcial' ? 'resposta parcial' : 'resposta incorreta'}`}
                >
                  <p>{current!.grade.feedback}</p>
                  {current!.grade.missing.length > 0 && (
                    <ul className="mt-1 list-disc pl-4">
                      {current!.grade.missing.map((m, i) => (
                        <li key={i}>Faltou: {m}</li>
                      ))}
                    </ul>
                  )}
                </Alert>
              ) : (
                <Alert variant="info">Sem correção automática agora. Compare com a resposta-modelo abaixo.</Alert>
              )
            ) : current!.correct ? (
              <Alert variant="success" title="Você acertou!" />
            ) : (
              <Alert
                variant="error"
                title={`${current!.answer ? 'Resposta errada' : 'Tempo esgotado'}. Gabarito: ${item.type === 'certo_errado' ? (item.correctAnswer === 'certo' ? 'Certo' : 'Errado') : LETTERS[Number(item.correctAnswer)]}`}
              />
            )}
            {item.type === 'discursiva' && (
              <div className="rounded-xl border border-border bg-bg p-3">
                <p className="mb-1 text-xs font-semibold tracking-wide text-text-muted uppercase">Resposta-modelo</p>
                <p className="text-sm whitespace-pre-line text-text">{item.correctAnswer}</p>
              </div>
            )}
            <ItemExplanation item={item} chosen={current!.answer} />
            <SourceQuote subjectId={quiz.subjectId} item={item} />
          </div>
        )}
      </Card>

      {/* Ações */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" size="sm" onClick={contest} disabled={current?.contested} title="A questão ou o gabarito parecem errados? Ela não contará como erro.">
          <Flag className="size-4" /> {current?.contested ? 'Contestada' : 'Contestar questão'}
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          <span className="hidden text-xs text-text-muted sm:inline">
            {!current && hasOptions && 'A–E para escolher · Enter confirma'}
            {!current && item.type === 'certo_errado' && 'C ou E para escolher · Enter confirma'}
            {current && 'Enter para continuar'}
          </span>
          {!current ? (
            <Button onClick={() => confirm()} disabled={item.type === 'discursiva' ? !text.trim() || grading : !selected} loading={grading}>
              {item.type === 'discursiva' && reveal ? 'Corrigir com IA' : 'Confirmar'}
            </Button>
          ) : isLast ? (
            <Button onClick={finish}>
              Ver resultado <CheckCircle2 className="size-4" />
            </Button>
          ) : (
            <Button onClick={() => setIndex((i) => i + 1)} autoFocus>
              Próxima <ArrowRight className="size-4" />
            </Button>
          )}
        </div>
      </div>
      {!reveal && current && !isLast && (
        <p className="mt-2 text-right text-xs text-text-muted">
          <XCircle className="inline size-3 align-[-1px]" /> Modo prova: o gabarito aparece só no final.
        </p>
      )}
    </div>
  );
}
