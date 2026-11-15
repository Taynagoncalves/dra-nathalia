import type { Folder, Material, MaterialKind } from '@/types/models';

export type SortKey = 'nome' | 'data' | 'tipo';

export interface ViewFilters {
  search: string;
  kind: MaterialKind | 'todos';
  favorites: boolean;
  tag: string;
}

export const NO_FILTERS: ViewFilters = { search: '', kind: 'todos', favorites: false, tag: '' };

/** Busca sem diferenciar maiúsculas nem acentos ("sumula" encontra "Súmula"). */
export const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();

export const hasActiveFilters = (f: ViewFilters) =>
  !!f.search.trim() || f.kind !== 'todos' || f.favorites || !!f.tag;

const KIND_RANK: Record<MaterialKind, number> = { pdf: 0, word: 1, slides: 2, image: 3, link: 4, note: 5 };
const millis = (t: { toMillis?: () => number } | undefined) => t?.toMillis?.() ?? Number.MAX_SAFE_INTEGER;
const byName = (a: { title?: string; name?: string }, b: { title?: string; name?: string }) =>
  (a.title ?? a.name ?? '').localeCompare(b.title ?? b.name ?? '', 'pt-BR', { numeric: true, sensitivity: 'base' });

export function sortMaterials(list: Material[], sort: SortKey): Material[] {
  const out = [...list];
  if (sort === 'nome') out.sort(byName);
  // mais recentes primeiro (sem data = acabou de ser criado = topo)
  if (sort === 'data') out.sort((a, b) => millis(b.updatedAt) - millis(a.updatedAt));
  if (sort === 'tipo') out.sort((a, b) => KIND_RANK[a.kind] - KIND_RANK[b.kind] || byName(a, b));
  return out;
}

export function sortFolders(list: Folder[], sort: SortKey): Folder[] {
  const out = [...list];
  if (sort === 'data') out.sort((a, b) => millis(b.updatedAt) - millis(a.updatedAt));
  else out.sort(byName);
  return out;
}

/**
 * O que aparece no explorador.
 * - sem filtros: subpastas e materiais da pasta atual
 * - com busca/filtros: resultados da MATÉRIA INTEIRA (todas as subpastas);
 *   pastas só aparecem quando a busca casa com o nome delas
 */
export function explorerView(
  folders: Folder[],
  materials: Material[],
  currentFolderId: string | null,
  filters: ViewFilters,
  sort: SortKey,
) {
  const searching = hasActiveFilters(filters);
  const q = normalize(filters.search);

  if (!searching) {
    return {
      searching,
      folders: sortFolders(folders.filter((f) => (f.parentId ?? null) === currentFolderId), sort),
      materials: sortMaterials(materials.filter((m) => (m.folderId ?? null) === currentFolderId), sort),
    };
  }

  const onlyFolderSearch = filters.kind === 'todos' && !filters.favorites && !filters.tag;
  return {
    searching,
    folders: q && onlyFolderSearch ? sortFolders(folders.filter((f) => normalize(f.name).includes(q)), sort) : [],
    materials: sortMaterials(
      materials.filter(
        (m) =>
          (filters.kind === 'todos' || m.kind === filters.kind) &&
          (!filters.favorites || m.favorite) &&
          (!filters.tag || m.tags?.includes(filters.tag)) &&
          (!q || normalize(m.title).includes(q) || m.tags?.some((t) => normalize(t).includes(q))),
      ),
      sort,
    ),
  };
}

/** Todas as tags usadas na matéria, em ordem alfabética. */
export const allTags = (materials: Material[]) =>
  [...new Set(materials.flatMap((m) => m.tags ?? []))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
