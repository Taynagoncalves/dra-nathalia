import { addDoc, deleteDoc, getDocs, orderBy, query, updateDoc, where, writeBatch } from 'firebase/firestore';
import type { Topic, TopicStatus } from '@/types/models';
import { getDb } from './app';
import { docsWithId, userCol, userDoc } from './db';

export async function listTopics(uid: string, subjectId: string): Promise<Topic[]> {
  const snap = await getDocs(query(userCol(uid, 'topics'), where('subjectId', '==', subjectId), orderBy('order')));
  return docsWithId<Topic>(snap);
}

/** Todos os assuntos do usuário (para o progresso dos projetos). */
export async function listAllTopics(uid: string): Promise<Topic[]> {
  return docsWithId<Topic>(await getDocs(userCol(uid, 'topics')));
}

export async function createTopic(uid: string, subjectId: string, name: string, order: number) {
  const ref = await addDoc(userCol(uid, 'topics'), {
    subjectId,
    name,
    order,
    status: 'nao_iniciado' satisfies TopicStatus,
  });
  return ref.id;
}

export async function updateTopic(uid: string, id: string, data: Partial<Pick<Topic, 'name' | 'status'>>) {
  await updateDoc(userDoc(uid, 'topics', id), data);
}

export async function reorderTopics(uid: string, orderedIds: string[]) {
  const batch = writeBatch(getDb());
  orderedIds.forEach((id, index) => batch.update(userDoc(uid, 'topics', id), { order: index }));
  await batch.commit();
}

export async function deleteTopic(uid: string, id: string) {
  await deleteDoc(userDoc(uid, 'topics', id));
}
