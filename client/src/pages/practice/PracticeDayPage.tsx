import { useQuery, useQueryClient } from '@tanstack/react-query';
import { deleteDoc, getDoc, updateDoc } from 'firebase/firestore';
import {
  ArrowLeft,
  ArrowRight,
  Briefcase,
  CheckCircle2,
  Clock,
  FileText,
  Gavel,
  Mail,
  MessagesSquare,
  Search,
  Timer,
  Trash2,
  UserRound,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/PageHeader';
import { AiProgress, isStaleJob } from '@/components/ui/AiProgress';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { Button } from '@/components/ui/Button';
import { Card, CardTitle } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Textarea } from '@/components/ui/Field';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { ErrorBlock, LoadingBlock } from '@/components/ui/States';
import { useUid } from '@/hooks/useUid';
import { cn } from '@/lib/cn';
import { friendlyError } from '@/lib/firebaseErrors';
import { scoreTone } from '@/lib/simulator';
import { docWithId, userDoc } from '@/services/firebase/db';
import { evaluatePracticeDay } from '@/services/practice';
import type { PracticeDay, PracticeTaskKind } from '@/types/models';
import NotFound from '../NotFound';
import { CAREER_LABELS } from './PracticeHome';

const KIND: Record<PracticeTaskKind, { icon: LucideIcon; label: string }> = {
  atendimento: { icon: UserRound, label: 'Atendimento' },
  prazo: { icon: Timer, label: 'Prazo' },
  audiencia: { icon: Gavel, label: 'Audiência' },
  redacao: { icon: FileText, label: 'Redação' },
  email: { icon: Mail, label: 'E-mail' },
  pesquisa: { icon: Search, label: 'Pesquisa' },
  decisao: { icon: Gavel, label: 'Decisão' },
  reuniao: { icon: Users, label: 'Reunião' },
};
const toneText = { success: 'text-success', warning: 'text-warning', error: 'text-error' } as const;

export default function PracticeDayPage() {
  const { dayId = '' } = useParams();
  const uid = useUid();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const day = useQuery({
    queryKey: ['practiceDay', uid, dayId],
    queryFn: async () => docWithId<PracticeDay>(await getDoc(userDoc(uid, 'practiceDays', dayId))),
    // enquanto a IA trabalha, relê a cada 4 s
    refetchInterval: (q) => (q.state.data?.status === 'gerando' || q.state.data?.status === 'avaliando' ? 4000 : false),
  });
  const [deleting, setDeleting] = useState(false);

  if (day.isLoading) return <LoadingBlock label="Abrindo o expediente…" />;
  if (day.isError) return <ErrorBlock error={day.error} onRetry={() => day.refetch()} />;
  if (!day.data) return <NotFound />;
  const d = day.data;

  return (
    <>
      <Breadcrumb items={[{ label: 'Um dia na prática', to: '/pratica' }, { label: d.title }]} />
      <PageHeader
        title={d.title}
        description={d.intro}
        actions={
          <Button variant="danger" size="icon" onClick={() => setDeleting(true)} aria-label="Excluir este dia">
            <Trash2 className="size-4" />
          </Button>
        }
      />
      <div className="mb-4 flex flex-wrap gap-1.5">
        <Badge variant="primary">{CAREER_LABELS[d.career]}</Badge>
      </div>
      {d.status === 'gerando' && !isStaleJob(d.jobStartedAt) ? (
        <AiProgress
          title="Montando a agenda do seu dia…"
          startedAt={d.jobStartedAt}
          typicalSec={45}
          steps={['Escolhendo os clientes e os processos…', 'Marcando os horários…', 'Escrevendo cada situação…']}
        />
      ) : d.status === 'erro' || d.status === 'gerando' ? (
        <Alert variant="error" title="A agenda não foi montada">
          {d.error ?? 'A geração demorou demais e foi interrompida.'} O uso da IA foi devolvido. Exclua este dia (lixeira acima) e comece outro.
        </Alert>
      ) : d.status === 'avaliando' && !isStaleJob(d.jobStartedAt) ? (
        <AiProgress
          title="Avaliando o seu expediente…"
          startedAt={d.jobStartedAt}
          typicalSec={50}
          steps={['Lendo as suas respostas…', 'Dando nota a cada tarefa…', 'Escrevendo as respostas ideais…']}
        />
      ) : d.status === 'concluido' && d.evaluation ? (
        <Results day={d} />
      ) : (
        <>
          {d.evaluationError && (
            <Alert variant="error" title="A avaliação não terminou" className="mb-4">
              {d.evaluationError} As suas respostas continuam salvas; é só encerrar o expediente de novo.
            </Alert>
          )}
          <Workday day={d} onDone={() => day.refetch()} />
        </>
      )}
      <ConfirmDialog
        open={deleting}
        onClose={() => setDeleting(false)}
        title="Excluir este dia?"
        confirmLabel="Excluir"
        danger
        onConfirm={async () => {
          try {
            await deleteDoc(userDoc(uid, 'practiceDays', dayId));
            qc.invalidateQueries({ queryKey: ['practiceDays', uid] });
            navigate('/pratica');
          } catch (err) {
            toast.error(friendlyError(err));
          }
        }}
      />
    </>
  );
}

/** O expediente: agenda à esquerda, tarefa atual à direita, respostas salvas sozinhas. */
function Workday({ day, onDone }: { day: PracticeDay; onDone: () => void }) {
  const uid = useUid();
  const qc = useQueryClient();
  const firstOpen = Math.max(0, day.answers.findIndex((a) => !a.trim()));
  const [current, setCurrent] = useState(firstOpen);
  const [answers, setAnswers] = useState<string[]>(() => day.tasks.map((_, i) => day.answers[i] ?? ''));
  const [saved, setSaved] = useState(true);
  const [confirm, setConfirm] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const latest = useRef(answers);
  latest.current = answers;

  const save = async () => {
    await updateDoc(userDoc(uid, 'practiceDays', day.id), { answers: latest.current });
    setSaved(true);
  };

  useEffect(() => {
    if (saved) return;
    const t = window.setTimeout(() => save().catch(() => toast.error('Não foi possível salvar a resposta.')), 1200);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answers, saved]);

  const finish = async () => {
    setEvaluating(true);
    try {
      await save();
      // o server responde na hora; a avaliação roda em segundo plano
      await evaluatePracticeDay(day.id);
      qc.invalidateQueries({ queryKey: ['practiceDays', uid] });
      onDone();
    } catch (err) {
      toast.error(friendlyError(err, 'Não foi possível enviar o dia para avaliação.'));
      setEvaluating(false);
    }
  };

  const task = day.tasks[current]!;
  const kind = KIND[task.kind] ?? KIND.atendimento;
  const answered = answers.filter((a) => a.trim()).length;
  const isLast = current === day.tasks.length - 1;

  return (
    <div className="grid gap-5 lg:grid-cols-[16rem_1fr]">
      <nav aria-label="Agenda do dia">
        <ProgressBar value={(answered / day.tasks.length) * 100} label="Tarefas respondidas" className="mb-2" />
        <p className="mb-3 text-xs text-text-muted">
          {answered} de {day.tasks.length} tarefas respondidas
        </p>
        <ol className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">
          {day.tasks.map((t, i) => {
            const K = KIND[t.kind] ?? KIND.atendimento;
            const done = !!answers[i]?.trim();
            return (
              <li key={i} className="shrink-0">
                <button
                  type="button"
                  onClick={() => setCurrent(i)}
                  aria-current={i === current ? 'step' : undefined}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors',
                    i === current ? 'border-primary bg-primary-soft' : 'border-border bg-surface hover:bg-primary-soft/40',
                  )}
                >
                  <span className="font-semibold text-text-muted tabular-nums">{t.time}</span>
                  <K.icon className="size-4 shrink-0 text-primary-text" aria-hidden />
                  <span className="hidden flex-1 truncate text-text lg:block">{t.title}</span>
                  {done && <CheckCircle2 className="size-4 shrink-0 text-success" aria-label="respondida" />}
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      <Card className="space-y-4 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="primary">
            <Clock className="mr-1 size-3" /> {task.time}
          </Badge>
          <Badge variant="neutral">
            <kind.icon className="mr-1 size-3" /> {kind.label}
          </Badge>
          <Badge variant="neutral">{task.size === 'curta' ? 'Resposta curta' : 'Resposta média'}</Badge>
        </div>
        <h2 className="text-lg font-semibold text-text">{task.title}</h2>
        <p className="text-sm leading-relaxed whitespace-pre-wrap text-text">{task.context}</p>
        <Alert variant="info" title="Sua tarefa">
          {task.prompt}
        </Alert>
        <Textarea
          value={answers[current]}
          onChange={(e) => {
            const v = e.target.value.slice(0, 8000);
            setAnswers((prev) => prev.map((a, i) => (i === current ? v : a)));
            setSaved(false);
          }}
          rows={task.size === 'curta' ? 6 : 14}
          aria-label={`Resposta da tarefa das ${task.time}`}
          placeholder="Escreva a sua resposta…"
          className="text-[15px] leading-relaxed"
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-text-muted" aria-live="polite">
            {saved ? 'Resposta salva' : 'Salvando…'}
          </span>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setCurrent((c) => c - 1)} disabled={current === 0}>
              <ArrowLeft className="size-4" /> Anterior
            </Button>
            {isLast ? (
              <Button onClick={() => setConfirm(true)} disabled={!answered} loading={evaluating}>
                <Briefcase className="size-4" /> Encerrar o expediente
              </Button>
            ) : (
              <Button onClick={() => setCurrent((c) => c + 1)}>
                Próxima <ArrowRight className="size-4" />
              </Button>
            )}
          </div>
        </div>
        {!isLast && answered > 0 && (
          <button type="button" onClick={() => setConfirm(true)} className="text-xs text-text-muted underline hover:text-text">
            Encerrar o expediente agora
          </button>
        )}
      </Card>

      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Encerrar o expediente?"
        description={
          answered < day.tasks.length
            ? `Você respondeu ${answered} de ${day.tasks.length} tarefas. As que ficaram em branco valem zero.`
            : 'A IA vai avaliar todas as tarefas. Depois disso, as respostas não podem mais ser editadas.'
        }
        confirmLabel="Encerrar e avaliar"
        onConfirm={() => {
          setConfirm(false);
          void finish();
        }}
      />
    </div>
  );
}

function Results({ day }: { day: PracticeDay }) {
  const ev = day.evaluation!;
  const score = day.score ?? 0;
  return (
    <div className="space-y-5">
      <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
        <div className="flex items-baseline gap-1">
          <span className={cn('text-5xl font-bold tabular-nums', toneText[scoreTone(score)])}>{score}</span>
          <span className="text-lg text-text-muted">/100</span>
        </div>
        <p className="flex-1 text-sm text-text">{ev.summary}</p>
      </Card>
      <div className="grid gap-5 md:grid-cols-2">
        {ev.strengths.length > 0 && (
          <Card className="p-5">
            <CardTitle className="mb-2">O que foi bem</CardTitle>
            <ul className="list-disc space-y-1 pl-5 text-sm text-text">
              {ev.strengths.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </Card>
        )}
        {ev.toImprove.length > 0 && (
          <Card className="p-5">
            <CardTitle className="mb-2">O que estudar</CardTitle>
            <ul className="list-disc space-y-1 pl-5 text-sm text-text">
              {ev.toImprove.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </Card>
        )}
      </div>
      <ol className="space-y-4">
        {day.tasks.map((t, i) => {
          const r = ev.perTask[i];
          const K = KIND[t.kind] ?? KIND.atendimento;
          return (
            <li key={i}>
              <Card className="space-y-3 p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-text-muted tabular-nums">{t.time}</span>
                  <K.icon className="size-4 text-primary-text" aria-hidden />
                  <span className="flex-1 font-semibold text-text">{t.title}</span>
                  {r && <span className={cn('font-bold tabular-nums', toneText[scoreTone(r.score * 10)])}>{r.score.toLocaleString('pt-BR')}/10</span>}
                </div>
                <details>
                  <summary className="cursor-pointer text-xs text-text-muted">Ver a situação</summary>
                  <p className="mt-1 text-sm whitespace-pre-wrap text-text">{t.context}</p>
                  <p className="mt-1 text-sm font-medium text-text">{t.prompt}</p>
                </details>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-lg border border-border p-3">
                    <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-text-muted uppercase">
                      <MessagesSquare className="size-3.5" /> Sua resposta
                    </p>
                    <p className="text-sm whitespace-pre-wrap text-text">{day.answers[i]?.trim() || <em className="text-text-muted">(sem resposta)</em>}</p>
                  </div>
                  <div className="rounded-lg bg-success/8 p-3">
                    <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-success uppercase">
                      <CheckCircle2 className="size-3.5" /> Resposta ideal
                    </p>
                    <p className="text-sm whitespace-pre-wrap text-text">{r?.ideal}</p>
                  </div>
                </div>
                {r && <p className="text-sm text-text-muted">{r.feedback}</p>}
              </Card>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
