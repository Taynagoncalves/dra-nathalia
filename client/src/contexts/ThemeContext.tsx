import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  applyTheme,
  readStoredPreference,
  resolveTheme,
  storePreference,
  watchSystemTheme,
  type ResolvedTheme,
} from '@/lib/theme';
import { updateUserSettings } from '@/services/firebase/users';
import type { ThemePreference } from '@/types/models';
import { useAuth } from './AuthContext';

interface ThemeState {
  /** escolha do usuário: claro, escuro ou automático */
  preference: ThemePreference;
  /** tema efetivamente aplicado agora */
  resolved: ResolvedTheme;
  setPreference: (pref: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeState | null>(null);

/**
 * Tema do site. Salva em localStorage (vale na hora, sem flash) e em
 * users/{uid}.settings.theme (vale em qualquer dispositivo).
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const { user, profile } = useAuth();
  const [preference, setPref] = useState<ThemePreference>(readStoredPreference);
  const [resolved, setResolved] = useState<ResolvedTheme>(() => resolveTheme(readStoredPreference()));
  const firstRender = useRef(true);

  // Aplica o tema e, no modo automático, acompanha o sistema operacional.
  useEffect(() => {
    const update = () => {
      const next = resolveTheme(preference);
      setResolved(next);
      applyTheme(next, !firstRender.current);
      firstRender.current = false;
    };
    update();
    return preference === 'system' ? watchSystemTheme(update) : undefined;
  }, [preference]);

  // Ao logar (ou trocar de conta), adota o tema salvo no Firestore.
  const syncedUid = useRef<string | null>(null);
  useEffect(() => {
    if (!user || !profile || syncedUid.current === user.uid) return;
    syncedUid.current = user.uid;
    const remote = profile.settings?.theme;
    if (remote && remote !== readStoredPreference()) {
      storePreference(remote);
      setPref(remote);
    }
  }, [user, profile]);

  const setPreference = useCallback(
    (pref: ThemePreference) => {
      setPref(pref);
      storePreference(pref);
      if (user) {
        // Se falhar (ex.: offline), a escolha continua valendo neste aparelho.
        updateUserSettings(user.uid, { theme: pref }).catch(() => {});
      }
    },
    [user],
  );

  return (
    <ThemeContext.Provider value={{ preference, resolved, setPreference }}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme precisa estar dentro de <ThemeProvider>.');
  return ctx;
}
