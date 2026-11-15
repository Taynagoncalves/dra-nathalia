import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Bell, BellRing, CalendarDays, CheckCheck, Flame, Info, Trophy } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Dropdown } from '@/components/ui/Dropdown';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications } from '@/hooks/useNotifications';
import { cn } from '@/lib/cn';
import { markAllNotificationsRead, markNotificationRead, type NotificationKind } from '@/services/firebase/notifications';

const KIND_ICON: Record<NotificationKind, typeof Bell> = { evento: CalendarDays, sequencia: Flame, sistema: Info, conquista: Trophy };

/** Sino do topo: notificações do site (lembretes de eventos, sequência…). */
export function NotificationBell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { list, unread } = useNotifications();
  if (!user) return null;

  return (
    <Dropdown
      className="w-[min(22rem,calc(100vw-1rem))] p-0"
      trigger={({ toggle, open }) => (
        <Button
          variant="ghost"
          size="icon"
          onClick={toggle}
          aria-expanded={open}
          aria-label={unread ? `Notificações: ${unread} não lidas` : 'Notificações'}
          className="relative"
        >
          {unread ? <BellRing className="size-5" /> : <Bell className="size-5" />}
          {unread > 0 && (
            <span className="absolute top-1 right-1 grid min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] leading-4 font-bold text-on-primary">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </Button>
      )}
    >
      {(close) => (
        <div>
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <p className="text-sm font-semibold text-text">Notificações</p>
            {unread > 0 && (
              <button
                type="button"
                onClick={() => markAllNotificationsRead(user.uid).catch(() => {})}
                className="inline-flex items-center gap-1 text-xs text-primary-text hover:underline"
              >
                <CheckCheck className="size-3.5" /> Marcar todas como lidas
              </button>
            )}
          </div>
          {list.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-text-muted">
              Nada por aqui. Lembretes de provas, revisões e estudos aparecem aqui.
            </p>
          ) : (
            <ul className="max-h-[60dvh] divide-y divide-border overflow-y-auto">
              {list.map((n) => {
                const Icon = KIND_ICON[n.kind] ?? Info;
                return (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => {
                        if (!n.read) markNotificationRead(user.uid, n.id).catch(() => {});
                        close();
                        if (n.url) navigate(n.url);
                      }}
                      className={cn('flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-primary-soft', !n.read && 'bg-primary-soft/40')}
                    >
                      <Icon className={cn('mt-0.5 size-4 shrink-0', n.read ? 'text-text-muted' : 'text-primary-text')} aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className={cn('block text-sm text-text', !n.read && 'font-semibold')}>{n.title}</span>
                        <span className="block text-xs text-text-muted">{n.body}</span>
                        {n.createdAt && (
                          <span className="mt-0.5 block text-[11px] text-text-muted">
                            {formatDistanceToNow(n.createdAt.toDate(), { addSuffix: true, locale: ptBR })}
                          </span>
                        )}
                      </span>
                      {!n.read && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" aria-label="Não lida" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </Dropdown>
  );
}
