const CACHE='music-sketch-v0.7-pages';
const ASSETS=["./", "./index.html", "./manifest.webmanifest", "./icon.svg", "./payload/v07-styles.txt", "./payload/v07-app1.txt", "./payload/v07-app2.txt", "./payload/v07-app3.txt", "./payload/v07-app4.txt"];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));self.skipWaiting();});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE&&k.startsWith('music-sketch-')).map(k=>caches.delete(k)))));self.clients.claim();});
self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;e.respondWith(caches.match(e.request).then(cached=>cached||fetch(e.request).then(r=>{const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));return r;}).catch(()=>caches.match('./index.html'))));});
