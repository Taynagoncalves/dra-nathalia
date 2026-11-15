import { describe, expect, it } from 'vitest';
import { canMoveFolder, descendantIds, pathTo } from './folderTree';

// raiz ─ A ─ B ─ C
//      └ D
const folders = [
  { id: 'A', parentId: null },
  { id: 'B', parentId: 'A' },
  { id: 'C', parentId: 'B' },
  { id: 'D', parentId: null },
];

describe('folderTree', () => {
  it('monta o caminho até a pasta', () => {
    expect(pathTo(folders, 'C').map((f) => f.id)).toEqual(['A', 'B', 'C']);
    expect(pathTo(folders, null)).toEqual([]);
  });

  it('acha todos os descendentes', () => {
    expect([...descendantIds(folders, 'A')].sort()).toEqual(['A', 'B', 'C']);
  });

  it('impede mover pasta para dentro de si mesma ou de uma subpasta', () => {
    expect(canMoveFolder(folders, 'A', 'A')).toBe(false);
    expect(canMoveFolder(folders, 'A', 'C')).toBe(false);
    expect(canMoveFolder(folders, 'C', 'D')).toBe(true);
    expect(canMoveFolder(folders, 'B', null)).toBe(true);
  });

  it('não entra em loop se os dados tiverem um ciclo', () => {
    const cyclic = [
      { id: 'X', parentId: 'Y' },
      { id: 'Y', parentId: 'X' },
    ];
    expect(pathTo(cyclic, 'X').length).toBe(2);
  });
});
