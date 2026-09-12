(() => {
  'use strict';

  const pitchClassMap={c:0,'^c':1,_d:1,d:2,'^d':3,_e:3,e:4,f:5,'^f':6,_g:6,g:7,'^g':8,_a:8,a:9,'^a':10,_b:10,b:11};
  const pitchNames=['C','C#','D','Eb','E','F','F#','G','Ab','A','Bb','B'];
  const majorProfile=[6.35,2.23,3.48,2.33,4.38,4.09,2.52,5.19,2.39,3.66,2.29,2.88];
  const minorProfile=[6.33,2.68,3.52,5.38,2.60,3.53,2.54,4.75,3.98,2.69,3.34,3.17];

  const tunings={
    standard:{label:'Standard · E A D G B E',notes:['E,','A,','D','G','B','e']},
    dropD:{label:'Drop D · D A D G B E',notes:['D,','A,','D','G','B','e']},
    dadgad:{label:'DADGAD · D A D G A D',notes:['D,','A,','D','G','A','d']},
    openG:{label:'Open G · D G D G B D',notes:['D,','G,','D','G','B','d']},
    openD:{label:'Open D · D A D F# A D',notes:['D,','A,','D','^F','A','d']},
    halfDown:{label:'Half-step down · Eb Ab Db Gb Bb Eb',notes:['_E,','_A,','_D','_G','_B','_e']}
  };

  const chordLib={
    C:[null,3,2,0,1,0],Cm:[null,3,5,5,4,3],C7:[null,3,2,3,1,0],Cmaj7:[null,3,2,0,0,0],Cm7:[null,3,5,3,4,3],
    D:[null,null,0,2,3,2],Dm:[null,null,0,2,3,1],D7:[null,null,0,2,1,2],Dm7:[null,null,0,2,1,1],Dmaj7:[null,null,0,2,2,2],
    E:[0,2,2,1,0,0],Em:[0,2,2,0,0,0],E7:[0,2,0,1,0,0],Em7:[0,2,0,0,0,0],Emaj7:[0,2,1,1,0,0],
    F:[1,3,3,2,1,1],Fm:[1,3,3,1,1,1],Fmaj7:[null,null,3,2,1,0],F7:[1,3,1,2,1,1],Fm7:[1,3,1,1,1,1],
    G:[3,2,0,0,0,3],Gm:[3,5,5,3,3,3],G7:[3,2,0,0,0,1],Gmaj7:[3,null,0,0,0,2],Gm7:[3,5,3,3,3,3],
    A:[null,0,2,2,2,0],Am:[null,0,2,2,1,0],A7:[null,0,2,0,2,0],Am7:[null,0,2,0,1,0],Amaj7:[null,0,2,1,2,0],
    B:[null,2,4,4,4,2],Bm:[null,2,4,4,3,2],B7:[null,2,1,2,0,2],Bm7:[null,2,4,2,3,2],Bm7b5:[null,2,3,2,3,null]
  };

  function pitchClassForToken(token){return pitchClassMap[token.toLowerCase().replace('=','')];}
  function cleanMusicText(text){return text.replace(/%.*/g,'').replace(/"[^"]*"/g,'').replace(/![^!]*!/g,'').replace(/\[[Vv]:[^\]]+\]/g,'').replace(/\{[^}]*\}/g,'');}
  function extractPitchClasses(text){const m=cleanMusicText(text).match(/([\^_=]?[a-gA-G])/g)||[];return m.map(pitchClassForToken).filter(v=>v!==undefined);}
  function countNotes(text){return (cleanMusicText(text).match(/([\^_=]?[a-gA-G])([,']*)/g)||[]).length;}
  function pearson(x,y){const n=x.length;let sx=0,sy=0,sxy=0,sx2=0,sy2=0;for(let i=0;i<n;i++){sx+=x[i];sy+=y[i];sxy+=x[i]*y[i];sx2+=x[i]*x[i];sy2+=y[i]*y[i];}const num=n*sxy-sx*sy;const den=Math.sqrt((n*sx2-sx*sx)*(n*sy2-sy*sy));return den===0?0:num/den;}
  function shiftProfile(profile,shift){return Array.from({length:12},(_,i)=>profile[(i-shift+12)%12]);}

  function analyzeKey(abc){
    const profile=new Array(12).fill(0);
    abc.split('\n').forEach(line=>{const t=line.trim();if(!t||t.startsWith('%')||/^[A-Za-z]:/.test(t))return;extractPitchClasses(t).forEach(pc=>profile[pc]++);});
    if(profile.every(v=>v===0))return{key:'Unknown',type:'',index:0,r:'0.000',alternatives:[]};
    const candidates=[];
    for(let i=0;i<12;i++){candidates.push({key:pitchNames[i],type:'Major',index:i,r:pearson(profile,shiftProfile(majorProfile,i))});candidates.push({key:pitchNames[i],type:'Minor',index:i,r:pearson(profile,shiftProfile(minorProfile,i))});}
    candidates.sort((a,b)=>b.r-a.r);const best=candidates[0];
    return{key:best.key,type:best.type,index:best.index,r:best.r.toFixed(3),alternatives:candidates.slice(0,3).map(c=>({...c,r:c.r.toFixed(3)})),profile};
  }

  function deduceChordFromSlice(pcs){
    const unique=[...new Set(pcs)];if(unique.length<3)return null;
    const templates=[{s:'maj7',i:[0,4,7,11]},{s:'m7',i:[0,3,7,10]},{s:'7',i:[0,4,7,10]},{s:'m7b5',i:[0,3,6,10]},{s:'dim',i:[0,3,6]},{s:'m',i:[0,3,7]},{s:'',i:[0,4,7]}];
    let best=null;
    for(let root=0;root<12;root++){const ints=unique.map(p=>(p-root+12)%12);for(const tpl of templates){if(!tpl.i.every(i=>ints.includes(i)))continue;const extras=ints.filter(i=>!tpl.i.includes(i)).length;const score=tpl.i.length*10-extras-(ints.includes(0)?0:5);if(!best||score>best.score)best={score,name:pitchNames[root]+tpl.s};}}
    return best?.name||null;
  }

  function structuralMIRAnalysis(raw){
    const lines=raw.split('\n'),voiceOrder=[],voiceMeta={},voiceBodies={};let currentVoiceId=null;
    lines.forEach(line=>{const t=line.trim();const vm=t.match(/^V:\s*(\S+)/);if(vm){const id=vm[1];currentVoiceId=id;if(!voiceOrder.includes(id))voiceOrder.push(id);const prev=voiceMeta[id]||{name:`Voice ${id}`,clef:'treble'};voiceMeta[id]={name:t.match(/(?:name|nm)="([^"]+)"/)?.[1]||prev.name,clef:t.match(/clef=([\w+-]+)/)?.[1]||prev.clef};voiceBodies[id]||=[];return;}if(currentVoiceId&&t&&!t.startsWith('%')&&!/^[A-Za-z]:/.test(t))voiceBodies[currentVoiceId].push(t);});
    if(!voiceOrder.length){voiceOrder.push('1');voiceMeta['1']={name:'Guitar',clef:'treble'};voiceBodies['1']=lines.filter(line=>{const t=line.trim();return t&&!t.startsWith('%')&&!/^[A-Za-z]:/.test(t);});}
    const measureSets={};let maxMeasures=0,totalNotes=0;
    voiceOrder.forEach(id=>{const body=(voiceBodies[id]||[]).join(' ');totalNotes+=countNotes(body);const measures=body.split(/\|+/).map(m=>m.trim()).filter(Boolean);measureSets[id]=measures;maxMeasures=Math.max(maxMeasures,measures.length);});
    const progression=[],chords=[];
    for(let i=0;i<maxMeasures;i++){const pcs=[];voiceOrder.forEach(id=>{if(measureSets[id][i])pcs.push(...extractPitchClasses(measureSets[id][i]));});const chord=deduceChordFromSlice(pcs);progression.push({measure:i+1,chord:chord||'—',pitchClasses:[...new Set(pcs)].sort((a,b)=>a-b)});if(chord&&!chords.includes(chord))chords.push(chord);}
    return{abc:raw,chords,progression,voiceIds:voiceOrder,voiceMeta,stats:{measures:maxMeasures,notes:totalNotes,voices:voiceOrder.length}};
  }

  function parseCustomTuning(value){if(!value)return null;const parts=value.trim().split(/[\s,;]+/).filter(Boolean);return parts.length===6?parts:null;}
  function getTablatureConfig(analysis,opts={}){
    const tuning=opts.customTuning||tunings[opts.tuningKey||'standard']?.notes||tunings.standard.notes;
    const capo=Math.max(0,Math.min(12,Number(opts.capo)||0));
    return analysis.voiceIds.map(id=>{const meta=analysis.voiceMeta[id]||{name:'',clef:''};const d=`${meta.name} ${meta.clef}`.toLowerCase();if(/drum|perc|synth|pad|bass/.test(d)&&!/guitar/.test(d))return{instrument:''};if(/guitar/.test(d)||analysis.voiceIds.length===1&&!/perc/.test(d))return{instrument:'guitar',tuning,capo,label:`${meta.name} · %T${capo?` · capo ${capo}`:''}`,highestNote:"b'"};return{instrument:''};});
  }
  function transposeChordName(name,semitones){if(!name||name==='—'||!semitones)return name;const m=name.match(/^([A-G])([#b]?)(.*)$/);if(!m)return name;const lookup={C:0,'C#':1,Db:1,D:2,'D#':3,Eb:3,E:4,F:5,'F#':6,Gb:6,G:7,'G#':8,Ab:8,A:9,'A#':10,Bb:10,B:11};const pc=lookup[m[1]+m[2]];if(pc===undefined)return name;return pitchNames[(pc+Number(semitones)+120)%12]+m[3];}
  function meta(raw){const get=(tag,def='')=>raw.match(new RegExp(`^${tag}:\\s*(.+)$`,'mi'))?.[1]?.trim()||def;const q=get('Q','');const bpm=Number(q.match(/=(\d+(?:\.\d+)?)/)?.[1]||q.match(/(\d+(?:\.\d+)?)/)?.[1]||120);return{title:get('T','Untitled'),meter:get('M','4/4'),tempo:Number.isFinite(bpm)?bpm:120,keyHeader:get('K','')};}

  window.GothicaEngine={analyzeKey,structuralMIRAnalysis,getTablatureConfig,transposeChordName,parseCustomTuning,meta,tunings,chordLib};
})();
