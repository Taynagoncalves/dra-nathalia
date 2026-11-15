import type { Attempt, ErrorEntry, StudySession } from '@/types/models';
import { addDaysToKey, dateKey } from './dates';

/** Dia ('AAAA-MM-DD', fuso de São Paulo) de uma tentativa. Sem data ainda = agora. */
export const attemptDay = (a: Pick<Attempt, 'createdAt'>) => dateKey(a.createdAt?.toDate?.() ?? new Date());

/** O dia está dentro dos últimos `days` dias (contando hoje)? null = todo o período. */
export const inPeriod = (day: string, days: number | null, today: string) =>
  days === null || day >= addDaysToKey(today, -(days - 1));

export interface Accuracy {
  total: number;
  correct: number;
  /** 0–100 */
  pct: number;
}

const pct = (correct: number, total: number) => (total ? Math.round((correct / total) * 100) : 0);

export function overallAccuracy(attempts: Pick<Attempt, 'isCorrect'>[]): Accuracy {
  const correct = attempts.filter((a) => a.isCorrect).length;
  return { total: attempts.length, correct, pct: pct(correct, attempts.length) };
}

/** Acertos agrupados por uma chave (matéria, assunto…). Tentativas sem chave ficam de fora. */
export function accuracyBy<T extends Pick<Attempt, 'isCorrect'>>(attempts: T[], key: (a: T) => string | null | undefined) {
  const map = new Map<string, Accuracy>();
  for (const a of attempts) {
    const k = key(a);
    if (!k) continue;
    const acc = map.get(k) ?? { total: 0, correct: 0, pct: 0 };
    acc.total += 1;
    if (a.isCorrect) acc.correct += 1;
    acc.pct = pct(acc.correct, acc.total);
    map.set(k, acc);
  }
  return map;
}

export interface DayPoint {
  date: string;
  /** "15/11" */
  label: string;
  acertos: number;
  erros: number;
}

/** Questões por dia nos últimos `days` dias, do mais antigo ao mais recente (dias vazios incluídos). */
export function dailySeries(attempts: Pick<Attempt, 'createdAt' | 'isCorrect'>[], days: number, today: string): DayPoint[] {
  const points = new Map<string, DayPoint>();
  for (let i = days - 1; i >= 0; i--) {
    const date = addDaysToKey(today, -i);
    points.set(date, { date, label: `${date.slice(8, 10)}/${date.slice(5, 7)}`, acertos: 0, erros: 0 });
  }
  for (const a of attempts) {
    const p = points.get(attemptDay(a));
    if (!p) continue;
    if (a.isCorrect) p.acertos += 1;
    else p.erros += 1;
  }
  return [...points.values()];
}

/** Minutos estudados por chave (normalmente a matéria). */
export function minutesBy<T extends Pick<StudySession, 'minutes'>>(sessions: T[], key: (s: T) => string) {
  const map = new Map<string, number>();
  for (const s of sessions) map.set(key(s), (map.get(key(s)) ?? 0) + (s.minutes || 0));
  return map;
}

export interface ReviewItem {
  /** assunto, ou a matéria quando não há assunto */
  topicId: string | null;
  subjectId: string;
  total: number;
  pct: number;
  unresolved: number;
  score: number;
}

/**
 * "Conteúdos que precisam de revisão": assuntos com acerto abaixo de 60%
 * (com pelo menos 3 questões) ou com erros não resolvidos no caderno.
 */
export function reviewList(
  attempts: Pick<Attempt, 'isCorrect' | 'topicId' | 'subjectId'>[],
  errors: Pick<ErrorEntry, 'topicId' | 'subjectId' | 'resolved'>[],
): ReviewItem[] {
  const keyOf = (x: { topicId?: string | null; subjectId: string }) => (x.topicId ? `t:${x.topicId}` : `s:${x.subjectId}`);
  const items = new Map<string, ReviewItem>();
  const get = (x: { topicId?: string | null; subjectId: string }) => {
    const k = keyOf(x);
    let item = items.get(k);
    if (!item) {
      item = { topicId: x.topicId ?? null, subjectId: x.subjectId, total: 0, pct: 0, unresolved: 0, score: 0 };
      items.set(k, item);
    }
    return item;
  };

  const correct = new Map<string, number>();
  for (const a of attempts) {
    const item = get(a);
    item.total += 1;
    if (a.isCorrect) correct.set(keyOf(a), (correct.get(keyOf(a)) ?? 0) + 1);
  }
  for (const e of errors) if (!e.resolved) get(e).unresolved += 1;

  const out: ReviewItem[] = [];
  for (const [k, item] of items) {
    item.pct = pct(correct.get(k) ?? 0, item.total);
    const lowAccuracy = item.total >= 3 && item.pct < 60;
    if (!lowAccuracy && item.unresolved === 0) continue;
    item.score = item.unresolved * 2 + (item.total >= 3 ? (100 - item.pct) / 20 : 0);
    out.push(item);
  }
  return out.sort((a, b) => b.score - a.score);
}
