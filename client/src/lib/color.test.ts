import { describe, expect, it } from 'vitest';
import { PRESET_COLORS } from '@/config/constants';
import { contrastRatio, DARK_TEXT, LIGHT_TEXT, readableTextOn } from './color';

describe('readableTextOn', () => {
  it('usa texto claro sobre cores escuras e escuro sobre cores claras', () => {
    expect(readableTextOn('#000000')).toBe(LIGHT_TEXT);
    expect(readableTextOn('#FFFFFF')).toBe(DARK_TEXT);
    expect(readableTextOn('#EAB308')).toBe(DARK_TEXT);
  });

  it('todas as cores da paleta ficam legíveis (≥ 4,5:1) com o texto escolhido', () => {
    for (const { hex } of PRESET_COLORS) {
      expect(contrastRatio(hex, readableTextOn(hex))).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('qualquer cor personalizada fica legível (amostragem do espaço RGB)', () => {
    for (let r = 0; r <= 255; r += 17)
      for (let g = 0; g <= 255; g += 17)
        for (let b = 0; b <= 255; b += 17) {
          const hex = '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
          expect(contrastRatio(hex, readableTextOn(hex))).toBeGreaterThanOrEqual(4.5);
        }
  });
});
