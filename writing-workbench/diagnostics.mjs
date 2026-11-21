/* M1.4 browser diagnostics: isolated marker DB + read-only workspace audit.
   Never stores or exports manuscript or project names. */
import {CATALOG_STORE,SCENE_STORE,STORE_NAME} from './storage.mjs';
export const PROBE_DB='writing-workbench-selftest-v1';
export const PROBE_STORE='probes';
export const PROBE_KEY='reload-marker';
export const REQUIRED_SHELL=['index.html','app.js','storage.mjs','diagnostics.mjs','vault.mjs','workspace-vault.mjs','recovery.mjs','styles.css','manifest.json'];
const safe=async(fn,fallback=null)=>{try{return await fn();}catch(_){return fallback;}};
export function openDiagnosticDB(idb=globalThis.indexedDB) {
 return new Promise((resolve,reject)=>{
  if(!idb) return reject(Error('IndexedDB is unavailable'));
  const req=idb.open(PROBE_DB,1);
  req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains(PROBE_STORE))req.result.createObjectStore(PROBE_STORE);};
  req.onsuccess=()=>{const db=req.result;db.onversionchange=()=>db.close();resolve(db);};
  req.onblocked=()=>reject(Error('Diagnostic database is blocked by another page'));
  req.onerror=()=>reject(req.error||Error('Diagnostic database unavailable'));
 });
}
function operation(db,method,value) {
 return new Promise((resolve,reject)=>{
  if(!db)return reject(Error('Diagnostic database is unavailable'));
  const tx=db.transaction([PROBE_STORE],method==='get'?'readonly':'readwrite');
  const store=tx.objectStore(PROBE_STORE);
  const req=method==='get'?store.get(PROBE_KEY):method==='put'?store.put(value,PROBE_KEY):store.delete(PROBE_KEY);
  let result=null;
  req.onsuccess=()=>{if(method==='get')result=req.result||null;};
  tx.oncomplete=()=>resolve(method==='get'?result:value??true);
  tx.onabort=()=>reject(tx.error||Error('Diagnostic transaction aborted'));
  tx.onerror=()=>reject(tx.error||Error('Diagnostic transaction failed'));
 });
}
export const readProbe=diagnosticDb=>operation(diagnosticDb,'get');
export function writeProbe(diagnosticDb,sessionId,cryptoObject=globalThis.crypto,clock=()=>new Date().toISOString()){
 if(!sessionId||typeof sessionId!=='string')throw Error('Invalid diagnostic session');
 if(!cryptoObject?.randomUUID)throw Error('Secure random tokens unavailable');
 return operation(diagnosticDb,'put',{format:'writing-workbench-diagnostic',version:1,
  token:cryptoObject.randomUUID(),createdBy:sessionId,createdAt:clock()});
}
export const clearProbe=diagnosticDb=>operation(diagnosticDb,'delete');
export function classifyProbe(probe,sessionId,expectedToken=null){
 if(!probe)return {state:'not-started',text:'No test marker has been written.'};
 if(probe.format!=='writing-workbench-diagnostic'||probe.version!==1||!probe.token||!probe.createdBy)
  return {state:'invalid',text:'Diagnostic marker is malformed; no persistence claim can be made.'};
 if(probe.createdBy===sessionId)
  return {state:'pending',text:'Marker written in this page instance. Reopen or reload the app, then check again.'};
 if(!expectedToken||expectedToken!==probe.token)
  return {state:'inconclusive',text:'A marker exists but this tab cannot confirm its original token. Repeat the test in one tab.'};
 return {state:'reopened',text:'Marker verified after a page-instance change. This does not prove crash resilience or protection against storage eviction.'};
}
export function auditWorkspaceRecords(db){
 return new Promise((resolve,reject)=>{
  if(!db)return reject(Error('Writing database unavailable'));
  const tx=db.transaction([CATALOG_STORE,SCENE_STORE,'data'],'readonly');
  let catalog=null,sceneRecords=[],legacy=null;
  const a=tx.objectStore(CATALOG_STORE).get('main');a.onsuccess=()=>catalog=a.result;
  const b=tx.objectStore(SCENE_STORE).getAll();b.onsuccess=()=>sceneRecords=b.result||[];
  const c=tx.objectStore('data').get(STORE_NAME);c.onsuccess=()=>legacy=c.result;
  tx.oncomplete=()=>{
   try{
    const refs=(catalog?.projects||[]).flatMap(p=>p.scenes||[]);
    const unique=new Set(refs),stored=new Set(sceneRecords.map(s=>s.id));
    resolve({status:'checked',catalogFound:!!catalog,projectCount:catalog?.projects?.length??0,
      referencedScenes:refs.length,storedScenes:sceneRecords.length,
      missingReferences:[...unique].filter(id=>!stored.has(id)).length,
      unlinkedRecords:sceneRecords.filter(s=>!unique.has(s.id)).length,
      duplicateReferences:refs.length-unique.size,legacyMigrationCopyFound:!!legacy});
   }catch(e){reject(e);}
  };
  tx.onabort=()=>reject(tx.error||Error('Audit transaction aborted'));
  tx.onerror=()=>reject(tx.error||Error('Audit transaction failed'));
 });
}
export async function collectDiagnostics({db,diagnosticDb,sessionId,expectedToken=null,
 navigatorObject=globalThis.navigator,cachesObject=globalThis.caches,documentObject=globalThis.document,
 clock=()=>new Date().toISOString()}={}) {
 const probe=await safe(()=>readProbe(diagnosticDb));
 const probeResult=diagnosticDb?classifyProbe(probe,sessionId,expectedToken):{state:'unavailable',text:'Diagnostic database is unavailable; persistence cannot be tested.'};
 const storage=navigatorObject?.storage;
 const persisted=storage?.persisted?await safe(()=>storage.persisted()):null;
 const estimate=storage?.estimate?await safe(()=>storage.estimate()):null;
 const serviceWorker=navigatorObject?.serviceWorker;
 const registration=serviceWorker?.getRegistration?await safe(()=>serviceWorker.getRegistration()):null;
 const cacheNames=cachesObject?.keys?await safe(()=>cachesObject.keys(),[]):[];
 const candidateBase=documentObject?.baseURI||'';
 const base=/^https?:\/\//i.test(candidateBase)?candidateBase:'https://workbench.invalid/';
 const shell={};
 for(const asset of REQUIRED_SHELL){const url=new URL(asset,base).href;
  shell[asset]=Boolean(cachesObject?.match?await safe(()=>cachesObject.match(url)):null);}
 const audit=await safe(()=>auditWorkspaceRecords(db),{status:'unavailable'});
 return {reportType:'writing-workbench-storage-diagnostics',reportVersion:2,checkedAt:clock(),
  secureContext:typeof globalThis.isSecureContext==='boolean'?globalThis.isSecureContext:null,
  appDatabaseAvailable:Boolean(db),probe:{state:probeResult.state,message:probeResult.text,createdAt:probe?.createdAt||null},
  storage:{persistenceGranted:persisted===null?null:Boolean(persisted),
   approximateUsageBytes:Number.isFinite(estimate?.usage)?estimate.usage:null,
   approximateQuotaBytes:Number.isFinite(estimate?.quota)?estimate.quota:null},
  sceneAudit:audit,
  serviceWorker:{supported:Boolean(serviceWorker),controlled:Boolean(serviceWorker?.controller),
   registrationFound:Boolean(registration),cacheNames:cacheNames.filter(n=>n.startsWith('writing-workbench-')),
   cachedShell:shell,allExpectedAssetsCached:Object.values(shell).every(Boolean)},
  network:{navigatorReportsOnline:typeof navigatorObject?.onLine==='boolean'?navigatorObject.onLine:null},
  limitations:[
   'A verified marker after a page-instance change does not prove crash-safe writes or resistance to storage eviction.',
   'Cached app-shell assets do not prove a successful offline reload on a real device.',
   'Browser storage persistence is not an independent backup.',
   'Scene audit counts do not establish the integrity of every scene text or attachment.',
   'No manuscript, scene, project names or user-written text are included in this report.'
  ]};
}
