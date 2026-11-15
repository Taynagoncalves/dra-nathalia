import { useMemo } from 'react';
import { useAttempts, useErrors, useLastResults, useQuestions } from '@/hooks/useQuestions';
import { useSessions } from '@/hooks/useStats';
import { useAllSubjects, useProjects } from '@/hooks/useStudyData';
import { dateKey } from '@/lib/dates';
import { recommend } from '@/lib/recommend';

/** Dados compartilhados pelo dashboard, pela recomendação e pelo estudo rápido. */
export function useDashboardData() {
  const projects = useProjects();
  const subjects = useAllSubjects();
  const attempts = useAttempts();
  const errors = useErrors();
  const sessions = useSessions();
  const questions = useQuestions();
  const last = useLastResults();
  const today = dateKey();

  // Só matérias de projetos ativos (não arquivados)
  const activeSubjects = useMemo(() => {
    const active = new Set((projects.data ?? []).filter((p) => !p.archived).map((p) => p.id));
    return (subjects.data ?? []).filter((s) => active.has(s.projectId));
  }, [projects.data, subjects.data]);

  const recommendations = useMemo(
    () =>
      recommend({
        subjects: activeSubjects,
        attempts: attempts.data ?? [],
        errors: errors.data ?? [],
        sessions: sessions.data ?? [],
        today,
      }),
    [activeSubjects, attempts.data, errors.data, sessions.data, today],
  );

  /** Questões sugeridas para a matéria: primeiro as erradas, depois as nunca feitas, depois o resto. */
  const suggestedQuestions = (subjectId: string, max: number) => {
    const qs = (questions.data ?? []).filter((q) => q.subjectId === subjectId);
    const rank = (id: string) => ({ errou: 0, nunca: 1, acertou: 2 })[last.get(id)?.result ?? 'nunca'];
    return [...qs].sort((a, b) => rank(a.id) - rank(b.id)).slice(0, max);
  };

  const pendingErrors = (subjectId: string) => (errors.data ?? []).filter((e) => e.subjectId === subjectId && !e.resolved);

  const loading = projects.isLoading || subjects.isLoading || attempts.isLoading || errors.isLoading || sessions.isLoading;

  return {
    projects,
    subjects,
    attempts,
    errors,
    sessions,
    questions,
    activeSubjects,
    recommendations,
    suggestedQuestions,
    pendingErrors,
    today,
    loading,
  };
}
