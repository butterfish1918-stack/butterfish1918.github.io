(() => {
  'use strict';

  const pitchClassMap = {
    c:0, '^c':1, _d:1, d:2, '^d':3, _e:3, e:4,
    f:5, '^f':6, _g:6, g:7, '^g':8, _a:8, a:9,
    '^a':10, _b:10, b:11
  };
  const pitchNames = ['C','C#','D','Eb','E','F','F#','G','Ab','A','Bb','B'];
  const majorProfile = [6.35,2.23,3.48,2.33,4.38,4.09,2.52,5.19,2.39,3.66,2.29,2.88];
  const minorProfile = [6.33,2.68,3.52,5.38,2.60,3.53,2.54,4.75,3.98,2.69,3.34,3.17];

  const chordLib = {
    C:[null,3,2,0,1,0], Cm:[null,3,5,5,4,3], C7:[null,3,2,3,1,0], Cmaj7:[null,3,2,0,0,0],
    D:[null,null,0,2,3,2], Dm:[null,null,0,2,3,1], D7:[null,null,0,2,1,2], Dm7:[null,null,0,2,1,1],
    E:[0,2,2,1,0,0], Em:[0,2,2,0,0,0], E7:[0,2,0,1,0,0], Em7:[0,2,0,0,0,0],
    F:[1,3,3,2,1,1], Fm:[1,3,3,1,1,1], Fmaj7:[null,null,3,2,1,0], F7:[1,3,1,2,1,1],
    G:[3,2,0,0,0,3], Gm:[3,5,5,3,3,3], G7:[3,2,0,0,0,1], Gmaj7:[3,null,0,0,0,2],
    A:[null,0,2,2,2,0], Am:[null,0,2,2,1,0], A7:[null,0,2,0,2,0], Am7:[null,0,2,0,1,0],
    B:[null,2,4,4,4,2], Bm:[null,2,4,4,3,2], B7:[null,2,1,2,0,2], Bm7b5:[null,2,3,2,3,null]
  };

  function pitchClassForToken(token) {
    return pitchClassMap[token.toLowerCase().replace('=','')];
  }

  function extractPitchClasses(text) {
    const cleaned = text
      .replace(/%.*/g,'')
      .replace(/"[^"]*"/g,'')
      .replace(/![^!]*!/g,'')
      .replace(/\[[Vv]:[^\]]+\]/g,'');
    const matches = cleaned.match(/([\^_=]?[a-gA-G])/g) || [];
    return matches.map(pitchClassForToken).filter(v => v !== undefined);
  }

  function pearsonCorrelation(x,y) {
    const n=x.length;
    let sumX=0,sumY=0,sumXY=0,sumX2=0,sumY2=0;
    for(let i=0;i<n;i++){
      sumX+=x[i]; sumY+=y[i]; sumXY+=x[i]*y[i];
      sumX2+=x[i]*x[i]; sumY2+=y[i]*y[i];
    }
    const num=(n*sumXY)-(sumX*sumY);
    const den=Math.sqrt(((n*sumX2)-(sumX*sumX))*((n*sumY2)-(sumY*sumY)));
    return den===0?0:num/den;
  }

  function shiftProfile(profile,shiftBy){
    return Array.from({length:12},(_,i)=>profile[(i-shiftBy+12)%12]);
  }

  function analyzeKey(abc) {
    const profile=new Array(12).fill(0);
    abc.split('\n').forEach(line=>{
      const t=line.trim();
      if(!t||t.startsWith('%')||/^[A-Za-z]:/.test(t)) return;
      extractPitchClasses(t).forEach(pc=>profile[pc]++);
    });
    if(profile.every(v=>v===0)) return {key:'Unknown',type:'',index:0,r:'0.000'};
    let best=-2,key='Unknown',type='',keyIndex=0;
    for(let i=0;i<12;i++){
      const rMaj=pearsonCorrelation(profile,shiftProfile(majorProfile,i));
      if(rMaj>best){best=rMaj;key=pitchNames[i];type='Major';keyIndex=i;}
      const rMin=pearsonCorrelation(profile,shiftProfile(minorProfile,i));
      if(rMin>best){best=rMin;key=pitchNames[i];type='Minor';keyIndex=i;}
    }
    return {key,type,index:keyIndex,r:Number.isFinite(best)?best.toFixed(3):'0.000'};
  }

  function deduceChordFromSlice(pcs) {
    const unique=[...new Set(pcs)];
    if(unique.length<3) return null;
    const templates=[
      {suffix:'maj7',ints:[0,4,7,11]},
      {suffix:'m7',ints:[0,3,7,10]},
      {suffix:'7',ints:[0,4,7,10]},
      {suffix:'dim',ints:[0,3,6]},
      {suffix:'m',ints:[0,3,7]},
      {suffix:'',ints:[0,4,7]}
    ];
    let best=null;
    for(let root=0;root<12;root++){
      const intervals=unique.map(p=>(p-root+12)%12);
      for(const tpl of templates){
        if(!tpl.ints.every(i=>intervals.includes(i))) continue;
        const extras=intervals.filter(i=>!tpl.ints.includes(i)).length;
        const score=tpl.ints.length*10-extras;
        if(!best||score>best.score) best={score,name:pitchNames[root]+tpl.suffix};
      }
    }
    return best?best.name:null;
  }

  function structuralMIRAnalysis(raw) {
    const lines=raw.split('\n');
    const voiceOrder=[],voiceMeta={},voiceBodies={};
    let currentVoiceId=null;

    lines.forEach(line=>{
      const t=line.trim();
      const vm=t.match(/^V:\s*(\S+)/);
      if(vm){
        const id=vm[1]; currentVoiceId=id;
        if(!voiceOrder.includes(id)) voiceOrder.push(id);
        const previous=voiceMeta[id]||{name:`Voice ${id}`,clef:'treble'};
        const name=t.match(/(?:name|nm)="([^"]+)"/)?.[1]||previous.name;
        const clef=t.match(/clef=([\w+-]+)/)?.[1]||previous.clef;
        voiceMeta[id]={name,clef}; voiceBodies[id]||=[]; return;
      }
      if(currentVoiceId&&t&&!t.startsWith('%')&&!/^[A-Za-z]:/.test(t)) voiceBodies[currentVoiceId].push(t);
    });

    if(!voiceOrder.length){
      voiceOrder.push('1'); voiceMeta['1']={name:'Guitar',clef:'treble'};
      voiceBodies['1']=lines.filter(line=>{
        const t=line.trim();
        return t&&!t.startsWith('%')&&!/^[A-Za-z]:/.test(t);
      });
    }

    const measureSets={}; let maxMeasures=0;
    voiceOrder.forEach(id=>{
      const body=(voiceBodies[id]||[]).join(' ');
      const measures=body.split(/\|+/).map(m=>m.trim()).filter(Boolean);
      measureSets[id]=measures; maxMeasures=Math.max(maxMeasures,measures.length);
    });

    const chords=[];
    for(let i=0;i<maxMeasures;i++){
      const pcs=[];
      voiceOrder.forEach(id=>{ if(measureSets[id][i]) pcs.push(...extractPitchClasses(measureSets[id][i])); });
      const chord=deduceChordFromSlice(pcs);
      if(chord&&!chords.includes(chord)) chords.push(chord);
    }
    return {abc:raw,tabAbc:raw,chords,voiceIds:voiceOrder,voiceMeta};
  }

  function getTablatureConfig(analysis) {
    return analysis.voiceIds.map(id=>{
      const meta=analysis.voiceMeta[id]||{name:'',clef:''};
      const descriptor=`${meta.name} ${meta.clef}`.toLowerCase();
      if(/drum|perc|synth|pad|bass/.test(descriptor)&&!/guitar/.test(descriptor)) return {instrument:''};
      if(/guitar/.test(descriptor)) return {instrument:'guitar',highestNote:"b'"};
      if(analysis.voiceIds.length===1&&!/perc/.test(descriptor)) return {instrument:'guitar',highestNote:"b'"};
      return {instrument:''};
    });
  }

  window.GothicaEngine={analyzeKey,structuralMIRAnalysis,getTablatureConfig,chordLib};
})();
