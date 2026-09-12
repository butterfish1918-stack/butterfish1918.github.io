const CACHE = 'heliocentric-v1';
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
  '../vendor/babel.min.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(
    keys.filter((key) => key.startsWith('heliocentric-') && key !== CACHE).map((key) => caches.delete(key))
  )));
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request).then((response) => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        }
        return response;
      }).catch(() => cached || (event.request.mode === 'navigate' ? caches.match('./index.html') : undefined));
      return cached || network;
    })
  );
});
