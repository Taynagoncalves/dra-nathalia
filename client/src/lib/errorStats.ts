import { ERROR_CATEGORIES, type ErrorCategory, type ErrorEntry } from '@/types/models';

export interface CategoryCount {
  category: ErrorCategory;
  count: number;
  /** 0–100, em relação ao total de erros considerados */
  percent: number;
}

/** Quantos erros por categoria, do mais frequente ao menos (categorias zeradas ficam de fora). */
export function categoryCounts(errors: Pick<ErrorEntry, 'category'>[]): CategoryCount[] {
  const total = errors.length;
  const counts = new Map<ErrorCategory, number>();
  for (const e of errors) counts.set(e.category, (counts.get(e.category) ?? 0) + 1);
  return ERROR_CATEGORIES.filter((c) => counts.has(c))
    .map((category) => {
      const count = counts.get(category)!;
      return { category, count, percent: total ? Math.round((count / total) * 100) : 0 };
    })
    .sort((a, b) => b.count - a.count || ERROR_CATEGORIES.indexOf(a.category) - ERROR_CATEGORIES.indexOf(b.category));
}

export interface AttentionItem {
  /** id do assunto, ou da matéria quando o erro não tem assunto */
  key: string;
  topicId: string | null;
  subjectId: string;
  unresolved: number;
}

/**
 * Assuntos que precisam de atenção: mais erros NÃO resolvidos primeiro.
 * Erros sem assunto contam para a matéria.
 */
export function attentionList(errors: Pick<ErrorEntry, 'topicId' | 'subjectId' | 'resolved'>[], limit = 3): AttentionItem[] {
  const map = new Map<string, AttentionItem>();
  for (const e of errors) {
    if (e.resolved) continue;
    const key = e.topicId ? `t:${e.topicId}` : `s:${e.subjectId}`;
    const item = map.get(key) ?? { key, topicId: e.topicId ?? null, subjectId: e.subjectId, unresolved: 0 };
    item.unresolved += 1;
    map.set(key, item);
  }
  return [...map.values()].sort((a, b) => b.unresolved - a.unresolved).slice(0, limit);
}
