import type { Folder } from '@/types/models';

type FolderLike = Pick<Folder, 'id' | 'parentId'>;

/** parentId ('' = raiz) → pastas filhas */
export function childrenMap<T extends FolderLike>(folders: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const f of folders) {
    const key = f.parentId ?? '';
    map.set(key, [...(map.get(key) ?? []), f]);
  }
  return map;
}

/** Caminho da raiz até a pasta (inclusive). Protege contra ciclos. */
export function pathTo<T extends FolderLike>(folders: T[], folderId: string | null): T[] {
  const byId = new Map(folders.map((f) => [f.id, f]));
  const path: T[] = [];
  const seen = new Set<string>();
  let current = folderId ? byId.get(folderId) : undefined;
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    path.unshift(current);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return path;
}

/** A pasta e todas as que estão dentro dela, em qualquer nível. */
export function descendantIds(folders: FolderLike[], folderId: string): Set<string> {
  const children = childrenMap(folders);
  const out = new Set<string>();
  const stack = [folderId];
  while (stack.length) {
    const id = stack.pop()!;
    if (out.has(id)) continue;
    out.add(id);
    for (const c of children.get(id) ?? []) stack.push(c.id);
  }
  return out;
}

/** Uma pasta não pode ir para dentro dela mesma nem de uma subpasta dela. */
export function canMoveFolder(folders: FolderLike[], folderId: string, targetParentId: string | null): boolean {
  if (targetParentId === null) return true;
  return !descendantIds(folders, folderId).has(targetParentId);
}
