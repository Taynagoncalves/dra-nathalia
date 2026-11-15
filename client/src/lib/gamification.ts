import type { SimRole } from '@/types/models';
import { addDaysToKey } from './dates';

/**
 * Gamificação (Etapa 5). Tudo é CALCULADO a partir do que a pessoa já fez
 * (questões, minutos, quizzes, peças…), então não há contador para burlar
 * e nada se perde se uma gravação falhar.
 */

export interface Activity {
  attempts: { day: string; correct: boolean }[];
  sessions: { day: string; minutes: number }[];
  quizzes: { day: string; score: number }[];
  simulations: { day: string; score: number; role: SimRole; caseId: string }[];
  decks: { day: string }[];
  practiceDays: { day: string; score: number }[];
  errorsResolved: number;
}

export const emptyActivity = (): Activity => ({ attempts: [], sessions: [], quizzes: [], simulations: [], decks: [], practiceDays: [], errorsResolved: 0 });

/* ── XP e níveis ─────────────────────────────────────────────────── */

export const XP_RULES = {
  attempt: 2,
  correct: 3,
  minute: 1,
  quiz: 15,
  simulation: 20,
  deck: 15,
  practiceDay: 25,
  errorResolved: 5,
  mission: 30,
  weekly: 150,
} as const;

/** XP só da atividade (sem bônus de missões). */
export function activityXp(a: Activity) {
  return (
    a.attempts.reduce((s, x) => s + XP_RULES.attempt + (x.correct ? XP_RULES.correct : 0), 0) +
    a.sessions.reduce((s, x) => s + Math.round(x.minutes) * XP_RULES.minute, 0) +
    a.quizzes.reduce((s, x) => s + XP_RULES.quiz + Math.round(x.score / 10), 0) +
    a.simulations.reduce((s, x) => s + XP_RULES.simulation + Math.round(x.score / 2), 0) +
    a.decks.length * XP_RULES.deck +
    a.practiceDays.reduce((s, x) => s + XP_RULES.practiceDay + Math.round(x.score / 2), 0) +
    a.errorsResolved * XP_RULES.errorResolved
  );
}

/** XP mínimo do nível n: 0, 100, 300, 600, 1000, 1500… */
export const xpForLevel = (n: number) => 50 * n * (n - 1);

const TITLES: [number, string][] = [
  [1, 'Calouro(a)'],
  [3, 'Estudante'],
  [5, 'Monitor(a)'],
  [8, 'Bacharel'],
  [12, 'Aprovado(a)'],
  [16, 'Jurista'],
  [20, 'Doutrinador(a)'],
];

export function levelFromXp(xp: number) {
  let level = 1;
  while (xp >= xpForLevel(level + 1)) level++;
  const cur = xpForLevel(level);
  const next = xpForLevel(level + 1);
  const title = [...TITLES].reverse().find(([min]) => level >= min)![1];
  return { level, title, xpInLevel: xp - cur, xpToNext: next - xp, progress: ((xp - cur) / (next - cur)) * 100 };
}

/* ── Agregados por dia / semana ──────────────────────────────────── */

export interface DayTotals {
  questions: number;
  correct: number;
  minutes: number;
  quizzes: number;
  bestQuiz: number;
  simulations: number;
  decks: number;
  practiceDays: number;
}

const zero = (): DayTotals => ({ questions: 0, correct: 0, minutes: 0, quizzes: 0, bestQuiz: 0, simulations: 0, decks: 0, practiceDays: 0 });

export function totalsByDay(a: Activity): Map<string, DayTotals> {
  const map = new Map<string, DayTotals>();
  const at = (day: string) => {
    if (!map.has(day)) map.set(day, zero());
    return map.get(day)!;
  };
  for (const x of a.attempts) {
    const t = at(x.day);
    t.questions++;
    if (x.correct) t.correct++;
  }
  for (const x of a.sessions) at(x.day).minutes += x.minutes;
  for (const x of a.quizzes) {
    const t = at(x.day);
    t.quizzes++;
    t.bestQuiz = Math.max(t.bestQuiz, x.score);
  }
  for (const x of a.simulations) at(x.day).simulations++;
  for (const x of a.decks) at(x.day).decks++;
  for (const x of a.practiceDays) at(x.day).practiceDays++;
  return map;
}

const sumTotals = (list: DayTotals[]): DayTotals =>
  list.reduce(
    (s, t) => ({
      questions: s.questions + t.questions,
      correct: s.correct + t.correct,
      minutes: s.minutes + t.minutes,
      quizzes: s.quizzes + t.quizzes,
      bestQuiz: Math.max(s.bestQuiz, t.bestQuiz),
      simulations: s.simulations + t.simulations,
      decks: s.decks + t.decks,
      practiceDays: s.practiceDays + t.practiceDays,
    }),
    zero(),
  );

const isActive = (t: DayTotals) => t.questions + t.minutes + t.quizzes + t.simulations + t.decks + t.practiceDays > 0;

/** Maior sequência de dias seguidos com alguma atividade. */
export function longestStreak(days: string[]) {
  const set = [...new Set(days)].sort();
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const d of set) {
    run = prev && addDaysToKey(prev, 1) === d ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return best;
}

/* ── Missões diárias e desafio semanal ───────────────────────────── */

export interface MissionDef {
  id: string;
  title: string;
  target: number;
  /** progresso a partir dos totais do dia (ou da semana) */
  value: (t: DayTotals) => number;
  link: string;
}

export const DAILY_MISSIONS: MissionDef[] = [
  { id: 'questoes10', title: 'Resolva 10 questões', target: 10, value: (t) => t.questions, link: '/questoes' },
  { id: 'estudo30', title: 'Estude 30 minutos', target: 30, value: (t) => t.minutes, link: '/' },
  { id: 'acertos7', title: 'Acerte 7 questões', target: 7, value: (t) => t.correct, link: '/questoes' },
  { id: 'estudo60', title: 'Estude 1 hora', target: 60, value: (t) => t.minutes, link: '/' },
  { id: 'quiz1', title: 'Termine um quiz com IA', target: 1, value: (t) => t.quizzes, link: '/quizzes' },
  { id: 'quiz80', title: 'Tire 80% ou mais em um quiz', target: 80, value: (t) => t.bestQuiz, link: '/quizzes' },
  { id: 'simulacao1', title: 'Corrija uma peça no Simulador', target: 1, value: (t) => t.simulations, link: '/simulador' },
  { id: 'pratica1', title: 'Complete "Um dia na prática jurídica"', target: 1, value: (t) => t.practiceDays, link: '/pratica' },
  { id: 'slides1', title: 'Crie uma apresentação no Modo Professora', target: 1, value: (t) => t.decks, link: '/professora' },
];

export const WEEKLY_CHALLENGES: (MissionDef & { activeDays?: boolean })[] = [
  { id: 'q100', title: 'Resolva 100 questões nesta semana', target: 100, value: (t) => t.questions, link: '/questoes' },
  { id: 'h5', title: 'Estude 5 horas nesta semana', target: 300, value: (t) => t.minutes, link: '/' },
  { id: 'dias5', title: 'Estude em 5 dias diferentes', target: 5, value: () => 0, link: '/', activeDays: true },
  { id: 'quiz3', title: 'Termine 3 quizzes com IA', target: 3, value: (t) => t.quizzes, link: '/quizzes' },
  { id: 'sim2', title: 'Corrija 2 peças no Simulador', target: 2, value: (t) => t.simulations, link: '/simulador' },
  { id: 'pratica2', title: 'Viva 2 dias na prática jurídica', target: 2, value: (t) => t.practiceDays, link: '/pratica' },
];

/** Número pseudoaleatório estável a partir de um texto (mesmas missões o dia todo). */
function seed(text: string) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

/** 3 missões do dia: a 1ª é sempre simples (questões ou minutos de estudo). */
export function missionsForDay(day: string): MissionDef[] {
  const rand = seed(`missoes:${day}`);
  const first = DAILY_MISSIONS[rand() < 0.5 ? 0 : 1]!;
  const rest = DAILY_MISSIONS.filter((m) => m.id !== first.id && !(first.id === 'estudo30' && m.id === 'estudo60'));
  const picked = [first];
  while (picked.length < 3) {
    const m = rest.splice(Math.floor(rand() * rest.length), 1)[0]!;
    picked.push(m);
  }
  return picked;
}

/** Início da semana (domingo) de um dia 'AAAA-MM-DD'. */
export function weekStartOf(day: string) {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return addDaysToKey(day, -dow);
}

export const challengeForWeek = (weekStart: string) => WEEKLY_CHALLENGES[Math.floor(seed(`desafio:${weekStart}`)() * WEEKLY_CHALLENGES.length)]!;

export interface MissionProgress {
  def: MissionDef;
  value: number;
  done: boolean;
  pct: number;
}

const progressOf = (def: MissionDef, value: number): MissionProgress => ({ def, value, done: value >= def.target, pct: Math.min(100, (value / def.target) * 100) });

export function weekProgress(byDay: Map<string, DayTotals>, weekStart: string): MissionProgress {
  const def = challengeForWeek(weekStart);
  const days = Array.from({ length: 7 }, (_, i) => addDaysToKey(weekStart, i));
  const list = days.map((d) => byDay.get(d)).filter((t): t is DayTotals => !!t);
  const value = (def as { activeDays?: boolean }).activeDays ? list.filter(isActive).length : def.value(sumTotals(list));
  return progressOf(def, value);
}

/* ── Conquistas ──────────────────────────────────────────────────── */

export interface Lifetime {
  questions: number;
  minutes: number;
  quizzes: number;
  perfectQuizzes: number;
  simulations: number;
  bestSimulation: number;
  allRolesInACase: boolean;
  decks: number;
  practiceDays: number;
  errorsResolved: number;
  longestStreak: number;
}

export interface AchievementDef {
  id: string;
  title: string;
  description: string;
  target: number;
  value: (l: Lifetime) => number;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'primeira_questao', title: 'Primeiro passo', description: 'Resolva a sua primeira questão.', target: 1, value: (l) => l.questions },
  { id: 'questoes_100', title: 'Centena', description: 'Resolva 100 questões.', target: 100, value: (l) => l.questions },
  { id: 'questoes_500', title: 'Maratonista de questões', description: 'Resolva 500 questões.', target: 500, value: (l) => l.questions },
  { id: 'horas_10', title: '10 horas de estudo', description: 'Some 10 horas de estudo registradas.', target: 600, value: (l) => l.minutes },
  { id: 'horas_50', title: '50 horas de estudo', description: 'Some 50 horas de estudo registradas.', target: 3000, value: (l) => l.minutes },
  { id: 'sequencia_7', title: 'Semana firme', description: 'Estude 7 dias seguidos.', target: 7, value: (l) => l.longestStreak },
  { id: 'sequencia_30', title: 'Mês de constância', description: 'Estude 30 dias seguidos.', target: 30, value: (l) => l.longestStreak },
  { id: 'quiz_1', title: 'Quiz de estreia', description: 'Termine o seu primeiro quiz com IA.', target: 1, value: (l) => l.quizzes },
  { id: 'quiz_10', title: 'Quizzeira', description: 'Termine 10 quizzes com IA.', target: 10, value: (l) => l.quizzes },
  { id: 'quiz_perfeito', title: 'Gabaritou', description: 'Acerte 100% de um quiz.', target: 1, value: (l) => l.perfectQuizzes },
  { id: 'simulador_1', title: 'Primeira peça', description: 'Corrija a sua primeira peça no Simulador.', target: 1, value: (l) => l.simulations },
  { id: 'simulador_80', title: 'Peça de respeito', description: 'Tire 80 ou mais em uma peça.', target: 80, value: (l) => l.bestSimulation },
  { id: 'tres_papeis', title: 'Visão 360°', description: 'Faça o mesmo caso como Autor, Réu e Magistrado.', target: 1, value: (l) => (l.allRolesInACase ? 1 : 0) },
  { id: 'professora_1', title: 'Professora', description: 'Crie a sua primeira apresentação.', target: 1, value: (l) => l.decks },
  { id: 'erros_10', title: 'Aprendendo com os erros', description: 'Resolva 10 erros do caderno de erros.', target: 10, value: (l) => l.errorsResolved },
  { id: 'pratica_1', title: 'Primeiro expediente', description: 'Complete "Um dia na prática jurídica".', target: 1, value: (l) => l.practiceDays },
  { id: 'pratica_5', title: 'Rotina de escritório', description: 'Complete 5 dias na prática jurídica.', target: 5, value: (l) => l.practiceDays },
];

export function lifetime(a: Activity, byDay: Map<string, DayTotals>): Lifetime {
  const rolesByCase = new Map<string, Set<SimRole>>();
  for (const s of a.simulations) rolesByCase.set(s.caseId, (rolesByCase.get(s.caseId) ?? new Set()).add(s.role));
  return {
    questions: a.attempts.length,
    minutes: a.sessions.reduce((s, x) => s + x.minutes, 0),
    quizzes: a.quizzes.length,
    perfectQuizzes: a.quizzes.filter((q) => q.score >= 100).length,
    simulations: a.simulations.length,
    bestSimulation: a.simulations.reduce((m, s) => Math.max(m, s.score), 0),
    allRolesInACase: [...rolesByCase.values()].some((r) => r.size >= 3),
    decks: a.decks.length,
    practiceDays: a.practiceDays.length,
    errorsResolved: a.errorsResolved,
    longestStreak: longestStreak([...byDay].filter(([, t]) => isActive(t)).map(([d]) => d)),
  };
}

/* ── Resumo completo ─────────────────────────────────────────────── */

export function gamify(a: Activity, today: string) {
  const byDay = totalsByDay(a);

  // bônus: missões cumpridas em cada dia com atividade e desafios semanais cumpridos
  let missionsDone = 0;
  for (const [day, t] of byDay) missionsDone += missionsForDay(day).filter((m) => m.value(t) >= m.target).length;
  const weeks = new Set([...byDay.keys()].map(weekStartOf));
  let weekliesDone = 0;
  for (const w of weeks) if (weekProgress(byDay, w).done) weekliesDone++;

  const xp = activityXp(a) + missionsDone * XP_RULES.mission + weekliesDone * XP_RULES.weekly;
  const todayTotals = byDay.get(today) ?? zero();
  const life = lifetime(a, byDay);
  const achievements = ACHIEVEMENTS.map((def) => {
    const value = def.value(life);
    return { def, value, unlocked: value >= def.target, pct: Math.min(100, (value / def.target) * 100) };
  });

  return {
    xp,
    ...levelFromXp(xp),
    missions: missionsForDay(today).map((m) => progressOf(m, m.value(todayTotals))),
    weekly: weekProgress(byDay, weekStartOf(today)),
    achievements,
    lifetime: life,
    missionsDone,
    weekliesDone,
  };
}

export type Gamification = ReturnType<typeof gamify>;
