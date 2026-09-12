        /**
         * II. The Synthesiser Engine 
         */
        let audioContext = null;
        let masterCompressor = null;
        let masterLimiter = null;
        let makeupGain = null;
        
        let fxFilter, fxDelay, fxDelayGain, fxDrive, fxTremolo, masterDropoutGain;
        let lfoPhase = 0;
        let lfoFlutterPhase = 0;
        
        let activeSynths = new Map(); 
        let currentMode = 'SOLO'; 
        let timingCallbacks = null;
        let isPlaying = false;
        let totalTime = 0;
        let startTime = 0;
        let animationFrameId = null;

        const notationEl = document.getElementById('notation-target');
        const timeDisplayEl = document.getElementById('time-display');
        
        const btnPlaySolo = document.getElementById('btn-play-solo');
        const btnMashup = document.getElementById('btn-play-mashup');
        const btnStochastic = document.getElementById('btn-play-stochastic');
        const btnStop = document.getElementById('btn-stop');

        function formatTime(seconds) {
            if (typeof seconds !== 'number' || isNaN(seconds) || !isFinite(seconds)) return "00:00";
            const min = Math.floor(seconds / 60);
            const sec = Math.floor(seconds % 60);
            return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
        }

        // Generate a mathematically symmetrical distortion curve to prevent DC offset
        function makeDistortionCurve(amount) {
            const k = typeof amount === 'number' ? amount : 50;
            const n_samples = 44100;
            const curve = new Float32Array(n_samples);
            const deg = Math.PI / 180;
            for (let i = 0; i < n_samples; ++i) {
                const x = i * 2 / n_samples - 1;
                curve[i] = (3 + k) * x * 20 * deg / (Math.PI + k * Math.abs(x));
            }
            return curve;
        }

        async function initAudioGraph() {
            if (!audioContext) {
                const AudioContextClass = window.AudioContext || window.webkitAudioContext;
                if (!AudioContextClass) throw new Error('Web Audio API is not supported in this browser.');
                audioContext = new AudioContextClass({ latencyHint: 'interactive' });

                // 1. Master Cascaded Dynamic Range Control
                // Softer compression to preserve musicality, aggressive limiting to prevent clipping
                masterCompressor = audioContext.createDynamicsCompressor();
                masterCompressor.threshold.value = -24.0; 
                masterCompressor.knee.value = 12.0;
                masterCompressor.ratio.value = 8.0; 
                masterCompressor.attack.value = 0.003;
                masterCompressor.release.value = 0.25;

                makeupGain = audioContext.createGain();
                makeupGain.gain.value = 2.0; // Reduced to ~+6dB to stop overloading the limiter

                masterLimiter = audioContext.createDynamicsCompressor();
                masterLimiter.threshold.value = -0.5; // Absolute ceiling below digital 0
                masterLimiter.knee.value = 0.0; 
                masterLimiter.ratio.value = 20.0; 
                masterLimiter.attack.value = 0.01; // Lengthened to 10ms to prevent low-frequency clipping distortion
                masterLimiter.release.value = 0.1;

                masterDropoutGain = audioContext.createGain(); // For non-destructive Cagean muting

                // 2. Service Hatch FX Chain
                fxFilter = audioContext.createBiquadFilter();
                fxFilter.type = 'lowpass';
                
                fxDelay = audioContext.createDelay(2.0);
                fxDelayGain = audioContext.createGain();
                fxDelayGain.gain.value = 0;
                
                fxDrive = audioContext.createWaveShaper();
                fxDrive.curve = makeDistortionCurve(0);
                fxDrive.oversample = '4x';
                
                fxTremolo = audioContext.createGain();

                // Serial Routing (Mashup FX -> Master Bus)
                fxFilter.connect(fxDrive);
                fxDrive.connect(fxTremolo);
                fxTremolo.connect(masterDropoutGain);
                masterDropoutGain.connect(masterCompressor);
                
                // Parallel Delay Routing
                fxFilter.connect(fxDelay);
                fxDelay.connect(fxDelayGain);
                fxDelayGain.connect(fxDrive);

                if (!window.__abcjs_dsp_patched && window.AudioNode && AudioNode.prototype.connect) {
                    const origConnect = AudioNode.prototype.connect;
                    AudioNode.prototype.connect = function(...args) {
                        if (args[0] === audioContext.destination && this !== masterCompressor && this !== makeupGain && this !== masterLimiter) {
                            if (currentMode === 'MASHUP') {
                                return origConnect.call(this, fxFilter);
                            } else {
                                return origConnect.call(this, masterCompressor);
                            }
                        }
                        return origConnect.apply(this, args);
                    };
                    window.__abcjs_dsp_patched = true;
                }

                masterCompressor.connect(makeupGain);
                makeupGain.connect(masterLimiter);
                masterLimiter.connect(audioContext.destination);
            }
            if (audioContext.state === 'suspended') await audioContext.resume();
        }

        function stopPlayback() {
            activeSynths.forEach(synth => {
                try { synth.stop(); } catch(e) {}
            });
            activeSynths.clear();
            isPlaying = false;
            currentMode = 'SOLO';
            
            if(animationFrameId) cancelAnimationFrame(animationFrameId);
            
            btnPlaySolo.classList.remove('active');
            btnMashup.classList.remove('active');
            btnStochastic.classList.remove('active');
            btnStop.disabled = true;
            btnPlaySolo.innerText = "► PLAY SELECTION";
            
            timeDisplayEl.innerText = "00:00 / 00:00";
            
            if (timingCallbacks && typeof timingCallbacks.setProgress === 'function') {
                timingCallbacks.setProgress(0);
            }
            document.querySelectorAll('.abcjs-highlight').forEach(el => el.classList.remove('abcjs-highlight'));
        }

        btnStop.addEventListener('click', stopPlayback);

        function applyMusicalityAST(abcData) {
            if (!musicalityActive) return abcData;
            let processed = abcData;
            
            if (document.getElementById('mus-2').checked) processed = processed.replace(/^K:.*$/gm, 'K:C'); 
            if (document.getElementById('mus-3').checked) processed = processed.replace(/['\,]/g, ''); 
            if (document.getElementById('mus-4').checked) processed = processed.replace(/\d+\/\d+/g, '');
            
            return processed;
        }

        async function executePlayback(songs, mode, triggerBtn = null) {
            stopPlayback();
            notationEl.innerHTML = '';
            
            if(!songs || songs.length === 0) return;
            currentMode = mode;
            
            // Store variables for the Loop mechanism
            lastPlayedSongs = songs;
            lastPlayedMode = mode;
            lastPlayedTriggerBtn = triggerBtn;

            try {
                if(triggerBtn) triggerBtn.classList.add('active');
                if(triggerBtn === btnPlaySolo) triggerBtn.innerText = "■ DROP NEEDLE...";
                
                btnStop.disabled = false;
                await initAudioGraph();
                
                let primaryVisualObj = null;
                totalTime = 0;

                for(let i=0; i<songs.length; i++) {
                    const song = songs[i];
                    let targetDiv = (i === 0) ? notationEl : document.createElement('div');
                    
                    const processedAbc = applyMusicalityAST(song.abcData);

                    const visualObjs = abcjs.renderAbc(targetDiv, processedAbc, {
                        responsive: 'resize', add_classes: true, staffwidth: Math.min(800, Math.max(320, notationEl.clientWidth || 320))
                    });
                    
                    let vObj = visualObjs[0];
                    if(i === 0) {
                        primaryVisualObj = vObj;
                        setupPlayhead(primaryVisualObj);
                    }

                    let synth = new abcjs.synth.CreateSynth();
                    
                    let mpm = (vObj && vObj.millisecondsPerMeasure) ? vObj.millisecondsPerMeasure() : 1000;
                    if (musicalityActive && currentMode === 'MASHUP' && document.getElementById('mus-1').checked) {
                        mpm = 1200; 
                    }

                    await synth.init({
                        audioContext: audioContext,
                        visualObj: vObj,
                        millisecondsPerMeasure: mpm,
                        options: { 
                            soundFontUrl: "https://paulrosen.github.io/midi-js-soundfonts/FluidR3_GM/",
                            audioContext: audioContext 
                        }
                    });
                    
                    await synth.prime();
                    
                    let duration = synth.duration || (vObj.getTotalTime ? vObj.getTotalTime() : 0);
                    // Robust tracking of the longest buffer in the polyphonic array
                    if(duration > totalTime) totalTime = duration;
                    
                    const synthId = song.id || `virtual_${i}`;
                    activeSynths.set(synthId, synth);
                }

                if(triggerBtn === btnPlaySolo) triggerBtn.innerText = "SPINNING...";
                
                startTime = audioContext.currentTime;
                isPlaying = true;
                
                activeSynths.forEach((s) => s.start());

                updateUI();

            } catch (err) {
                console.error(err);
                alert("Mechanism failure. Audio engine error.");
                stopPlayback();
            }
        }
        
