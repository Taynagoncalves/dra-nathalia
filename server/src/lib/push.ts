import { createHash } from 'node:crypto';
import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { sendNotification, setVapidDetails, type PushSubscription } from 'web-push';
import { env, isPushConfigured } from '../config/env.js';
import { userCol } from './firestoreAdmin.js';

if (isPushConfigured) {
  setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY!, env.VAPID_PRIVATE_KEY!);
}

export interface PushPayload {
  title: string;
  body: string;
  /** página aberta ao tocar na notificação */
  url?: string;
  /** notificações com o mesmo tag se substituem */
  tag?: string;
}

/** ID estável por aparelho (o endpoint é único por navegador/app). */
export const subscriptionId = (endpoint: string) => createHash('sha256').update(endpoint).digest('hex').slice(0, 40);

export async function saveSubscription(db: Firestore, uid: string, sub: PushSubscription, userAgent: string) {
  await userCol(db, uid, 'pushSubscriptions')
    .doc(subscriptionId(sub.endpoint))
    .set({ ...sub, userAgent: userAgent.slice(0, 200), createdAt: FieldValue.serverTimestamp() });
}

export async function removeSubscription(db: Firestore, uid: string, endpoint: string) {
  await userCol(db, uid, 'pushSubscriptions').doc(subscriptionId(endpoint)).delete();
}

/**
 * Envia para todos os aparelhos do usuário. Inscrições expiradas (404/410)
 * são removidas. Devolve quantos aparelhos receberam.
 */
export async function sendToUser(db: Firestore, uid: string, payload: PushPayload): Promise<number> {
  if (!isPushConfigured) return 0;
  const subs = await userCol(db, uid, 'pushSubscriptions').get();
  let delivered = 0;
  await Promise.all(
    subs.docs.map(async (d) => {
      const { endpoint, keys } = d.data() as PushSubscription;
      try {
        await sendNotification({ endpoint, keys }, JSON.stringify(payload), { TTL: 60 * 60 * 12, urgency: 'normal' });
        delivered += 1;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) await d.ref.delete();
        else console.warn('Falha ao enviar push:', status, (err as Error).message);
      }
    }),
  );
  return delivered;
}
