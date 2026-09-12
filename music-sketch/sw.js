const CACHE='music-sketch-v0.6-pages';
const ASSETS=["./","./index.html","./manifest.webmanifest","./icon.svg","./payload/styles.txt","./payload/app1.txt","./payload/app2.txt","./payload/app3.txt"];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{if(event.request.method!=='GET')return;event.respondWith(caches.match(event.request).then(hit=>hit||fetch(event.request).then(response=>{const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy)).catch(()=>{});return response;}).catch(()=>event.request.mode==='navigate'?caches.match('./index.html'):Promise.reject(new Error('offline')))));});
