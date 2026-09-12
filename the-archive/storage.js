const COLLECTIONS = [
  'outfits','perfumes','archetypes','hairstyles','garments','wears','plans','wishlist','trips',
  'feedback','careTasks','perfumeWears','calendarEvents',
  'relationships','atelier','retired','journals','styleRules','outfitFamilies','locations'
];
const APP_ID = window.ARCHIVE_APP_ID || 'the-archive-antwerp';
const embeddedConfig = window.ARCHIVE_FIREBASE_CONFIG || null;
let localOverride = null;
try { localOverride = JSON.parse(localStorage.getItem(`archive:firebase-config:${APP_ID}`) || 'null'); } catch {}
const FIREBASE_CONFIG = localOverride || embeddedConfig;
const VAULT_ID = String(FIREBASE_CONFIG?.archiveVault || 'default').replace(/[^a-zA-Z0-9_-]/g,'_');
const storageKey = type => `archive:v9:${APP_ID}:${type}`;

function localRead(type){
  try { return JSON.parse(localStorage.getItem(storageKey(type)) || '[]'); } catch { return []; }
}
function localWrite(type,items){
  localStorage.setItem(storageKey(type), JSON.stringify(items));
  window.dispatchEvent(new CustomEvent('archive-local-change',{detail:{type}}));
}
function keyOf(item){ return String(item?.id || item?.name || crypto.randomUUID?.() || Date.now()); }
function mergeItems(current,incoming){
  const map = new Map(current.map(item => [keyOf(item), item]));
  incoming.forEach(item => map.set(keyOf(item), item));
  return Array.from(map.values());
}

async function createLocalAdapter(){
  return {
    mode:'local', uid:'local-device',
    async init(){ return {uid:'local-device'}; },
    subscribe(type,cb){
      const emit=()=>cb(localRead(type)); emit();
      const c=e=>{ if(e.detail?.type===type) emit(); };
      const s=e=>{ if(e.key===storageKey(type)) emit(); };
      window.addEventListener('archive-local-change',c);
      window.addEventListener('storage',s);
      return ()=>{ window.removeEventListener('archive-local-change',c); window.removeEventListener('storage',s); };
    },
    async saveItems(type,items){ localWrite(type,mergeItems(localRead(type),items)); },
    async replace(type,items){ localWrite(type,items); },
    async wipe(type){ localStorage.removeItem(storageKey(type)); window.dispatchEvent(new CustomEvent('archive-local-change',{detail:{type}})); },
    async pushLocalToCloud(){ return false; }
  };
}

async function createFirebaseAdapter(config){
  const [{initializeApp},authMod,fsMod] = await Promise.all([
    import('https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js'),
    import('https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js')
  ]);
  const firebaseConfig={...config}; delete firebaseConfig.archiveVault;
  const app=initializeApp(firebaseConfig), auth=authMod.getAuth(app), db=fsMod.getFirestore(app);
  const path=t=>fsMod.collection(db,'artifacts',APP_ID,'vaults',VAULT_ID,t);
  const docRef=(type,item)=>fsMod.doc(db,'artifacts',APP_ID,'vaults',VAULT_ID,type,keyOf(item).replace(/\//g,'_'));
  let uid=null;

  async function mergeLocalIntoCloud(){
    for(const type of COLLECTIONS){
      const local=localRead(type);
      if(!local.length) continue;
      const snap=await fsMod.getDocs(path(type));
      const remote=snap.docs.map(d=>d.data());
      const merged=mergeItems(remote,local);
      for(const item of merged) await fsMod.setDoc(docRef(type,item),item);
    }
  }

  return {
    mode:'cloud', get uid(){return uid;},
    async init(){
      if(window.ARCHIVE_INITIAL_AUTH_TOKEN) await authMod.signInWithCustomToken(auth,window.ARCHIVE_INITIAL_AUTH_TOKEN);
      else await authMod.signInAnonymously(auth);
      const user=await new Promise((resolve,reject)=>{
        const stop=authMod.onAuthStateChanged(auth,u=>{ if(u){stop();resolve(u);} },reject);
      });
      uid=user.uid;
      await mergeLocalIntoCloud();
      return user;
    },
    subscribe(type,cb){
      return fsMod.onSnapshot(fsMod.query(path(type)),snap=>{
        const items=snap.docs.map(d=>d.data());
        localWrite(type,items);
        cb(items);
      });
    },
    async saveItems(type,items){
      const merged=mergeItems(localRead(type),items); localWrite(type,merged);
      for(const item of items) await fsMod.setDoc(docRef(type,item),item);
    },
    async replace(type,items){
      localWrite(type,items);
      const snap=await fsMod.getDocs(path(type));
      for(const d of snap.docs) await fsMod.deleteDoc(d.ref);
      for(const item of items) await fsMod.setDoc(docRef(type,item),item);
    },
    async wipe(type){
      localWrite(type,[]);
      const snap=await fsMod.getDocs(path(type));
      for(const d of snap.docs) await fsMod.deleteDoc(d.ref);
    },
    async pushLocalToCloud(){ await mergeLocalIntoCloud(); return true; }
  };
}

try{
  const cloud=FIREBASE_CONFIG && FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.projectId;
  window.ArchiveStorage=cloud ? await createFirebaseAdapter(FIREBASE_CONFIG) : await createLocalAdapter();
}catch(e){
  console.warn('Cloud unavailable, using local storage.',e);
  window.ArchiveStorage=await createLocalAdapter();
}
window.ARCHIVE_COLLECTIONS=COLLECTIONS;
window.ARCHIVE_FIREBASE_ACTIVE_CONFIG=FIREBASE_CONFIG;
window.dispatchEvent(new Event('archive-storage-ready'));
