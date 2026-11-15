import { useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { saveStudySession } from '@/services/firebase/sessions';
import { useAuth } from './AuthContext';

export const STUDY_ACTIVITIES = ['Leitura', 'Questões', 'Revisão', 'Videoaula', 'Resumo', 'Outro'] as const;

export interface TimerState {
  uid: string;
  subjectId: string;
  activity: string;
  /** momento (ms) em que voltou a contar; null = pausado */
  startedAt: number | null;
  /** tempo já contado antes da última pausa */
  accumulatedMs: number;
}

interface StudyTimerApi {
  state: TimerState | null;
  running: boolean;
  elapsedMs: () => number;
  start: (subjectId: string, activity: string) => void;
  pause: () => void;
  resume: () => void;
  /** salva a sessão e atualiza a streak; devolve a nova sequência */
  save: (minutes: number) => Promise<{ streak: number }>;
  discard: () => void;
}

const STORAGE_KEY = 'timer-estudo';
const StudyTimerContext = createContext<StudyTimerApi | null>(null);

function load(): TimerState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as TimerState) : null;
  } catch {
    return null;
  }
}

function persist(state: TimerState | null) {
  try {
    if (state) localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* armazenamento indisponível: o timer segue só em memória */
  }
}

/**
 * Timer de estudo global. Fica salvo no navegador, então sobrevive a trocar
 * de página e a recarregar o site.
 */
export function StudyTimerProvider({ children }: { children: ReactNode }) {
  const { user, refreshProfile } = useAuth();
  const qc = useQueryClient();
  const [stored, setStored] = useState<TimerState | null>(load);

  // Só vale o timer do usuário logado.
  const state = stored && user && stored.uid === user.uid ? stored : null;

  const update = useCallback((next: TimerState | null) => {
    setStored(next);
    persist(next);
  }, []);

  // Sincroniza entre abas do navegador.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => e.key === STORAGE_KEY && setStored(load());
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const elapsedMs = useCallback(
    () => (state ? state.accumulatedMs + (state.startedAt ? Date.now() - state.startedAt : 0) : 0),
    [state],
  );

  const api = useMemo<StudyTimerApi>(
    () => ({
      state,
      running: !!state?.startedAt,
      elapsedMs,
      start: (subjectId, activity) => {
        if (!user) return;
        update({ uid: user.uid, subjectId, activity, startedAt: Date.now(), accumulatedMs: 0 });
      },
      pause: () => {
        if (!state?.startedAt) return;
        update({ ...state, accumulatedMs: elapsedMs(), startedAt: null });
      },
      resume: () => {
        if (!state || state.startedAt) return;
        update({ ...state, startedAt: Date.now() });
      },
      save: async (minutes) => {
        if (!state || !user) throw new Error('Nenhum timer ativo.');
        const result = await saveStudySession(user.uid, {
          subjectId: state.subjectId,
          activity: state.activity,
          minutes,
        });
        update(null);
        qc.invalidateQueries({ queryKey: ['sessions', user.uid] });
        await refreshProfile();
        return result;
      },
      discard: () => update(null),
    }),
    [state, user, elapsedMs, update, qc, refreshProfile],
  );

  return <StudyTimerContext.Provider value={api}>{children}</StudyTimerContext.Provider>;
}

export function useStudyTimer() {
  const ctx = useContext(StudyTimerContext);
  if (!ctx) throw new Error('useStudyTimer precisa estar dentro de <StudyTimerProvider>.');
  return ctx;
}
