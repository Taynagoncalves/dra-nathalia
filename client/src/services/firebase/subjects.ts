import {
  addDoc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import type { Subject } from '@/types/models';
import { getDb } from './app';
import { chunk, docsWithId, docWithId, userCol, userDoc } from './db';

export interface SubjectInput {
  name: string;
  color: string;
  icon: string;
}

export async function listSubjects(uid: string, projectId: string): Promise<Subject[]> {
  const snap = await getDocs(query(userCol(uid, 'subjects'), where('projectId', '==', projectId), orderBy('order')));
  return docsWithId<Subject>(snap);
}

/** Todas as matérias do usuário (timer, filtros, estatísticas). */
export async function listAllSubjects(uid: string): Promise<Subject[]> {
  const snap = await getDocs(query(userCol(uid, 'subjects'), orderBy('order')));
  return docsWithId<Subject>(snap);
}

export async function getSubject(uid: string, id: string): Promise<Subject | null> {
  return docWithId<Subject>(await getDoc(userDoc(uid, 'subjects', id)));
}

export async function createSubject(uid: string, projectId: string, data: SubjectInput, order: number) {
  const ref = await addDoc(userCol(uid, 'subjects'), {
    ...data,
    projectId,
    order,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateSubject(uid: string, id: string, data: Partial<SubjectInput & { projectId: string }>) {
  await updateDoc(userDoc(uid, 'subjects', id), { ...data, updatedAt: serverTimestamp() });
}

/** Salva a nova ordem depois de arrastar. */
export async function reorderSubjects(uid: string, orderedIds: string[]) {
  const batch = writeBatch(getDb());
  orderedIds.forEach((id, index) => batch.update(userDoc(uid, 'subjects', id), { order: index }));
  await batch.commit();
}

/**
 * Exclui a matéria e os assuntos dela.
 * Parte 4 em diante: também pastas, materiais (e arquivos no Cloudinary), questões e erros.
 */
export async function deleteSubject(uid: string, id: string) {
  const topics = await getDocs(query(userCol(uid, 'topics'), where('subjectId', '==', id)));
  const refs = [...topics.docs.map((d) => d.ref), userDoc(uid, 'subjects', id)];
  for (const part of chunk(refs)) {
    const batch = writeBatch(getDb());
    part.forEach((ref) => batch.delete(ref));
    await batch.commit();
  }
}
