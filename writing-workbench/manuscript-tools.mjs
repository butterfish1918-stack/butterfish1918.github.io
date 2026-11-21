/* Writing Workbench M2.3 — pure manuscript structure and concordance filters.
   Search is read-only and runs entirely on in-memory local writing. */
export const SEARCH_LIMIT=150;
export const SEARCH_SOURCE_KINDS=Object.freeze(['scene','branch','checkpoint','branch-checkpoint','fragment']);
const textValue = value => typeof value==='string'?value:'';
const literalRegex = (phrase,caseSensitive=false) => new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), caseSensitive?'gu':'giu');

/** Return a reordered array with stable scene objects/IDs (no scene text mutation).
 *  Move at most one position. Caller persists the catalog transaction. */
export function movedScenes(project,sceneId,direction){
  if(!project || !Array.isArray(project.scenes))throw new Error('Invalid project scenes');
  if(direction!==-1&&direction!==1)throw new Error('Direction must be -1 or 1');
  const before=project.scenes;
  const index=before.findIndex(s=>s?.id===sceneId);
  if(index<0)throw new Error('Scene is not in this project');
  const destination=index+direction;
  if(destination<0||destination>=before.length)
    return {moved:false,from:index,to:index,scenes:before};
  const scenes=[...before];[scenes[index],scenes[destination]]=[scenes[destination],scenes[index]];
  return {moved:true,from:index,to:destination,scenes};
}

function excerpt(text,start,end,window=60){
  const from=Math.max(0,start-window),to=Math.min(text.length,end+window);
  return {before:(from?'…':'')+text.slice(from,start),match:text.slice(start,end),after:text.slice(end,to)+(to<text.length?'…':'')};
}

/** Literal, case-insensitive phrase search, preserving UTF-16 source offsets.
 *  Current drafts and fragments by default; checkpoints only when explicitly enabled.
 *  No stemming, no server calls, no fuzzy matches, no index stored on disk.
 */
export function searchManuscripts(workspace,query,{projectId=null,sceneId=null,sourceKinds=null,caseSensitive=false,includeFragments=true,includeCheckpoints=false,limit=SEARCH_LIMIT}={}){
  const phrase=textValue(query).trim();
  if(!phrase)return [];
  if(phrase.length>120)throw new Error('Search phrase must be 120 characters or fewer');
  if(!Number.isSafeInteger(limit)||limit<1||limit>1000)throw new Error('Invalid search limit');
  if(sceneId!==null&&(typeof sceneId!=='string'||!sceneId))throw new Error('Invalid scene filter');
  if(typeof caseSensitive!=='boolean')throw new Error('Invalid case-sensitivity option');
  if(sourceKinds!==null&&(!Array.isArray(sourceKinds)||sourceKinds.some(k=>!SEARCH_SOURCE_KINDS.includes(k))))throw new Error('Invalid source type filter');
  const allowed=sourceKinds===null?null:new Set(sourceKinds);
  const enabled=kind=>!allowed||allowed.has(kind);
  const results=[];
  const projects=Array.isArray(workspace?.projects)?workspace.projects:[];
  const re=literalRegex(phrase,caseSensitive);
  const add=(source,kind,project,item)=>{
    if(results.length>=limit||!enabled(kind))return;
    const text=textValue(source);
    re.lastIndex=0;
    for(const match of text.matchAll(re)){
      const start=match.index,end=start+match[0].length;
      results.push({kind,projectId:project.id,projectTitle:textValue(project.title),
        sceneId:kind==='fragment'?null:item.sceneId||item.id,fragmentId:kind==='fragment'?item.id:null,
        branchId:kind==='branch'?item.id:kind==='branch-checkpoint'?item.branchId:null,
        checkpointId:kind==='checkpoint'||kind==='branch-checkpoint'?item.id:null,
        createdAt:kind==='checkpoint'||kind==='branch-checkpoint'?item.createdAt||null:null,
        itemTitle:kind==='branch'?textValue(item.title):kind==='checkpoint'||kind==='branch-checkpoint'?textValue(item.title):kind==='scene'?textValue(item.title):'Captured fragment',
        start,end,...excerpt(text,start,end)});
      if(results.length>=limit)break;
    }
  };
  for(const project of projects){
    if(projectId&&project.id!==projectId)continue;
    for(const scene of project.scenes||[]){
      if(sceneId!==null&&scene.id!==sceneId)continue;
      add(scene.text,'scene',project,scene);if(results.length>=limit)return results;
      if(includeCheckpoints)for(const entry of scene.history||[]){
        add(entry.text,'checkpoint',project,{...entry,sceneId:scene.id,title:`${scene.title} — ${entry.reason||'Checkpoint'}`});
        if(results.length>=limit)return results;
      }
      for(const branch of scene.branches||[]){
        add(branch.text,'branch',project,{...branch,sceneId:scene.id});
        if(results.length>=limit)return results;
        if(includeCheckpoints)for(const entry of branch.history||[]){
          add(entry.text,'branch-checkpoint',project,{...entry,sceneId:scene.id,branchId:branch.id,title:`${branch.title} — ${entry.reason||'Checkpoint'}`});
          if(results.length>=limit)return results;
        }
      }
    }
    if(sceneId===null&&includeFragments)for(const fragment of project.fragments||[]){add(fragment.text,'fragment',project,fragment);if(results.length>=limit)return results;}
  }
  return results;
}
