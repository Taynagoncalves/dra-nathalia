import { doc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { dateKey } from '@/lib/dates';
import { nextStreak } from '@/lib/streak';
import { getDb } from './app';
import { userCol } from './db';
import { userRef } from './users';

export interface SessionInput {
  subjectId: string;
  activity: string;
  minutes: number;
}

/**
 * Salva a sessão em studySessions e atualiza a sequência (streak) do usuário,
 * tudo numa transação: as duas coisas acontecem juntas ou nenhuma acontece.
 */
export async function saveStudySession(uid: string, input: SessionInput): Promise<{ streak: number }> {
  const today = dateKey();
  const sessionRef = doc(userCol(uid, 'studySessions'));

  return runTransaction(getDb(), async (tx) => {
    const userSnap = await tx.get(userRef(uid));
    const data = userSnap.data() ?? {};
    const streak = nextStreak(Number(data.streak ?? 0), (data.lastStudyDate as string | null) ?? null, today);

    tx.set(sessionRef, { ...input, date: today, createdAt: serverTimestamp() });
    tx.update(userRef(uid), { streak, lastStudyDate: today });
    return { streak };
  });
}
