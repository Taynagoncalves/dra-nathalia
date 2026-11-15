import { deleteDoc, getDocs, setDoc } from 'firebase/firestore';
import type { Goal } from '@/types/models';
import { docsWithId, userCol, userDoc } from './db';

export type GoalPeriod = Goal['period'];
export type GoalMetric = Goal['metric'];

/** Uma meta por combinação período × métrica (ex.: "semanal-questoes"). */
export const goalId = (period: GoalPeriod, metric: GoalMetric) => `${period}-${metric}`;

export async function listGoals(uid: string): Promise<Goal[]> {
  return docsWithId<Goal>(await getDocs(userCol(uid, 'goals')));
}

/** Cria/atualiza a meta; alvo 0 (ou vazio) remove. */
export async function saveGoal(uid: string, period: GoalPeriod, metric: GoalMetric, target: number) {
  const ref = userDoc(uid, 'goals', goalId(period, metric));
  if (!target || target <= 0) await deleteDoc(ref);
  else await setDoc(ref, { period, metric, target, projectId: null });
}
