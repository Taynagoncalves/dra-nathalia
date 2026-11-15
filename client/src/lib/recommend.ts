import type { Attempt, ErrorEntry, StudySession, Subject } from '@/types/models';
import { addDaysToKey } from './dates';
import { accuracyBy, minutesBy } from './stats';

export type RecommendationKind = 'acerto' | 'erros' | 'pouco_estudo';

export interface Recommendation {
  subject: Subject;
  kind: RecommendationKind;
  reason: string;
}

interface Input {
  subjects: Subject[];
  attempts: Pick<Attempt, 'subjectId' | 'isCorrect'>[];
  errors: Pick<ErrorEntry, 'subjectId' | 'resolved'>[];
  sessions: Pick<StudySession, 'subjectId' | 'minutes' | 'date'>[];
  today: string;
}

const MIN_ATTEMPTS = 3;

/**
 * "O que devo estudar agora?" — regra simples da Etapa 1 (na Etapa 2 passa a usar IA):
 *   1º a matéria com MENOR % de acerto (com pelo menos 3 questões)
 *   2º a matéria com mais erros NÃO resolvidos no caderno
 *   3º a matéria MENOS estudada nos últimos 7 dias
 * Devolve até 3 sugestões, sem repetir matéria; a primeira é a principal.
 */
export function recommend({ subjects, attempts, errors, sessions, today }: Input): Recommendation[] {
  if (!subjects.length) return [];
  const byId = new Map(subjects.map((s) => [s.id, s]));
  const out: Recommendation[] = [];
  const used = new Set<string>();
  const push = (subjectId: string, kind: RecommendationKind, reason: string) => {
    const subject = byId.get(subjectId);
    if (!subject || used.has(subjectId)) return false;
    used.add(subjectId);
    out.push({ subject, kind, reason });
    return true;
  };

  // 1. menor % de acerto
  const acc = [...accuracyBy(attempts.filter((a) => byId.has(a.subjectId)), (a) => a.subjectId)]
    .filter(([, a]) => a.total >= MIN_ATTEMPTS)
    .sort((a, b) => a[1].pct - b[1].pct || b[1].total - a[1].total);
  for (const [id, a] of acc) {
    if (push(id, 'acerto', `Menor % de acerto: ${a.pct}% em ${a.total} questões.`)) break;
  }

  // 2. mais erros não resolvidos
  const pending = new Map<string, number>();
  for (const e of errors) if (!e.resolved) pending.set(e.subjectId, (pending.get(e.subjectId) ?? 0) + 1);
  for (const [id, n] of [...pending].sort((a, b) => b[1] - a[1])) {
    if (push(id, 'erros', `${n} ${n === 1 ? 'erro não resolvido' : 'erros não resolvidos'} no caderno de erros.`)) break;
  }

  // 3. menos estudada nos últimos 7 dias
  const from = addDaysToKey(today, -6);
  const minutes = minutesBy(
    sessions.filter((s) => s.date >= from),
    (s) => s.subjectId,
  );
  const leastStudied = [...subjects].sort(
    (a, b) => (minutes.get(a.id) ?? 0) - (minutes.get(b.id) ?? 0) || a.order - b.order,
  );
  // completa até 3 sugestões com as menos estudadas
  for (const s of leastStudied) {
    if (out.length >= 3) break;
    const m = minutes.get(s.id) ?? 0;
    push(s.id, 'pouco_estudo', m ? `Só ${m} min de estudo nos últimos 7 dias.` : 'Não foi estudada nos últimos 7 dias.');
  }

  return out.slice(0, 3);
}
