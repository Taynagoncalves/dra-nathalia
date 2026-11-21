import { addDoc, deleteDoc, getDocs, orderBy, query, serverTimestamp, updateDoc } from 'firebase/firestore';
import type { Question } from '@/types/models';
import { docsWithId, userCol, userDoc } from './db';

export type QuestionInput = Pick<
  Question,
  'subjectId' | 'statement' | 'type' | 'options' | 'correctAnswer' | 'explanation' | 'source' | 'difficulty'
> & { topicId: string | null; externalUrl: string };

/** Todas as questões do usuário (os filtros são aplicados no client). */
export async function listQuestions(uid: string): Promise<Question[]> {
  const snap = await getDocs(query(userCol(uid, 'questions'), orderBy('createdAt', 'desc')));
  return docsWithId<Question>(snap);
}

export async function createQuestion(uid: string, data: QuestionInput) {
  const ref = await addDoc(userCol(uid, 'questions'), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateQuestion(uid: string, id: string, data: Partial<QuestionInput>) {
  await updateDoc(userDoc(uid, 'questions', id), { ...data, updatedAt: serverTimestamp() });
}

/** As tentativas antigas ficam: continuam contando no desempenho da matéria. */
export async function deleteQuestion(uid: string, id: string) {
  await deleteDoc(userDoc(uid, 'questions', id));
}
