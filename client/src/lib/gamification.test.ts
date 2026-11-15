import { describe, expect, it } from 'vitest';
import { activityXp, emptyActivity, gamify, levelFromXp, longestStreak, missionsForDay, weekStartOf } from './gamification';

describe('levelFromXp', () => {
  it('nível 1 com 0 XP, 2 com 100, 3 com 300', () => {
    expect(levelFromXp(0)).toMatchObject({ level: 1, title: 'Calouro(a)', xpToNext: 100 });
    expect(levelFromXp(100).level).toBe(2);
    expect(levelFromXp(299).level).toBe(2);
    expect(levelFromXp(300)).toMatchObject({ level: 3, title: 'Estudante' });
  });
});

describe('activityXp', () => {
  it('soma questões, acertos, minutos e peças', () => {
    const a = emptyActivity();
    a.attempts = [
      { day: '2026-11-10', correct: true },
      { day: '2026-11-10', correct: false },
    ];
    a.sessions = [{ day: '2026-11-10', minutes: 30 }];
    a.simulations = [{ day: '2026-11-10', score: 80, role: 'autor', caseId: 'c' }];
    expect(activityXp(a)).toBe(5 + 2 + 30 + 20 + 40);
  });
});

describe('longestStreak', () => {
  it('conta dias seguidos, ignorando repetidos', () => {
    expect(longestStreak(['2026-11-01', '2026-11-02', '2026-11-02', '2026-11-03', '2026-11-05'])).toBe(3);
    expect(longestStreak([])).toBe(0);
    expect(longestStreak(['2026-10-31', '2026-11-01'])).toBe(2);
  });
});

describe('missões', () => {
  it('são 3, diferentes e estáveis no mesmo dia', () => {
    const a = missionsForDay('2026-11-15');
    expect(a).toHaveLength(3);
    expect(new Set(a.map((m) => m.id)).size).toBe(3);
    expect(missionsForDay('2026-11-15').map((m) => m.id)).toEqual(a.map((m) => m.id));
    expect(['questoes10', 'estudo30']).toContain(a[0]!.id);
  });
  it('semana começa no domingo', () => {
    expect(weekStartOf('2026-11-15')).toBe('2026-11-15'); // domingo
    expect(weekStartOf('2026-11-18')).toBe('2026-11-15');
  });
});

describe('gamify', () => {
  it('desbloqueia conquistas e conta a sequência', () => {
    const a = emptyActivity();
    a.attempts = Array.from({ length: 7 }, (_, i) => ({ day: `2026-11-0${i + 1}`, correct: true }));
    a.simulations = (['autor', 'reu', 'magistrado'] as const).map((role) => ({ day: '2026-11-07', score: 85, role, caseId: 'c1' }));
    const g = gamify(a, '2026-11-07');
    const unlocked = g.achievements.filter((x) => x.unlocked).map((x) => x.def.id);
    expect(unlocked).toEqual(expect.arrayContaining(['primeira_questao', 'sequencia_7', 'simulador_1', 'simulador_80', 'tres_papeis']));
    expect(unlocked).not.toContain('questoes_100');
    expect(g.lifetime.longestStreak).toBe(7);
    expect(g.xp).toBeGreaterThanOrEqual(activityXp(a));
  });
});
