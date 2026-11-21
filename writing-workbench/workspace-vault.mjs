/* Complete workspace JSON export, separated from single-project archive v2.
   Checksums detect accidental damage; they are NOT authentication or encryption. */
import {sha256Hex,validateProject,createArchive,parseArchive} from './vault.mjs';
export const WORKSPACE_FORMAT='writing-workbench-workspace';
export const WORKSPACE_SCHEMA=2;
const must=(condition,message)=>{if(!condition)throw Error(message);};
const counts=projects=>({
  projects:projects.length,
  scenes:projects.reduce((n,p)=>n+p.scenes.length,0),
  fragments:projects.reduce((n,p)=>n+p.fragments.length,0),
  checkpoints:projects.reduce((n,p)=>n+p.scenes.reduce((i,s)=>i+s.history.length+(s.branches||[]).reduce((b,x)=>b+x.history.length,0),0),0),
  branches:projects.reduce((n,p)=>n+p.scenes.reduce((b,s)=>b+(s.branches?.length||0),0),0)
});
export async function createWorkspaceArchive(workspace){
  must(workspace&&Array.isArray(workspace.projects)&&workspace.projects.length>0&&workspace.projects.length<=200,'Invalid workspace projects');
  const projects=structuredClone(workspace.projects);
  for(const project of projects)validateProject(project);
  const payload={projects};
  const manifest=counts(projects);
  return {format:WORKSPACE_FORMAT,schemaVersion:WORKSPACE_SCHEMA,application:'Writing Workbench M2.1',exportedAt:new Date().toISOString(),manifest,
    integrity:{algorithm:'SHA-256',value:await sha256Hex(JSON.stringify(payload))},payload};
}
export async function parseWorkspaceArchive(source,generateId,clock=()=>new Date().toISOString()){
  const data=typeof source==='string'?JSON.parse(source):source;
  must(data&&data.format===WORKSPACE_FORMAT&&[1,WORKSPACE_SCHEMA].includes(data.schemaVersion),'Unsupported workspace archive');
  must(data.integrity?.algorithm==='SHA-256'&&/^[a-f0-9]{64}$/.test(data.integrity.value),'Invalid workspace archive checksum');
  must(data.payload&&Array.isArray(data.payload.projects)&&data.payload.projects.length>0&&data.payload.projects.length<=200,'Invalid workspace contents');
  must(await sha256Hex(JSON.stringify(data.payload))===data.integrity.value,'Workspace archive integrity check failed');
  const projects=data.payload.projects;
  for(const project of projects){
    if(data.schemaVersion===1 && project.scenes.some(scene=>'branches' in scene))
      throw new Error('Branch drafts require workspace archive v2');
    validateProject(project);
  }
  const manifest=counts(projects);
  must(Object.keys(manifest).filter(k=>data.schemaVersion>=2||k!=='branches').every(k=>data.manifest?.[k]===manifest[k]),'Workspace archive manifest does not match contents');
  // parseArchive regenerates all internal IDs and preserves manuscript content, history and fragments.
  // This is done before any workspace mutation, so malformed archives import nothing.
  const imported=[];
  for(const project of projects){
    const single=await createArchive(project);
    const result=await parseArchive(single,generateId,clock);
    imported.push(result.project);
  }
  return {projects:imported,manifest:data.schemaVersion===1?Object.fromEntries(Object.entries(manifest).filter(([k])=>k!=='branches')):manifest};
}

/* Independently check the committed project records after an archive import.
   This compares actual content, not merely a successful transaction callback.
   Project updatedAt is derived from scene dates by IndexedDB v2, so it is
   excluded; everything else (including scenes, fragments, history, cursor,
   and arbitrary project metadata) must survive unchanged. */
function canonical(value){
  if(Array.isArray(value))return value.map(canonical);
  if(value && typeof value==='object'){
    return Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])]));
  }
  return value;
}
function sourceProject(project){const {updatedAt,_storage,...retained}=project;return retained;}
export function verifyPersistedProjects(workspace, imported){
  const stored=workspace?.projects;
  if(!Array.isArray(stored)||!Array.isArray(imported)||!imported.length)
    return {ok:false,reason:'Saved project list is unavailable'};
  const ids=new Set();
  for(const expected of imported){
    if(!expected?.id||ids.has(expected.id))return {ok:false,reason:'Imported project identifiers are invalid or duplicated'};
    ids.add(expected.id);
    const matches=stored.filter(project=>project.id===expected.id);
    if(matches.length!==1)return {ok:false,reason:`Imported project ${expected.title||expected.id} was not found exactly once`};
    if(JSON.stringify(canonical(sourceProject(matches[0])))!==JSON.stringify(canonical(sourceProject(expected))))
      return {ok:false,reason:`Stored content differs from imported project ${expected.title||expected.id}`};
  }
  return {ok:true,projects:imported.length,scenes:imported.reduce((n,p)=>n+p.scenes.length,0),
    fragments:imported.reduce((n,p)=>n+p.fragments.length,0),
    checkpoints:imported.reduce((n,p)=>n+p.scenes.reduce((m,s)=>m+s.history.length+(s.branches||[]).reduce((sum,b)=>sum+b.history.length,0),0),0),
    branches:imported.reduce((n,p)=>n+p.scenes.reduce((m,s)=>m+(s.branches?.length||0),0),0)};
}
