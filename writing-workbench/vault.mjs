/* Writing Workbench portable archive v2. No remote calls or outside dependencies. */
export const ARCHIVE_FORMAT = 'writing-workbench-project';
export const ARCHIVE_SCHEMA = 3;
const maxSceneChars = 5_000_000;
const maxFragmentChars = 300_000;
const maxScenes = 3000;
const maxFragments = 10_000;
const maxHistoryEntries = 35;
const maxBranches = 40;

// Explicitly fail on unfamiliar fields rather than generating a checksummed
// archive that cannot be restored without losing those fields. Future character,
// research, attachment and cross-reference records require a schema upgrade.
const SUPPORTED_FIELDS = {
  project: new Set(['id','title','createdAt','updatedAt','scenes','fragments']),
  scene: new Set(['id','title','text','createdAt','updatedAt','cursor','scroll','history','branches']),
  checkpoint: new Set(['id','title','text','createdAt','reason','cursor']),
  fragment: new Set(['id','text','createdAt','updatedAt','kind']),
  branch: new Set(['id','title','text','createdAt','updatedAt','cursor','scroll','history','originId'])
};
function supportedFields(object, kind) {
  for(const key of Object.keys(object)){
    if(!SUPPORTED_FIELDS[kind].has(key))
      throw new Error(`Unsupported ${kind} field "${key}": this version cannot safely export or import it without losing data. Keep the original writing and use a newer compatible Workbench.`);
  }
}
function validOptionalCursor(value, text, label){
  if(value != null && (!Number.isSafeInteger(value) || value<0 || value>text.length))
    throw new Error(`Invalid ${label}: cursor is outside the passage`);
}
function validOptionalScroll(value){
  if(value != null && (typeof value!=='number'||!Number.isFinite(value)||value<0))
    throw new Error('Invalid scene scroll position');
}

export async function sha256Hex(value) {
  if (!globalThis.crypto?.subtle) throw new Error('Verified archives require a secure browser context (HTTPS or localhost)');
  const digest = await globalThis.crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), b=>b.toString(16).padStart(2,'0')).join('');
}
const countProject = project => ({
  scenes:project.scenes.length,
  fragments:project.fragments.length,
  checkpoints:project.scenes.reduce((sum,s)=>sum+s.history.length+(s.branches||[]).reduce((total,b)=>total+b.history.length,0),0),
  branches:project.scenes.reduce((total,s)=>total+(s.branches?.length||0),0),
  characters:0,
  notes:0,
  attachments:0
});
function expect(value,condition,message){if(!condition)throw new Error(message);return value;}
function optionalString(value,label,max=500){return expect(value,typeof value==='string'&&value.length<=max,`Invalid ${label}`);}
function parseDate(input,fallback){return typeof input==='string'&&Number.isFinite(Date.parse(input))?input:fallback;}
export function validateProject(raw){
  expect(raw,raw&&typeof raw==='object'&&!Array.isArray(raw),'Invalid project object');
  supportedFields(raw,'project');
  optionalString(raw.title,'project title',200);
  expect(raw.scenes,Array.isArray(raw.scenes)&&raw.scenes.length>0&&raw.scenes.length<=maxScenes,'Invalid scene count');
  expect(raw.fragments,Array.isArray(raw.fragments)&&raw.fragments.length<=maxFragments,'Invalid fragment count');
  for(const scene of raw.scenes){
    expect(scene,scene&&typeof scene==='object','Invalid scene object');
    supportedFields(scene,'scene');
    optionalString(scene.title,'scene title',140);
    optionalString(scene.text,'scene text',maxSceneChars);
    validOptionalCursor(scene.cursor,scene.text,'scene');
    validOptionalScroll(scene.scroll);
    expect(scene.history,Array.isArray(scene.history)&&scene.history.length<=maxHistoryEntries,'Invalid scene history');
    for(const h of scene.history){
      expect(h,h&&typeof h==='object','Invalid checkpoint');
      supportedFields(h,'checkpoint');
      optionalString(h.text,'checkpoint text',maxSceneChars);
      validOptionalCursor(h.cursor,h.text,'checkpoint');
      optionalString(h.title??scene.title,'checkpoint title',140);
      if(h.reason!=null)optionalString(h.reason,'checkpoint reason',150);
    }
    const branches=scene.branches??[];
    expect(branches,Array.isArray(branches)&&branches.length<=maxBranches,'Invalid alternative branch count');
    const ids=new Set();
    for(const branch of branches){
      expect(branch,branch&&typeof branch==='object'&&!Array.isArray(branch),'Invalid branch');
      supportedFields(branch,'branch');
      optionalString(branch.id,'branch ID',200);
      expect(branch,!ids.has(branch.id)&&branch.id!==scene.id,'Duplicate branch ID');
      ids.add(branch.id);
      optionalString(branch.title,'branch title',140);
      optionalString(branch.text,'branch text',maxSceneChars);
      validOptionalCursor(branch.cursor,branch.text,'branch');
      validOptionalScroll(branch.scroll);
      expect(branch,Array.isArray(branch.history)&&branch.history.length<=maxHistoryEntries,'Invalid branch history');
      for(const h of branch.history){
        expect(h,h&&typeof h==='object'&&!Array.isArray(h),'Invalid branch checkpoint');
        supportedFields(h,'checkpoint');
        optionalString(h.text,'checkpoint text',maxSceneChars);
        validOptionalCursor(h.cursor,h.text,'checkpoint');
        optionalString(h.title??branch.title,'checkpoint title',140);
        if(h.reason!=null)optionalString(h.reason,'checkpoint reason',150);
      }
    }
    for(const branch of branches){
      expect(branch,branch.originId==null||(typeof branch.originId==='string'&&ids.has(branch.originId)&&branch.originId!==branch.id),'Invalid branch origin reference');
    }
  }
  for(const fragment of raw.fragments){
    expect(fragment,fragment&&typeof fragment==='object','Invalid fragment');
    supportedFields(fragment,'fragment');
    optionalString(fragment.text,'fragment text',maxFragmentChars);
  }
  return raw;
}
export async function createArchive(project){
  const payload = structuredClone(validateProject(project));
  const manifest = countProject(payload);
  const checksum = await sha256Hex(JSON.stringify(payload));
  return {format:ARCHIVE_FORMAT,schemaVersion:ARCHIVE_SCHEMA,application:'Writing Workbench M2.1',exportedAt:new Date().toISOString(),manifest,
    integrity:{algorithm:'SHA-256',value:checksum},project:payload};
}
export async function parseArchive(source,generateId,clock=()=>new Date().toISOString()){
  const data=typeof source==='string'?JSON.parse(source):source;
  expect(data,data&&data.format===ARCHIVE_FORMAT,'Unsupported project archive');
  expect(data,[1,2,3].includes(data.schemaVersion),'Unsupported archive version');
  const raw=data.project;
  if(data.schemaVersion>=2){
    expect(data,data.integrity?.algorithm==='SHA-256'&&/^[a-f0-9]{64}$/.test(data.integrity.value),'Missing or invalid archive checksum');
    const digest=await sha256Hex(JSON.stringify(raw));
    expect(data,digest===data.integrity.value,'Archive integrity check failed: file was changed or damaged');
  }
  // Validate fully BEFORE writing to the workspace; never trim or silently drop bad records.
  // Legacy v1 archives did not always include a fragments/history array.
  const normalized=structuredClone(raw);
  if(data.schemaVersion===1){
    normalized.fragments??=[];
    for(const scene of normalized.scenes??[])scene.history??=[];
  }
  // Old schemas never represented branch prose: do not accept it as
  // an undocumented extension even with a valid recomputed checksum.
  if(data.schemaVersion<3 && (normalized.scenes||[]).some(scene=>'branches' in scene))
    throw new Error('Branch drafts require project archive v3; preserve the original file');
  for(const scene of normalized.scenes||[])scene.branches??=[];
  validateProject(normalized);
  if(data.schemaVersion>=2){
    const actual=countProject(normalized);
    expect(data,Object.keys(actual).filter(k=>data.schemaVersion>=3||k!=='branches').every(k=>actual[k]===data.manifest?.[k]),'Archive manifest does not match contents');
  }
  const project={id:generateId(),title:`${normalized.title} (imported)`.slice(0,200),createdAt:parseDate(normalized.createdAt,clock()),updatedAt:parseDate(normalized.updatedAt,clock()),scenes:[],fragments:[]};
  for(const scene of normalized.scenes){
    const local={id:generateId(),title:scene.title,text:scene.text,createdAt:parseDate(scene.createdAt,clock()),updatedAt:parseDate(scene.updatedAt,clock()),cursor:Number.isInteger(scene.cursor)?Math.max(0,Math.min(scene.cursor,scene.text.length)):0,scroll:Number.isFinite(scene.scroll)?Math.max(0,scene.scroll):0,history:[]};
    for(const h of scene.history){
      local.history.push({id:generateId(),title:h.title??scene.title,text:h.text,createdAt:parseDate(h.createdAt,clock()),reason:h.reason??'Imported checkpoint',cursor:Number.isInteger(h.cursor)?Math.max(0,Math.min(h.cursor,h.text.length)):0});
    }
    const branchIds=new Map((scene.branches||[]).map(b=>[b.id,generateId()]));
    local.branches=(scene.branches||[]).map(branch=>({
      id:branchIds.get(branch.id),title:branch.title,text:branch.text,
      createdAt:parseDate(branch.createdAt,clock()),updatedAt:parseDate(branch.updatedAt,clock()),
      cursor:Number.isInteger(branch.cursor)?branch.cursor:0,scroll:Number.isFinite(branch.scroll)?branch.scroll:0,
      originId:branch.originId==null?null:branchIds.get(branch.originId),
      history:branch.history.map(h=>({id:generateId(),title:h.title??branch.title,text:h.text,
        createdAt:parseDate(h.createdAt,clock()),reason:h.reason??'Imported checkpoint',
        cursor:Number.isInteger(h.cursor)?h.cursor:0}))
    }));
    project.scenes.push(local);
  }
  for(const fragment of normalized.fragments){
    project.fragments.push({id:generateId(),text:fragment.text,createdAt:parseDate(fragment.createdAt,clock()),updatedAt:parseDate(fragment.updatedAt,clock()),kind:typeof fragment.kind==='string'?fragment.kind:'text'});
  }
  return {project,sourceVersion:data.schemaVersion,manifest:countProject(project)};
}
