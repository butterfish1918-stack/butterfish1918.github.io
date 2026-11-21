/* Writing Workbench M2.2 — read-only revision catalogue and line comparison.
   Never mutates source records. Only explicit actions in the manuscript editor
   can change the authoritative main scene or any alternative. */
export const MAX_DIFF_CELLS = 500000;
export const MAX_DIFF_CHARS = 260000;
const revisionSafe = value => typeof value === 'string' ? value : '';

/** Flat list of current drafts and their recoverable checkpoints. The opaque
 *  revision keys are for UI selection only and are never persisted. */
export function revisionSources(scene) {
  if (!scene || typeof scene.text !== 'string' || !Array.isArray(scene.history))
    throw new Error('A valid scene is required to compare revisions');
  const sources=[];
  const add=(draft, branchId, title) => {
    const base=branchId===null?'main':`branch:${branchId}`;
    sources.push({key:`current:${base}`,kind:branchId===null?'main':'branch',branchId,
      checkpointId:null,title:`${title} — Current`,text:draft.text,
      createdAt:draft.updatedAt||draft.createdAt||null,readonly:true});
    for(const [index,checkpoint] of (draft.history||[]).entries()) {
      if(typeof checkpoint.text!=='string') continue;
      sources.push({key:`history:${base}:${checkpoint.id||index}`,kind:'checkpoint',branchId,
        checkpointId:checkpoint.id||null,title:`${title} — ${checkpoint.reason||'Checkpoint'} (${checkpoint.createdAt||'undated'})`,
        text:checkpoint.text,createdAt:checkpoint.createdAt||null,readonly:true});
    }
  };
  add(scene,null,'Main');
  for (const branch of scene.branches||[]) {
    if (!branch || typeof branch.text!=='string') continue;
    add(branch,branch.id,`Alt: ${revisionSafe(branch.title)||'Untitled'}`);
  }
  return sources;
}

/** Exact line-level comparison using LCS, with explicit bounds for large texts.
 *  A 'tooLarge' result never silently shows only a truncated comparison. */
export function compareRevisions(leftText,rightText,{maxCells=MAX_DIFF_CELLS,maxChars=MAX_DIFF_CHARS}={}) {
  if(typeof leftText!=='string'||typeof rightText!=='string')throw new TypeError('Both revisions must contain text');
  if(!Number.isSafeInteger(maxCells)||maxCells<1||!Number.isSafeInteger(maxChars)||maxChars<1)
    throw new Error('Invalid comparison limits');
  const a=leftText.split('\n'),b=rightText.split('\n');
  const tooLarge=leftText.length>maxChars||rightText.length>maxChars||(a.length*b.length)>maxCells;
  if(tooLarge)return {tooLarge:true,leftLines:a.length,rightLines:b.length,rows:[],
    message:'These drafts exceed the safe line-comparison limit. The complete text has not been truncated or changed.'};
  // Bottom-up dynamic program. Bounded by maxCells to avoid hanging an iPad.
  const cols=b.length+1, dp=new Uint32Array((a.length+1)*cols);
  for(let i=a.length-1;i>=0;i--)for(let j=b.length-1;j>=0;j--){
    const k=i*cols+j;
    dp[k]=a[i]===b[j]?1+dp[(i+1)*cols+j+1]:Math.max(dp[(i+1)*cols+j],dp[i*cols+j+1]);
  }
  const rows=[];let i=0,j=0,added=0,removed=0,unchanged=0;
  while(i<a.length||j<b.length){
    if(i<a.length&&j<b.length&&a[i]===b[j]){
      rows.push({kind:'unchanged',left:a[i],right:b[j],leftNumber:i+1,rightNumber:j+1});i++;j++;unchanged++;
    } else if(i<a.length&&(j===b.length||dp[(i+1)*cols+j]>=dp[i*cols+j+1])){
      rows.push({kind:'removed',left:a[i],right:null,leftNumber:i+1,rightNumber:null});i++;removed++;
    } else {
      rows.push({kind:'added',left:null,right:b[j],leftNumber:null,rightNumber:j+1});j++;added++;
    }
  }
  return {tooLarge:false,leftLines:a.length,rightLines:b.length,added,removed,unchanged,
    identical:leftText===rightText,rows};
}

/** Retrieve a checkpoint by reference; historical reading never selects an
 *  editable draft or updates the current scene. */
export function findHistoricalCheckpoint(scene,branchId,checkpointId) {
  if(!scene||typeof checkpointId!=='string')return null;
  const draft=branchId==null?scene:(scene.branches||[]).find(b=>b.id===branchId);
  return (draft?.history||[]).find(h=>h.id===checkpointId)||null;
}
