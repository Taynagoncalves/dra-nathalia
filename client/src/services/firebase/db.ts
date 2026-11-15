import { collection, doc, type DocumentSnapshot, type QuerySnapshot } from 'firebase/firestore';
import { getDb } from './app';

/** Nomes das subcoleções de users/{uid}. */
export type UserCollection =
  | 'projects'
  | 'subjects'
  | 'topics'
  | 'folders'
  | 'materials'
  | 'notes'
  | 'questions'
  | 'attempts'
  | 'quizzes'
  | 'quizResults'
  | 'errors'
  | 'studySessions'
  | 'goals'
  | 'events';

export const userCol = (uid: string, name: UserCollection) => collection(getDb(), 'users', uid, name);

export const userDoc = (uid: string, name: UserCollection, id: string) => doc(getDb(), 'users', uid, name, id);

/** Novo ID (sem gravar nada), útil para criar em lote. */
export const newId = (uid: string, name: UserCollection) => doc(userCol(uid, name)).id;

export function docsWithId<T>(snap: QuerySnapshot): T[] {
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as T);
}

export function docWithId<T>(snap: DocumentSnapshot): T | null {
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as T) : null;
}

/** O Firestore limita um lote a 500 operações: divide em partes. */
export function chunk<T>(items: T[], size = 450): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
