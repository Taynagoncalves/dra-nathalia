import { addDaysToKey } from './dates';

/**
 * Nova sequência ao registrar estudo em `today`.
 * - já estudou hoje → mantém
 * - estudou ontem → +1
 * - qualquer outro caso → recomeça em 1
 */
export function nextStreak(prevStreak: number, lastStudyDate: string | null, today: string): number {
  if (lastStudyDate === today) return Math.max(prevStreak, 1);
  if (lastStudyDate === addDaysToKey(today, -1)) return prevStreak + 1;
  return 1;
}

/**
 * Sequência para EXIBIR hoje: se o último estudo foi antes de ontem, a sequência
 * já quebrou (mesmo que o documento ainda guarde o número antigo).
 */
export function displayStreak(streak: number, lastStudyDate: string | null, today: string): number {
  if (!lastStudyDate) return 0;
  if (lastStudyDate === today || lastStudyDate === addDaysToKey(today, -1)) return streak;
  return 0;
}
