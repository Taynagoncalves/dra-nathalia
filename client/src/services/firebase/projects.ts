import { addDoc, getDocs, orderBy, query, serverTimestamp, updateDoc } from 'firebase/firestore';
import type { Project, ProjectType } from '@/types/models';
import { apiFetch } from '../api';
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
 * Exclui o projeto com tudo dentro (matérias, assuntos, pastas, materiais e
 * arquivos, anotações, questões, erros). Feito no server, que limpa o Cloudinary.
 */
export async function deleteProject(id: string) {
  return apiFetch<{ deletedSubjects: number; filesOk: boolean }>(`/projects/${id}`, { method: 'DELETE' });
}
