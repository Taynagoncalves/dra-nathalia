import { describe, expect, it } from 'vitest';
import { addDaysToKey, dateKey } from './dates';
import { displayStreak, nextStreak } from './streak';

describe('datas', () => {
  it('usa o fuso de São Paulo', () => {
    // 01:30 UTC de 2 de março = 22:30 de 1º de março em São Paulo
    expect(dateKey(new Date('2026-03-02T01:30:00Z'))).toBe('2026-03-01');
  });
  it('soma dias atravessando mês e ano', () => {
    expect(addDaysToKey('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDaysToKey('2026-12-31', 1)).toBe('2027-01-01');
  });
});

describe('nextStreak', () => {
  it('primeiro estudo da vida → 1', () => expect(nextStreak(0, null, '2026-11-15')).toBe(1));
  it('estudou de novo hoje → mantém', () => expect(nextStreak(4, '2026-11-15', '2026-11-15')).toBe(4));
  it('estudou ontem → +1', () => expect(nextStreak(4, '2026-11-14', '2026-11-15')).toBe(5));
  it('pulou um dia → recomeça', () => expect(nextStreak(9, '2026-11-13', '2026-11-15')).toBe(1));
});

describe('displayStreak', () => {
  it('mostra a sequência se estudou hoje ou ontem', () => {
    expect(displayStreak(5, '2026-11-15', '2026-11-15')).toBe(5);
    expect(displayStreak(5, '2026-11-14', '2026-11-15')).toBe(5);
  });
  it('zera se a sequência quebrou', () => expect(displayStreak(5, '2026-11-12', '2026-11-15')).toBe(0));
});
