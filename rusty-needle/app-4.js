        async function injectLiveSynth(song) {
            if (!audioContext || !isPlaying) return;
            try {
                const dummyDiv = document.createElement('div');
                const processedAbc = applyMusicalityAST(song.abcData);
                const visualObjs = abcjs.renderAbc(dummyDiv, processedAbc, { responsive: 'resize' });
                const vObj = visualObjs[0];
                
                let synth = new abcjs.synth.CreateSynth();
                let mpm = (vObj && vObj.millisecondsPerMeasure) ? vObj.millisecondsPerMeasure() : 1000;
                
                if (musicalityActive && document.getElementById('mus-1').checked) mpm = 1200;
                
                await synth.init({
                    audioContext: audioContext,
                    visualObj: vObj,
                    millisecondsPerMeasure: mpm,
                    options: { soundFontUrl: "https://paulrosen.github.io/midi-js-soundfonts/FluidR3_GM/", audioContext }
                });
                
                await synth.prime();
                
                let elapsed = audioContext.currentTime - startTime;
                let duration = synth.duration || (vObj.getTotalTime ? vObj.getTotalTime() : 0);
                
                if (duration > totalTime) totalTime = duration; 
                
                let percent = duration > 0 ? (elapsed / duration) : 0;
                
                if (percent < 1.0) {
                    activeSynths.set(song.id, synth);
                    await synth.start();
                    synth.seek(percent); 
                }
            } catch (err) {
                console.error("Live Injection Failed:", err);
            }
        }

        function removeLiveSynth(songId) {
            if (activeSynths.has(songId)) {
                const synth = activeSynths.get(songId);
                synth.stop();
                activeSynths.delete(songId);
            }
        }

        function setupPlayhead(visualObj) {
            if (typeof abcjs.TimingCallbacks !== 'undefined') {
                timingCallbacks = new abcjs.TimingCallbacks(visualObj, {
                    eventCallback: function(ev) {
                        document.querySelectorAll('.abcjs-highlight').forEach(el => el.classList.remove('abcjs-highlight'));
                        let activeSvgElement = null;
                        if (ev && ev.elements) {
                            ev.elements.forEach(group => {
                                group.forEach(el => {
                                    el.classList.add('abcjs-highlight');
                                    if (!activeSvgElement) activeSvgElement = el;
                                });
                            });
                        }
                        if (activeSvgElement) {
                            const elRect = activeSvgElement.getBoundingClientRect();
                            const zoneRect = document.getElementById('output-zone').getBoundingClientRect();
                            const paddingThreshold = zoneRect.height * 0.2;
                            if (elRect.bottom > (zoneRect.bottom - paddingThreshold) || elRect.top < (zoneRect.top + paddingThreshold)) {
                                activeSvgElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            }
                        }
                    }
                });
            }
        }

        function updateUI() {
            if (!isPlaying) return;
            
            const currentTime = audioContext.currentTime - startTime;
            const percent = totalTime > 0 ? (currentTime / totalTime) : 0;
            
            timeDisplayEl.innerText = `${formatTime(Math.min(totalTime, currentTime))} / ${formatTime(totalTime)}`;

            if (timingCallbacks && typeof timingCallbacks.setProgress === 'function') {
                timingCallbacks.setProgress(Math.min(1, Math.max(0, percent)));
            }

            // Real-time Non-Destructive DSP Modulation
            if (currentMode === 'MASHUP' && audioContext) {
                const mAlgo = parseInt(document.getElementById('m-algo').value);
                const pModDepth = document.getElementById('m-p1').value / 100;
                const pDrop = document.getElementById('m-p2').value / 100;
                
                let currentCutoff = document.getElementById('m-p3').value;
                if (musicalityActive && document.getElementById('mus-7').checked) currentCutoff = Math.min(currentCutoff, 2500); 
                
                // Smoothed filter parameter application to prevent zipper noise
                fxFilter.frequency.setTargetAtTime(currentCutoff, audioContext.currentTime, 0.1);
                fxFilter.Q.setTargetAtTime(document.getElementById('m-p4').value, audioContext.currentTime, 0.1);
                
                let tremDepth = document.getElementById('m-p5').value / 100;
                if (musicalityActive && document.getElementById('mus-6').checked) tremDepth = 0; 

                const tremHz = document.getElementById('m-p6').value;
                lfoPhase += (tremHz / 60); 
                fxTremolo.gain.value = 1.0 - (tremDepth * (Math.sin(lfoPhase) * 0.5 + 0.5));
                
                fxDelayGain.gain.setTargetAtTime(document.getElementById('m-p7').value / 100, audioContext.currentTime, 0.1);
                fxDelay.delayTime.setTargetAtTime(document.getElementById('m-p8').value / 1000, audioContext.currentTime, 0.1);
                
                let driveVal = parseInt(document.getElementById('m-p9').value);
                if (musicalityActive && document.getElementById('mus-5').checked) driveVal = 0; 
                fxDrive.curve = makeDistortionCurve(driveVal * 5); 

                // Non-Destructive Algorithmic Triggers
                if (mAlgo === 1 && pModDepth > 0) {
                    // Tape Wow & Flutter (Delay Modulation instead of buffer seeking)
                    lfoFlutterPhase += 0.05;
                    fxDelay.delayTime.setTargetAtTime(0.02 + Math.sin(lfoFlutterPhase) * (0.02 * pModDepth), audioContext.currentTime, 0.05);
                    fxDelayGain.gain.setTargetAtTime(0.5, audioContext.currentTime, 0.1); 
                }

                if (mAlgo === 2 && pModDepth > 0) {
                    // Granular Degradation (Comb Filter Sweeping)
                    lfoFlutterPhase += 0.5; 
                    fxDelay.delayTime.setTargetAtTime(0.005 + Math.abs(Math.sin(lfoFlutterPhase) * (0.01 * pModDepth)), audioContext.currentTime, 0.01);
                    fxDelayGain.gain.setTargetAtTime(0.8, audioContext.currentTime, 0.1);
                }

                if (mAlgo === 4 && Math.random() < 0.05) {
                    // Spectral Scrambling (Smoothed random jumps)
                    fxFilter.frequency.setTargetAtTime(Math.random() * 10000 + 200, audioContext.currentTime, 0.2); 
                }

                // Cagean Dropouts (Muting master gain via envelope to avoid clicks)
                if ((mAlgo === 3 && Math.random() < 0.02) || (Math.random() < (pDrop * 0.01))) {
                    masterDropoutGain.gain.setTargetAtTime(0, audioContext.currentTime, 0.01);
                    setTimeout(() => { if (isPlaying) masterDropoutGain.gain.setTargetAtTime(1, audioContext.currentTime, 0.05); }, 150 + Math.random()*300);
                }
            }

            // Loop Execution Mechanism
            if (currentTime >= totalTime && totalTime > 0) {
                if (isLooping && lastPlayedSongs && lastPlayedSongs.length > 0) {
                    executePlayback(lastPlayedSongs, lastPlayedMode, lastPlayedTriggerBtn);
                } else {
                    stopPlayback();
                }
                return;
            }
            
            animationFrameId = requestAnimationFrame(updateUI);
        }


        // Android Chrome requires Web Audio to be resumed from a real user gesture.
        const unlockAudio = async () => {
            try {
                if (audioContext && audioContext.state === 'suspended') await audioContext.resume();
            } catch (e) { console.warn('Audio unlock failed', e); }
        };
        document.addEventListener('pointerdown', unlockAudio, { passive: true });
        document.addEventListener('touchend', unlockAudio, { passive: true });

        // Stop cleanly if Android backgrounds the PWA/tab; prevents orphaned audio.
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && isPlaying) stopPlayback();
        });

