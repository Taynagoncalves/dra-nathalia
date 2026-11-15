/* Service worker: permite instalar o site como app e receber notificações
   mesmo com o site fechado. Não guarda cache dos arquivos (o app sempre
   carrega a versão mais nova); sem internet, mostra uma página simples. */

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

const OFFLINE_HTML = `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Sem conexão</title><body style="font-family:system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;background:#0f0f14;color:#f5f5f7;text-align:center;padding:24px">
<div><p style="font-size:40px;margin:0">⚖️</p><h1 style="font-size:20px">Você está sem internet</h1><p style="color:#a1a1aa">Conecte-se e toque em tentar de novo.</p>
<button onclick="location.reload()" style="margin-top:12px;padding:10px 18px;border-radius:10px;border:0;background:#ec4899;color:#0f0f14;font-weight:600">Tentar de novo</button></div></body></html>`;

self.addEventListener('fetch', (event) => {
  if (event.request.mode !== 'navigate') return;
  event.respondWith(
    fetch(event.request).catch(() => new Response(OFFLINE_HTML, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })),
  );
});

// Notificação enviada pelo server (lembretes do calendário, sequência de estudos…)
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: 'Estudos', body: event.data ? event.data.text() : '' };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'Estudos', {
      body: data.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-96.png',
      tag: data.tag,
      renotify: !!data.tag,
      data: { url: data.url || '/' },
      lang: 'pt-BR',
    }),
  );
});

// Tocar na notificação abre (ou foca) o app na página certa.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || '/', self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if (w.url.startsWith(self.location.origin)) {
          w.focus();
          return w.navigate(url);
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
