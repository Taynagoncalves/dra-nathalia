import { describe, expect, it } from 'vitest';
import { personalRecs, type RecInput } from './personalRecs';

const base: RecInput = {
  today: '2026-11-15',
  exams: [],
  weakest: null,
  pendingErrors: null,
  simulationRoles: ['autor', 'reu', 'magistrado'],
  simulationDraftId: null,
  practiceInProgressId: null,
  practiceDone: 1,
  decks: 2,
  lastQuizDay: '2026-11-14',
  studiedToday: true,
  streak: 0,
  missionsLeft: [],
};

describe('personalRecs', () => {
  it('sem nada pendente, não inventa recomendação', () => {
    expect(personalRecs(base)).toEqual([]);
  });

  it('prova próxima vem primeiro', () => {
    const r = personalRecs({ ...base, exams: [{ title: 'OAB', date: '2026-11-20' }], streak: 5, studiedToday: false });
    expect(r[0]!.id).toBe('prova');
    expect(r[0]!.reason).toContain('5 dias');
    expect(r[1]!.id).toBe('sequencia');
  });

  it('sugere o papel que falta no simulador e respeita o limite', () => {
    const r = personalRecs({ ...base, simulationRoles: ['autor'], decks: 0, practiceDone: 0, lastQuizDay: null }, 3);
    expect(r).toHaveLength(3);
    expect(r.find((x) => x.id === 'simulador')?.title).toContain('Réu');
  });

  it('matéria fraca e erros pendentes', () => {
    const r = personalRecs({ ...base, weakest: { subjectId: 's', name: 'Penal', pct: 40 }, pendingErrors: { subjectId: 's', name: 'Penal', count: 6 } });
    expect(r.map((x) => x.id)).toEqual(['erros', 'fraca']);
  });
});
