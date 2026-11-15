import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { friendlyError } from '@/lib/firebaseErrors';
import { listGoals, saveGoal, type GoalMetric, type GoalPeriod } from '@/services/firebase/goals';
import { listSessions } from '@/services/firebase/sessions';
import { useUid } from './useUid';

/** Sessões de estudo (a chave ['sessions', uid] é invalidada pelo timer ao salvar). */
export function useSessions() {
  const uid = useUid();
  return useQuery({ queryKey: ['sessions', uid], queryFn: () => listSessions(uid) });
}

export function useGoals() {
  const uid = useUid();
  return useQuery({ queryKey: ['goals', uid], queryFn: () => listGoals(uid) });
}

export function useSaveGoals() {
  const uid = useUid();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (goals: { period: GoalPeriod; metric: GoalMetric; target: number }[]) => {
      await Promise.all(goals.map((g) => saveGoal(uid, g.period, g.metric, g.target)));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['goals', uid] }),
    onError: (err) => toast.error(friendlyError(err)),
  });
}
