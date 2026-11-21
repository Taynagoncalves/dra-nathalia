import { useQuery } from '@tanstack/react-query';
import { getDoc, getDocs, orderBy, query } from 'firebase/firestore';
import { docsWithId, docWithId, userCol, userDoc } from '@/services/firebase/db';
import type { QuestionImport } from '@/types/models';
import { useUid } from './useUid';

export function useQuestionImports() {
  const uid = useUid();
  return useQuery({
    queryKey: ['questionImports', uid],
    queryFn: async () => docsWithId<QuestionImport>(await getDocs(query(userCol(uid, 'questionImports'), orderBy('createdAt', 'desc')))),
    refetchInterval: (q) => (q.state.data?.some((i) => i.status === 'processando') ? 5000 : false),
  });
}

export function useQuestionImport(importId: string) {
  const uid = useUid();
  return useQuery({
    queryKey: ['questionImport', uid, importId],
    queryFn: async () => docWithId<QuestionImport>(await getDoc(userDoc(uid, 'questionImports', importId))),
    // enquanto a IA lê a prova, relê a cada 4 s (as questões aparecem aos poucos)
    refetchInterval: (q) => (q.state.data?.status === 'processando' ? 4000 : false),
  });
}
