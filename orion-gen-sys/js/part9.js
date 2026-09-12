// --- MOBILE/PWA / PROJECT / MIDI HELPERS ---
        const SAVE_KEY = 'orion-gen-sys-v3';
        const LEGACY_SAVE_KEYS = ['orion-gen-sys-v1','orion-mobile-v2'];
        let saveTimer = null, toastTimer=null;
        function showToast(msg) { const el=document.getElementById('toast'); if(!el) return; el.textContent=msg; el.classList.add('show'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.classList.remove('show'),2200); }
        function scheduleSave() { clearTimeout(saveTimer); saveTimer = setTimeout(saveState, 120); }
        function uiValue(id,fallback=null){ const e=document.getElementById(id); return e ? (e.type==='checkbox'?e.checked:e.value) : fallback; }
        function getStateSnapshot() {
            return {
                _meta:{format:'ORION-GEN-SYS',version:3,savedAt:new Date().toISOString()},
                tempo,mood,tuningSystem,currentRoot,currentScale,currentTemperament,playbackMode,currentPhilosophy,currentEditTrack,currentStampValue,currentDrumVoice,currentChordRootIndex,currentChordType,
                currentStructure,currentRandomness,currentMoodKey,currentVibe,currentDecade,currentMasterSound,currentGenre,currentSubGenre,currentRhythmStyle,
                evolveInterval,isAutoEvolve,globalMutationRate,globalPitchVar,vibeBiases,partPresence,synthParams,partSequences,partPerformance,drumMatrix,activeParts,activeRows,
                ui:{genre:uiValue('genreSelect',currentGenre),subGenre:uiValue('subGenreSelect',currentSubGenre),masterSound:uiValue('masterSoundSelect',currentMasterSound),rhythmStyle:uiValue('rhythmStyleSelect',currentRhythmStyle),moodKey:uiValue('moodSelect',currentMoodKey),vibe:uiValue('vibeSelect',currentVibe),decade:uiValue('decadeSelect',currentDecade)}
            };
        }
        function saveState() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(getStateSnapshot())); } catch (e) { console.warn('State save failed', e); } }
        function applyStateObject(st) {
            if(!st || typeof st!=='object') return false;
            // Migrate the earlier compact mobile build if that is the only saved state on the device.
            if(st.tuning && st.tuningSystem===undefined) tuningSystem=String(st.tuning).toLowerCase();
            if(st.root && st.currentRoot===undefined) currentRoot=st.root;
            if(st.scale && st.currentScale===undefined) currentScale=st.scale;
            if(st.density!==undefined && st.mood===undefined) mood=+st.density;
            if(st.genre && st.currentGenre===undefined) currentGenre=st.genre;
            if(st.sub && st.currentSubGenre===undefined) currentSubGenre=st.sub;
            if(st.mode && st.playbackMode===undefined) playbackMode=st.mode;
            if(st.track && st.currentEditTrack===undefined) currentEditTrack=st.track==='vox'?'singing':st.track;
            if(st.mutation!==undefined && st.globalMutationRate===undefined) globalMutationRate=+st.mutation;
            if(st.pitch!==undefined && st.globalPitchVar===undefined) globalPitchVar=+st.pitch;
            if(st.active){ for(const [k,v] of Object.entries(st.active)){ const key=k==='vox'?'singing':k; if(key in activeParts) activeParts[key]=!!v; } }
            if(st.presence){ for(const [k,v] of Object.entries(st.presence)){ const key=k==='vox'?'singing':k; if(key in partPresence) partPresence[key]=+v; } }
            if(st.seq && !st.partSequences){
                for(const [k,arr] of Object.entries(st.seq)){ const key=k==='vox'?'singing':k; if(key==='drums'){ const dm={KICK:0,SNARE:1,HAT:2,CLAP:5,TOM:3,NOISE:7}; (arr||[]).forEach((v,i)=>{if(v&&dm[v]!==undefined) drumMatrix[dm[v]][i]=true;}); }
                    else if(partSequences[key] && Array.isArray(arr)) partSequences[key]=arr.map(v=>v?(String(v).includes(':')?String(v):`${key.charAt(0).toUpperCase()+key.slice(1)}:${v}`):null);
                }
            }
            // Explicit assignments are used so global `let` bindings are restored correctly.
            if(st.tempo!==undefined) tempo=+st.tempo; if(st.mood!==undefined) mood=+st.mood;
            if(st.tuningSystem!==undefined) tuningSystem=st.tuningSystem; if(st.currentRoot!==undefined) currentRoot=st.currentRoot; if(st.currentScale!==undefined) currentScale=st.currentScale;
            if(st.currentTemperament!==undefined) currentTemperament=st.currentTemperament; if(st.playbackMode!==undefined) playbackMode=st.playbackMode; if(st.currentPhilosophy!==undefined) currentPhilosophy=st.currentPhilosophy;
            if(st.currentEditTrack!==undefined) currentEditTrack=st.currentEditTrack; if(st.currentStampValue!==undefined) currentStampValue=st.currentStampValue; if(st.currentDrumVoice!==undefined) currentDrumVoice=+st.currentDrumVoice;
            if(st.currentChordRootIndex!==undefined) currentChordRootIndex=+st.currentChordRootIndex; if(st.currentChordType!==undefined) currentChordType=st.currentChordType;
            if(st.currentStructure!==undefined) currentStructure=st.currentStructure; if(st.currentRandomness!==undefined) currentRandomness=st.currentRandomness;
            currentMoodKey=st.currentMoodKey ?? st.ui?.moodKey ?? currentMoodKey; currentVibe=st.currentVibe ?? st.ui?.vibe ?? currentVibe; currentDecade=st.currentDecade ?? st.ui?.decade ?? currentDecade;
            currentMasterSound=st.currentMasterSound ?? st.ui?.masterSound ?? currentMasterSound; currentGenre=st.currentGenre ?? st.ui?.genre ?? currentGenre; currentSubGenre=st.currentSubGenre ?? st.ui?.subGenre ?? currentSubGenre; currentRhythmStyle=st.currentRhythmStyle ?? st.ui?.rhythmStyle ?? currentRhythmStyle;
            if(st.evolveInterval!==undefined) evolveInterval=+st.evolveInterval; if(st.isAutoEvolve!==undefined) isAutoEvolve=!!st.isAutoEvolve; if(st.globalMutationRate!==undefined) globalMutationRate=+st.globalMutationRate; if(st.globalPitchVar!==undefined) globalPitchVar=+st.globalPitchVar;
            if(st.vibeBiases) vibeBiases=st.vibeBiases; if(st.partPresence) partPresence=st.partPresence; if(st.synthParams) synthParams=st.synthParams; if(st.partSequences) partSequences=st.partSequences;
            if(st.partPerformance) partPerformance=st.partPerformance; if(st.drumMatrix) drumMatrix=st.drumMatrix; if(st.activeParts) activeParts=st.activeParts; if(st.activeRows) activeRows=st.activeRows;
            return true;
        }
        function restoreState() {
            try {
                let raw=localStorage.getItem(SAVE_KEY);
                if(!raw){ for(const k of LEGACY_SAVE_KEYS){raw=localStorage.getItem(k); if(raw) break;} }
                if(raw) applyStateObject(JSON.parse(raw));
            } catch(e){ console.warn('State restore failed',e); }
        }
        function downloadBlob(blob,filename){ const url=URL.createObjectURL(blob),a=document.createElement('a'); a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500); }
        function projectFilename(ext='orion.json'){ const d=new Date(),p=n=>String(n).padStart(2,'0'); return `orion-${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}.${ext}`; }
        function downloadProject(){ saveState(); const json=JSON.stringify(getStateSnapshot(),null,2); downloadBlob(new Blob([json],{type:'application/json'}),projectFilename('orion.json')); showToast('PROJECT SAVED // JSON DOWNLOADED'); }
        async function loadProjectFile(file){ try{ const txt=await file.text(),st=JSON.parse(txt); const payload=st.state||st; if(!payload || (!payload.partSequences && !payload.drumMatrix)) throw new Error('Not an Orion project'); localStorage.setItem(SAVE_KEY,JSON.stringify(payload)); showToast('PROJECT LOADED // RESTARTING'); setTimeout(()=>location.reload(),350); }catch(e){ console.error(e); showToast('LOAD FAILED // INVALID PROJECT'); } }
        function midiVarLen(v){ v=Math.max(0,Math.floor(v)); let buffer=v&0x7f,out=[]; while((v>>=7)){buffer<<=8;buffer|=((v&0x7f)|0x80);} while(true){out.push(buffer&0xff); if(buffer&0x80)buffer>>=8; else break;} return out; }
        function midiChunk(id,data){ const b=[...new TextEncoder().encode(id)],n=data.length; return [...b,(n>>>24)&255,(n>>>16)&255,(n>>>8)&255,n&255,...data]; }
        function midiTrack(name,events,channel,program=0){
            const data=[]; const push=(delta,bytes)=>data.push(...midiVarLen(delta),...bytes);
            const nameBytes=[...new TextEncoder().encode(name)]; push(0,[0xff,0x03,nameBytes.length,...nameBytes]);
            if(channel!==9) push(0,[0xc0|channel,program&0x7f]);
            events.sort((a,b)=>a.tick-b.tick||(a.order||0)-(b.order||0)); let last=0;
            for(const e of events){push(e.tick-last,e.bytes);last=e.tick;}
            push(0,[0xff,0x2f,0x00]); return midiChunk('MTrk',data);
        }
        function freqToMidi(f){ return Math.max(0,Math.min(127,Math.round(69+12*Math.log2(f/440)))); }
        function patternFreq(label){ try{return getTunedFreq(label);}catch{return 261.63;} }
        function exportMidi(){
            const PPQ=480,STEP=PPQ/4,totalSteps=128,tracks=[];
            const tempoTrack=[]; const mpqn=Math.round(60000000/Math.max(1,tempo)); tempoTrack.push(0,0xff,0x51,0x03,(mpqn>>16)&255,(mpqn>>8)&255,mpqn&255,0,0xff,0x58,0x04,0x04,0x02,0x18,0x08,0,0xff,0x2f,0); tracks.push(midiChunk('MTrk',tempoTrack));
            const durSteps={lead:2,bass:8,brass:4,strings:16,pluck:1,chords:16,drone:32,singing:4};
            const chan={lead:0,bass:1,brass:2,strings:3,pluck:4,chords:5,drone:6,singing:7}; const prog={lead:81,bass:38,brass:61,strings:49,pluck:24,chords:89,drone:95,singing:52};
            const divisor=tuningSystem==='arab'||tuningSystem==='persian'?24:tuningSystem==='ottoman'?53:tuningSystem==='byzantine'?72:12;
            const cleanRoot=currentRoot.match(/\(([^)]+)\)/)?.[1]||currentRoot.split(' ')[0],rootFreq=roots[cleanRoot]||261.63;
            const sourceMap={western:westernScales,arab:arabMaqams,ottoman:ottomanMakams,persian:persianDastgahs,hindustani:hindustaniRaags,carnatic:carnaticRaags,gamelan:gamelanPathets,byzantine:byzantineModes}; const sc=(sourceMap[tuningSystem]||westernScales)[currentScale]||[0];
            const drumEvents=[],drumMap=[36,38,42,45,50,39,56,46]; for(let d=0;d<8;d++) for(let i=0;i<totalSteps;i++) if(drumMatrix[d]?.[i]){const t=i*STEP,n=drumMap[d];drumEvents.push({tick:t,order:1,bytes:[0x99,n,105]},{tick:t+Math.max(20,STEP*.45),order:0,bytes:[0x89,n,0]});} if(drumEvents.length) tracks.push(midiTrack('DRUMS',drumEvents,9,0));
            for(const part of ['lead','bass','brass','strings','pluck','chords','drone','singing']){
                const ev=[]; for(let i=0;i<totalSteps;i++){const data=partSequences[part]?.[i]; if(!data)continue; const tick=i*STEP,dur=Math.max(30,(durSteps[part]||1)*STEP*.9),vel=Math.max(20,Math.min(127,Math.round((partPerformance[part]?.[i]?.vel??.8)*110)));
                    if(part==='chords'){
                        if(data.includes('|')){const [ri,typ]=data.split(':')[1].split('|'),offs=chordDefinitions[typ]||[0,4,7]; for(const semi of offs){const step=+ri+Math.round(semi*(divisor/12)),n=freqToMidi(rootFreq*Math.pow(2,step/divisor));ev.push({tick,order:1,bytes:[0x90|chan[part],n,vel]},{tick:tick+dur,order:0,bytes:[0x80|chan[part],n,0]});}}
                        else if(data.includes('Deg')){const degree=parseInt(data.split(':')[1].replace('Deg','')); for(const off of [0,2,4]){const step=sc[(degree+off)%sc.length]||0,n=freqToMidi(rootFreq*Math.pow(2,step/divisor));ev.push({tick,order:1,bytes:[0x90|chan[part],n,vel]},{tick:tick+dur,order:0,bytes:[0x80|chan[part],n,0]});}}
                    } else {const label=data.split(':')[1],n=freqToMidi(patternFreq(label));ev.push({tick,order:1,bytes:[0x90|chan[part],n,vel]},{tick:tick+dur,order:0,bytes:[0x80|chan[part],n,0]});}
                } if(ev.length) tracks.push(midiTrack(part.toUpperCase(),ev,chan[part],prog[part]));
            }
            if(tracks.length===1){showToast('MIDI EXPORT // NO PATTERN EVENTS');return;}
            const header=midiChunk('MThd',[0,1,(tracks.length>>8)&255,tracks.length&255,(PPQ>>8)&255,PPQ&255]); const bytes=new Uint8Array([...header,...tracks.flat()]); downloadBlob(new Blob([bytes],{type:'audio/midi'}),projectFilename('mid')); showToast('MIDI EXPORTED // '+(tracks.length-1)+' TRACKS');
        }
        async function ensureAudioRunning() { if (audioCtx && audioCtx.state === 'suspended') { try { await audioCtx.resume(); } catch {} } }
        let wakeLock = null;
        async function requestWakeLock() { try { if ('wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen'); } catch {} }
        async function releaseWakeLock() { try { if (wakeLock) await wakeLock.release(); } catch {} wakeLock = null; }
        window.addEventListener('pagehide', saveState);
        document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && isPlaying) { ensureAudioRunning(); requestWakeLock(); } });
        if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(console.warn));
        document.addEventListener('input', (e) => { if (e.target.matches('input,select')) scheduleSave(); }, {passive:true});
        document.addEventListener('change', scheduleSave, {passive:true});
        document.getElementById('saveProjectBtn').onclick=downloadProject;
        document.getElementById('loadProjectBtn').onclick=()=>document.getElementById('projectFileInput').click();
        document.getElementById('projectFileInput').onchange=e=>{const f=e.target.files?.[0];if(f)loadProjectFile(f);e.target.value='';};
        document.getElementById('exportMidiBtn').onclick=exportMidi;
        document.getElementById('randomiseBtnMobile').onclick=randomiseAll;

        document.getElementById('toggleBtn').onclick = async () => {
            if(isPlaying) { isPlaying=false; clearInterval(beatInterval); await releaseWakeLock(); if(audioCtx) await audioCtx.close(); audioCtx=null; document.getElementById('toggleBtn').textContent="INITIATE SEQUENCE"; document.getElementById('toggleBtn').classList.remove('playing'); saveState(); }
            else {
                audioCtx=new (window.AudioContext||window.webkitAudioContext)();
                await ensureAudioRunning();
                await requestWakeLock();
                masterCompressor = audioCtx.createDynamicsCompressor();
                masterFilter = audioCtx.createBiquadFilter();
                masterCompressor.connect(masterFilter); masterFilter.connect(audioCtx.destination);
                isPlaying=true; beatInterval=setInterval(stepScheduler,(60/tempo/4)*1000);
                document.getElementById('toggleBtn').textContent="TERMINATE SEQUENCE";
                document.getElementById('toggleBtn').classList.add('playing');
                { const savedTempo=tempo,savedMood=mood; applyMasteringProfile(); applyVibe(currentVibe); applyMood(currentMoodKey); applyDecadePhysics(currentDecade); tempo=savedTempo; mood=savedMood; document.getElementById('tempoSlider').value=tempo; document.getElementById('tempoDisp').textContent=tempo; document.getElementById('moodSlider').value=mood; document.getElementById('moodDisp').textContent=mood; }
            }
        };
