'use strict';

const SAVE_KEY='winterRegistrySave_v062';
const TUTORIAL_KEY='winterRegistryTutorial_v062';
const GAME_DAYS=14;
const $=s=>document.querySelector(s); const $$=s=>[...document.querySelectorAll(s)];
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n)); const pad=n=>String(n).padStart(2,'0');
const fmtTime=m=>`${pad(Math.floor(m/60)%24)}:${pad(Math.round(m)%60)}`;

const NAMES=['Aleksandr Petrov','Irina Petrova','Mikhail Antonov','Svetlana Orlova','Yuri Morozov','Nadezhda Volkova','Viktor Sokolov','Elena Sokolova','Pavel Lebedev','Galina Lebedeva','Boris Kuznetsov','Tatiana Kuznetsova','Nikolai Fedorov','Anya Fedorova','Sergei Popov','Lidia Popova','Grigori Smirnov','Vera Smirnova','Oleg Makarov','Raisa Makarova','Lev Zakharov','Zoya Zakharova','Andrei Pavlov','Marina Pavlova','Konstantin Belov','Larisa Belova','Dmitri Voronin','Katya Voronina','Roman Gusev','Maya Guseva'];
const JOBS=['Carpenter','Nurse','Heating engineer','Teacher','Warehouse labourer','Retired machinist','Mechanic','Clerk','Doctor','Agricultural worker','Electrician','Cook','Watchman','Seamstress','Sanitation worker','Driver','Midwife','Boiler operator','Radio technician','Archivist','Mason','Student','Rail worker','Chemist'];
const ESSENTIAL=new Set(['Nurse','Heating engineer','Warehouse labourer','Mechanic','Doctor','Agricultural worker','Electrician','Cook','Boiler operator','Chemist']);
const MUTATIONS=[
{name:'Dermal Keratinisation',desc:'Skin hardens into plates. Cold resistance improves; manual dexterity collapses.',food:1,heat:.45,aura:2},
{name:'Hypermetabolic Growth',desc:'Muscle and connective tissue thicken rapidly. Labour capacity rises; caloric demand becomes extreme.',food:1.75,heat:.8,aura:2},
{name:'Fused Mandible',desc:'The jaw calcifies shut. Food requirements fall, but ordinary treatment becomes difficult.',food:.35,heat:1,aura:4},
{name:'Auditory Mimicry',desc:'The resident repeats conversations they could not have heard. Others avoid them.',food:1,heat:1,aura:6}
];
const MAP=[
'1111111111111111','1000000000000001','1033300002222001','1030300002022001','1033300002222001','1000000000000001','1001110003330001','1001010003030001','1001110003330001','1000000000000001','1022200444000001','1020200404000001','1022200444003301','1000000000003031','1000000000003301','1111111111111111'].map(r=>r.split('').map(Number));
const SITES=[
{id:'hall',name:'Town Hall',x:3.5,y:3.5,kind:'hall',desc:'The municipal offices. The stove still works. The files do not agree with one another.',accent:'#b9ad83'},
{id:'warehouse',name:'Warehouse 3',x:10.5,y:3.5,kind:'loot',desc:'Corrugated storage, padlock broken, inventory board blank.',accent:'#9a8468'},
{id:'clinic',name:'District Clinic',x:4.5,y:7.5,kind:'clinic',desc:'A concrete clinic with cracked windows and treatment cards stacked by the stove.',accent:'#94aba4'},
{id:'apartments',name:'Eastern Block',x:10.5,y:7.5,kind:'people',desc:'Six households share a stairwell, one stove and several mutually incompatible stories.',accent:'#9a8c80'},
{id:'workshop',name:'Machine Workshop',x:3.5,y:11.5,kind:'loot',desc:'Frozen tools, a stripped generator and enough sharp metal to make mistakes permanent.',accent:'#9d8064'},
{id:'fuel',name:'Fuel Depot',x:8.5,y:11.5,kind:'loot',desc:'Coal dust and diesel. The fence was opened from the inside.',accent:'#a79569'},
{id:'chapel',name:'Old Chapel',x:13.5,y:13.5,kind:'people',desc:'Candles burn despite the ration order. Snow blows through the roof.',accent:'#a79e7c'}
];
const NPC_POINTS=[{x:6.5,y:4.8},{x:12.1,y:6.0},{x:6.2,y:10.3},{x:11.7,y:12.8},{x:8.2,y:8.4}];

let state=null,rng=Math.random;
let canvas,ctx,mapCanvas,mapCtx,dpr=1,w=1,h=1;
let keys={},touch={forward:false,back:false,left:false,right:false,lookL:false,lookR:false};
let lastT=0,dragging=false,lastPointerX=0,animId=0;
let deferredInstallPrompt=null,nearSite=null;
let tutorial={active:false,step:0};
let flashTimer=0;

function hashSeed(s){let h=2166136261>>>0;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
function mulberry32(a){return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function rand(){return rng()} function randInt(a,b){return Math.floor(rand()*(b-a+1))+a} function choice(a){return a[Math.floor(rand()*a.length)]}
function makeSeed(){const c='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';let s='WINTER-';for(let i=0;i<6;i++)s+=c[Math.floor(Math.random()*c.length)];return s}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}

function makeState(){const seed=makeSeed();rng=mulberry32(hashSeed(seed));const people=NAMES.map((name,i)=>{const age=i<4?randInt(8,16):(i>25?randInt(63,79):randInt(19,62));const job=i<4?'Student':choice(JOBS);return{id:i+1,name,age,job,alive:true,cohort:age<18?'children':age>=65?'elderly':ESSENTIAL.has(job)?'essential':'general',health:randInt(62,96),hunger:randInt(45,78),warmth:randInt(48,82),rad:+(rand()*1.7).toFixed(2),dissent:randInt(5,28),assessed:i<2,mutation:null,ration:{food:1,heat:1,med:false},district:i%3===0?'Eastern Block':i%3===1?'Central District':'Industrial Fringe',history:[],causeOfDeath:null,dayOfDeath:null}});return{version:62,seed,day:1,minutes:360,phase:'field',stock:{food:14,heat:12,med:4,scrap:0},player:{x:7.4,y:8.7,a:-Math.PI/2,bob:0,steps:0},people,policies:{children:{food:100,heat:100},essential:{food:100,heat:100},general:{food:75,heat:75},elderly:{food:75,heat:75}},fieldLog:[{time:360,text:'File opened. Thirty residents remain on the district register.'}],siteUses:{},stats:{deaths:0,mutations:0,daysSurvived:0},nightReports:[]}}
function restoreRng(){rng=mulberry32(hashSeed(state.seed));const burn=(state.day*97+state.minutes+state.stats.deaths*13+state.stats.mutations*17)%700;for(let i=0;i<burn;i++)rng()}
function alive(){return state.people.filter(p=>p.alive)}
function cohortLabel(c){return({children:'Children',essential:'Essential workers',general:'General adults',elderly:'Elderly'})[c]}

function save(show=true){if(!state)return;localStorage.setItem(SAVE_KEY,JSON.stringify(state));if(show)toast('File saved');updateContinue()}
function load(){try{const raw=localStorage.getItem(SAVE_KEY);if(!raw)return false;state=JSON.parse(raw);if(state.version!==62)return false;restoreRng();startGameUI();return true}catch(e){console.error(e);return false}}
function updateContinue(){$('#continueBtn').disabled=!localStorage.getItem(SAVE_KEY)}
function logField(text){state.fieldLog.unshift({time:state.minutes,text});state.fieldLog=state.fieldLog.slice(0,30);renderLog()}
function addTime(m,text){state.minutes=clamp(state.minutes+m,360,1080);if(text)logField(text);if(state.minutes>=1080&&state.phase==='field')openLedger();refreshHUD()}

function startNew(){state=makeState();startGameUI();save(false);feedback('Administration opened','WASD to move · Q/E to turn · F to interact. Help (?) opens the tutorial.','good')}
function startGameUI(){$('#titleScreen').classList.remove('active');$('#gameScreen').classList.add('active');const target=state&&state.phase==='ledger'?'ledger':'field';setPhase(target);refreshAll();if(target==='field')focusField();requestFrame()}
function clearMovementState(){keys={};for(const k of Object.keys(touch))touch[k]=false;dragging=false}function fieldUiBlocked(){const m=$('#modalLayer'),t=$('#tutorialLayer'),n=$('#nightCurtain');return(m&&!m.classList.contains('hidden'))||(t&&!t.classList.contains('hidden'))||(n&&!n.classList.contains('hidden'))}function focusField(){if(!canvas)return;requestAnimationFrame(()=>{resize();try{canvas.focus({preventScroll:true})}catch(e){try{canvas.focus()}catch(_){}}})}function setPhase(p){clearMovementState();state.phase=p;const field=$('#fieldView'),ledger=$('#ledgerView');field.classList.toggle('active',p==='field');ledger.classList.toggle('active',p==='ledger');field.style.display=p==='field'?'flex':'none';ledger.style.display=p==='ledger'?'flex':'none';$('#phaseLabel').textContent=p==='field'?'FIELD':'TRIAGE';if(p==='field')focusField()}
function refreshAll(){refreshHUD();renderLog();renderPolicies();renderLedger()}
function refreshHUD(){if(!state)return;$('#dayLabel').textContent=pad(state.day);$('#timeLabel').textContent=fmtTime(state.minutes);$('#aliveLabel').textContent=alive().length;['food','heat','med'].forEach(k=>{const v=state.stock[k].toFixed(1);const id=k==='food'?'Food':k==='heat'?'Heat':'Med';$(`#${k}Stock`).textContent=v;$(`#bag${id}`).textContent=v});$('#scrapStock').textContent=state.stock.scrap.toFixed(0);$('#ledgerFood').textContent=`${state.stock.food.toFixed(1)} F`;$('#ledgerHeat').textContent=`${state.stock.heat.toFixed(1)} H`;$('#ledgerMed').textContent=`${state.stock.med.toFixed(1)} M`;updateObjective()}
function renderLog(){$('#fieldLog').innerHTML=state?state.fieldLog.map(x=>`<p><time>${fmtTime(x.time)}</time>${escapeHtml(x.text)}</p>`).join(''):''}
function updateObjective(){if(!state)return;let t='Scavenge before dusk',b='Move through the district. Marked locations become interactable when you are close and facing them.';if(state.minutes>900){t='The light is failing';b='You have little field time left. Return to Town Hall or finish one last task.'}if(state.minutes>=1080){t='Field operations ended';b='The ledger must now be sealed.'}$('#objectiveTitle').textContent=t;$('#objectiveBody').textContent=b}

function isWall(x,y){const xi=Math.floor(x),yi=Math.floor(y);if(xi<0||yi<0||yi>=MAP.length||xi>=MAP[0].length)return 1;return MAP[yi][xi]}
function canMove(x,y){const r=.22;return !isWall(x-r,y-r)&&!isWall(x+r,y-r)&&!isWall(x-r,y+r)&&!isWall(x+r,y+r)}
const BUILDINGS=[
{id:'hall',x0:2,x1:4,y0:2,y1:4,height:1.22,floors:2,material:'stucco',base:[111,118,105],trim:[69,73,65],roof:'flat',window:[35,48,49],doorCells:['3,4'],sign:'РАЙСОВЕТ'},
{id:'warehouse',x0:9,x1:12,y0:2,y1:4,height:.83,floors:1,material:'corrugated',base:[92,82,70],trim:[48,45,39],roof:'metal',window:[29,35,35],doorCells:['10,4','11,4'],sign:'СКЛАД №3'},
{id:'clinic',x0:3,x1:5,y0:6,y1:8,height:1.06,floors:2,material:'concrete',base:[126,139,132],trim:[72,84,80],roof:'flat',window:[46,69,68],doorCells:['4,8'],sign:'МЕДПУНКТ'},
{id:'apartments',x0:9,x1:11,y0:6,y1:8,height:1.55,floors:3,material:'panel',base:[112,108,101],trim:[65,62,58],roof:'flat',window:[40,44,43],doorCells:['10,8'],sign:'БЛОК 4'},
{id:'workshop',x0:2,x1:4,y0:10,y1:12,height:.96,floors:1,material:'brick',base:[119,76,56],trim:[59,48,41],roof:'industrial',window:[31,39,39],doorCells:['3,10'],sign:'МАСТЕРСКАЯ'},
{id:'fuel',x0:7,x1:9,y0:10,y1:12,height:.72,floors:1,material:'corrugated',base:[105,91,62],trim:[49,45,34],roof:'metal',window:[36,38,33],doorCells:['8,10'],sign:'ТОПЛИВО'},
{id:'chapel',x0:12,x1:14,y0:12,y1:14,height:1.18,floors:1,material:'timber',base:[82,65,49],trim:[45,37,30],roof:'eave',window:[68,74,65],doorCells:['13,12'],sign:'ЧАСОВНЯ'}
];
const PROPS=[
{type:'lamp',x:7.4,y:5.65},{type:'lamp',x:7.6,y:9.85},{type:'lamp',x:5.7,y:5.05},{type:'lamp',x:10.5,y:9.15},
{type:'tree',x:1.45,y:2.2},{type:'tree',x:1.3,y:7.2},{type:'tree',x:14.45,y:3.0},{type:'tree',x:14.5,y:8.0},{type:'tree',x:2.0,y:14.45},{type:'tree',x:6.0,y:14.5},{type:'tree',x:10.8,y:14.45},{type:'tree',x:14.4,y:12.0},
{type:'barrels',x:11.9,y:5.2},{type:'barrels',x:8.3,y:9.55},{type:'car',x:7.5,y:14.18},{type:'fence',x:9.8,y:10.0},
{type:'roadsign',x:6.1,y:5.0,label:'ЦЕНТР'},{type:'roadsign',x:8.9,y:9.25,label:'СКЛАД'}
];
const ROAD_RECTS=[
[6.15,8.85,1.0,14.75],
[1.0,15.0,4.55,5.65],
[1.0,15.0,8.75,9.85],
[1.0,12.25,12.48,13.4],
[11.35,12.25,9.7,14.3]
];
const PATH_RECTS=[
[4.0,6.2,3.15,3.85],[8.8,9.55,3.3,4.1],[5.0,6.2,7.15,7.95],[8.75,9.35,7.15,7.95],
[4.0,6.2,10.45,11.2],[8.2,8.8,9.75,10.65],[12.0,13.2,11.8,12.45]
];
function inRects(x,y,rects){for(const r of rects)if(x>=r[0]&&x<=r[1]&&y>=r[2]&&y<=r[3])return true;return false}
function buildingAtCell(x,y,wall){for(const b of BUILDINGS)if(x>=b.x0&&x<=b.x1&&y>=b.y0&&y<=b.y1)return b;return{id:'edge',x0:0,x1:15,y0:0,y1:15,height:.22,floors:1,material:'snowbank',base:[163,165,155],trim:[70,73,67],roof:'snow',window:[25,29,27],doorCells:[],sign:''}}
function canMove(x,y){const r=.22;const blocked=(px,py)=>{const xi=Math.floor(px),yi=Math.floor(py);if(yi===15&&(xi===7||xi===8))return false;return !!isWall(px,py)};if(blocked(x-r,y-r)||blocked(x+r,y-r)||blocked(x-r,y+r)||blocked(x+r,y+r))return false;const cx=7.5,cy=14.18;const ex=(x-cx)/.82,ey=(y-cy)/.52;if(ex*ex+ey*ey<1)return false;return true}
function resize(){if(!canvas)return;const r=canvas.getBoundingClientRect();const ratio=r.height/Math.max(1,r.width);w=Math.round(clamp(r.width*.58,280,426));h=Math.round(clamp(w*ratio,170,320));canvas.width=w;canvas.height=h;ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;canvas.style.imageRendering='pixelated'}
function requestFrame(){cancelAnimationFrame(animId);lastT=performance.now();animId=requestAnimationFrame(frame)}
function frame(t){const dt=Math.min(.04,(t-lastT)/1000||.016);lastT=t;try{if(state&&state.phase==='field'){updateMovement(dt);try{renderWorld(t);renderMiniMap();frame._renderFault=false}catch(err){if(!frame._renderFault){console.error('Winter Registry render fault',err);frame._renderFault=true}}}}finally{animId=requestAnimationFrame(frame)}}
function updateMovement(dt){if(!state||state.phase!=='field'||fieldUiBlocked())return;let f=0,st=0,turn=0;if(keys.KeyW||keys.ArrowUp||touch.forward)f+=1;if(keys.KeyS||keys.ArrowDown||touch.back)f-=1;if(keys.KeyA||touch.left)st-=1;if(keys.KeyD||touch.right)st+=1;if(keys.KeyQ||touch.lookL)turn-=1;if(keys.KeyE||touch.lookR)turn+=1;state.player.a+=turn*1.75*dt;if(f||st){const mag=Math.max(1,Math.hypot(f,st)),sp=1.72*dt;const dx=(Math.cos(state.player.a)*(f/mag)+Math.cos(state.player.a+Math.PI/2)*(st/mag))*sp,dy=(Math.sin(state.player.a)*(f/mag)+Math.sin(state.player.a+Math.PI/2)*(st/mag))*sp,nx=state.player.x+dx,ny=state.player.y+dy;if(canMove(nx,state.player.y))state.player.x=nx;if(canMove(state.player.x,ny))state.player.y=ny;state.player.steps+=Math.hypot(dx,dy);state.player.bob+=dt*7.4}nearSite=findNearSite();updateInteractionHint()}
function findNearSite(){let best=null,bd=1.58;for(const s of SITES){const dx=s.x-state.player.x,dy=s.y-state.player.y,d=Math.hypot(dx,dy);if(d<bd){let da=Math.atan2(dy,dx)-state.player.a;da=Math.atan2(Math.sin(da),Math.cos(da));if(Math.abs(da)<1.0){best=s;bd=d}}}return best}
function updateInteractionHint(){const el=$('#interactionHint');if(nearSite){el.classList.remove('hidden');$('#interactionText').textContent=`Inspect ${nearSite.name}`;$('#interactionSub').textContent=nearSite.kind==='hall'?'Municipal office · ledger and records':nearSite.kind==='clinic'?'Clinic · medicine and treatment cards':nearSite.kind==='people'?'Occupied building · households and living conditions':'Utility building · supplies and salvage'}else el.classList.add('hidden')}
