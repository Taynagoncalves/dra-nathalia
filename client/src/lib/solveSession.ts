/** Sessão de resolução de questões, guardada no navegador (sobrevive a recarregar). */

export interface SolveResult {
  questionId: string;
  answer: string;
  correct: boolean;
  timeSpentSec: number;
}

export interface SolveSession {
  title: string;
  ids: string[];
  index: number;
  results: SolveResult[];
  /** para onde voltar ao sair */
  returnTo: string;
  startedAt: number;
}

const KEY = 'sessao-questoes';

export function loadSession(): SolveSession | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as SolveSession) : null;
  } catch {
    return null;
  }
}

export function saveSession(s: SolveSession) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* sem armazenamento: a sessão segue só em memória */
  }
}

export function clearSession() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export function newSession(ids: string[], title: string, returnTo: string): SolveSession {
  const s: SolveSession = { title, ids, index: 0, results: [], returnTo, startedAt: Date.now() };
  saveSession(s);
  return s;
}

/** Sessão em andamento (não terminada)? */
export const isUnfinished = (s: SolveSession | null) => !!s && s.results.length < s.ids.length;
