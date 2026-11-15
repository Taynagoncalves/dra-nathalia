import { describe, expect, it } from 'vitest';
import type { Attempt } from '@/types/models';
import { intervalFor, reviewSchedule } from './review';

const at = (day: string) => ({ toDate: () => new Date(`${day}T15:00:00Z`), toMillis: () => Date.parse(`${day}T15:00:00Z`) }) as unknown as Attempt['createdAt'];
const att = (topicId: string, isCorrect: boolean, day: string) => ({ topicId, subjectId: 's', isCorrect, createdAt: at(day) }) as Attempt;

describe('intervalo de revisão', () => {
  it('acerto baixo revisa logo; domínio espaça', () => {
    expect(intervalFor(40, 0)).toBe(1);
    expect(intervalFor(60, 0)).toBe(2);
    expect(intervalFor(80, 0)).toBe(4);
    expect(intervalFor(90, 1)).toBe(7);
    expect(intervalFor(90, 2)).toBe(14);
    expect(intervalFor(90, 5)).toBe(28);
  });
});

describe('reviewSchedule', () => {
  it('calcula vencimento e situação por assunto', () => {
    const items = reviewSchedule(
      [
        att('fraco', false, '2026-11-13'),
        att('fraco', false, '2026-11-13'),
        att('fraco', true, '2026-11-13'),
        att('forte', true, '2026-11-14'),
        att('forte', true, '2026-11-15'),
        att('sem-assunto', true, '2026-11-15'),
      ].map((a) => (a.topicId === 'sem-assunto' ? { ...a, topicId: null } : a)),
      '2026-11-15',
    );
    expect(items.map((i) => [i.topicId, i.intervalDays, i.dueDay, i.status])).toEqual([
      ['fraco', 1, '2026-11-14', 'atrasada'],
      ['forte', 14, '2026-11-29', 'em_breve'],
    ]);
  });
});
