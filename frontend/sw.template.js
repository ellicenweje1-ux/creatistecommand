/* Service worker for The Creatiste Command.
   Precaches the app shell (built JS/CSS, manifest, icons) so the installed app opens
   with no connection at all. API data is NOT handled here — the app layer caches it
   in IndexedDB (src/offline.js) so it can also queue and replay offline edits.
   This file is a template: the build inlines the precache list + a build id. */
const BUILD = '__BUILD_ID__'
const PRECACHE = __PRECACHE_MANIFEST__
const SHELL = `cc-shell-${BUILD}`
const RUNTIME = 'cc-runtime-v1'

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((cache) => cache.addAll(PRECACHE.map((url) => new Request(url, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== SHELL && k !== RUNTIME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)

  // API traffic belongs to the app layer (IndexedDB cache + outbox) — never intercept
  if (url.origin === location.origin && url.pathname.startsWith('/api/')) return

  // Audio (the landing-film voiceover) + any range request: let the browser handle
  // it natively. Caching partial 206 responses breaks media seeking, and the film
  // is a public marketing asset the installed app never needs offline.
  if (request.headers.has('range') || /\.(mp3|m4a|ogg|wav)$/i.test(url.pathname)) return

  // Page navigations: fresh from the network when online (so updates flow through),
  // the cached shell when not.
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match('/')))
    return
  }

  if (url.origin === location.origin) {
    // Uploaded photos (designs etc.): show the cached copy instantly, refresh behind
    if (url.pathname.startsWith('/uploads/')) {
      event.respondWith(staleWhileRevalidate(request))
      return
    }
    // Hashed build assets + icons: cache-first (immutable per build)
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((res) => {
            if (res.ok) putRuntime(request, res.clone())
            return res
          }),
      ),
    )
    return
  }

  // Cross-origin (Google Fonts): serve cached, refresh in the background
  event.respondWith(staleWhileRevalidate(request))
})

// Web Push: show the notification the server sent, and focus/open the app on tap.
// (Inert unless the chef has enabled notifications and VAPID keys are set server-side.)
self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch (e) {
    data = { body: event.data && event.data.text ? event.data.text() : '' }
  }
  const title = data.title || 'The Creatiste Command'
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || '',
      tag: data.tag || 'cc',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { url: data.url || '/app/tasks' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/app/tasks'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const c of clients) {
        if (c.url.includes(url) && 'focus' in c) return c.focus()
      }
      for (const c of clients) {
        if ('focus' in c) {
          if (c.navigate) c.navigate(url)
          return c.focus()
        }
      }
      return self.clients.openWindow(url)
    }),
  )
})

function putRuntime(request, response) {
  caches
    .open(RUNTIME)
    .then((cache) => cache.put(request, response))
    .catch(() => {})
}

function staleWhileRevalidate(request) {
  return caches.match(request).then((hit) => {
    const refresh = fetch(request)
      .then((res) => {
        if (res.ok || res.type === 'opaque') putRuntime(request, res.clone())
        return res
      })
      .catch(() => hit)
    return hit || refresh
  })
}
