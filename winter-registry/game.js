(() => {
  'use strict';

  const SAVE_KEY = 'winterRegistrySave_v01';
  const GAME_DAYS = 14;
  const TILE_W = 86;
  const TILE_H = 43;
  const MAP_W = 10;
  const MAP_H = 10;

  const $ = sel => document.querySelector(sel);
  const $$ = sel => [...document.querySelectorAll(sel)];
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  const pad = n => String(n).padStart(2, '0');

  const NAMES = [
    'Aleksandr Petrov','Irina Petrova','Mikhail Antonov','Svetlana Orlova','Yuri Morozov','Nadezhda Volkova',
    'Viktor Sokolov','Elena Sokolova','Pavel Lebedev','Galina Lebedeva','Boris Kuznetsov','Tatiana Kuznetsova',
    'Nikolai Fedorov','Anya Fedorova','Sergei Popov','Lidia Popova','Grigori Smirnov','Vera Smirnova',
    'Oleg Makarov','Raisa Makarova','Lev Zakharov','Zoya Zakharova','Andrei Pavlov','Marina Pavlova',
    'Konstantin Belov','Larisa Belova','Dmitri Voronin','Katya Voronina','Roman Gusev','Maya Guseva'
  ];
  const JOBS = [
    'Carpenter','Nurse','Heating engineer','Teacher','Warehouse labourer','Retired machinist','Mechanic','Clerk',
    'Doctor','Agricultural worker','Electrician','Cook','Watchman','Seamstress','Sanitation worker','Driver',
    'Midwife','Boiler operator','Radio technician','Archivist','Mason','Student','Rail worker','Chemist'
  ];
  const ESSENTIAL_JOBS = new Set(['Nurse','Heating engineer','Warehouse labourer','Mechanic','Doctor','Agricultural worker','Electrician','Cook','Boiler operator','Chemist']);
  const MUTATIONS = [
    { name:'Dermal Keratinisation', desc:'Skin hardens into plates. Cold resistance improves; manual dexterity collapses.', foodMod:1, heatMod:.45, dissentAura:2 },
    { name:'Hypermetabolic Growth', desc:'Muscle and connective tissue thicken rapidly. Labour capacity rises; caloric demand becomes extreme.', foodMod:1.75, heatMod:.8, dissentAura:2 },
    { name:'Fused Mandible', desc:'The jaw calcifies shut. Food requirements fall, but medicine no longer helps normally.', foodMod:.35, heatMod:1, dissentAura:4 },
    { name:'Auditory Mimicry', desc:'The resident repeats conversations they could not have heard. Others avoid them.', foodMod:1, heatMod:1, dissentAura:6 }
  ];

  const SITES = [
    { id:'hall', name:'Town Hall', x:4, y:5, color:'#5f6b61', kind:'hall', desc:'The municipal offices. A stove, ledgers, and too many names.' },
    { id:'warehouse', name:'Warehouse 3', x:2, y:2, color:'#565a50', kind:'loot', desc:'A corrugated storehouse. Inventory records say it is empty.' },
    { id:'clinic', name:'District Clinic', x:7, y:2, color:'#68746a', kind:'clinic', desc:'Two treatment rooms, cracked windows, iodine in the walls.' },
    { id:'apartments', name:'Eastern Block', x:7, y:6, color:'#4a524c', kind:'people', desc:'Six households share a failing stairwell and one iron stove.' },
    { id:'workshop', name:'Machine Workshop', x:2, y:6, color:'#5a574e', kind:'loot', desc:'Frozen tools, a disassembled generator, traces of recent use.' },
    { id:'fuel', name:'Fuel Depot', x:5, y:1, color:'#595348', kind:'loot', desc:'Coal dust. Diesel. A padlock cut from the inside.' },
    { id:'chapel', name:'Old Chapel', x:8, y:8, color:'#4a4b43', kind:'people', desc:'The roof leaks snow. Candles burn despite the ration order.' },
    { id:'ruin', name:'Ruined House', x:1, y:8, color:'#454943', kind:'loot', desc:'Half the roof is gone. The cellar door is still intact.' },
    { id:'lada', name:'Abandoned Lada', x:5, y:8, color:'#59605b', kind:'loot', desc:'A rusted sedan with the bonnet frozen shut.' }
  ];

  let state = null;
  let rng = null;
  let deferredInstallPrompt = null;
  let audio = { ctx:null, nodes:[], enabled:false };
  let canvas, ctx, dpr = 1, originX = 0, originY = 0;

  function hashSeed(text) {
    let h = 2166136261 >>> 0;
    for (let i=0;i<text.length;i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function() {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function rand() { return rng(); }
  function randInt(min,max) { return Math.floor(rand()*(max-min+1))+min; }
  function choice(arr) { return arr[Math.floor(rand()*arr.length)]; }

  function makeSeed() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let s = 'WINTER-';
    for (let i=0;i<6;i++) s += chars[Math.floor(Math.random()*chars.length)];
    return s;
  }

  function newState() {
    const seed = makeSeed();
    rng = mulberry32(hashSeed(seed));
    const people = NAMES.map((name,i) => {
      const age = i < 4 ? randInt(8,16) : (i > 25 ? randInt(63,79) : randInt(19,62));
      const job = i < 4 ? 'Student' : choice(JOBS);
      const health = randInt(63,96);
      const hunger = randInt(44,78);
      const warmth = randInt(48,82);
      const rad = +(rand()*1.7).toFixed(2);
      const dissent = randInt(5,28);
      return {
        id:i+1, name, age, job, alive:true,
        cohort: age < 18 ? 'children' : age >= 65 ? 'elderly' : ESSENTIAL_JOBS.has(job) ? 'essential' : 'general',
        health, hunger, warmth, rad, dissent,
        assessed: i < 2,
        mutation:null,
        ration:{food:1, heat:1, med:false},
        history:[],
        district: i % 3 === 0 ? 'Eastern Block' : i % 3 === 1 ? 'Central District' : 'Industrial Fringe',
        causeOfDeath:null,
        dayOfDeath:null
      };
    });
    const s = {
      version:1, seed, day:1, minutes:360, phase:'field',
      stock:{food:14, heat:12, med:4, scrap:0},
      player:{x:4,y:5},
      people,
      policies:{
        children:{food:100,heat:100}, essential:{food:100,heat:100}, general:{food:75,heat:75}, elderly:{food:75,heat:75}
      },
      fieldLog:[{time:360,text:'File opened. Thirty residents remain on the district register.'}],
      siteUses:{},
      stats:{deaths:0,mutations:0,daysSurvived:0},
      nightReports:[]
    };
    return s;
  }

  function restoreRng() {
    rng = mulberry32(hashSeed(state.seed));
    const burn = (state.day * 97 + state.minutes + state.stats.deaths*13 + state.stats.mutations*17) % 800;
    for(let i=0;i<burn;i++) rng();
  }

  function saveGame(showToast=true) {
    if (!state) return;
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    if (showToast) toast('File committed to local archive');
    updateContinueButton();
  }
  function loadGame() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      state = JSON.parse(raw);
      restoreRng();
      startGameUI();
      return true;
    } catch (e) {
      console.error(e); return false;
    }
  }
  function updateContinueButton() { $('#continueBtn').disabled = !localStorage.getItem(SAVE_KEY); }

  function formatTime(mins) { return `${pad(Math.floor(mins/60)%24)}:${pad(mins%60)}`; }
  function addTime(minutes, reason) {
    state.minutes += minutes;
    logField(reason);
    if (state.minutes >= 1080) {
      state.minutes = 1080;
      openLedger();
    }
    refreshHUD();
  }
  function logField(text) {
    state.fieldLog.unshift({time:state.minutes,text});
    state.fieldLog = state.fieldLog.slice(0,24);
    renderFieldLog();
  }

  function alivePeople() { return state.people.filter(p=>p.alive); }
  function cohortLabel(c) { return ({children:'Children',essential:'Essential Workers',general:'General Adults',elderly:'Elderly'})[c]; }
  function conditionLabel(p) {
    if (!p.alive) return `Dead · ${p.causeOfDeath}`;
    if (!p.assessed) {
      if (p.health < 35) return 'Visibly poor';
      if (p.health < 60) return 'Uncertain';
      return 'Appears stable';
    }
    if (p.health < 25) return 'Critical';
    if (p.health < 50) return 'Poor';
    if (p.health < 75) return 'Strained';
    return 'Stable';
  }

  function startNewGame() {
    state = newState();
    startGameUI();
    saveGame(false);
    startAmbience();
  }
  function startGameUI() {
    $('#titleScreen').classList.remove('active');
    $('#gameScreen').classList.add('active');
    refreshAll();
    resizeCanvas();
  }
  function refreshAll() {
    refreshHUD(); renderFieldLog(); renderWorld(); renderPolicies(); renderLedger();
  }
  function refreshHUD() {
    if (!state) return;
    $('#dayLabel').textContent = pad(state.day);
    $('#timeLabel').textContent = formatTime(state.minutes);
    $('#aliveLabel').textContent = alivePeople().length;
    $('#seedLabel').textContent = state.seed.replace('WINTER-','');
    $('#foodStock').textContent = state.stock.food.toFixed(1);
    $('#heatStock').textContent = state.stock.heat.toFixed(1);
    $('#medStock').textContent = state.stock.med.toFixed(1);
    $('#scrapStock').textContent = state.stock.scrap.toFixed(0);
    $('#ledgerFood').textContent = state.stock.food.toFixed(1);
    $('#ledgerHeat').textContent = state.stock.heat.toFixed(1);
    $('#ledgerMed').textContent = state.stock.med.toFixed(1);
    $('#phaseLabel').textContent = state.phase === 'field' ? 'FIELD PHASE' : 'TRIAGE PHASE';
  }
  function renderFieldLog() {
    if (!state) return;
    $('#fieldLog').innerHTML = state.fieldLog.map(x => `<p><time>${formatTime(x.time)}</time>${escapeHtml(x.text)}</p>`).join('');
  }
  function escapeHtml(s) { return String(s).replace(/[&<>'\"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'\"':'&quot;'}[c])); }

  function isoToScreen(x,y,z=0) {
    return { x: originX + (x-y)*TILE_W/2, y: originY + (x+y)*TILE_H/2 - z };
  }
  function screenToIso(px,py) {
    const x2 = px-originX, y2=py-originY;
    const gx = (x2/(TILE_W/2) + y2/(TILE_H/2))/2;
    const gy = (y2/(TILE_H/2) - x2/(TILE_W/2))/2;
    return {x:Math.floor(gx+0.5), y:Math.floor(gy+0.5)};
  }
  function resizeCanvas() {
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.floor(rect.width*dpr));
    canvas.height = Math.max(1, Math.floor(rect.height*dpr));
    ctx.setTransform(dpr,0,0,dpr,0,0);
    originX = rect.width/2;
    originY = Math.max(74, rect.height*0.12);
    renderWorld();
  }
  function drawDiamond(x,y,fill,stroke='#2a332d') {
    const p=isoToScreen(x,y); ctx.beginPath();
    ctx.moveTo(p.x,p.y); ctx.lineTo(p.x+TILE_W/2,p.y+TILE_H/2); ctx.lineTo(p.x,p.y+TILE_H); ctx.lineTo(p.x-TILE_W/2,p.y+TILE_H/2); ctx.closePath();
    ctx.fillStyle=fill; ctx.fill(); ctx.strokeStyle=stroke; ctx.lineWidth=1; ctx.stroke();
  }
  function shade(hex, amt) {
    const c=hex.replace('#',''); const n=parseInt(c,16); let r=(n>>16)+amt,g=((n>>8)&255)+amt,b=(n&255)+amt;
    r=clamp(r,0,255);g=clamp(g,0,255);b=clamp(b,0,255); return `rgb(${r},${g},${b})`;
  }
  function drawBuilding(site) {
    const p=isoToScreen(site.x,site.y); const h= site.id==='hall'?52: site.id==='chapel'?45:38;
    const w=TILE_W*.68, d=TILE_H*.68;
    ctx.save();
    ctx.globalAlpha=.35; ctx.fillStyle='#000'; ctx.beginPath(); ctx.ellipse(p.x+8,p.y+TILE_H*.7,34,11,0,0,Math.PI*2); ctx.fill(); ctx.globalAlpha=1;
    ctx.beginPath(); ctx.moveTo(p.x,p.y+8); ctx.lineTo(p.x+w/2,p.y+d/2+8); ctx.lineTo(p.x+w/2,p.y+d/2+h); ctx.lineTo(p.x,p.y+h); ctx.closePath(); ctx.fillStyle=shade(site.color,-25); ctx.fill();
    ctx.beginPath(); ctx.moveTo(p.x,p.y+8); ctx.lineTo(p.x-w/2,p.y+d/2+8); ctx.lineTo(p.x-w/2,p.y+d/2+h); ctx.lineTo(p.x,p.y+h); ctx.closePath(); ctx.fillStyle=shade(site.color,-38); ctx.fill();
    ctx.beginPath(); ctx.moveTo(p.x,p.y-h*.18); ctx.lineTo(p.x+w/2,p.y+d/2+8); ctx.lineTo(p.x,p.y+d+8); ctx.lineTo(p.x-w/2,p.y+d/2+8); ctx.closePath(); ctx.fillStyle=site.color; ctx.fill(); ctx.strokeStyle='#879086';ctx.globalAlpha=.45;ctx.stroke();ctx.globalAlpha=1;
    ctx.strokeStyle='rgba(205,214,206,.45)'; ctx.lineWidth=3; ctx.beginPath(); ctx.moveTo(p.x-w*.28,p.y+d*.27);ctx.lineTo(p.x,p.y-h*.17);ctx.lineTo(p.x+w*.29,p.y+d*.28);ctx.stroke();
    ctx.fillStyle='#a48d59'; ctx.beginPath(); ctx.arc(p.x,p.y-h*.28,5,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#cbd2ca'; ctx.font='10px Courier New'; ctx.textAlign='center'; ctx.fillText(site.name.toUpperCase(),p.x,p.y+h+16);
    ctx.restore();
  }
  function drawPlayer() {
    const p=isoToScreen(state.player.x,state.player.y); ctx.save();
    ctx.fillStyle='#c6bfa3'; ctx.beginPath(); ctx.arc(p.x,p.y+8,5,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#747f74';ctx.fillRect(p.x-4,p.y+13,8,15);
    ctx.strokeStyle='#111';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(p.x-2,p.y+28);ctx.lineTo(p.x-6,p.y+36);ctx.moveTo(p.x+2,p.y+28);ctx.lineTo(p.x+6,p.y+36);ctx.stroke();
    ctx.restore();
  }
  function renderWorld() {
    if (!ctx || !state || state.phase!=='field') return;
    const rect=canvas.getBoundingClientRect(); ctx.clearRect(0,0,rect.width,rect.height);
    const g=ctx.createLinearGradient(0,0,0,rect.height);g.addColorStop(0,'#17211b');g.addColorStop(.6,'#0d130f');g.addColorStop(1,'#080b09');ctx.fillStyle=g;ctx.fillRect(0,0,rect.width,rect.height);
    ctx.fillStyle='rgba(121,142,132,.04)';ctx.fillRect(0,rect.height*.22,rect.width,2);ctx.fillRect(0,rect.height*.43,rect.width,1);
    for(let sum=0;sum<MAP_W+MAP_H-1;sum++) {
      for(let x=0;x<MAP_W;x++) { const y=sum-x; if(y<0||y>=MAP_H) continue; const tone=((x+y)%2)?'#1a241e':'#18211c'; drawDiamond(x,y,tone); }
      SITES.filter(s=>s.x+s.y===sum).forEach(drawBuilding);
      if(state.player.x+state.player.y===sum) drawPlayer();
    }
    ctx.fillStyle='rgba(215,222,216,.18)';
    for(let i=0;i<70;i++){const xx=(i*73)%Math.max(1,rect.width);const yy=(i*41 + state.day*7)%Math.max(1,rect.height);ctx.fillRect(xx,yy,1,1);}
  }

  function siteAtGrid(x,y) { return SITES.find(s=>s.x===x&&s.y===y); }
  function onWorldPointer(ev) {
    if (!state || state.phase!=='field') return;
    const r=canvas.getBoundingClientRect(); const pos=screenToIso(ev.clientX-r.left,ev.clientY-r.top);
    const site=siteAtGrid(pos.x,pos.y);
    if (site) inspectSite(site);
  }
  function travelCost(site) {
    const dist=Math.abs(site.x-state.player.x)+Math.abs(site.y-state.player.y); return Math.max(10,dist*12);
  }
  function inspectSite(site) {
    const cost=travelCost(site);
    state.player={x:site.x,y:site.y};
    state.minutes=clamp(state.minutes+cost,360,1080);
    logField(`Reached ${site.name} · ${cost} min transit.`);
    renderWorld(); refreshHUD();
    if (site.id==='hall') { openSiteModal(site, []); return; }
    const uses=state.siteUses[site.id]||0;
    const actions=[];
    if(site.kind==='loot') {
      actions.push({label:'Search thoroughly',detail:'45 min · supplies',run:()=>scavenge(site,45,'search')});
      actions.push({label:'Dismantle usable material',detail:'90 min · heat/scrap',run:()=>scavenge(site,90,'dismantle')});
    }
    if(site.kind==='clinic') {
      actions.push({label:'Search pharmacy cabinets',detail:'60 min · medicine',run:()=>scavenge(site,60,'clinic')});
      actions.push({label:'Review treatment cards',detail:'35 min · assess residents',run:()=>assessResidents(3,35,site.name)});
    }
    if(site.kind==='people') {
      actions.push({label:'Interview a household',detail:'35 min · assess a resident',run:()=>assessResidents(1,35,site.name)});
      actions.push({label:'Inspect rooms and stove',detail:'50 min · intelligence/supplies',run:()=>scavenge(site,50,'people')});
    }
    if(uses>2) actions.forEach(a=>a.detail += ' · depleted');
    openSiteModal(site,actions);
  }
  function openSiteModal(site,actions) {
    const body = `<div class="meta">${escapeHtml(site.kind)} · day ${state.day} · ${formatTime(state.minutes)}</div>
      <h2>${escapeHtml(site.name)}</h2><p>${escapeHtml(site.desc)}</p>
      ${actions.length?`<div class="action-list">${actions.map((a,i)=>`<button data-action="${i}"><span>${escapeHtml(a.label)}</span><span>${escapeHtml(a.detail)}</span></button>`).join('')}</div>`:'<p>This is where the day is converted into policy. Return here at any time to open the ledger.</p>'}
      ${site.id==='hall'?'<button id="modalLedgerBtn" class="primary wide">Open Population Ledger</button>':''}
      <button class="modal-close">Leave</button>`;
    showModal(body);
    actions.forEach((a,i)=> { const b=$(`[data-action="${i}"]`); if(b) b.onclick=()=>{ hideModal(); a.run(); }; });
    const ml=$('#modalLedgerBtn'); if(ml) ml.onclick=()=>{hideModal();openLedger();};
    $('.modal-close').onclick=hideModal;
  }
  function scavenge(site,minutes,type) {
    const uses=(state.siteUses[site.id]||0); state.siteUses[site.id]=uses+1;
    const depletion=Math.max(.25,1-uses*.22);
    let food=0,heat=0,med=0,scrap=0;
    if(type==='search'){ food=+(randInt(1,5)*depletion).toFixed(1); heat=+(randInt(0,3)*depletion).toFixed(1); scrap=randInt(0,2); }
    if(type==='dismantle'){ heat=+(randInt(2,6)*depletion).toFixed(1); scrap=randInt(2,5); }
    if(type==='clinic'){ med=+(randInt(1,4)*depletion).toFixed(1); food=rand()<.25?1:0; }
    if(type==='people'){ food=+(randInt(0,3)*depletion).toFixed(1); heat=+(randInt(0,2)*depletion).toFixed(1); if(rand()<.35) assessResidents(1,0,site.name,false); }
    state.stock.food+=food;state.stock.heat+=heat;state.stock.med+=med;state.stock.scrap+=scrap;
    addTime(minutes,`${site.name}: recovered ${food} nutrition, ${heat} heat, ${med} medicine, ${scrap} scrap.`);
    refreshHUD(); saveGame(false);
  }
  function assessResidents(count,minutes,source,log=true) {
    const unknown=alivePeople().filter(p=>!p.assessed);
    const picked=[];
    for(let i=0;i<count&&unknown.length;i++){ const idx=Math.floor(rand()*unknown.length); const p=unknown.splice(idx,1)[0]; p.assessed=true; picked.push(p); }
    if(minutes) addTime(minutes,`${source}: ${picked.map(p=>p.name).join(', ')||'no new residents'} assessed.`);
    else if(log && picked.length) logField(`${source}: ${picked.map(p=>p.name).join(', ')} assessed.`);
    if(picked.length) toast(`Assessment updated: ${picked.map(p=>p.name.split(' ')[0]).join(', ')}`);
    saveGame(false);
  }

  function openLedger() {
    state.phase='ledger';
    $('#fieldView').classList.remove('active'); $('#ledgerView').classList.add('active');
    refreshHUD(); renderPolicies(); applyPolicyDefaults(); renderLedger(); saveGame(false);
  }
  function closeLedger() {
    if(state.minutes>=1080){ toast('Field operations have ended for the day'); return; }
    state.phase='field'; $('#ledgerView').classList.remove('active');$('#fieldView').classList.add('active'); refreshHUD(); resizeCanvas();
  }
  function renderPolicies() {
    if(!state) return;
    const groups=['children','essential','general','elderly'];
    $('#policyGrid').innerHTML=groups.map(g=>{
      const count=alivePeople().filter(p=>p.cohort===g).length;
      const pol=state.policies[g];
      return `<section class="policy-card" data-cohort="${g}"><header>${cohortLabel(g)} <span>${count} alive</span></header>
        <label class="policy-line"><span>Food</span><input data-pol="food" type="range" min="0" max="125" step="25" value="${pol.food}"><output>${pol.food}%</output></label>
        <label class="policy-line"><span>Heat</span><input data-pol="heat" type="range" min="0" max="125" step="25" value="${pol.heat}"><output>${pol.heat}%</output></label>
      </section>`;
    }).join('');
    $$('.policy-card input').forEach(inp=> inp.oninput=()=>{
      const card=inp.closest('.policy-card'), cohort=card.dataset.cohort, key=inp.dataset.pol;
      state.policies[cohort][key]=Number(inp.value); inp.nextElementSibling.textContent=`${inp.value}%`;
      applyPolicyDefaults(); renderLedger();
    });
  }
  function applyPolicyDefaults() {
    alivePeople().forEach(p=>{
      const pol=state.policies[p.cohort];
      if(!p.ration.manualFood) p.ration.food=pol.food/100;
      if(!p.ration.manualHeat) p.ration.heat=pol.heat/100;
    });
  }
  function requestedTotals() {
    const a=alivePeople();
    return {
      food:a.reduce((s,p)=>s+p.ration.food*(p.mutation?MUTATIONS.find(m=>m.name===p.mutation)?.foodMod||1:1),0),
      heat:a.reduce((s,p)=>s+p.ration.heat*(p.mutation?MUTATIONS.find(m=>m.name===p.mutation)?.heatMod||1:1),0),
      med:a.reduce((s,p)=>s+(p.ration.med?1:0),0)
    };
  }
  function renderLedger() {
    if(!state) return;
    const search=($('#residentSearch')?.value||'').toLowerCase(); const filter=$('#residentFilter')?.value||'all';
    const rows=state.people.filter(p=>{
      if(search && !(p.name+' '+p.job).toLowerCase().includes(search)) return false;
      if(filter==='critical' && !(p.alive&&p.health<40)) return false;
      if(filter==='dissent' && !(p.alive&&p.dissent>=60)) return false;
      if(filter==='known' && !p.assessed) return false;
      if(filter==='mutated' && !p.mutation) return false;
      return true;
    });
    $('#residentRows').innerHTML=rows.map(p=>{
      const exact=p.assessed||!p.alive;
      const condWidth=clamp(p.health,0,100); const condClass=p.health<40?'bad':'';
      const dissent=exact?`${Math.round(p.dissent)}%`:(p.dissent>65?'High?':p.dissent>35?'Unclear':'Low?');
      return `<tr data-id="${p.id}" class="${!p.alive?'dead':''} ${p.dissent>70?'high-dissent':''}">
        <td><b>${escapeHtml(p.name)}</b>${p.assessed?'<br><small>ASSESSED</small>':''}</td><td>${escapeHtml(p.job)}</td><td>${p.age}</td>
        <td>${exact?`<span class="cond-bar ${condClass}"><i style="width:${condWidth}%"></i></span>${Math.round(p.health)}%`:`<span class="unknown">${conditionLabel(p)}</span>`}</td>
        <td>${p.alive?dissent:'—'}</td><td>${p.mutation?escapeHtml(p.mutation):'—'}</td>
        <td>${p.alive?allocHtml(p,'food'):'—'}</td><td>${p.alive?allocHtml(p,'heat'):'—'}</td>
        <td>${p.alive?`<input class="med-check" type="checkbox" data-med="${p.id}" ${p.ration.med?'checked':''}>`:'—'}</td>
      </tr>`;
    }).join('');
    $$('[data-adjust]').forEach(btn=>btn.onclick=()=>adjustAllocation(Number(btn.dataset.id),btn.dataset.adjust,Number(btn.dataset.delta)));
    $$('[data-med]').forEach(ch=>ch.onchange=()=>{const p=state.people.find(x=>x.id===Number(ch.dataset.med));p.ration.med=ch.checked;updateProjection();});
    updateProjection();
  }
  function allocHtml(p,key){
    return `<div class="alloc-control"><button data-adjust="${key}" data-id="${p.id}" data-delta="-.25">−</button><span>${Math.round(p.ration[key]*100)}%</span><button data-adjust="${key}" data-id="${p.id}" data-delta=".25">+</button></div>`;
  }
  function adjustAllocation(id,key,delta){const p=state.people.find(x=>x.id===id); if(!p)return; p.ration[key]=clamp(p.ration[key]+delta,0,1.5); p.ration[key==='food'?'manualFood':'manualHeat']=true;renderLedger();}
  function updateProjection(){
    const t=requestedTotals(); const over=t.food>state.stock.food+.001||t.heat>state.stock.heat+.001||t.med>state.stock.med+.001;
    $('#projectionText').innerHTML=`Requested: <b>${t.food.toFixed(1)}</b> nutrition · <b>${t.heat.toFixed(1)}</b> heat · <b>${t.med.toFixed(0)}</b> medicine ${over?'<strong style="color:#7a342d"> · STOCK EXCEEDED</strong>':''}`;
    $('#sealLedgerBtn').disabled=over;
  }
  function autoMedicine(){
    alivePeople().forEach(p=>p.ration.med=false);
    [...alivePeople()].sort((a,b)=>a.health-b.health).slice(0,Math.floor(state.stock.med)).forEach(p=>p.ration.med=true);
    renderLedger();
  }

  function resolveNight(){
    const totals=requestedTotals(); if(totals.food>state.stock.food+.001||totals.heat>state.stock.heat+.001||totals.med>state.stock.med+.001){toast('Requested allocations exceed stock');return;}
    state.stock.food=Math.max(0,state.stock.food-totals.food);state.stock.heat=Math.max(0,state.stock.heat-totals.heat);state.stock.med=Math.max(0,state.stock.med-totals.med);
    const report=[]; const deaths=[]; const mutations=[];
    const snapshot=[...alivePeople()];
    for(const p of snapshot){
      const mut=p.mutation?MUTATIONS.find(m=>m.name===p.mutation):null;
      const foodNeed=mut?.foodMod||1, heatNeed=mut?.heatMod||1;
      const foodRatio=p.ration.food/foodNeed, heatRatio=p.ration.heat/heatNeed;
      p.hunger=clamp(p.hunger+(foodRatio-.8)*25,0,100);
      p.warmth=clamp(p.warmth+(heatRatio-.75)*28,0,100);
      p.rad=+(p.rad + .18 + (p.warmth<40?.12:0) + (p.district==='Industrial Fringe'?.10:0)).toFixed(2);
      let damage=0;
      if(p.hunger<35)damage+=(35-p.hunger)*.28;
      if(p.warmth<35)damage+=(35-p.warmth)*.34;
      if(p.rad>4)damage+=(p.rad-4)*1.2;
      if(p.ration.med && p.health<85) p.health+=randInt(7,15);
      p.health=clamp(p.health-damage+randInt(-3,2),0,100);
      if(foodRatio<.6)p.dissent+=randInt(6,12); else if(foodRatio>=1)p.dissent-=randInt(1,4);
      if(heatRatio<.6)p.dissent+=randInt(4,9);
      p.dissent=clamp(p.dissent+(mut?.dissentAura||0),0,100);
      if(!p.mutation && p.alive){
        const reserve=Math.max(12,p.hunger); const exposure=p.rad*(1+(100-p.health)/90); const lambda=.0075;
        const prob=1-Math.exp(-lambda*((exposure*state.day)/(reserve/50)));
        if(rand()<prob){ const m=choice(MUTATIONS); p.mutation=m.name; state.stats.mutations++; mutations.push(`${p.name}: ${m.name}`); p.history.push({day:state.day,event:`Mutation: ${m.name}`}); }
      }
      let cause=null;
      if(p.health<=3) cause=p.warmth<25?'hypothermia':p.hunger<25?'starvation':'systemic collapse';
      else if(p.health<22 && rand()<.11) cause=p.warmth<p.hunger?'hypothermia':'starvation';
      if(cause){p.alive=false;p.causeOfDeath=cause;p.dayOfDeath=state.day;p.ration.med=false;state.stats.deaths++;deaths.push(`${p.name} — ${cause}`);}
    }
    for(const p of alivePeople()) if(deaths.length){ const cohortDeaths=snapshot.filter(x=>!x.alive&&x.cohort===p.cohort).length; p.dissent=clamp(p.dissent+cohortDeaths*3,0,100); }
    const high=alivePeople().filter(p=>p.dissent>72);
    if(high.length && rand()<.45){const p=choice(high); const loss=Math.min(state.stock.food,randInt(1,3));state.stock.food-=loss;report.push(`Inventory discrepancy: ${loss.toFixed(1)} nutrition missing after ${p.name}'s work detail.`);}
    if(alivePeople().some(p=>p.mutation==='Auditory Mimicry')&&rand()<.5){ const unknown=alivePeople().find(p=>!p.assessed); if(unknown){unknown.assessed=true;report.push(`An impossible conversation was repeated verbatim. ${unknown.name}'s condition is now better documented.`);} }
    deaths.forEach(x=>report.push(`DEATH · ${x}`));mutations.forEach(x=>report.push(`MUTATION · ${x}`));
    if(!deaths.length&&!mutations.length&&!report.length)report.push('No deaths recorded. No major anomalies entered in the night register.');
    state.nightReports.push({day:state.day,lines:report});state.stats.daysSurvived=state.day;
    saveGame(false);
    showNightReport(report,deaths,mutations);
  }
  function showNightReport(lines,deaths,mutations){
    $('#phaseLabel').textContent='ENGINE JUDGEMENT';
    showModal(`<div class="meta">00:00–06:00 · automated municipal record</div><h2>NIGHT ${pad(state.day)}: ENGINE REPORT</h2><p>The ledger has been executed. The numbers below are now facts.</p>
      <div class="report-list">${lines.map(l=>`<div class="report-line ${l.startsWith('DEATH')?'death':l.startsWith('MUTATION')?'mutation':''}">${escapeHtml(l)}</div>`).join('')}</div>
      <button id="nextMorningBtn" class="primary wide">Open Morning File</button>`);
    $('#nextMorningBtn').onclick=()=>{hideModal();advanceMorning();};
  }
  function advanceMorning(){
    if(alivePeople().length===0){showDossier('DEPOPULATION OF DISTRICT');return;}
    if(state.day>=GAME_DAYS){showDossier('FOURTEEN-DAY PROTOTYPE TERM COMPLETE');return;}
    const avgD=alivePeople().reduce((s,p)=>s+p.dissent,0)/Math.max(1,alivePeople().length);
    if(avgD>96){showDossier('ADMINISTRATIVE AUTHORITY COLLAPSED');return;}
    state.day++;state.minutes=360;state.phase='field';state.player={x:4,y:5};
    const workerFactor=alivePeople().filter(p=>p.cohort==='essential').length/Math.max(1,state.people.filter(p=>p.cohort==='essential').length);
    const morningFood=+(2.5*workerFactor).toFixed(1), morningHeat=+(1.5*workerFactor).toFixed(1);
    state.stock.food+=morningFood;state.stock.heat+=morningHeat;
    state.people.forEach(p=>{if(p.alive){p.ration.manualFood=false;p.ration.manualHeat=false;p.ration.med=false;}});
    logField(`Morning production entered: ${morningFood} nutrition, ${morningHeat} heat.`);
    $('#ledgerView').classList.remove('active');$('#fieldView').classList.add('active');refreshAll();resizeCanvas();saveGame(false);
  }

  function showDossier(reason){
    const alive=alivePeople().length;const initial=state.people.length;const starvation=state.people.filter(p=>p.causeOfDeath==='starvation').length;const cold=state.people.filter(p=>p.causeOfDeath==='hypothermia').length;
    const mutated=state.people.filter(p=>p.mutation).length;const avgD=alivePeople().reduce((s,p)=>s+p.dissent,0)/Math.max(1,alive);
    showModal(`<div class="dossier"><div class="meta">FINAL MUNICIPAL RECORD · ${escapeHtml(state.seed)}</div><h2>ADMINISTRATIVE POST-MORTEM</h2><p><b>${escapeHtml(reason)}</b></p>
      <div class="stat-grid"><div>Initial population<br><b>${initial}</b></div><div>Final population<br><b>${alive}</b></div><div>Starvation deaths<br><b>${starvation}</b></div><div>Hypothermia deaths<br><b>${cold}</b></div><div>Mutated residents<br><b>${mutated}</b></div><div>Final mean dissent<br><b>${avgD.toFixed(0)}%</b></div></div>
      <p>The engine does not assign virtue. It records consequences.</p><button id="csvBtn" class="primary wide">Export Obituary CSV</button><button id="restartBtn" class="modal-close">Open a New File</button></div>`);
    $('#csvBtn').onclick=exportCSV;$('#restartBtn').onclick=()=>{localStorage.removeItem(SAVE_KEY);hideModal();state=newState();startGameUI();saveGame(false);};
  }
  function exportCSV(){
    const cols=['id','name','age','job','cohort','alive','health','hunger','warmth','radiation','dissent','mutation','day_of_death','cause_of_death'];
    const lines=[cols.join(',')];
    for(const p of state.people){lines.push(cols.map(k=>{const keyMap={radiation:'rad',day_of_death:'dayOfDeath',cause_of_death:'causeOfDeath'};const v=p[keyMap[k]||k]??'';return `"${String(v).replaceAll('"','""')}"`;}).join(','));}
    const blob=new Blob([lines.join('\n')],{type:'text/csv'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`winter-registry-${state.seed}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500);
  }

  function showModal(html){$('#modalCard').innerHTML=html;$('#modalLayer').classList.remove('hidden');}
  function hideModal(){$('#modalLayer').classList.add('hidden');}
  let toastTimer=null;function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.remove('hidden');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.add('hidden'),1700);}

  function startAmbience(){
    if(audio.ctx){toggleAmbience(true);return;}
    try{
      const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;
      const ac=new AC();const master=ac.createGain();master.gain.value=.035;master.connect(ac.destination);
      const o1=ac.createOscillator();const g1=ac.createGain();o1.type='sine';o1.frequency.value=44;g1.gain.value=.35;o1.connect(g1).connect(master);o1.start();
      const o2=ac.createOscillator();const g2=ac.createGain();o2.type='triangle';o2.frequency.value=67;g2.gain.value=.10;o2.connect(g2).connect(master);o2.start();
      const buffer=ac.createBuffer(1,ac.sampleRate*2,ac.sampleRate);const data=buffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*.25;
      const noise=ac.createBufferSource();noise.buffer=buffer;noise.loop=true;const filter=ac.createBiquadFilter();filter.type='lowpass';filter.frequency.value=520;const ng=ac.createGain();ng.gain.value=.08;noise.connect(filter).connect(ng).connect(master);noise.start();
      audio={ctx:ac,nodes:[o1,o2,noise,master],enabled:true};$('#audioBtn').textContent='●';
    }catch(e){console.warn('audio unavailable',e);}
  }
  function toggleAmbience(forceOn=false){
    if(!audio.ctx){if(forceOn)startAmbience();return;}
    if(forceOn||!audio.enabled){audio.ctx.resume();audio.enabled=true;audio.nodes[3].gain.value=.035;$('#audioBtn').textContent='●';}
    else{audio.enabled=false;audio.nodes[3].gain.value=0;$('#audioBtn').textContent='◌';}
  }

  function registerPWA(){
    if('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(console.warn);
    window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstallPrompt=e;$('#installBtn').classList.remove('hidden');});
    $('#installBtn').onclick=async()=>{if(!deferredInstallPrompt)return;deferredInstallPrompt.prompt();await deferredInstallPrompt.userChoice;deferredInstallPrompt=null;$('#installBtn').classList.add('hidden');};
  }

  function bindEvents(){
    canvas=$('#world');ctx=canvas.getContext('2d');
    $('#newGameBtn').onclick=startNewGame;$('#continueBtn').onclick=()=>{loadGame();startAmbience();};
    $('#saveBtn').onclick=()=>saveGame(true);$('#audioBtn').onclick=()=>audio.ctx?toggleAmbience():startAmbience();
    $('#returnBtn').onclick=openLedger;$('#backToFieldBtn').onclick=closeLedger;$('#sealLedgerBtn').onclick=resolveNight;
    $('#autoMedicineBtn').onclick=autoMedicine;$('#residentSearch').oninput=renderLedger;$('#residentFilter').onchange=renderLedger;
    canvas.addEventListener('pointerup',onWorldPointer);window.addEventListener('resize',resizeCanvas);
    $('#modalLayer').addEventListener('pointerdown',e=>{if(e.target===$('#modalLayer'))hideModal();});
  }

  document.addEventListener('DOMContentLoaded',()=>{bindEvents();updateContinueButton();registerPWA();});
})();
