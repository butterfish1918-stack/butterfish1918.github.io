const CACHE = 'grimoire-engine-v4';
const CORE = [
  './', './index.html', './boot.js', './mobile.css', './manifest.webmanifest', './icon.svg',
  './chunks16/c01.js', './chunks16/c02.js', './chunks16/c03.js', './chunks16/c04.js',
  './chunks16/c05.js', './chunks16/c06.js', './chunks16/c07.js', './chunks16/c08.js',
  './chunks16/c09.js', './chunks16/c10.js', './chunks16/c11.js', './chunks16/c12.js',
  './chunks16/c13a.js', './chunks16/c13b.js', './chunks16/c14.js', './chunks16/c15.js', './chunks16/c16.js',
  'https://cdn.tailwindcss.com',
  'https://unpkg.com/react@18.3.1/umd/react.production.min.js',
  'https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js'
];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => Promise.all(CORE.map(url => cache.add(url).catch(() => null)))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
      const copy = response.clone();
      caches.open(CACHE).then(cache => cache.put(event.request, copy)).catch(() => {});
      return response;
    }).catch(() => event.request.mode === 'navigate' ? caches.match('./index.html') : Response.error()))
  );
});
