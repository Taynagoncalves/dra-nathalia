import { contrastRatio, hexToRgb, isValidHex, readableTextOn } from './color';

/**
 * Cor principal personalizada (uma para o modo claro, outra para o escuro).
 * A partir de UMA cor escolhida, calcula todas as variáveis do tema, garantindo
 * contraste WCAG AA para textos e links — com qualquer cor.
 */

export type AccentMode = 'light' | 'dark';
export interface AccentSettings {
  light: string | null;
  dark: string | null;
}

export const DEFAULT_ACCENT: Record<AccentMode, string> = { light: '#7C3AED', dark: '#EC4899' };

/** Superfícies fixas de cada modo (as mesmas de index.css). */
const SURFACES = {
  light: { bg: '#FFFFFF', elevated: '#FFFFFF' },
  dark: { bg: '#0F0F14', surface: '#1A1A22', elevated: '#23232D' },
};

/* ── Conversões ─────────────────────────────────────────────────── */

const toHex = (r: number, g: number, b: number) =>
  '#' + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('').toUpperCase();

/** Mistura `a` com `b` (amount = quanto de `a`). */
export function mix(a: string, b: string, amount: number): string {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  return toHex(r1 * amount + r2 * (1 - amount), g1 * amount + g2 * (1 - amount), b1 * amount + b2 * (1 - amount));
}

function toHsl(hex: string): [number, number, number] {
  const [r, g, b] = hexToRgb(hex).map((v) => v / 255) as [number, number, number];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l * 100];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h *= 60;
  return [h, s * 100, l * 100];
}

function fromHsl(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return toHex(f(0) * 255, f(8) * 255, f(4) * 255);
}

/** Clareia (+) ou escurece (−) em pontos de luminosidade HSL. */
export function shiftLightness(hex: string, delta: number): string {
  const [h, s, l] = toHsl(hex);
  return fromHsl(h, s, Math.max(0, Math.min(100, l + delta)));
}

/** Ajusta a luminosidade aos poucos até o texto passar 4,5:1 sobre TODOS os fundos. */
function ensureReadable(hex: string, backgrounds: string[], direction: 1 | -1): string {
  let color = hex;
  for (let i = 0; i < 60; i++) {
    if (backgrounds.every((bg) => contrastRatio(color, bg) >= 4.5)) return color;
    color = shiftLightness(color, direction * 2);
  }
  return direction === 1 ? '#FFFFFF' : '#000000';
}

/* ── Variáveis do tema ──────────────────────────────────────────── */

export type ThemeVars = Record<string, string>;

export function accentVars(input: string, mode: AccentMode): ThemeVars {
  const primary = isValidHex(input) ? input.toUpperCase() : DEFAULT_ACCENT[mode];
  const onPrimary = readableTextOn(primary);

  if (mode === 'light') {
    const soft = mix(primary, '#FFFFFF', 0.14);
    const surface = mix(primary, '#FFFFFF', 0.04);
    const border = mix(primary, '#FFFFFF', 0.13);
    return {
      '--surface': surface,
      '--border': border,
      '--primary': primary,
      '--primary-hover': shiftLightness(primary, -8),
      '--primary-soft': soft,
      '--primary-text': ensureReadable(primary, [SURFACES.light.bg, surface, soft], -1),
      '--on-primary': onPrimary,
      '--ring': primary,
      '--scrollbar': mix(primary, '#FFFFFF', 0.45),
      '--chart-1': primary,
    };
  }

  const [r, g, b] = hexToRgb(primary);
  const softOnSurface = mix(primary, SURFACES.dark.surface, 0.15);
  return {
    '--primary': primary,
    '--primary-hover': shiftLightness(primary, 10),
    '--primary-soft': `rgba(${r}, ${g}, ${b}, 0.15)`,
    '--primary-text': ensureReadable(primary, [SURFACES.dark.bg, SURFACES.dark.elevated, softOnSurface], 1),
    '--on-primary': onPrimary,
    '--ring': primary,
    '--scrollbar': mix(primary, SURFACES.dark.surface, 0.35),
    '--chart-1': primary,
  };
}

const block = (selector: string, vars: ThemeVars) =>
  `${selector}{${Object.entries(vars)
    .map(([k, v]) => `${k}:${v}`)
    .join(';')}}`;

/**
 * CSS que sobrepõe as cores padrão. Seletores com especificidade dobrada para
 * vencer index.css independentemente da ordem dos <style>/<link> na página.
 */
export function accentCss(settings: AccentSettings): string {
  const parts: string[] = [];
  if (settings.light) parts.push(block(':root:not(.dark),.light.light', accentVars(settings.light, 'light')));
  if (settings.dark) parts.push(block('.dark.dark', accentVars(settings.dark, 'dark')));
  return parts.join('\n');
}

/* ── Aplicar e guardar ──────────────────────────────────────────── */

export const ACCENT_KEY = 'tema-cores';
/** CSS pronto, lido pelo script anti-flash do index.html */
export const ACCENT_CSS_KEY = 'tema-cores-css';
const STYLE_ID = 'cores-tema';

export function applyAccent(settings: AccentSettings) {
  let el = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement('style');
    el.id = STYLE_ID;
    document.head.appendChild(el);
  }
  el.textContent = accentCss(settings);
}

export function readStoredAccent(): AccentSettings {
  try {
    const raw = JSON.parse(localStorage.getItem(ACCENT_KEY) ?? '{}');
    return {
      light: isValidHex(raw.light ?? '') ? raw.light : null,
      dark: isValidHex(raw.dark ?? '') ? raw.dark : null,
    };
  } catch {
    return { light: null, dark: null };
  }
}

export function storeAccent(settings: AccentSettings) {
  try {
    localStorage.setItem(ACCENT_KEY, JSON.stringify(settings));
    localStorage.setItem(ACCENT_CSS_KEY, accentCss(settings));
  } catch {
    /* sem armazenamento: vale só nesta sessão */
  }
}
