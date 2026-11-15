import { useQuery } from '@tanstack/react-query';
import { getDoc, getDocs, orderBy, query } from 'firebase/firestore';
import { docsWithId, docWithId, userCol, userDoc } from '@/services/firebase/db';
import type { LegalCase, Simulation } from '@/types/models';
import { useUid } from './useUid';

export function useCases() {
  const uid = useUid();
  return useQuery({
    queryKey: ['cases', uid],
    queryFn: async () => docsWithId<LegalCase>(await getDocs(query(userCol(uid, 'cases'), orderBy('createdAt', 'desc')))),
  });
}

export function useCase(caseId: string | undefined) {
  const uid = useUid();
  return useQuery({
    queryKey: ['case', uid, caseId],
    enabled: !!caseId,
    queryFn: async () => docWithId<LegalCase>(await getDoc(userDoc(uid, 'cases', caseId!))),
  });
}

/** Todas as simulações (filtradas por caso no client: evita índice composto). */
export function useSimulations() {
  const uid = useUid();
  return useQuery({
    queryKey: ['simulations', uid],
    queryFn: async () => docsWithId<Simulation>(await getDocs(query(userCol(uid, 'simulations'), orderBy('createdAt', 'desc')))),
  });
}

export function useSimulation(simId: string | undefined) {
  const uid = useUid();
  return useQuery({
    queryKey: ['simulation', uid, simId],
    enabled: !!simId,
    queryFn: async () => docWithId<Simulation>(await getDoc(userDoc(uid, 'simulations', simId!))),
  });
}
