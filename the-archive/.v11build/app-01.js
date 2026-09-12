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
