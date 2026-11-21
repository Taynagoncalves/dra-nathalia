import { describe, expect, it } from 'vitest';
import { examMeta, normalizeBoard } from './boards';

describe('normalizeBoard', () => {
  it('reconhece variações comuns', () => {
    expect(normalizeBoard('CESPE / UnB')).toBe('Cebraspe');
    expect(normalizeBoard('cebraspe ')).toBe('Cebraspe');
    expect(normalizeBoard('Fundação Getúlio Vargas')).toBe('FGV');
    expect(normalizeBoard('Fundação Carlos Chagas')).toBe('FCC');
    expect(normalizeBoard('VUNESP')).toBe('Vunesp');
  });
  it('mantém outras bancas e trata vazio', () => {
    expect(normalizeBoard('Banca Própria TJSP')).toBe('Banca Própria TJSP');
    expect(normalizeBoard('  ')).toBe('');
    expect(normalizeBoard(null)).toBe('');
  });
});

describe('examMeta', () => {
  it('junta só o que existe', () => {
    expect(examMeta({ examBoard: 'FGV', examYear: 2024, institution: 'OAB', role: null })).toBe('FGV · 2024 · OAB');
    expect(examMeta({})).toBe('');
  });
});
