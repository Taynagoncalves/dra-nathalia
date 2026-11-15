import { addDoc, getDocs, orderBy, query, serverTimestamp } from 'firebase/firestore';
import type { Attempt } from '@/types/models';
import { docsWithId, userCol } from './db';

export type AttemptInput = Pick<Attempt, 'questionId' | 'subjectId' | 'answer' | 'isCorrect' | 'timeSpentSec'> & {
  topicId: string | null;
  quizId: string | null;
};

export async function listAttempts(uid: string): Promise<Attempt[]> {
  const snap = await getDocs(query(userCol(uid, 'attempts'), orderBy('createdAt', 'desc')));
  return docsWithId<Attempt>(snap);
}

export async function createAttempt(uid: string, data: AttemptInput) {
  const ref = await addDoc(userCol(uid, 'attempts'), { ...data, createdAt: serverTimestamp() });
  return ref.id;
}
