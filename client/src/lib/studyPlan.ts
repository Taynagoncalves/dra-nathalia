import { addDaysToKey } from './dates';

/**
 * Calendário inteligente (Etapa 5): monta um cronograma de estudo até a prova.
 * - matérias mais fracas recebem mais sessões (peso = 1 + 2 × fraqueza)
 * - a cada 3 sessões de uma matéria, a 3ª vira revisão (repetição espaçada)
 * - os 2 últimos dias disponíveis antes da prova são de revisão geral
 * - evita repetir a mesma matéria no mesmo dia, quando dá
 */

export interface PlanSubject {
  id: string;
  name: string;
  /** 0 (domina) a 1 (muito fraca) */
  weakness: number;
}

export interface PlanInput {
  today: string;
  examDate: string;
  examTitle: string;
  subjects: PlanSubject[];
  minutesPerDay: number;
  /** dias da semana disponíveis (0 = domingo) */
  weekdays: number[];
  /** começa hoje (true) ou amanhã */
  includeToday?: boolean;
}

export interface PlannedEvent {
  date: string;
  title: string;
  type: 'estudo' | 'revisao';
  subjectId: string | null;
  notes: string;
}

export const SESSION_MINUTES = 50;
const FINAL_REVIEW_DAYS = 2;

const weekdayOf = (key: string) => {
  const [y, m, d] = key.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
};

/** Fraqueza a partir do % de acerto (sem dados suficientes → 0,5) e dos erros pendentes. */
export function weaknessOf(accuracyPct: number | null, pendingErrors: number) {
  const base = accuracyPct === null ? 0.5 : 1 - accuracyPct / 100;
  return Math.max(0, Math.min(1, base + Math.min(0.3, pendingErrors * 0.03)));
}

export function buildStudyPlan(input: PlanInput): PlannedEvent[] {
  const { subjects } = input;
  if (!subjects.length || input.examDate <= input.today) return [];
  const days: string[] = [];
  for (let d = input.includeToday ? input.today : addDaysToKey(input.today, 1); d < input.examDate; d = addDaysToKey(d, 1)) {
    if (input.weekdays.includes(weekdayOf(d))) days.push(d);
    if (days.length > 366) break;
  }
  if (!days.length) return [];

  const note = `Cronograma para: ${input.examTitle}`;
  const finalDays = days.length > FINAL_REVIEW_DAYS + 1 ? days.slice(-FINAL_REVIEW_DAYS) : [];
  const studyDays = days.slice(0, days.length - finalDays.length);
  const perDay = Math.max(1, Math.min(4, Math.floor(input.minutesPerDay / SESSION_MINUTES)));

  // round-robin ponderado e suave (como o do nginx): sempre escolhe a de maior "crédito"
  const weight = new Map(subjects.map((s) => [s.id, 1 + 2 * Math.max(0, Math.min(1, s.weakness))]));
  const totalWeight = [...weight.values()].reduce((a, b) => a + b, 0);
  const credit = new Map(subjects.map((s) => [s.id, 0]));
  const count = new Map(subjects.map((s) => [s.id, 0]));

  const out: PlannedEvent[] = [];
  for (const day of studyDays) {
    const usedToday = new Set<string>();
    for (let slot = 0; slot < perDay; slot++) {
      for (const s of subjects) credit.set(s.id, credit.get(s.id)! + weight.get(s.id)!);
      const ranked = [...subjects].sort((a, b) => credit.get(b.id)! - credit.get(a.id)! || a.name.localeCompare(b.name));
      const pick = ranked.find((s) => !usedToday.has(s.id)) ?? ranked[0]!;
      credit.set(pick.id, credit.get(pick.id)! - totalWeight);
      usedToday.add(pick.id);
      const n = count.get(pick.id)! + 1;
      count.set(pick.id, n);
      const review = n % 3 === 0;
      out.push({
        date: day,
        title: `${review ? 'Revisão' : 'Estudar'}: ${pick.name}`,
        type: review ? 'revisao' : 'estudo',
        subjectId: pick.id,
        notes: `${note} · sessão de ~${SESSION_MINUTES} min`,
      });
    }
  }
  for (const day of finalDays) {
    out.push({ date: day, title: `Revisão geral: ${input.examTitle}`, type: 'revisao', subjectId: null, notes: `${note} · revise o caderno de erros e os resumos` });
  }
  return out;
}
