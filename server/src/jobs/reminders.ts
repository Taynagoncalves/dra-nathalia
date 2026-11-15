import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { sendToUser } from '../lib/push.js';
import { reminderText, stageFor } from './reminderRules.js';

/**
 * Lembretes automáticos (rodam de hora em hora):
 *  - eventos do calendário: 7 dias, 3 dias e 1 dia antes, e no dia
 *  - sequência de estudos em risco: às 19h, se ainda não estudou hoje
 * Cada lembrete vira uma notificação no site (users/{uid}/notifications) e
 * uma notificação no celular/computador (Web Push), uma única vez.
 */

const TZ = 'America/Sao_Paulo';

function nowInSaoPaulo(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return { today: `${get('year')}-${get('month')}-${get('day')}`, hour: Number(get('hour')) };
}

const addDays = (key: string, days: number) => {
  const [y, m, d] = key.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
};
const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);

/** Cria a notificação no site se ainda não existir (o site também cria as mesmas, com o mesmo ID). */
async function ensureInAppNotification(db: Firestore, uid: string, id: string, data: Record<string, unknown>) {
  try {
    await db.collection('users').doc(uid).collection('notifications').doc(id).create({
      ...data,
      read: false,
      createdAt: FieldValue.serverTimestamp(),
    });
  } catch (err) {
    if ((err as { code?: number }).code !== 6) throw err; // 6 = ALREADY_EXISTS
  }
}

export async function runReminders(db: Firestore, now = new Date()) {
  const { today, hour } = nowInSaoPaulo(now);
  const summary = { today, hour, eventReminders: 0, streakReminders: 0, pushes: 0 };
  if (hour < 7) return summary; // ninguém quer notificação de madrugada

  const users = new Map<string, FirebaseFirestore.DocumentData | undefined>();
  const userData = async (uid: string) => {
    if (!users.has(uid)) users.set(uid, (await db.collection('users').doc(uid).get()).data());
    return users.get(uid);
  };

  // 1) Eventos dos próximos 7 dias (todas as contas)
  const events = await db.collectionGroup('events').where('date', '>=', today).where('date', '<=', addDays(today, 7)).get();
  for (const doc of events.docs) {
    const e = doc.data() as { title: string; type: string; date: string; time?: string | null; done?: boolean; reminders?: Record<string, boolean> };
    const uid = doc.ref.parent.parent?.id;
    if (!uid || e.done) continue;
    const days = daysBetween(today, e.date);
    const stage = stageFor(days);
    if (stage === null || e.reminders?.[String(stage)]) continue;
    if ((await userData(uid))?.settings?.notifyEvents === false) continue;

    const text = reminderText(e, days);
    const url = `/calendario?data=${e.date}`;
    await ensureInAppNotification(db, uid, `${doc.id}_${stage}`, { kind: 'evento', ...text, url });
    summary.pushes += await sendToUser(db, uid, { ...text, url, tag: `evento-${doc.id}` });
    await doc.ref.update({ [`reminders.${stage}`]: true });
    summary.eventReminders += 1;
  }

  // 2) Sequência em risco: estudou ontem, ainda não hoje, a partir das 19h
  if (hour >= 19) {
    const atRisk = await db.collection('users').where('lastStudyDate', '==', addDays(today, -1)).get();
    for (const u of atRisk.docs) {
      const d = u.data();
      if (!d.streak || d.settings?.notifyStreak === false || d.streakReminderDate === today) continue;
      const text = {
        title: `Sua sequência de ${d.streak} ${d.streak === 1 ? 'dia' : 'dias'} está em risco 🔥`,
        body: 'Estude pelo menos alguns minutos hoje para não perder. Que tal um estudo rápido de 5 min?',
      };
      await ensureInAppNotification(db, u.id, `sequencia_${today}`, { kind: 'sequencia', ...text, url: '/' });
      summary.pushes += await sendToUser(db, u.id, { ...text, url: '/', tag: 'sequencia' });
      await u.ref.update({ streakReminderDate: today });
      summary.streakReminders += 1;
    }
  }

  return summary;
}
