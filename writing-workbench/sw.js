/* Writing Workbench M1.6 — strictly scoped, authenticated-host-safe app-shell cache.
   Only explicitly listed, correctly typed static assets are cached. Auth pages,
   unexpected URLs and redirects are NEVER put into Cache Storage. Replacements
   remain waiting until the writer explicitly approves an update. */
const CACHE = 'writing-workbench-m2-3-static-v15';
const ASSETS = [
  './', './index.html', './app.js', './styles.css', './storage.mjs',
  './diagnostics.mjs', './pwa-updates.mjs', './vault.mjs',
  './workspace-vault.mjs', './backup-check.mjs', './recovery.mjs', './manuscript-tools.mjs', './branches.mjs', './revision-desk.mjs', './manifest.json',
  './assets/icon-192.png', './assets/icon-512.png'
];
const SCOPE = self.registration.scope;
const ROOT_PATH = new URL('./', SCOPE).pathname;
const INDEX = new URL('./index.html', SCOPE).href;
const allowed = new Map(ASSETS.map(path => {
  const asset = new URL(path, SCOPE);
  return [asset.pathname, asset.href];
}));
function kind(pathname) {
  if (pathname === ROOT_PATH || pathname.endsWith('/index.html')) return 'html';
  if (pathname.endsWith('.css')) return 'css';
  if (pathname.endsWith('.js') || pathname.endsWith('.mjs')) return 'js';
  if (pathname.endsWith('/manifest.json') || pathname.endsWith('.webmanifest')) return 'manifest';
  if (pathname.endsWith('.png')) return 'image';
  return 'unknown';
}
function correctType(pathname, contentType) {
  const type = (contentType || '').split(';')[0].trim().toLowerCase();
  if (kind(pathname) === 'html') return type === 'text/html';
  if (kind(pathname) === 'css') return type === 'text/css';
  if (kind(pathname) === 'js') return type === 'text/javascript' || type === 'application/javascript';
  if (kind(pathname) === 'manifest') return type === 'application/manifest+json' || type === 'application/json';
  if (kind(pathname) === 'image') return type === 'image/png';
  return false;
}
async function safeStaticResponse(response, pathname) {
  const base = response && response.ok && response.status === 200 &&
    response.redirected !== true && response.type !== 'opaque' &&
    response.type !== 'opaqueredirect' &&
    correctType(pathname, response.headers?.get('content-type'));
  if (!base) return false;
  if (kind(pathname) === 'html') {
    // Some access gateways return an HTTP 200 HTML sign-in page. Reject it.
    const document = await response.clone().text();
    return document.includes('id="app"') &&
      document.includes('Writing Workbench') && document.includes('src="./app.js"');
  }
  return true;
}
function cacheableRequest(request) {
  if (request.method !== 'GET') return false;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !allowed.has(url.pathname)) return false;
  // Do not cache authentication, challenge, session, or arbitrary query URLs.
  if (url.search) {
    const isDocument = url.pathname === ROOT_PATH || url.pathname === new URL('./index.html', SCOPE).pathname;
    if (!isDocument || url.searchParams.size !== 1 ||
        !['fragment', 'write'].includes(url.searchParams.get('action'))) return false;
  }
  return true;
}
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    try {
      for (const path of ASSETS) {
        const url = new URL(path, SCOPE);
        // cache:'reload' avoids copying an old release from the HTTP cache.
        const response = await fetch(new Request(url.href, {cache:'reload', credentials:'same-origin'}));
        if (!(await safeStaticResponse(response, url.pathname))) {
          throw new Error(`App shell unavailable or redirected: ${path}`);
        }
        await cache.put(url.href, response);
      }
    } catch (error) {
      // Reject installation instead of caching an access-gateway login page.
      await caches.delete(CACHE);
      throw error;
    }
  })());
});
self.addEventListener('message', event => {
  if (event.data?.type === 'ACTIVATE_UPDATE') event.waitUntil(self.skipWaiting());
});
self.addEventListener('activate', event => {
  event.waitUntil(Promise.all([
    caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('writing-workbench-') && key !== CACHE).map(key => caches.delete(key)))),
    self.clients.claim()
  ]));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (!cacheableRequest(request)) return; // let normal network fetch handle everything else
  const url = new URL(request.url);
  const canonical = url.pathname === ROOT_PATH ? INDEX : allowed.get(url.pathname);
  event.respondWith((async () => {
    const cached = await caches.match(canonical);
    if (cached) return cached;
    const response = await fetch(request);
    if (await safeStaticResponse(response, url.pathname)) {
      const cache = await caches.open(CACHE);
      await cache.put(canonical, response.clone());
    }
    return response;
  })());
});
