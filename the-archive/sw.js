const CACHE = 'archive-v13.0.0';
const CORE = ['./','./index.html','./app.js','./app.css','./storage.js','./config.js','./manifest.webmanifest','./icon.svg','./v13.js','./v13.css'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  if(event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if(url.origin === self.location.origin && (url.pathname.endsWith('/index.html') || url.pathname.endsWith('/app.js') || url.pathname.endsWith('/app.css') || url.pathname.endsWith('/storage.js'))){
    event.respondWith(fetch(event.request).then(response => {
      const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy));return response;
    }).catch(()=>caches.match(event.request)));
    return;
  }
  event.respondWith((async()=>{
    const cached=await caches.match(event.request);
    const network=fetch(event.request).then(response=>{
      if(response && (response.ok || response.type === 'opaque')){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy)).catch(()=>{});}return response;
    }).catch(()=>cached);
    return cached || network || Response.error();
  })());
});
