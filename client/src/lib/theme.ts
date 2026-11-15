import { THEME_STORAGE_KEY } from '@/config/constants';
import type { ThemePreference } from '@/types/models';

export type ResolvedTheme = 'light' | 'dark';

export const THEME_LABELS: Record<ThemePreference, string> = {
  light: 'Claro',
  dark: 'Escuro',
  system: 'Automático',
};

const isPreference = (v: unknown): v is ThemePreference => v === 'light' || v === 'dark' || v === 'system';

export function readStoredPreference(): ThemePreference {
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY);
    return isPreference(v) ? v : 'system';
  } catch {
    return 'system';
  }
}

export function storePreference(pref: ThemePreference) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, pref);
  } catch {
    /* modo privado ou armazenamento bloqueado: segue só em memória */
  }
}

const systemQuery = () => window.matchMedia('(prefers-color-scheme: dark)');

export function resolveTheme(pref: ThemePreference): ResolvedTheme {
  if (pref === 'system') return systemQuery().matches ? 'dark' : 'light';
  return pref;
}

export function watchSystemTheme(onChange: () => void) {
  const mq = systemQuery();
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
}

let transitionTimer: number | undefined;

/** Aplica a classe .dark no <html>. Com `animate`, faz a transição de ~200 ms. */
export function applyTheme(theme: ResolvedTheme, animate: boolean) {
  const root = document.documentElement;
  if (animate) {
    root.classList.add('theme-transition');
    window.clearTimeout(transitionTimer);
    transitionTimer = window.setTimeout(() => root.classList.remove('theme-transition'), 250);
  }
  root.classList.toggle('dark', theme === 'dark');
  root.style.colorScheme = theme;
}
