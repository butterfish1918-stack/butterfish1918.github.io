// --- RENDERING ---

        function drawIdle() {
            ctx.fillStyle = '#000'; ctx.fillRect(0,0,state.w, state.h);
            ctx.strokeStyle = '#333'; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.arc(state.w/2, state.h/2, 50, 0, Math.PI*2); ctx.stroke();
        }

        function render(ts) {
            if(state.mode !== 'running') return;
            
            const now = Date.now();
            if (state.paused) {
                state.totalPauseTime += (now - state.lastFrameTime);
            }
            state.lastFrameTime = now;
            
            // Only update logic if NOT paused
            if(!state.paused) {
                const elapsed = (now - state.startTime - state.totalPauseTime) / 1000;
                state.elapsed = elapsed;
                
                if(state.duration > 0 && elapsed >= state.duration) {
                    terminateSession();
                    return;
                }

                let p = state.prog;
                let prog = state.duration > 0 ? Math.min(1, elapsed/state.duration) : 0;
                state.currentFreq = p.freqStart + (p.freqEnd - p.freqStart) * prog;
                
                if(p.engine === 'random-hop') { const b=Math.floor(elapsed/5); if(b!==state.lastHopBucket){ state.lastHopBucket=b; state.randomHopFreq=Math.random()>0.5?5:10; } state.currentFreq=state.randomHopFreq; }
                if(p.engine === 'spectral') state.currentFreq = p.freqStart + (p.freqEnd-p.freqStart)*((Math.sin(elapsed*0.5)+1)/2);
                if(p.engine === 'lucid-protocol') { if(elapsed<600) state.currentFreq=0; else { let c=(elapsed-600)%30; state.currentFreq=(c<2)?40:0; } }

                if(Math.random()<0.001) state.ghost.tapeDrift=(Math.random()*6)-3;
                state.ghost.tapeDrift *= 0.99;
                const drift = state.ghost.tapeDrift;

                let period = state.currentFreq > 0 ? 1000/state.currentFreq : 999999;
                let phase = (ts % period) / period;

                if(audio) {
                    const ct = audio.currentTime;
                    let duty = 0;
                    
                    if(p.engine === 'lucid-protocol') duty = state.currentFreq > 0 && phase < 0.5 ? 1 : 0;
                    else if(p.strobe === 'square' || p.engine === 'gamma-burst' || p.engine === 'isochronic' || p.engine === 'random-hop') duty = phase < 0.5 ? 1 : 0;
                    else if(p.strobe === 'sine' || p.engine === 'anaesthesia') duty = (Math.sin(phase*Math.PI*2)+1)/2;
                    else if(p.engine === 'heartbeat') duty = ((now % 1000) / 1000) < 0.1 ? 1 : 0;
                    else if(p.engine === 'vagal') duty = (Math.sin(((now % 10000) / 10000) * Math.PI * 2) + 1) / 2;
                    else if(p.engine === 'noise-gate') duty = (Math.sin(elapsed * 0.1 * Math.PI * 2) + 1) / 2; // Sweep noise

                    if(p.engine === 'isochronic' || p.engine === 'anaesthesia' || p.engine === 'reset' || p.engine === 'sniper' || p.engine === 'schumann' || p.engine === 'heartbeat' || p.engine === 'distorted' || p.engine === 'vagal' || p.engine === 'noise-gate' || p.engine === 'gamma-burst' || p.engine === 'random-hop' || p.engine === 'lucid-protocol') {
                        if (p.engine !== 'noise-gate') {
                            let base = p.engine === 'sniper' ? 150 : (p.engine === 'heartbeat' ? 60 : (p.engine === 'lucid-protocol' ? 660 : 200));
                            if(oscL) oscL.frequency.setTargetAtTime(base * Math.pow(2, drift/1200), ct, 0.05);
                        }
                        pulseGain.gain.setTargetAtTime(duty * 0.16, ct, 0.01);
                    }
                    else if(p.engine === 'binaural' || p.engine === 'coma' || p.engine === 'hgh' || p.engine === 'confusion') {
                        let base = 200;
                        if(oscL) oscL.frequency.setTargetAtTime((base - state.currentFreq/2)*Math.pow(2, drift/1200), ct, 0.1);
                        if(oscR) oscR.frequency.setTargetAtTime((base + state.currentFreq/2)*Math.pow(2, drift/1200), ct, 0.1);
                    }
                    else if(p.engine === 'shepard') {
                        shepardNodes.forEach(n => {
                            let f = n.baseFreq * Math.pow(2, -((elapsed * 0.5) % 1));
                            n.osc.frequency.setTargetAtTime(f * Math.pow(2, drift/1200), ct, 0.05);
                            let dist = Math.abs(Math.log2(f/440));
                            n.g.gain.setTargetAtTime(Math.max(0, 1 - dist) * 0.3, ct, 0.05);
                        });
                    }
                    else if(p.engine === 'granular') {
                        chordNodes.forEach((o, i) => {
                             let wob = Math.sin(ts*0.002 + i) * 10;
                             o.frequency.setTargetAtTime(100 + i*50 + wob, ct, 0.1);
                        });
                    }
                    else if(p.engine === 'polymeter') {
                        const oscs = auxNodes.filter(n => n && n.frequency);
                        oscs.forEach((o,i) => o.frequency.setTargetAtTime([110,165,220][i] * (1 + 0.015*Math.sin(elapsed*(i+1))), ct, 0.1));
                    }
                    else if(p.engine === 'monaural') {
                        if(oscL) oscL.frequency.setTargetAtTime(200 - state.currentFreq/2, ct, 0.1); if(oscR) oscR.frequency.setTargetAtTime(200 + state.currentFreq/2, ct, 0.1);
                    }
                    else if(p.engine === 'spectral') {
                        if(oscL) oscL.frequency.setTargetAtTime(state.currentFreq, ct, 0.1);
                    }
                    
                    ui.railAudio.style.height = (duty * 50 + Math.random()*10) + '%';
                    ui.railStrobe.style.height = Math.min(100, Math.max(0, state.currentFreq / 40 * 100)) + '%';
                }

                let rem = state.duration - elapsed;
                ui.timer.innerText = state.duration===0 ? "INF" : Math.floor(Math.max(0,rem)/60)+":"+Math.floor(Math.max(0,rem)%60).toString().padStart(2,'0');
                if(Math.random()<0.05) state.hrv = 60 + Math.floor(Math.random()*20);
                ui.hrv.innerText = state.hrv;
                ui.status.innerText = (state.ghost.tapeDrift !== 0) ? "GHOST: DRIFT" : "GHOST: ACTIVE";

                if(Math.random() < 0.001) document.body.classList.add('glitch-anim');
                else document.body.classList.remove('glitch-anim');

                if(p.strobe === 'snow') {
                    ctx.fillStyle = '#000'; ctx.fillRect(0,0,state.w,state.h);
                    const cell = Math.max(4, Math.floor(Math.min(state.w,state.h)/120));
                    ctx.fillStyle = '#fff';
                    for(let i=0;i<700;i++) if(Math.random()<0.42) ctx.fillRect(Math.random()*state.w, Math.random()*state.h, cell, cell);
                    requestAnimationFrame(render);
                    return;
                }

                ctx.fillStyle = '#000'; ctx.fillRect(0,0,state.w, state.h);
                
                let alpha = 0;
                if(p.strobe === 'lucid') alpha = state.currentFreq > 0 && phase < 0.5 ? 1 : 0;
                else if(p.strobe === 'square') alpha = phase < 0.5 ? 1 : 0;
                else if(p.strobe === 'sine' || p.strobe === 'breathe') alpha = (Math.sin(phase*Math.PI*2)+1)/2;
                else if(p.strobe === 'static' || p.strobe === 'static-grey') alpha = 0.8;
                else if(p.strobe === 'subtle') alpha = (phase < 0.2 ? 0.3 : 0);
                else if(p.strobe === 'sweep') alpha = 1.0;

                let col = p.color;
                if(p.color === 'random') col = `hsl(${(ts / 50) % 360}, 100%, 50%)`;
                if(p.color === 'sweep') {
                    let hue = ((state.currentFreq - 200) / 400) * 300;
                    col = `hsl(${hue}, 100%, 50%)`;
                }

                ctx.save();
                ctx.globalAlpha = alpha; ctx.fillStyle = col;
                
                if(p.strobe !== 'tunnel' && p.strobe !== 'dot-only' && p.strobe !== 'center-purple' && p.strobe !== 'geo') {
                     ctx.globalAlpha = alpha * 0.1; ctx.fillRect(0,0,state.w, state.h);
                }

                ctx.globalAlpha = 1;
                if(p.strobe === 'tunnel') {
                    ctx.strokeStyle = col; ctx.lineWidth = 2; let offset = (ts / 10) % 100;
                    for(let r=offset; r < Math.max(state.w, state.h); r+=100) { ctx.beginPath(); ctx.arc(state.w/2, state.h/2, r, 0, Math.PI*2); ctx.stroke(); }
                }
                else if(p.strobe === 'kaleido' || p.strobe === 'geo') {
                    ctx.translate(state.w/2, state.h/2); ctx.rotate(ts * 0.001); ctx.fillStyle = col;
                    for(let i=0; i<6; i++) { ctx.rotate(Math.PI/3); ctx.fillRect(50, -10, 200, 20); }
                }
                else {
                     let breath = (Math.sin(now/10000 * Math.PI*2) + 1)/2;
                     let eyeSize = 40 + (breath * 40);
                     if(p.strobe === 'dot-only' || p.strobe === 'center-purple') eyeSize = 20;
                     if(p.strobe === 'troxler-void') {
                         let fade = Math.max(0, 1 - (state.elapsed / 300));
                         ctx.fillStyle = `rgba(0, 255, 255, ${fade})`;
                     } else {
                         ctx.fillStyle = col;
                     }
                     ctx.beginPath(); ctx.arc(state.w/2, state.h/2, eyeSize, 0, Math.PI*2); ctx.fill();
                }

                ctx.strokeStyle = '#111'; ctx.lineWidth = 1;
                ctx.beginPath(); ctx.moveTo(state.w/2, 0); ctx.lineTo(state.w/2, state.h); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(0, state.h/2); ctx.lineTo(state.w, state.h/2); ctx.stroke();
                ctx.restore();
            }

            requestAnimationFrame(render);
        }
