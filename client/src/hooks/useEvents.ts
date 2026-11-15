import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { dateKey } from '@/lib/dates';
import { friendlyError } from '@/lib/firebaseErrors';
import {
  createEvent,
  deleteEvent,
  listEventsInRange,
  listUpcomingEvents,
  updateEvent,
  type EventInput,
} from '@/services/firebase/events';
import type { CalendarEvent } from '@/types/models';
import { useUid } from './useUid';

const root = (uid: string) => ['events', uid] as const;
const onError = (err: unknown) => toast.error(friendlyError(err));

export function useEventsInRange(start: string, end: string) {
  const uid = useUid();
  return useQuery({
    queryKey: [...root(uid), 'range', start, end],
    queryFn: () => listEventsInRange(uid, start, end),
    placeholderData: (prev) => prev, // mantém o mês anterior na tela enquanto carrega o próximo
  });
}

export function useUpcomingEvents(max = 5) {
  const uid = useUid();
  const today = dateKey();
  return useQuery({ queryKey: [...root(uid), 'upcoming', today, max], queryFn: () => listUpcomingEvents(uid, today, max) });
}

export function useEventMutations() {
  const uid = useUid();
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: root(uid) });

  /** Atualiza na hora todas as listas de eventos em cache (otimista). */
  const optimistic = async (change: (list: CalendarEvent[]) => CalendarEvent[]) => {
    await qc.cancelQueries({ queryKey: root(uid) });
    const snapshot = qc.getQueriesData<CalendarEvent[]>({ queryKey: root(uid) });
    for (const [key, data] of snapshot) if (data) qc.setQueryData(key, change(data));
    return { snapshot };
  };
  const rollback = (err: unknown, _v: unknown, ctx?: { snapshot: [readonly unknown[], CalendarEvent[] | undefined][] }) => {
    ctx?.snapshot.forEach(([key, data]) => qc.setQueryData(key, data));
    onError(err);
  };

  return {
    create: useMutation({ mutationFn: (data: EventInput) => createEvent(uid, data), onSuccess: refresh, onError }),
    update: useMutation({
      mutationFn: (v: { id: string; data: Partial<EventInput> }) => updateEvent(uid, v.id, v.data),
      onMutate: (v) => optimistic((l) => l.map((e) => (e.id === v.id ? { ...e, ...v.data } : e))),
      onError: rollback,
      onSettled: refresh,
    }),
    remove: useMutation({
      mutationFn: (id: string) => deleteEvent(uid, id),
      onMutate: (id) => optimistic((l) => l.filter((e) => e.id !== id)),
      onError: rollback,
      onSettled: refresh,
    }),
  };
}
