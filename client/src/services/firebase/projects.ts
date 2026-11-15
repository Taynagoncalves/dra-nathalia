import {
  addDoc,
  deleteDoc,
  getCountFromServer,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import type { Project, ProjectType } from '@/types/models';
import { docsWithId, userCol, userDoc } from './db';

export interface ProjectInput {
  name: string;
  type: ProjectType;
  color: string;
  icon: string;
}

export async function listProjects(uid: string): Promise<Project[]> {
  const snap = await getDocs(query(userCol(uid, 'projects'), orderBy('order')));
  return docsWithId<Project>(snap);
}

export async function createProject(uid: string, data: ProjectInput, order: number) {
  const ref = await addDoc(userCol(uid, 'projects'), {
    ...data,
    order,
    archived: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateProject(uid: string, id: string, data: Partial<ProjectInput & { archived: boolean }>) {
  await updateDoc(userDoc(uid, 'projects', id), { ...data, updatedAt: serverTimestamp() });
}

/**
 * Só exclui projeto vazio: as matérias guardam materiais, questões e erros,
 * então a exclusão delas precisa ser uma decisão explícita, matéria por matéria.
 */
export async function deleteProject(uid: string, id: string) {
  const count = await getCountFromServer(query(userCol(uid, 'subjects'), where('projectId', '==', id)));
  if (count.data().count > 0) {
    throw new Error('Exclua as matérias deste projeto antes de excluí-lo (ou arquive o projeto).');
  }
  await deleteDoc(userDoc(uid, 'projects', id));
}
