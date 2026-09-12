// --- 1. GLOBAL ARCHIVES ---
        const noteNames = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
        const roots = {}; noteNames.forEach((n, i) => roots[n] = 261.63 * Math.pow(2, i / 12));

        const westernScales = { "Major": [0,2,4,5,7,9,11], "Minor": [0,2,3,5,7,8,10], "Dorian": [0,2,3,5,7,9,10], "Phrygian": [0,1,3,5,7,8,10], "Lydian": [0,2,4,6,7,9,11], "Mixolydian": [0,2,4,5,7,9,10], "Locrian": [0,1,3,5,6,8,10], "Harmonic Min": [0,2,3,5,7,8,11], "Melodic Min": [0,2,3,5,7,9,11], "Pentatonic": [0,2,4,7,9], "Blues": [0,3,5,6,7,10], "Hirojoshi": [0,2,3,7,8], "Japanese": [0,1,5,7,8], "Double Harmonic": [0,1,4,5,7,8,11] };
        for(let i=Object.keys(westernScales).length+1; i<=25; i++) westernScales[`West Mode ${i}`] = [0,2,4,5,7,9,11];

        const arabMaqams = { "Rast": [0,4,7,10,14,18,22], "Bayati": [0,3,6,10,14,17,20], "Hijaz": [0,2,8,10,14,17,20], "Saba": [0,3,6,8,12,15,18], "Sikah": [0,3,7,11,14,17,21], "Nahawand": [0,4,6,10,14,16,20], "Kurd": [0,2,6,10,14,16,20], "Ajam": [0,4,8,10,14,18,22], "Husayni": [0,3,6,10,14,17,21], "Suznak": [0,4,7,10,14,16,22] };
        for(let i=Object.keys(arabMaqams).length+1; i<=25; i++) arabMaqams[`Maqam ${i}`] = [0,4,7,10,14,18,22];

        const ottomanMakams = { "Rast": [0,9,17,26,35,44,53], "Dügâh": [0,5,18,26,35,40,53], "Uşşak": [0,8,17,26,35,43,53], "Hüseyni": [0,8,17,26,35,43,53], "Sabâ": [0,8,14,22,31,39,48], "Acem": [0,9,13,26,35,39,48], "Gerdâniye": [0,8,17,26,35,43,49], "Nevâ": [0,8,17,26,35,43,53], "Evc": [0,9,18,26,35,44,53], "Bestenigâr": [0,5,14,22,31,40,49] };
        for(let i=Object.keys(ottomanMakams).length+1; i<=25; i++) ottomanMakams[`Makam ${i}`] = [0,9,17,26,35,44,53];

        const persianDastgahs = { "Shur": [0,3,6,10,14,16,20], "Homayun": [0,2,8,10,14,16,22], "Mahur": [0,4,8,10,14,18,22], "Segah": [0,3,7,10,14,17,21], "Chahargah": [0,2,8,10,14,16,22], "Nava": [0,2,6,10,14,17,20] };
        for(let i=7; i<=25; i++) persianDastgahs[`Dastgah ${i}`] = [0,3,6,10,14,16,20];

        const hindustaniRaags = { "Bhairav": [0,1,4,5,7,8,11], "Yaman": [0,2,4,6,7,9,11], "Kafi": [0,2,3,5,7,9,10], "Bilaval": [0,2,4,5,7,9,11], "Asavari": [0,2,3,5,7,8,10] };
        for(let i=6; i<=25; i++) hindustaniRaags[`Raag ${i}`] = [0,2,4,5,7,9,11];

        const carnaticRaags = { "Mayamalavagowla": [0,1,4,5,7,8,11], "Shankarabharanam": [0,2,4,5,7,9,11], "Kharaharapriya": [0,2,3,5,7,9,10] };
        for(let i=4; i<=25; i++) carnaticRaags[`Melakarta ${i}`] = [0,1,4,5,7,8,11];

        const gamelanPathets = { "Slendro Manyura": [0,2,5,7,9], "Slendro Sanga": [0,2,4,7,9], "Pelog Nem": [0,1,3,7,8], "Pelog Lima": [0,1,3,7,8,10] };
        for(let i=4; i<=25; i++) gamelanPathets[`Pathet ${i}`] = [0,2,5,7,9];

        const byzantineModes = { "Mode I": [0,10,18,30,42,50,60], "Mode II": [0,8,22,30,38,52,60], "Mode III": [0,12,24,30,42,54,60] };
        for(let i=4; i<=25; i++) byzantineModes[`Byz Mode ${i}`] = [0,10,18,30,42,50,60];

        const rhythmStyles = {
            "four_on_floor": { label: "Detroit 4/4", kick: [0,4,8,12], snare: [4,12], hat: [2,6,10,14] },
            "motorik": { label: "Düsseldorf Motorik", kick: [0,4,8,12], snare: [4,12], hat: [0,2,4,6,8,10,12,14] },
            "breakbeat": { label: "Amen Break", kick: [0,3,10,11], snare: [4,12], hat: [0,2,4,6,8,10,12,14] },
            "clave": { label: "Havana Clave", kick: [0,3,6,10,13], snare: [], hat: [0,4,8,12] },
            "reggae": { label: "One Drop Kingston", kick: [8], snare: [8], hat: [2,6,10,14] },
            "jungle": { label: "London Jungle", kick: [0,11], snare: [4,7,12,15], hat: [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15] },
            "disco": { label: "Studio 54", kick: [0,4,8,12], snare: [4,12], hat: [2,6,10,14] },
            "ebm": { label: "Brussels Body", kick: [0,4,8,12], snare: [4,12], hat: [2,6,10,14] }
        };
        for(let i=Object.keys(rhythmStyles).length+1; i<=25; i++) rhythmStyles[`preset_${i}`] = { label: `Arch. Preset ${i}`, kick: [0,8], snare: [4], hat: [2,6,10,14] };

        const genreSystem = {
            "Techno": { subs: ["Berlin", "Dub", "Acid", "Hard"], t: 135, mood: 90 },
            "House": { subs: ["Deep", "Chicago", "Acid", "French"], t: 124, mood: 75 },
            "Ambient": { subs: ["Drone", "Cinematic", "Nature", "Space"], t: 60, mood: 20 },
            "Synthwave": { subs: ["Outrun", "Grid", "Neon", "Cyber"], t: 110, mood: 80 }
        };
        const extraGenres = ["Pop", "Rock", "Disco", "Hip Hop", "Dubstep", "IDM", "EBM", "Garage", "Jazz", "Reggae", "Soul", "Funk", "Metal", "Folk", "Classical", "Hardstyle", "Latin", "Afrobeat", "Industrial", "Noise", "Ghent-Vapor", "Art-Pop"];
        extraGenres.forEach(eg => { if(!genreSystem[eg]) genreSystem[eg] = { subs: ["Modern", "Classic", "Underground"], t: 110, mood: 50 }; });

        const drumNames = ["KICK", "SNARE", "HIHAT", "TOM-L", "TOM-H", "CLAP", "COWBL", "NOISE"];
        const instList = ["drums", "lead", "bass", "brass", "strings", "pluck", "chords", "drone", "singing"];

        const temperaments = {
            "equal": [0,0,0,0,0,0,0,0,0,0,0,0], "just": [0,12,4,16,-14,-2,14,2,14,-16,18,-12], "pythagorean": [0,14,4,18,8,-2,12,2,16,6,20,10], "meantone": [0,10,20,31,-14,10,0,7,17,28,-21,-7], "werckmeister": [0,-10,-8,-6,-10,0,-12,-4,-12,-8,-6,-2], "kirnberger": [0,-8,2,-2,-4,-6,-10,-4,-12,-8,-4,-2], "vallotti": [0,-2,-4,-6,-8,-10,-12,-4,-6,-8,-10,-12], "young": [0,-1,-3,-4,-6,-8,-10,-2,-3,-5,-7,-9]
        };

        const chordDefinitions = {
            "Maj": [0, 4, 7], "Min": [0, 3, 7], "Dim": [0, 3, 6], "Aug": [0, 4, 8],
            "Sus2": [0, 2, 7], "Sus4": [0, 5, 7], "7": [0, 4, 7, 10], "Maj7": [0, 4, 7, 11],
            "Min7": [0, 3, 7, 10], "Dim7": [0, 3, 6, 9], "5": [0, 7]
        };

        const formants = { 'ah': { f1: 730, f2: 1090 }, 'oh': { f1: 380, f2: 940 }, 'ee': { f1: 300, f2: 2700 } };

        // --- 2. GLOBAL STATE ---
        let tempo = 120, mood = 50, stepsInSig = 16, currentBeat = 0, currentLoopMax = 8;
        let tuningSystem = "western", currentRoot = "C", currentScale = "Major", currentTemperament = "equal", playbackMode = "generative", currentPhilosophy = "east", currentEditTrack = 'lead';
        let currentStampValue = 'Lead:C4';
        let currentDrumVoice = 0; // 0=Kick, 1=Snare, etc.
        let currentChordRootIndex = 0;
        let currentChordType = 'Maj';

        // Stocastic Matrix State
        let evolveInterval = 16;
        let isAutoEvolve = false;
        let globalMutationRate = 0.1;
        let globalPitchVar = 0.5;
        let currentStructure = 'free'; // Default Structure
        let currentRandomness = 'uniform'; // Default Randomness
        let currentMoodKey = 'neutral';
        let currentVibe = 'neutral';
        let currentDecade = '2020s';
        let currentMasterSound = 'neutral';
        let currentGenre = 'Techno';
        let currentSubGenre = 'Berlin';
        let currentRhythmStyle = 'four_on_floor';
        let randomnessState = { x: 0.5, last: 0.5, step: 0, seed: 0x6d2b79f5, mt: null, mtIndex: 624, markov: 1 }; // Stateful generators
        let hardwareEntropy = 0; // Pointer/touch entropy accumulator
        
        // Vibe Bias System
        let vibeBiases = { lead: 1, bass: 1, brass: 1, strings: 1, pluck: 1, chords: 1, drone: 1, singing: 1 };
        // Part Presence (Density) System - 0.0 to 2.0 (1.0 default)
        let partPresence = {}; instList.forEach(p => partPresence[p] = 1.0);

        let synthParams = {
            drums: { wave: 'noise', a: 0.001, d: 0.1, s: 0.01, r: 0.1 },
            lead: { wave: 'square', a: 0.01, d: 0.2, s: 0.5, r: 0.5 },
            bass: { wave: 'triangle', a: 0.02, d: 0.3, s: 0.4, r: 0.3 },
            brass: { wave: 'sawtooth', a: 0.05, d: 0.4, s: 0.7, r: 0.3, cutoff: 1500 },
            strings: { wave: 'sawtooth', a: 0.4, d: 0.8, s: 0.8, r: 1.0, cutoff: 1200 },
            pluck: { wave: 'sine', a: 0.001, d: 0.1, s: 0.1, r: 0.1, cutoff: 4000 },
            chords: { wave: 'sine', a: 0.1, d: 0.5, s: 0.6, r: 1.0 },
            drone: { wave: 'sine', a: 1.0, d: 1.0, s: 1.0, r: 1.5 },
            singing: { wave: 'sawtooth', a: 0.1, d: 0.1, s: 0.8, r: 0.4, mode: 'choir', phoneme: 'ah' }
        };

        let partSequences = {}; instList.forEach(p => { if(p!=='drums') partSequences[p] = Array(128).fill(null); });
        let partPerformance = {}; instList.forEach(p => { partPerformance[p] = Array(128).fill(0).map(() => ({ vel: 0.8, timbre: 0.5, jitter: 0 })); });
        let drumMatrix = Array(8).fill(0).map(() => Array(128).fill(false));
        let activeParts = { drums: true, lead: true, bass: true, brass: true, strings: true, pluck: true, chords: true, drone: true, singing: true };
        let activeRows = Array(16).fill(false); activeRows[0] = true;

        let audioCtx, isPlaying = false, beatInterval, masterCompressor, masterFilter;
        let rootSel, scaleSel, gSel, subSel, seqArea, palCont, styleSel, tuneSel, tempSel, mixerFront, globalCard;

        // --- 3. UI ENGINE ---
        window.onload = () => {
            restoreState();
            rootSel = document.getElementById('rootSelect'); scaleSel = document.getElementById('scaleSelect');
            gSel = document.getElementById('genreSelect'); subSel = document.getElementById('subGenreSelect');
            seqArea = document.getElementById('sequencerGridArea'); palCont = document.getElementById('inputPalette');
            styleSel = document.getElementById('rhythmStyleSelect');
            tuneSel = document.getElementById('tuningSelect'); tempSel = document.getElementById('tempSelect');
            mixerFront = document.getElementById('mixerFront'); globalCard = document.getElementById('globalMixerCard');

            // Wire Listeners
            if (tuneSel) tuneSel.onchange = applyTuningSystem;
            if (gSel) gSel.onchange = () => { currentGenre=gSel.value; populateSubGenres(true); scheduleSave(); };
            if (rootSel) rootSel.onchange = (e) => { currentRoot = e.target.value; buildPalette(); scheduleSave(); };
            if (scaleSel) scaleSel.onchange = (e) => { currentScale = e.target.value; buildPalette(); scheduleSave(); };
            if (styleSel) styleSel.onchange = () => { currentRhythmStyle=styleSel.value; if (typeof applyRhythmStyle === 'function') applyRhythmStyle(); scheduleSave(); };
            if (subSel) subSel.onchange = () => { currentSubGenre=subSel.value; applyMacro(); scheduleSave(); };
            if (tempSel) tempSel.onchange = (e) => { currentTemperament = e.target.value; buildPalette(); };
            
            // Wire Stochastic Matrix Controls
            const evolvInt = document.getElementById('evolveInterval');
            if(evolvInt) evolvInt.oninput = (e) => { evolveInterval = parseInt(e.target.value); document.getElementById('evolveDisp').textContent = evolveInterval; };
            const autoEv = document.getElementById('autoEvolveToggle');
            if(autoEv) autoEv.onchange = (e) => { isAutoEvolve = e.target.checked; };
            const mutRate = document.getElementById('mutationRate');
            if(mutRate) mutRate.oninput = (e) => { globalMutationRate = parseFloat(e.target.value); };
            const pVar = document.getElementById('randPitchVar');
            if(pVar) pVar.oninput = (e) => { globalPitchVar = parseFloat(e.target.value); };
            const structSel = document.getElementById('structureSelect');
            if(structSel) structSel.onchange = (e) => { currentStructure = e.target.value; scheduleSave(); };
            
            // Wire Decade & Vibe & Mood & Randomness
            const decSel = document.getElementById('decadeSelect');
            if(decSel) decSel.onchange = (e) => { currentDecade=e.target.value; applyDecadePhysics(currentDecade); scheduleSave(); };
            const vibeSel = document.getElementById('vibeSelect');
            if(vibeSel) vibeSel.onchange = (e) => { currentVibe=e.target.value; applyVibe(currentVibe); scheduleSave(); };
            const moodSel = document.getElementById('moodSelect');
            if(moodSel) moodSel.onchange = (e) => { currentMoodKey=e.target.value; applyMood(currentMoodKey); scheduleSave(); };
            const randSel = document.getElementById('randomnessSelect');
            if(randSel) randSel.onchange = (e) => { currentRandomness = e.target.value; resetRandomnessState(); scheduleSave(); };

            // Hardware Entropy Harvester
            document.addEventListener('mousemove', (e) => {
                const delta = Math.abs(e.movementX) + Math.abs(e.movementY);
                hardwareEntropy = (hardwareEntropy + delta + (performance.now()%17)) % 1000;
            });
            document.addEventListener('pointermove', (e) => {
                hardwareEntropy = (hardwareEntropy + Math.abs(e.clientX) + Math.abs(e.clientY) + (performance.now()%31)) % 1000;
            }, {passive:true});
            document.addEventListener('touchmove', (e) => {
                const t=e.touches?.[0]; if(t) hardwareEntropy=(hardwareEntropy+t.clientX+t.clientY+(performance.now()%29))%1000;
            }, {passive:true});

            const playback = document.getElementById('playbackMode');
            if (playback) playback.onchange = (e) => {
                playbackMode = e.target.value;
                document.getElementById('drumMatrixControls').style.display = (playbackMode === 'sequencer') ? 'block' : 'none';
            };
            
            const philosophy = document.getElementById('globalModeSelect');
            if (philosophy) philosophy.onchange = (e) => { currentPhilosophy = e.target.value; };
            
            const tempoSlid = document.getElementById('tempoSlider');
            if (tempoSlid) tempoSlid.oninput = (e) => { tempo = parseInt(e.target.value); document.getElementById('tempoDisp').textContent = tempo; if(isPlaying) { clearInterval(beatInterval); beatInterval = setInterval(stepScheduler, (60/tempo/4)*1000); } };
            
            const moodSlid = document.getElementById('moodSlider');
            if (moodSlid) moodSlid.oninput = (e) => { mood = parseInt(e.target.value); document.getElementById('moodDisp').textContent = mood; };

            const masterSound = document.getElementById('masterSoundSelect');
            if (masterSound) masterSound.onchange = (e) => { currentMasterSound=e.target.value; applyMasteringProfile(); scheduleSave(); };

            // Initial Populations (restore saved values before any macro can overwrite them)
            Object.keys(genreSystem).forEach(g => gSel.add(new Option(g, g)));
            Object.keys(rhythmStyles).forEach(k => styleSel.add(new Option(rhythmStyles[k].label, k)));
            Object.keys(temperaments).forEach(t => tempSel.add(new Option(t.toUpperCase(), t)));
            ["Western", "Arab", "Ottoman", "Persian", "Hindustani", "Carnatic", "Gamelan", "Byzantine"].forEach(t => tuneSel.add(new Option(t, t.toLowerCase())));
            if([...tuneSel.options].some(o=>o.value===tuningSystem)) tuneSel.value=tuningSystem;
            if([...gSel.options].some(o=>o.value===currentGenre)) gSel.value=currentGenre;
            populateSubGenres(false);
            if([...subSel.options].some(o=>o.value===currentSubGenre)) subSel.value=currentSubGenre;
            if([...styleSel.options].some(o=>o.value===currentRhythmStyle)) styleSel.value=currentRhythmStyle;
            if([...tempSel.options].some(o=>o.value===currentTemperament)) tempSel.value=currentTemperament;

            buildMixerRows();
            applyTuningSystem();
            setEditTrack(currentEditTrack || 'lead');
            buildSequencerGrid();
            updateLoopLength();
            document.getElementById('tempoSlider').value = tempo; document.getElementById('tempoDisp').textContent = tempo;
            document.getElementById('moodSlider').value = mood; document.getElementById('moodDisp').textContent = mood;
            if (document.getElementById('playbackMode')) document.getElementById('playbackMode').value = playbackMode;
            if (document.getElementById('globalModeSelect')) document.getElementById('globalModeSelect').value = currentPhilosophy;
            if (document.getElementById('structureSelect')) document.getElementById('structureSelect').value = currentStructure;
            if (document.getElementById('randomnessSelect')) document.getElementById('randomnessSelect').value = currentRandomness;
            if (document.getElementById('evolveInterval')) document.getElementById('evolveInterval').value = evolveInterval;
            if (document.getElementById('evolveDisp')) document.getElementById('evolveDisp').textContent = evolveInterval;
            if (document.getElementById('autoEvolveToggle')) document.getElementById('autoEvolveToggle').checked = isAutoEvolve;
            if (document.getElementById('mutationRate')) document.getElementById('mutationRate').value = globalMutationRate;
            if (document.getElementById('randPitchVar')) document.getElementById('randPitchVar').value = globalPitchVar;
            if (document.getElementById('moodSelect')) document.getElementById('moodSelect').value = currentMoodKey;
            if (document.getElementById('vibeSelect')) document.getElementById('vibeSelect').value = currentVibe;
            if (document.getElementById('decadeSelect')) document.getElementById('decadeSelect').value = currentDecade;
            if (document.getElementById('masterSoundSelect')) document.getElementById('masterSoundSelect').value = currentMasterSound;
            { const savedTempo=tempo,savedMood=mood; applyVibe(currentVibe); applyMood(currentMoodKey); tempo=savedTempo; mood=savedMood; document.getElementById('tempoSlider').value=tempo; document.getElementById('tempoDisp').textContent=tempo; document.getElementById('moodSlider').value=mood; document.getElementById('moodDisp').textContent=mood; }
            saveState();
        };
