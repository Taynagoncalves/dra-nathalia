import { describe, expect, it } from 'vitest';
import { htmlToMarkdown, safeFileName, toCsv } from './exporters';

describe('htmlToMarkdown', () => {
  it('converte títulos, parágrafos e marcas', () => {
    const html = '<h2>Contratos</h2><p>O contrato é <strong>bilateral</strong> e <em>oneroso</em>.</p><p>Veja <a href="https://x.com">o link</a>.</p>';
    expect(htmlToMarkdown(html)).toBe('## Contratos\n\nO contrato é **bilateral** e *oneroso*.\n\nVeja [o link](https://x.com).\n');
  });

  it('converte listas, inclusive aninhadas, e citações', () => {
    const html = '<ul><li><p>Requisitos</p><ul><li><p>agente capaz</p></li><li><p>objeto lícito</p></li></ul></li></ul><ol><li><p>um</p></li><li><p>dois</p></li></ol><blockquote><p>Pacta sunt servanda</p></blockquote>';
    expect(htmlToMarkdown(html)).toBe('- Requisitos\n  - agente capaz\n  - objeto lícito\n\n1. um\n2. dois\n\n> Pacta sunt servanda\n');
  });

  it('decodifica entidades', () => {
    expect(htmlToMarkdown('<p>A &amp; B &lt;art. 5º&gt;&nbsp;fim</p>')).toBe('A & B <art. 5º> fim\n');
  });
});

describe('safeFileName', () => {
  it('remove acentos e símbolos', () => {
    expect(safeFileName('Direito Civil — Contratos & Obrigações')).toBe('direito-civil-contratos-obrigacoes');
    expect(safeFileName('***')).toBe('arquivo');
  });
});

describe('toCsv', () => {
  it('usa ; e aspas quando precisa, com vírgula decimal', () => {
    expect(toCsv([['a', 'b;c', 1.5], ['diz "oi"', null, true]])).toBe('﻿a;"b;c";1,5\r\n"diz ""oi""";;true');
  });
});
