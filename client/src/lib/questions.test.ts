import { describe, expect, it } from 'vitest';
import type { Attempt, Question } from '@/types/models';
import { answerLabel, EMPTY_QUESTION_FILTERS, filterQuestions, isCorrectAnswer, lastResults, shuffle } from './questions';

const ts = (ms: number) => ({ toMillis: () => ms }) as unknown as Attempt['createdAt'];

describe('respostas', () => {
  it('confere múltipla escolha e certo/errado', () => {
    expect(isCorrectAnswer({ type: 'multipla', correctAnswer: '2' }, '2')).toBe(true);
    expect(isCorrectAnswer({ type: 'multipla', correctAnswer: '2' }, '1')).toBe(false);
    expect(isCorrectAnswer({ type: 'certo_errado', correctAnswer: 'errado' }, 'errado')).toBe(true);
  });
  it('mostra o gabarito legível', () => {
    expect(answerLabel({ type: 'multipla', correctAnswer: '2' })).toBe('C');
    expect(answerLabel({ type: 'certo_errado', correctAnswer: 'certo' })).toBe('Certo');
  });
});

describe('lastResults', () => {
  it('usa a tentativa mais recente', () => {
    const attempts = [
      { questionId: 'q1', isCorrect: false, createdAt: ts(1) },
      { questionId: 'q1', isCorrect: true, createdAt: ts(5) },
      { questionId: 'q2', isCorrect: false, createdAt: ts(3) },
    ] as Attempt[];
    const map = lastResults(attempts);
    expect(map.get('q1')?.result).toBe('acertou');
    expect(map.get('q2')?.result).toBe('errou');
  });
});

describe('filterQuestions', () => {
  const qs = [
    { id: 'q1', subjectId: 's1', topicId: 't1', difficulty: 'facil', type: 'multipla', statement: 'Prescrição', examBoard: 'FGV', examYear: 2024, institution: 'OAB' },
    { id: 'q2', subjectId: 's2', topicId: null, difficulty: 'dificil', type: 'certo_errado', statement: 'Decadência' },
  ] as Question[];
  const subjectProject = new Map([
    ['s1', 'p1'],
    ['s2', 'p2'],
  ]);
  const last = new Map([['q1', { result: 'errou' as const }]]);
  const run = (f: Partial<typeof EMPTY_QUESTION_FILTERS>) =>
    filterQuestions(qs, { ...EMPTY_QUESTION_FILTERS, ...f }, subjectProject, last).map((q) => q.id);

  it('filtra por projeto, dificuldade e status', () => {
    expect(run({ projectId: 'p2' })).toEqual(['q2']);
    expect(run({ difficulty: 'facil' })).toEqual(['q1']);
    expect(run({ status: 'errou' })).toEqual(['q1']);
    expect(run({ status: 'nunca' })).toEqual(['q2']);
  });
  it('busca no enunciado sem acento', () => expect(run({ search: 'decadencia' })).toEqual(['q2']));
  it('filtra pela prova de origem (banca, ano, órgão)', () => {
    expect(run({ board: 'FGV' })).toEqual(['q1']);
    expect(run({ board: '_sem' })).toEqual(['q2']);
    expect(run({ year: '2024' })).toEqual(['q1']);
    expect(run({ year: '2023' })).toEqual([]);
    expect(run({ institution: 'oab' })).toEqual(['q1']);
  });
});

describe('shuffle', () => {
  it('mantém os mesmos itens', () => expect(shuffle([1, 2, 3, 4]).sort()).toEqual([1, 2, 3, 4]));
});
