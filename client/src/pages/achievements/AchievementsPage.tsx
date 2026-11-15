import { Award, CalendarRange, Lock, Sparkles, Target, Trophy } from 'lucide-react';
import { LevelCard } from '@/components/gamification/LevelCard';
import { MissionList } from '@/components/gamification/MissionList';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardTitle } from '@/components/ui/Card';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { ErrorBlock, LoadingBlock } from '@/components/ui/States';
import { useGamification, useGamificationSync } from '@/hooks/useGamification';
import { cn } from '@/lib/cn';
import { XP_RULES } from '@/lib/gamification';

const RULES: [string, string][] = [
  ['Questão resolvida', `${XP_RULES.attempt} XP (+${XP_RULES.correct} se acertar)`],
  ['Minuto de estudo registrado', `${XP_RULES.minute} XP`],
  ['Quiz com IA terminado', `${XP_RULES.quiz} XP + nota ÷ 10`],
  ['Peça corrigida no Simulador', `${XP_RULES.simulation} XP + nota ÷ 2`],
  ['Dia na prática jurídica', `${XP_RULES.practiceDay} XP + nota ÷ 2`],
  ['Apresentação criada', `${XP_RULES.deck} XP`],
  ['Erro resolvido no caderno', `${XP_RULES.errorResolved} XP`],
  ['Missão diária cumprida', `${XP_RULES.mission} XP`],
  ['Desafio semanal cumprido', `${XP_RULES.weekly} XP`],
];

/** Gamificação: nível, missões diárias, desafio semanal e conquistas. */
export default function AchievementsPage() {
  const { data: g, isLoading, error } = useGamification();
  useGamificationSync(g);

  if (isLoading) return <LoadingBlock label="Somando o seu XP…" />;
  if (error || !g) return <ErrorBlock error={error} />;
  const unlocked = g.achievements.filter((a) => a.unlocked);
  const locked = g.achievements.filter((a) => !a.unlocked).sort((a, b) => b.pct - a.pct);
  const numbers: [string, string | number][] = [
    ['Questões', g.lifetime.questions],
    ['Horas de estudo', Math.floor(g.lifetime.minutes / 60)],
    ['Quizzes', g.lifetime.quizzes],
    ['Peças corrigidas', g.lifetime.simulations],
    ['Maior sequência', `${g.lifetime.longestStreak} dias`],
    ['Missões cumpridas', g.missionsDone],
  ];

  return (
    <>
      <PageHeader title="Conquistas e missões" description="Cada coisa que você estuda vira XP. Cumpra as missões do dia e o desafio da semana para subir mais rápido." />
      <div className="mb-6 grid gap-5 lg:grid-cols-2">
        <LevelCard g={g} />
        <div className="space-y-5">
          <Card className="p-5">
            <CardTitle className="mb-1 flex items-center gap-2">
              <CalendarRange className="size-4 text-primary-text" /> Desafio da semana
            </CardTitle>
            <p className="mb-3 text-xs text-text-muted">Muda todo domingo.</p>
            <MissionList missions={[g.weekly]} reward={XP_RULES.weekly} />
          </Card>
          <Card className="p-5">
            <CardTitle className="mb-3 flex items-center gap-2">
              <Target className="size-4 text-primary-text" /> Seus números
            </CardTitle>
            <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
              {numbers.map(([k, v]) => (
                <div key={k}>
                  <dt className="text-xs text-text-muted">{k}</dt>
                  <dd className="text-lg font-bold text-text tabular-nums">{v}</dd>
                </div>
              ))}
            </dl>
          </Card>
        </div>
      </div>

      <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-text">
        <Trophy className="size-4.5 text-primary-text" /> Conquistas ({unlocked.length}/{g.achievements.length})
      </h2>
      <ul className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[...unlocked, ...locked].map((a) => (
          <li key={a.def.id} className={cn('flex gap-3 rounded-xl border p-4', a.unlocked ? 'border-primary/40 bg-primary-soft/50' : 'border-border bg-surface')}>
            <span className={cn('grid size-10 shrink-0 place-items-center rounded-full', a.unlocked ? 'bg-primary text-on-primary' : 'border border-border bg-surface-elevated text-text-muted')}>
              {a.unlocked ? <Award className="size-5" aria-hidden /> : <Lock className="size-4" aria-hidden />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-text">
                {a.def.title}
                <span className="sr-only">{a.unlocked ? ' (desbloqueada)' : ' (bloqueada)'}</span>
              </p>
              <p className="text-xs text-text-muted">{a.def.description}</p>
              {!a.unlocked && (
                <div className="mt-2 flex items-center gap-2">
                  <ProgressBar value={a.pct} className="h-1.5" label={`Progresso: ${a.def.title}`} />
                  <span className="shrink-0 text-xs text-text-muted tabular-nums">{Math.round(a.pct)}%</span>
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>

      <Card className="p-5">
        <CardTitle className="mb-3 flex items-center gap-2">
          <Sparkles className="size-4 text-primary-text" /> Como ganhar XP
        </CardTitle>
        <dl className="divide-y divide-border text-sm">
          {RULES.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3 py-2">
              <dt className="text-text">{k}</dt>
              <dd className="text-right text-text-muted">{v}</dd>
            </div>
          ))}
        </dl>
      </Card>
    </>
  );
}
