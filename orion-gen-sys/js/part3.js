function buildSequencerGrid() {
            if(!seqArea) return; seqArea.innerHTML = '';
            const rows = 16; // ALWAYS 16 ROWS FOR 128 STEPS
            for (let r = 0; r < rows; r++) {
                const row = document.createElement('div'); row.className = 'seq-row-container';
                const master = document.createElement('div'); master.className = 'row-master-toggle' + (activeRows[r]?' active':'');
                
                // --- FIXED MASTER TOGGLE LABEL ---
                if (currentEditTrack === 'drums') {
                    master.textContent = `PAGE ${r+1}`;
                } else {
                    master.textContent = `R${r+1} ${activeRows[r]?'ON':'OFF'}`;
                }

                if(currentEditTrack !== 'drums') {
                    master.onclick = () => { activeRows[r] = !activeRows[r]; master.classList.toggle('active', activeRows[r]); master.textContent = `R${r+1} ${activeRows[r]?'ON':'OFF'}`; updateLoopLength();
            document.getElementById('tempoSlider').value = tempo; document.getElementById('tempoDisp').textContent = tempo;
            document.getElementById('moodSlider').value = mood; document.getElementById('moodDisp').textContent = mood;
            if (document.getElementById('playbackMode')) document.getElementById('playbackMode').value = playbackMode;
            if (document.getElementById('globalModeSelect')) document.getElementById('globalModeSelect').value = currentPhilosophy;
            if (document.getElementById('structureSelect')) document.getElementById('structureSelect').value = currentStructure;
            if (document.getElementById('randomnessSelect')) document.getElementById('randomnessSelect').value = currentRandomness;
            if (document.getElementById('evolveInterval')) document.getElementById('evolveInterval').value = evolveInterval;
            if (document.getElementById('evolveDisp')) document.getElementById('evolveDisp').textContent = evolveInterval;
            if (document.getElementById('autoEvolveToggle')) document.getElementById('autoEvolveToggle').checked = isAutoEvolve; };
                }
                row.appendChild(master);
                const grid = document.createElement('div'); grid.className = 'sequencer-grid-row';
                for (let s = 0; s < 8; s++) {
                    const idx = (r * 8) + s; const btn = document.createElement('div');
                    btn.id = `step-${idx}`;
                    
                    // --- AUTO SWITCH TO SEQUENCER MODE ON CLICK ---
                    const switchToSeq = () => {
                        if (playbackMode === 'generative') {
                            playbackMode = 'sequencer';
                            document.getElementById('playbackMode').value = 'sequencer';
                            document.getElementById('drumMatrixControls').style.display = 'block';
                        }
                    };

                    if(currentEditTrack === 'drums') {
                        // --- FIXED DRUM GRID LOGIC ---
                        // Use currentDrumVoice to select the row in drumMatrix
                        btn.className = 'step-btn' + (drumMatrix[currentDrumVoice][idx] ? ' drum-on' : '');
                        btn.onclick = () => { 
                            switchToSeq();
                            drumMatrix[currentDrumVoice][idx] = !drumMatrix[currentDrumVoice][idx]; 
                            btn.classList.toggle('drum-on', drumMatrix[currentDrumVoice][idx]); 
                        };
                    } else {
                        btn.className = 'step-btn' + (partSequences[currentEditTrack]?.[idx] ? ' on' : '');
                        
                        // Parse chord labels nicely
                        let txt = "";
                        if (partSequences[currentEditTrack]?.[idx]) {
                            let raw = partSequences[currentEditTrack][idx].split(':')[1];
                            if (currentEditTrack === 'chords' && raw.includes('|')) {
                                // New Chord Format: RootIndex|Type
                                const parts = raw.split('|');
                                const rootIdx = parseInt(parts[0]);
                                const type = parts[1];
                                
                                let rootName = "";
                                // Resolve root name based on tuning system logic
                                // (This mirrors the logic in buildPalette)
                                let steps = 12;
                                if (tuningSystem === 'western' || tuningSystem === 'hindustani' || tuningSystem === 'carnatic' || tuningSystem === 'gamelan') {
                                    rootName = noteNames[rootIdx] || "C";
                                } else {
                                    rootName = `Q${rootIdx}`;
                                }
                                txt = `${rootName}${type}`;
                            } else if (raw.startsWith("Deg")) {
                                const numerals = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII"];
                                const d = parseInt(raw.replace('Deg',''));
                                txt = numerals[d] || raw;
                            } else {
                                txt = raw;
                            }
                        }
                        btn.textContent = txt;
                        // Reduce font size for chord labels
                        if(currentEditTrack === 'chords') btn.style.fontSize = "3px"; else btn.style.fontSize = "4px";

                        btn.onclick = () => { 
                            switchToSeq();
                            if(partSequences[currentEditTrack][idx]) partSequences[currentEditTrack][idx] = null; 
                            else partSequences[currentEditTrack][idx] = currentStampValue; 
                            btn.classList.toggle('on', !!partSequences[currentEditTrack][idx]); 
                            
                            // Re-render text on click (copy paste logic essentially)
                            let t = "";
                            if (partSequences[currentEditTrack]?.[idx]) {
                                let r = partSequences[currentEditTrack][idx].split(':')[1];
                                if (currentEditTrack === 'chords' && r.includes('|')) {
                                    const ps = r.split('|');
                                    const ri = parseInt(ps[0]);
                                    const ty = ps[1];
                                    let rn = "";
                                    if (tuningSystem === 'western' || tuningSystem === 'hindustani' || tuningSystem === 'carnatic' || tuningSystem === 'gamelan') {
                                        rn = noteNames[ri] || "C";
                                    } else {
                                        rn = `Q${ri}`;
                                    }
                                    t = `${rn}${ty}`;
                                }
                                else if (r.startsWith("Deg")) {
                                    const ns = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII"];
                                    const d = parseInt(r.replace('Deg',''));
                                    t = ns[d] || r;
                                } else {
                                    t = r;
                                }
                            }
                            btn.textContent = t;
                        };
                    }
                    grid.appendChild(btn);
                }
                row.appendChild(grid); seqArea.appendChild(row);
            }
        }

        function togglePart(p) { activeParts[p] = !activeParts[p]; const row = document.getElementById(`row-${p}`); if(row) row.classList.toggle('active'); }
        function toggleSettingsOverlay() { const o = document.getElementById('settingsOverlay'); o.style.display = (o.style.display==='block')?'none':'block'; }
        
        function applyRhythmStyle() { if(!styleSel) return; const s = styleSel.value; currentRhythmStyle=s; const style = rhythmStyles[s]; if(!style) return; for(let d=0; d<8; d++) for(let step=0; step<128; step++) drumMatrix[d][step] = false; style.kick.forEach(i => { for(let j=0; j<8; j++) drumMatrix[0][i + j*16] = true; }); style.snare.forEach(i => { for(let j=0; j<8; j++) drumMatrix[1][i + j*16] = true; }); style.hat.forEach(i => { for(let j=0; j<8; j++) drumMatrix[2][i + j*16] = true; }); buildSequencerGrid(); }
        
        // --- FIXED SET EDIT TRACK ---
        function setEditTrack(t) { 
            currentEditTrack = t; 
            document.querySelectorAll('.track-tab').forEach(x => { 
                x.classList.remove('active'); 
                if(x.id === 'tab-' + t) x.classList.add('active'); 
            }); 
            buildPalette(); 
            buildSequencerGrid(); 
        }
        
        function populateSubGenres(apply=true) { if(!gSel || !subSel) return; const g = gSel.value; if (!g || !genreSystem[g]) return; currentGenre=g; const desired=currentSubGenre; subSel.innerHTML = ''; genreSystem[g].subs.forEach(s => subSel.add(new Option(s, s))); if(desired && genreSystem[g].subs.includes(desired)) subSel.value=desired; currentSubGenre=subSel.value; if(apply) applyMacro(); }
        function applyMacro() { if(!gSel) return; currentGenre=gSel.value; currentSubGenre=subSel?.value||currentSubGenre; const g = genreSystem[gSel.value]; if (!g) return; tempo = g.t; mood = g.mood; document.getElementById('tempoSlider').value = tempo; document.getElementById('tempoDisp').textContent = tempo; document.getElementById('moodSlider').value = mood; document.getElementById('moodDisp').textContent = mood; if (isPlaying) { clearInterval(beatInterval); beatInterval = setInterval(stepScheduler, (60 / tempo / 4) * 1000); } }
