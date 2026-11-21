/* Writing Workbench M2.1 — parallel scene drafts. Pure model operations.
   Alternative prose remains within its parent scene and uses that scene's
   IndexedDB revision; no edits are silently merged into the main manuscript. */
export const MAX_BRANCHES = 40;
const own = (scene) => {
  if (!scene || typeof scene !== 'object' || typeof scene.text !== 'string') throw new Error('Invalid scene');
  if (!Array.isArray(scene.branches)) scene.branches = [];
  return scene.branches;
};
const cap = (text,limit) => String(text??'').trim().slice(0,limit);
export function getDraft(scene, branchId=null) {
  if (!scene) return null;
  return branchId == null ? scene : (scene.branches||[]).find(b=>b.id===branchId) || null;
}
export function forkDraft(scene,branchId,{id, title, timestamp}={}) {
  const branches=own(scene);
  if (branches.length >= MAX_BRANCHES) throw new Error('This scene has reached the 40-branch limit');
  const source=getDraft(scene,branchId);
  if(!source)throw new Error('Source draft not found');
  if(typeof id!=='string'||!id||branches.some(b=>b.id===id)||scene.id===id)throw new Error('Branch ID must be unique');
  const name=cap(title || `Alternative ${branches.length+1}`,140);
  if(!name)throw new Error('Branch name is required');
  const date=timestamp||new Date().toISOString();
  const branch={id,title:name,text:source.text,createdAt:date,updatedAt:date,
    cursor:Math.min(source.cursor||0,source.text.length),scroll:source.scroll||0,history:[],originId:branchId||null};
  branches.push(branch);
  scene.updatedAt=date;
  return branch;
}
/** Copies selected alternative into the main scene. The old main becomes a
 *  separate branch, even if a checkpoint already holds the same text.
 *  The selected branch also remains intact for future comparison. */
export function promoteDraft(scene,branchId,{id,timestamp}={}) {
  const branch=getDraft(scene,branchId);
  if(!branch || branch===scene)throw new Error('Choose an existing alternative draft');
  const old=JSON.parse(JSON.stringify(scene));
  const safety=forkDraft(scene,null,{id,title:`Main before selecting ${branch.title}`.slice(0,140),timestamp});
  // Forking an old main must NOT make an alternative the only record of it.
  safety.history=JSON.parse(JSON.stringify(old.history||[]));
  scene.text=branch.text;
  scene.cursor=Math.min(branch.cursor||0,scene.text.length);
  scene.scroll=branch.scroll||0;
  scene.updatedAt=timestamp||new Date().toISOString();
  return {selectedBranchId:branchId, preservedMainId:safety.id};
}
export function branchCount(project){return (project?.scenes||[]).reduce((sum,scene)=>sum+(scene.branches?.length||0),0);}
