/** Utilidades de cor (WCAG) para cores escolhidas pelo usuário. */

export const isValidHex = (value: string) => /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.trim());

export function hexToRgb(hex: string): [number, number, number] {
  let h = hex.trim().replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

export const LIGHT_TEXT = '#FFFFFF';
export const DARK_TEXT = '#1E1B2E';
const BLACK = '#000000';

/**
 * Cor de texto com melhor contraste sobre `bg` (cor escolhida pelo usuário).
 * Prefere branco ou o texto escuro do tema; se nenhum passar AA (4,5:1),
 * usa preto — branco ou preto sempre dão ≥ 4,58:1, para qualquer cor.
 */
export function readableTextOn(bg: string): string {
  if (!isValidHex(bg)) return DARK_TEXT;
  const best = contrastRatio(bg, LIGHT_TEXT) >= contrastRatio(bg, DARK_TEXT) ? LIGHT_TEXT : DARK_TEXT;
  if (contrastRatio(bg, best) >= 4.5) return best;
  return contrastRatio(bg, LIGHT_TEXT) >= contrastRatio(bg, BLACK) ? LIGHT_TEXT : BLACK;
}

/** Cor com transparência (para fundos suaves de cores do usuário). */
export function withAlpha(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgb(${r} ${g} ${b} / ${alpha})`;
}
