import type { CaseArea, CaseDifficulty, CaseDocKind, SimRole, Simulation } from '@/types/models';

export const AREA_LABELS: Record<CaseArea, string> = {
  civil: 'Civil',
  consumidor: 'Consumidor',
  familia: 'Família e Sucessões',
  penal: 'Penal',
  trabalho: 'Trabalho',
  administrativo: 'Administrativo',
  tributario: 'Tributário',
  constitucional: 'Constitucional',
  empresarial: 'Empresarial',
  previdenciario: 'Previdenciário',
};

export const DIFFICULTY_LABELS: Record<CaseDifficulty, string> = { facil: 'Fácil', medio: 'Médio', dificil: 'Difícil' };

export const ROLES: SimRole[] = ['autor', 'reu', 'magistrado'];
export const ROLE_LABELS: Record<SimRole, string> = { autor: 'Autor', reu: 'Réu', magistrado: 'Magistrado' };
export const ROLE_DESCRIPTIONS: Record<SimRole, string> = {
  autor: 'Você advoga para quem vai ajuizar a ação.',
  reu: 'Você advoga para a parte que está sendo processada.',
  magistrado: 'Você vai decidir o caso.',
};

export const DOC_KIND_LABELS: Record<CaseDocKind, string> = {
  contrato: 'Contrato',
  conversa: 'Conversa',
  comprovante: 'Comprovante',
  decisao: 'Decisão',
  notificacao: 'Notificação',
  email: 'E-mail',
  boletim: 'Boletim de ocorrência',
  laudo: 'Laudo',
  peticao: 'Petição',
  outro: 'Documento',
};

/** Níveis do simulador (pontos = soma das notas das peças corrigidas, 0 a 100 cada). */
export const SIM_LEVELS = [
  { name: 'Estagiário(a)', min: 0 },
  { name: 'Advogado(a) Júnior', min: 150 },
  { name: 'Advogado(a) Pleno', min: 400 },
  { name: 'Advogado(a) Sênior', min: 800 },
  { name: 'Juiz(a) de Direito', min: 1400 },
  { name: 'Desembargador(a)', min: 2200 },
  { name: 'Tribunais Superiores', min: 3200 },
] as const;

export function simLevel(points: number) {
  let i = 0;
  while (i + 1 < SIM_LEVELS.length && points >= SIM_LEVELS[i + 1]!.min) i++;
  const cur = SIM_LEVELS[i]!;
  const next = SIM_LEVELS[i + 1] ?? null;
  const progress = next ? ((points - cur.min) / (next.min - cur.min)) * 100 : 100;
  return { index: i, name: cur.name, next: next?.name ?? null, toNext: next ? next.min - points : 0, progress };
}

export interface RoleStats {
  role: SimRole;
  count: number;
  average: number | null;
  best: number | null;
}

/** Pontos, nível e estatísticas por papel, só das peças já corrigidas. */
export function simStats(sims: Pick<Simulation, 'role' | 'status' | 'score'>[]) {
  const done = sims.filter((s) => s.status === 'corrigida' && typeof s.score === 'number');
  const points = done.reduce((sum, s) => sum + (s.score ?? 0), 0);
  const byRole: RoleStats[] = ROLES.map((role) => {
    const scores = done.filter((s) => s.role === role).map((s) => s.score!);
    return {
      role,
      count: scores.length,
      average: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null,
      best: scores.length ? Math.max(...scores) : null,
    };
  });
  const average = done.length ? Math.round(points / done.length) : null;
  return { points, done: done.length, average, byRole, level: simLevel(points) };
}

/** Papel sorteado pela roleta: entre os que ainda não foram feitos neste caso (ou entre todos, se já fez os 3). */
export function drawRole(done: SimRole[], rand: () => number = Math.random): SimRole {
  const pool = ROLES.filter((r) => !done.includes(r));
  const options = pool.length ? pool : ROLES;
  return options[Math.min(options.length - 1, Math.floor(rand() * options.length))]!;
}

export const scoreTone = (score: number) => (score >= 70 ? 'success' : score >= 50 ? 'warning' : 'error');
