const CACHE = 'heliocentric-v3';
const SHELL = [
  './',
  './index.html',
  './loader.js',
  './app.part00.txt',
  './app.part01.txt',
  './app.part02.txt',
  './app.part03.txt',
  './app.part04.txt',
  './styles.css',
  './manifest.webmanifest',
  './heliocentric-icon.svg',
  '../vendor/react.development.js',
  '../vendor/react-dom.development.js',
  '../vendor/babel.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/tone/14.9.17/Tone.min.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key.startsWith('heliocentric-') && key !== CACHE).map((key) => caches.delete(key))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  const isAppSource = url.origin === self.location.origin && (
    url.pathname.endsWith('/index.html') ||
    url.pathname.endsWith('/loader.js') ||
    /\/app\.part\d+\.txt$/.test(url.pathname)
  );

  if (isAppSource) {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' })
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
      if (response && (response.ok || response.type === 'opaque')) {
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(event.request, copy));
      }
      return response;
    }))
  );
});
