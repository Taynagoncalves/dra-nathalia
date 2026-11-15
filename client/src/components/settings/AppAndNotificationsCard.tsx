import { BellOff, BellRing, Download, Send, Share, Smartphone, SquarePlus } from 'lucide-react';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { toast } from 'sonner';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardDescription, CardTitle } from '@/components/ui/Card';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/cn';
import { friendlyError } from '@/lib/firebaseErrors';
import { canPromptInstall, isIOS, isStandalone, onInstallChange, promptInstall } from '@/lib/pwa';
import { updateUserSettings } from '@/services/firebase/users';
import { disablePush, enablePush, getPushState, sendTestPush, type PushState } from '@/services/push';

/** Botão "Instalar app" (Chrome/Edge/Android) ou instruções (iPhone). */
export function useInstallState() {
  const canInstall = useSyncExternalStore(onInstallChange, canPromptInstall, () => false);
  return { canInstall, installed: isStandalone(), ios: isIOS() };
}

export function AppAndNotificationsCard() {
  const { user, profile, refreshProfile } = useAuth();
  const { canInstall, installed, ios } = useInstallState();
  const [push, setPush] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);

  const refreshPush = () => getPushState({ ios, standalone: installed }).then(setPush);
  useEffect(() => {
    refreshPush();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const run = async (fn: () => Promise<void>, ok?: string) => {
    setBusy(true);
    try {
      await fn();
      if (ok) toast.success(ok);
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setBusy(false);
      refreshPush();
    }
  };

  const toggle = async (key: 'notifyEvents' | 'notifyStreak', value: boolean) => {
    if (!user) return;
    await updateUserSettings(user.uid, { [key]: value }).catch((e) => toast.error(friendlyError(e)));
    await refreshProfile();
  };

  const prefs: { key: 'notifyEvents' | 'notifyStreak'; title: string; text: string }[] = [
    { key: 'notifyEvents', title: 'Lembretes do calendário', text: 'Provas, revisões e estudos: 7 dias, 3 dias e 1 dia antes, e no dia.' },
    { key: 'notifyStreak', title: 'Sequência em risco', text: 'Às 19h, se você ainda não estudou no dia.' },
  ];

  return (
    <Card className="space-y-5">
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary-text">
          <Smartphone className="size-4.5" />
        </span>
        <div>
          <CardTitle>App e notificações</CardTitle>
          <CardDescription>Instale o site como app e receba lembretes no celular, mesmo com ele fechado.</CardDescription>
        </div>
      </div>

      {/* 1. Instalar */}
      <section className="space-y-2">
        <p className="text-sm font-medium text-text">1. Instalar como app</p>
        {installed ? (
          <Badge variant="success">App instalado neste aparelho ✓</Badge>
        ) : canInstall ? (
          <Button
            onClick={() =>
              promptInstall().then((ok) => ok && toast.success('Instalando… o ícone ⚖️ vai aparecer na tela inicial.'))
            }
          >
            <Download className="size-4" /> Instalar app
          </Button>
        ) : ios ? (
          <ol className="list-decimal space-y-1 pl-5 text-sm text-text-muted">
            <li>
              Abra o site no <strong className="text-text">Safari</strong>.
            </li>
            <li>
              Toque em <Share className="inline size-4 align-[-3px]" /> <strong className="text-text">Compartilhar</strong>.
            </li>
            <li>
              Escolha <SquarePlus className="inline size-4 align-[-3px]" /> <strong className="text-text">Adicionar à Tela de Início</strong>.
            </li>
            <li>Abra pelo ícone ⚖️ e volte aqui para ativar as notificações.</li>
          </ol>
        ) : (
          <p className="text-sm text-text-muted">
            No celular Android ou no computador, use o menu do navegador (⋮) → <strong className="text-text">Instalar app</strong> ou{' '}
            <strong className="text-text">Adicionar à tela inicial</strong>.
          </p>
        )}
      </section>

      {/* 2. Ativar notificações */}
      <section className="space-y-2">
        <p className="text-sm font-medium text-text">2. Notificações neste aparelho</p>
        {push === null ? (
          <p className="text-sm text-text-muted">Verificando…</p>
        ) : push === 'instalar_primeiro' ? (
          <Alert variant="info">No iPhone, as notificações só funcionam com o app instalado (passo 1). Depois, abra pelo ícone e ative aqui.</Alert>
        ) : push === 'indisponivel' ? (
          <Alert variant="warning">Este navegador não aceita notificações. Use Chrome, Edge, Firefox ou o app instalado.</Alert>
        ) : push === 'bloqueado' ? (
          <Alert variant="warning" title="Notificações bloqueadas">
            Libere nas configurações do navegador (cadeado ao lado do endereço → Notificações → Permitir) e recarregue a página.
          </Alert>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            {push === 'ativo' ? (
              <>
                <Badge variant="success">
                  <BellRing className="size-3" /> Ativas
                </Badge>
                <Button variant="secondary" size="sm" loading={busy} onClick={() => run(sendTestPush, 'Notificação de teste enviada.')}>
                  <Send className="size-4" /> Enviar teste
                </Button>
                <Button variant="ghost" size="sm" disabled={busy} onClick={() => run(disablePush, 'Notificações desativadas neste aparelho.')}>
                  <BellOff className="size-4" /> Desativar
                </Button>
              </>
            ) : (
              <Button loading={busy} onClick={() => run(enablePush, 'Notificações ativadas!')}>
                <BellRing className="size-4" /> Ativar notificações
              </Button>
            )}
          </div>
        )}
      </section>

      {/* 3. O que avisar */}
      <section className="space-y-2">
        <p className="text-sm font-medium text-text">3. O que avisar</p>
        <ul className="space-y-2">
          {prefs.map((p) => {
            const on = profile?.settings?.[p.key] !== false;
            return (
              <li key={p.key}>
                <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3 hover:bg-primary-soft/40">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={on}
                    onClick={() => toggle(p.key, !on)}
                    className={cn('relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors', on ? 'bg-primary' : 'bg-border')}
                  >
                    <span className={cn('absolute top-0.5 size-4 rounded-full bg-bg shadow transition-[left]', on ? 'left-4.5' : 'left-0.5')} />
                    <span className="sr-only">{p.title}</span>
                  </button>
                  <span>
                    <span className="block text-sm font-medium text-text">{p.title}</span>
                    <span className="block text-xs text-text-muted">{p.text}</span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
        <p className="text-xs text-text-muted">Os avisos também aparecem no sino 🔔 no topo do site.</p>
      </section>
    </Card>
  );
}
