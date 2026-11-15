import { useQuery } from '@tanstack/react-query';
import { doc, getDocs, onSnapshot, orderBy, query } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { getAiStatus } from '@/services/ai';
import { docsWithId, userCol } from '@/services/firebase/db';
import type { Quiz } from '@/types/models';
import { useUid } from './useUid';

export const quizKeys = { list: (uid: string) => ['quizzes', uid] as const };

/** Histórico de quizzes (mais recentes primeiro). */
export function useQuizList() {
  const uid = useUid();
  return useQuery({
    queryKey: quizKeys.list(uid),
    queryFn: async () => docsWithId<Quiz>(await getDocs(query(userCol(uid, 'quizzes'), orderBy('createdAt', 'desc')))),
  });
}

/** Um quiz em tempo real (acompanha "gerando" → "pronto"). */
export function useLiveQuiz(quizId: string | undefined) {
  const uid = useUid();
  const [state, setState] = useState<{ quiz: Quiz | null; loading: boolean; error: unknown }>({ quiz: null, loading: true, error: null });
  useEffect(() => {
    if (!quizId) return;
    setState({ quiz: null, loading: true, error: null });
    return onSnapshot(
      doc(userCol(uid, 'quizzes'), quizId),
      (snap) => setState({ quiz: snap.exists() ? ({ id: snap.id, ...snap.data() } as Quiz) : null, loading: false, error: null }),
      (error) => setState({ quiz: null, loading: false, error }),
    );
  }, [uid, quizId]);
  return state;
}

/** A IA está configurada? Quanto do limite diário foi usado? */
export function useAiStatus() {
  const uid = useUid();
  return useQuery({ queryKey: ['ai-status', uid], queryFn: getAiStatus, staleTime: 30_000, retry: 0 });
}
