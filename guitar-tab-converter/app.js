(() => {
  'use strict';
  const E=window.GothicaEngine;
  let renderMode='standard';
  const STORAGE_KEY='chiaroscuro-gothica-abc-v2';
  const input=document.getElementById('abc-input');

  function showMessage(msg,isError=false){
    const box=document.getElementById('message-box');
    box.textContent=msg; box.style.display='block';
    box.style.borderColor=isError?'#b84b4b':'var(--accent-brass)';
    clearTimeout(showMessage.timer);
    showMessage.timer=setTimeout(()=>box.style.display='none',3500);
  }

  function generateChordSVG(name){
    const f=E.chordLib[name];
    if(!f) return `<div class="chord-fallback" title="No built-in fingering for ${name}">${name}</div>`;
    const fretted=f.filter(v=>Number.isInteger(v)&&v>0);
    const minFret=fretted.length?Math.min(...fretted):1;
    const maxFret=fretted.length?Math.max(...fretted):4;
    const baseFret=maxFret>4?minFret:1;
    let s=`<svg width="75" height="108" viewBox="0 0 80 118" role="img" aria-label="${name} guitar chord">
      <text x="40" y="16" fill="var(--accent-brass)" font-family="'Pirata One', cursive" font-size="18" text-anchor="middle">${name}</text>
      <g transform="translate(10,30)"><rect width="60" height="70" fill="none" stroke="var(--accent-brass)" stroke-width="2"/>`;
    for(let i=1;i<4;i++) s+=`<line y1="${i*17.5}" x2="60" y2="${i*17.5}" stroke="var(--accent-brass)" stroke-opacity="0.3"/>`;
    for(let i=1;i<5;i++) s+=`<line x1="${i*12}" x2="${i*12}" y2="70" stroke="var(--accent-brass)" stroke-opacity="0.3"/>`;
    if(baseFret>1) s+=`<text x="-7" y="12" fill="var(--accent-brass)" font-size="9" text-anchor="middle">${baseFret}</text>`;
    f.forEach((v,i)=>{
      const x=i*12;
      if(v===null) s+=`<text x="${x}" y="-5" fill="var(--accent-blood)" font-size="10" text-anchor="middle">X</text>`;
      else if(v===0) s+=`<circle cx="${x}" cy="-7" r="3" fill="none" stroke="var(--accent-brass)" stroke-width="1"/>`;
      else s+=`<circle cx="${x}" cy="${(v-baseFret+1)*17.5-8.75}" r="4" fill="var(--accent-blood)"/>`;
    });
    return s+'</g></svg>';
  }

  function processAndRender(){
    const raw=input.value.trim();
    if(!raw){showMessage('Enter ABC notation first.',true);return;}
    localStorage.setItem(STORAGE_KEY,raw);
    try{
      const analysis=E.structuralMIRAnalysis(raw);
      const keyInfo=E.analyzeKey(raw);
      const tabs=E.getTablatureConfig(analysis);
      const guitarVoiceCount=tabs.filter(v=>v.instrument==='guitar').length;
      document.getElementById('analysis-output').innerHTML=`
        <h3>MIR Analyticvm Report</h3>
        <p><strong>Primary Tonal Center:</strong> ${keyInfo.key} ${keyInfo.type} <span style="opacity:.6">(r=${keyInfo.r})</span></p>
        <p><strong>Detected Voices:</strong> ${analysis.voiceIds.length} &nbsp;·&nbsp; <strong>Guitar-tab Voices:</strong> ${guitarVoiceCount}</p>`;

      const lexicon=document.getElementById('chord-overview');
      lexicon.innerHTML='';
      const chords=analysis.chords.length?analysis.chords.slice(0,20):['C','G','D','Am','Em'];
      chords.forEach(c=>{
        const card=document.createElement('div'); card.className='chord-card';
        card.innerHTML=generateChordSVG(c); lexicon.appendChild(card);
      });

      document.getElementById('output-wrapper').classList.add('visible');
      document.getElementById('toggle-btn').style.display='block';
      document.getElementById('pdf-btn').style.display='block';
      const mobile=window.matchMedia('(max-width: 720px)').matches;
      const config={responsive:'resize',staffwidth:mobile?680:950,add_classes:true,
        wrap:{minSpacing:1.5,maxSpacing:2.7,preferredMeasuresPerLine:mobile?2:4}};
      if(renderMode==='tab') config.tablature=tabs;
      const result=window.ABCJS.renderAbc('sheet-music',raw,config);
      if(!result||!result.length) throw new Error('ABCJS could not render this input.');
      document.getElementById('output-wrapper').scrollIntoView({behavior:'smooth',block:'start'});
    }catch(err){
      console.error(err); showMessage(`Render error: ${err.message||'invalid ABC notation'}`,true);
    }
  }

  function initialiseRendering(){
    if(typeof window.ABCJS==='undefined'){
      showMessage('Notation engine did not load. Check your connection and reload.',true); return;
    }
    renderMode='standard'; processAndRender();
  }

  function toggleNotation(){
    renderMode=renderMode==='tab'?'standard':'tab';
    document.getElementById('toggle-btn').textContent=renderMode==='tab'?'View Standard Score':'View Guitar Tablature';
    processAndRender();
  }

  async function exportToPDF(){
    const svg=document.querySelector('#sheet-music svg');
    if(!svg||!window.jspdf?.jsPDF){showMessage('Render a score before exporting.',true);return;}
    showMessage('Preparing paginated PDF…');
    try{
      const {jsPDF}=window.jspdf; const doc=new jsPDF('p','mm','a4');
      const clone=svg.cloneNode(true); clone.setAttribute('xmlns','http://www.w3.org/2000/svg');
      const blob=new Blob([new XMLSerializer().serializeToString(clone)],{type:'image/svg+xml;charset=utf-8'});
      const url=URL.createObjectURL(blob); const img=new Image();
      await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=reject;img.src=url;});
      const vb=svg.viewBox?.baseVal;
      const sourceWidth=vb?.width||svg.getBoundingClientRect().width||1000;
      const sourceHeight=vb?.height||svg.getBoundingClientRect().height||800;
      const targetWidth=Math.min(1800,Math.max(900,Math.round(sourceWidth*1.5)));
      const scale=targetWidth/sourceWidth,pageWidthMm=190,pageHeightMm=277;
      const sourceSliceHeight=sourceWidth*pageHeightMm/pageWidthMm;
      let page=0;
      for(let sourceY=0;sourceY<sourceHeight;sourceY+=sourceSliceHeight){
        const sourceH=Math.min(sourceSliceHeight,sourceHeight-sourceY);
        const slice=document.createElement('canvas');
        slice.width=targetWidth; slice.height=Math.max(1,Math.round(sourceH*scale));
        const ctx=slice.getContext('2d',{alpha:false});
        ctx.fillStyle='#e8dfc8'; ctx.fillRect(0,0,slice.width,slice.height);
        ctx.drawImage(img,0,sourceY,sourceWidth,sourceH,0,0,slice.width,slice.height);
        if(page>0) doc.addPage();
        const hMm=pageWidthMm*slice.height/slice.width;
        doc.addImage(slice.toDataURL('image/jpeg',.9),'JPEG',10,10,pageWidthMm,hMm,undefined,'FAST');
        page++;
      }
      URL.revokeObjectURL(url); doc.save('Chiaroscuro-Gothica-Score.pdf');
      showMessage(`PDF exported (${page} page${page===1?'':'s'}).`);
    }catch(err){console.error(err);showMessage('PDF export failed on this device.',true);}
  }

  window.initialiseRendering=initialiseRendering;
  window.toggleNotation=toggleNotation;
  window.exportToPDF=exportToPDF;

  const saved=localStorage.getItem(STORAGE_KEY); if(saved) input.value=saved;
  input.addEventListener('input',()=>{
    clearTimeout(input.saveTimer);
    input.saveTimer=setTimeout(()=>localStorage.setItem(STORAGE_KEY,input.value),250);
  });
  window.addEventListener('resize',()=>{
    clearTimeout(window.__rerenderTimer);
    window.__rerenderTimer=setTimeout(()=>{
      if(document.getElementById('output-wrapper').classList.contains('visible')) processAndRender();
    },250);
  });
  if('serviceWorker' in navigator&&location.protocol.startsWith('http')){
    window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(console.warn));
  }
})();
