import { BookOpenText, Briefcase, CalendarClock, ChevronRight, Flame, Lightbulb, NotebookPen, PenLine, Presentation, Scale, Sparkles, Target, type LucideIcon } from 'lucide-react';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardDescription, CardTitle } from '@/components/ui/Card';
import { useAuth } from '@/contexts/AuthContext';
import { useUpcomingEvents } from '@/hooks/useEvents';
import { usePracticeDays, type useGamification } from '@/hooks/useGamification';
import { useAttempts, useErrors } from '@/hooks/useQuestions';
import { useSimulations } from '@/hooks/useSimulator';
import { useAllSubjects } from '@/hooks/useStudyData';
import { dateKey } from '@/lib/dates';
import { personalRecs, type RecIcon } from '@/lib/personalRecs';
import { accuracyBy } from '@/lib/stats';
import { displayStreak } from '@/lib/streak';

const ICONS: Record<RecIcon, LucideIcon> = {
  prova: CalendarClock,
  erros: NotebookPen,
  fraca: Presentation,
  simulador: Scale,
  pratica: Briefcase,
  professora: Presentation,
  quiz: Sparkles,
  sequencia: Flame,
  rascunho: PenLine,
  missao: Target,
};

type G = NonNullable<ReturnType<typeof useGamification>['data']>;

/** "Para você": próximos passos personalizados entre todas as funções. */
export function ForYou({ g }: { g: G }) {
  const { profile } = useAuth();
  const today = dateKey();
  const subjects = useAllSubjects();
  const attempts = useAttempts();
  const errors = useErrors();
  const sims = useSimulations();
  const days = usePracticeDays();
  const upcoming = useUpcomingEvents(10);

  const recs = useMemo(() => {
    const names = new Map((subjects.data ?? []).map((s) => [s.id, s.name]));
    const acc = [...accuracyBy(attempts.data ?? [], (a) => a.subjectId)].filter(([id, a]) => a.total >= 3 && names.has(id)).sort((a, b) => a[1].pct - b[1].pct)[0];
    const pending = new Map<string, number>();
    for (const e of errors.data ?? []) if (!e.resolved && names.has(e.subjectId)) pending.set(e.subjectId, (pending.get(e.subjectId) ?? 0) + 1);
    const topErr = [...pending].sort((a, b) => b[1] - a[1])[0];
    const quizDays = g.activity.quizzes.map((q) => q.day).sort();
    return personalRecs({
      today,
      exams: (upcoming.data ?? []).filter((e) => e.type === 'prova' && !e.done),
      weakest: acc ? { subjectId: acc[0], name: names.get(acc[0])!, pct: acc[1].pct } : null,
      pendingErrors: topErr ? { subjectId: topErr[0], name: names.get(topErr[0])!, count: topErr[1] } : null,
      simulationRoles: [...new Set(g.activity.simulations.map((s) => s.role))],
      simulationDraftId: (sims.data ?? []).find((s) => s.status === 'rascunho' && s.text.trim())?.id ?? null,
      practiceInProgressId: (days.data ?? []).find((d) => d.status === 'em_andamento' && d.answers.some((a) => a.trim()))?.id ?? null,
      practiceDone: g.activity.practiceDays.length,
      decks: g.activity.decks.length,
      lastQuizDay: quizDays[quizDays.length - 1] ?? null,
      studiedToday: profile?.lastStudyDate === today,
      streak: displayStreak(profile?.streak ?? 0, profile?.lastStudyDate ?? null, today),
      missionsLeft: g.missions.filter((m) => !m.done).map((m) => ({ title: m.def.title, link: m.def.link })),
    });
  }, [g, subjects.data, attempts.data, errors.data, sims.data, days.data, upcoming.data, profile?.lastStudyDate, profile?.streak, today]);

  return (
    <Card className="p-5">
      <CardTitle className="flex items-center gap-2">
        <Lightbulb className="size-4 text-primary-text" /> Para você
      </CardTitle>
      <CardDescription className="mb-3">Próximos passos a partir do que você tem feito.</CardDescription>
      {!recs.length ? (
        <p className="flex items-center gap-2 py-4 text-sm text-text-muted">
          <BookOpenText className="size-4" /> Tudo em dia por aqui. Continue assim!
        </p>
      ) : (
        <ul className="space-y-1">
          {recs.map((r) => {
            const Icon = ICONS[r.icon];
            return (
              <li key={r.id}>
                <Link to={r.link} className="flex items-center gap-3 rounded-lg p-2 hover:bg-primary-soft/50">
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary-text">
                    <Icon className="size-4.5" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-text">{r.title}</span>
                    <span className="block text-xs text-text-muted">{r.reason}</span>
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-text-muted" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
