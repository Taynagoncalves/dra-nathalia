import { describe, expect, it } from 'vitest';
import { buildStudyPlan, weaknessOf } from './studyPlan';

const base = {
  today: '2026-11-15', // domingo
  examDate: '2026-11-29',
  examTitle: 'Prova de Civil',
  minutesPerDay: 100,
  weekdays: [1, 2, 3, 4, 5], // seg a sex
  subjects: [
    { id: 'a', name: 'Contratos', weakness: 0.9 },
    { id: 'b', name: 'Família', weakness: 0.1 },
  ],
};

describe('buildStudyPlan', () => {
  it('só usa os dias da semana escolhidos e termina antes da prova', () => {
    const plan = buildStudyPlan(base);
    expect(plan.length).toBeGreaterThan(0);
    for (const e of plan) {
      expect(e.date > base.today && e.date < base.examDate).toBe(true);
      const dow = new Date(`${e.date}T12:00:00Z`).getUTCDay();
      expect([1, 2, 3, 4, 5]).toContain(dow);
    }
  });

  it('dá mais sessões para a matéria mais fraca', () => {
    const plan = buildStudyPlan({
      ...base,
      examDate: '2026-12-20',
      minutesPerDay: 50,
      subjects: [...base.subjects, { id: 'c', name: 'Sucessões', weakness: 0.1 }],
    }).filter((e) => e.subjectId);
    const a = plan.filter((e) => e.subjectId === 'a').length;
    const b = plan.filter((e) => e.subjectId === 'b').length;
    expect(a).toBeGreaterThan(b * 1.5);
  });

  it('últimos 2 dias são revisão geral e há revisões espaçadas', () => {
    const plan = buildStudyPlan(base);
    const finals = plan.filter((e) => e.subjectId === null);
    expect(finals.map((e) => e.date)).toEqual(['2026-11-26', '2026-11-27']);
    expect(finals.every((e) => e.type === 'revisao')).toBe(true);
    expect(plan.some((e) => e.subjectId && e.type === 'revisao')).toBe(true);
  });

  it('2 sessões por dia (100 min) sem repetir matéria no mesmo dia', () => {
    const plan = buildStudyPlan(base).filter((e) => e.subjectId);
    const byDay = new Map<string, string[]>();
    for (const e of plan) byDay.set(e.date, [...(byDay.get(e.date) ?? []), e.subjectId!]);
    for (const ids of byDay.values()) {
      expect(ids).toHaveLength(2);
      expect(new Set(ids).size).toBe(2);
    }
  });

  it('prova no passado ou sem matérias → vazio', () => {
    expect(buildStudyPlan({ ...base, examDate: '2026-11-10' })).toEqual([]);
    expect(buildStudyPlan({ ...base, subjects: [] })).toEqual([]);
  });
});

describe('weaknessOf', () => {
  it('usa o % de acerto e os erros pendentes', () => {
    expect(weaknessOf(null, 0)).toBe(0.5);
    expect(weaknessOf(80, 0)).toBeCloseTo(0.2);
    expect(weaknessOf(80, 5)).toBeCloseTo(0.35);
    expect(weaknessOf(0, 50)).toBe(1);
  });
});
