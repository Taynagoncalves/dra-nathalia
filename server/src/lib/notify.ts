import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { HttpError } from '../middleware/errorHandler.js';
import { sendToUser } from './push.js';

/**
 * Avisa a pessoa que uma tarefa longa da IA terminou: notificação no site
 * (o site mostra um aviso na hora, em qualquer página) e no celular (Web Push),
 * útil quando ela saiu da página ou fechou o site.
 */
export async function notifyUser(db: Firestore, uid: string, n: { title: string; body: string; url: string; tag: string }) {
  try {
    await db.collection('users').doc(uid).collection('notifications').add({
      kind: 'sistema',
      title: n.title,
      body: n.body,
      url: n.url,
      read: false,
      createdAt: FieldValue.serverTimestamp(),
    });
    await sendToUser(db, uid, n);
  } catch (err) {
    console.warn('Falha ao notificar:', err);
  }
}

/** Mensagem segura para mostrar à pessoa quando uma tarefa em segundo plano falha. */
export function jobErrorMessage(err: unknown, fallback: string) {
  if (err instanceof HttpError) return err.message;
  console.error(fallback, err);
  return fallback;
}
