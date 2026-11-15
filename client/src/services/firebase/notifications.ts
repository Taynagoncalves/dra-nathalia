import {
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  getDocs,
  writeBatch,
  type Timestamp,
} from 'firebase/firestore';
import { getDb } from './app';
import { userCol } from './db';

export type NotificationKind = 'evento' | 'sequencia' | 'sistema';

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  /** página aberta ao clicar */
  url?: string;
  read: boolean;
  createdAt: Timestamp | null;
}

const col = (uid: string) => userCol(uid, 'notifications');

/** Escuta as 30 notificações mais recentes, em tempo real. */
export function watchNotifications(uid: string, cb: (list: AppNotification[]) => void, onError: (e: unknown) => void) {
  return onSnapshot(
    query(col(uid), orderBy('createdAt', 'desc'), limit(30)),
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as AppNotification)),
    onError,
  );
}

/** Cria a notificação só se ainda não existir (ID estável → sem duplicatas com o server). */
export async function ensureNotification(uid: string, id: string, data: Omit<AppNotification, 'id' | 'read' | 'createdAt'>) {
  const ref = doc(col(uid), id);
  if ((await getDoc(ref)).exists()) return false;
  await setDoc(ref, { ...data, read: false, createdAt: serverTimestamp() });
  return true;
}

export async function markNotificationRead(uid: string, id: string) {
  await updateDoc(doc(col(uid), id), { read: true });
}

export async function markAllNotificationsRead(uid: string) {
  const unread = await getDocs(query(col(uid), where('read', '==', false)));
  const batch = writeBatch(getDb());
  unread.docs.forEach((d) => batch.update(d.ref, { read: true }));
  await batch.commit();
}
