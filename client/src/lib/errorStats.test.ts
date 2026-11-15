import { describe, expect, it } from 'vitest';
import type { ErrorEntry } from '@/types/models';
import { attentionList, categoryCounts } from './errorStats';

const e = (category: ErrorEntry['category'], topicId: string | null, resolved = false, subjectId = 's1') =>
  ({ category, topicId, resolved, subjectId }) as ErrorEntry;

describe('categoryCounts', () => {
  it('ordena da categoria mais frequente para a menos', () => {
    const r = categoryCounts([
      e('Errou por desatenção', null),
      e('Confundiu conceitos', null),
      e('Confundiu conceitos', null),
    ]);
    expect(r[0]).toEqual({ category: 'Confundiu conceitos', count: 2, percent: 67 });
    expect(r).toHaveLength(2);
  });
  it('lista vazia não quebra', () => expect(categoryCounts([])).toEqual([]));
});

describe('attentionList', () => {
  it('conta só os não resolvidos e agrupa sem assunto pela matéria', () => {
    const r = attentionList([
      e('Confundiu conceitos', 't1'),
      e('Confundiu conceitos', 't1'),
      e('Confundiu conceitos', 't2', true),
      e('Errou por desatenção', null, false, 's9'),
    ]);
    expect(r.map((i) => [i.key, i.unresolved])).toEqual([
      ['t:t1', 2],
      ['s:s9', 1],
    ]);
  });
});
