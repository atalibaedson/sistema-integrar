// Service worker do Sistema Integrar — SÓ recebe notificações push.
// Não guarda nada em cache de propósito: o app sempre vem fresco da rede, então
// uma publicação nova nunca fica presa numa versão antiga.

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

self.addEventListener('push', (event) => {
  let d = {}
  try {
    d = event.data ? event.data.json() : {}
  } catch {
    d = { titulo: 'Integração', corpo: event.data ? event.data.text() : '' }
  }
  event.waitUntil(
    self.registration.showNotification(d.titulo || 'Integração', {
      body: d.corpo || '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: d.tag || 'avisos', // mesma etiqueta substitui a anterior em vez de empilhar
      renotify: false,
      data: { url: d.url || '/#/avisos' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const destino = new URL((event.notification.data && event.notification.data.url) || '/#/avisos', self.location.origin).href
  event.waitUntil(
    (async () => {
      const abertas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const janela of abertas) {
        if (new URL(janela.url).origin !== self.location.origin) continue
        try {
          await janela.navigate(destino)
        } catch {
          // navigate não existe em todos os navegadores: o foco já traz o app
        }
        return janela.focus()
      }
      return self.clients.openWindow(destino)
    })(),
  )
})
