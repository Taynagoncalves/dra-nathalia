import { addDoc, deleteDoc, getDocs, limit, orderBy, query, updateDoc, where } from 'firebase/firestore';
import type { CalendarEvent } from '@/types/models';
import { docsWithId, userCol, userDoc } from './db';

export type EventInput = Omit<CalendarEvent, 'id'>;

/** Eventos entre duas datas 'AAAA-MM-DD' (inclusive). */
export async function listEventsInRange(uid: string, start: string, end: string): Promise<CalendarEvent[]> {
  const snap = await getDocs(
    query(userCol(uid, 'events'), where('date', '>=', start), where('date', '<=', end), orderBy('date')),
  );
  return docsWithId<CalendarEvent>(snap);
}

/** Próximos eventos ainda não feitos (para o dashboard). */
export async function listUpcomingEvents(uid: string, from: string, max = 5): Promise<CalendarEvent[]> {
  const snap = await getDocs(
    query(userCol(uid, 'events'), where('done', '==', false), where('date', '>=', from), orderBy('date'), limit(max)),
  );
  return docsWithId<CalendarEvent>(snap);
}

export async function createEvent(uid: string, data: EventInput) {
  return (await addDoc(userCol(uid, 'events'), data)).id;
}

export async function updateEvent(uid: string, id: string, data: Partial<EventInput>) {
  await updateDoc(userDoc(uid, 'events', id), data);
}

export async function deleteEvent(uid: string, id: string) {
  await deleteDoc(userDoc(uid, 'events', id));
}
