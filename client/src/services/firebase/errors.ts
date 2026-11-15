import { addDoc, deleteDoc, getDocs, orderBy, query, serverTimestamp, updateDoc } from 'firebase/firestore';
import type { ErrorCategory, ErrorEntry } from '@/types/models';
import { docsWithId, userCol, userDoc } from './db';

export interface ErrorInput {
  questionId: string | null;
  subjectId: string;
  topicId: string | null;
  category: ErrorCategory;
  note: string;
  simulationId?: string | null;
}

/** Caderno de erros (todas as entradas; filtros no client). */
export async function listErrors(uid: string): Promise<ErrorEntry[]> {
  const snap = await getDocs(query(userCol(uid, 'errors'), orderBy('createdAt', 'desc')));
  return docsWithId<ErrorEntry>(snap);
}

export async function createError(uid: string, data: ErrorInput) {
  const ref = await addDoc(userCol(uid, 'errors'), {
    ...data,
    simulationId: data.simulationId ?? null,
    resolved: false,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateError(uid: string, id: string, data: Partial<Pick<ErrorEntry, 'category' | 'note' | 'resolved'>>) {
  await updateDoc(userDoc(uid, 'errors', id), data);
}

export async function deleteError(uid: string, id: string) {
  await deleteDoc(userDoc(uid, 'errors', id));
}
