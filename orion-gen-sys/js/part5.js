function manageStructure() {
            if(currentStructure === 'free') return; // Do nothing for free generation
            
            const bar = Math.floor(currentBeat / 16);
            let targetMood = parseInt(document.getElementById('moodSlider').value); // Base mood from UI
            
            // Logic for structures: Modulating Mood (Density) & Mutation
            switch(currentStructure) {
                case 'strophic': // Repeat the same density profile with very low mutation
                    globalMutationRate = Math.min(globalMutationRate, 0.02);
                    break;
                case 'verse_chorus': // ABAB (Verse low density, Chorus high)
                    if (bar % 8 < 4) targetMood -= 20; // A (Verse)
                    else targetMood += 20; // B (Chorus)
                    break;
                case 'aaba': // AABA (8 bars A, 8 bars A, 8 bars B, 8 bars A)
                    if (bar % 32 < 16) {} // A
                    else if (bar % 32 < 24) targetMood += 25; // B (Bridge)
                    else {} // A
                    break;
                case 'through': // Constant Evolution
                    if (currentBeat % 16 === 0) evolveSequence();
                    break;
                case 'ternary': // ABA
                    if (bar % 12 < 4) {} // A
                    else if (bar % 12 < 8) targetMood += 20; // B
                    else {} // A
                    break;
                case 'binary': // AB
                    if (bar % 8 < 4) targetMood -= 10; // A
                    else targetMood += 10; // B
                    break;
                case 'build_drop': // Build (3 bars), Drop (1 bar), Breakdown (4 bars)
                    if (bar % 8 < 3) targetMood += (bar%8)*10; // Build
                    else if (bar % 8 < 4) targetMood = 100; // Drop
                    else targetMood = 20; // Breakdown
                    break;
                case 'extended': // Intro (4), Main (8), Outro (4)
                    if (bar % 16 < 4) targetMood = 30;
                    else if (bar % 16 < 12) targetMood = 80;
                    else targetMood = 30;
                    break;
                case 'minimalist': // Locked state
                    globalMutationRate = 0.01;
                    break;
                case 'progressive': // Linear build over 32 bars
                    targetMood = ((bar % 32) / 32) * 100;
                    break;
            }

            // Clamp and Apply
            mood = Math.max(0, Math.min(100, targetMood));
            // Update display only visually if needed, but keeping UI slider static as "reference" is better
        }

        function updateLoopLength() { let maxActive = 0; for(let i=15; i>=0; i--) { if(activeRows[i]) { maxActive = (i + 1) * 8; break; } } currentLoopMax = maxActive || 8; }

        function applyMasteringProfile() {
            const profile = document.getElementById('masterSoundSelect')?.value || currentMasterSound;
            currentMasterSound=profile;
            if(!audioCtx || !masterCompressor || !masterFilter) return;
            switch(profile) {
                case 'edm': masterCompressor.threshold.value = -18; masterCompressor.ratio.value = 12; masterFilter.type = 'lowshelf'; masterFilter.frequency.value = 100; masterFilter.gain.value = 6; break;
                case 'lofi': masterCompressor.threshold.value = -10; masterCompressor.ratio.value = 4; masterFilter.type = 'highpass'; masterFilter.frequency.value = 300; break;
                case 'sheffield': masterCompressor.threshold.value = -24; masterCompressor.ratio.value = 20; masterFilter.type = 'peaking'; masterFilter.frequency.value = 2000; masterFilter.gain.value = 4; break;
                case 'cinematic': masterCompressor.threshold.value = -15; masterCompressor.ratio.value = 4; masterFilter.type = 'highshelf'; masterFilter.frequency.value = 4000; masterFilter.gain.value = 3; break;
                case 'vinyl': masterCompressor.threshold.value = -12; masterCompressor.ratio.value = 6; masterFilter.type = 'lowpass'; masterFilter.frequency.value = 3000; break;
                default: masterCompressor.threshold.value = -12; masterCompressor.ratio.value = 8; masterFilter.type = 'allpass'; break;
            }
        }
        
        // --- NEW DECADE PHYSICS ---
        function applyDecadePhysics(decade) {
            currentDecade=decade;
            if(!audioCtx || !masterCompressor || !masterFilter) return;
            // Overrides master settings to simulate recording mediums
            switch(decade) {
                case '1920s': // Mechanical: Narrow bandpass, heavy compression
                    masterFilter.type = 'bandpass'; masterFilter.frequency.value = 1000; masterFilter.Q.value = 0.8;
                    masterCompressor.threshold.value = -30; masterCompressor.ratio.value = 16;
                    break;
                case '1930s': // Early Electric: Slightly wider bandpass, boxy
                    masterFilter.type = 'bandpass'; masterFilter.frequency.value = 1500; masterFilter.Q.value = 0.6;
                    masterCompressor.threshold.value = -25; masterCompressor.ratio.value = 12;
                    break;
                case '1940s': // War Era/Early Tape: Saturation
                    masterFilter.type = 'lowpass'; masterFilter.frequency.value = 4000; masterFilter.Q.value = 0;
                    masterCompressor.threshold.value = -15; masterCompressor.ratio.value = 4; 
                    break;
                case '1950s': // Magnetic Tape: Warm roll-off
                    masterFilter.type = 'lowpass'; masterFilter.frequency.value = 6000; masterFilter.Q.value = 0.5;
                    masterCompressor.threshold.value = -12; masterCompressor.ratio.value = 6;
                    break;
                case '1960s': // Wall of Sound: Mid-range punch
                    masterFilter.type = 'peaking'; masterFilter.frequency.value = 2000; masterFilter.gain.value = 6;
                    masterCompressor.threshold.value = -10; masterCompressor.ratio.value = 8;
                    break;
                case '1970s': // Hi-Fi Analog: Scooped, warm
                    masterFilter.type = 'lowshelf'; masterFilter.frequency.value = 200; masterFilter.gain.value = 4;
                    masterCompressor.threshold.value = -15; masterCompressor.ratio.value = 4;
                    break;
                case '1980s': // Digital/Gated: Brightness
                    masterFilter.type = 'highshelf'; masterFilter.frequency.value = 4000; masterFilter.gain.value = 10;
                    masterCompressor.threshold.value = -12; masterCompressor.ratio.value = 10;
                    break;
                case '1990s': // CD Era: Full range
                    masterFilter.type = 'allpass'; // Flat response
                    masterCompressor.threshold.value = -14; masterCompressor.ratio.value = 5;
                    break;
                case '2000s': // Loudness War: Limit it hard
                    masterFilter.type = 'peaking'; masterFilter.frequency.value = 100; masterFilter.gain.value = 3;
                    masterCompressor.threshold.value = -24; masterCompressor.ratio.value = 20; // Limiter
                    break;
                case '2010s': // Streaming: Sub-bass capable
                    masterFilter.type = 'lowshelf'; masterFilter.frequency.value = 80; masterFilter.gain.value = 6;
                    masterCompressor.threshold.value = -18; masterCompressor.ratio.value = 8;
                    break;
                case '2020s': // Modern: Clean, controlled
                    masterFilter.type = 'allpass';
                    masterCompressor.threshold.value = -16; masterCompressor.ratio.value = 6;
                    break;
            }
        }

        // --- NEW VIBE / ARCHETYPE SYSTEM ---
