import { addDoc, getDocs, orderBy, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import type { Folder } from '@/types/models';
import { apiFetch } from '../api';
import { docsWithId, userCol, userDoc } from './db';

export interface FolderInput {
  name: string;
  color: string;
  icon: string | null;
}

/** Todas as pastas da matéria (a árvore é montada no client). */
export async function listFolders(uid: string, subjectId: string): Promise<Folder[]> {
  const snap = await getDocs(query(userCol(uid, 'folders'), where('subjectId', '==', subjectId), orderBy('order')));
  return docsWithId<Folder>(snap);
}

export async function createFolder(uid: string, subjectId: string, parentId: string | null, data: FolderInput, order: number) {
  const ref = await addDoc(userCol(uid, 'folders'), {
    ...data,
    subjectId,
    parentId,
    order,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateFolder(uid: string, id: string, data: Partial<FolderInput & { parentId: string | null }>) {
  await updateDoc(userDoc(uid, 'folders', id), { ...data, updatedAt: serverTimestamp() });
}

export type DeleteFolderMode = 'moveUp' | 'cascade';

/** Feito no server: apaga em cascata e limpa os arquivos no Cloudinary. */
export async function deleteFolder(id: string, mode: DeleteFolderMode) {
  return apiFetch<{ filesFailed?: number }>(`/folders/${id}?mode=${mode}`, { method: 'DELETE' });
}
