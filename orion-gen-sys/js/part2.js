function buildMixerRows() {
            if(!mixerFront) return; mixerFront.innerHTML = '';
            instList.forEach(part => {
                const container = document.createElement('div'); container.className = 'part-row-container';
                const row = document.createElement('div');
                row.className = 'part-row' + (activeParts[part]?' active':'');
                row.id = `row-${part}`;
                row.onclick = (e) => { if(e.target.tagName !== 'BUTTON' && e.target.tagName !== 'INPUT') togglePart(part); };

                const led = document.createElement('div'); led.className = 'led-indicator';
                const label = document.createElement('span'); label.textContent = part.toUpperCase(); 
                
                // Presence Slider
                const slider = document.createElement('input');
                slider.type = 'range';
                slider.min = 0; slider.max = 2; slider.step = 0.1;
                slider.value = partPresence[part];
                slider.className = 'presence-slider';
                slider.title = "Presence / Density";
                slider.onclick = (e) => e.stopPropagation(); // Prevent row toggle
                slider.oninput = (e) => { partPresence[part] = parseFloat(e.target.value); };

                const flip = document.createElement('button'); flip.className = 'row-action-btn'; flip.textContent = '⇅ PERF';
                flip.onclick = (e) => { e.stopPropagation(); openPerformanceMatrix(part); };
                const edit = document.createElement('button'); edit.className = 'row-action-btn'; edit.textContent = 'Ξ EDIT';
                edit.onclick = (e) => { e.stopPropagation(); openSynthSettings(part); };
                
                row.appendChild(led); row.appendChild(label); row.appendChild(slider); row.appendChild(flip); row.appendChild(edit);
                mixerFront.appendChild(row);
            });
        }

        function openPerformanceMatrix(part) {
            currentEditTrack = part;
            const gridArea = document.getElementById('perfGridArea');
            if(!gridArea) return;
            document.getElementById('perfInstrumentTitle').textContent = `${part.toUpperCase()} PERFORMANCE CALIBRATION`;
            
            // Revert layout if coming from edit mode
            gridArea.innerHTML = '';
            
            ["VELOCITY", "TIMBRE", "JITTER"].forEach(param => {
                const row = document.createElement('div'); row.className = 'perf-row';
                const lbl = document.createElement('span'); lbl.className = 'perf-label'; lbl.textContent = param; row.appendChild(lbl);
                const mtx = document.createElement('div'); mtx.className = 'perf-matrix';
                const valKey = param === 'VELOCITY' ? 'vel' : param === 'TIMBRE' ? 'timbre' : 'jitter';
                
                for(let s=0; s<16; s++) {
                    const bar = document.createElement('div'); bar.className = 'perf-bar';
                    const fill = document.createElement('div'); fill.className = 'perf-fill';
                    if(param === 'TIMBRE') fill.classList.add('timbre');
                    if(param === 'JITTER') fill.classList.add('jitter');
                    fill.style.height = (partPerformance[part][s][valKey] * 100) + "%";
                    
                    const handleInput = (e) => {
                        if(e.type === 'pointermove' && e.buttons !== 1 && e.pressure === 0) return;
                        const rect = bar.getBoundingClientRect();
                        let v = 1 - ((e.clientY - rect.top) / rect.height);
                        v = Math.max(0, Math.min(1, v));
                        partPerformance[part][s][valKey] = v; fill.style.height = (v * 100) + "%";
                    };
                    bar.onpointerdown = handleInput;
                    bar.onpointermove = handleInput;
                    bar.appendChild(fill); mtx.appendChild(bar);
                }
                row.appendChild(mtx); gridArea.appendChild(row);
            });
            globalCard.classList.add('flipped');
        }

        // --- NEW FUNCTION: OPEN SYNTH SETTINGS (EDIT MODE) ---
        function openSynthSettings(part) {
            currentEditTrack = part;
            setEditTrack(part); // Update sequencer focus

            const gridArea = document.getElementById('perfGridArea');
            const headerTitle = document.getElementById('perfInstrumentTitle');
            if(!gridArea) return;

            headerTitle.textContent = `${part.toUpperCase()} // SYNTHESIS PARAMETERS`;
            gridArea.innerHTML = ''; // Clear previous content

            const params = synthParams[part];

            // Helper to create slider
            const createSlider = (label, key, min, max, step) => {
                const div = document.createElement('div');
                div.style.display = 'flex';
                div.style.justifyContent = 'space-between';
                div.style.alignItems = 'center';
                div.style.marginBottom = '5px';
                
                const lbl = document.createElement('label');
                lbl.textContent = `${label}: ${params[key]}`;
                lbl.style.width = '80px';
                lbl.style.fontSize = '5px';
                
                const sl = document.createElement('input');
                sl.type = 'range';
                sl.min = min; sl.max = max; sl.step = step;
                sl.value = params[key];
                sl.style.flex = '1';
                sl.className = 'presence-slider'; // Reuse style
                
                sl.oninput = (e) => {
                    params[key] = parseFloat(e.target.value);
                    lbl.textContent = `${label}: ${params[key].toFixed(3)}`;
                };
                
                div.appendChild(lbl);
                div.appendChild(sl);
                return div;
            };

            // Waveform Selector
            const waveDiv = document.createElement('div');
            waveDiv.style.marginBottom = '10px';
            const waveLbl = document.createElement('label'); waveLbl.textContent = "WAVEFORM";
            const waveSel = document.createElement('select');
            ['sine', 'square', 'sawtooth', 'triangle', 'noise'].forEach(w => {
                waveSel.add(new Option(w.toUpperCase(), w, false, w === params.wave));
            });
            waveSel.onchange = (e) => params.wave = e.target.value;
            waveDiv.appendChild(waveLbl); waveDiv.appendChild(waveSel);
            gridArea.appendChild(waveDiv);

            // ADSR Sliders
            gridArea.appendChild(createSlider('ATTACK', 'a', 0.001, 1.0, 0.01));
            gridArea.appendChild(createSlider('DECAY', 'd', 0.01, 2.0, 0.01));
            gridArea.appendChild(createSlider('SUSTAIN', 's', 0, 1.0, 0.01));
            gridArea.appendChild(createSlider('RELEASE', 'r', 0.01, 3.0, 0.01));

            // Filter Cutoff (if applicable)
            if (params.cutoff !== undefined || ['brass', 'strings', 'pluck'].includes(part)) {
                if(params.cutoff === undefined) params.cutoff = 2000; // Default if missing
                gridArea.appendChild(createSlider('CUTOFF', 'cutoff', 50, 10000, 50));
            }

            // Singing Specific
            if (part === 'singing') {
                const modeDiv = document.createElement('div');
                modeDiv.style.marginTop = '10px';
                const modeLbl = document.createElement('label'); modeLbl.textContent = "VOCAL MODE";
                const modeSel = document.createElement('select');
                ['choir', 'voice'].forEach(m => modeSel.add(new Option(m.toUpperCase(), m, false, m === params.mode)));
                modeSel.onchange = (e) => params.mode = e.target.value;
                modeDiv.appendChild(modeLbl); modeDiv.appendChild(modeSel);
                gridArea.appendChild(modeDiv);

                const phoneDiv = document.createElement('div');
                phoneDiv.style.marginTop = '5px';
                const phoneLbl = document.createElement('label'); phoneLbl.textContent = "PHONEME";
                const phoneSel = document.createElement('select');
                Object.keys(formants).forEach(p => phoneSel.add(new Option(p.toUpperCase(), p, false, p === params.phoneme)));
                phoneSel.onchange = (e) => params.phoneme = e.target.value;
                phoneDiv.appendChild(phoneLbl); phoneDiv.appendChild(phoneSel);
                gridArea.appendChild(phoneDiv);
            }

            globalCard.classList.add('flipped');
        }

        function flipMixerCard() { globalCard.classList.remove('flipped'); scheduleSave(); }

        function applyTuningSystem() {
            if(!tuneSel) return;
            tuningSystem = tuneSel.value;
            const sources = { western: westernScales, arab: arabMaqams, ottoman: ottomanMakams, persian: persianDastgahs, hindustani: hindustaniRaags, carnatic: carnaticRaags, gamelan: gamelanPathets, byzantine: byzantineModes };
            const names = (tuningSystem === 'western') ? noteNames : (tuningSystem === 'arab' || tuningSystem === 'persian') ? ["Karar (C)", "Yakah (G)", "Hissar", "Doka (D)", "Sika", "Jaharka (F)", "Nawa (G)", "Hosayni (A)", "Ajam", "Kurd"] : (tuningSystem === 'ottoman') ? ["Rast (G)", "Dügâh (A)", "Segâh", "Çârgâh (C)", "Nevâ (D)", "Hüseynî", "Eviç", "Gerdâniye", "Buselik", "Beyati", "Mahur", "Buselik Asiran"] : ["Ni", "Pa", "Vu", "Ga", "Di", "Ke", "Zo"];
            const desiredRoot=currentRoot, desiredScale=currentScale;
            if(rootSel) {
                rootSel.innerHTML = ''; names.forEach(n => rootSel.add(new Option(n, n)));
                if(desiredRoot && names.includes(desiredRoot)) rootSel.value=desiredRoot;
                currentRoot = rootSel.value;
            }
            if(scaleSel) {
                scaleSel.innerHTML = ''; const src = sources[tuningSystem] || westernScales; const keys=Object.keys(src); keys.forEach(name => scaleSel.add(new Option(name, name)));
                if(desiredScale && keys.includes(desiredScale)) scaleSel.value=desiredScale;
                currentScale = scaleSel.value;
            }
            if(document.getElementById('rootLabel')) document.getElementById('rootLabel').textContent = (tuningSystem === 'western') ? "ROOT" : "KARAR/ROOT";
            buildPalette();
        }

        function buildPalette() {
            if(!palCont) return; palCont.innerHTML = '';
            
            // --- UPDATED DRUM PALETTE ---
            if(currentEditTrack === 'drums') { 
                drumNames.forEach((name, idx) => {
                    const b = document.createElement('div');
                    b.className = 'palette-btn' + (currentDrumVoice === idx ? ' active' : '');
                    b.textContent = name;
                    b.onclick = () => {
                        currentDrumVoice = idx;
                        buildPalette();
                        buildSequencerGrid();
                    };
                    palCont.appendChild(b);
                });
                return;
            }

            // --- FULL CHROMATIC PALETTE LOGIC ---
            // Determines steps per octave based on system
            let steps = 12;
            let labels = [];
            
            if (tuningSystem === 'western' || tuningSystem === 'hindustani' || tuningSystem === 'carnatic') {
                steps = 12;
                labels = noteNames;
            } else if (tuningSystem === 'arab' || tuningSystem === 'persian') {
                steps = 24;
            } else if (tuningSystem === 'ottoman') {
                steps = 53;
            } else if (tuningSystem === 'byzantine') {
                steps = 72;
            } else if (tuningSystem === 'gamelan') {
                steps = 12; // Approximation
            }

            if (currentEditTrack === 'chords') {
                // --- CHORD MATRIX: ROOT & TYPE ---
                
                // Section 1: Roots (All steps in tuning system)
                const rootContainer = document.createElement('div');
                rootContainer.className = 'palette-section';
                const rootTitle = document.createElement('div');
                rootTitle.className = 'palette-section-title';
                rootTitle.textContent = "ROOT PITCH";
                rootContainer.appendChild(rootTitle);
                
                const rootGrid = document.createElement('div');
                rootGrid.className = 'palette-grid';
                
                for(let i=0; i<steps; i++) {
                    let lbl = "";
                    if(steps === 12) lbl = noteNames[i];
                    else lbl = `Q${i}`; 

                    const b = document.createElement('div');
                    b.className = 'palette-btn' + (currentChordRootIndex === i ? ' active' : '');
                    b.textContent = lbl;
                    b.style.fontSize = "4px";
                    b.style.width = "20px";
                    b.onclick = () => {
                        currentChordRootIndex = i;
                        currentStampValue = `Chords:${i}|${currentChordType}`;
                        buildPalette(); // Re-render to update active state
                    };
                    rootGrid.appendChild(b);
                }
                rootContainer.appendChild(rootGrid);
                palCont.appendChild(rootContainer);

                // Section 2: Types
                const typeContainer = document.createElement('div');
                typeContainer.className = 'palette-section';
                const typeTitle = document.createElement('div');
                typeTitle.className = 'palette-section-title';
                typeTitle.textContent = "CHORD QUALITY";
                typeContainer.appendChild(typeTitle);

                const typeGrid = document.createElement('div');
                typeGrid.className = 'palette-grid';

                Object.keys(chordDefinitions).forEach(type => {
                    const b = document.createElement('div');
                    b.className = 'palette-btn' + (currentChordType === type ? ' active' : '');
                    b.textContent = type;
                    b.style.fontSize = "5px";
                    b.onclick = () => {
                        currentChordType = type;
                        currentStampValue = `Chords:${currentChordRootIndex}|${type}`;
                        buildPalette();
                    };
                    typeGrid.appendChild(b);
                });
                typeContainer.appendChild(typeGrid);
                palCont.appendChild(typeContainer);

            } else {
                // For other tracks, show FULL chromatic range
                for(let i=0; i<steps; i++) {
                    let lbl = "";
                    if(steps === 12) lbl = noteNames[i] + "4";
                    else lbl = `Q${i}`; // Q for Quantum/Quarter/Comma step

                    const b = document.createElement('div');
                    b.className = 'palette-btn note-btn' + (currentStampValue.split(':')[1]===lbl ? ' active' : '');
                    b.textContent = lbl;
                    b.style.width = "20px";
                    b.style.fontSize = "4px";
                    b.onclick = () => {
                        currentStampValue = `${currentEditTrack.charAt(0).toUpperCase()+currentEditTrack.slice(1)}:${lbl}`;
                        document.querySelectorAll('.note-btn').forEach(x => x.classList.remove('active')); b.classList.add('active');
                    };
                    palCont.appendChild(b);
                }
            }
        }
