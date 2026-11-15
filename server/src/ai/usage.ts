import type { Firestore } from 'firebase-admin/firestore';
import { env } from '../config/env.js';
import { userCol } from '../lib/firestoreAdmin.js';
import { HttpError } from '../middleware/errorHandler.js';

/** Dia ('AAAA-MM-DD') no fuso de São Paulo. */
export const todaySP = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

/**
 * Limite de uso por usuário por dia (controle de custo).
 * Conta antes de chamar a IA; se a chamada falhar, devolve a unidade.
 */
export async function consumeAiCredit(db: Firestore, uid: string, kind: string) {
  const ref = userCol(db, uid, 'aiUsage').doc(todaySP());
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const count = Number(snap.get('count') ?? 0);
    if (count >= env.AI_DAILY_LIMIT) {
      throw new HttpError(429, `Você atingiu o limite de ${env.AI_DAILY_LIMIT} usos da IA hoje. Ele renova amanhã.`);
    }
    const byKind = (snap.get('byKind') as Record<string, number> | undefined) ?? {};
    tx.set(ref, { count: count + 1, byKind: { [kind]: (byKind[kind] ?? 0) + 1 } }, { merge: true });
  });
  return async function refund() {
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      tx.set(ref, { count: Math.max(0, Number(snap.get('count') ?? 1) - 1) }, { merge: true });
    });
  };
}

export async function aiUsageToday(db: Firestore, uid: string) {
  const snap = await userCol(db, uid, 'aiUsage').doc(todaySP()).get();
  return { used: Number(snap.get('count') ?? 0), limit: env.AI_DAILY_LIMIT };
}
