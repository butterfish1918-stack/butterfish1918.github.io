/* Best-effort synchronous recovery journal for unsaved scene edits.
   Journals remain on this browser and are never a substitute for a file backup. */
export const RECOVERY_PREFIX='wwb-scene-recovery-v1:';
export const RECOVERY_MAX_SCENE_CHARS=240_000;
const MAX_ENTRIES=32;
const MAX_TOTAL_CHARS=800_000;
const isText=v=>typeof v==='string';
const validDraft=v=>v&&typeof v==='object'&&isText(v.projectId)&&isText(v.sceneId)&&isText(v.text)&&isText(v.title)&&v.text.length<=RECOVERY_MAX_SCENE_CHARS&&Number.isSafeInteger(v.baseRevision)&&v.baseRevision>=0;
const entryId=v=>`${v.projectId}:${v.sceneId}`;
export function journalKey(sessionId){return `${RECOVERY_PREFIX}${sessionId}`;}
function parseJournal(raw){
 const data=JSON.parse(raw);
 if(!data||data.version!==1||!Array.isArray(data.entries))throw Error('Unsupported recovery journal');
 if(data.entries.some(x=>!validDraft(x))||data.entries.length>MAX_ENTRIES)throw Error('Invalid recovery entries');
 return data;
}
export function stageDraft(storage,key,source){
 if(!storage)return {ok:false,reason:'Storage is not available'};
 if(!validDraft(source))return {ok:false,reason:source?.text?.length>RECOVERY_MAX_SCENE_CHARS?'Scene exceeds the recovery-journal size limit':'Invalid recovery data'};
 try{
  const existing=storage.getItem(key);
  const data=existing?parseJournal(existing):{version:1,entries:[]};
  const draft={projectId:source.projectId,sceneId:source.sceneId,projectTitle:source.projectTitle||'',sceneTitle:source.sceneTitle||source.title,title:source.title,text:source.text,cursor:Number.isInteger(source.cursor)?source.cursor:0,baseRevision:source.baseRevision,updatedAt:source.updatedAt||new Date().toISOString()};
  const i=data.entries.findIndex(x=>entryId(x)===entryId(draft));
  if(i>=0)data.entries[i]=draft;else data.entries.push(draft);
  if(data.entries.length>MAX_ENTRIES||JSON.stringify(data).length>MAX_TOTAL_CHARS)return {ok:false,reason:'Recovery journal capacity reached'};
  storage.setItem(key,JSON.stringify(data));
  return {ok:true};
 }catch(e){return {ok:false,reason:e?.message||'Journal storage failed'};}
}
export function clearCommittedDrafts(storage,key,persistedSnapshot){
 try{
  const raw=storage?.getItem(key);if(!raw)return 0;
  const journal=parseJournal(raw);const before=journal.entries.length;
  journal.entries=journal.entries.filter(entry=>{
   const p=persistedSnapshot?.projects?.find(p=>p.id===entry.projectId);
   const s=p?.scenes?.find(s=>s.id===entry.sceneId);
   return !(s&&s.text===entry.text&&s.title===entry.title);
  });
  if(journal.entries.length===0)storage.removeItem(key);else storage.setItem(key,JSON.stringify(journal));
  return before-journal.entries.length;
 }catch(_){return 0;}
}
export function listRecoverableDrafts(storage,savedWorkspace){
 const result=[];
 if(!storage)return result;
 try{
  const keys=[];for(let i=0;i<storage.length;i++){const k=storage.key(i);if(k?.startsWith(RECOVERY_PREFIX))keys.push(k);}
  for(const key of keys){
   let data;try{data=parseJournal(storage.getItem(key));}catch(_){continue;}
   for(const entry of data.entries){
    const project=savedWorkspace?.projects?.find(p=>p.id===entry.projectId);
    const scene=project?.scenes?.find(s=>s.id===entry.sceneId);
    if(scene&&scene.text===entry.text&&scene.title===entry.title)continue;
    result.push({key,entry});
   }
  }
 }catch(_){}
 return result.sort((a,b)=>(b.entry.updatedAt||'').localeCompare(a.entry.updatedAt||''));
}
export function discardRecoveryEntry(storage,key,entry){
 try{
  const raw=storage?.getItem(key);if(!raw)return false;
  const data=parseJournal(raw);
  data.entries=data.entries.filter(x=>entryId(x)!==entryId(entry));
  if(data.entries.length===0)storage.removeItem(key);else storage.setItem(key,JSON.stringify(data));
  return true;
 }catch(_){return false;}
}
