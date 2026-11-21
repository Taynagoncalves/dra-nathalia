/** Bancas examinadoras mais comuns (mesma lista do server: server/src/ai/boards.ts). */
export const BOARDS = ['FGV', 'Cebraspe', 'FCC', 'Vunesp', 'Cesgranrio', 'IBFC', 'Quadrix', 'AOCP', 'Consulplan', 'IDECAN', 'Fundatec', 'Objetiva'] as const;
export type Board = (typeof BOARDS)[number];

/** "cespe", "CESPE/UnB", "cebraspe " → "Cebraspe"; outras bancas ficam como digitadas. */
export function normalizeBoard(raw: string | null | undefined): string {
  const v = (raw ?? '').trim();
  if (!v) return '';
  const k = v.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (/cespe|cebraspe/.test(k)) return 'Cebraspe';
  if (/fgv|getulio vargas/.test(k)) return 'FGV';
  if (/\bfcc\b|carlos chagas/.test(k)) return 'FCC';
  if (/vunesp/.test(k)) return 'Vunesp';
  if (/cesgranrio/.test(k)) return 'Cesgranrio';
  if (/ibfc/.test(k)) return 'IBFC';
  if (/quadrix/.test(k)) return 'Quadrix';
  if (/aocp/.test(k)) return 'AOCP';
  if (/consulplan/.test(k)) return 'Consulplan';
  if (/idecan/.test(k)) return 'IDECAN';
  if (/fundatec/.test(k)) return 'Fundatec';
  if (/objetiva/.test(k)) return 'Objetiva';
  return v.slice(0, 60);
}

/** "FGV · 2024 · OAB · Advogado" (só o que estiver preenchido). */
export function examMeta(q: { examBoard?: string | null; examYear?: number | null; institution?: string | null; role?: string | null }) {
  return [q.examBoard, q.examYear, q.institution, q.role].filter((x) => x !== null && x !== undefined && String(x).trim()).join(' · ');
}
