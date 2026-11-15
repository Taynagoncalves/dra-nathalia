import { useMemo } from 'react';
import { useAttempts, useErrors, useLastResults, useQuestions } from '@/hooks/useQuestions';
import { useSessions } from '@/hooks/useStats';
import { useAllSubjects, useProjects } from '@/hooks/useStudyData';
import { dateKey } from '@/lib/dates';
import { recommend } from '@/lib/recommend';
import { reviewSchedule } from '@/lib/review';
import { getDocs } from 'firebase/firestore';
import { useQuery } from '@tanstack/react-query';
import { useUid } from '@/hooks/useUid';
import { userCol } from '@/services/firebase/db';

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
  const uid = useUid();

  // Quantos materiais prontos para a IA cada matéria tem (para o plano com IA)
  const readyMaterials = useQuery({
    queryKey: ['materials-ready', uid],
    queryFn: async () => {
      const snap = await getDocs(userCol(uid, 'materials'));
      const map = new Map<string, number>();
      for (const d of snap.docs) {
        if (d.get('kind') === 'note' || d.get('aiStatus') === 'pronto') map.set(d.get('subjectId'), (map.get(d.get('subjectId')) ?? 0) + 1);
      }
      return map;
    },
  });

  /** Revisões inteligentes: por assunto, quando revisar de novo. */
  const reviews = useMemo(() => reviewSchedule(attempts.data ?? [], today), [attempts.data, today]);

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
    reviews,
    readyMaterials: readyMaterials.data ?? new Map<string, number>(),
  };
}
