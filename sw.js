const CACHE_NAME = 'pain-engine-ios-v12-mono-register-cloud';
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
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key !== CACHE_NAME && !key.startsWith('heliocentric-')).map((key) => caches.delete(key))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  // Heliocentric is an independent sub-app. Do not let the root Pain Engine
  // cache intercept its JavaScript/assets or substitute the root index page.
  const requestUrl = new URL(event.request.url);
  if (requestUrl.pathname.includes('/heliocentric/')) return;

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
      const copy = response.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
      return response;
    }).catch(() => caches.match(shellUrl('./index.html'))))
  );
});
