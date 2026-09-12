from pathlib import Path
import json, re

ROOT=Path('the-archive')

def read(name): return (ROOT/name).read_text()
def write(name,text): (ROOT/name).write_text(text)
def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f'anchor missing: {label}')
    return text.replace(old,new,1)

# ---------- app.js ----------
app=read('app.js')
app=replace_once(app,"const ARCHIVE_VERSION = '11.0.0';","const ARCHIVE_VERSION = '12.0.0';",'version')
app=replace_once(app,
"  generator:{season:'AUTUMN',occasion:'WORK',archetype:'',weather:'AUTO'}, generatedLook:[], generatedScore:0, generatedReasons:[],\n  feedbackModal:false, feedbackDraft:{outfitId:'',garmentIds:[],vote:1,reason:'LOVE IT',note:''},",
"  generator:{season:'AUTUMN',occasion:'WORK',archetype:'',weather:'AUTO',mode:'BALANCED'}, generatedLook:[], generatedScore:0, generatedReasons:[], generatedExplanation:[], generationNonce:0,\n  replacementModal:false,replaceTargetId:null,morningMode:false,fitModal:false,\n  feedbackModal:false, feedbackDraft:{outfitId:'',garmentIds:[],vote:1,reason:'LOVE IT',note:''},",
'generator state')
app=replace_once(app,
"  prefs:{weatherAuto:false,weatherLabel:'',weatherLat:null,weatherLon:null,defaultOccasion:'WORK',defaultSeason:'AUTUMN'},",
"  prefs:{weatherAuto:false,weatherLabel:'',weatherLat:null,weatherLon:null,defaultOccasion:'WORK',defaultSeason:'AUTUMN',recommendationMode:'BALANCED',bodyProfile:{height:null,chest:null,waist:null,hips:null,inseam:null,sleeve:null,shoulder:null,neck:null,shoe:'',notes:''}},",
'prefs')
app=replace_once(app,
"  loadPrefs(){\n    try{ this.prefs={...this.prefs,...JSON.parse(localStorage.getItem('archive:v11:prefs')||'{}')}; }catch{}\n    this.generator.occasion=this.prefs.defaultOccasion||'WORK'; this.generator.season=this.prefs.defaultSeason||this.currentSeason();\n  },\n  savePrefs(){ localStorage.setItem('archive:v11:prefs',JSON.stringify(this.prefs)); },",
"  loadPrefs(){\n    try{ const saved=JSON.parse(localStorage.getItem('archive:v11:prefs')||'{}'); this.prefs={...this.prefs,...saved,bodyProfile:{...this.prefs.bodyProfile,...(saved.bodyProfile||{})}}; }catch{}\n    this.generator.occasion=this.prefs.defaultOccasion||'WORK'; this.generator.season=this.prefs.defaultSeason||this.currentSeason(); this.generator.mode=this.prefs.recommendationMode||'BALANCED';\n  },\n  savePrefs(){ localStorage.setItem('archive:v11:prefs',JSON.stringify(this.prefs)); },\n  setRecommendationMode(mode){ this.generator.mode=mode;this.prefs.recommendationMode=mode;this.savePrefs();this.generateOutfit(); },\n  openMorningMode(){this.morningMode=true;this.ensureTodayRecommendation();document.documentElement.classList.add('morning-open');},\n  closeMorningMode(){this.morningMode=false;document.documentElement.classList.remove('morning-open');},\n  openFitProfile(){this.fitModal=true;},\n  saveFitProfile(){this.prefs.bodyProfile={...this.prefs.bodyProfile};this.savePrefs();this.fitModal=false;this.toast('Fit profile saved');},",
'loadPrefs')
app=replace_once(app,
"      seasonsText:'AUTUMN; WINTER',formality:3,price:null,purchaseDate:'',fit:'',care:'',careType:'LAUNDRY',careAction:'Clean',wearLimit:null,\n      careIntervalDays:90,lastCareDate:'',nextCareDate:'',warmth:3,waterproof:false,tagsText:'',notes:'',image:'',cutoutImage:''};",
"      seasonsText:'AUTUMN; WINTER',formality:3,price:null,purchaseDate:'',fit:'',care:'',careType:'LAUNDRY',careAction:'Clean',wearLimit:null,\n      careIntervalDays:90,lastCareDate:'',nextCareDate:'',warmth:3,waterproof:false,tagsText:'',notes:'',image:'',cutoutImage:'',\n      measureChest:null,measureWaist:null,measureInseam:null,measureSleeve:null,measureShoulder:null,measureLength:null};",
'blankGarment')
app=replace_once(app,
"      formality:+this.garmentDraft.formality||3,warmth:+this.garmentDraft.warmth||3,price:this.garmentDraft.price===''?null:+this.garmentDraft.price,\n      updatedAt:new Date().toISOString()};",
"      formality:+this.garmentDraft.formality||3,warmth:+this.garmentDraft.warmth||3,price:this.garmentDraft.price===''?null:+this.garmentDraft.price,\n      measureChest:this.numOrNull(this.garmentDraft.measureChest),measureWaist:this.numOrNull(this.garmentDraft.measureWaist),measureInseam:this.numOrNull(this.garmentDraft.measureInseam),measureSleeve:this.numOrNull(this.garmentDraft.measureSleeve),measureShoulder:this.numOrNull(this.garmentDraft.measureShoulder),measureLength:this.numOrNull(this.garmentDraft.measureLength),\n      updatedAt:new Date().toISOString()};",
'save garment measures')
app=replace_once(app,
"  clamp(n,min,max){ return Math.max(min,Math.min(max,n)); },",
"  clamp(n,min,max){ return Math.max(min,Math.min(max,n)); },\n  numOrNull(v){return v===null||v===undefined||v===''?null:+v;},",
'num helper')

old_rank="""  rankedGarmentsForGenerator(){
    const season=this.generator.season||this.currentSeason(), occasion=this.generator.occasion||'WORK', tags=this.weatherTags;
    const pool=this.garments.filter(g=>['AVAILABLE','WORN'].includes(g.status)&&((g.seasons||[]).includes(season)||!(g.seasons||[]).length));
    const score=g=>{
      let s=35;if((g.seasons||[]).includes(season))s+=22;if((g.tags||[]).includes(occasion))s+=20;if(tags.some(t=>(g.tags||[]).includes(t)))s+=12;
      if(tags.includes('RAIN')&&g.waterproof)s+=18;if(tags.includes('COLD'))s+=(+g.warmth||3)*4;if(tags.includes('HOT'))s+=(6-(+g.warmth||3))*4;
      s+=this.archetypeGarmentBonus(g,this.generator.archetype);s+=this.garmentFeedbackScore(g.id)*14;s-=this.garmentRecencyPenalty(g.id);s+=Math.min(12,this.daysSinceGarmentWorn(g.id)/5);return s;
    };
    return [...pool].sort((a,b)=>score(b)-score(a));
  },
  generateOutfit(){
    const ranked=this.rankedGarmentsForGenerator(),pick=cats=>ranked.find(g=>cats.includes(g.category));
    const picks=[pick(TOP_CATS),pick(BOTTOM_CATS),pick(SHOE_CATS),pick(OUTER_CATS),pick(ACCESSORY_CATS)].filter(Boolean);
    this.generatedLook=[...new Map(picks.map(g=>[g.id,g])).values()]; this.generatedScore=this.outfitCompatibility(this.generatedLook,this.generator.season,this.generator.occasion).total;
    const tags=this.weatherTags;this.generatedReasons=[`${this.generator.season} / ${this.generator.occasion}`,tags.length?`Weather: ${tags.join(', ')}`:'Weather neutral','Rotation-aware','Preference-weighted'];
  },
"""
new_rank="""  garmentGeneratorScore(g){
    const season=this.generator.season||this.currentSeason(),occasion=this.generator.occasion||'WORK',tags=this.weatherTags,mode=this.generator.mode||'BALANCED';
    let s=35;if((g.seasons||[]).includes(season))s+=22;if((g.tags||[]).includes(occasion))s+=20;if(tags.some(t=>(g.tags||[]).includes(t)))s+=12;
    if(tags.includes('RAIN')&&g.waterproof)s+=18;if(tags.includes('COLD'))s+=(+g.warmth||3)*4;if(tags.includes('HOT'))s+=(6-(+g.warmth||3))*4;
    s+=this.archetypeGarmentBonus(g,this.generator.archetype);s+=this.garmentFeedbackScore(g.id)*(mode==='SAFE'?18:14);s-=this.garmentRecencyPenalty(g.id);
    const neglected=Math.min(22,this.daysSinceGarmentWorn(g.id)/4);s+=mode==='EXPERIMENTAL'?neglected*1.65:mode==='BALANCED'?neglected:.35*neglected;
    if(mode==='SAFE'&&this.garmentWearCount(g.id)===0)s-=8; if(mode==='EXPERIMENTAL'&&this.garmentWearCount(g.id)===0)s+=16;
    return s;
  },
  rankedGarmentsForGenerator(){
    const season=this.generator.season||this.currentSeason();
    const pool=this.garments.filter(g=>['AVAILABLE','WORN'].includes(g.status)&&((g.seasons||[]).includes(season)||!(g.seasons||[]).length));
    return [...pool].sort((a,b)=>this.garmentGeneratorScore(b)-this.garmentGeneratorScore(a));
  },
  chooseForMode(cats,ranked,used=[]){
    let c=ranked.filter(g=>cats.includes(g.category)&&!used.includes(g.id));if(!c.length)return null;
    c=c.slice(0,this.generator.mode==='SAFE'?4:this.generator.mode==='EXPERIMENTAL'?10:6);
    const rest=this.generatedLook.filter(g=>!used.includes(g.id));
    const compat=g=>{const probe=[...rest.filter(x=>!cats.includes(x.category)),g];return this.outfitCompatibility(probe,this.generator.season,this.generator.occasion).total;};
    c.sort((a,b)=>(this.garmentGeneratorScore(b)+compat(b)*.35)-(this.garmentGeneratorScore(a)+compat(a)*.35));
    if(this.generator.mode==='SAFE')return c[0];
    if(this.generator.mode==='EXPERIMENTAL'){const pool=c.slice(0,Math.min(5,c.length));return pool[Math.floor(Math.random()*pool.length)];}
    const pool=c.slice(0,Math.min(3,c.length));return pool[Math.floor(Math.random()*pool.length)];
  },
  buildRecommendationExplanation(gs){
    if(!gs.length)return[];const tags=this.weatherTags,score=this.outfitCompatibility(gs,this.generator.season,this.generator.occasion),mode=this.generator.mode||'BALANCED';
    const out=[{title:`${mode.charAt(0)+mode.slice(1).toLowerCase()} selection`,text:mode==='SAFE'?'Prioritises proven combinations, strong feedback and consistency.':mode==='EXPERIMENTAL'?'Pushes neglected pieces and less familiar combinations while retaining compatibility safeguards.':'Balances proven combinations with rotation and some novelty.'}];
    if(this.weather.status==='ready')out.push({title:'Weather fit',text:`${Math.round(this.weather.temp)}°C, ${this.weather.condition.toLowerCase()}. Weather score ${score.weather}/100${tags.length?` · ${tags.join(', ')}`:''}.`});
    out.push({title:'Harmony',text:`Colour ${score.color}/100 · formality ${score.formality}/100 · season ${score.season}/100.`});
    const old=gs.slice().sort((a,b)=>this.daysSinceGarmentWorn(b.id)-this.daysSinceGarmentWorn(a.id))[0];if(old)out.push({title:'Rotation',text:`${old.name} has been out of rotation for ${Math.min(999,this.daysSinceGarmentWorn(old.id))} days${this.garmentWearCount(old.id)===0?' and has no recorded wear yet':''}.`});
    const learned=gs.reduce((s,g)=>s+this.garmentFeedbackScore(g.id),0)/Math.max(1,gs.length);out.push({title:'Preference model',text:learned>.25?'Your past feedback strongly supports these pieces.':learned<-.15?'This is outside your usual positive-feedback pattern.':'Your feedback is neutral-to-positive for this combination.'});
    return out;
  },
  generateOutfit(){
    this.generationNonce++;const ranked=this.rankedGarmentsForGenerator(),used=[],picks=[];this.generatedLook=[];
    for(const cats of [TOP_CATS,BOTTOM_CATS,SHOE_CATS,OUTER_CATS,ACCESSORY_CATS]){const g=this.chooseForMode(cats,ranked,used);if(g){picks.push(g);used.push(g.id);this.generatedLook=[...picks];}}
    this.generatedLook=[...new Map(picks.map(g=>[g.id,g])).values()];this.generatedScore=this.outfitCompatibility(this.generatedLook,this.generator.season,this.generator.occasion).total;
    const tags=this.weatherTags;this.generatedReasons=[`${this.generator.season} / ${this.generator.occasion}`,`${this.generator.mode} MODE`,tags.length?`Weather: ${tags.join(', ')}`:'Weather neutral','Rotation-aware','Preference-weighted'];this.generatedExplanation=this.buildRecommendationExplanation(this.generatedLook);
  },
  openReplacement(g){this.replaceTargetId=g.id;this.replacementModal=true;},
  get replacementTarget(){return this.generatedLook.find(g=>g.id===this.replaceTargetId)||null;},
  get replacementCandidates(){
    const target=this.replacementTarget;if(!target)return[];const role=this.garmentRole(target),rest=this.generatedLook.filter(g=>g.id!==target.id),used=new Set(rest.map(g=>g.id));
    return this.rankedGarmentsForGenerator().filter(g=>this.garmentRole(g)===role&&!used.has(g.id)&&g.id!==target.id).map(g=>({g,score:this.outfitCompatibility([...rest,g],this.generator.season,this.generator.occasion).total,fit:this.fitAssessment(g)})).sort((a,b)=>b.score-a.score).slice(0,12);
  },
  garmentRole(g){if(TOP_CATS.includes(g.category))return'TOP';if(BOTTOM_CATS.includes(g.category))return'BOTTOM';if(SHOE_CATS.includes(g.category))return'SHOES';if(OUTER_CATS.includes(g.category))return'OUTER';if(ACCESSORY_CATS.includes(g.category))return'ACCESSORY';return g.category;},
  replaceGeneratedGarment(id){const g=this.garments.find(x=>x.id===id),i=this.generatedLook.findIndex(x=>x.id===this.replaceTargetId);if(!g||i<0)return;this.generatedLook.splice(i,1,g);this.generatedLook=[...this.generatedLook];this.generatedScore=this.outfitCompatibility(this.generatedLook,this.generator.season,this.generator.occasion).total;this.generatedExplanation=this.buildRecommendationExplanation(this.generatedLook);this.replacementModal=false;this.toast(`${g.name} substituted`);},
  get bodyProfileComplete(){const p=this.prefs.bodyProfile||{};return !!(p.chest||p.waist||p.inseam||p.sleeve);},
  fitAssessment(g){
    const p=this.prefs.bodyProfile||{};let score=100,notes=[];const cat=g.category;
    if(!this.bodyProfileComplete)return{score:null,label:'Add fit profile',notes:['Body measurements are not configured.']};
    if((TOP_CATS.includes(cat)||OUTER_CATS.includes(cat))&&p.chest&&g.measureChest){const ease=g.measureChest-p.chest,ideal=OUTER_CATS.includes(cat)?14:10;if(ease<4){score-=35;notes.push('chest may be tight');}else if(ease>24){score-=20;notes.push('very relaxed chest');}else if(Math.abs(ease-ideal)<=5)notes.push('chest ease looks good');}
    if(BOTTOM_CATS.includes(cat)&&p.waist&&g.measureWaist){const d=g.measureWaist-p.waist;if(d<-1){score-=35;notes.push('waist may be tight');}else if(d>8){score-=25;notes.push('waist likely loose');}else notes.push('waist close to profile');}
    if(BOTTOM_CATS.includes(cat)&&p.inseam&&g.measureInseam){const d=g.measureInseam-p.inseam;if(Math.abs(d)>3){score-=18;notes.push(d>0?'inseam runs long':'inseam runs short');}else notes.push('inseam close to profile');}
    if((TOP_CATS.includes(cat)||OUTER_CATS.includes(cat))&&p.sleeve&&g.measureSleeve){const d=g.measureSleeve-p.sleeve;if(Math.abs(d)>2.5){score-=16;notes.push(d>0?'sleeve may run long':'sleeve may run short');}else notes.push('sleeve close to profile');}
    score=this.clamp(score,25,100);return{score,label:score>=90?'Likely close':score>=72?'Check proportions':score>=50?'Alteration likely':'Poor fit risk',notes:notes.length?notes:['Not enough garment measurements to compare.']};
  },
"""
app=replace_once(app,old_rank,new_rank,'generator engine')
app=replace_once(app,
"    if(p&&!force){const o=this.outfits.find(x=>x.id===p.outfitId);if(o){this.generatedLook=this.outfitGarments(o);this.generatedScore=this.outfitCompatibility(this.generatedLook,this.outfitSeason(o),o.occasion||this.generator.occasion).total;return;}}",
"    if(p&&!force){const o=this.outfits.find(x=>x.id===p.outfitId);if(o){this.generatedLook=this.outfitGarments(o);this.generatedScore=this.outfitCompatibility(this.generatedLook,this.outfitSeason(o),o.occasion||this.generator.occasion).total;this.generatedReasons=['PLANNED LOOK',`${this.outfitSeason(o)} / ${o.occasion||this.generator.occasion}`];this.generatedExplanation=this.buildRecommendationExplanation(this.generatedLook);return;}}",
'planned explanation')
app=replace_once(app,"PRODID:-//The Archive//Wardrobe OS v11//EN","PRODID:-//The Archive//Wardrobe OS v12//EN",'ics version')
write('app.js',app)

# ---------- index.html ----------
html=read('index.html')
html=replace_once(html,'<title>The Archive · Wardrobe Intelligence</title>','<title>The Archive · Wardrobe Intelligence v12</title>','title')
html=replace_once(html,'<div class="shell px-3 md:px-8 py-5 md:py-8">','<div class="shell px-3 md:px-8 py-5 md:py-8">\n  <!-- Wardrobe Intelligence v12 -->','v12 marker')

morning='''\n  <!-- MORNING MODE -->\n  <div x-show="morningMode" x-cloak class="morning-overlay">\n    <div class="morning-shell">\n      <div class="flex items-start justify-between gap-4"><div><div class="eyebrow">Morning mode</div><h2 class="serif text-4xl md:text-6xl text-stone-100 mt-1">What to wear</h2><div class="text-sm muted mt-2" x-text="weather.status==='ready'?`${Math.round(weather.temp)}°C · ${weather.condition} · ${generator.occasion}`:`${generator.occasion} · ${generator.season}`"></div></div><button class="icon-btn" @click="closeMorningMode()">×</button></div>\n      <div class="mode-switch mt-5"><template x-for="m in ['SAFE','BALANCED','EXPERIMENTAL']" :key="m"><button class="btn" :class="generator.mode===m?'btn-primary':''" @click="setRecommendationMode(m)" x-text="m"></button></template></div>\n      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mt-6"><template x-for="g in generatedLook" :key="g.id"><div class="card p-2"><div class="thumb cutout"><template x-if="g.cutoutImage||g.image"><img :src="g.cutoutImage||g.image"></template><template x-if="!g.cutoutImage&&!g.image"><div class="photo-placeholder" x-text="g.name.slice(0,1)"></div></template></div><div class="serif text-base mt-2" x-text="g.name"></div><button class="mini-action mt-2" @click="openReplacement(g)">Replace</button></div></template></div>\n      <div class="card-soft p-4 mt-5"><div class="label">Why this look</div><template x-for="x in generatedExplanation" :key="x.title"><div class="reason-row"><strong x-text="x.title"></strong><span x-text="x.text"></span></div></template></div>\n      <div class="grid sm:grid-cols-2 gap-3 mt-5"><button class="btn btn-primary morning-primary" :disabled="!generatedLook.length" @click="markGeneratedWorn()">Wore this</button><button class="btn morning-primary" @click="generateOutfit()">Another look</button></div>\n      <div class="flex flex-wrap gap-2 mt-3"><button class="btn" @click="currentView='today';closeMorningMode()">Full Today view</button><button class="btn" @click="locateWeather()">Refresh weather</button><button class="btn" @click="openFitProfile()">Fit profile</button></div>\n    </div>\n  </div>\n'''
html=replace_once(html,'  <!-- GARMENT MODAL -->',morning+'\n  <!-- GARMENT MODAL -->','morning overlay')

replacement='''\n  <!-- REPLACEMENT MATRIX -->\n  <div x-show="replacementModal" x-cloak class="fixed inset-0 z-[150] modal-bg flex items-center justify-center p-2" @keydown.escape.window="replacementModal=false">\n    <div class="modal-panel w-full max-w-4xl p-5 overflow-auto" style="max-height:94dvh" @click.outside="replacementModal=false">\n      <div class="flex justify-between gap-3"><div><div class="eyebrow">Replacement matrix</div><h2 class="section-title mt-1">Swap <span x-text="replacementTarget?.name||'piece'"></span></h2><p class="text-sm muted mt-2">Candidates keep the same wardrobe role and are ranked against the rest of this exact look.</p></div><button class="icon-btn" @click="replacementModal=false">×</button></div>\n      <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-5"><template x-for="x in replacementCandidates" :key="x.g.id"><button class="card p-3 text-left replacement-card" @click="replaceGeneratedGarment(x.g.id)"><div class="flex gap-3"><div class="w-20 shrink-0"><div class="thumb cutout"><template x-if="x.g.cutoutImage||x.g.image"><img :src="x.g.cutoutImage||x.g.image"></template><template x-if="!x.g.cutoutImage&&!x.g.image"><div class="photo-placeholder" x-text="x.g.name.slice(0,1)"></div></template></div></div><div class="min-w-0"><div class="serif text-lg truncate" x-text="x.g.name"></div><div class="eyebrow mt-1" x-text="x.g.category"></div><div class="text-xs mt-2"><span class="pill" x-text="x.score+' match'"></span> <span class="pill" x-text="x.fit.label"></span></div></div></div></button></template><div x-show="!replacementCandidates.length" class="card-soft p-8 text-center muted sm:col-span-2 lg:col-span-3">No suitable substitute is currently available.</div></div>\n    </div>\n  </div>\n\n  <!-- FIT PROFILE -->\n  <div x-show="fitModal" x-cloak class="fixed inset-0 z-[150] modal-bg flex items-center justify-center p-2" @keydown.escape.window="fitModal=false">\n    <div class="modal-panel w-full max-w-3xl p-5 overflow-auto" style="max-height:94dvh" @click.outside="fitModal=false"><div class="flex justify-between"><div><div class="eyebrow">Fit profile</div><h2 class="section-title mt-1">Personal measurements</h2><p class="text-sm muted mt-2">Centimetres unless noted. These measurements stay in your Archive preferences and are used to flag likely fit/alteration issues.</p></div><button class="icon-btn" @click="fitModal=false">×</button></div><div class="grid grid-cols-2 md:grid-cols-3 gap-3 mt-5"><label><span class="label">Height</span><input class="field mt-1" type="number" x-model.number="prefs.bodyProfile.height"></label><label><span class="label">Chest circumference</span><input class="field mt-1" type="number" x-model.number="prefs.bodyProfile.chest"></label><label><span class="label">Waist circumference</span><input class="field mt-1" type="number" x-model.number="prefs.bodyProfile.waist"></label><label><span class="label">Hip circumference</span><input class="field mt-1" type="number" x-model.number="prefs.bodyProfile.hips"></label><label><span class="label">Inseam</span><input class="field mt-1" type="number" x-model.number="prefs.bodyProfile.inseam"></label><label><span class="label">Sleeve</span><input class="field mt-1" type="number" x-model.number="prefs.bodyProfile.sleeve"></label><label><span class="label">Shoulder width</span><input class="field mt-1" type="number" x-model.number="prefs.bodyProfile.shoulder"></label><label><span class="label">Neck</span><input class="field mt-1" type="number" x-model.number="prefs.bodyProfile.neck"></label><label><span class="label">Shoe size</span><input class="field mt-1" x-model="prefs.bodyProfile.shoe"></label><label class="col-span-2 md:col-span-3"><span class="label">Fit notes</span><textarea class="field mt-1" rows="3" x-model="prefs.bodyProfile.notes" placeholder="Preferred trouser rise, shoulder preference, usual alterations…"></textarea></label></div><button class="btn btn-primary w-full mt-4" @click="saveFitProfile()">Save fit profile</button></div>\n  </div>\n'''
html=replace_once(html,'  <!-- FEEDBACK MODAL -->',replacement+'\n  <!-- FEEDBACK MODAL -->','replacement and fit modals')

html=replace_once(html,
'<div class="flex flex-wrap gap-2 md:justify-end"><button class="btn" @click="openSync()">Sync</button><button class="btn" x-show="canInstall" @click="installApp()">Install</button><button class="btn btn-primary" @click="newGarment()">+ Garment</button></div>',
'<div class="flex flex-wrap gap-2 md:justify-end"><button class="btn btn-primary" @click="openMorningMode()">Morning</button><button class="btn" @click="openFitProfile()">Fit</button><button class="btn" @click="openSync()">Sync</button><button class="btn" x-show="canInstall" @click="installApp()">Install</button><button class="btn btn-primary" @click="newGarment()">+ Garment</button></div>',
'header actions')

html=replace_once(html,
'<div class="flex flex-wrap items-start justify-between gap-4"><div><div class="eyebrow">Daily protocol</div><h2 class="section-title mt-1">Today</h2><p class="text-sm muted mt-2" x-text="todayPlan?\'Your planner has an outfit assigned.\':\'The Archive is selecting from what is actually available.\'"></p></div><div class="score-ring" :style="`--score:${generatedScore||0}`"><span x-text="generatedScore||0"></span></div></div>',
'<div class="flex flex-wrap items-start justify-between gap-4"><div><div class="eyebrow">Daily protocol</div><h2 class="section-title mt-1">Today</h2><p class="text-sm muted mt-2" x-text="todayPlan?\'Your planner has an outfit assigned.\':\'The Archive is selecting from what is actually available.\'"></p><div class="mode-switch mt-4"><template x-for="m in [\'SAFE\',\'BALANCED\',\'EXPERIMENTAL\']" :key="m"><button class="btn" :class="generator.mode===m?\'btn-primary\':\'\'" @click="setRecommendationMode(m)" x-text="m"></button></template></div></div><div class="score-ring" :style="`--score:${generatedScore||0}`"><span x-text="generatedScore||0"></span></div></div>',
'today modes')

html=replace_once(html,
'<div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3"><template x-for="g in generatedLook" :key="g.id"><div class="card-soft p-2"><div class="thumb cutout"><template x-if="g.cutoutImage||g.image"><img :src="g.cutoutImage||g.image"></template><template x-if="!g.cutoutImage&&!g.image"><div class="photo-placeholder" x-text="g.name.slice(0,1)"></div></template></div><div class="serif text-sm mt-2 text-stone-100" x-text="g.name"></div><div class="eyebrow mt-1" x-text="g.category"></div></div></template></div>',
'<div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3"><template x-for="g in generatedLook" :key="g.id"><div class="card-soft p-2"><div class="thumb cutout"><template x-if="g.cutoutImage||g.image"><img :src="g.cutoutImage||g.image"></template><template x-if="!g.cutoutImage&&!g.image"><div class="photo-placeholder" x-text="g.name.slice(0,1)"></div></template></div><div class="serif text-sm mt-2 text-stone-100" x-text="g.name"></div><div class="eyebrow mt-1" x-text="g.category"></div><button class="mini-action mt-2 w-full" @click="openReplacement(g)">Replace</button></div></template></div>',
'today replace buttons')

html=replace_once(html,
'<div class="flex flex-wrap gap-2 mt-4"><template x-for="r in generatedReasons" :key="r"><span class="pill" x-text="r"></span></template></div>\n              <div class="flex flex-wrap gap-2 mt-5">',
'<div class="flex flex-wrap gap-2 mt-4"><template x-for="r in generatedReasons" :key="r"><span class="pill" x-text="r"></span></template></div><div class="card-soft p-4 mt-4"><div class="label">Why this look</div><template x-for="x in generatedExplanation" :key="x.title"><div class="reason-row"><strong x-text="x.title"></strong><span x-text="x.text"></span></div></template></div>\n              <div class="flex flex-wrap gap-2 mt-5">',
'today why')

html=replace_once(html,
'<label class="md:col-span-2"><span class="label">Fit / tailoring record</span><input class="field mt-1" x-model="garmentDraft.fit" placeholder="Sleeves shortened 2 cm · 2026"></label>',
'<div class="md:col-span-2 card-soft p-3"><div class="label">Garment measurements · cm</div><div class="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2"><input class="field" type="number" x-model.number="garmentDraft.measureChest" placeholder="Chest circumference"><input class="field" type="number" x-model.number="garmentDraft.measureWaist" placeholder="Waist circumference"><input class="field" type="number" x-model.number="garmentDraft.measureInseam" placeholder="Inseam"><input class="field" type="number" x-model.number="garmentDraft.measureSleeve" placeholder="Sleeve"><input class="field" type="number" x-model.number="garmentDraft.measureShoulder" placeholder="Shoulder"><input class="field" type="number" x-model.number="garmentDraft.measureLength" placeholder="Length"></div><div class="text-xs mt-2" x-show="editingGarmentId"><span class="pill" x-text="fitAssessment(garmentDraft).label"></span><span class="muted ml-2" x-text="fitAssessment(garmentDraft).notes.join(\' · \')"></span></div></div><label class="md:col-span-2"><span class="label">Fit / tailoring record</span><input class="field mt-1" x-model="garmentDraft.fit" placeholder="Sleeves shortened 2 cm · 2026"></label>',
'garment measurements')
write('index.html',html)

# ---------- CSS ----------
css=read('app.css')
css += '''\n\n/* Wardrobe Intelligence v12 */\n.morning-overlay{position:fixed;inset:0;z-index:145;background:radial-gradient(circle at 20% 0%,rgba(94,75,55,.22),transparent 40%),#121110;overflow:auto;padding:max(18px,env(safe-area-inset-top)) max(14px,env(safe-area-inset-right)) max(24px,env(safe-area-inset-bottom)) max(14px,env(safe-area-inset-left));}\n.morning-shell{width:min(1100px,100%);margin:0 auto;padding:clamp(10px,3vw,32px) 0;}\nhtml.morning-open,html.morning-open body{overflow:hidden;}\n.mode-switch{display:flex;gap:6px;flex-wrap:wrap}.mode-switch .btn{font-size:10px;padding:.55rem .75rem;}\n.reason-row{display:grid;grid-template-columns:minmax(110px,150px) 1fr;gap:12px;padding:10px 0;border-top:1px solid rgba(120,113,108,.22);font-size:12px}.reason-row:first-of-type{margin-top:8px}.reason-row strong{font-family:'Playfair Display',serif;font-size:14px;font-weight:400;color:#e7e5e4}.reason-row span{color:#a8a29e;line-height:1.45}.mini-action{border:1px solid rgba(120,113,108,.45);padding:7px 9px;font-size:9px;text-transform:uppercase;letter-spacing:.12em;color:#a8a29e;transition:.2s}.mini-action:hover{border-color:#d6d3d1;color:#f5f5f4}.replacement-card{transition:transform .18s ease,border-color .18s ease}.replacement-card:hover{transform:translateY(-2px);border-color:#a8a29e}.morning-primary{min-height:54px;font-size:12px}.fit-score{font-variant-numeric:tabular-nums}\n@media(max-width:640px){.reason-row{grid-template-columns:1fr;gap:3px}.morning-overlay{padding-top:max(14px,env(safe-area-inset-top))}.morning-shell{padding-top:8px}.replacement-card:hover{transform:none}}\n'''
write('app.css',css)

# ---------- manifest ----------
manifest=json.loads(read('manifest.webmanifest'))
manifest['name']='The Archive · Wardrobe Intelligence v12'
manifest['description']='A local-first wardrobe intelligence system with weather-aware recommendations, adaptive style learning, fit intelligence and Morning Mode.'
manifest['short_name']='The Archive'
write('manifest.webmanifest',json.dumps(manifest,indent=2,ensure_ascii=False)+'\n')

# ---------- service worker ----------
sw=read('sw.js')
sw=sw.replace("archive-v11.0.0","archive-v12.0.0")
write('sw.js',sw)

# ---------- README ----------
rd=read('README.md')
if '## v12' not in rd:
    rd += '''\n\n## v12 · Decision Layer\n\n- Morning Mode for one-tap daily dressing\n- Safe / Balanced / Experimental recommendation personalities\n- Explainable recommendations with weather, harmony, rotation and preference reasoning\n- In-place garment replacement ranked against the rest of the current look\n- Personal body measurement profile and garment-level fit measurements\n- Fit-risk hints for tops, outerwear and trousers\n- Existing v11 wardrobe records remain backward-compatible\n'''
write('README.md',rd)

print('Archive v12 patch applied')
