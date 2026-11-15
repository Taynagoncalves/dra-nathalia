import type { Attempt } from '@/types/models';
import { addDaysToKey } from './dates';
import { attemptDay } from './stats';

/**
 * Revisões inteligentes (repetição espaçada adaptada ao desempenho).
 *
 * Para cada assunto com questões resolvidas:
 *  - acerto recente (últimas 10 tentativas) define o intervalo até a próxima revisão
 *      < 50% → 1 dia · < 70% → 2 dias · < 85% → 4 dias · ≥ 85% → 7 dias
 *  - dias seguidos com acerto ≥ 80% dobram o intervalo (7 → 14 → 28)
 *  - vence em: último dia estudado + intervalo
 */

export type ReviewStatus = 'atrasada' | 'hoje' | 'em_breve';

export interface ReviewItem {
  topicId: string;
  subjectId: string;
  /** acerto recente (0–100) */
  accuracy: number;
  attempts: number;
  lastDay: string;
  intervalDays: number;
  dueDay: string;
  status: ReviewStatus;
}

export function intervalFor(accuracy: number, goodStreak: number): number {
  if (accuracy < 50) return 1;
  if (accuracy < 70) return 2;
  if (accuracy < 85) return 4;
  return 7 * 2 ** Math.min(Math.max(goodStreak - 1, 0), 2);
}

export function reviewSchedule(attempts: Pick<Attempt, 'topicId' | 'subjectId' | 'isCorrect' | 'createdAt'>[], today: string): ReviewItem[] {
  const byTopic = new Map<string, typeof attempts>();
  for (const a of attempts) {
    if (!a.topicId) continue;
    byTopic.set(a.topicId, [...(byTopic.get(a.topicId) ?? []), a]);
  }

  const items: ReviewItem[] = [];
  for (const [topicId, list] of byTopic) {
    const sorted = [...list].sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
    const recent = sorted.slice(0, 10);
    const accuracy = Math.round((recent.filter((a) => a.isCorrect).length / recent.length) * 100);

    // dias (do mais recente para trás) com acerto ≥ 80%, seguidos
    const days = new Map<string, { ok: number; total: number }>();
    for (const a of sorted) {
      const d = attemptDay(a);
      const e = days.get(d) ?? { ok: 0, total: 0 };
      e.total += 1;
      if (a.isCorrect) e.ok += 1;
      days.set(d, e);
    }
    let goodStreak = 0;
    for (const [, e] of [...days].sort((a, b) => b[0].localeCompare(a[0]))) {
      if (e.ok / e.total >= 0.8) goodStreak += 1;
      else break;
    }

    const lastDay = attemptDay(sorted[0]!);
    const intervalDays = intervalFor(accuracy, goodStreak);
    const dueDay = addDaysToKey(lastDay, intervalDays);
    items.push({
      topicId,
      subjectId: sorted[0]!.subjectId,
      accuracy,
      attempts: list.length,
      lastDay,
      intervalDays,
      dueDay,
      status: dueDay < today ? 'atrasada' : dueDay === today ? 'hoje' : 'em_breve',
    });
  }
  return items.sort((a, b) => a.dueDay.localeCompare(b.dueDay) || a.accuracy - b.accuracy);
}
