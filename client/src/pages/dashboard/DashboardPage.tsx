import { format, startOfWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ArrowRight, CalendarDays, CheckCircle2, Clock, Flame, FolderKanban, ListChecks, Pencil, Sparkles, Target, Timer, Zap } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { EVENT_META } from '@/components/calendar/eventMeta';
import { StatTile } from '@/components/charts/StatTile';
import { GoalsModal } from '@/components/dashboard/GoalsModal';
import { QuickStudyModal } from '@/components/dashboard/QuickStudyModal';
import { RecommendModal } from '@/components/dashboard/RecommendModal';
import { useDashboardData } from '@/components/dashboard/useDashboardData';
import { Badge } from '@/components/ui/Badge';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Card, CardDescription, CardTitle } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/Feedback';
import { IconTile } from '@/components/ui/IconTile';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { LoadingBlock } from '@/components/ui/States';
import { useAuth } from '@/contexts/AuthContext';
import { useUpcomingEvents } from '@/hooks/useEvents';
import { useGoals } from '@/hooks/useStats';
import { useProgress } from '@/hooks/useStudyData';
import { fromKey, toKey, WEEK_STARTS_ON } from '@/lib/calendar';
import { addDaysToKey, formatMinutes } from '@/lib/dates';
import { attemptDay, overallAccuracy } from '@/lib/stats';
import { displayStreak } from '@/lib/streak';

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
};

/** "hoje", "ontem", "há 3 dias" */
function relativeDay(day: string, today: string) {
  if (day === today) return 'hoje';
  if (day === addDaysToKey(today, -1)) return 'ontem';
  const diff = Math.round((fromKey(today).getTime() - fromKey(day).getTime()) / 86_400_000);
  return `há ${diff} dias`;
}

/** "hoje", "amanhã", "em 3 dias", "sáb, 21/11" */
function untilLabel(day: string, today: string) {
  if (day === today) return 'Hoje';
  if (day === addDaysToKey(today, 1)) return 'Amanhã';
  const diff = Math.round((fromKey(day).getTime() - fromKey(today).getTime()) / 86_400_000);
  return diff <= 7 ? `Em ${diff} dias` : format(fromKey(day), "EEE, dd/MM", { locale: ptBR });
}

export default function DashboardPage() {
  const { profile, user } = useAuth();
  const data = useDashboardData();
  const { byProject } = useProgress();
  const goals = useGoals();
  const upcoming = useUpcomingEvents(5);
  const [recommendOpen, setRecommendOpen] = useState(false);
  const [quick, setQuick] = useState<number | null>(null);
  const [goalsOpen, setGoalsOpen] = useState(false);

  const { today } = data;
  const weekStart = toKey(startOfWeek(fromKey(today), { weekStartsOn: WEEK_STARTS_ON }));
  const attempts = data.attempts.data ?? [];
  const sessions = data.sessions.data ?? [];

  const stats = useMemo(() => {
    const todayAttempts = attempts.filter((a) => attemptDay(a) === today);
    const weekAttempts = attempts.filter((a) => attemptDay(a) >= weekStart);
    const minutesToday = sessions.filter((s) => s.date === today).reduce((t, s) => t + s.minutes, 0);
    const minutesWeek = sessions.filter((s) => s.date >= weekStart).reduce((t, s) => t + s.minutes, 0);
    return { todayQ: todayAttempts.length, weekQ: weekAttempts.length, minutesToday, minutesWeek, overall: overallAccuracy(attempts) };
  }, [attempts, sessions, today, weekStart]);

  // Matérias estudadas recentemente (sessões e questões), mais recentes primeiro
  const recent = useMemo(() => {
    const lastDay = new Map<string, string>();
    const bump = (subjectId: string, day: string) => {
      if ((lastDay.get(subjectId) ?? '') < day) lastDay.set(subjectId, day);
    };
    sessions.forEach((s) => bump(s.subjectId, s.date));
    attempts.forEach((a) => bump(a.subjectId, attemptDay(a)));
    const byId = new Map((data.subjects.data ?? []).map((s) => [s.id, s]));
    return [...lastDay]
      .filter(([id]) => byId.has(id))
      .sort((a, b) => b[1].localeCompare(a[1]))
      .slice(0, 5)
      .map(([id, day]) => ({ subject: byId.get(id)!, day }));
  }, [sessions, attempts, data.subjects.data]);

  if (data.loading) return <LoadingBlock label="Montando seu painel…" />;

  const name = (profile?.name || user?.displayName || '').split(' ')[0];
  const streak = displayStreak(profile?.streak ?? 0, profile?.lastStudyDate ?? null, today);
  const studiedToday = profile?.lastStudyDate === today;
  const activeProjects = (data.projects.data ?? []).filter((p) => !p.archived);
  const goal = (period: 'diaria' | 'semanal', metric: 'minutos' | 'questoes') =>
    goals.data?.find((g) => g.period === period && g.metric === metric)?.target ?? 0;
  const goalRows = [
    { label: 'Hoje — tempo', value: stats.minutesToday, target: profile?.settings?.dailyGoalMinutes ?? 0, fmt: formatMinutes },
    { label: 'Hoje — questões', value: stats.todayQ, target: goal('diaria', 'questoes'), fmt: (n: number) => String(n) },
    { label: 'Semana — tempo', value: stats.minutesWeek, target: goal('semanal', 'minutos'), fmt: formatMinutes },
    { label: 'Semana — questões', value: stats.weekQ, target: goal('semanal', 'questoes'), fmt: (n: number) => String(n) },
  ].filter((g) => g.target > 0);
  const top = data.recommendations[0];

  if (!activeProjects.length) {
    return (
      <>
        <h1 className="mb-6 text-2xl font-bold text-text">
          {greeting()}
          {name ? `, ${name}` : ''}!
        </h1>
        <Card>
          <EmptyState
            icon={FolderKanban}
            title="Vamos começar?"
            description="Crie seu primeiro projeto (faculdade, OAB, concurso…) e adicione as matérias. Depois é só enviar materiais, criar questões e usar o timer."
            action={<ButtonLink to="/projetos">Criar primeiro projeto</ButtonLink>}
          />
        </Card>
      </>
    );
  }

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text">
          {greeting()}
          {name ? `, ${name}` : ''}!
        </h1>
        <p className="mt-1 text-text-muted capitalize">{format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })}</p>
      </div>

      {/* O que estudar + estudo rápido */}
      <Card className="mb-6 grid gap-5 border-primary/40 bg-linear-to-br from-primary-soft to-surface md:grid-cols-[1fr_auto] md:items-center">
        <div className="flex items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary text-on-primary">
            <Sparkles className="size-5" />
          </span>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-text">O que devo estudar agora?</h2>
            {top ? (
              <p className="text-sm text-text-muted">
                Sugestão: <strong className="text-text">{top.subject.name}</strong> — {top.reason}
              </p>
            ) : (
              <p className="text-sm text-text-muted">Adicione matérias para receber sugestões.</p>
            )}
            <Button className="mt-3" onClick={() => setRecommendOpen(true)}>
              Ver sugestões <ArrowRight className="size-4" />
            </Button>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-bg/60 p-3">
          <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-text">
            <Zap className="size-4 text-primary-text" /> Estudo rápido
          </p>
          <div className="flex gap-2">
            {[5, 10, 15].map((m) => (
              <Button key={m} variant="secondary" onClick={() => setQuick(m)} aria-label={`Estudo rápido de ${m} minutos`}>
                <Timer className="size-4" /> {m} min
              </Button>
            ))}
          </div>
        </div>
      </Card>

      {/* Números */}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          icon={Flame}
          label="Sequência"
          value={`${streak} ${streak === 1 ? 'dia' : 'dias'}`}
          hint={studiedToday ? 'Você já estudou hoje ✓' : streak ? 'Estude hoje para não perder!' : 'Comece hoje'}
        />
        <StatTile icon={Clock} label="Estudado hoje" value={formatMinutes(stats.minutesToday)} hint={`${formatMinutes(stats.minutesWeek)} nesta semana`} />
        <StatTile icon={ListChecks} label="Questões resolvidas" value={stats.overall.total} hint={`${stats.weekQ} nesta semana`} />
        <StatTile icon={CheckCircle2} label="Acerto geral" value={stats.overall.total ? `${stats.overall.pct}%` : '—'} hint={<Link to="/desempenho" className="text-primary-text hover:underline">Ver desempenho</Link>} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Metas */}
        <Card>
          <div className="mb-4 flex items-start justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Target className="size-4 text-primary-text" /> Metas
              </CardTitle>
              <CardDescription>Do dia e da semana.</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setGoalsOpen(true)}>
              <Pencil className="size-3.5" /> Editar
            </Button>
          </div>
          {goalRows.length ? (
            <ul className="space-y-4">
              {goalRows.map((g) => {
                const pct = Math.min(100, (g.value / g.target) * 100);
                const done = g.value >= g.target;
                return (
                  <li key={g.label}>
                    <div className="mb-1 flex justify-between gap-2 text-sm">
                      <span className="text-text">{g.label}</span>
                      <span className={done ? 'font-medium text-success' : 'text-text-muted'}>
                        {g.fmt(g.value)} / {g.fmt(g.target)} {done && '✓'}
                      </span>
                    </div>
                    <ProgressBar value={pct} tone={done ? 'success' : 'primary'} label={g.label} />
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-text-muted">
              Nenhuma meta definida.{' '}
              <button type="button" onClick={() => setGoalsOpen(true)} className="font-medium text-primary-text hover:underline">
                Definir metas
              </button>
            </p>
          )}
        </Card>

        {/* Próximos eventos */}
        <Card>
          <div className="mb-4 flex items-start justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CalendarDays className="size-4 text-primary-text" /> Próximos eventos
              </CardTitle>
              <CardDescription>Estudos, revisões e provas.</CardDescription>
            </div>
            <ButtonLink to="/calendario" variant="ghost" size="sm">
              Calendário
            </ButtonLink>
          </div>
          {upcoming.data?.length ? (
            <ul className="space-y-2">
              {upcoming.data.map((e) => {
                const meta = EVENT_META[e.type];
                const Icon = meta.icon;
                return (
                  <li key={e.id}>
                    <Link to={`/calendario?data=${e.date}`} className="flex items-center gap-3 rounded-lg p-2 hover:bg-primary-soft">
                      <Icon className="size-4 shrink-0" style={{ color: meta.color }} aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-text">{e.title}</span>
                        <span className="text-xs text-text-muted">
                          {meta.label}
                          {e.time && ` · ${e.time}`}
                        </span>
                      </span>
                      <Badge variant={e.type === 'prova' ? 'warning' : e.date === today ? 'primary' : 'neutral'}>{untilLabel(e.date, today)}</Badge>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-text-muted">
              Nada agendado.{' '}
              <Link to="/calendario" className="font-medium text-primary-text hover:underline">
                Planejar estudos
              </Link>
            </p>
          )}
        </Card>

        {/* Projetos em andamento */}
        <Card>
          <div className="mb-4 flex items-start justify-between gap-2">
            <CardTitle className="flex items-center gap-2">
              <FolderKanban className="size-4 text-primary-text" /> Projetos em andamento
            </CardTitle>
            <ButtonLink to="/projetos" variant="ghost" size="sm">
              Ver todos
            </ButtonLink>
          </div>
          <ul className="space-y-3">
            {activeProjects.slice(0, 4).map((p) => {
              const prog = byProject.get(p.id);
              return (
                <li key={p.id}>
                  <Link to={`/projetos/${p.id}`} className="flex items-center gap-3 rounded-lg p-1 hover:bg-primary-soft/50">
                    <IconTile icon={p.icon} color={p.color} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="mb-1 flex justify-between gap-2 text-sm">
                        <span className="truncate font-medium text-text">{p.name}</span>
                        <span className="shrink-0 text-text-muted">{prog?.percent ?? 0}%</span>
                      </span>
                      <ProgressBar value={prog?.percent ?? 0} label={`Progresso de ${p.name}`} />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>

        {/* Matérias recentes */}
        <Card>
          <CardTitle className="mb-4 flex items-center gap-2">
            <Clock className="size-4 text-primary-text" /> Estudadas recentemente
          </CardTitle>
          {recent.length ? (
            <ul className="space-y-1">
              {recent.map(({ subject, day }) => (
                <li key={subject.id}>
                  <Link to={`/materias/${subject.id}`} className="flex items-center gap-3 rounded-lg p-2 hover:bg-primary-soft">
                    <IconTile icon={subject.icon} color={subject.color} size="sm" />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-text">{subject.name}</span>
                    <span className="shrink-0 text-xs text-text-muted">{relativeDay(day, today)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-text-muted">Use o timer ou resolva questões — suas matérias recentes aparecem aqui.</p>
          )}
        </Card>
      </div>

      <RecommendModal
        open={recommendOpen}
        onClose={() => setRecommendOpen(false)}
        recommendations={data.recommendations}
        suggestedQuestions={data.suggestedQuestions}
        pendingErrorCount={(id) => data.pendingErrors(id).length}
      />
      <QuickStudyModal
        minutes={quick}
        onClose={() => setQuick(null)}
        defaultSubjectId={top?.subject.id}
        suggestedQuestions={data.suggestedQuestions}
        pendingErrorCount={(id) => data.pendingErrors(id).length}
      />
      <GoalsModal open={goalsOpen} onClose={() => setGoalsOpen(false)} goals={goals.data ?? []} />
    </>
  );
}
