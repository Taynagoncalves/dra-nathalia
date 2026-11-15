import { describe, expect, it } from 'vitest';
import type { Attempt, Subject } from '@/types/models';
import { recommend } from './recommend';
import { accuracyBy, dailySeries, inPeriod, minutesBy, overallAccuracy, reviewList } from './stats';

// 15/11/2026 12:00 em São Paulo = 15:00 UTC
const at = (day: string) => ({ toDate: () => new Date(`${day}T15:00:00Z`) }) as unknown as Attempt['createdAt'];
const att = (subjectId: string, isCorrect: boolean, topicId: string | null = null, day = '2026-11-15') =>
  ({ subjectId, isCorrect, topicId, createdAt: at(day) }) as Attempt;

describe('estatísticas', () => {
  it('acerto geral e por matéria', () => {
    const list = [att('a', true), att('a', false), att('b', true)];
    expect(overallAccuracy(list)).toEqual({ total: 3, correct: 2, pct: 67 });
    expect(accuracyBy(list, (x) => x.subjectId).get('a')).toEqual({ total: 2, correct: 1, pct: 50 });
  });

  it('série diária inclui dias vazios, do mais antigo ao mais recente', () => {
    const s = dailySeries([att('a', true, null, '2026-11-15'), att('a', false, null, '2026-11-13')], 3, '2026-11-15');
    expect(s.map((p) => [p.label, p.acertos, p.erros])).toEqual([
      ['13/11', 0, 1],
      ['14/11', 0, 0],
      ['15/11', 1, 0],
    ]);
  });

  it('período em dias', () => {
    expect(inPeriod('2026-11-09', 7, '2026-11-15')).toBe(true);
    expect(inPeriod('2026-11-08', 7, '2026-11-15')).toBe(false);
    expect(inPeriod('2020-01-01', null, '2026-11-15')).toBe(true);
  });

  it('minutos por matéria', () => {
    expect(minutesBy([{ subjectId: 'a', minutes: 10 }, { subjectId: 'a', minutes: 5 }], (s) => s.subjectId).get('a')).toBe(15);
  });

  it('revisão: acerto baixo (≥3 questões) ou erros pendentes', () => {
    const r = reviewList(
      [att('a', false, 't1'), att('a', false, 't1'), att('a', true, 't1'), att('a', true, 't2'), att('a', true, 't2'), att('a', true, 't2')],
      [{ subjectId: 'b', topicId: null, resolved: false }],
    );
    expect(r.map((i) => i.topicId ?? i.subjectId).sort()).toEqual(['b', 't1']);
  });
});

describe('recommend', () => {
  const subj = (id: string, order: number) => ({ id, name: id, order, projectId: 'p' }) as Subject;
  const subjects = [subj('civil', 0), subj('penal', 1), subj('const', 2)];

  it('prioriza: menor acerto → erros pendentes → menos estudada', () => {
    const r = recommend({
      subjects,
      attempts: [att('civil', true), att('civil', true), att('civil', false), att('penal', false), att('penal', false), att('penal', true)],
      errors: [{ subjectId: 'civil', resolved: false }],
      sessions: [{ subjectId: 'civil', minutes: 30, date: '2026-11-14' }],
      today: '2026-11-15',
    });
    expect(r.map((x) => [x.subject.id, x.kind])).toEqual([
      ['penal', 'acerto'],
      ['civil', 'erros'],
      ['const', 'pouco_estudo'],
    ]);
  });

  it('sem dados, sugere a menos estudada', () => {
    const r = recommend({ subjects, attempts: [], errors: [], sessions: [], today: '2026-11-15' });
    expect(r[0]!.kind).toBe('pouco_estudo');
    expect(r).toHaveLength(3);
  });

  it('sem matérias, nada a sugerir', () => {
    expect(recommend({ subjects: [], attempts: [], errors: [], sessions: [], today: '2026-11-15' })).toEqual([]);
  });
});
