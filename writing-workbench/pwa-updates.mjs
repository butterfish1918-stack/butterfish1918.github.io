/* Writing Workbench M2.3 — explicit, save-gated PWA updates.
   Installation is automatic, but a *replacement* service worker waits for
   the writer to approve activation. This module does not move manuscript data. */
export const APP_VERSION = 'M2.3';
export function updateState(registration, supported=true) {
  if(!supported) return 'unsupported';
  if(!registration) return 'unregistered';
  if(registration.waiting) return 'ready';
  if(registration.installing) return 'installing';
  return 'current';
}
export async function checkForUpdate(registration) {
  if(!registration?.update) return {state:'unregistered'};
  await registration.update();
  return {state:updateState(registration)};
}
/* A UI event must request this after the app has confirmed all local writes.
   The caller is responsible for waiting for controllerchange before reloading. */
export async function approveUpdate(registration, assertSafeToReload) {
  if(typeof assertSafeToReload!=='function') throw Error('Save safety check required');
  if(!registration?.waiting) return {state:'no-update'};
  const safe=await assertSafeToReload();
  if(!safe) return {state:'unsafe'};
  if(!registration.waiting) return {state:'no-update'};
  registration.waiting.postMessage({type:'ACTIVATE_UPDATE'});
  return {state:'requested'};
}
