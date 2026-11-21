/* Writing Workbench M2.3 — per-scene local writing and writer-approved PWA updates; no cloud sync. */
import {openWorkspaceDB,readWorkspace,writeWorkspace,readRevision,ConcurrentWorkspaceEdit} from './storage.mjs';
import {createArchive,parseArchive} from './vault.mjs';
import {WORKSPACE_FORMAT,createWorkspaceArchive,parseWorkspaceArchive,verifyPersistedProjects} from './workspace-vault.mjs';
import {inspectBackup} from './backup-check.mjs';
import {movedScenes,searchManuscripts,SEARCH_LIMIT} from './manuscript-tools.mjs';
import {getDraft,forkDraft,promoteDraft,branchCount} from './branches.mjs';
import {revisionSources,compareRevisions,findHistoricalCheckpoint} from './revision-desk.mjs';
import {journalKey,stageDraft,clearCommittedDrafts,listRecoverableDrafts,discardRecoveryEntry} from './recovery.mjs';
import {openDiagnosticDB,writeProbe,readProbe,clearProbe,collectDiagnostics} from './diagnostics.mjs';
import {APP_VERSION,updateState,checkForUpdate,approveUpdate} from './pwa-updates.mjs';
const $ = id => document.getElementById(id);
const newId = () => (globalThis.crypto?.randomUUID?.() || `ww-${Date.now()}-${Math.random().toString(36).slice(2)}`);
const now = () => new Date().toISOString();
const escapeHTML = text => String(text ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const localTime = text => text ? new Date(text).toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'}) : 'Unknown time';
const safeName = title => String(title||'untitled').replace(/[^\p{L}\p{N}_. -]/gu,'').trim().replace(/\s+/g,'_').slice(0,60) || 'untitled';
const THEMES = ['midnight','paper','daylight','mono'];
const LABELS = {midnight:'MIDNIGHT',paper:'WARM PAPER',daylight:'DAYLIGHT',mono:'MONOCHROME'};
let db = null;
let state = null;
let dirty = false;
let pendingTimer = null;
let saveQueue = Promise.resolve();
let saveVersion = 0;
let storedVersion = 0;
let storageRevision = 0;
let persistedBaseline = null;
let pendingWrites = 0;
let saveFailure = null;
let currentModal = null;
let activeRecognition = null;
let pwaRegistration = null;
let deliberateUpdate = false;
let wordTimer = 0;
const recoverySessionKey = journalKey(newId());
const diagnosticSessionId = newId();
const diagnosticTokenKey = "ww-m14-expected-token";
const getExpectedToken = () => {try{return window.sessionStorage.getItem(diagnosticTokenKey);}catch(_){return null;}};
let recoveryWarningShown = false;
const safeLocalStorage = () => {try{return window.localStorage;}catch(_){return null;}};
const EDITOR = $('editor');
const TITLE = $('scene-title');
const SAVE_STATUS = $('status');
const SAVE_LABEL = $('status-label');

function initialScene(name = 'Scene 01') {
  return { id:newId(), title:name, text:'', createdAt:now(), updatedAt:now(), cursor:0, scroll:0, history:[], branches:[] };
}
function initialProject(name = 'Untitled project') {
  return { id:newId(), title:name, createdAt:now(), updatedAt:now(), scenes:[initialScene()], fragments:[] };
}
function makeInitialState() {
  const project = initialProject();
  return { schemaVersion:1, projects:[project], activeProjectId:project.id, activeSceneId:project.scenes[0].id,activeBranchId:null,
    settings:{theme:'midnight',typewriter:true,fontSize:17,writingWidth:810,focus:false} };
}
function activeProject(){return state?.projects?.find(p=>p.id===state.activeProjectId) ?? null;}
function activeScene(){return activeProject()?.scenes.find(s=>s.id===state.activeSceneId) ?? null;}
function activeDraft(){return getDraft(activeScene(),state?.activeBranchId);}
function currentWordCount(text) {
  if (!text.trim()) return 0;
  try {
    if (Intl.Segmenter) {const segmenter=new Intl.Segmenter(undefined,{granularity:'word'});let n=0;for(const word of segmenter.segment(text)){if(word.isWordLike)n++;}return n;}
  } catch(_){}
  return text.trim().split(/\s+/).filter(Boolean).length;
}
function updateStatus(label, kind='saved') {
  SAVE_LABEL.textContent=label;
  SAVE_STATUS.className=`status ${kind}`;
  SAVE_STATUS.title=`${label}. Click for storage details.`;
}
function toast(message, ms=3900){const node=document.createElement('div');node.className='toast';node.textContent=message;$('toast-root').appendChild(node);setTimeout(()=>node.remove(),ms);}
// Per-scene revisions protect prose; changes to unrelated scenes do not clash.
// Structural project/library changes still require a catalog revision match.
function journalActiveScene(){
  const project=activeProject(),scene=activeScene(),draft=activeDraft();
  if(!project||!scene||!draft)return;
  const result=stageDraft(safeLocalStorage(),recoverySessionKey,{
    projectId:project.id,sceneId:scene.id,projectTitle:project.title,sceneTitle:state.activeBranchId?`${scene.title} / ${draft.title}`:scene.title,
    title:draft.title,text:draft.text,cursor:draft.cursor||0,baseRevision:storageRevision,updatedAt:now()
  });
  if(!result.ok&&!recoveryWarningShown){
    recoveryWarningShown=true;
    toast(`Synchronous recovery journal unavailable: ${result.reason}. Local autosave and exported backups remain essential.`,7400);
  }
}
async function putLocal(data){
  const saved = await writeWorkspace(db,data,persistedBaseline);
  persistedBaseline = saved;
  storageRevision = readRevision(saved);
}
function requestSave(){
  dirty=true;saveVersion++;saveFailure=null;updateStatus('Unsaved changes','dirty');
  clearTimeout(pendingTimer);pendingTimer=setTimeout(()=>void saveNow(),200);
}
function cloneData(){return JSON.parse(JSON.stringify({schemaVersion:1,projects:state.projects,activeProjectId:state.activeProjectId,activeSceneId:state.activeSceneId,activeBranchId:state.activeBranchId||null,settings:state.settings}));}
async function saveNow(){
  clearTimeout(pendingTimer);
  if (!dirty) return saveQueue;
  if (!db){ updateStatus('Storage unavailable — export a backup','failed');return; }
  const version=saveVersion;
  const payload=cloneData();
  dirty=false;pendingWrites++;updateStatus('Saving on this device…','saving');
  const write=saveQueue.catch(()=>{}).then(()=>putLocal(payload));
  saveQueue=write;
  try{
    await write;storedVersion=version;
    clearCommittedDrafts(safeLocalStorage(),recoverySessionKey,payload);
    if(!dirty && version===saveVersion){updateStatus('Saved on this device','saved');saveFailure=null;}
  }catch(err){
    console.error('Local save failed',err);dirty=true;saveFailure=err;
    if(err instanceof ConcurrentWorkspaceEdit){
      updateStatus('Other tab changed workspace — export backup','failed');
      toast('Another tab changed the same workspace. This tab did not overwrite it. Export a project backup before reloading.',7500);
    } else {
      updateStatus('Save failed — export backup','failed');
      toast('Local save failed. Export a backup immediately.');
    }
  } finally {pendingWrites--;}
}
function persistEditorPosition(){
  const draft=activeDraft();if(!draft)return;
  draft.cursor=EDITOR.selectionStart||0;draft.scroll=EDITOR.scrollTop||0;
}
function touchProject(){const p=activeProject();if(p)p.updatedAt=now();}
function snapshotScene(scene,reason='Manual checkpoint'){
  if(!scene)return false;
  const last=scene.history.at(-1);
  if(last && last.text===scene.text)return false;
  scene.history.push({id:newId(),title:scene.title,text:scene.text,createdAt:now(),reason,cursor:scene.cursor||0});
  if(scene.history.length>35)scene.history=scene.history.slice(-35);
  return true;
}
function maybeAutomaticSnapshot(scene){
  if(!scene)return;
  const last=scene.history.at(-1);
  const fiveMinutes=5*60*1000;
  if((!last||Date.now()-new Date(last.createdAt).getTime()>fiveMinutes) && scene.text && scene.text!==(last?.text||''))snapshotScene(scene,'Automatic checkpoint');
}
function renderLibrary(){
  const p=activeProject();const select=$('project-select');
  select.innerHTML='';state.projects.forEach(project=>{const op=document.createElement('option');op.value=project.id;op.textContent=project.title;select.appendChild(op);});
  select.value=p?.id||'';
  const sceneList=$('scene-list');sceneList.innerHTML='';
  for(const [index,scene] of (p?.scenes||[]).entries()){
    const row=document.createElement('div');row.className='scene-row';
    const button=document.createElement('button');button.className=`scene-item ${scene.id===state.activeSceneId?'active':''}`;button.dataset.sceneId=scene.id;
    button.title=scene.title;const span=document.createElement('span');span.textContent=scene.title||`Scene ${index+1}`;button.appendChild(span);
    if(scene.branches?.length){const count=document.createElement('small');count.className='branch-count';count.textContent=`${scene.branches.length} alt`;button.appendChild(count);}
    row.appendChild(button);
    const buttons=document.createElement('div');buttons.className='scene-order-actions';
    for(const [direction,label,glyph] of [[-1,'up','↑'],[1,'down','↓']]){
      const control=document.createElement('button');control.className='scene-order-button';control.type='button';control.dataset.moveScene=scene.id;control.dataset.direction=String(direction);
      control.disabled=direction===-1?index===0:index===p.scenes.length-1;
      control.title=`Move ${scene.title} ${label}`;control.setAttribute('aria-label',`Move ${scene.title} ${label}`);control.textContent=glyph;buttons.appendChild(control);
    }
    row.appendChild(buttons);sceneList.appendChild(row);
  }
  const fragmentList=$('fragment-list');fragmentList.innerHTML='';
  if(!p?.fragments?.length){const hint=document.createElement('div');hint.className='empty-hint';hint.textContent='Collect ideas without interrupting a scene.';fragmentList.appendChild(hint);}
  for(const fragment of [...(p?.fragments||[])].reverse().slice(0,35)){
    const button=document.createElement('button');button.className='fragment-item';button.dataset.fragmentId=fragment.id;
    button.title=fragment.text;const span=document.createElement('span');span.textContent=(fragment.text||'Empty fragment').replace(/\s+/g,' ').slice(0,60);button.appendChild(span);fragmentList.appendChild(button);
  }
  $('path-project').textContent=p?.title?.toUpperCase()||'PROJECT';
}
function renderScene(restore=true){
  const p=activeProject(),s=activeScene();
  if(!p||!s)return;
  if(state.activeBranchId&&!getDraft(s,state.activeBranchId))state.activeBranchId=null;
  const draft=activeDraft();
  TITLE.value=draft.title||'';EDITOR.value=draft.text||'';
  $('path-project').textContent=p.title.toUpperCase();$('path-scene').textContent=(s.title||'UNTITLED SCENE').toUpperCase();
  $('branch-name').textContent=state.activeBranchId?`ALT: ${draft.title}`:`MAIN${s.branches?.length?` · ${s.branches.length} ALT`:''}`;
  $('draft-indicator').textContent=state.activeBranchId?'ALTERNATIVE DRAFT':'WORKING DRAFT';
  updateEditorStats();
  if(restore){requestAnimationFrame(()=>{try{const c=Math.min(draft.cursor||0,EDITOR.value.length);EDITOR.setSelectionRange(c,c);EDITOR.scrollTop=draft.scroll||0;}catch(_){}});}
}
function updateEditorStats(){
  const text=EDITOR.value;
  $('word-count').textContent=`${currentWordCount(text).toLocaleString()} WORDS`;
  const start=EDITOR.selectionStart||0,before=text.slice(0,start),line=before.split('\n').length,col=before.length-before.lastIndexOf('\n');
  $('cursor-info').textContent=`LINE ${line} · COLUMN ${col}`;
}
function applySettings(){
  const prefs=state.settings;
  if(!THEMES.includes(prefs.theme))prefs.theme='midnight';
  document.body.dataset.theme=prefs.theme;
  document.body.classList.toggle('focus',!!prefs.focus);
  document.body.classList.toggle('typewriter-on',!!prefs.typewriter);
  $('theme-name').textContent=LABELS[prefs.theme];
  $('typewriter-button').classList.toggle('active',!!prefs.typewriter);
  $('typewriter-button').setAttribute('aria-pressed',String(!!prefs.typewriter));
  document.documentElement.style.setProperty('--writing-width',`${prefs.writingWidth||810}px`);
  document.documentElement.style.setProperty('--editor-font-size',`${prefs.fontSize||17}px`);
  $('focus-button').title=prefs.focus?'Leave focus mode':'Enter focus mode';
}
function renderAll(){applySettings();renderLibrary();renderScene();}
function openLibrary(){document.body.classList.add('library-open');$('mobile-backdrop').hidden=false;}
function closeLibrary(){document.body.classList.remove('library-open');$('mobile-backdrop').hidden=true;}
function selectScene(id){const p=activeProject();if(!p?.scenes.some(s=>s.id===id))return;persistEditorPosition();state.activeSceneId=id;state.activeBranchId=null;requestSave();renderLibrary();renderScene(true);closeLibrary();if(window.innerWidth>680)EDITOR.focus({preventScroll:true});}
function selectProject(id){const p=state.projects.find(x=>x.id===id);if(!p)return;persistEditorPosition();state.activeProjectId=id;state.activeSceneId=p.scenes[0].id;state.activeBranchId=null;requestSave();renderAll();closeLibrary();}
function addScene(){const p=activeProject();if(!p)return;persistEditorPosition();const scene=initialScene(`Scene ${String(p.scenes.length+1).padStart(2,'0')}`);p.scenes.push(scene);touchProject();state.activeSceneId=scene.id;state.activeBranchId=null;requestSave();renderAll();closeLibrary();TITLE.focus();TITLE.select();}
function moveScene(id,direction){
  const project=activeProject();if(!project)return;
  const result=movedScenes(project,id,direction);
  if(!result.moved)return;
  // Reordering changes the catalog scene-ID list. No scene text is changed.
  // A competing structural change will be rejected by the catalog revision.
  project.scenes=result.scenes;touchProject();requestSave();renderLibrary();
  toast('Scene order changed locally. Export a backup after arranging the manuscript.');
}
function focusSearchResult(hit){
  if(!state.projects.some(p=>p.id===hit.projectId))return;
  if(hit.kind==='checkpoint'||hit.kind==='branch-checkpoint'){
    showHistoricalPassage(hit);return;
  }
  if(hit.kind==='fragment'){
    persistEditorPosition();state.activeProjectId=hit.projectId;state.activeSceneId=activeProject()?.scenes[0]?.id;state.activeBranchId=null;
    requestSave();renderAll();closeLibrary();
    const fragment=activeProject()?.fragments.find(f=>f.id===hit.fragmentId);
    if(fragment){showFragment(fragment);requestAnimationFrame(()=>{
      const field=$('fragment-text');if(field){field.focus();field.setSelectionRange(hit.start,hit.end);}
    });}
    return;
  }
  const project=state.projects.find(p=>p.id===hit.projectId);
  if(!project.scenes.some(scene=>scene.id===hit.sceneId))return;
  persistEditorPosition();state.activeProjectId=hit.projectId;state.activeSceneId=hit.sceneId;state.activeBranchId=hit.kind==='branch'?hit.branchId:null;
  requestSave();renderAll();closeLibrary();escapeFromModal();
  // renderScene also queues its cursor restoration; the subsequent frame selects
  // the search match, not a stale stored caret position.
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    EDITOR.focus({preventScroll:true});EDITOR.setSelectionRange(hit.start,hit.end);centerCaret();updateEditorStats();
  }));
}
function showManuscriptSearch(){
  const currentProject=activeProject();
  const m=modal('Manuscript concordance',
    `<label for="manuscript-query">Literal word or phrase</label><input id="manuscript-query" maxlength="120" autocomplete="off" placeholder="Search prose and fragments…" />`+
    `<div class="concordance-filters"><div><label for="manuscript-scope">Search area</label><select id="manuscript-scope"><option value="all">All projects</option><option value="current">Current project — ${escapeHTML(currentProject?.title||'None')}</option></select></div>`+
    `<div><label for="manuscript-scene">Scene</label><select id="manuscript-scene"><option value="all">All scenes / fragments</option></select></div>`+
    `<div><label for="manuscript-source">Source type</label><select id="manuscript-source"><option value="all">All eligible writing</option><option value="main">Main scenes only</option><option value="alternatives">Alternative drafts only</option><option value="history">Checkpoints only</option><option value="fragments">Captured fragments only</option></select></div></div>`+
    `<div class="concordance-options"><label class="search-checkbox-label"><input type="checkbox" id="include-fragments" checked /> Include captured fragments</label>`+
    `<label class="search-checkbox-label"><input type="checkbox" id="include-checkpoints" /> Include historical checkpoints (read-only)</label>`+
    `<label class="search-checkbox-label"><input type="checkbox" id="search-case-sensitive" /> Match case exactly</label></div>`+
    `<p class="help">Search stays on this device, including unsaved writing in this tab. Scene filtering excludes unassigned fragments. Historical matches open read-only. Results are limited to ${SEARCH_LIMIT} occurrences; source counts describe returned results, not totals beyond the limit.</p>`+
    `<div id="search-summary" class="help" aria-live="polite">Type a phrase to search locally.</div><div id="manuscript-results" class="manuscript-results"></div>`,
    '<button id="search-close" class="btn-secondary">Close</button>',true);
  const query=m.querySelector('#manuscript-query'),scope=m.querySelector('#manuscript-scope');
  const scene=m.querySelector('#manuscript-scene'),source=m.querySelector('#manuscript-source');
  const fragments=m.querySelector('#include-fragments'),checkpoints=m.querySelector('#include-checkpoints');
  const sensitive=m.querySelector('#search-case-sensitive'),results=m.querySelector('#manuscript-results');
  let hits=[];
  // A scene filter applies to the current project's scenes. Rebuild options
  // when the search area changes; never infer project ID from a display title.
  const updateScenes=()=>{
    const chosen=scene.value;
    scene.replaceChildren();
    const all=document.createElement('option');all.value='all';all.textContent='All scenes / fragments';scene.appendChild(all);
    if(scope.value==='current')for(const draftScene of currentProject?.scenes||[]){
      const option=document.createElement('option');option.value=draftScene.id;option.textContent=draftScene.title||'Untitled scene';scene.appendChild(option);
    }
    scene.value=[...scene.options].some(o=>o.value===chosen)?chosen:'all';
    scene.disabled=scope.value!=='current';
  };
  const refresh=()=>{
    results.replaceChildren();
    const kindMap={main:['scene'],alternatives:['branch'],history:['checkpoint','branch-checkpoint'],fragments:['fragment']};
    const selectedKinds=kindMap[source.value]||null;
    // Selecting a specific source type overrides the broader checkbox toggles.
    // This avoids a "checkpoints only" view unexpectedly returning no results.
    const includeFragments=source.value==='fragments'||(source.value==='all'&&fragments.checked);
    const includeCheckpoints=source.value==='history'||(source.value==='all'&&checkpoints.checked);
    try{hits=searchManuscripts(state,query.value,{
      projectId:scope.value==='current'?currentProject?.id:null,
      sceneId:scope.value==='current'&&scene.value!=='all'?scene.value:null,
      sourceKinds:selectedKinds,caseSensitive:sensitive.checked,includeFragments,includeCheckpoints
    });}
    catch(error){hits=[];m.querySelector('#search-summary').textContent=error.message;return;}
    const tally={main:0,alternatives:0,history:0,fragments:0};
    for(const hit of hits){
      const group=hit.kind==='scene'?'main':hit.kind==='branch'?'alternatives':hit.kind==='fragment'?'fragments':'history';tally[group]++;
    }
    m.querySelector('#search-summary').textContent=query.value.trim()
      ?`${hits.length}${hits.length===SEARCH_LIMIT?'+':''} matching occurrence(s) · Main ${tally.main} · Alternatives ${tally.alternatives} · History ${tally.history} · Fragments ${tally.fragments}${dirty?' · including unsaved changes':''}`
      :'Type a phrase to search locally.';
    for(const [i,hit] of hits.entries()){
      const button=document.createElement('button');button.type='button';button.className='manuscript-hit';button.dataset.searchIndex=String(i);
      button.innerHTML=`<span class="hit-meta">${escapeHTML(hit.projectTitle)} / ${escapeHTML(hit.itemTitle)} (${hit.kind})</span>`+
        `<span class="hit-excerpt">${escapeHTML(hit.before)}<mark>${escapeHTML(hit.match)}</mark>${escapeHTML(hit.after)}</span>`;
      results.appendChild(button);
    }
    if(!hits.length&&query.value.trim())results.textContent='No matches in the selected writing.';
  };
  query.addEventListener('input',refresh);
  scope.addEventListener('change',()=>{updateScenes();refresh();});
  scene.addEventListener('change',refresh);source.addEventListener('change',refresh);
  fragments.addEventListener('change',refresh);checkpoints.addEventListener('change',refresh);
  sensitive.addEventListener('change',refresh);
  results.addEventListener('click',e=>{const button=e.target.closest('button[data-search-index]');if(button){const hit=hits[+button.dataset.searchIndex];if(hit)focusSearchResult(hit);}});
  m.querySelector('#search-close').onclick=escapeFromModal;
  updateScenes();query.focus();
}

function addProject(title){const p=initialProject(title.trim()||'Untitled project');state.projects.push(p);state.activeProjectId=p.id;state.activeSceneId=p.scenes[0].id;state.activeBranchId=null;requestSave();renderAll();closeLibrary();}
function editText(){
  const s=activeScene(),draft=activeDraft();if(!s||!draft)return;
  // Capture the PRE-EDIT text at interval boundaries: a checkpoint should
  // recover what the writer had before the latest change, not the new edit.
  if(draft.text!==EDITOR.value)maybeAutomaticSnapshot(draft);
  draft.text=EDITOR.value;draft.updatedAt=now();s.updatedAt=now();persistEditorPosition();touchProject();
  journalActiveScene();requestSave();
  clearTimeout(wordTimer);wordTimer=setTimeout(updateEditorStats,150);
}
function renameScene(){const s=activeScene(),draft=activeDraft();if(!s||!draft)return;draft.title=TITLE.value.trim()||'Untitled scene';draft.updatedAt=now();s.updatedAt=now();touchProject();journalActiveScene();requestSave();renderScene(false);renderLibrary();}
function escapeFromModal(){if(activeRecognition){try{activeRecognition.stop();}catch(_){}activeRecognition=null;}currentModal=null;$('modal-root').innerHTML='';}
function modal(title,body,footer='',wide=false){
  escapeFromModal();
  const backdrop=document.createElement('div');backdrop.className='modal-backdrop';
  backdrop.innerHTML=`<section class="modal ${wide?'wide':''}" role="dialog" aria-modal="true" aria-labelledby="modal-title"><header class="modal-header"><h2 id="modal-title">${escapeHTML(title)}</h2><button class="close-modal" aria-label="Close dialog" type="button">×</button></header><div class="modal-body">${body}</div>${footer?`<footer class="modal-footer">${footer}</footer>`:''}</section>`;
  backdrop.addEventListener('click',e=>{if(e.target===backdrop || e.target.closest('.close-modal')){escapeFromModal();EDITOR.focus({preventScroll:true});}});
  $('modal-root').appendChild(backdrop);currentModal=backdrop;
  return backdrop;
}
function showCreateProject(){
  const m=modal('New writing project','<label for="new-project-name">Project title</label><input id="new-project-name" maxlength="100" placeholder="Project name" autofocus />', '<button class="btn-secondary" id="cancel-project">Cancel</button><button class="btn-primary" id="create-project">Create project</button>');
  const field=m.querySelector('#new-project-name');field.focus();
  const done=()=>{const name=field.value.trim();if(!name)return field.focus();addProject(name);escapeFromModal();toast('Project created on this device.');};
  m.querySelector('#create-project').onclick=done;m.querySelector('#cancel-project').onclick=escapeFromModal;
  field.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();done();}};
}
function showFragment(fragment=null){
  const original=fragment?activeProject()?.fragments.find(f=>f.id===fragment.id):null;
  const m=modal(original?'Edit captured fragment':'Capture a fragment',
    `<label for="fragment-text">Text (keyboard dictation works in this field on supported phones)</label><textarea id="fragment-text" placeholder="A sentence, idea, line of dialogue, or voice transcription…">${escapeHTML(original?.text||'')}</textarea><p class="help">Stored separately from the manuscript. On Android you can dictate using your keyboard's microphone. In-app speech recognition may use a remote provider, depending on your browser.</p><div id="speech-status" class="help"></div>`,
    `<button class="btn-secondary" id="speech-mic">MICROPHONE</button>${original?'<button class="btn-danger" id="delete-fragment">Delete</button>':''}<button class="btn-secondary" id="cancel-fragment">Cancel</button><button class="btn-primary" id="save-fragment">${original?'Save changes':'Save fragment'}</button>`,true);
  const field=m.querySelector('#fragment-text');field.focus();if(!original)field.setSelectionRange(0,0);
  m.querySelector('#cancel-fragment').onclick=escapeFromModal;
  m.querySelector('#save-fragment').onclick=()=>{
    const value=field.value.trim();if(!value){field.focus();return;}
    const p=activeProject();if(!p)return;
    if(original){original.text=value;original.updatedAt=now();} else p.fragments.push({id:newId(),text:value,createdAt:now(),updatedAt:now(),kind:'text'});
    touchProject();requestSave();renderLibrary();escapeFromModal();toast('Fragment saved locally, separate from the manuscript.');
  };
  if(original){m.querySelector('#delete-fragment').onclick=()=>{if(!window.confirm('Delete this fragment? Export a backup first if you may need it later.'))return;const p=activeProject();p.fragments=p.fragments.filter(f=>f.id!==original.id);requestSave();renderLibrary();escapeFromModal();toast('Fragment deleted.');};}
  const micButton=m.querySelector('#speech-mic');
  const Speech=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!Speech){micButton.disabled=true;micButton.title='This browser does not provide in-app speech recognition; use keyboard dictation.';}
  micButton.onclick=()=>{
    if(!Speech)return;
    if(activeRecognition){try{activeRecognition.stop();}catch(_){}activeRecognition=null;micButton.textContent='MICROPHONE';return;}
    const consent=window.confirm('Your browser may send speech audio to a remote recognition service. Proceed with microphone dictation? No audio is stored by Writing Workbench.');
    if(!consent)return;
    try{
      const recog=new Speech();recog.lang=navigator.language?.startsWith('de')?'de-DE':'en-US';recog.continuous=true;recog.interimResults=false;
      recog.onresult=event=>{let addition='';for(let i=event.resultIndex;i<event.results.length;i++)if(event.results[i].isFinal)addition+=event.results[i][0].transcript+' ';if(addition){field.value=(field.value.trimEnd()+' '+addition).trimStart();field.focus();}};
      recog.onerror=event=>{m.querySelector('#speech-status').textContent=`Speech recognition: ${event.error}. Use keyboard dictation if unavailable.`;};
      recog.onend=()=>{activeRecognition=null;micButton.textContent='MICROPHONE';m.querySelector('#speech-status').textContent='Microphone stopped. Review the transcription before saving.';};
      activeRecognition=recog;recog.start();micButton.textContent='STOP MIC';m.querySelector('#speech-status').textContent='Microphone active. Speech may be processed by the browser provider.';
    }catch(e){activeRecognition=null;micButton.textContent='MICROPHONE';m.querySelector('#speech-status').textContent=`Cannot start speech recognition: ${e.message}`;}
  };
}
function showBranches(){
  const scene=activeScene();if(!scene)return;
  persistEditorPosition();
  const rows=(scene.branches||[]).map((branch,index)=>
    `<div class="snapshot-card branch-card"><div class="snapshot-top"><strong>${escapeHTML(branch.title)}</strong><small>${escapeHTML(localTime(branch.updatedAt))}</small></div>`+
    `<p>${escapeHTML(branch.text.slice(0,220))}${branch.text.length>220?'…':''}</p>`+
    `<div class="actions-inline"><button class="btn-secondary" data-open-branch="${index}">${state.activeBranchId===branch.id?'Currently open':'Open alternative'}</button>`+
    `<button class="btn-secondary" data-compare-branch="${index}">Compare</button>`+
    `<button class="btn-primary" data-promote-branch="${index}">Select as main</button></div></div>`).join('');
  const m=modal('Alternative scene drafts',
    `<p>These alternatives stay inside <strong>${escapeHTML(scene.title)}</strong>, but each retains separate text, cursor and snapshots. `+
    `Saving an alternative never rewrites the main scene. Selecting one as main creates a separate safety branch of the previous main.</p>`+
    `<p><strong>Current draft:</strong> ${escapeHTML(activeDraft()?.title||scene.title)} ${state.activeBranchId?'(alternative)':'(main)'}</p>`+
    `<div class="actions-inline"><button class="btn-secondary" id="open-main-draft">Open main draft</button></div>`+
    `<label for="branch-new-title">New alternative name</label><input id="branch-new-title" maxlength="140" value="Alternative ${(scene.branches?.length||0)+1}" />`+
    `<div class="actions-inline"><button class="btn-primary" id="create-branch">Fork current draft</button></div>`+
    `<div class="branch-list">${rows||'<p class="help">No alternatives yet.</p>'}</div>`+
    `<p class="help">All alternatives are included in v3 project and v2 workspace backups. Plain-text manuscript export includes MAIN scenes only. `+
    `Changes to the same scene from another tab remain conflict-protected.</p>`,
    '<button class="btn-secondary" id="branches-close">Close</button>',true);
  const choose=id=>{state.activeBranchId=id;requestSave();renderAll();escapeFromModal();closeLibrary();};
  m.querySelector('#branches-close').onclick=escapeFromModal;
  m.querySelector('#open-main-draft').onclick=()=>choose(null);
  m.querySelector('#create-branch').onclick=()=>{
    const name=m.querySelector('#branch-new-title').value.trim();
    if(!name){toast('Give the alternative a name.');return;}
    try{
      const branch=forkDraft(scene,state.activeBranchId,{id:newId(),title:name,timestamp:now()});
      touchProject();state.activeBranchId=branch.id;journalActiveScene();requestSave();renderAll();escapeFromModal();
      toast('Separate alternative created. Main manuscript unchanged. Export a new backup to preserve it.');
    }catch(error){toast(`Alternative not created: ${error.message}`,6800);}
  };
  m.querySelectorAll('[data-open-branch]').forEach(button=>{button.onclick=()=>choose(scene.branches[+button.dataset.openBranch].id);});
  m.querySelectorAll('[data-compare-branch]').forEach(button=>{button.onclick=()=>{
    const branch=scene.branches[+button.dataset.compareBranch];if(branch)showRevisionComparison({rightKey:`current:branch:${branch.id}`});
  };});
  m.querySelectorAll('[data-promote-branch]').forEach(button=>{button.onclick=()=>{
    const branch=scene.branches[+button.dataset.promoteBranch];if(!branch)return;
    if(!window.confirm(`Select “${branch.title}” as the MAIN scene draft? The previous main will be preserved as another alternative; the selected alternative is retained.`))return;
    try{
      const result=promoteDraft(scene,branch.id,{id:newId(),timestamp:now()});
      state.activeBranchId=null;touchProject();journalActiveScene();requestSave();renderAll();escapeFromModal();
      toast(`Main manuscript updated deliberately. Previous main retained as safety alternative. Export a backup.`);
    }catch(error){toast(`Could not select alternative: ${error.message}`,6800);}
  };});
}

/** Opens a checkpoint without changing the active draft, scene cursor or manuscript. */
function showHistoricalPassage(hit){
  const project=state?.projects?.find(p=>p.id===hit.projectId);
  const scene=project?.scenes?.find(s=>s.id===hit.sceneId);
  const saved=findHistoricalCheckpoint(scene,hit.branchId??null,hit.checkpointId);
  if(!saved){toast('Historical checkpoint is no longer available in this tab.');return;}
  const label=hit.branchId?(scene.branches||[]).find(b=>b.id===hit.branchId)?.title||'Alternative':'Main draft';
  const m=modal('Historical passage — read only',
    `<p class="help">${escapeHTML(project.title)} / ${escapeHTML(scene.title)} / ${escapeHTML(label)} · ${escapeHTML(saved.reason||'Checkpoint')} · ${escapeHTML(localTime(saved.createdAt))}. This view cannot change the manuscript.</p>`+
    `<label for="historical-text">Saved version (read-only)</label><textarea id="historical-text" readonly spellcheck="false"></textarea>`,
    '<button class="btn-secondary" id="history-compare">Compare with current draft</button><button class="btn-primary" id="historical-close">Close</button>',true);
  const field=m.querySelector('#historical-text');field.value=saved.text;
  if(Number.isSafeInteger(hit.start)&&Number.isSafeInteger(hit.end)){
    field.setSelectionRange(Math.min(hit.start,saved.text.length),Math.min(hit.end,saved.text.length));
  }
  m.querySelector('#historical-close').onclick=escapeFromModal;
  m.querySelector('#history-compare').onclick=()=>{
    const source=revisionSources(scene).find(x=>x.kind==='checkpoint'&&x.checkpointId===hit.checkpointId&&x.branchId===(hit.branchId??null));
    showRevisionComparison({scene,rightKey:source?.key});
  };
}

/** Side-by-side line comparison. All sources, including historical versions,
 *  are read-only and are rendered only as escaped text. */
function showRevisionComparison({scene=null,leftKey='current:main',rightKey=null}={}){
  const targetScene=scene||activeScene();if(!targetScene)return;
  if(!scene)persistEditorPosition();
  const sources=revisionSources(targetScene);
  const body='<p class="help">Read-only comparison of main text, alternatives and checkpoints. No merge or restore occurs here. Use Scene snapshots separately if you explicitly intend to restore an older version.</p>'+
    '<div class="revision-selectors"><label for="revision-left">Earlier / reference<select id="revision-left"></select></label><label for="revision-right">Other version<select id="revision-right"></select></label></div>'+
    '<p id="revision-summary" class="help" aria-live="polite"></p><div id="revision-diff" class="revision-diff" aria-label="Read-only line comparison"></div>';
  const m=modal('Compare drafts and checkpoints',body,'<button id="revision-close" class="btn-primary">Close comparison</button>',true);
  const left=m.querySelector('#revision-left'),right=m.querySelector('#revision-right'),summary=m.querySelector('#revision-summary'),target=m.querySelector('#revision-diff');
  for(const source of sources){
    for(const selector of [left,right]){const option=document.createElement('option');option.value=source.key;option.textContent=source.title;selector.appendChild(option);}
  }
  left.value=sources.some(x=>x.key===leftKey)?leftKey:sources[0].key;
  const alternative=sources.find(x=>x.key===rightKey)||sources.find(x=>x.key!==left.value)||sources[0];
  right.value=alternative.key;
  const render=()=>{
    target.replaceChildren();
    const a=sources.find(x=>x.key===left.value),b=sources.find(x=>x.key===right.value);
    if(!a||!b){summary.textContent='Selection unavailable';return;}
    const difference=compareRevisions(a.text,b.text);
    if(difference.tooLarge){summary.textContent=difference.message;return;}
    summary.textContent=difference.identical?'Identical text in these versions.':`${difference.added} added and ${difference.removed} removed line(s); ${difference.unchanged} unchanged line(s).`;
    const fragment=document.createDocumentFragment();
    const header=document.createElement('div');header.className='revision-row revision-header';
    for(const label of [a.title,b.title]){const cell=document.createElement('div');cell.textContent=label;header.appendChild(cell);}fragment.appendChild(header);
    for(const row of difference.rows){
      const line=document.createElement('div');line.className=`revision-row revision-${row.kind}`;
      for(const side of ['left','right']){
        const cell=document.createElement('div');cell.className='revision-cell';
        if(row[side]===null){cell.classList.add('revision-empty');cell.textContent=' ';}
        else {
          const number=document.createElement('small');number.textContent=String(row[`${side}Number`]);
          const text=document.createElement('span');text.textContent=row[side]||' ';cell.append(number,text);
        }
        line.appendChild(cell);
      }
      fragment.appendChild(line);
    }
    target.appendChild(fragment);
  };
  left.onchange=render;right.onchange=render;m.querySelector('#revision-close').onclick=escapeFromModal;
  render();
}

function showHistory(){
  const s=activeScene(),draft=activeDraft();if(!s||!draft)return;
  const items=[...(draft.history||[])].reverse();
  const content=items.length?items.map(h=>`<div class="snapshot-card"><div class="snapshot-top"><strong>${escapeHTML(localTime(h.createdAt))}</strong><small>${escapeHTML(h.reason||'Checkpoint')}</small></div><p>${escapeHTML(h.text.slice(0,240))}${h.text.length>240?'…':''}</p><div class="actions-inline"><button data-read-snapshot="${escapeHTML(h.id)}" class="btn-secondary">Read snapshot</button><button data-compare-snapshot="${escapeHTML(h.id)}" class="btn-secondary">Compare</button><button data-restore="${escapeHTML(h.id)}" class="btn-secondary">Restore snapshot</button></div></div>`).join(''):'<p>No snapshots yet. Use SNAPSHOT to create a recoverable scene checkpoint.</p>';
  const m=modal('Scene snapshots',content,`<button class="btn-secondary" id="history-close">Close</button><button class="btn-primary" id="history-save">Save snapshot now</button>`,true);
  m.querySelector('#history-close').onclick=escapeFromModal;
  m.querySelector('#history-save').onclick=()=>{persistEditorPosition();const added=snapshotScene(draft,'Manual checkpoint');if(added){requestSave();toast('Snapshot stored in this device’s project database.');}else toast('This scene already matches the latest snapshot.');showHistory();};
  m.querySelectorAll('[data-read-snapshot]').forEach(button=>button.onclick=()=>showHistoricalPassage({projectId:activeProject()?.id,sceneId:s.id,branchId:state.activeBranchId,checkpointId:button.dataset.readSnapshot}));
  m.querySelectorAll('[data-compare-snapshot]').forEach(button=>button.onclick=()=>{
    const choice=revisionSources(s).find(x=>x.kind==='checkpoint'&&x.checkpointId===button.dataset.compareSnapshot&&x.branchId===(state.activeBranchId??null));
    showRevisionComparison({leftKey:`current:${state.activeBranchId?`branch:${state.activeBranchId}`:'main'}`,rightKey:choice?.key});
  });
  m.querySelectorAll('[data-restore]').forEach(button=>button.onclick=()=>{
    const saved=draft.history.find(h=>h.id===button.dataset.restore);if(!saved)return;
    if(!window.confirm('Restore this scene snapshot? The current scene will first receive a separate checkpoint.'))return;
    persistEditorPosition();snapshotScene(draft,'Before restoring an earlier snapshot');draft.text=saved.text;draft.title=saved.title;draft.cursor=Math.min(saved.cursor||0,draft.text.length);draft.scroll=0;draft.updatedAt=now();s.updatedAt=now();touchProject();journalActiveScene();requestSave();renderAll();escapeFromModal();toast('Scene restored; prior state preserved as a checkpoint when changed.');
  });
}
function download(filename,content,mime='application/octet-stream'){
  const blob=new Blob([content],{type:mime});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),15000);
}
async function currentExportData(){
  // Read the latest committed scenes, including changes from other open tabs.
  // If this tab cannot save, export its unsaved in-memory version instead.
  await saveNow();
  if(db && !dirty && !saveFailure){
    try{return await readWorkspace(db);}catch(error){console.warn('Cannot refresh archive from IndexedDB',error);}
  }
  toast('Exporting this tab’s unsaved state. The archive might not include other tabs’ latest writing.',7200);
  return state;
}
async function exportWorkspace(){
  persistEditorPosition();
  try{
    const current=await currentExportData();
    const archive=await createWorkspaceArchive({projects:current.projects});
    download(`Writing_Workbench_All_Projects_${new Date().toISOString().slice(0,10)}.wwworkspace.json`,JSON.stringify(archive,null,2),'application/json');
    toast(`All ${archive.manifest.projects} projects exported. Keep the backup outside this browser.`);
  }catch(error){toast(`Workspace export failed: ${error.message}`,7300);}
}
async function exportProject(){
  persistEditorPosition();const projectId=state.activeProjectId;if(!projectId)return;
  try {
    const current=await currentExportData();
    const p=current.projects.find(project=>project.id===projectId)||activeProject();
    const bundle=await createArchive(p);
    download(`${safeName(p.title)}.wwproject.json`,JSON.stringify(bundle,null,2),'application/json');
    toast('Verified project archive downloaded. Keep a copy outside the browser.');
  } catch(err){toast(`Could not create a verified backup: ${err.message}`,7000);}
}
async function exportText(){
  const projectId=state.activeProjectId;if(!projectId)return;
  try{
    const current=await currentExportData();
    const p=current.projects.find(project=>project.id===projectId)||activeProject();
    const content=p.scenes.map(s=>`${s.title}\n\n${s.text}`).join('\n\n\n');
    download(`${safeName(p.title)}.txt`,content,'text/plain;charset=utf-8');toast('Manuscript exported as plain text.');
  }catch(err){toast(`Text export failed: ${err.message}`,7200);}
}

/* Review an existing downloaded file without adding anything to IndexedDB.
   This complements import verification: the browser may otherwise report a
   generated backup without proving that the downloaded file can be read. */
async function verifyBackupFile(file){
  if(!file)return;
  if(file.size>40*1024*1024){toast('Backup verification rejected: file exceeds 40 MB.',7500);return;}
  try{
    let saved=null;
    if(db&&!dirty&&!saveFailure&&!pendingWrites){
      try{saved=await readWorkspace(db);}catch(error){console.warn('Cannot compare backup against local saved records',error);}
    }
    const report=await inspectBackup(await file.text(),saved);
    const integrity=report.integrity==='legacy-unchecksummed'
      ?'LEGACY FILE: readable, but this v1 archive has no cryptographic checksum.'
      :'CHECKSUM AND MANIFEST PASSED: archive contents are internally consistent.';
    const messages={
      match:'The contained projects match corresponding writing currently saved on this device (excluding generated project timestamps).',
      different:'The archive is valid but contains writing different from the currently saved project(s). This can be an older backup; it is not necessarily corrupt.',
      partial:'Some projects match; other archive projects are not in the current local library.',
      'not-present':'The archive projects are not present under the same IDs on this device. This does not make the backup invalid.',
      'not-checked':'Comparison with the saved local library was unavailable (unsaved changes, save conflict or storage unavailable).'
    };
    const m=modal('Verify an existing backup',
      `<p><strong>${escapeHTML(integrity)}</strong></p><p>Selected file: ${escapeHTML(file.name||'JSON file')}</p>`+
      `<p>Archive: ${escapeHTML(report.kind)} · ${report.counts.projects} project(s) · ${report.counts.scenes} scene(s) · `+
      `${report.counts.fragments} fragment(s) · ${report.counts.branches||0} alternative(s) · ${report.counts.checkpoints} checkpoint(s).</p>`+
      `<p><strong>Comparison with saved writing:</strong> ${escapeHTML(messages[report.comparison.status])}</p>`+
      `<p class="help">This is read-only: no projects, drafts or storage records were modified. `+
      `A valid checksum cannot establish that the file is stored on another device or protected from future loss. `+
      `For lasting safety, keep independent copies and practise importing into a disposable browser profile.</p>`,
      '<button id="verification-close" class="btn-primary">Close</button>',true);
    m.querySelector('#verification-close').onclick=escapeFromModal;
  }catch(error){toast(`Backup verification failed: ${error.message}. The file was not imported.`,8500);}
}

async function importProject(file){
  if(!file)return;
  if(file.size>40*1024*1024){toast('Import rejected: archive exceeds 40 MB.');return;}
  try{
    const contents=JSON.parse(await file.text());
    let projects,description;
    if(contents.format===WORKSPACE_FORMAT){
      const verified=await parseWorkspaceArchive(contents,newId,now);
      projects=verified.projects;
      description=`Verified workspace archive with ${verified.manifest.projects} projects`;
    }else{
      const verified=await parseArchive(contents,newId,now);
      projects=[verified.project];description=`Verified v${verified.sourceVersion} project archive`;
    }
    const sceneCount=projects.reduce((n,p)=>n+p.scenes.length,0);
    const fragmentCount=projects.reduce((n,p)=>n+p.fragments.length,0);
    const checkpoints=projects.reduce((n,p)=>n+p.scenes.reduce((m,s)=>m+s.history.length+(s.branches||[]).reduce((k,b)=>k+b.history.length,0),0),0);
    const alternatives=projects.reduce((n,p)=>n+branchCount(p),0);
    const names=projects.slice(0,12).map(p=>`<li>${escapeHTML(p.title||'Untitled project')} — ${p.scenes.length} scene(s)</li>`).join('');
    const extra=projects.length>12?`<p>…and ${projects.length-12} further projects.</p>`:'';
    const m=modal('Review verified archive before import',
      `<p><strong>${escapeHTML(description)}</strong></p><p>Source: ${escapeHTML(file.name||'JSON archive')}</p>`+
      `<p>${projects.length} project(s) · ${sceneCount} scene(s) · ${fragmentCount} fragment(s) · ${alternatives} alternative(s) · ${checkpoints} checkpoint(s)</p>`+
      `<ul class="import-preview-list">${names}</ul>${extra}`+
      '<p><strong>Import creates additional copies.</strong> Existing projects are never replaced. ' +
      'This does not synchronise writing with the source device.</p>'+
      '<p class="help">The file integrity check passed. After importing, Workbench will separately read the committed local database and verify the imported text and metadata. Keep the original archive outside this browser.</p>',
      '<button id="import-cancel" class="btn-secondary">Cancel</button><button id="import-confirm" class="btn-primary">Import separate copies</button>',true);
    m.querySelector('#import-cancel').onclick=escapeFromModal;
    m.querySelector('#import-confirm').onclick=async()=>{
      const button=m.querySelector('#import-confirm');button.disabled=true;
      // The initial file preview leaves all saved and in-memory writing untouched.
      // Only this explicit action may add the projects to the local catalog.
      state.projects.push(...projects);
      state.activeProjectId=projects[0].id;state.activeSceneId=projects[0].scenes[0].id;state.activeBranchId=null;
      requestSave();renderAll();closeLibrary();
      await saveNow();
      escapeFromModal();
      if(saveFailure||dirty){
        toast('Import not safely committed. This tab retains the projects; export a backup before closing.',8500);return;
      }
      try{
        const committed=await readWorkspace(db);
        const result=verifyPersistedProjects(committed,projects);
        if(!result.ok)throw new Error(result.reason);
        toast(`${result.projects} project(s) and ${result.scenes} scenes imported and verified in local storage. Keep the archive outside this browser.`,6500);
      }catch(error){
        saveFailure=error;
        updateStatus('Import not verified — export backup','failed');
        toast(`Import verification failed: ${error.message}. Keep this tab open and export a backup.`,9000);
      }
    };
  }catch(err){toast(`Import rejected: ${err.message}`,7000);}
}

function showRecoverableDrafts(){
  const items=listRecoverableDrafts(safeLocalStorage(),state);
  if(!items.length){toast('No pending recovery drafts were found.');return;}
  const rows=items.slice(0,25).map(({entry},i)=>`<div class="snapshot-card"><strong>${escapeHTML(entry.sceneTitle||entry.title||'Scene')}</strong><small> · ${escapeHTML(entry.projectTitle||'Project')}</small><p>${escapeHTML(entry.text.slice(0,330))}${entry.text.length>330?'…':''}</p><div class="actions-inline"><button class="btn-secondary" data-recover="${i}">Recover as a new scene</button><button class="btn-danger" data-discard="${i}">Discard</button></div></div>`).join('');
  const m=modal('Recover writing from another session',`<p>These drafts differ from saved scenes. Recovering creates a separate scene; existing manuscript text is not overwritten. Journal text is stored locally and is not a full project backup.</p>${rows}`,'<button id="recovery-close" class="btn-secondary">Close</button>',true);
  m.querySelector('#recovery-close').onclick=escapeFromModal;
  m.querySelectorAll('[data-recover]').forEach(button=>button.onclick=async()=>{
    const {key,entry}=items[Number(button.dataset.recover)];
    let project=state.projects.find(p=>p.id===entry.projectId);
    if(!project){project=initialProject(`Recovered — ${entry.projectTitle||'Project'}`);state.projects.push(project);}
    const recovered=initialScene(`Recovered — ${entry.sceneTitle||entry.title||'Scene'}`);
    recovered.text=entry.text;recovered.cursor=Math.min(entry.cursor||0,entry.text.length);
    project.scenes.push(recovered);state.activeProjectId=project.id;state.activeSceneId=recovered.id;state.activeBranchId=null;
    journalActiveScene();requestSave();renderAll();escapeFromModal();await saveNow();
    if(!saveFailure&&!dirty){discardRecoveryEntry(safeLocalStorage(),key,entry);toast('Recovery saved as a separate scene; original scene was preserved.');}
    else toast('Recovered in this tab, but local save failed. Export a backup now.',8000);
  });
  m.querySelectorAll('[data-discard]').forEach(button=>button.onclick=()=>{
    const {key,entry}=items[Number(button.dataset.discard)];
    if(!window.confirm('Permanently discard this recovery entry? This cannot be undone.'))return;
    discardRecoveryEntry(safeLocalStorage(),key,entry);escapeFromModal();showRecoverableDrafts();
  });
}
function showStorageStatus(){
  const status=saveFailure?(saveFailure instanceof ConcurrentWorkspaceEdit?'CONCURRENT EDIT CONFLICT':'LOCAL SAVE FAILED'):(dirty||pendingWrites)?'UNSAVED OR PENDING WRITES':db?'SAVED ON THIS DEVICE':'LOCAL STORAGE UNAVAILABLE';
  const m=modal('Storage and recovery',`<p><strong>${status}</strong></p><p>The prototype saves to IndexedDB in this browser, on this device. It does not synchronise with Google Drive, iPad, Android, Windows, or another browser.</p><p>Local browser data can still be deleted or evicted. Export a project backup regularly and keep it outside this device.</p><p><strong>Saved record revision count:</strong> ${storageRevision}. Each scene now has its own save revision; changes to a different scene can be saved by another tab without overwriting this one. ${saveFailure instanceof ConcurrentWorkspaceEdit?'Another tab changed the same scene or the project library. Export the current tab’s backup and reopen before further editing.':''}</p><p class="help">Export individual projects or the complete workspace to move them between devices. An import creates separate copies. A best-effort synchronous recovery journal can preserve smaller in-flight scene edits, but it is not an external backup.</p>`, `<button id="storage-close" class="btn-secondary">Close</button><button id="storage-export" class="btn-primary">Export backup</button>`);
  m.querySelector('#storage-close').onclick=escapeFromModal;
  m.querySelector('#storage-export').onclick=()=>{void exportProject();escapeFromModal();};
  const recoveryButton=document.createElement('button');recoveryButton.className='btn-secondary';recoveryButton.textContent='Recovery drafts';
  m.querySelector('.modal-footer').prepend(recoveryButton);recoveryButton.onclick=showRecoverableDrafts;
  const updateButton=document.createElement('button');updateButton.className='btn-secondary';updateButton.textContent='App updates';
  m.querySelector('.modal-footer').prepend(updateButton);updateButton.onclick=showAppUpdates;
  const checkBackupButton=document.createElement('button');checkBackupButton.className='btn-secondary';checkBackupButton.textContent='Verify backup file';
  m.querySelector('.modal-footer').prepend(checkBackupButton);checkBackupButton.onclick=()=>{escapeFromModal();$('verify-file').click();};
  const diagnosticButton=document.createElement('button');diagnosticButton.className='btn-secondary';diagnosticButton.textContent='Run storage diagnostics';
  m.querySelector('.modal-footer').prepend(diagnosticButton);diagnosticButton.onclick=()=>void showDiagnostics();
  // Browser-controlled persistence is not a backup and may be unavailable on iPad.
  const area=m.querySelector('.modal-body');
  const label=document.createElement('p');label.className='help';
  label.textContent='Checking whether this browser can protect local storage from automatic eviction…';
  area.appendChild(label);
  if(navigator.storage?.persisted){
    navigator.storage.persisted().then(ok=>{
      if(!label.isConnected)return;
      label.textContent=ok?'Browser reports persistent local storage. Keep external backups.':'Local storage is not guaranteed against browser cleanup. Export backups regularly.';
    }).catch(()=>{if(label.isConnected)label.textContent='Browser storage protection status could not be determined.';});
  }else label.textContent='This browser does not expose storage-persistence controls. Keep external backups.';
  if(navigator.storage?.persist){
    const protect=document.createElement('button');protect.className='btn-secondary';protect.textContent='Request storage protection';
    m.querySelector('.modal-footer').prepend(protect);
    protect.onclick=async()=>{
      try{const ok=await navigator.storage.persist();label.textContent=ok?'Browser granted persistent storage. This is not a backup.':'Browser declined storage protection. Keep regular external backups.';}
      catch(e){label.textContent=`Storage protection is unavailable: ${e.message}`;}
    };
  }
}
async function showDiagnostics(){
  let diagnosticDb=null;try{diagnosticDb=await openDiagnosticDB();}catch(e){toast(`Diagnostic marker storage unavailable: ${e.message}`,6500);}
  const m=modal('Browser storage diagnostics',
    `<p>This diagnostic uses a random marker, not manuscript content. It checks whether the marker can be read after opening a new page instance, plus reported storage and cached app-shell state.</p><p><strong>Storage is not a backup.</strong> Before testing, export a complete workspace archive outside this browser.</p><div class="diagnostic-state" role="status" aria-live="polite">Checking browser capabilities…</div><pre class="diagnostic-output" aria-label="Diagnostic results"></pre><p class="help">For a genuine offline test, install the application from HTTPS, disconnect the device, and reopen the app. Cached files alone do not prove offline functionality.</p>`,
    `<button id="diag-start" class="btn-secondary">Write test marker</button><button id="diag-check" class="btn-secondary">Check again</button><button id="diag-reload" class="btn-secondary">Reload to verify</button><button id="diag-export" class="btn-primary">Export report</button><button id="diag-clear" class="btn-secondary">Clear marker</button><button id="diag-close" class="btn-secondary">Close</button>`,true);
  let report=null;
  const output=m.querySelector('.diagnostic-output');
  const line=m.querySelector('.diagnostic-state');
  const render=async()=>{
    try{
      report=await collectDiagnostics({db,diagnosticDb,sessionId:diagnosticSessionId,expectedToken:getExpectedToken()});
      if(!m.isConnected)return;
      line.textContent=report.probe.message;
      output.textContent=JSON.stringify({
        marker:report.probe.state,
        databaseConnectionOpen:report.appDatabaseAvailable,
        secureContext:report.secureContext,
        browserPersistence:report.storage.persistenceGranted===null?'unknown':report.storage.persistenceGranted,
        serviceWorkerControlsThisPage:report.serviceWorker.controlled,
        offlineShellCached:report.serviceWorker.allExpectedAssetsCached,
        sceneStorageAudit:report.sceneAudit,
        browserReportsOnline:report.network.navigatorReportsOnline,
        storageUsedBytes:report.storage.approximateUsageBytes,
        storageQuotaBytes:report.storage.approximateQuotaBytes
      },null,2);
    }catch(e){line.textContent=`Diagnostic failed: ${e.message}`;}
  };
  m.querySelector('#diag-start').onclick=async()=>{
    if(dirty||pendingWrites){await saveNow();if(dirty||saveFailure){toast('Save the current scene or export a backup before testing.',7200);return;}}
    try{const marker=await writeProbe(diagnosticDb,diagnosticSessionId);
      try{window.sessionStorage.setItem(diagnosticTokenKey,marker.token);}catch(_){toast("Session storage unavailable; reload check may be inconclusive.");}
      await render();toast('Non-manuscript test marker saved. Reload the page, then check again.');}
    catch(e){toast(`Could not write diagnostic marker: ${e.message}`,7200);await render();}
  };
  m.querySelector('#diag-check').onclick=render;
  m.querySelector('#diag-reload').onclick=async()=>{
    if(dirty||pendingWrites){await saveNow();if(dirty||saveFailure){toast('Cannot reload with unsaved changes. Export a backup first.',7200);return;}}
    window.location.reload();
  };
  m.querySelector('#diag-export').onclick=()=>{
    if(!report){toast('Run the diagnostic before exporting its report.');return;}
    download(`Writing_Workbench_Diagnostic_${new Date().toISOString().slice(0,10)}.json`,JSON.stringify(report,null,2),'application/json');
    toast('Diagnostic report downloaded. It contains no manuscript content.');
  };
  m.querySelector('#diag-clear').onclick=async()=>{try{await clearProbe(diagnosticDb);try{sessionStorage.removeItem(diagnosticTokenKey);}catch(_){}await render();toast('Diagnostic marker cleared without touching manuscript storage.');}catch(e){toast(`Unable to clear diagnostic marker: ${e.message}`);}};
  m.querySelector('#diag-close').onclick=escapeFromModal;
  await render();
}
function showAppUpdates(){
  const m=modal('Application updates',
    `<p><strong>Writing Workbench ${APP_VERSION}</strong></p><p>Installed updates are kept waiting until you choose to apply them. This protects the current editing session from an automatic application-code swap.</p><p><strong id="update-state">Checking…</strong></p><p class="help">Your manuscript stays in browser storage tied to this exact site origin. Updating this site does not sync content with other devices. Export a complete-workspace backup before changing hosting locations or updating an important writing installation.</p><p class="help">Close other Writing Workbench tabs before applying an update. A newly activated service worker may also serve those tabs.</p>`,
    `<button class="btn-secondary" id="check-app-update">Check for update</button><button class="btn-primary" id="apply-app-update">Apply downloaded update</button><button class="btn-secondary" id="update-close">Close</button>`);
  const label=m.querySelector('#update-state');
  const apply=m.querySelector('#apply-app-update');
  const render=()=>{
    const state=updateState(pwaRegistration,'serviceWorker' in navigator);
    const messages={unsupported:'Service workers not supported in this context.',unregistered:'No registered service worker (requires localhost or HTTPS).',installing:'Downloading application shell…',ready:'A new version is ready. Save and close other tabs before applying.',current:'No downloaded update is waiting.'};
    label.textContent=messages[state]||'Update status unknown.';
    apply.disabled=state!=='ready';
  };
  m.querySelector('#check-app-update').onclick=async()=>{
    label.textContent='Checking server for a new version…';
    try{if(!pwaRegistration&&navigator.serviceWorker)pwaRegistration=await navigator.serviceWorker.getRegistration();await checkForUpdate(pwaRegistration);render();}
    catch(e){label.textContent=`Update check failed: ${e.message}`;}
  };
  m.querySelector('#apply-app-update').onclick=async()=>{
    if(!pwaRegistration?.waiting){render();return;}
    if(!window.confirm('Apply this update after all local writes complete? Close other Workbench tabs and keep an external backup. The application will reload.'))return;
    try{
      const result=await approveUpdate(pwaRegistration,async()=>{
        await saveNow();
        try{await saveQueue;}catch(_){}
        const safe=!!db&&!dirty&&!saveFailure&&!pendingWrites;
        // Mark the reload as intentional BEFORE messaging the waiting worker.
        if(safe) deliberateUpdate=true;
        return safe;
      });
      if(result.state==='requested')label.textContent='Update approved. Activating and reloading…';
      else {
        deliberateUpdate=false;
        label.textContent=result.state==='unsafe'?'Cannot update: local writing is unsaved, conflicted or storage failed. Export a backup first.':'No waiting update found.';
      }
    }catch(e){deliberateUpdate=false;label.textContent=`Update could not start: ${e.message}`;}
  };
  m.querySelector('#update-close').onclick=escapeFromModal;
  render();
}
function observeWorkerUpdates(reg){
  if(!reg)return;
  const announce=worker=>{
    if(!worker)return;
    worker.addEventListener('statechange',()=>{
      if(worker.state==='installed'&&navigator.serviceWorker.controller){
        toast('A Writing Workbench update is ready. Open Commands → Application updates to install it when writing is saved.',6500);
      }
    });
  };
  reg.addEventListener('updatefound',()=>announce(reg.installing));
  if(reg.waiting)toast('A Writing Workbench update is ready. Choose when to install it.',6000);
}
function showSettings(){
  const m=modal('Writing surface',`<label for="setting-font">Text size: <strong id="font-value">${state.settings.fontSize}px</strong></label><input id="setting-font" type="range" min="14" max="26" step="1" value="${state.settings.fontSize}"/><label for="setting-width">Maximum writing column: <strong id="width-value">${state.settings.writingWidth}px</strong></label><input id="setting-width" type="range" min="560" max="1100" step="20" value="${state.settings.writingWidth}"/><p class="help">Display settings do not change source text or plain-text exports. The workspace does not currently support cloud synchronisation.</p>`, `<button class="btn-secondary" id="setting-close">Close</button>`);
  const font=m.querySelector('#setting-font'),width=m.querySelector('#setting-width');
  font.oninput=()=>{state.settings.fontSize=+font.value;m.querySelector('#font-value').textContent=font.value+'px';applySettings();requestSave();};
  width.oninput=()=>{state.settings.writingWidth=+width.value;m.querySelector('#width-value').textContent=width.value+'px';applySettings();requestSave();};
  m.querySelector('#setting-close').onclick=escapeFromModal;
}
function commandList(){return [
  {label:'Resume writing',hint:'Editor',fn:()=>EDITOR.focus()},
  {label:'Capture fragment',hint:'⌘/Ctrl J',fn:()=>showFragment()},
  {label:'New scene',hint:'⌘/Ctrl ⌥ N',fn:addScene},
  {label:'Search manuscript and fragments',hint:'All projects · local',fn:showManuscriptSearch},
  {label:'New project',hint:'Library',fn:showCreateProject},
  {label:'Toggle focus mode',hint:'⌘/Ctrl ⇧ F',fn:toggleFocus},
  {label:'Toggle typewriter scrolling',hint:'Editor',fn:toggleTypewriter},
  {label:'Scene snapshots',hint:'⌘/Ctrl ⇧ H',fn:showHistory},
  {label:'Alternative scene drafts',hint:'Fork · switch · select main',fn:showBranches},
  {label:'Compare drafts and checkpoints',hint:'Read-only · line comparison',fn:()=>showRevisionComparison()},
  {label:'Save scene snapshot',hint:'⌘/Ctrl S',fn:manualSnapshot},
  {label:'Export project backup',hint:'Recovery',fn:exportProject},
  {label:'Export all projects — workspace backup',hint:'Recovery',fn:exportWorkspace},
  {label:'Review pending recovery drafts',hint:'Recovery',fn:showRecoverableDrafts},
  {label:'Export manuscript text',hint:'Export',fn:exportText},
  {label:'Import a project archive',hint:'Recovery',fn:()=>{$('import-file').click();}},
  {label:'Verify a downloaded backup',hint:'Read-only',fn:()=>{$('verify-file').click();}},
  {label:'Writing surface settings',hint:'Typography',fn:showSettings},
  {label:'Change theme',hint:LABELS[state.settings.theme],fn:nextTheme},
  {label:'Save status and recovery',hint:'Local',fn:showStorageStatus},
  {label:'Test browser storage and offline cache',hint:'Diagnostics',fn:()=>void showDiagnostics()},
  {label:'Application updates',hint:APP_VERSION,fn:showAppUpdates}
];}
function showPalette(){
  const m=modal('Command palette',`<label class="visually-hidden" for="command-search">Search commands</label><input class="command-search" id="command-search" placeholder="Type a command…" autocomplete="off" autofocus /><div id="command-list" class="command-list"></div>`,'',true);
  const input=m.querySelector('#command-search'),list=m.querySelector('#command-list');let filtered=[],selected=0;
  const run=i=>{const cmd=filtered[i];if(!cmd)return;escapeFromModal();cmd.fn();};
  const show=()=>{
    filtered=commandList().filter(c=>c.label.toLowerCase().includes(input.value.toLowerCase()));selected=0;list.innerHTML='';
    filtered.forEach((cmd,i)=>{const b=document.createElement('button');b.className='command-option';b.type='button';b.innerHTML=`<span>${escapeHTML(cmd.label)}</span><small>${escapeHTML(cmd.hint)}</small>`;b.onclick=()=>run(i);list.appendChild(b);});
    if(!filtered.length){const hint=document.createElement('p');hint.className='help';hint.textContent='No matching commands.';list.appendChild(hint);}
  };
  input.oninput=show;input.onkeydown=e=>{
    if(e.key==='ArrowDown'){e.preventDefault();selected=Math.min(filtered.length-1,selected+1);list.children[selected]?.focus();}
    else if(e.key==='Enter'){e.preventDefault();run(selected);}
  };
  list.onkeydown=e=>{if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();const items=[...list.querySelectorAll('button')];const i=items.indexOf(document.activeElement);const next=Math.max(0,Math.min(items.length-1,i+(e.key==='ArrowDown'?1:-1)));selected=next;items[next]?.focus();}else if(e.key==='Enter'){e.preventDefault();run(selected);}};
  show();input.focus();
}
function manualSnapshot(){const s=activeDraft();if(!s)return;persistEditorPosition();if(snapshotScene(s,'Manual checkpoint')){requestSave();toast('Scene snapshot saved locally.');}else toast('No changes since last snapshot.');}
function toggleFocus(){state.settings.focus=!state.settings.focus;applySettings();requestSave();closeLibrary();EDITOR.focus({preventScroll:true});}
function toggleTypewriter(){state.settings.typewriter=!state.settings.typewriter;applySettings();requestSave();toast(state.settings.typewriter?'Typewriter scrolling enabled':'Normal scrolling enabled');}
function nextTheme(){const index=THEMES.indexOf(state.settings.theme);state.settings.theme=THEMES[(index+1)%THEMES.length];applySettings();requestSave();}
// A lightweight hidden mirror measures caret position for proportional fonts and wrapped lines.
let mirror=null;
function centerCaret(){
  if(!state?.settings.typewriter||document.activeElement!==EDITOR||window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  if(EDITOR.value.length>150000)return; // keep long manuscripts responsive
  const comp=getComputedStyle(EDITOR);
  if(!mirror){mirror=document.createElement('div');mirror.setAttribute('aria-hidden','true');mirror.style.cssText='position:fixed;top:-100000px;left:-100000px;visibility:hidden;pointer-events:none;white-space:pre-wrap;overflow-wrap:break-word;box-sizing:border-box;';document.body.appendChild(mirror);}
  mirror.style.width=EDITOR.clientWidth+'px';mirror.style.font=comp.font;mirror.style.lineHeight=comp.lineHeight;mirror.style.letterSpacing=comp.letterSpacing;
  mirror.style.padding=comp.padding;mirror.textContent=EDITOR.value.slice(0,EDITOR.selectionStart).replace(/\n$/,'\n\u200b');
  const mark=document.createElement('span');mark.textContent='\u200b';mirror.appendChild(mark);
  const lineY=mark.offsetTop-mirror.offsetTop;
  const target=Math.max(0,lineY-EDITOR.clientHeight*.45);
  if(Math.abs(EDITOR.scrollTop-target)>3)EDITOR.scrollTop=target;
}
function bindEvents(){
  EDITOR.addEventListener('input',()=>{editText();requestAnimationFrame(centerCaret);});
  EDITOR.addEventListener('keyup',()=>{persistEditorPosition();updateEditorStats();requestAnimationFrame(centerCaret);});
  EDITOR.addEventListener('click',()=>{persistEditorPosition();updateEditorStats();});
  EDITOR.addEventListener('scroll',()=>{const draft=activeDraft();if(draft)draft.scroll=EDITOR.scrollTop;});
  TITLE.addEventListener('input',renameScene);
  $('new-project').onclick=showCreateProject;$('new-scene').onclick=addScene;$('manuscript-search').onclick=showManuscriptSearch;
  $('new-fragment').onclick=()=>showFragment();$('backup-button').onclick=exportProject;
  $('workspace-backup-button').onclick=exportWorkspace;
  $('history-button').onclick=showHistory;$('compare-button').onclick=()=>showRevisionComparison();$('import-button').onclick=()=>$('import-file').click();
  $('import-file').onchange=async e=>{const file=e.target.files?.[0];await importProject(file);e.target.value='';};
  $('verify-backup-button').onclick=()=>$('verify-file').click();
  $('verify-file').onchange=async e=>{const file=e.target.files?.[0];await verifyBackupFile(file);e.target.value='';};
  $('project-select').onchange=e=>selectProject(e.target.value);
  $('scene-list').onclick=e=>{
    const move=e.target.closest('button[data-move-scene]');
    if(move){moveScene(move.dataset.moveScene,Number(move.dataset.direction));return;}
    const id=e.target.closest('button[data-scene-id]')?.dataset.sceneId;if(id)selectScene(id);
  };
  $('fragment-list').onclick=e=>{const id=e.target.closest('button[data-fragment-id]')?.dataset.fragmentId;const fragment=activeProject()?.fragments.find(x=>x.id===id);if(fragment){closeLibrary();showFragment(fragment);}};
  $('focus-button').onclick=toggleFocus;$('command-button').onclick=showPalette;$('status').onclick=showStorageStatus;
  $('theme-button').onclick=nextTheme;$('typewriter-button').onclick=toggleTypewriter;
  $('snapshot-button').onclick=manualSnapshot;$('export-text-button').onclick=exportText;
  $('branches-button').onclick=showBranches;$('compare-toolbar').onclick=()=>showRevisionComparison();
  $('mobile-menu').onclick=openLibrary;$('mobile-library').onclick=openLibrary;
  $('mobile-write').onclick=()=>{closeLibrary();EDITOR.focus();};$('mobile-fragment').onclick=()=>showFragment();
  $('mobile-backdrop').onclick=closeLibrary;
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'){if(currentModal){escapeFromModal();e.preventDefault();}else if(document.body.classList.contains('library-open'))closeLibrary();return;}
    if(currentModal)return;
    if(e.isComposing)return;
    const mod=e.metaKey||e.ctrlKey;
    if(!mod)return;
    const key=e.key.toLowerCase();
    if(key==='k'&&!e.altKey){e.preventDefault();showPalette();}
    else if(key==='j'&&!e.altKey){e.preventDefault();showFragment();}
    else if(key==='f'&&e.shiftKey){e.preventDefault();toggleFocus();}
    else if(key==='n'&&e.altKey){e.preventDefault();addScene();}
    else if(key==='h'&&e.shiftKey){e.preventDefault();showHistory();}
    else if(key==='s'){e.preventDefault();manualSnapshot();void saveNow();}
  });
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'&&dirty)void saveNow();});
  window.addEventListener('pagehide',()=>{if(dirty)void saveNow();});
  window.addEventListener('beforeunload',e=>{if(dirty||pendingWrites){e.preventDefault();e.returnValue='';}});
}
async function boot(){
  bindEvents();
  try{
    db=await openWorkspaceDB();
    const stored=await readWorkspace(db);
    storageRevision=readRevision(stored);
    persistedBaseline = stored ? structuredClone(stored) : null;
    if(stored&&Array.isArray(stored.projects)&&stored.projects.length){
      state=stored;
      state.settings={theme:'midnight',typewriter:true,fontSize:17,writingWidth:810,focus:false,...stored.settings};
      state.projects=stored.projects.filter(p=>p&&Array.isArray(p.scenes)&&p.scenes.length);
      if(!state.projects.length)state=makeInitialState();
      if(!state.projects.some(p=>p.id===state.activeProjectId))state.activeProjectId=state.projects[0].id;
      if(!activeProject()?.scenes.some(s=>s.id===state.activeSceneId))state.activeSceneId=activeProject().scenes[0].id;
      for(const p of state.projects){if(!Array.isArray(p.fragments))p.fragments=[];for(const s of p.scenes){if(!Array.isArray(s.history))s.history=[];if(!Array.isArray(s.branches))s.branches=[];}}
      if(!getDraft(activeScene(),state.activeBranchId))state.activeBranchId=null;
      updateStatus('Saved on this device','saved');
    }else{state=makeInitialState();requestSave();}
  }catch(err){
    console.error('Local database unavailable',err);state=makeInitialState();saveFailure=err;
    updateStatus('Storage unavailable — export backup','failed');
    toast('Local storage could not be opened. Export your work before closing.');
  }
  renderAll();
  if(listRecoverableDrafts(safeLocalStorage(),state).length)showRecoverableDrafts();
  const action=new URL(location.href).searchParams.get('action');
  if(action==='fragment')showFragment(); else if(action==='write'&&window.innerWidth>680)EDITOR.focus();
  if('serviceWorker' in navigator&&['http:','https:'].includes(location.protocol)){
    navigator.serviceWorker.addEventListener('controllerchange',()=>{if(deliberateUpdate)window.location.reload();});
    navigator.serviceWorker.register('./sw.js').then(reg=>{pwaRegistration=reg;observeWorkerUpdates(reg);})
      .catch(err=>console.warn('Service worker unavailable',err));
  }
  if(!action&&window.innerWidth>680){EDITOR.focus({preventScroll:true});}
}
boot();
