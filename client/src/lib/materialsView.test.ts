import { describe, expect, it } from 'vitest';
import type { Folder, Material } from '@/types/models';
import { explorerView, NO_FILTERS } from './materialsView';

const ts = (ms: number) => ({ toMillis: () => ms }) as unknown as Material['updatedAt'];

const folders = [
  { id: 'f1', parentId: null, name: 'Súmulas', updatedAt: ts(1) },
  { id: 'f2', parentId: 'f1', name: 'STJ', updatedAt: ts(2) },
] as Folder[];

const materials = [
  { id: 'm1', folderId: null, title: 'Apostila', kind: 'pdf', tags: [], favorite: false, updatedAt: ts(10) },
  { id: 'm2', folderId: 'f2', title: 'Súmula 7', kind: 'note', tags: ['stj'], favorite: true, updatedAt: ts(20) },
  { id: 'm3', folderId: 'f1', title: 'Resumo', kind: 'pdf', tags: ['revisao'], favorite: false, updatedAt: ts(30) },
] as Material[];

describe('explorerView', () => {
  it('sem filtros mostra só a pasta atual', () => {
    const v = explorerView(folders, materials, null, NO_FILTERS, 'nome');
    expect(v.folders.map((f) => f.id)).toEqual(['f1']);
    expect(v.materials.map((m) => m.id)).toEqual(['m1']);
  });

  it('a busca percorre a matéria inteira e ignora acentos', () => {
    const v = explorerView(folders, materials, null, { ...NO_FILTERS, search: 'sumula' }, 'nome');
    expect(v.folders.map((f) => f.id)).toEqual(['f1']);
    expect(v.materials.map((m) => m.id)).toEqual(['m2']);
  });

  it('filtra por tipo, favoritos e tag', () => {
    expect(explorerView(folders, materials, null, { ...NO_FILTERS, kind: 'pdf' }, 'nome').materials).toHaveLength(2);
    expect(explorerView(folders, materials, null, { ...NO_FILTERS, favorites: true }, 'nome').materials[0]!.id).toBe('m2');
    expect(explorerView(folders, materials, null, { ...NO_FILTERS, tag: 'revisao' }, 'nome').materials[0]!.id).toBe('m3');
  });

  it('ordena por data (mais recente primeiro)', () => {
    const v = explorerView(folders, materials, null, { ...NO_FILTERS, kind: 'todos', search: ' ' , favorites: false, tag: '' }, 'data');
    expect(v.searching).toBe(false);
    const all = explorerView(folders, materials, null, { ...NO_FILTERS, kind: 'pdf' }, 'data');
    expect(all.materials.map((m) => m.id)).toEqual(['m3', 'm1']);
  });
});
