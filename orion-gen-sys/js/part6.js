function applyVibe(vibe) {
            currentVibe=vibe;
            // 1. Set Biases for Generation
            const biases = {
                neutral: { lead: 1, bass: 1, brass: 1, strings: 1, pluck: 1, chords: 1, drone: 1, singing: 1 },
                cinematic: { lead: 0.2, bass: 1.5, brass: 2.0, strings: 2.5, pluck: 0.5, chords: 1.0, drone: 2.0, singing: 1.5 },
                gaming: { lead: 2.5, bass: 1.0, brass: 0.1, strings: 0.1, pluck: 2.0, chords: 0.5, drone: 0.5, singing: 0.1 },
                trailer: { lead: 0.5, bass: 3.0, brass: 3.0, strings: 2.0, pluck: 0.5, chords: 2.0, drone: 2.0, singing: 1.0 },
                noir: { lead: 0.5, bass: 2.0, brass: 2.0, strings: 1.5, pluck: 0.5, chords: 1.0, drone: 1.5, singing: 0.5 },
                documentary: { lead: 0.2, bass: 0.8, brass: 0.5, strings: 1.0, pluck: 2.0, chords: 1.0, drone: 1.5, singing: 0.2 },
                horror: { lead: 0.5, bass: 1.0, brass: 1.5, strings: 2.5, pluck: 2.0, chords: 0.2, drone: 3.0, singing: 0.5 },
                club: { lead: 1.0, bass: 3.0, brass: 0.5, strings: 0.5, pluck: 1.0, chords: 2.0, drone: 0.2, singing: 1.0 },
                lounge: { lead: 0.5, bass: 1.5, brass: 0.5, strings: 1.0, pluck: 2.0, chords: 2.5, drone: 0.5, singing: 0.8 },
                festival: { lead: 3.0, bass: 2.0, brass: 0.5, strings: 0.5, pluck: 1.5, chords: 2.5, drone: 0.5, singing: 1.5 },
                afterhours: { lead: 0.5, bass: 2.5, brass: 0.2, strings: 1.0, pluck: 1.0, chords: 1.5, drone: 2.0, singing: 0.5 },
                underground: { lead: 0.5, bass: 2.5, brass: 0.2, strings: 0.2, pluck: 0.5, chords: 1.0, drone: 1.5, singing: 0.2 },
                poolside: { lead: 1.0, bass: 1.5, brass: 0.5, strings: 0.5, pluck: 2.5, chords: 2.0, drone: 0.5, singing: 0.5 },
                lofi: { lead: 0.8, bass: 1.2, brass: 0.5, strings: 0.8, pluck: 1.2, chords: 2.0, drone: 1.2, singing: 0.5 },
                synthwave: { lead: 2.0, bass: 2.0, brass: 0.5, strings: 0.5, pluck: 1.5, chords: 2.0, drone: 1.0, singing: 0.5 },
                darkacademia: { lead: 0.5, bass: 1.0, brass: 0.8, strings: 2.5, pluck: 2.0, chords: 1.0, drone: 1.0, singing: 0.5 },
                cottagecore: { lead: 1.0, bass: 0.8, brass: 0.5, strings: 1.0, pluck: 3.0, chords: 1.5, drone: 0.5, singing: 1.0 },
                cyberpunk: { lead: 2.0, bass: 2.0, brass: 1.0, strings: 0.2, pluck: 1.0, chords: 0.5, drone: 2.0, singing: 0.2 },
                ethereal: { lead: 0.5, bass: 0.8, brass: 0.2, strings: 1.5, pluck: 1.5, chords: 1.2, drone: 2.5, singing: 2.5 },
                workout: { lead: 1.5, bass: 2.5, brass: 0.5, strings: 0.2, pluck: 1.0, chords: 1.5, drone: 0.5, singing: 0.5 },
                corporate: { lead: 0.5, bass: 0.8, brass: 0.2, strings: 1.0, pluck: 2.5, chords: 2.0, drone: 0.5, singing: 0.2 },
                nature: { lead: 1.0, bass: 0.5, brass: 0.5, strings: 1.0, pluck: 2.0, chords: 0.5, drone: 1.5, singing: 0.5 },
                meditative: { lead: 0.2, bass: 0.5, brass: 0.2, strings: 1.0, pluck: 1.0, chords: 0.5, drone: 4.0, singing: 1.0 },
                elevator: { lead: 0.5, bass: 0.8, brass: 0.5, strings: 1.5, pluck: 1.0, chords: 3.0, drone: 0.5, singing: 0.2 },
                industrial: { lead: 1.0, bass: 2.0, brass: 1.0, strings: 0.5, pluck: 0.5, chords: 0.5, drone: 3.0, singing: 0.2 },
                avantgarde: { lead: 1.5, bass: 1.5, brass: 1.5, strings: 1.5, pluck: 1.5, chords: 1.5, drone: 1.5, singing: 1.5 } // High chaos
            };
            vibeBiases = biases[vibe] || biases.neutral;

            // 2. Set Physics (Tempo & Master)
            let newTempo = 120;
            let newMood = 50;
            
            if(!audioCtx) {
                masterFilter = masterFilter || {type:'allpass',frequency:{value:0},gain:{value:0},Q:{value:0}};
                masterCompressor = masterCompressor || {threshold:{value:-12},ratio:{value:8}};
            }

            // Reset master chain first
            masterFilter.type = 'allpass'; masterCompressor.threshold.value = -12; masterCompressor.ratio.value = 8;

            switch(vibe) {
                case 'cinematic': newTempo = 75; newMood = 40; masterFilter.type = 'highshelf'; masterFilter.frequency.value = 3000; masterFilter.gain.value = 4; masterCompressor.ratio.value = 3; break;
                case 'gaming': newTempo = 150; newMood = 90; masterFilter.type = 'bandpass'; masterFilter.frequency.value = 1200; masterFilter.Q.value = 0.8; masterCompressor.ratio.value = 16; break;
                case 'trailer': newTempo = 80; newMood = 95; masterFilter.type = 'lowshelf'; masterFilter.frequency.value = 80; masterFilter.gain.value = 12; masterCompressor.ratio.value = 20; masterCompressor.threshold.value = -24; break;
                case 'noir': newTempo = 60; newMood = 30; masterFilter.type = 'lowpass'; masterFilter.frequency.value = 1500; masterFilter.Q.value = 0.2; break;
                case 'documentary': newTempo = 90; newMood = 20; masterFilter.type = 'peaking'; masterFilter.frequency.value = 500; masterFilter.gain.value = -3; break;
                case 'horror': newTempo = 50; newMood = 25; masterFilter.type = 'lowpass'; masterFilter.frequency.value = 600; masterFilter.Q.value = 4; break; // Resonant
                case 'club': newTempo = 132; newMood = 90; masterFilter.type = 'lowshelf'; masterFilter.frequency.value = 100; masterFilter.gain.value = 6; masterCompressor.threshold.value = -20; break;
                case 'lounge': newTempo = 105; newMood = 60; masterFilter.type = 'lowshelf'; masterFilter.frequency.value = 200; masterFilter.gain.value = 3; break;
                case 'festival': newTempo = 128; newMood = 95; masterFilter.type = 'peaking'; masterFilter.frequency.value = 2000; masterFilter.gain.value = 4; masterCompressor.ratio.value = 12; break;
                case 'afterhours': newTempo = 118; newMood = 70; masterFilter.type = 'lowpass'; masterFilter.frequency.value = 2000; break;
                case 'underground': newTempo = 126; newMood = 80; masterCompressor.threshold.value = -10; break; // Raw
                case 'poolside': newTempo = 115; newMood = 75; masterFilter.type = 'highshelf'; masterFilter.frequency.value = 5000; masterFilter.gain.value = 3; break;
                case 'lofi': newTempo = 78; newMood = 55; masterFilter.type = 'highpass'; masterFilter.frequency.value = 150; break;
                case 'synthwave': newTempo = 108; newMood = 85; masterFilter.type = 'peaking'; masterFilter.frequency.value = 1000; masterFilter.gain.value = 3; masterCompressor.ratio.value = 8; break;
                case 'darkacademia': newTempo = 70; newMood = 40; masterFilter.type = 'lowpass'; masterFilter.frequency.value = 3000; break;
                case 'cottagecore': newTempo = 95; newMood = 60; masterFilter.type = 'peaking'; masterFilter.frequency.value = 800; masterFilter.gain.value = 2; break; // Mid-range warmth
                case 'cyberpunk': newTempo = 110; newMood = 85; masterFilter.type = 'highshelf'; masterFilter.frequency.value = 2000; masterFilter.gain.value = 6; masterCompressor.ratio.value = 16; break;
                case 'ethereal': newTempo = 65; newMood = 45; masterFilter.type = 'allpass'; masterCompressor.ratio.value = 2; break;
                case 'workout': newTempo = 140; newMood = 90; masterCompressor.ratio.value = 10; masterCompressor.threshold.value = -18; break;
                case 'corporate': newTempo = 118; newMood = 50; masterFilter.type = 'allpass'; masterCompressor.ratio.value = 4; break; // Very clean
                case 'nature': newTempo = 80; newMood = 35; masterFilter.type = 'peaking'; masterFilter.frequency.value = 4000; masterFilter.gain.value = 2; break; // Air
                case 'meditative': newTempo = 50; newMood = 10; masterFilter.type = 'lowpass'; masterFilter.frequency.value = 1000; break;
                case 'elevator': newTempo = 100; newMood = 30; masterCompressor.ratio.value = 3; break; // Flat dynamics
                case 'industrial': newTempo = 135; newMood = 80; masterFilter.type = 'peaking'; masterFilter.frequency.value = 1500; masterFilter.gain.value = 8; break; // Metallic resonance
                case 'avantgarde': newTempo = 160; newMood = 99; masterFilter.type = 'bandpass'; masterFilter.frequency.value = 500; masterFilter.Q.value = 5; break; // Weird
            }

            // Update UI
            tempo = newTempo; mood = newMood;
            document.getElementById('tempoSlider').value = tempo; document.getElementById('tempoDisp').textContent = tempo;
            document.getElementById('moodSlider').value = mood; document.getElementById('moodDisp').textContent = mood;
            if (isPlaying) { clearInterval(beatInterval); beatInterval = setInterval(stepScheduler, (60 / tempo / 4) * 1000); }
        }

        // --- NEW AFFECTIVE STATE (MOOD) SYSTEM ---
        function applyMood(moodKey) {
            currentMoodKey=moodKey;
            // Biases: valence (happy/sad insts), arousal (tempo/compression), density
            // Using same mechanism as Vibe but focusing on emotion
            const biases = {
                neutral: { lead: 1, bass: 1, brass: 1, strings: 1, pluck: 1, chords: 1, drone: 1, singing: 1 },
                joy: { lead: 2.0, bass: 1.0, brass: 1.5, strings: 0.5, pluck: 2.5, chords: 2.0, drone: 0.2, singing: 1.5 },
                sadness: { lead: 0.3, bass: 1.0, brass: 0.5, strings: 2.5, pluck: 0.5, chords: 1.5, drone: 1.5, singing: 0.5 },
                anxiety: { lead: 1.5, bass: 1.5, brass: 0.5, strings: 2.0, pluck: 2.5, chords: 0.5, drone: 2.0, singing: 0.2 },
                calmness: { lead: 0.2, bass: 0.8, brass: 0.2, strings: 1.5, pluck: 1.0, chords: 1.5, drone: 3.0, singing: 1.0 },
                anger: { lead: 1.5, bass: 3.0, brass: 2.5, strings: 0.5, pluck: 0.5, chords: 1.0, drone: 2.0, singing: 0.5 },
                awe: { lead: 0.5, bass: 2.0, brass: 2.0, strings: 2.5, pluck: 0.5, chords: 2.0, drone: 3.0, singing: 2.5 },
                boredom: { lead: 0.5, bass: 1.0, brass: 0.5, strings: 0.5, pluck: 0.5, chords: 1.0, drone: 1.5, singing: 0.2 },
                nostalgia: { lead: 1.5, bass: 1.0, brass: 0.5, strings: 1.0, pluck: 1.5, chords: 2.5, drone: 1.0, singing: 0.5 },
                excitement: { lead: 2.5, bass: 2.0, brass: 1.5, strings: 0.5, pluck: 2.0, chords: 1.5, drone: 0.2, singing: 1.0 },
                melancholy: { lead: 0.5, bass: 1.0, brass: 0.5, strings: 2.0, pluck: 1.5, chords: 2.0, drone: 1.5, singing: 1.0 },
                amusement: { lead: 2.0, bass: 0.5, brass: 1.5, strings: 0.5, pluck: 3.0, chords: 1.5, drone: 0.1, singing: 0.5 },
                defiance: { lead: 2.0, bass: 2.5, brass: 2.0, strings: 0.5, pluck: 0.5, chords: 1.5, drone: 1.0, singing: 0.5 },
                dreaminess: { lead: 0.5, bass: 0.8, brass: 0.2, strings: 1.5, pluck: 2.0, chords: 1.5, drone: 2.5, singing: 2.0 },
                triumph: { lead: 2.0, bass: 1.5, brass: 3.0, strings: 1.5, pluck: 1.0, chords: 2.5, drone: 1.0, singing: 2.0 },
                loneliness: { lead: 1.0, bass: 0.5, brass: 0.2, strings: 0.5, pluck: 0.5, chords: 0.5, drone: 2.5, singing: 0.2 }, // Solo inst
                romance: { lead: 0.5, bass: 1.0, brass: 0.5, strings: 2.5, pluck: 1.0, chords: 1.5, drone: 0.5, singing: 1.0 },
                confusion: { lead: 2.0, bass: 1.5, brass: 1.5, strings: 1.5, pluck: 2.0, chords: 0.5, drone: 2.0, singing: 0.5 }, // High density
                fear: { lead: 0.2, bass: 2.0, brass: 0.5, strings: 2.5, pluck: 1.5, chords: 0.2, drone: 3.0, singing: 0.2 },
                contentment: { lead: 1.0, bass: 1.0, brass: 0.5, strings: 1.0, pluck: 1.5, chords: 2.0, drone: 1.0, singing: 1.0 },
                frustration: { lead: 1.5, bass: 1.5, brass: 1.5, strings: 1.5, pluck: 1.5, chords: 1.5, drone: 1.5, singing: 0.2 }, // Repetitive
                disgust: { lead: 0.5, bass: 2.5, brass: 2.5, strings: 0.5, pluck: 0.5, chords: 0.5, drone: 2.5, singing: 0.1 },
                hope: { lead: 1.5, bass: 1.0, brass: 1.0, strings: 2.0, pluck: 2.0, chords: 2.0, drone: 1.0, singing: 1.5 },
                guilt: { lead: 0.2, bass: 1.5, brass: 0.2, strings: 2.0, pluck: 0.5, chords: 1.0, drone: 2.5, singing: 0.2 },
                aesthetic: { lead: 1.0, bass: 1.0, brass: 0.5, strings: 1.5, pluck: 2.0, chords: 2.0, drone: 1.5, singing: 1.0 },
                aggression: { lead: 2.0, bass: 3.0, brass: 2.5, strings: 0.2, pluck: 0.5, chords: 1.0, drone: 1.5, singing: 0.2 }
            };
            vibeBiases = biases[moodKey] || biases.neutral;

            // 2. Set Physics
            let newTempo = 120; let newMood = 50;
            if(!audioCtx) { masterFilter = masterFilter || {type:'allpass',frequency:{value:0},gain:{value:0},Q:{value:0}}; masterCompressor = masterCompressor || {threshold:{value:-12},ratio:{value:8}}; }
            
            // Reset master
            masterFilter.type = 'allpass'; masterCompressor.threshold.value = -12; masterCompressor.ratio.value = 8;

            switch(moodKey) {
                case 'joy': newTempo = 128; newMood = 80; masterFilter.type = 'highshelf'; masterFilter.frequency.value = 5000; masterFilter.gain.value = 3; break;
                case 'sadness': newTempo = 60; newMood = 30; masterFilter.type = 'lowpass'; masterFilter.frequency.value = 800; break;
                case 'anxiety': newTempo = 145; newMood = 75; masterCompressor.threshold.value = -20; masterCompressor.ratio.value = 12; break; // Fast, compressed
                case 'calmness': newTempo = 55; newMood = 20; masterFilter.type = 'lowpass'; masterFilter.frequency.value = 1200; break;
                case 'anger': newTempo = 135; newMood = 90; masterCompressor.ratio.value = 20; masterCompressor.threshold.value = -24; break; // Distorted
                case 'awe': newTempo = 70; newMood = 60; masterFilter.type = 'highshelf'; masterFilter.frequency.value = 2000; masterFilter.gain.value = 5; break; // Big air
                case 'boredom': newTempo = 90; newMood = 20; masterCompressor.ratio.value = 2; break; // Flat
                case 'nostalgia': newTempo = 85; newMood = 50; masterFilter.type = 'bandpass'; masterFilter.frequency.value = 1000; masterFilter.Q.value = 0.6; break;
                case 'excitement': newTempo = 132; newMood = 90; masterFilter.type = 'highshelf'; masterFilter.frequency.value = 3000; masterFilter.gain.value = 3; break;
                case 'melancholy': newTempo = 65; newMood = 40; masterFilter.type = 'lowshelf'; masterFilter.frequency.value = 200; masterFilter.gain.value = 3; break;
                case 'amusement': newTempo = 110; newMood = 60; masterFilter.type = 'peaking'; masterFilter.frequency.value = 2000; masterFilter.gain.value = 4; break;
                case 'defiance': newTempo = 125; newMood = 80; masterCompressor.threshold.value = -18; break;
                case 'dreaminess': newTempo = 60; newMood = 45; masterFilter.type = 'allpass'; break; // Clarity
                case 'triumph': newTempo = 128; newMood = 95; masterFilter.type = 'peaking'; masterFilter.frequency.value = 1000; masterFilter.gain.value = 3; break;
                case 'loneliness': newTempo = 50; newMood = 15; masterFilter.type = 'highpass'; masterFilter.frequency.value = 300; break; // Thin
                case 'romance': newTempo = 80; newMood = 55; masterFilter.type = 'lowpass'; masterFilter.frequency.value = 2500; break; // Warm
                case 'confusion': newTempo = 118; newMood = 70; masterFilter.type = 'bandpass'; masterFilter.frequency.value = 600; masterFilter.Q.value = 2; break; // Disorienting
                case 'fear': newTempo = 140; newMood = 85; masterFilter.type = 'highpass'; masterFilter.frequency.value = 1000; break; // Screechy
                case 'contentment': newTempo = 95; newMood = 40; masterFilter.type = 'allpass'; break;
                case 'frustration': newTempo = 115; newMood = 65; masterCompressor.ratio.value = 16; break; // Stifled
                case 'disgust': newTempo = 80; newMood = 50; masterFilter.type = 'peaking'; masterFilter.frequency.value = 400; masterFilter.gain.value = 6; break; // Muddy
                case 'hope': newTempo = 100; newMood = 60; masterFilter.type = 'highshelf'; masterFilter.frequency.value = 4000; masterFilter.gain.value = 2; break;
                case 'guilt': newTempo = 55; newMood = 30; masterFilter.type = 'lowpass'; masterFilter.frequency.value = 500; break; // Muffled
                case 'aesthetic': newTempo = 90; newMood = 35; masterFilter.type = 'allpass'; break;
                case 'aggression': newTempo = 145; newMood = 95; masterCompressor.ratio.value = 20; break;
            }

            // Update UI
            tempo = newTempo; mood = newMood;
            document.getElementById('tempoSlider').value = tempo; document.getElementById('tempoDisp').textContent = tempo;
            document.getElementById('moodSlider').value = mood; document.getElementById('moodDisp').textContent = mood;
            if (isPlaying) { clearInterval(beatInterval); beatInterval = setInterval(stepScheduler, (60 / tempo / 4) * 1000); }
        }
