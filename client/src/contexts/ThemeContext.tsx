import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { applyAccent, readStoredAccent, storeAccent, type AccentMode, type AccentSettings } from '@/lib/accent';
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
  /** cores principais personalizadas (null = padrão) */
  accent: AccentSettings;
  setAccent: (mode: AccentMode, hex: string | null) => void;
}

const ThemeContext = createContext<ThemeState | null>(null);
const SAVE_DELAY_MS = 700;

/**
 * Tema do site e cor principal. Salva em localStorage (vale na hora, sem flash)
 * e em users/{uid}.settings (vale em qualquer dispositivo).
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const { user, profile } = useAuth();
  const [preference, setPref] = useState<ThemePreference>(readStoredPreference);
  const [resolved, setResolved] = useState<ResolvedTheme>(() => resolveTheme(readStoredPreference()));
  const [accent, setAccentState] = useState<AccentSettings>(readStoredAccent);
  const firstRender = useRef(true);
  const saveTimer = useRef<number | undefined>(undefined);

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

  // Aplica a cor principal (o index.html já aplicou a salva antes do React).
  useEffect(() => {
    applyAccent(accent);
  }, [accent]);

  // Ao logar (ou trocar de conta), adota o tema e as cores salvos no Firestore.
  const syncedUid = useRef<string | null>(null);
  useEffect(() => {
    if (!user || !profile || syncedUid.current === user.uid) return;
    syncedUid.current = user.uid;
    const s = profile.settings;
    const remote = s?.theme;
    if (remote && remote !== readStoredPreference()) {
      storePreference(remote);
      setPref(remote);
    }
    if (s && ('accentLight' in s || 'accentDark' in s)) {
      const next = { light: s.accentLight ?? null, dark: s.accentDark ?? null };
      storeAccent(next);
      setAccentState(next);
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

  const setAccent = useCallback(
    (mode: AccentMode, hex: string | null) => {
      setAccentState((prev) => {
        const next = { ...prev, [mode]: hex };
        storeAccent(next);
        // O seletor de cor dispara muitos eventos ao arrastar: grava no Firestore só no fim.
        if (user) {
          window.clearTimeout(saveTimer.current);
          saveTimer.current = window.setTimeout(() => {
            updateUserSettings(user.uid, { accentLight: next.light, accentDark: next.dark }).catch(() => {});
          }, SAVE_DELAY_MS);
        }
        return next;
      });
    },
    [user],
  );

  return (
    <ThemeContext.Provider value={{ preference, resolved, setPreference, accent, setAccent }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme precisa estar dentro de <ThemeProvider>.');
  return ctx;
}
