const CACHE_NAME = 'pain-engine-ios-v7-import-progress';
const scopeUrl = self.registration.scope;
const shellUrl = (path) => new URL(path, scopeUrl).toString();
const APP_SHELL = [
  shellUrl('./'),
  shellUrl('./index.html'),
  shellUrl('./src/App.jsx'),
  shellUrl('./vendor/react.development.js'),
  shellUrl('./vendor/react-dom.development.js'),
  shellUrl('./vendor/babel.min.js'),
  shellUrl('./vendor/lucide.js'),
  shellUrl('./manifest.webmanifest'),
  shellUrl('./icons/pain-icon.svg')
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
      const copy = response.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
      return response;
    }).catch(() => caches.match(shellUrl('./index.html'))))
  );
});
