import type { DocumentReference, Firestore } from 'firebase-admin/firestore';
import { adminDb } from './firebaseAdmin.js';
import { HttpError } from '../middleware/errorHandler.js';

export function requireDb(): Firestore {
  if (!adminDb) throw new HttpError(503, 'Firebase Admin não está configurado no servidor.');
  return adminDb;
}

export const userCol = (db: Firestore, uid: string, name: string) => db.collection('users').doc(uid).collection(name);

/** Executa operações em lotes (o Firestore aceita até 500 por lote). */
export async function inBatches<T>(db: Firestore, items: T[], apply: (batch: FirebaseFirestore.WriteBatch, item: T) => void) {
  for (let i = 0; i < items.length; i += 400) {
    const batch = db.batch();
    items.slice(i, i + 400).forEach((item) => apply(batch, item));
    await batch.commit();
  }
}

export async function deleteRefs(db: Firestore, refs: DocumentReference[]) {
  await inBatches(db, refs, (batch, ref) => batch.delete(ref));
}
