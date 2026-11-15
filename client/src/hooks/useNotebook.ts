import { useQuery, useQueryClient } from '@tanstack/react-query';
import { deleteDoc, doc, getDocs, onSnapshot, query, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { userCol, userDoc } from '@/services/firebase/db';
import type { NotebookItem, NotebookMessage } from '@/types/models';
import { useUid } from './useUid';

/** Conversa do Caderno IA da matéria, em tempo real. */
export function useNotebookChat(subjectId: string) {
  const uid = useUid();
  const [messages, setMessages] = useState<NotebookMessage[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    return onSnapshot(
      doc(userCol(uid, 'notebookChats'), subjectId),
      (snap) => {
        setMessages((snap.get('messages') as NotebookMessage[] | undefined) ?? []);
        setLoading(false);
      },
      () => setLoading(false),
    );
  }, [uid, subjectId]);
  return { messages, loading };
}

export const notebookItemsKey = (uid: string, subjectId: string) => ['notebookItems', uid, subjectId] as const;

/** Itens gerados no estúdio (mais recentes primeiro). */
export function useNotebookItems(subjectId: string) {
  const uid = useUid();
  return useQuery({
    queryKey: notebookItemsKey(uid, subjectId),
    queryFn: async () => {
      const snap = await getDocs(query(userCol(uid, 'notebookItems'), where('subjectId', '==', subjectId)));
      return snap.docs
        .map((d) => ({ id: d.id, ...d.data() }) as NotebookItem)
        .sort((a, b) => (b.createdAt?.toMillis?.() ?? Date.now()) - (a.createdAt?.toMillis?.() ?? Date.now()));
    },
  });
}

export function useDeleteNotebookItem(subjectId: string) {
  const uid = useUid();
  const qc = useQueryClient();
  return async (id: string) => {
    await deleteDoc(userDoc(uid, 'notebookItems', id));
    qc.invalidateQueries({ queryKey: notebookItemsKey(uid, subjectId) });
  };
}
