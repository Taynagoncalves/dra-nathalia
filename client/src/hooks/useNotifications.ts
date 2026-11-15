import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { dateKey, addDaysToKey } from '@/lib/dates';
import { reminderId, reminderText, stageFor } from '@/lib/reminders';
import { listEventsInRange } from '@/services/firebase/events';
import { ensureNotification, watchNotifications, type AppNotification } from '@/services/firebase/notifications';

/** Notificações do site em tempo real. Avisa com um toast quando chega uma nova. */
export function useNotifications() {
  const { user } = useAuth();
  const [list, setList] = useState<AppNotification[]>([]);
  const seen = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (!user) return;
    seen.current = null;
    return watchNotifications(
      user.uid,
      (items) => {
        // Primeira leitura: só registra; depois, avisa as novas não lidas.
        if (seen.current) {
          for (const n of items) if (!seen.current.has(n.id) && !n.read) toast(n.title, { description: n.body });
        }
        seen.current = new Set(items.map((n) => n.id));
        setList(items);
      },
      () => {},
    );
  }, [user]);

  return { list, unread: list.filter((n) => !n.read).length };
}

/**
 * Ao abrir o site (uma vez por dia), cria as notificações internas dos lembretes
 * do calendário — assim elas aparecem mesmo que o agendador do server não tenha rodado.
 */
export function useLocalReminders() {
  const { user, profile } = useAuth();
  useEffect(() => {
    if (!user || !profile || profile.settings?.notifyEvents === false) return;
    const today = dateKey();
    const key = `lembretes-${user.uid}-${today}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, '1');
    } catch {
      /* segue sem a trava */
    }
    listEventsInRange(user.uid, today, addDaysToKey(today, 7))
      .then(async (events) => {
        for (const e of events) {
          if (e.done) continue;
          const days = Math.round((Date.parse(`${e.date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
          const stage = stageFor(days);
          if (stage === null) continue;
          await ensureNotification(user.uid, reminderId(e.id, stage), {
            kind: 'evento',
            ...reminderText(e, days),
            url: `/calendario?data=${e.date}`,
          });
        }
      })
      .catch(() => {});
  }, [user, profile]);
}
