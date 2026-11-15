import { apiFetch } from './api';

/** Notificações no aparelho (Web Push): funcionam com o site fechado. */

export type PushState = 'indisponivel' | 'instalar_primeiro' | 'bloqueado' | 'ativo' | 'inativo';

const supported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

function urlBase64ToUint8Array(base64: string) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function currentSubscription() {
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

export async function getPushState(opts: { ios: boolean; standalone: boolean }): Promise<PushState> {
  // No iPhone/iPad, o push só existe com o site instalado na Tela de Início.
  if (opts.ios && !opts.standalone) return 'instalar_primeiro';
  if (!supported()) return 'indisponivel';
  if (Notification.permission === 'denied') return 'bloqueado';
  const sub = await currentSubscription().catch(() => null);
  return sub && Notification.permission === 'granted' ? 'ativo' : 'inativo';
}

export async function enablePush() {
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Permissão de notificação não concedida.');
  const { publicKey } = await apiFetch<{ publicKey: string }>('/push/public-key');
  const reg = await navigator.serviceWorker.ready;
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) }));
  await apiFetch('/push/subscribe', { method: 'POST', json: { subscription: sub.toJSON() } });
}

export async function disablePush() {
  const sub = await currentSubscription();
  if (!sub) return;
  await apiFetch('/push/unsubscribe', { method: 'POST', json: { endpoint: sub.endpoint } }).catch(() => {});
  await sub.unsubscribe();
}

export async function sendTestPush() {
  await apiFetch('/push/test', { method: 'POST' });
}
