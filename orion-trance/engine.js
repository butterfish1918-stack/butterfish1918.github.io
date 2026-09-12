// --- AUDIO GRAPH ---
        function ensureAudioContext() {
            if(audio && audio.state !== 'closed') return audio;
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if(!AudioCtx) {
                ui.status.innerText = 'AUDIO UNSUPPORTED';
                return null;
            }
            audio = new AudioCtx({ latencyHint: 'interactive' });
            master = audio.createGain(); master.gain.value = 0.18; master.connect(audio.destination);
            pulseGain = audio.createGain(); pulseGain.gain.value = 0; pulseGain.connect(master);
            return audio;
        }

        function createNoise(type) {
             const size = 2 * audio.sampleRate;
             const buf = audio.createBuffer(1, size, audio.sampleRate);
             const d = buf.getChannelData(0);
             if(type.includes('pink') || type==='rain') {
                let b=[0,0,0,0,0,0,0];
                for(let i=0; i<size; i++) {
                    let w = Math.random()*2-1;
                    b[0] = 0.99886*b[0] + w*0.0555179; b[1] = 0.99332*b[1] + w*0.0750312;
                    b[2] = 0.96900*b[2] + w*0.1538520; b[3] = 0.86650*b[3] + w*0.3104856;
                    b[4] = 0.55000*b[4] + w*0.5329522; b[5] = -0.7616*b[5] - w*0.0168980;
                    d[i] = (b[0]+b[1]+b[2]+b[3]+b[4]+b[5]+b[6] + w*0.5362) * 0.11; b[6] = w*0.115926;
                }
             } else if(type==='brown') {
                 let last=0; for(let i=0; i<size; i++) { let w = Math.random()*2-1; d[i] = (last+(0.02*w))/1.02; last=d[i]; d[i]*=3.5; }
             } else {
                 for(let i=0; i<size; i++) d[i] = Math.random()*2-1;
             }
             
             let src = audio.createBufferSource(); src.buffer = buf; src.loop = true;
             let chain = src;
             
             if(type==='lpf-pink' || type==='rain') {
                 let f=audio.createBiquadFilter(); f.type='lowpass'; f.frequency.value=type==='rain'?800:200; src.connect(f); chain=f;
             } else if(type==='reverb') {
                 let f=audio.createBiquadFilter(); f.type='highpass'; f.frequency.value=1000; src.connect(f); chain=f;
             }
             
             let g = audio.createGain(); g.gain.value = 0.035; 
             chain.connect(g); 
             
             // If Noise Gate, connect to pulseGain to be driven by LFO
             if (state.prog.engine === 'noise-gate') {
                 g.connect(pulseGain);
             } else {
                 g.connect(master); 
             }
             src.start();
             noiseNodes.push(src, g);
        }

        function setupEngine(p) {
            let eng = p.engine;
            if(oscL) { try{oscL.stop();}catch(e){} oscL.disconnect(); }
            if(oscR) { try{oscR.stop();}catch(e){} oscR.disconnect(); }
            shepardNodes.forEach(n => { try{n.osc.stop();}catch(e){} n.g.disconnect(); }); shepardNodes=[];
            chordNodes.forEach(n => { try{n.stop();}catch(e){} try{n.disconnect();}catch(e){} }); chordNodes=[];
            auxNodes.forEach(n => { try{n.stop?.();}catch(e){} try{n.disconnect?.();}catch(e){} }); auxNodes=[];
            noiseNodes=[];

            if(eng === 'binaural' || eng === 'coma' || eng === 'hgh' || eng === 'confusion') {
                oscL = audio.createOscillator(); oscR = audio.createOscillator();
                let pL = audio.createStereoPanner ? audio.createStereoPanner() : audio.createPanner();
                let pR = audio.createStereoPanner ? audio.createStereoPanner() : audio.createPanner();
                if(pL.pan) { pL.pan.value=-1; pR.pan.value=1; }
                const gL=audio.createGain(), gR=audio.createGain(); gL.gain.value=0.07; gR.gain.value=0.07; oscL.connect(pL); pL.connect(gL); gL.connect(master); oscR.connect(pR); pR.connect(gR); gR.connect(master); auxNodes.push(gL,gR);
                oscL.start(); oscR.start();
            }
            else if(eng === 'isochronic' || eng === 'anaesthesia' || eng === 'reset' || eng === 'sniper' || eng === 'schumann' || eng === 'heartbeat' || eng === 'vagal' || eng === 'gamma-burst' || eng === 'random-hop' || eng === 'lucid-protocol') {
                oscL = audio.createOscillator(); oscL.type = eng==='anaesthesia'?'sine':'sine';
                if(eng==='heartbeat') oscL.frequency.value=60;
                oscL.connect(pulseGain); oscL.start();
            }
            else if(eng === 'noise-gate') {
                // LFO to drive pulseGain for the noise
                oscL = audio.createOscillator();
                oscL.frequency.value = 0.1; // 10s sweep
                oscL.type = 'sine';
                // we don't connect oscL to audio, just use its time to modulate in render loop
            }
            else if(eng === 'polymeter') {
                const freqs = [110, 165, 220];
                freqs.forEach((f, i) => {
                    const o = audio.createOscillator(); const g = audio.createGain();
                    o.type = i === 0 ? 'sine' : 'triangle'; o.frequency.value = f;
                    g.gain.value = 0.025; o.connect(g); g.connect(master); o.start();
                    auxNodes.push(o, g);
                });
            }
            else if(eng === 'distorted') {
                oscL = audio.createOscillator(); oscL.type='sawtooth';
                let dist = audio.createWaveShaper(); let curve=new Float32Array(44100);
                for(let i=0;i<44100;++i) { let x=i*2/44100-1; curve[i]=(3+20)*x*20*(Math.PI/180)/(Math.PI+20*Math.abs(x)); }
                dist.curve=curve; oscL.connect(dist); dist.connect(pulseGain); oscL.start();
            }
            else if(eng === 'shepard') {
                [220,440,880].forEach(f => {
                    let o=audio.createOscillator(); let g=audio.createGain();
                    o.frequency.value=f; o.connect(g); g.connect(master); o.start();
                    shepardNodes.push({osc:o, g:g, baseFreq:f});
                });
            }
            else if(eng.includes('chords')) {
                const root=146.83; const r=eng==='chords-major'?[1,1.25,1.5,2]:[1,1.2,1.5,1.875];
                r.forEach(x => {
                    let o=audio.createOscillator(); let g=audio.createGain();
                    o.frequency.value=root*x; o.type='triangle'; g.gain.value=0.05;
                    o.connect(g); g.connect(master); o.start(); chordNodes.push(o);
                });
            }
            else if(eng === 'tone-963') {
                oscL=audio.createOscillator(); oscL.frequency.value=963; const g=audio.createGain(); g.gain.value=0.06; oscL.connect(g); g.connect(master); oscL.start(); auxNodes.push(g);
            }
            else if(eng === 'phase-cancel') {
                 oscL = audio.createOscillator(); oscR = audio.createOscillator();
                 let pL = audio.createStereoPanner ? audio.createStereoPanner() : audio.createPanner();
                 let pR = audio.createStereoPanner ? audio.createStereoPanner() : audio.createPanner();
                 if(pL.pan) { pL.pan.value=-1; pR.pan.value=1; }
                 oscL.frequency.value=200; oscR.frequency.value=204;
                 const gL=audio.createGain(), gR=audio.createGain(); gL.gain.value=0.06; gR.gain.value=0.06; oscL.connect(pL); pL.connect(gL); gL.connect(master); oscR.connect(pR); pR.connect(gR); gR.connect(master); auxNodes.push(gL,gR);
                 oscL.start(); oscR.start();
            }
            else if(eng === 'drone') {
                oscL=audio.createOscillator(); oscL.frequency.value=100; const g=audio.createGain(); g.gain.value=0.08; oscL.connect(g); g.connect(master); oscL.start(); auxNodes.push(g);
            }
            else if(eng === 'granular') {
                for(let i=0;i<4;i++) {
                    let o=audio.createOscillator(); let g=audio.createGain();
                    o.frequency.value=100+i*5; o.type='triangle'; g.gain.value=0.05;
                    o.connect(g); g.connect(master); o.start(); chordNodes.push(o);
                }
            }
             else if(eng === 'monaural') {
                oscL=audio.createOscillator(); oscR=audio.createOscillator();
                const g=audio.createGain(); g.gain.value=0.08;
                oscL.connect(g); oscR.connect(g); g.connect(master); oscL.start(); oscR.start(); auxNodes.push(g);
            }
             else if(eng === 'spectral') {
                oscL=audio.createOscillator();
                const g=audio.createGain(); g.gain.value=0.08;
                oscL.connect(g); g.connect(master); oscL.start(); auxNodes.push(g);
            }
        }

        