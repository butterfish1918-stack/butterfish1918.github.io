function playSynth(p,f,d,v,t) {
            if(!audioCtx || !isFinite(f)) return;
            const sp=synthParams[p];
            const perf = partPerformance[p][currentBeat % 128];
            const g = audioCtx.createGain();
            g.connect(masterCompressor);

            // Apply Clock Jitter / Randomness to timing
            let jitter = 0;
            if(currentRandomness === 'jitter') jitter = (distRandom() - 0.5) * 0.05;
            else if(currentRandomness === 'quantum') jitter = (distRandom() - 0.5) * 0.01; // Tiny irreducible
            
            const startT = t + jitter;

            // Apply Thermal Noise to Filter (if applicable)
            if(currentRandomness === 'thermal' && masterFilter) {
                masterFilter.frequency.setValueAtTime(masterFilter.frequency.value + (distRandom()-0.5)*50, t);
            }

            if (p === 'singing') {
                if (sp.mode === 'choir') {
                    [0, -3, 3].forEach(det => {
                        const osc = audioCtx.createOscillator(); osc.type = 'sawtooth'; osc.frequency.setValueAtTime(f, startT); osc.detune.setValueAtTime(det + (perf.jitter * 10), startT);
                        const fil = audioCtx.createBiquadFilter(); fil.type = 'lowpass'; fil.frequency.setValueAtTime(1200 + (perf.timbre * 2000), startT);
                        osc.connect(fil); fil.connect(g); osc.start(startT); osc.stop(startT+d+parseFloat(sp.r));
                    });
                } else {
                    const osc = audioCtx.createOscillator(); osc.type = 'sawtooth'; osc.frequency.setValueAtTime(f, startT);
                    const vwl = formants[sp.phoneme];
                    const f1 = audioCtx.createBiquadFilter(); f1.type = 'bandpass'; f1.frequency.value = vwl.f1; f1.Q.value = 10;
                    const f2 = audioCtx.createBiquadFilter(); f2.type = 'bandpass'; f2.frequency.value = vwl.f2; f2.Q.value = 10;
                    osc.connect(f1); f1.connect(g); osc.connect(f2); f2.connect(g);
                    osc.start(startT); osc.stop(startT+d+parseFloat(sp.r));
                }
            } else {
                const osc=audioCtx.createOscillator();
                const requestedWave = sp.wave;
                osc.type = requestedWave === 'noise' ? 'sawtooth' : requestedWave;
                osc.frequency.setValueAtTime(f,startT);
                
                // RESTORE BASE SOUND FILTER LOGIC
                // (sp.cutoff||2000)+(perf.timbre*1500)
                const cutoff = (sp.cutoff || 2000) + (perf.timbre * 1500);
                const fil=audioCtx.createBiquadFilter(); fil.type='lowpass'; fil.frequency.setValueAtTime(cutoff,startT);
                
                osc.connect(fil); fil.connect(g); osc.start(startT + (perf.jitter * 0.05)); osc.stop(startT+d+parseFloat(sp.r)+0.1);
            }

            g.gain.setValueAtTime(0,startT); g.gain.linearRampToValueAtTime(v*perf.vel,startT+parseFloat(sp.a)); g.gain.exponentialRampToValueAtTime(0.001,startT+d+parseFloat(sp.r));
        }

        // --- FIXED DRUM LOGIC ---
        function playDrums(idx, t) { 
            if(!audioCtx) return; 
            const g=audioCtx.createGain(); 
            g.connect(masterCompressor); 
            
            // Map 8 indices to the 3 base sounds (Kick, Snare, Hat) with variations
            // 0: Kick, 1: Snare, 2: Hat, 3: Tom L, 4: Tom H, 5: Clap, 6: Cowbell, 7: Noise
            
            if (idx === 0 || idx === 3 || idx === 4) { // KICK & TOMS
                const freq = idx === 0 ? 150 : (idx === 3 ? 300 : 500); // Pitch shift
                const decay = idx === 0 ? 0.4 : 0.2;
                const o=audioCtx.createOscillator(); 
                o.frequency.setValueAtTime(freq, t); 
                o.frequency.exponentialRampToValueAtTime(40, t+0.1); 
                g.gain.setValueAtTime(1,t); 
                g.gain.exponentialRampToValueAtTime(0.001,t+decay); 
                o.connect(g); o.start(t); o.stop(t+decay); 
            } else if (idx === 1 || idx === 5) { // SNARE & CLAP
                const decay = idx === 1 ? 0.1 : 0.05; // Clap is shorter
                const n=audioCtx.createBufferSource(); 
                const b=audioCtx.createBuffer(1,audioCtx.sampleRate*decay,audioCtx.sampleRate); 
                const d=b.getChannelData(0); 
                for(let i=0;i<d.length;i++) d[i]=Math.random()*2-1; 
                n.buffer=b; 
                g.gain.setValueAtTime(0.4,t); 
                g.gain.exponentialRampToValueAtTime(0.001,t+decay); 
                n.connect(g); n.start(t); 
            } else { // HIHAT, COWBELL, NOISE (High Freq Osc)
                const freq = idx === 6 ? 800 : (idx === 7 ? 5000 : 8000); // Cowbell lower, Noise mid
                const type = idx === 6 ? 'square' : 'sine'; // Cowbell square
                const decay = 0.05;
                const o=audioCtx.createOscillator(); 
                o.type = type;
                o.frequency.value=freq; 
                g.gain.setValueAtTime(0.1,t); 
                g.gain.exponentialRampToValueAtTime(0.001,t+decay); 
                o.connect(g); o.start(t); o.stop(t+decay); 
            }
        }

        function stepScheduler() {
            if(!isPlaying || !audioCtx) return; const now=audioCtx.currentTime; const bl=60/tempo/4;
            const si = currentBeat % currentLoopMax;
            const currentRowIndex = Math.floor(si / 8);
            
            // IF MANUAL SEQUENCER MODE: Respect row toggles
            if(playbackMode === 'sequencer' && !activeRows[currentRowIndex]) { currentBeat++; return; }
            
            // Manage Song Structure
            manageStructure();

            // Check Auto Evolve
            if (isAutoEvolve && currentBeat > 0 && currentBeat % evolveInterval === 0) {
                evolveSequence();
            }

            document.querySelectorAll('.step-btn').forEach(b => b.classList.remove('current'));
            const currentStepEl = document.getElementById(`step-${si}`);
            if (currentStepEl) currentStepEl.classList.add('current');

            // --- FIXED DRUM LOOP ---
            drumMatrix.forEach((row, dIdx) => {
                // Apply presence slider for drums as probability gate
                if(row[si] && activeParts.drums && distRandom() < partPresence['drums']) playDrums(dIdx, now);
            });

            const sources = { western: westernScales, arab: arabMaqams, ottoman: ottomanMakams, persian: persianDastgahs, hindustani: hindustaniRaags, carnatic: carnaticRaags, gamelan: gamelanPathets, byzantine: byzantineModes };
            const sc = (sources[tuningSystem] || westernScales)[currentScale]||[0]; const cleanNoteRoot = currentRoot.match(/\(([^)]+)\)/)?.[1] || currentRoot.split(' ')[0];
            const rootFreq = roots[cleanNoteRoot] || 261.63;
            
            // Determine divisor for generative logic
            let divisor = 12;
            if (tuningSystem === 'arab' || tuningSystem === 'persian') divisor = 24;
            else if (tuningSystem === 'ottoman') divisor = 53;
            else if (tuningSystem === 'byzantine') divisor = 72;

            instList.forEach(t => {
                if (!activeParts[t] || t === 'drums') return;
                const data = partSequences[t]?.[si];
                
                // --- CHORD SEQUENCER LOGIC ---
                if (data && t === 'chords') {
                    // NEW CHORD PARSING LOGIC
                    if (data.includes('|')) { // New Format: RootIndex|Type
                         const parts = data.split(':')[1].split('|');
                         const rootIdx = parseInt(parts[0]);
                         const type = parts[1];
                         const offsets = chordDefinitions[type] || [0, 4, 7]; // Default Maj
                         
                         offsets.forEach(semi => {
                             // Convert semitone offset to tuning system steps
                             const stepOffset = Math.round(semi * (divisor / 12));
                             const totalStep = rootIdx + stepOffset;
                             const f = rootFreq * Math.pow(2, totalStep / divisor);
                             playSynth('chords', f, bl*16, 0.05, now);
                         });
                    }
                    else if (data.includes('Deg')) { // Legacy/Scale degree logic
                        const degree = parseInt(data.split(':')[1].replace('Deg', ''));
                        [0, 2, 4].forEach(offset => {
                            const noteIndex = sc[(degree + offset) % sc.length];
                            const f = rootFreq * Math.pow(2, noteIndex / divisor);
                            playSynth('chords', f, bl*16, 0.05, now);
                        });
                    }
                } 
                else if (data) {
                    // Manual Note Sequence
                    playSynth(t, getTunedFreq(data.split(':')[1]), bl, 0.15, now);
                }
                else if (playbackMode === 'generative') {
                    // Generative Logic
                    const density = mood / 100;
                    const bias = vibeBiases[t] || 1;
                    // Apply Presence Slider Multiplier (0.0 - 2.0)
                    const presence = partPresence[t] || 1.0;
                    
                    if (t === 'lead' && distRandom() < (density * bias * presence)) playSynth('lead', rootFreq * Math.pow(2, sc[Math.floor(distRandom()*sc.length)]/divisor), bl*2, 0.1, now);
                    else if (t === 'bass' && si % 8 === 0 && distRandom() < (bias * presence)) playSynth('bass', rootFreq / 2, bl*8, 0.2, now);
                    else if (t === 'brass' && si % 16 === 0 && distRandom() < (density * bias * presence)) playSynth('brass', rootFreq * (distRandom() < 0.5 ? 1 : 1.5), bl*4, 0.15, now);
                    else if (t === 'strings' && si % 16 === 0 && distRandom() < (bias * presence)) playSynth('strings', rootFreq * (distRandom() < 0.5 ? 0.5 : 1), bl*16, 0.1, now);
                    else if (t === 'pluck' && distRandom() < (density * 0.7 * bias * presence)) playSynth('pluck', rootFreq * Math.pow(2, sc[Math.floor(distRandom()*sc.length)]/divisor) * 2, bl, 0.12, now);
                    else if (t === 'chords' && si % 32 === 0 && distRandom() < (bias * presence)) [0, 2, 4].forEach(off => playSynth('chords', rootFreq * Math.pow(2, (sc[off]||0)/divisor), bl*16, 0.05, now));
                    else if (t === 'drone' && si % 64 === 0 && distRandom() < (bias * presence)) playSynth('drone', rootFreq / 4, bl*32, 0.08, now);
                    else if (t === 'singing' && distRandom() < (density * 0.3 * bias * presence)) playSynth('singing', rootFreq * Math.pow(2, sc[Math.floor(distRandom()*sc.length)]/divisor), bl*4, 0.15, now);
                }
            });
            document.getElementById('beatDisp').textContent = si; currentBeat++;
        }
