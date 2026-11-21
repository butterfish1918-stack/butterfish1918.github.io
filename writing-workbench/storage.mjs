/* Writing Workbench M1.3. IndexedDB v2: one record per scene; separate catalog
   and device preferences. Existing v1 workspace is retained as a read-only
   migration safety copy in the 'data' object store. No cloud synchronization. */
export const DB_NAME = 'writing-workbench-local-v1';
export const DB_VERSION = 2;
export const STORE_NAME = 'workspace'; // v1 legacy key, retained for recovery
export const CATALOG_STORE = 'catalog-v2';
export const SCENE_STORE = 'scenes-v2';
export const PREFS_STORE = 'prefs-v2';
const MAIN = 'main';
const clone = value => JSON.parse(JSON.stringify(value));
const stripRevision = value => {const {_revision, ...rest}=value;return rest;};
const fail = message => {throw new Error(message);};

export class ConcurrentWorkspaceEdit extends Error {
  constructor(kind='scene', id=''){
    super(`Another tab changed this ${kind}${id ? ` (${id})` : ''}. No manuscript data was overwritten. Export this tab’s backup before reloading.`);
    this.name='ConcurrentWorkspaceEdit'; this.kind=kind; this.recordId=id;
  }
}

export async function openWorkspaceDB(){
  return new Promise((resolve,reject)=>{
    if(!('indexedDB' in globalThis))return reject(new Error('IndexedDB unavailable'));
    const req=indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded=()=>{
      const db=req.result;
      for(const name of ['data',CATALOG_STORE,SCENE_STORE,PREFS_STORE])
        if(!db.objectStoreNames.contains(name))db.createObjectStore(name);
    };
    req.onsuccess=()=>{const db=req.result;db.onversionchange=()=>db.close();resolve(db);};
    req.onerror=()=>reject(req.error||new Error('Database open failed'));
    req.onblocked=()=>reject(new Error('Database upgrade blocked: close older Writing Workbench tabs, then reopen. Your existing data is preserved.'));
  });
}

function catalogOf(data){
  return {schemaVersion:2, projects:data.projects.map(project=>{
    // Retain unrecognised future project metadata instead of stripping it.
    // The scene objects themselves always live in their separate records.
    const {scenes,updatedAt,_storage,...metadata}=project;
    return {...metadata,fragments:project.fragments||[],scenes:scenes.map(scene=>scene.id)};
  })};
}
function prefsOf(data){return {activeProjectId:data.activeProjectId,activeSceneId:data.activeSceneId,activeBranchId:data.activeBranchId||null,settings:data.settings};}
function allScenes(data){return data.projects.flatMap(project=>project.scenes);}
function uniqueSceneMap(data){
  if(!data||!Array.isArray(data.projects))fail('Invalid workspace for storage');
  const seen=new Set(),map=new Map();
  for(const project of data.projects){
    if(!project.id||!Array.isArray(project.scenes)||!Array.isArray(project.fragments||[]))fail('Invalid project for storage');
    for(const scene of project.scenes){
      if(!scene.id||seen.has(scene.id))fail('Duplicate or invalid scene ID');
      seen.add(scene.id);map.set(scene.id,scene);
    }
  }
  return map;
}
function revisionOf(item){return Number.isSafeInteger(item?._revision)?item._revision:null;}
function effectiveRevision(storage){return (storage.catalogRevision??0)+Object.values(storage.sceneRevisions||{}).reduce((n,v)=>n+v,0);}
export const readRevision=data=>Number.isSafeInteger(data?._storage?.revision)?data._storage.revision:0;
function asLoadedState(catalog,preferences,records){
  if(!catalog)return null;
  const byId=new Map(records.map(scene=>[scene.id,scene]));
  const sceneRevisions={};
  const projects=catalog.projects.map(p=>{
    const scenes=p.scenes.map(id=>{
      const record=byId.get(id);
      if(!record)fail(`Stored project ${p.id} references missing scene ${id}; original data has not been changed`);
      sceneRevisions[id]=revisionOf(record)??0;
      return stripRevision(record);
    });
    return {...p,scenes,updatedAt:scenes.reduce((max,s)=>s.updatedAt>max?s.updatedAt:max,p.createdAt||'')};
  });
  const storage={catalogRevision:revisionOf(catalog)??0,sceneRevisions};
  storage.revision=effectiveRevision(storage);
  const defaults={theme:'midnight',typewriter:true,fontSize:17,writingWidth:810,focus:false};
  const activeProjectId=preferences?.activeProjectId||projects[0]?.id;
  const selected=projects.find(p=>p.id===activeProjectId)||projects[0];
  const activeSceneId=selected?.scenes.some(s=>s.id===preferences?.activeSceneId)?preferences.activeSceneId:selected?.scenes[0]?.id;
  return {schemaVersion:1,projects,activeProjectId:selected?.id,activeSceneId,activeBranchId:preferences?.activeBranchId||null,settings:{...defaults,...preferences?.settings},_storage:storage};
}
function readNormalized(db){return new Promise((resolve,reject)=>{
  const tx=db.transaction([CATALOG_STORE,SCENE_STORE,PREFS_STORE],'readonly');
  let catalog=null,prefs=null,scenes=[];
  const a=tx.objectStore(CATALOG_STORE).get(MAIN);a.onsuccess=()=>catalog=a.result;
  const b=tx.objectStore(PREFS_STORE).get(MAIN);b.onsuccess=()=>prefs=b.result;
  const c=tx.objectStore(SCENE_STORE).getAll();c.onsuccess=()=>scenes=c.result||[];
  tx.oncomplete=()=>{try{resolve(asLoadedState(catalog,prefs,scenes));}catch(e){reject(e);}};
  tx.onerror=()=>reject(tx.error||new Error('Cannot load local workspace'));
  tx.onabort=()=>reject(tx.error||new Error('Local workspace read aborted'));
});}

/* Atomic, non-destructive migration. The legacy 'data/workspace' record is
   never deleted, even after the new catalog is successfully committed. */
function migrateLegacy(db){return new Promise((resolve,reject)=>{
  const tx=db.transaction(['data',CATALOG_STORE,SCENE_STORE,PREFS_STORE],'readwrite');
  const cat=tx.objectStore(CATALOG_STORE),legacy=tx.objectStore('data');
  let migrated=false,err=null;
  const existing=cat.get(MAIN);
  existing.onsuccess=()=>{
    if(existing.result){return;}
    const req=legacy.get(STORE_NAME);
    req.onsuccess=()=>{
      const prior=req.result;
      if(!prior)return;
      try{
        uniqueSceneMap(prior);
        const catalog=catalogOf(prior);
        cat.put({...catalog,_revision:0},MAIN);
        tx.objectStore(PREFS_STORE).put(prefsOf(prior),MAIN);
        const scenes=tx.objectStore(SCENE_STORE);
        for(const scene of allScenes(prior))scenes.put({...clone(scene),_revision:0},scene.id);
        migrated=true;
      }catch(e){err=e;tx.abort();}
    };
  };
  tx.oncomplete=()=>resolve(migrated);
  tx.onerror=()=>reject(err||tx.error||new Error('Legacy migration failed'));
  tx.onabort=()=>reject(err||tx.error||new Error('Legacy migration aborted'));
});}
export async function readWorkspace(db){
  const current=await readNormalized(db);
  if(current)return current;
  if(await migrateLegacy(db))return readNormalized(db);
  return null;
}

export function calculateSavePlan(next,baseline){
  const nextScenes=uniqueSceneMap(next),beforeScenes=baseline?uniqueSceneMap(baseline):new Map();
  const changeScenes=[];
  for(const [id,scene] of nextScenes){
    const before=beforeScenes.get(id);
    if(!before||JSON.stringify(scene)!==JSON.stringify(before))changeScenes.push({id,scene:clone(scene),expected:baseline?._storage?.sceneRevisions?.[id]??null});
  }
  const removedScenes=[];
  for(const [id] of beforeScenes)if(!nextScenes.has(id))removedScenes.push({id,expected:baseline?._storage?.sceneRevisions?.[id]??null});
  const nextCatalog=catalogOf(next),previousCatalog=baseline?catalogOf(baseline):null;
  const catalogChanged=JSON.stringify(nextCatalog)!==JSON.stringify(previousCatalog);
  const nextPrefs=prefsOf(next),previousPrefs=baseline?prefsOf(baseline):null;
  const prefsChanged=JSON.stringify(nextPrefs)!==JSON.stringify(previousPrefs);
  return {changeScenes,removedScenes,catalogChanged,prefsChanged,catalog:nextCatalog,prefs:nextPrefs,
    expectedCatalog:baseline?._storage?.catalogRevision??null};
}
/* Changed scenes and catalog commit in a single IndexedDB transaction. Unchanged
   scenes are NEVER written, so another tab can safely edit a different scene.
   The preferences record is deliberately last-writer-wins; it contains no prose. */
export function writeWorkspace(db,data,baseline=null){
  const plan=calculateSavePlan(data,baseline);
  if(!plan.catalogChanged&&!plan.prefsChanged&&!plan.changeScenes.length&&!plan.removedScenes.length)
    return Promise.resolve(baseline||data);
  return new Promise((resolve,reject)=>{
    const tx=db.transaction([CATALOG_STORE,SCENE_STORE,PREFS_STORE],'readwrite');
    const catStore=tx.objectStore(CATALOG_STORE),sceneStore=tx.objectStore(SCENE_STORE);
    let conflict=null,remaining=plan.changeScenes.length+plan.removedScenes.length+(plan.catalogChanged?1:0);
    const revisions={...baseline?._storage?.sceneRevisions};
    let catRevision=baseline?._storage?.catalogRevision??0;
    function abortWith(kind,id){conflict=new ConcurrentWorkspaceEdit(kind,id);tx.abort();}
    function finish(){
      if(--remaining!==0)return;
      if(plan.catalogChanged)catStore.put({...plan.catalog,_revision:catRevision},MAIN);
      if(plan.prefsChanged)tx.objectStore(PREFS_STORE).put(plan.prefs,MAIN);
      for(const entry of plan.changeScenes)sceneStore.put({...entry.scene,_revision:revisions[entry.id]},entry.id);
      for(const entry of plan.removedScenes)sceneStore.delete(entry.id);
    }
    if(plan.catalogChanged){
      const r=catStore.get(MAIN);
      r.onsuccess=()=>{
        if(revisionOf(r.result)!==plan.expectedCatalog)return abortWith('project library');
        catRevision=(revisionOf(r.result)??-1)+1;finish();
      };
    }
    for(const entry of [...plan.changeScenes,...plan.removedScenes]){
      const r=sceneStore.get(entry.id);
      r.onsuccess=()=>{
        if(revisionOf(r.result)!==entry.expected)return abortWith('scene',entry.id);
        if('scene' in entry)revisions[entry.id]=(revisionOf(r.result)??-1)+1;
        else delete revisions[entry.id];
        finish();
      };
    }
    if(remaining===0){ // UI preferences only; don't rewrite projects or scenes.
      if(plan.prefsChanged)tx.objectStore(PREFS_STORE).put(plan.prefs,MAIN);
    }
    tx.oncomplete=()=>{
      const storage={catalogRevision:catRevision,sceneRevisions:revisions};storage.revision=effectiveRevision(storage);
      resolve({...clone(data),_storage:storage});
    };
    tx.onabort=()=>reject(conflict||tx.error||new Error('Scene save transaction aborted'));
    tx.onerror=()=>reject(conflict||tx.error||new Error('Scene save failed'));
  });
}
