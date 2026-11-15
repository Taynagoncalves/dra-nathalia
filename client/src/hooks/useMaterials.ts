import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { friendlyError } from '@/lib/firebaseErrors';
import {
  createFolder,
  deleteFolder,
  listFolders,
  updateFolder,
  type DeleteFolderMode,
  type FolderInput,
} from '@/services/firebase/folders';
import {
  createLinkMaterial,
  createNoteMaterial,
  deleteMaterial,
  listMaterials,
  updateMaterial,
  type MaterialPatch,
} from '@/services/firebase/materials';
import type { Folder, Material } from '@/types/models';
import { useUid } from './useUid';

export const materialKeys = {
  folders: (uid: string, subjectId: string) => ['folders', uid, subjectId] as const,
  materials: (uid: string, subjectId: string) => ['materials', uid, subjectId] as const,
  note: (uid: string, id: string) => ['note', uid, id] as const,
};

const onError = (err: unknown) => toast.error(friendlyError(err));

export function useFolders(subjectId: string) {
  const uid = useUid();
  return useQuery({ queryKey: materialKeys.folders(uid, subjectId), queryFn: () => listFolders(uid, subjectId) });
}

export function useMaterials(subjectId: string) {
  const uid = useUid();
  return useQuery({ queryKey: materialKeys.materials(uid, subjectId), queryFn: () => listMaterials(uid, subjectId) });
}

export function useMaterialMutations(subjectId: string) {
  const uid = useUid();
  const qc = useQueryClient();
  const fKey = materialKeys.folders(uid, subjectId);
  const mKey = materialKeys.materials(uid, subjectId);
  const refreshFolders = () => qc.invalidateQueries({ queryKey: fKey });
  const refreshMaterials = () => qc.invalidateQueries({ queryKey: mKey });

  /** Mudança otimista numa lista do cache; devolve o estado anterior para desfazer. */
  async function optimistic<T>(key: readonly unknown[], change: (list: T[]) => T[]) {
    await qc.cancelQueries({ queryKey: key });
    const previous = qc.getQueryData<T[]>(key);
    if (previous) qc.setQueryData(key, change(previous));
    return { previous, key };
  }
  const rollback = (err: unknown, _v: unknown, ctx?: { previous?: unknown; key: readonly unknown[] }) => {
    if (ctx?.previous) qc.setQueryData(ctx.key, ctx.previous);
    onError(err);
  };

  return {
    createFolder: useMutation({
      mutationFn: (v: { parentId: string | null; data: FolderInput; order: number }) =>
        createFolder(uid, subjectId, v.parentId, v.data, v.order),
      onSuccess: refreshFolders,
      onError,
    }),
    updateFolder: useMutation({
      mutationFn: (v: { id: string; data: Partial<FolderInput & { parentId: string | null }> }) => updateFolder(uid, v.id, v.data),
      onMutate: (v) => optimistic<Folder>(fKey, (l) => l.map((f) => (f.id === v.id ? { ...f, ...v.data } : f))),
      onError: rollback,
      onSettled: refreshFolders,
    }),
    deleteFolder: useMutation({
      mutationFn: (v: { id: string; mode: DeleteFolderMode }) => deleteFolder(v.id, v.mode),
      onSuccess: (result) => {
        if (result?.filesFailed) {
          toast.warning(`${result.filesFailed} arquivo(s) não puderam ser apagados do Cloudinary.`);
        }
      },
      onError,
      onSettled: () => {
        refreshFolders();
        refreshMaterials();
      },
    }),
    createLink: useMutation({
      mutationFn: (v: { folderId: string | null; title: string; linkUrl: string; description?: string }) =>
        createLinkMaterial(uid, subjectId, v.folderId, v),
      onSuccess: refreshMaterials,
      onError,
    }),
    createNote: useMutation({
      mutationFn: (v: { folderId: string | null; title: string }) => createNoteMaterial(uid, subjectId, v.folderId, v.title),
      onSuccess: refreshMaterials,
      onError,
    }),
    updateMaterial: useMutation({
      mutationFn: (v: { id: string; data: MaterialPatch }) => updateMaterial(uid, v.id, v.data),
      onMutate: (v) => optimistic<Material>(mKey, (l) => l.map((m) => (m.id === v.id ? { ...m, ...v.data } : m))),
      onError: rollback,
      onSettled: refreshMaterials,
    }),
    deleteMaterial: useMutation({
      mutationFn: (m: Material) => deleteMaterial(uid, m),
      onMutate: (m) => optimistic<Material>(mKey, (l) => l.filter((x) => x.id !== m.id)),
      onError: rollback,
      onSettled: refreshMaterials,
    }),
  };
}
