import { CheckCircle2, Clock, FileDown, Flame, ListChecks, RotateCcw, TrendingUp } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { BarList } from '@/components/charts/BarList';
import { axisProps, gridProps, tooltipProps } from '@/components/charts/chartTheme';
import { StatTile } from '@/components/charts/StatTile';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Card, CardDescription, CardTitle } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/Feedback';
import { Select } from '@/components/ui/Field';
import { ErrorBlock, LoadingBlock } from '@/components/ui/States';
import { useAuth } from '@/contexts/AuthContext';
import { useAttempts, useErrors, useLastResults, useQuestions } from '@/hooks/useQuestions';
import { useSessions } from '@/hooks/useStats';
import { useAllSubjects, useAllTopics, useProjects } from '@/hooks/useStudyData';
import { cn } from '@/lib/cn';
import { dateKey, formatMinutes } from '@/lib/dates';
import { categoryCounts } from '@/lib/errorStats';
import { newSession } from '@/lib/solveSession';
import { accuracyBy, attemptDay, dailySeries, inPeriod, minutesBy, overallAccuracy, reviewList } from '@/lib/stats';
import { displayStreak } from '@/lib/streak';
import { reviewSchedule } from '@/lib/review';

type Period = 7 | 30 | 90 | null;
const PERIODS: { value: Period; label: string }[] = [
  { value: 7, label: '7 dias' },
  { value: 30, label: '30 dias' },
  { value: 90, label: '90 dias' },
  { value: null, label: 'Tudo' },
];

export default function PerformancePage() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const attempts = useAttempts();
  const sessions = useSessions();
  const errors = useErrors();
  const questions = useQuestions();
  const last = useLastResults();
  const subjects = useAllSubjects();
  const topics = useAllTopics();
  const projects = useProjects();

  const [period, setPeriod] = useState<Period>(30);
  const [projectId, setProjectId] = useState('');
  const [topicSubjectId, setTopicSubjectId] = useState('');
  const today = dateKey();

  const subjectById = useMemo(() => new Map((subjects.data ?? []).map((s) => [s.id, s])), [subjects.data]);
  const topicById = useMemo(() => new Map((topics.data ?? []).map((t) => [t.id, t])), [topics.data]);
  const inProject = (subjectId: string) => !projectId || subjectById.get(subjectId)?.projectId === projectId;

  // Dados do período e do projeto escolhidos
  const A = useMemo(
    () => (attempts.data ?? []).filter((a) => inProject(a.subjectId) && inPeriod(attemptDay(a), period, today)),
    [attempts.data, projectId, period, today, subjectById], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const S = useMemo(
    () => (sessions.data ?? []).filter((s) => inProject(s.subjectId) && inPeriod(s.date, period, today)),
    [sessions.data, projectId, period, today, subjectById], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const E = useMemo(
    () =>
      (errors.data ?? []).filter(
        (e) => inProject(e.subjectId) && inPeriod(dateKey(e.createdAt?.toDate?.() ?? new Date()), period, today),
      ),
    [errors.data, projectId, period, today, subjectById], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const overall = overallAccuracy(A);
  const totalMinutes = S.reduce((s, x) => s + (x.minutes || 0), 0);
  const series = useMemo(() => dailySeries(A, Math.min(period ?? 90, 90), today), [A, period, today]);
  const bySubject = useMemo(() => accuracyBy(A, (a) => a.subjectId), [A]);
  const subjectIdsWithAttempts = [...bySubject.keys()];
  const topicSubject = topicSubjectId || subjectIdsWithAttempts[0] || '';
  const byTopic = useMemo(() => accuracyBy(A.filter((a) => a.subjectId === topicSubject), (a) => a.topicId), [A, topicSubject]);
  const minutesBySubject = useMemo(() => minutesBy(S, (s) => s.subjectId), [S]);
  // banca de cada questão (para "Acertos por banca")
  const byBoard = useMemo(() => {
    const board = new Map((questions.data ?? []).filter((q) => q.examBoard).map((q) => [q.id, q.examBoard!]));
    return accuracyBy(
      A.filter((a) => board.has(a.questionId)),
      (a) => board.get(a.questionId),
    );
  }, [A, questions.data]);
  const categories = useMemo(() => categoryCounts(E), [E]);
  // Revisão considera o histórico todo (erros pendentes não "vencem")
  const review = useMemo(
    () =>
      reviewList(
        (attempts.data ?? []).filter((a) => inProject(a.subjectId)),
        (errors.data ?? []).filter((e) => inProject(e.subjectId)),
      ).slice(0, 8),
    [attempts.data, errors.data, projectId, subjectById], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const schedule = useMemo(
    () => reviewSchedule((attempts.data ?? []).filter((a) => inProject(a.subjectId)), today),
    [attempts.data, projectId, today, subjectById], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const loading = attempts.isLoading || sessions.isLoading || errors.isLoading || subjects.isLoading;
  const failed = attempts.error || sessions.error || errors.error;
  if (loading) return <LoadingBlock label="Calculando seu desempenho…" />;
  if (failed) return <ErrorBlock error={failed} onRetry={() => (attempts.refetch(), sessions.refetch(), errors.refetch())} />;

  const nothingYet = !(attempts.data?.length || sessions.data?.length || errors.data?.length);
  const subjectName = (id: string) => subjectById.get(id)?.name ?? 'Matéria excluída';
  const streak = displayStreak(profile?.streak ?? 0, profile?.lastStudyDate ?? null, today);
  const hasDaily = series.some((p) => p.acertos + p.erros > 0);

  const redoWrong = (subjectId: string, topicId: string | null) => {
    const ids = (questions.data ?? [])
      .filter((q) => q.subjectId === subjectId && (topicId ? q.topicId === topicId : true) && last.get(q.id)?.result === 'errou')
      .map((q) => q.id);
    if (!ids.length) return navigate(`/materias/${subjectId}?aba=questoes`);
    newSession(ids, 'Revisão: refazer as erradas', '/desempenho');
    navigate('/questoes/resolver');
  };

  return (
    <>
      <PageHeader
        title="Desempenho"
        description="Acertos, tempo de estudo e o que precisa de revisão."
        actions={
          <ButtonLink to="/relatorios" variant="secondary">
            <FileDown className="size-4" /> Relatórios e exportação
          </ButtonLink>
        }
      />

      {/* Filtros (uma linha acima dos gráficos) */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border border-border bg-surface p-0.5" role="group" aria-label="Período">
          {PERIODS.map((p) => (
            <button
              key={p.label}
              type="button"
              aria-pressed={period === p.value}
              onClick={() => setPeriod(p.value)}
              className={cn('rounded-md px-3 py-1.5 text-sm font-medium', period === p.value ? 'bg-primary-soft text-primary-text' : 'text-text-muted hover:text-text')}
            >
              {p.label}
            </button>
          ))}
        </div>
        <Select value={projectId} onChange={(e) => setProjectId(e.target.value)} aria-label="Projeto" className="w-auto min-w-48">
          <option value="">Todos os projetos</option>
          {(projects.data ?? []).map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
      </div>

      {nothingYet ? (
        <Card>
          <EmptyState
            icon={TrendingUp}
            title="Ainda não há dados de desempenho"
            description="Resolva questões e use o timer de estudo: os gráficos aparecem aqui automaticamente."
            action={<Button onClick={() => navigate('/questoes')}>Ir para Questões</Button>}
          />
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Números de destaque */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile icon={ListChecks} label="Questões resolvidas" value={overall.total} hint={period ? `nos últimos ${period} dias` : 'em todo o período'} />
            <StatTile icon={CheckCircle2} label="Acertos" value={overall.total ? `${overall.pct}%` : '—'} hint={`${overall.correct} de ${overall.total}`} />
            <StatTile icon={Clock} label="Tempo estudado" value={formatMinutes(totalMinutes)} hint={`${S.length} ${S.length === 1 ? 'sessão' : 'sessões'}`} />
            <StatTile icon={Flame} label="Sequência" value={`${streak} ${streak === 1 ? 'dia' : 'dias'}`} hint="dias seguidos estudando" />
          </div>

          {/* Questões por dia */}
          <Card>
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <CardTitle>Questões resolvidas por dia</CardTitle>
              <div className="flex gap-4 text-xs text-text-muted" aria-hidden>
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-2.5 rounded-sm bg-success" /> Acertos
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-2.5 rounded-sm bg-error" /> Erros
                </span>
              </div>
            </div>
            {hasDaily ? (
              <>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={series} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                      <CartesianGrid {...gridProps} />
                      <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" minTickGap={16} />
                      <YAxis {...axisProps} allowDecimals={false} width={40} />
                      <Tooltip {...tooltipProps} />
                      <Bar dataKey="acertos" name="Acertos" stackId="q" fill="var(--success)" stroke="var(--surface)" strokeWidth={1} maxBarSize={28} />
                      <Bar dataKey="erros" name="Erros" stackId="q" fill="var(--error)" stroke="var(--surface)" strokeWidth={1} radius={[4, 4, 0, 0]} maxBarSize={28} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <details className="mt-2 text-sm">
                  <summary className="cursor-pointer text-xs text-text-muted hover:text-text">Ver dados em tabela</summary>
                  <div className="mt-2 max-h-56 overflow-y-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="text-text-muted">
                        <tr>
                          <th className="py-1 font-medium">Dia</th>
                          <th className="py-1 font-medium">Acertos</th>
                          <th className="py-1 font-medium">Erros</th>
                        </tr>
                      </thead>
                      <tbody className="text-text">
                        {series
                          .filter((p) => p.acertos + p.erros > 0)
                          .map((p) => (
                            <tr key={p.date} className="border-t border-border">
                              <td className="py-1">{p.label}</td>
                              <td className="py-1 tabular-nums">{p.acertos}</td>
                              <td className="py-1 tabular-nums">{p.erros}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              </>
            ) : (
              <p className="py-6 text-sm text-text-muted">Nenhuma questão resolvida neste período.</p>
            )}
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Acertos por matéria */}
            <Card>
              <CardTitle>Acertos por matéria</CardTitle>
              <CardDescription className="mb-4">Da mais fraca para a mais forte.</CardDescription>
              <BarList
                aria-label="Percentual de acertos por matéria"
                max={100}
                items={[...bySubject]
                  .sort((a, b) => a[1].pct - b[1].pct)
                  .map(([id, acc]) => ({
                    key: id,
                    label: subjectName(id),
                    swatch: subjectById.get(id)?.color,
                    value: acc.pct,
                    display: `${acc.pct}% · ${acc.total} ${acc.total === 1 ? 'questão' : 'questões'}`,
                  }))}
                emptyText="Nenhuma questão resolvida neste período."
              />
            </Card>

            {/* Acertos por assunto */}
            <Card>
              <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
                <div>
                  <CardTitle>Acertos por assunto</CardTitle>
                  <CardDescription>Dentro de uma matéria.</CardDescription>
                </div>
                {subjectIdsWithAttempts.length > 0 && (
                  <Select value={topicSubject} onChange={(e) => setTopicSubjectId(e.target.value)} aria-label="Matéria" className="h-9 w-auto max-w-56">
                    {subjectIdsWithAttempts.map((id) => (
                      <option key={id} value={id}>
                        {subjectName(id)}
                      </option>
                    ))}
                  </Select>
                )}
              </div>
              <BarList
                aria-label="Percentual de acertos por assunto"
                max={100}
                items={[...byTopic]
                  .sort((a, b) => a[1].pct - b[1].pct)
                  .map(([id, acc]) => ({
                    key: id,
                    label: topicById.get(id)?.name ?? 'Assunto excluído',
                    value: acc.pct,
                    display: `${acc.pct}% · ${acc.total}`,
                  }))}
                emptyText="As questões desta matéria ainda não têm assunto, ou não há questões no período."
              />
            </Card>

            {/* Acertos por banca (questões de prova) */}
            {byBoard.size > 0 && (
              <Card>
                <CardTitle>Acertos por banca</CardTitle>
                <CardDescription className="mb-4">Questões com a banca cadastrada (importadas de provas ou preenchidas por você).</CardDescription>
                <BarList
                  aria-label="Percentual de acertos por banca"
                  max={100}
                  items={[...byBoard]
                    .sort((a, b) => a[1].pct - b[1].pct)
                    .map(([board, acc]) => ({
                      key: board,
                      label: board,
                      value: acc.pct,
                      display: `${acc.pct}% · ${acc.total} ${acc.total === 1 ? 'questão' : 'questões'}`,
                    }))}
                />
              </Card>
            )}

            {/* Tempo por matéria */}
            <Card>
              <CardTitle>Tempo estudado por matéria</CardTitle>
              <CardDescription className="mb-4">Total: {formatMinutes(totalMinutes)}</CardDescription>
              <BarList
                aria-label="Minutos estudados por matéria"
                items={[...minutesBySubject]
                  .sort((a, b) => b[1] - a[1])
                  .map(([id, min]) => ({ key: id, label: subjectName(id), swatch: subjectById.get(id)?.color, value: min, display: formatMinutes(min) }))}
                emptyText="Use o timer de estudo (botão “Estudar”, no topo) para registrar seu tempo."
              />
            </Card>

            {/* Erros mais frequentes */}
            <Card>
              <CardTitle>Erros mais frequentes</CardTitle>
              <CardDescription className="mb-4">Motivos registrados no caderno de erros.</CardDescription>
              <BarList
                aria-label="Erros por categoria"
                items={categories.map((c) => ({ key: c.category, label: c.category, value: c.count, display: `${c.count} · ${c.percent}%` }))}
                emptyText="Nenhum erro registrado neste período."
              />
            </Card>
          </div>

          {/* Agenda de revisões (repetição espaçada) */}
          <Card>
            <CardTitle>Agenda de revisões</CardTitle>
            <CardDescription className="mb-4">
              Quando revisar cada assunto. O intervalo se adapta ao seu acerto: abaixo de 50% volta amanhã; com domínio, espaça para 7, 14 e 28 dias.
            </CardDescription>
            {schedule.length ? (
              <ul className="divide-y divide-border">
                {schedule.slice(0, 15).map((r) => (
                  <li key={r.topicId} className="flex flex-wrap items-center gap-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-text">{topicById.get(r.topicId)?.name ?? 'Assunto excluído'}</p>
                      <p className="text-xs text-text-muted">
                        {subjectName(r.subjectId)} · {r.accuracy}% de acerto · a cada {r.intervalDays} {r.intervalDays === 1 ? 'dia' : 'dias'}
                      </p>
                    </div>
                    <Badge variant={r.status === 'atrasada' ? 'error' : r.status === 'hoje' ? 'warning' : 'neutral'}>
                      {r.status === 'atrasada' ? 'Atrasada' : r.status === 'hoje' ? 'Hoje' : `${r.dueDay.slice(8, 10)}/${r.dueDay.slice(5, 7)}`}
                    </Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-4 text-sm text-text-muted">Resolva questões ligadas a assuntos para montar a agenda.</p>
            )}
          </Card>

          {/* Revisão */}
          <Card>
            <CardTitle>Conteúdos que precisam de revisão</CardTitle>
            <CardDescription className="mb-4">Assuntos com menos de 60% de acerto (mín. 3 questões) ou com erros não resolvidos.</CardDescription>
            {review.length ? (
              <ul className="divide-y divide-border">
                {review.map((r) => (
                  <li key={`${r.subjectId}-${r.topicId}`} className="flex flex-wrap items-center gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-text">
                        {r.topicId ? (topicById.get(r.topicId)?.name ?? 'Assunto excluído') : 'Sem assunto definido'}
                      </p>
                      <p className="text-xs text-text-muted">{subjectName(r.subjectId)}</p>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {r.total >= 3 && r.pct < 60 && <Badge variant="warning">{r.pct}% de acerto</Badge>}
                      {r.unresolved > 0 && (
                        <Badge variant="error">
                          {r.unresolved} {r.unresolved === 1 ? 'erro pendente' : 'erros pendentes'}
                        </Badge>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => redoWrong(r.subjectId, r.topicId)}>
                        <RotateCcw className="size-4" /> Refazer erradas
                      </Button>
                      <Link to={`/materias/${r.subjectId}`} className="inline-flex h-8 items-center rounded-lg px-3 text-sm font-medium text-primary-text hover:bg-primary-soft">
                        Abrir matéria
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-4 text-sm text-success">Nada pendente de revisão. Continue assim!</p>
            )}
          </Card>
        </div>
      )}
    </>
  );
}
