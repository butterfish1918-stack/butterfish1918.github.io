function randomiseAll() {
            // Randomise the stochastic engine itself first so the chosen distribution drives the rest.
            const pickSelect = (id) => { const el=document.getElementById(id); if(!el || !el.options.length) return null; el.selectedIndex=Math.floor(distRandom()*el.options.length); return el.value; };
            currentRandomness = pickSelect('randomnessSelect') || currentRandomness; resetRandomnessState();
            currentStructure = pickSelect('structureSelect') || currentStructure;
            currentVibe = pickSelect('vibeSelect') || currentVibe;
            currentMoodKey = pickSelect('moodSelect') || currentMoodKey;
            currentDecade = pickSelect('decadeSelect') || currentDecade;
            const auto=document.getElementById('autoEvolveToggle'); if(auto){ auto.checked=distRandom()>.45; isAutoEvolve=auto.checked; }
            evolveInterval = 4 * (1 + Math.floor(distRandom()*32));
            document.getElementById('evolveInterval').value=evolveInterval; document.getElementById('evolveDisp').textContent=evolveInterval;
            globalMutationRate = Math.max(.01, Math.min(.8, distRandom()*.45)); document.getElementById('mutationRate').value=globalMutationRate;
            globalPitchVar = distRandom(); document.getElementById('randPitchVar').value=globalPitchVar;
            applyVibe(currentVibe); applyMood(currentMoodKey); applyDecadePhysics(currentDecade);

            // 1. Tuning
            const tuningOpts = document.getElementById('tuningSelect').options;
            document.getElementById('tuningSelect').selectedIndex = Math.floor(distRandom() * tuningOpts.length);
            applyTuningSystem();

            // 2. Philosophy
            const philOpts = document.getElementById('globalModeSelect').options;
            document.getElementById('globalModeSelect').selectedIndex = Math.floor(distRandom() * philOpts.length);
            currentPhilosophy = document.getElementById('globalModeSelect').value;

            // 3. Genre (Style Macro)
            const genreOpts = document.getElementById('genreSelect').options;
            document.getElementById('genreSelect').selectedIndex = Math.floor(distRandom() * genreOpts.length);
            populateSubGenres();

            // 4. Sub-Genre
            const subOpts = document.getElementById('subGenreSelect').options;
            document.getElementById('subGenreSelect').selectedIndex = Math.floor(distRandom() * subOpts.length);
            applyMacro();

            // 5. Master Sound
            const soundOpts = document.getElementById('masterSoundSelect').options;
            document.getElementById('masterSoundSelect').selectedIndex = Math.floor(distRandom() * soundOpts.length);
            applyMasteringProfile();

            // 6. Temperament
            const tempOpts = document.getElementById('tempSelect').options;
            document.getElementById('tempSelect').selectedIndex = Math.floor(distRandom() * tempOpts.length);
            currentTemperament = document.getElementById('tempSelect').value;

            // 7. Rhythm
            const rhythmOpts = document.getElementById('rhythmStyleSelect').options;
            document.getElementById('rhythmStyleSelect').selectedIndex = Math.floor(distRandom() * rhythmOpts.length);
            applyRhythmStyle();

            // 8. Root & Scale (dependent on tuning)
            const rootOpts = document.getElementById('rootSelect').options;
            document.getElementById('rootSelect').selectedIndex = Math.floor(distRandom() * rootOpts.length);
            currentRoot = document.getElementById('rootSelect').value;

            const scaleOpts = document.getElementById('scaleSelect').options;
            document.getElementById('scaleSelect').selectedIndex = Math.floor(distRandom() * scaleOpts.length);
            currentScale = document.getElementById('scaleSelect').value;
            
            // 9. Randomize Instrument Parameters & Presence (New Logic) - Using distRandom() for everything
            
            // --- NEW: Tempo & Mood Stochastic Randomization ---
            // Overriding the deterministic Genre defaults with stochastic values
            tempo = Math.floor(40 + distRandom() * 180); // Range 40-220
            mood = Math.floor(distRandom() * 100);       // Range 0-100
            
            // Update UI for Tempo/Mood
            document.getElementById('tempoSlider').value = tempo; 
            document.getElementById('tempoDisp').textContent = tempo;
            if (isPlaying) { clearInterval(beatInterval); beatInterval = setInterval(stepScheduler, (60 / tempo / 4) * 1000); }

            document.getElementById('moodSlider').value = mood; 
            document.getElementById('moodDisp').textContent = mood;

            instList.forEach(t => {
                // Randomize Presence using distRandom
                partPresence[t] = distRandom() * 2.0; // 0 to 2
                
                // Randomize Performance Arrays using distRandom
                for(let k=0; k<128; k++) {
                    partPerformance[t][k].vel = distRandom();
                    partPerformance[t][k].timbre = distRandom();
                    partPerformance[t][k].jitter = distRandom();
                }

                // Randomize Synth Parameters using distRandom
                const p = synthParams[t];
                // Wave
                const waves = ['sine', 'square', 'sawtooth', 'triangle', 'noise'];
                p.wave = waves[Math.floor(distRandom() * waves.length)];
                // ADSR (Keep range usable)
                p.a = distRandom() * 0.5 + 0.001;
                p.d = distRandom() * 1.0 + 0.01;
                p.s = distRandom() * 1.0;
                p.r = distRandom() * 2.0 + 0.01;
                // Cutoff (if exists)
                if(p.cutoff !== undefined) p.cutoff = 50 + distRandom() * 5000;
            });
            
            // Refresh Mixer UI to show new Presence slider positions
            buildMixerRows();
            
            // Update UI for current track if edit panel is open (re-render)
            const gridArea = document.getElementById('perfGridArea');
            if(gridArea && gridArea.hasChildNodes() && document.getElementById('perfInstrumentTitle').textContent.includes('SYNTHESIS')) {
                openSynthSettings(currentEditTrack);
            }

            // 10. Instruments Patterns (Sequences)
            instList.forEach(t => {
                if(t === 'drums') return; // Handled by rhythm style
                for(let i=0; i<128; i++) {
                     // Generation Logic using mood density from matrix (which we kept)
                     if(distRandom() < (mood/250)) {
                         const sources = { western: westernScales, arab: arabMaqams, ottoman: ottomanMakams, persian: persianDastgahs, hindustani: hindustaniRaags, carnatic: carnaticRaags, gamelan: gamelanPathets, byzantine: byzantineModes };
                         const sc = (sources[tuningSystem] || westernScales)[currentScale] || [0];
                         const noteIdx = Math.floor(distRandom() * sc.length);
                         
                         let lbl = "";
                         if (tuningSystem === 'western' || tuningSystem === 'hindustani' || tuningSystem === 'carnatic' || tuningSystem === 'gamelan') {
                             lbl = noteNames[noteIdx] + "4";
                         } else {
                             lbl = `Q${noteIdx}`;
                         }
                         
                         partSequences[t][i] = `${t.charAt(0).toUpperCase()+t.slice(1)}:${lbl}`;
                     } else {
                         partSequences[t][i] = null;
                     }
                }
            });
            
            buildPalette();
            buildSequencerGrid();
            scheduleSave();
            showToast('SYSTEM RANDOMISED // PATTERN STORED');
        }

        // --- NEW EVOLVE LOGIC ---
        function evolveSequence() {
            // 1. Mutate Drums
            if(distRandom() < globalMutationRate) {
                const r = Math.floor(distRandom()*8); // row
                const s = Math.floor(distRandom()*16); // step (in first 16 for relevance)
                drumMatrix[r][s] = !drumMatrix[r][s];
            }

            // 2. Mutate Synths
            const sources = { western: westernScales, arab: arabMaqams, ottoman: ottomanMakams, persian: persianDastgahs, hindustani: hindustaniRaags, carnatic: carnaticRaags, gamelan: gamelanPathets, byzantine: byzantineModes };
            const sc = (sources[tuningSystem] || westernScales)[currentScale]||[0];

            instList.forEach(t => {
                if(t === 'drums') return;
                for(let i=0; i<128; i++) {
                    if(distRandom() < (globalMutationRate * 0.05)) { // Low rate to preserve structure
                        if(partSequences[t][i]) {
                            // Kill or Mutate Pitch
                            if(distRandom() < 0.3) partSequences[t][i] = null; // Death
                            else if(distRandom() < globalPitchVar) {
                                // Shift Pitch
                                const newNoteIdx = Math.floor(distRandom()*sc.length);
                                let l = (tuningSystem==='western')?noteNames[(newNoteIdx)%12]+"4":`Q${newNoteIdx}`;
                                partSequences[t][i] = `${t.charAt(0).toUpperCase()+t.slice(1)}:${l}`;
                            }
                        } else if (distRandom() < (mood/1500)) { 
                            // Birth
                            const newNoteIdx = Math.floor(distRandom()*sc.length);
                            let l = (tuningSystem==='western')?noteNames[(newNoteIdx)%12]+"4":`Q${newNoteIdx}`;
                            partSequences[t][i] = `${t.charAt(0).toUpperCase()+t.slice(1)}:${l}`;
                        }
                    }
                }
            });
            buildSequencerGrid();
        }
