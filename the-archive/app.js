const ARCHIVE_VERSION = '11.0.0';
const DEFAULT_CATEGORIES = [
  'OUTERWEAR','JACKET','SUIT','SHIRT','T-SHIRT','POLO','KNITWEAR','TROUSERS','JEANS','SHORTS',
  'SHOES','BOOTS','SOCKS','BELT','WATCH','BAG','TIE','POCKET SQUARE','HAT','SCARF','JEWELLERY','GLASSES',
  'ACCESSORY','UNDERWEAR','OTHER'
];
const DEFAULT_STATUS = ['AVAILABLE','WORN','LAUNDRY','DRY CLEAN','REPAIR','STORED','PACKED'];
const TOP_CATS = ['SHIRT','T-SHIRT','POLO','KNITWEAR'];
const BOTTOM_CATS = ['TROUSERS','JEANS','SHORTS'];
const SHOE_CATS = ['SHOES','BOOTS'];
const OUTER_CATS = ['JACKET','OUTERWEAR','SUIT'];
const ACCESSORY_CATS = ['BELT','WATCH','BAG','TIE','POCKET SQUARE','HAT','SCARF','JEWELLERY','GLASSES','ACCESSORY'];
const CLEAN_EVERY = {
  'UNDERWEAR':1,'SOCKS':1,'SHIRT':1,'T-SHIRT':1,'POLO':1,'KNITWEAR':3,'TROUSERS':4,'JEANS':8,'SHORTS':2,
  'SUIT':8,'JACKET':8,'OUTERWEAR':20,'SHOES':12,'BOOTS':10,'HAT':10,'SCARF':8,'OTHER':4
};
const WEATHER_CODES = {
  0:'Clear',1:'Mainly clear',2:'Partly cloudy',3:'Overcast',45:'Fog',48:'Rime fog',51:'Light drizzle',53:'Drizzle',55:'Heavy drizzle',
  61:'Light rain',63:'Rain',65:'Heavy rain',66:'Freezing rain',67:'Heavy freezing rain',71:'Light snow',73:'Snow',75:'Heavy snow',
  77:'Snow grains',80:'Rain showers',81:'Rain showers',82:'Heavy showers',85:'Snow showers',86:'Heavy snow showers',95:'Thunderstorm',96:'Thunderstorm + hail',99:'Thunderstorm + hail'
};

window.wardrobeApp = function wardrobeApp(){
return {
  version:ARCHIVE_VERSION,
  tabs:[
    {id:'today',label:'Today'},{id:'wardrobe',label:'Wardrobe'},{id:'builder',label:'Builder'},{id:'archive',label:'Archive'},
    {id:'planner',label:'Planner'},{id:'care',label:'Care'},{id:'travel',label:'Travel'},{id:'olfactory',label:'Olfactory'},
    {id:'intelligence',label:'Intelligence'},{id:'database',label:'Database'}
  ],
  currentView:'today', globalSearch:'', seasons:['SPRING','SUMMER','AUTUMN','WINTER'],
  occasions:['WORK','CASUAL','DATE','FORMAL','NIGHT OUT','TRAVEL','INTERVIEW','EVENT','HOME'],
  garmentCategories:[...DEFAULT_CATEGORIES], garmentStatuses:[...DEFAULT_STATUS],
  outfits:[], perfumes:[], archetypes:[], hairstyles:[], garments:[], wears:[], plans:[], wishlist:[], trips:[],
  feedback:[], careTasks:[], perfumeWears:[], calendarEvents:[], subscriptions:[],
  storageStatus:'Connecting…', syncState:'local', isInitialised:false, canInstall:false, deferredInstallPrompt:null,
  toastText:'', toastTimer:null,

  wardrobeMode:'grid', wardrobeFilter:{search:'',category:'ALL',status:'ALL',season:'ALL'},
  garmentModal:false, editingGarmentId:null, garmentDraft:{}, garmentPhotoName:'',
  builderSelected:[], builderFilter:'', builderSeason:'ALL', builderCategory:'ALL', builderOccasion:'WORK',
  archiveSeason:'ALL', outfitModal:false, outfitDraft:{},
  generator:{season:'AUTUMN',occasion:'WORK',archetype:'',weather:'AUTO'}, generatedLook:[], generatedScore:0, generatedReasons:[],
  feedbackModal:false, feedbackDraft:{outfitId:'',garmentIds:[],vote:1,reason:'LOVE IT',note:''},
  planDraft:{date:new Date().toISOString().slice(0,10),outfitId:'',note:''},
  wishDraft:{name:'',category:'SHOES',price:'',colorHex:'#57534e',seasonsText:'AUTUMN; WINTER',formality:3,notes:''},
  tripDraft:{destination:'',startDate:'',endDate:'',activitiesText:'WORK; CASUAL'},
  perfumeModal:false, editingPerfumeName:'', perfumeDraft:{}, archetypeModal:false, archetypeDraft:{},
  syncModal:false, firebaseConfigText:'',
  weather:{status:'idle',label:'',lat:null,lon:null,temp:null,apparent:null,humidity:null,precipitation:null,wind:null,code:null,condition:'',updatedAt:null},
  weatherCity:'', weatherSearchResults:[],
  prefs:{weatherAuto:false,weatherLabel:'',weatherLat:null,weatherLon:null,defaultOccasion:'WORK',defaultSeason:'AUTUMN'},

  databaseCards:[
    {type:'garments',label:'Garments',importable:true},{type:'outfits',label:'Outfits',importable:true},{type:'wears',label:'Wear events'},
    {type:'plans',label:'Planner'},{type:'perfumes',label:'Perfumes',importable:true},{type:'archetypes',label:'Archetypes',importable:true},
    {type:'hairstyles',label:'Hairstyles',importable:true},{type:'wishlist',label:'Wishlist'},{type:'trips',label:'Trips'},
    {type:'feedback',label:'Learning data'},{type:'careTasks',label:'Care tasks'},{type:'perfumeWears',label:'Perfume wears'},
    {type:'calendarEvents',label:'Calendar imports'}
  ],

  async initData(){
    window.addEventListener('beforeinstallprompt',e=>{ e.preventDefault(); this.deferredInstallPrompt=e; this.canInstall=true; });
    this.loadPrefs();
    const ready=async()=>{
      if(!window.ArchiveStorage) return;
      try{
        const user=await window.ArchiveStorage.init();
        this.syncState=window.ArchiveStorage.mode || 'local';
        this.storageStatus=this.syncState==='cloud' ? `Cloud sync · ${String(user?.uid||'').slice(0,8)}` : 'Private device archive';
        for(const type of window.ARCHIVE_COLLECTIONS||[]){
          const stop=window.ArchiveStorage.subscribe(type,items=>{
            this[type]=(items||[]).map(x=>type==='outfits'?({...x,isExpanded:false}):x);
          });
          this.subscriptions.push(stop);
        }
        this.isInitialised=true;
        if(this.prefs.weatherLat!=null && this.prefs.weatherLon!=null) await this.fetchWeather(this.prefs.weatherLat,this.prefs.weatherLon,this.prefs.weatherLabel||'Saved location');
        this.$nextTick(()=>this.ensureTodayRecommendation());
      }catch(e){ console.error(e); this.storageStatus='Storage connection failure'; this.toast('Storage error'); }
    };
    if(window.ArchiveStorage) await ready(); else window.addEventListener('archive-storage-ready',ready,{once:true});
  },

  loadPrefs(){
    try{ this.prefs={...this.prefs,...JSON.parse(localStorage.getItem('archive:v11:prefs')||'{}')}; }catch{}
    this.generator.occasion=this.prefs.defaultOccasion||'WORK'; this.generator.season=this.prefs.defaultSeason||this.currentSeason();
  },
  savePrefs(){ localStorage.setItem('archive:v11:prefs',JSON.stringify(this.prefs)); },
  toast(msg){ this.toastText=msg; clearTimeout(this.toastTimer); this.toastTimer=setTimeout(()=>this.toastText='',2600); },
  uid(prefix='ID'){ return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,7)}`; },
  today(){ return new Date().toISOString().slice(0,10); },
  currentSeason(){ const m=new Date().getMonth()+1; return m>=3&&m<=5?'SPRING':m>=6&&m<=8?'SUMMER':m>=9&&m<=11?'AUTUMN':'WINTER'; },
  prettyDate(d){ if(!d)return'—'; const x=new Date(`${d}T12:00:00`); return Number.isNaN(x)?d:x.toLocaleDateString(undefined,{day:'2-digit',month:'short',year:'numeric'}); },
  money(v){ if(v===null||v===undefined||v===''||Number.isNaN(+v))return'—'; return new Intl.NumberFormat(undefined,{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(+v); },
  clamp(n,min,max){ return Math.max(min,Math.min(max,n)); },
  daysBetween(a,b=this.today()){ if(!a)return 9999; return Math.floor((new Date(`${b}T12:00:00`)-new Date(`${a}T12:00:00`))/86400000); },
  async save(type,items){ await window.ArchiveStorage.saveItems(type,items); },
  async replace(type,items){ await window.ArchiveStorage.replace(type,items); },

  blankGarment(){
    return {id:'',name:'',category:'JACKET',status:'AVAILABLE',brand:'',color:'',colorHex:'#57534e',palette:[],material:'',pattern:'',size:'',
      seasonsText:'AUTUMN; WINTER',formality:3,price:null,purchaseDate:'',fit:'',care:'',careType:'LAUNDRY',careAction:'Clean',wearLimit:null,
      careIntervalDays:90,lastCareDate:'',nextCareDate:'',warmth:3,waterproof:false,tagsText:'',notes:'',image:'',cutoutImage:''};
  },
  newGarment(){ this.editingGarmentId=null; this.garmentPhotoName=''; this.garmentDraft=this.blankGarment(); this.garmentModal=true; },
  openGarment(g){
    this.editingGarmentId=g.id; this.garmentPhotoName='';
    this.garmentDraft={...this.blankGarment(),...g,seasonsText:(g.seasons||[]).join('; '),tagsText:(g.tags||[]).join(', ')};
    this.garmentModal=true;
  },
  defaultWearLimit(category){ return CLEAN_EVERY[category]||4; },
  async saveGarment(){
    if(!this.garmentDraft.name.trim()) return;
    const g={...this.garmentDraft,id:this.editingGarmentId||this.uid('GAR'),name:this.garmentDraft.name.trim(),
      seasons:this.garmentDraft.seasonsText.split(/[;,]/).map(s=>s.trim().toUpperCase()).filter(Boolean),
      tags:this.garmentDraft.tagsText.split(/[,;]/).map(s=>s.trim().toUpperCase()).filter(Boolean),
      wearLimit:+this.garmentDraft.wearLimit||this.defaultWearLimit(this.garmentDraft.category),
      formality:+this.garmentDraft.formality||3,warmth:+this.garmentDraft.warmth||3,price:this.garmentDraft.price===''?null:+this.garmentDraft.price,
      updatedAt:new Date().toISOString()};
    delete g.seasonsText; delete g.tagsText;
    await this.save('garments',[g]); this.garmentModal=false; this.toast(this.editingGarmentId?'Garment updated':'Garment archived');
  },
  async cycleGarmentStatus(g){
    const i=this.garmentStatuses.indexOf(g.status); const status=this.garmentStatuses[(i+1)%this.garmentStatuses.length];
    await this.save('garments',[{...g,status,updatedAt:new Date().toISOString()}]);
  },
  statusClass(s){ return {'AVAILABLE':'ok','WORN':'warn','LAUNDRY':'info','DRY CLEAN':'violet','REPAIR':'danger','STORED':'muted','PACKED':'gold'}[s]||'muted'; },

  async handleGarmentPhoto(e){
    const file=e.target.files?.[0]; if(!file)return; this.garmentPhotoName=file.name;
    const data=await this.compressImage(file,900,.78); this.garmentDraft.image=data;
    await this.analyseGarmentPhoto(file.name,data); e.target.value='';
  },
  compressImage(file,max=900,quality=.78){
    return new Promise((resolve,reject)=>{ const img=new Image(),r=new FileReader();
      r.onload=()=>{ img.onload=()=>{ const scale=Math.min(1,max/Math.max(img.width,img.height)),c=document.createElement('canvas'); c.width=Math.max(1,Math.round(img.width*scale)); c.height=Math.max(1,Math.round(img.height*scale)); c.getContext('2d').drawImage(img,0,0,c.width,c.height); resolve(c.toDataURL('image/jpeg',quality)); }; img.onerror=reject; img.src=r.result; };
      r.onerror=reject; r.readAsDataURL(file);
    });
  },
  async analyseGarmentPhoto(filename,dataUrl){
    try{
      const img=await this.loadImage(dataUrl), c=document.createElement('canvas'); c.width=64;c.height=64; const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,0,0,64,64);
      const d=ctx.getImageData(0,0,64,64).data, bins=new Map();
      for(let i=0;i<d.length;i+=16){ if(d[i+3]<100)continue; const r=Math.round(d[i]/32)*32,g=Math.round(d[i+1]/32)*32,b=Math.round(d[i+2]/32)*32; if(r>240&&g>240&&b>240)continue; const k=`${Math.min(r,255)},${Math.min(g,255)},${Math.min(b,255)}`; bins.set(k,(bins.get(k)||0)+1); }
      const palette=[...bins.entries()].sort((a,b)=>b[1]-a[1]).slice(0,4).map(([k])=>{const [r,g,b]=k.split(',').map(Number);return '#'+[r,g,b].map(x=>x.toString(16).padStart(2,'0')).join('')});
      if(palette.length){ this.garmentDraft.colorHex=palette[0]; this.garmentDraft.palette=palette; this.garmentDraft.color=this.nearestColorName(palette[0]); }
      const text=`${filename} ${this.garmentDraft.name}`.toLowerCase();
      const map=[['coat','OUTERWEAR'],['blazer','JACKET'],['jacket','JACKET'],['shirt','SHIRT'],['tee','T-SHIRT'],['tshirt','T-SHIRT'],['sweater','KNITWEAR'],['jumper','KNITWEAR'],['trouser','TROUSERS'],['pants','TROUSERS'],['jean','JEANS'],['boot','BOOTS'],['shoe','SHOES'],['loafer','SHOES'],['watch','WATCH'],['belt','BELT'],['bag','BAG'],['tie','TIE'],['scarf','SCARF'],['hat','HAT']];
      const hit=map.find(([k])=>text.includes(k)); if(hit&&(!this.editingGarmentId||this.garmentDraft.category==='OTHER'))this.garmentDraft.category=hit[1];
      this.toast(`Photo analysed · ${this.garmentDraft.color||'colour detected'}`);
    }catch(e){ console.warn(e); }
  },
  loadImage(src){ return new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=reject;i.src=src;}); },
  nearestColorName(hex){
    const colors={BLACK:'#171717',CHARCOAL:'#3f3f46',GREY:'#737373',WHITE:'#f5f5f4',NAVY:'#172554',BLUE:'#1d4ed8',BROWN:'#78350f',TAN:'#b68b5b',BEIGE:'#d6c7a1',GREEN:'#365314',OLIVE:'#4d4b28',BURGUNDY:'#701a2b',RED:'#991b1b',PURPLE:'#581c87',ORANGE:'#c2410c',YELLOW:'#ca8a04'};
    return Object.entries(colors).sort((a,b)=>this.colorDistance(hex,a[1])-this.colorDistance(hex,b[1]))[0]?.[0]||'UNKNOWN';
  },
  async makeCutout(){
    if(!this.garmentDraft.image)return; const img=await this.loadImage(this.garmentDraft.image), max=800,scale=Math.min(1,max/Math.max(img.width,img.height)),c=document.createElement('canvas');
    c.width=Math.round(img.width*scale);c.height=Math.round(img.height*scale);const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,0,0,c.width,c.height);
    const im=ctx.getImageData(0,0,c.width,c.height),d=im.data; const corners=[[0,0],[c.width-1,0],[0,c.height-1],[c.width-1,c.height-1]];
    const bg=corners.map(([x,y])=>{const i=(y*c.width+x)*4;return[d[i],d[i+1],d[i+2]]}).reduce((a,v)=>a.map((x,i)=>x+v[i]/4),[0,0,0]);
    for(let i=0;i<d.length;i+=4){const dist=Math.sqrt((d[i]-bg[0])**2+(d[i+1]-bg[1])**2+(d[i+2]-bg[2])**2); if(dist<42)d[i+3]=0; else if(dist<75)d[i+3]=Math.round(255*(dist-42)/33);}
    ctx.putImageData(im,0,0); this.garmentDraft.cutoutImage=c.toDataURL('image/png'); this.toast('Studio cutout generated');
  },

  get filteredGarments(){
    const q=(this.wardrobeFilter.search||this.globalSearch).trim().toLowerCase();
    return this.garments.filter(g=>(!q||[g.name,g.brand,g.material,g.color,g.pattern,g.category,...(g.tags||[])].join(' ').toLowerCase().includes(q))&&
      (this.wardrobeFilter.category==='ALL'||g.category===this.wardrobeFilter.category)&&
      (this.wardrobeFilter.status==='ALL'||g.status===this.wardrobeFilter.status)&&
      (this.wardrobeFilter.season==='ALL'||(g.seasons||[]).includes(this.wardrobeFilter.season)))
      .sort((a,b)=>a.category.localeCompare(b.category)||a.name.localeCompare(b.name));
  },
  get availableGarments(){ return this.garments.filter(g=>g.status==='AVAILABLE'||g.status==='WORN'); },
  get totalWardrobeValue(){ return this.garments.reduce((s,g)=>s+(+g.price||0),0); },
  get closetSections(){
    const groups=[['TAILORING',['OUTERWEAR','JACKET','SUIT']],['TOPS',TOP_CATS],['BOTTOMS',BOTTOM_CATS],['FOOTWEAR',SHOE_CATS],['ACCESSORIES',ACCESSORY_CATS],['FOUNDATIONS',['SOCKS','UNDERWEAR']],['OTHER',['OTHER']]];
    return groups.map(([name,cats])=>({name,items:this.filteredGarments.filter(g=>cats.includes(g.category))})).filter(x=>x.items.length);
  },

  get builderGarments(){
    const q=this.builderFilter.toLowerCase().trim(); return this.garments.filter(g=>(!q||[g.name,g.brand,g.color,g.category,...(g.tags||[])].join(' ').toLowerCase().includes(q))&&
      (this.builderCategory==='ALL'||g.category===this.builderCategory)&&(this.builderSeason==='ALL'||(g.seasons||[]).includes(this.builderSeason)))
      .sort((a,b)=>(['AVAILABLE','WORN'].includes(a.status)?0:1)-(['AVAILABLE','WORN'].includes(b.status)?0:1)||a.category.localeCompare(b.category));
  },
  get builderSelectedGarments(){ return this.builderSelected.map(id=>this.garments.find(g=>g.id===id)).filter(Boolean); },
  toggleBuilderGarment(id){ this.builderSelected=this.builderSelected.includes(id)?this.builderSelected.filter(x=>x!==id):[...this.builderSelected,id]; },
  parseHex(h){ const x=(h||'#777777').replace('#',''); return x.length===6?[parseInt(x.slice(0,2),16),parseInt(x.slice(2,4),16),parseInt(x.slice(4,6),16)]:[119,119,119]; },
  colorDistance(a,b){ const A=this.parseHex(a),B=this.parseHex(b); return Math.sqrt(A.reduce((s,v,i)=>s+(v-B[i])**2,0)); },
  pairColorScore(a,b){ const d=this.colorDistance(a||'#777',b||'#777'); return this.clamp(Math.round(100-Math.abs(d-145)*.28),35,100); },
  garmentFeedbackScore(id){
    const rows=this.feedback.filter(f=>(f.garmentIds||[]).includes(id)); if(!rows.length)return 0;
    return rows.reduce((s,f)=>s+(+f.vote||0),0)/rows.length;
  },
  garmentRecencyPenalty(id){ const days=this.daysSinceGarmentWorn(id); return days===9999?0:days===0?30:days===1?22:days<=3?14:days<=7?7:0; },
  outfitCompatibility(gs,season=this.builderSeason,occasion=this.builderOccasion){
    if(!gs.length)return{total:0,formality:0,color:0,season:0,availability:0,rotation:0,learning:0,weather:0};
    const forms=gs.map(g=>+g.formality||3), spread=Math.max(...forms)-Math.min(...forms), formality=this.clamp(100-spread*18,35,100);
    let cp=0,n=0; for(let i=0;i<gs.length;i++)for(let j=i+1;j<gs.length;j++){cp+=this.pairColorScore(gs[i].colorHex,gs[j].colorHex);n++;}
    const color=n?cp/n:100, target=season==='ALL'?null:season, seasonScore=target?gs.filter(g=>(g.seasons||[]).includes(target)).length/gs.length*100:100;
    const availability=gs.filter(g=>['AVAILABLE','WORN'].includes(g.status)).length/gs.length*100;
    const rotation=100-gs.reduce((s,g)=>s+this.garmentRecencyPenalty(g.id),0)/gs.length;
    const learning=this.clamp(70+gs.reduce((s,g)=>s+this.garmentFeedbackScore(g.id)*15,0)/gs.length,35,100);
    const weather=this.weatherScore(gs);
    const total=Math.round(formality*.18+color*.18+seasonScore*.17+availability*.14+rotation*.13+learning*.1+weather*.1);
    return{total,formality:Math.round(formality),color:Math.round(color),season:Math.round(seasonScore),availability:Math.round(availability),rotation:Math.round(rotation),learning:Math.round(learning),weather:Math.round(weather)};
  },
  get builderScore(){ return this.outfitCompatibility(this.builderSelectedGarments,this.builderSeason,this.builderOccasion); },
  scoreGarments(gs,season){ return this.outfitCompatibility(gs,season,this.generator.occasion).total; },
  get builderPerfume(){ return this.recommendPerfume(this.builderSeason,this.builderOccasion,this.outfitDraft.archetype||''); },

  prepareOutfitSave(){
    if(this.builderSelected.length<2)return; this.outfitDraft={name:'',description:'',season:this.builderSeason==='ALL'?this.currentSeason():this.builderSeason,archetype:'',occasion:this.builderOccasion}; this.outfitModal=true;
  },
  async saveBuiltOutfit(){
    if(!this.outfitDraft.name.trim())return;
    const o={id:this.uid('OUT'),name:this.outfitDraft.name.trim(),description:this.outfitDraft.description,base_description:this.outfitDraft.description,narrative:this.outfitDraft.description,
      archetype:(this.outfitDraft.archetype||'').toUpperCase(),garmentIds:[...this.builderSelected],season:this.outfitDraft.season,occasion:(this.outfitDraft.occasion||'').toUpperCase(),
      perfumeName:this.builderPerfume?.name||'',score:this.builderScore.total,createdAt:new Date().toISOString(),seasons:{}};
    await this.save('outfits',[o]); this.outfitModal=false; this.currentView='archive'; this.toast('Outfit saved');
  },
  editOutfitInBuilder(o){ this.builderSelected=[...(o.garmentIds||[])]; this.builderSeason=o.season||'ALL'; this.builderOccasion=o.occasion||'WORK'; this.currentView='builder'; },
  outfitGarments(o){ return(o?.garmentIds||[]).map(id=>this.garments.find(g=>g.id===id)).filter(Boolean); },
  outfitSeason(o){ if(o.season)return o.season; const ks=Object.keys(o.seasons||{}); return ks.length===1?ks[0]:ks.length?ks.join(' / '):'ALL'; },
  legacyItems(o,key){ const s=this.archiveSeason==='ALL'?(Object.keys(o.seasons||{})[0]||this.currentSeason()):this.archiveSeason; const v=o.seasons?.[s]?.[key]; return Array.isArray(v)?v.join(', '):(v||'—'); },
  get filteredArchiveOutfits(){
    const q=this.globalSearch.trim().toLowerCase(); return this.outfits.filter(o=>(!q||[o.name,o.description,o.base_description,o.archetype,o.occasion].join(' ').toLowerCase().includes(q))&&
      (this.archiveSeason==='ALL'||this.outfitSeason(o).includes(this.archiveSeason))).sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||'')||String(a.id).localeCompare(String(b.id)));
  },

  garmentWearEvents(id){
    return this.wears.filter(w=>(w.garmentIds||this.outfits.find(o=>o.id===w.outfitId)?.garmentIds||[]).includes(id));
  },
  garmentWearCount(id){ return this.garmentWearEvents(id).length; },
  outfitWearCount(id){ return this.wears.filter(w=>w.outfitId===id).length; },
  lastWornGarment(id){ return [...this.garmentWearEvents(id)].sort((a,b)=>(b.date||'').localeCompare(a.date||''))[0]?.date||''; },
  daysSinceGarmentWorn(id){ const d=this.lastWornGarment(id); return d?this.daysBetween(d):9999; },
  costPerWear(g){ const n=this.garmentWearCount(g.id); return n&&g.price?(+g.price/n):null; },
  get recentWears(){ return[...this.wears].sort((a,b)=>(b.date||'').localeCompare(a.date||'')); },
  get leastWornGarments(){ return[...this.garments].sort((a,b)=>this.garmentWearCount(a.id)-this.garmentWearCount(b.id)||a.name.localeCompare(b.name)); },
  get mostWornGarments(){ return[...this.garments].sort((a,b)=>this.garmentWearCount(b.id)-this.garmentWearCount(a.id)||a.name.localeCompare(b.name)); },
  getOutfitName(id){ return this.outfits.find(o=>o.id===id)?.name||'Generated look'; },
  garmentWearsSinceCare(g){
    const cutoff=g.lastCareDate||'0000-00-00'; return this.garmentWearEvents(g.id).filter(w=>(w.date||'')>cutoff).length;
  },
  garmentCareDue(g){
    const limit=+g.wearLimit||this.defaultWearLimit(g.category), wears=this.garmentWearsSinceCare(g), dateDue=g.nextCareDate&&g.nextCareDate<=this.today();
    return wears>=limit || dateDue || ['LAUNDRY','DRY CLEAN','REPAIR'].includes(g.status);
  },
  get dueCareGarments(){ return this.garments.filter(g=>this.garmentCareDue(g)).sort((a,b)=>this.garmentWearsSinceCare(b)-this.garmentWearsSinceCare(a)); },
  async markGarmentCared(g){
    const interval=+g.careIntervalDays||0, next=interval?new Date(Date.now()+interval*86400000).toISOString().slice(0,10):'';
    await this.save('garments',[{...g,status:'AVAILABLE',lastCareDate:this.today(),nextCareDate:next,updatedAt:new Date().toISOString()}]);
    await this.save('careTasks',[{id:this.uid('CARE'),garmentId:g.id,date:this.today(),action:g.careAction||g.careType||'Care',completed:true}]);
    this.toast(`${g.name} returned to rotation`);
  },
  async addCareTask(g,action){
    await this.save('careTasks',[{id:this.uid('CARE'),garmentId:g.id,date:this.today(),action:action||g.careAction||'Care',completed:false}]); this.toast('Care task added');
  },
  async completeCareTask(task){
    const g=this.garments.find(x=>x.id===task.garmentId); if(g)await this.markGarmentCared(g);
    await this.save('careTasks',[{...task,completed:true,completedAt:new Date().toISOString()}]);
  },
  get openCareTasks(){ return this.careTasks.filter(t=>!t.completed).sort((a,b)=>(a.date||'').localeCompare(b.date||'')); },

  async markWorn(o,rating=5,occasion=''){
    const gs=this.outfitGarments(o), date=this.today();
    const w={id:this.uid('WEAR'),date,outfitId:o.id,garmentIds:gs.map(g=>g.id),rating:rating?this.clamp(+rating,1,5):null,occasion:(occasion||o.occasion||'').toUpperCase(),note:'',perfumeName:o.perfumeName||''};
    await this.save('wears',[w]);
    for(const g of gs){
      const projected=this.garmentWearsSinceCare(g)+1,limit=+g.wearLimit||this.defaultWearLimit(g.category);
      const careType=(g.careType||'LAUNDRY').toUpperCase(); let status='WORN';
      if(projected>=limit)status=careType==='DRY CLEAN'?'DRY CLEAN':'LAUNDRY';
      await this.save('garments',[{...g,status,updatedAt:new Date().toISOString()}]);
    }
    if(o.perfumeName)await this.logPerfumeWear(o.perfumeName,o.id);
    this.toast('Wear recorded');
  },
  async markGeneratedWorn(){
    if(!this.generatedLook.length)return;
    const w={id:this.uid('WEAR'),date:this.today(),outfitId:null,garmentIds:this.generatedLook.map(g=>g.id),rating:5,occasion:this.generator.occasion,note:'Generated by Today',perfumeName:this.todayPerfume?.name||''};
    await this.save('wears',[w]);
    for(const g of this.generatedLook){
      const projected=this.garmentWearsSinceCare(g)+1,limit=+g.wearLimit||this.defaultWearLimit(g.category); const careType=(g.careType||'LAUNDRY').toUpperCase();
      await this.save('garments',[{...g,status:projected>=limit?(careType==='DRY CLEAN'?'DRY CLEAN':'LAUNDRY'):'WORN',updatedAt:new Date().toISOString()}]);
    }
    if(this.todayPerfume)await this.logPerfumeWear(this.todayPerfume.name,null);
    this.toast('Today look recorded');
  },
  openFeedbackForOutfit(o,vote=1){ this.feedbackDraft={outfitId:o.id,garmentIds:(o.garmentIds||[]),vote,reason:vote>0?'LOVE IT':'NOT FOR ME',note:''};this.feedbackModal=true; },
  openFeedbackForGenerated(vote=1){ this.feedbackDraft={outfitId:null,garmentIds:this.generatedLook.map(g=>g.id),vote,reason:vote>0?'LOVE IT':'NOT FOR ME',note:''};this.feedbackModal=true; },
  async saveFeedback(){
    await this.save('feedback',[{id:this.uid('FDBK'),date:this.today(),...this.feedbackDraft,weather:this.weatherTags,occasion:this.generator.occasion}]); this.feedbackModal=false; this.toast('Preference learned');
  },

  weatherScore(gs){
    if(!this.weather.temp && this.weather.temp!==0)return 80; const tags=this.weatherTags; let total=100;
    const warmthAvg=gs.reduce((s,g)=>s+(+g.warmth||3),0)/Math.max(1,gs.length);
    if(tags.includes('COLD')&&warmthAvg<3.4)total-=25; if(tags.includes('HOT')&&warmthAvg>2.5)total-=25;
    if(tags.includes('RAIN')&&!gs.some(g=>g.waterproof))total-=22; if(tags.includes('WIND')&&!gs.some(g=>OUTER_CATS.includes(g.category)))total-=12;
    return this.clamp(total,20,100);
  },
  get weatherTags(){
    const t=[]; if(this.weather.temp==null)return t; if(this.weather.temp<=8)t.push('COLD'); if(this.weather.temp>=25)t.push('HOT'); if((this.weather.precipitation||0)>.1||[51,53,55,61,63,65,66,67,80,81,82,95,96,99].includes(this.weather.code))t.push('RAIN'); if((this.weather.wind||0)>=25)t.push('WIND'); if((this.weather.humidity||0)>=80)t.push('HUMID'); return t;
  },
  async locateWeather(){
    if(!navigator.geolocation){this.toast('Location is unavailable in this browser');return;}
    this.weather.status='locating';
    navigator.geolocation.getCurrentPosition(async pos=>{
      this.prefs.weatherLat=pos.coords.latitude; this.prefs.weatherLon=pos.coords.longitude; this.prefs.weatherLabel='Current location'; this.prefs.weatherAuto=true;this.savePrefs();
      await this.fetchWeather(pos.coords.latitude,pos.coords.longitude,'Current location');
    },err=>{this.weather.status='error';this.toast(`Location unavailable: ${err.message}`);},{enableHighAccuracy:false,timeout:9000,maximumAge:900000});
  },
  async searchWeatherCity(){
    const q=this.weatherCity.trim();if(!q)return;this.weatherSearchResults=[];
    try{const r=await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=5&language=en&format=json`);const j=await r.json();this.weatherSearchResults=j.results||[];}catch{this.toast('City lookup failed');}
  },
  async chooseWeatherCity(x){
    const label=[x.name,x.admin1,x.country].filter(Boolean).join(', ');this.prefs.weatherLat=x.latitude;this.prefs.weatherLon=x.longitude;this.prefs.weatherLabel=label;this.prefs.weatherAuto=false;this.savePrefs();this.weatherSearchResults=[];await this.fetchWeather(x.latitude,x.longitude,label);
  },
  async fetchWeather(lat,lon,label='Saved location'){
    this.weather.status='loading';
    try{
      const u=`https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}&current=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m&timezone=auto`;
      const r=await fetch(u),j=await r.json(),c=j.current||{};
      this.weather={status:'ready',label,lat,lon,temp:c.temperature_2m??null,apparent:c.apparent_temperature??null,humidity:c.relative_humidity_2m??null,precipitation:c.precipitation??0,wind:c.wind_speed_10m??0,code:c.weather_code??null,condition:WEATHER_CODES[c.weather_code]||'Current conditions',updatedAt:new Date().toISOString()};
      this.generator.weather=this.weatherTags.join(';')||'DRY'; this.ensureTodayRecommendation(true);
    }catch(e){console.warn(e);this.weather.status='error';this.toast('Weather service unavailable');}
  },

  ruleForArchetype(name){
    const n=(name||'').toUpperCase(); if(!n)return null; const a=this.archetypes.find(x=>(x.name||'').toUpperCase()===n); if(!a)return null;
    return {...a,preferredColors:a.preferredColors||[],materials:a.materials||[],categories:a.categories||[],tags:a.tags||[]};
  },
  archetypeGarmentBonus(g,name){
    const a=this.ruleForArchetype(name); if(!a)return 0; let s=0;
    if((a.preferredColors||[]).some(x=>(g.color||'').toUpperCase().includes(String(x).toUpperCase())))s+=12;
    if((a.materials||[]).some(x=>(g.material||'').toUpperCase().includes(String(x).toUpperCase())))s+=10;
    if((a.categories||[]).includes(g.category))s+=8;
    if((a.tags||[]).some(x=>(g.tags||[]).includes(String(x).toUpperCase())))s+=12;
    const f=+g.formality||3;if(a.formalityMin&&f<a.formalityMin)s-=10;if(a.formalityMax&&f>a.formalityMax)s-=10;return s;
  },
  rankedGarmentsForGenerator(){
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
  ensureTodayRecommendation(force=false){
    if(!this.isInitialised)return; const p=this.todayPlan;
    if(p&&!force){const o=this.outfits.find(x=>x.id===p.outfitId);if(o){this.generatedLook=this.outfitGarments(o);this.generatedScore=this.outfitCompatibility(this.generatedLook,this.outfitSeason(o),o.occasion||this.generator.occasion).total;return;}}
    this.generator.season=this.currentSeason();this.generator.occasion=this.prefs.defaultOccasion||'WORK';this.generateOutfit();
  },
  useGeneratedInBuilder(){ this.builderSelected=this.generatedLook.map(g=>g.id);this.builderSeason=this.generator.season;this.builderOccasion=this.generator.occasion;this.currentView='builder'; },
  get todayPlan(){ return this.plans.find(p=>p.date===this.today())||null; },
  get todayOutfit(){ const p=this.todayPlan;return p?this.outfits.find(o=>o.id===p.outfitId)||null:null; },
  get todayPerfume(){
    const o=this.todayOutfit; if(o?.perfumeName)return this.perfumes.find(p=>p.name===o.perfumeName)||this.recommendPerfume(this.currentSeason(),o.occasion||this.generator.occasion,o.archetype||'');
    return this.recommendPerfume(this.currentSeason(),this.generator.occasion,this.generator.archetype);
  },

  planOutfitQuick(o){ this.planDraft={date:this.today(),outfitId:o.id,note:o.occasion||''};this.currentView='planner'; },
  async savePlan(){
    if(!this.planDraft.date||!this.planDraft.outfitId)return; const existing=this.plans.find(p=>p.date===this.planDraft.date);
    await this.save('plans',[{id:existing?.id||this.uid('PLAN'),...this.planDraft}]);this.planDraft={date:this.today(),outfitId:'',note:''};this.toast('Outfit planned');
  },
  get upcomingPlans(){ return this.plans.filter(p=>p.date>=this.today()).sort((a,b)=>a.date.localeCompare(b.date)); },
  calendarItems(){
    return [...this.upcomingPlans.map(p=>({date:p.date,title:this.getOutfitName(p.outfitId),type:'OUTFIT',note:p.note||''})),...this.calendarEvents.map(e=>({date:e.date,title:e.title||'Calendar event',type:'EVENT',note:e.note||''}))].sort((a,b)=>a.date.localeCompare(b.date));
  },
  exportPlannerICS(){
    const esc=s=>String(s||'').replace(/\\/g,'\\\\').replace(/,/g,'\\,').replace(/;/g,'\\;').replace(/\n/g,'\\n');
    const rows=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//The Archive//Wardrobe OS v11//EN','CALSCALE:GREGORIAN'];
    this.plans.forEach(p=>{const d=(p.date||'').replaceAll('-','');if(!d)return;rows.push('BEGIN:VEVENT',`UID:${p.id}@the-archive`,`DTSTART;VALUE=DATE:${d}`,`SUMMARY:${esc('Outfit · '+this.getOutfitName(p.outfitId))}`,`DESCRIPTION:${esc(p.note||'Planned in The Archive')}`,'END:VEVENT');});
    rows.push('END:VCALENDAR');this.downloadText(`archive-outfits-${this.today()}.ics`,rows.join('\r\n'),'text/calendar');
  },
  async importICS(e){
    const f=e.target.files?.[0];if(!f)return;try{const txt=await f.text(),blocks=txt.split('BEGIN:VEVENT').slice(1),items=[];
      for(const b of blocks){const date=(b.match(/DTSTART(?:;VALUE=DATE)?[^:]*:(\d{8})/)||[])[1],title=(b.match(/SUMMARY:(.*)/)||[])[1];if(date&&title)items.push({id:this.uid('CAL'),date:`${date.slice(0,4)}-${date.slice(4,6)}-${date.slice(6,8)}`,title:title.replace(/\\,/g,','),note:'Imported calendar event'});}
      if(items.length)await this.save('calendarEvents',items);this.toast(`${items.length} calendar events imported`);
    }catch(err){this.toast(`Calendar import failed: ${err.message}`);}finally{e.target.value='';}
  },

  blankTrip(){ return {id:'',destination:'',startDate:'',endDate:'',activities:[],garmentIds:[],packedIds:[],createdAt:''}; },
  async addTrip(){
    if(!this.tripDraft.destination.trim()||!this.tripDraft.startDate||!this.tripDraft.endDate)return;
    const trip={id:this.uid('TRIP'),destination:this.tripDraft.destination.trim(),startDate:this.tripDraft.startDate,endDate:this.tripDraft.endDate,
      activities:this.tripDraft.activitiesText.split(/[;,]/).map(x=>x.trim().toUpperCase()).filter(Boolean),garmentIds:[],packedIds:[],createdAt:new Date().toISOString()};
    await this.save('trips',[trip]);this.tripDraft={destination:'',startDate:'',endDate:'',activitiesText:'WORK; CASUAL'};this.toast('Trip created');
  },
  tripDays(t){ return Math.max(1,this.daysBetween(t.startDate,t.endDate)+1); },
  tripGarments(t){ return (t.garmentIds||[]).map(id=>this.garments.find(g=>g.id===id)).filter(Boolean); },
  buildCapsuleForTrip(t){
    const days=this.tripDays(t),activities=t.activities||['CASUAL'],season=this.seasonForDate(t.startDate),available=this.garments.filter(g=>['AVAILABLE','WORN'].includes(g.status)&&((g.seasons||[]).includes(season)||!(g.seasons||[]).length));
    const versatility=g=>{let s=0;s+=activities.filter(a=>(g.tags||[]).includes(a)).length*15;s+=Math.max(0,12-this.garmentWearCount(g.id));s+=(g.formality?5-Math.abs(3-(+g.formality||3)):0)*3;return s;};
    const sorted=[...available].sort((a,b)=>versatility(b)-versatility(a));
    const take=(cats,n)=>sorted.filter(g=>cats.includes(g.category)).slice(0,n);
    const chosen=[...take(TOP_CATS,Math.min(days,4)),...take(BOTTOM_CATS,Math.min(Math.ceil(days/2),3)),...take(SHOE_CATS,Math.min(2,days)),...take(OUTER_CATS,1),...take(ACCESSORY_CATS,3)];
    const ids=[...new Set(chosen.map(g=>g.id))]; this.save('trips',[{...t,garmentIds:ids,updatedAt:new Date().toISOString()}]);this.toast(`${ids.length}-piece capsule generated`);
  },
  seasonForDate(d){const m=+(d||this.today()).slice(5,7);return m>=3&&m<=5?'SPRING':m>=6&&m<=8?'SUMMER':m>=9&&m<=11?'AUTUMN':'WINTER';},
  async togglePacked(t,id){const packed=(t.packedIds||[]).includes(id)?(t.packedIds||[]).filter(x=>x!==id):[...(t.packedIds||[]),id];await this.save('trips',[{...t,packedIds:packed}]);},
  tripCombinationCount(t){const gs=this.tripGarments(t),n=cats=>gs.filter(g=>cats.includes(g.category)).length;return n(TOP_CATS)*n(BOTTOM_CATS)*Math.max(1,n(SHOE_CATS))*Math.max(1,n(OUTER_CATS));},

  get availableArchetypes(){
    const s=new Set();this.archetypes.forEach(a=>a.name&&s.add(a.name.toUpperCase()));this.outfits.forEach(o=>(o.archetype||'').split(';').forEach(a=>a.trim()&&s.add(a.trim().toUpperCase())));this.perfumes.forEach(p=>(p.archetype||'').split(';').forEach(a=>a.trim()&&s.add(a.trim().toUpperCase())));return[...s].sort();
  },
  editArchetype(a){
    this.archetypeDraft={name:a?.name||'',philosophy:a?.philosophy||'',profile:a?.profile||'',preferredColorsText:(a?.preferredColors||[]).join(', '),materialsText:(a?.materials||[]).join(', '),categoriesText:(a?.categories||[]).join(', '),tagsText:(a?.tags||[]).join(', '),formalityMin:a?.formalityMin||1,formalityMax:a?.formalityMax||5,perfumeFamiliesText:(a?.perfumeFamilies||[]).join(', ')};this.archetypeModal=true;
  },
  async saveArchetype(){
    if(!this.archetypeDraft.name.trim())return;const existing=this.archetypes.find(a=>(a.name||'').toUpperCase()===this.archetypeDraft.name.trim().toUpperCase());
    const a={...existing,name:this.archetypeDraft.name.trim().toUpperCase(),philosophy:this.archetypeDraft.philosophy,profile:this.archetypeDraft.profile,
      preferredColors:this.archetypeDraft.preferredColorsText.split(/[,;]/).map(x=>x.trim().toUpperCase()).filter(Boolean),materials:this.archetypeDraft.materialsText.split(/[,;]/).map(x=>x.trim().toUpperCase()).filter(Boolean),
      categories:this.archetypeDraft.categoriesText.split(/[,;]/).map(x=>x.trim().toUpperCase()).filter(Boolean),tags:this.archetypeDraft.tagsText.split(/[,;]/).map(x=>x.trim().toUpperCase()).filter(Boolean),
      formalityMin:+this.archetypeDraft.formalityMin||1,formalityMax:+this.archetypeDraft.formalityMax||5,perfumeFamilies:this.archetypeDraft.perfumeFamiliesText.split(/[,;]/).map(x=>x.trim().toUpperCase()).filter(Boolean)};
    await this.save('archetypes',[a]);this.archetypeModal=false;this.toast('Archetype rules saved');
  },

  get filteredPerfumes(){
    const q=this.globalSearch.toLowerCase().trim();return this.perfumes.filter(p=>!q||[p.name,p.role,p.mood,p.archetype,p.family,p.layering,p.incense,...(p.topNotes||[]),...(p.middleNotes||[]),...(p.baseNotes||[])].join(' ').toLowerCase().includes(q)).sort((a,b)=>a.name.localeCompare(b.name));
  },
  perfumeWearCount(name){return this.perfumeWears.filter(w=>w.perfumeName===name).length;},
  perfumeLastWorn(name){return [...this.perfumeWears.filter(w=>w.perfumeName===name)].sort((a,b)=>(b.date||'').localeCompare(a.date||''))[0]?.date||'';},
  recommendPerfume(season=this.currentSeason(),occasion='WORK',archetype=''){
    if(!this.perfumes.length)return null; const tags=this.weatherTags;
    const score=p=>{let s=0;if((p.seasons||[]).includes(season))s+=25;if((p.occasions||[]).map(x=>x.toUpperCase()).includes(occasion))s+=20;if(archetype&&(p.archetype||'').toUpperCase().includes(archetype.toUpperCase()))s+=22;
      if(tags.includes('HOT')&&/fresh|citrus|marine|green/i.test([p.family,p.mood,...(p.topNotes||[])].join(' ')))s+=12;if(tags.includes('COLD')&&/amber|oud|wood|leather|incense|spice/i.test([p.family,p.mood,...(p.baseNotes||[])].join(' ')))s+=12;
      s+=Math.min(15,this.daysBetween(this.perfumeLastWorn(p.name))/3);return s;};return[...this.perfumes].sort((a,b)=>score(b)-score(a))[0];
  },
  blankPerfume(){return{name:'',role:'',mood:'',family:'',seasonsText:'AUTUMN; WINTER',occasionsText:'WORK; DATE',archetype:'',topNotesText:'',middleNotesText:'',baseNotesText:'',sprays:3,longevity:'',layering:'',incense:''};},
  editPerfume(p){this.editingPerfumeName=p?.name||'';this.perfumeDraft={...this.blankPerfume(),...p,seasonsText:(p?.seasons||[]).join('; '),occasionsText:(p?.occasions||[]).join('; '),topNotesText:(p?.topNotes||[]).join('; '),middleNotesText:(p?.middleNotes||[]).join('; '),baseNotesText:(p?.baseNotes||[]).join('; ')};this.perfumeModal=true;},
  async savePerfume(){
    if(!this.perfumeDraft.name.trim())return;const p={...this.perfumeDraft,name:this.perfumeDraft.name.trim(),seasons:this.perfumeDraft.seasonsText.split(/[;,]/).map(x=>x.trim().toUpperCase()).filter(Boolean),occasions:this.perfumeDraft.occasionsText.split(/[;,]/).map(x=>x.trim().toUpperCase()).filter(Boolean),topNotes:this.perfumeDraft.topNotesText.split(/[;,]/).map(x=>x.trim()).filter(Boolean),middleNotes:this.perfumeDraft.middleNotesText.split(/[;,]/).map(x=>x.trim()).filter(Boolean),baseNotes:this.perfumeDraft.baseNotesText.split(/[;,]/).map(x=>x.trim()).filter(Boolean),sprays:+this.perfumeDraft.sprays||null};delete p.seasonsText;delete p.occasionsText;delete p.topNotesText;delete p.middleNotesText;delete p.baseNotesText;
    if(this.editingPerfumeName&&this.editingPerfumeName!==p.name){const arr=this.perfumes.filter(x=>x.name!==this.editingPerfumeName);await this.replace('perfumes',[...arr,p]);}else await this.save('perfumes',[p]);this.perfumeModal=false;this.toast('Perfume profile saved');
  },
  async logPerfumeWear(name,outfitId=null){await this.save('perfumeWears',[{id:this.uid('SCENT'),date:this.today(),perfumeName:name,outfitId,weather:this.weatherTags,occasion:this.generator.occasion}]);},

  wishlistGapScore(w){
    const same=this.garments.filter(g=>g.category===w.category).length, complementary=this.garments.filter(g=>this.complementaryCategories(w.category).includes(g.category)).length;return this.clamp(10-Math.min(7,same)+Math.min(4,Math.floor(complementary/3)),1,10);
  },
  complementaryCategories(cat){if(TOP_CATS.includes(cat))return[...BOTTOM_CATS,...SHOE_CATS];if(BOTTOM_CATS.includes(cat))return[...TOP_CATS,...SHOE_CATS];if(SHOE_CATS.includes(cat))return[...TOP_CATS,...BOTTOM_CATS];if(OUTER_CATS.includes(cat))return[...TOP_CATS,...BOTTOM_CATS];return[...TOP_CATS,...BOTTOM_CATS,...SHOE_CATS];},
  wishCompatibilityCount(w){
    const fake={category:w.category,colorHex:w.colorHex||'#777777',formality:+w.formality||3,seasons:w.seasons||[],status:'AVAILABLE'};return this.garments.filter(g=>this.complementaryCategories(fake.category).includes(g.category)&&this.pairColorScore(fake.colorHex,g.colorHex)>65&&Math.abs((+fake.formality||3)-(+g.formality||3))<=2).length;
  },
  wishUnlockScore(w){return this.wishCompatibilityCount(w)*2+this.wishlistGapScore(w)*3;},
  async addWishlist(){
    if(!this.wishDraft.name.trim())return;const w={id:this.uid('WISH'),name:this.wishDraft.name.trim(),category:this.wishDraft.category,price:this.wishDraft.price?+this.wishDraft.price:null,colorHex:this.wishDraft.colorHex,seasons:this.wishDraft.seasonsText.split(/[;,]/).map(x=>x.trim().toUpperCase()).filter(Boolean),formality:+this.wishDraft.formality||3,notes:this.wishDraft.notes,createdAt:new Date().toISOString()};await this.save('wishlist',[w]);this.wishDraft={name:'',category:'SHOES',price:'',colorHex:'#57534e',seasonsText:'AUTUMN; WINTER',formality:3,notes:''};this.toast('Purchase candidate added');
  },
  get rankedWishlist(){return[...this.wishlist].sort((a,b)=>this.wishUnlockScore(b)-this.wishUnlockScore(a));},

  get wardrobeInsights(){
    const out=[],cats={};this.garments.forEach(g=>cats[g.category]=(cats[g.category]||0)+1);
    [['SHIRT',3],['TROUSERS',2],['SHOES',2],['JACKET',2]].forEach(([c,min])=>{if((cats[c]||0)<min)out.push({type:'Gap',title:`Low ${c.toLowerCase()} coverage`,text:`${cats[c]||0} recorded; ${min} gives a healthier rotation.`})});
    const never=this.garments.filter(g=>this.garmentWearCount(g.id)===0);if(never.length)out.push({type:'Rotation',title:`${never.length} garments have no recorded wears`,text:`Unused value: ${this.money(never.reduce((s,g)=>s+(+g.price||0),0))}.`});
    if(this.dueCareGarments.length)out.push({type:'Care',title:`${this.dueCareGarments.length} pieces need attention`,text:'Laundry, cleaning, repairs or scheduled maintenance are due.'});
    const repeated=this.recentRepeatWarning;if(repeated)out.push({type:'Rotation',title:'Recent repetition detected',text:repeated});
    const expensive=this.garments.filter(g=>g.price&&this.garmentWearCount(g.id)>0&&this.costPerWear(g)>100);if(expensive.length)out.push({type:'Value',title:`${expensive.length} high cost-per-wear pieces`,text:'Consider rotating them more often if they still fit your style.'});
    if(!out.length)out.push({type:'System',title:'Wardrobe operating normally',text:'No major gaps or maintenance issues detected from current records.'});return out;
  },
  get recentRepeatWarning(){
    const last=this.recentWears.slice(0,4),counts={};for(const w of last)for(const id of(w.garmentIds||[]))counts[id]=(counts[id]||0)+1;const id=Object.keys(counts).find(x=>counts[x]>=3);const g=this.garments.find(x=>x.id===id);return g?`${g.name} appears in ${counts[id]} of your last ${last.length} recorded wears.`:'';
  },
  get unusedWardrobeValue(){return this.garments.filter(g=>this.garmentWearCount(g.id)===0).reduce((s,g)=>s+(+g.price||0),0);},
  get wears30(){const d=new Date();d.setDate(d.getDate()-30);const cutoff=d.toISOString().slice(0,10);return this.wears.filter(w=>(w.date||'')>=cutoff).length;},
  get averageWearRating(){const r=this.wears.map(w=>+w.rating).filter(Boolean);return r.length?(r.reduce((a,b)=>a+b,0)/r.length).toFixed(1):'—';},
  get categoryAnalytics(){
    const map={};this.garments.forEach(g=>{const k=g.category;map[k]??={category:k,count:0,value:0,wears:0};map[k].count++;map[k].value+=+g.price||0;map[k].wears+=this.garmentWearCount(g.id);});return Object.values(map).sort((a,b)=>b.value-a.value||b.count-a.count);
  },
  get bestValueGarments(){return this.garments.filter(g=>this.costPerWear(g)!=null).sort((a,b)=>this.costPerWear(a)-this.costPerWear(b)).slice(0,8);},
  get worstValueGarments(){return this.garments.filter(g=>g.price).sort((a,b)=>(this.costPerWear(b)??+b.price)-(this.costPerWear(a)??+a.price)).slice(0,8);},
  get styleDNA(){
    const scores={};const add=(k,v=1)=>{if(!k)return;scores[k]=(scores[k]||0)+v;};
    for(const g of this.garments){const wear=Math.max(1,this.garmentWearCount(g.id)*2),rating=this.garmentWearEvents(g.id).reduce((s,w)=>s+(+w.rating||0),0);(g.tags||[]).forEach(t=>add(t,wear+rating));add(g.category,wear*.4);if(g.material)add(g.material.toUpperCase(),wear*.35);if(g.color)add(g.color.toUpperCase(),wear*.25);}
    for(const o of this.outfits){const n=this.outfitWearCount(o.id);if(o.archetype)add(o.archetype.toUpperCase(),Math.max(1,n*3));}
    const rows=Object.entries(scores).sort((a,b)=>b[1]-a[1]).slice(0,8),sum=rows.reduce((s,x)=>s+x[1],0)||1;return rows.map(([name,score])=>({name,score,percent:Math.round(score/sum*100)}));
  },
  get paletteAnalytics(){
    const map={};this.garments.forEach(g=>{const k=g.color||this.nearestColorName(g.colorHex);map[k]=(map[k]||0)+Math.max(1,this.garmentWearCount(g.id));});return Object.entries(map).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([name,count])=>({name,count}));
  },

  get capsuleCombinations(){
    const gs=this.builderSelectedGarments,n=cats=>gs.filter(g=>cats.includes(g.category)).length;return n(TOP_CATS)*n(BOTTOM_CATS)*Math.max(1,n(SHOE_CATS))*Math.max(1,n(OUTER_CATS));
  },
  async generateLookbook(outfit=null){
    const gs=outfit?this.outfitGarments(outfit):this.builderSelectedGarments;if(!gs.length){this.toast('Select garments first');return;}
    const W=1200,H=1500,c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d');x.fillStyle='#121110';x.fillRect(0,0,W,H);x.strokeStyle='#44403c';x.lineWidth=2;x.strokeRect(50,50,W-100,H-100);
    x.fillStyle='#f5f5f4';x.font='48px Georgia';x.fillText(outfit?.name||'THE ARCHIVE · LOOKBOOK',90,125);x.fillStyle='#a8a29e';x.font='22px sans-serif';x.fillText(`${outfit?.season||this.builderSeason} · ${outfit?.occasion||this.builderOccasion} · ${new Date().toLocaleDateString()}`,92,165);
    const cols=2,cellW=500,cellH=510;for(let i=0;i<Math.min(gs.length,6);i++){const g=gs[i],col=i%cols,row=Math.floor(i/cols),px=90+col*cellW,py=220+row*cellH;const src=g.cutoutImage||g.image;
      x.fillStyle='#1c1917';x.fillRect(px,py,440,390);if(src){try{const im=await this.loadImage(src),r=Math.min(400/im.width,350/im.height),dw=im.width*r,dh=im.height*r;x.drawImage(im,px+(440-dw)/2,py+(360-dh)/2,dw,dh);}catch{}}
      x.fillStyle='#f5f5f4';x.font='25px Georgia';x.fillText(g.name.slice(0,30),px,py+430);x.fillStyle='#a8a29e';x.font='17px sans-serif';x.fillText(`${g.category} · ${g.color||''}`.slice(0,42),px,py+462);
    }
    const a=document.createElement('a');a.href=c.toDataURL('image/png');a.download=`archive-lookbook-${this.today()}.png`;a.click();this.toast('Lookbook generated');
  },

  async configureCloud(){
    try{const cfg=JSON.parse(this.firebaseConfigText);if(!cfg.apiKey||!cfg.projectId)throw new Error('apiKey and projectId are required');if(!cfg.archiveVault)cfg.archiveVault=crypto.randomUUID().replace(/-/g,'');localStorage.setItem(`archive:firebase-config:${window.ARCHIVE_APP_ID||'the-archive-antwerp'}`,JSON.stringify(cfg));this.toast('Sync configured · reload to connect');setTimeout(()=>location.reload(),800);}catch(e){this.toast(`Invalid Firebase config: ${e.message}`);}
  },
  disableCloud(){localStorage.removeItem(`archive:firebase-config:${window.ARCHIVE_APP_ID||'the-archive-antwerp'}`);this.toast('Cloud sync disabled · reloading');setTimeout(()=>location.reload(),700);},
  openSync(){this.firebaseConfigText=JSON.stringify(window.ARCHIVE_FIREBASE_ACTIVE_CONFIG||{},null,2);this.syncModal=true;},

  collectionCount(type){ return Array.isArray(this[type])?this[type].length:0; },
  async deleteRecord(type,id){ const arr=(this[type]||[]).filter(x=>(x.id||x.name)!==id);await this.replace(type,arr); },
  async wipeCollection(type){if(!confirm(`Permanently clear ${type}?`))return;await window.ArchiveStorage.wipe(type);this.toast(`${type} cleared`);},
  download(name,data,type='application/json'){const blob=new Blob([data],{type}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);},
  downloadText(name,data,type='text/plain'){this.download(name,data,type);},
  exportCollection(type){this.download(`archive-${type}-${this.today()}.json`,JSON.stringify(this[type]||[],null,2));},
  exportAll(){const all={version:11,exportedAt:new Date().toISOString()};for(const c of window.ARCHIVE_COLLECTIONS||[])all[c]=this[c]||[];all.prefs=this.prefs;this.download(`the-archive-backup-${this.today()}.json`,JSON.stringify(all,null,2));},
  async importAll(e){const f=e.target.files?.[0];if(!f)return;try{const x=JSON.parse(await f.text());for(const c of window.ARCHIVE_COLLECTIONS||[])if(Array.isArray(x[c]))await this.replace(c,x[c]);if(x.prefs){this.prefs={...this.prefs,...x.prefs};this.savePrefs();}this.toast('Archive restored');}catch(err){this.toast(`Restore failed: ${err.message}`);}finally{e.target.value='';}},
  async installApp(){if(!this.deferredInstallPrompt){this.toast('Use your browser menu → Install app / Add to Home screen');return;}this.deferredInstallPrompt.prompt();await this.deferredInstallPrompt.userChoice;this.deferredInstallPrompt=null;this.canInstall=false;},

  async handleFileUpload(e,type){
    const f=e.target.files?.[0];if(!f)return;try{const txt=await f.text();if(f.name.toLowerCase().endsWith('.json')){const x=JSON.parse(txt);const arr=Array.isArray(x)?x:(x[type]||[]);await this.save(type,arr);}else if(type==='garments')await this.parseGarmentTable(txt);else if(type==='outfits')await this.parseOutfitTable(txt);else if(type==='perfumes')await this.parsePerfumeTable(txt);else if(type==='archetypes')await this.parseArchetypeTable(txt);else if(type==='hairstyles')await this.parseHairstyleTable(txt);this.toast(`${type} imported`);}catch(err){this.toast(`Import failed: ${err.message}`);}finally{e.target.value='';}
  },
  tableRows(t){const lines=t.split(/\r?\n/).filter(x=>x.trim());const d=lines[0]?.includes('\t')?'\t':(lines[0]?.includes(';')?';':',');const h=(lines.shift()||'').split(d).map(x=>x.trim().toUpperCase());return{h,rows:lines.map(l=>l.split(d).map(x=>x.trim()))};},
  cell(h,row,names){for(const n of names){const i=h.findIndex(x=>x.includes(n));if(i>=0&&row[i]!==undefined)return row[i];}return'';},
  async parseGarmentTable(t){const{h,rows}=this.tableRows(t),arr=rows.map(r=>({id:this.cell(h,r,['ID'])||this.uid('GAR'),name:this.cell(h,r,['NAME']),category:(this.cell(h,r,['CATEGORY','TYPE'])||'OTHER').toUpperCase(),status:(this.cell(h,r,['STATUS'])||'AVAILABLE').toUpperCase(),brand:this.cell(h,r,['BRAND']),color:this.cell(h,r,['COLOUR','COLOR']),colorHex:'#57534e',material:this.cell(h,r,['MATERIAL']),size:this.cell(h,r,['SIZE']),seasons:this.cell(h,r,['SEASON']).split(/[;,/]/).map(x=>x.trim().toUpperCase()).filter(Boolean),tags:this.cell(h,r,['TAG']).split(/[;,/]/).map(x=>x.trim().toUpperCase()).filter(Boolean),formality:+this.cell(h,r,['FORMALITY'])||3,price:+this.cell(h,r,['PRICE'])||null,fit:this.cell(h,r,['FIT']),care:this.cell(h,r,['CARE']),wearLimit:null,warmth:3,waterproof:false,notes:this.cell(h,r,['NOTES'])})).filter(x=>x.name);await this.save('garments',arr);},
  async parseOutfitTable(t){const{h,rows}=this.tableRows(t),arr=[];for(const r of rows){const raw=this.cell(h,r,['ID']);if(!raw)continue;const tag=this.cell(h,r,['TAG']).split(/[,/]+/).map(x=>x.trim()).filter(Boolean),id=tag[0]?`${raw}-${tag[0].toUpperCase()}`:raw,o={id,base_id:raw,name:this.cell(h,r,['NAME']),base_description:this.cell(h,r,['DESCRIPTION']),narrative:this.cell(h,r,['NARRATIVE']),archetype:this.cell(h,r,['ARCHETYPE']).toUpperCase(),seasons:{}};const ss=this.cell(h,r,['SEASON']).split(';').map(x=>x.trim().toUpperCase()),jk=this.cell(h,r,['JACKET']).split(';'),ht=this.cell(h,r,['HAT']).split(';'),sc=this.cell(h,r,['SCARF']).split(';'),sh=this.cell(h,r,['SHOES']).split(';');ss.forEach((s,i)=>{if(s)o.seasons[s]={jacket:(jk[i]||'N/A').split('/').map(x=>x.trim()),hat:(ht[i]||'N/A').trim(),scarf:(sc[i]||'N/A').trim(),footwear:(sh[i]||'N/A').split('/').map(x=>x.trim())};});arr.push(o);}await this.save('outfits',arr);},
  async parsePerfumeTable(t){const{h,rows}=this.tableRows(t),arr=rows.map(r=>({name:this.cell(h,r,['NAME']),role:this.cell(h,r,['ROLE']),mood:this.cell(h,r,['MOOD']),family:this.cell(h,r,['FAMILY']),seasons:this.cell(h,r,['SEASON']).split(';').map(x=>x.trim().toUpperCase()).filter(Boolean),occasions:this.cell(h,r,['OCCASION']).split(';').map(x=>x.trim().toUpperCase()).filter(Boolean),topNotes:this.cell(h,r,['TOP NOTES']).split(';').map(x=>x.trim()).filter(Boolean),middleNotes:this.cell(h,r,['MIDDLES NOTES','MIDDLE NOTES']).split(';').map(x=>x.trim()).filter(Boolean),baseNotes:this.cell(h,r,['BASE NOTES']).split(';').map(x=>x.trim()).filter(Boolean),archetype:this.cell(h,r,['ARCHETYPE']).toUpperCase()})).filter(x=>x.name);await this.save('perfumes',arr);},
  async parseArchetypeTable(t){const{h,rows}=this.tableRows(t),arr=rows.map(r=>({number:this.cell(h,r,['NUMBER']),name:this.cell(h,r,['NAME']).toUpperCase(),philosophy:this.cell(h,r,['CORE PHILOSOPHY']),profile:this.cell(h,r,['CHARACTER PROFILE'])})).filter(x=>x.name);await this.save('archetypes',arr);},
  async parseHairstyleTable(t){const{h,rows}=this.tableRows(t),arr=rows.map(r=>({archetype:this.cell(h,r,['ARCHETYPE']).toUpperCase(),name:this.cell(h,r,['HAIRSTYLE NAME','NAME']),blueprint:this.cell(h,r,['STRUCTURAL BLUEPRINT']),arsenal:this.cell(h,r,['CHEMICAL ARSENAL'])})).filter(x=>x.name);await this.save('hairstyles',arr);}
};
};
