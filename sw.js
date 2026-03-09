// ─────────────────────────────────────────────
// 🍀 Service Worker — Thales Cork 2026
// Cache-first para assets, network-first para API
// ─────────────────────────────────────────────

const CACHE_NAME = 'cork-2026-v1';
const STATIC_CACHE = 'cork-static-v1';

// Arquivos para cache imediato
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700;900&family=DM+Sans:wght@300;400;500;600&display=swap',
];

// ── INSTALL: pré-cacheia tudo ──
self.addEventListener('install', event => {
  console.log('[SW] Instalando...');
  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache => {
      return Promise.allSettled(
        PRECACHE_URLS.map(url => cache.add(url).catch(e => console.warn('[SW] Falhou cache:', url)))
      );
    }).then(() => self.skipWaiting())
  );
});

// ── ACTIVATE: limpa caches antigos ──
self.addEventListener('activate', event => {
  console.log('[SW] Ativando...');
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME && k !== STATIC_CACHE)
            .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── FETCH: estratégia inteligente ──
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // API Anthropic → sempre network (nunca cacheia respostas de API)
  if (url.hostname === 'api.anthropic.com') {
    event.respondWith(fetch(event.request).catch(() =>
      new Response(JSON.stringify({ error: 'offline' }), {
        headers: { 'Content-Type': 'application/json' }
      })
    ));
    return;
  }

  // Google Fonts → cache-first
  if (url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com')) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          const clone = response.clone();
          caches.open(STATIC_CACHE).then(cache => cache.put(event.request, clone));
          return response;
        });
      })
    );
    return;
  }

  // Wikipedia / Unsplash (fotos) → network-first com fallback
  if (url.hostname.includes('wikipedia.org') || url.hostname.includes('unsplash.com')) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }

  // Tudo mais (index.html, assets locais) → cache-first, atualiza em background
  event.respondWith(
    caches.match(event.request).then(cached => {
      const fetchPromise = fetch(event.request).then(response => {
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => null);

      return cached || fetchPromise;
    })
  );
});

// ── MENSAGENS ──
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

console.log('[SW] 🍀 Service Worker Cork 2026 carregado!');
