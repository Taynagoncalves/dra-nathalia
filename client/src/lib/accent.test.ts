import { describe, expect, it } from 'vitest';
import { PRESET_COLORS } from '@/config/constants';
import { accentCss, accentVars, mix } from './accent';
import { contrastRatio } from './color';

const sample: string[] = [...PRESET_COLORS.map((c) => c.hex), '#FFFF00', '#00FFFF', '#000000', '#FFFFFF', '#808080', '#1E3A8A', '#FDE68A'];
for (let r = 0; r <= 255; r += 51) for (let g = 0; g <= 255; g += 51) for (let b = 0; b <= 255; b += 51) {
  sample.push('#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join(''));
}

describe('accentVars — qualquer cor continua legível (AA)', () => {
  it('modo claro: links sobre fundo, superfície e fundo suave; texto sobre o botão', () => {
    for (const hex of sample) {
      const v = accentVars(hex, 'light');
      for (const bg of ['#FFFFFF', v['--surface']!, v['--primary-soft']!]) {
        expect(contrastRatio(v['--primary-text']!, bg), `${hex} sobre ${bg}`).toBeGreaterThanOrEqual(4.5);
      }
      expect(contrastRatio(v['--on-primary']!, v['--primary']!), hex).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('modo escuro: links sobre fundo, modal e fundo suave; texto sobre o botão', () => {
    for (const hex of sample) {
      const v = accentVars(hex, 'dark');
      for (const bg of ['#0F0F14', '#23232D', mix(hex, '#1A1A22', 0.15)]) {
        expect(contrastRatio(v['--primary-text']!, bg), `${hex} sobre ${bg}`).toBeGreaterThanOrEqual(4.5);
      }
      expect(contrastRatio(v['--on-primary']!, v['--primary']!), hex).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe('accentCss', () => {
  it('só gera o modo personalizado', () => {
    expect(accentCss({ light: null, dark: null })).toBe('');
    const css = accentCss({ light: '#16A34A', dark: null });
    expect(css).toContain(':root:not(.dark)');
    expect(css).not.toContain('.dark.dark');
  });
});
