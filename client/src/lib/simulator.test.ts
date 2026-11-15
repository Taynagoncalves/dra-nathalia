import { describe, expect, it } from 'vitest';
import { drawRole, simLevel, simStats } from './simulator';

describe('simLevel', () => {
  it('começa como estagiário', () => {
    expect(simLevel(0)).toMatchObject({ name: 'Estagiário(a)', next: 'Advogado(a) Júnior', toNext: 150 });
  });
  it('sobe de nível no limite', () => {
    expect(simLevel(150).name).toBe('Advogado(a) Júnior');
    expect(simLevel(399).name).toBe('Advogado(a) Júnior');
  });
  it('último nível tem progresso cheio', () => {
    expect(simLevel(9999)).toMatchObject({ name: 'Tribunais Superiores', next: null, progress: 100 });
  });
});

describe('simStats', () => {
  it('conta só peças corrigidas, por papel', () => {
    const s = simStats([
      { role: 'autor', status: 'corrigida', score: 80 },
      { role: 'autor', status: 'corrigida', score: 60 },
      { role: 'reu', status: 'rascunho' },
      { role: 'magistrado', status: 'corrigida', score: 90 },
    ]);
    expect(s.points).toBe(230);
    expect(s.done).toBe(3);
    expect(s.byRole.find((r) => r.role === 'autor')).toMatchObject({ count: 2, average: 70, best: 80 });
    expect(s.byRole.find((r) => r.role === 'reu')).toMatchObject({ count: 0, average: null });
    expect(s.level.name).toBe('Advogado(a) Júnior');
  });
});

describe('drawRole', () => {
  it('sorteia entre os papéis que faltam', () => {
    expect(drawRole(['autor', 'reu'], () => 0.99)).toBe('magistrado');
    expect(drawRole(['autor'], () => 0)).toBe('reu');
  });
  it('com os 3 feitos, sorteia entre todos', () => {
    expect(drawRole(['autor', 'reu', 'magistrado'], () => 0.5)).toBe('reu');
  });
});
