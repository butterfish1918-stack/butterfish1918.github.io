/**
         * ORION-TRANCE TERMINAL v6.4 MOBILE
         * Suspension Control & Streamlined Architecture (Airlock Removed)
         */

        const state = {
            mode: 'manifest', // manifest, idle, running
            prog: null,
            duration: 0,
            startTime: 0,
            elapsed: 0,
            currentFreq: 0,
            w: 0, h: 0,
            
            // Pausing System
            paused: false,
            totalPauseTime: 0,
            lastFrameTime: 0,
            
            ghost: { tapeDrift: 0, glitchActive: false },
            hrv: 65,
            lastHopBucket: -1,
            randomHopFreq: 5
        };

        const canvas = document.getElementById('dreamCanvas');
        const ctx = canvas.getContext('2d', { alpha: false });
        const resize = () => {
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            state.w = window.innerWidth; state.h = window.innerHeight;
            canvas.width = Math.max(1, Math.floor(state.w * dpr));
            canvas.height = Math.max(1, Math.floor(state.h * dpr));
            canvas.style.width = state.w + 'px'; canvas.style.height = state.h + 'px';
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        };
        window.addEventListener('resize', resize); resize();

        let audio, master, oscL, oscR, pulseGain;
        let shepardNodes = [], chordNodes = [], auxNodes = [], noiseNodes = [];
        let wakeLock = null;
        let deferredInstallPrompt = null;

        const ui = {
            manifest: document.getElementById('manifest'),
            cockpit: document.getElementById('cockpit-ui'),
            manual: document.getElementById('manual-overlay'),
            armCont: document.getElementById('arm-container'),
            armBolt: document.getElementById('arm-bolt'),
            railAudio: document.getElementById('rail-audio'),
            railStrobe: document.getElementById('rail-strobe'),
            hrv: document.getElementById('hrv-val'),
            timer: document.getElementById('timer-val'),
            status: document.getElementById('hud-status'),
            pauseOverlay: document.getElementById('pause-overlay')
        };

        // --- INIT MANIFEST ---
        const progSelect = document.getElementById('prog-select');
        let cats = {};
        for(let k in PROGRAMMES) { 
            let c = PROGRAMMES[k].cat; 
            if(!cats[c]) cats[c]=[]; 
            cats[c].push(k); 
        }
        for(let c in cats) {
            let grp = document.createElement('optgroup'); grp.label = c;
            cats[c].forEach(k => {
                let o = document.createElement('option'); o.value=k; o.innerText=PROGRAMMES[k].name;
                grp.appendChild(o);
            });
            progSelect.appendChild(grp);
        }
        progSelect.addEventListener('change', () => document.getElementById('prog-desc').innerText = PROGRAMMES[progSelect.value].desc);
        document.getElementById('prog-desc').innerText = PROGRAMMES[progSelect.value].desc;

        // Manual Generation
        const manContent = document.getElementById('manual-content');
        for(let c in cats) {
            let h = document.createElement('div'); h.className='man-header'; h.innerText=c; manContent.appendChild(h);
            cats[c].forEach(k => {
                let p = PROGRAMMES[k];
                let d = document.createElement('div'); d.className='manual-text';
                d.innerHTML = `<strong style="color:#fff">${p.name}</strong><br>GOAL: ${p.man.goal}<br>AUDIO: ${p.man.audio}<br>VISUAL: ${p.man.visual}<br><br>`;
                manContent.appendChild(d);
            });
        }

        // --- NAVIGATION ---
        document.getElementById('manual-btn').onclick = () => { ui.manifest.classList.add('hidden'); ui.manual.classList.remove('hidden'); };
        document.getElementById('close-manual').onclick = () => { ui.manual.classList.add('hidden'); ui.manifest.classList.remove('hidden'); };
        document.getElementById('load-btn').onclick = enterCockpit;

        // --- SLIDE TO ARM LOGIC ---
        let isDragging = false;
        let startX = 0;
        ui.armBolt.addEventListener('pointerdown', startDrag);
        window.addEventListener('pointermove', doDrag, {passive: false});
        window.addEventListener('pointerup', endDrag);
        window.addEventListener('pointercancel', endDrag);
        function startDrag(e) {
            isDragging = true;
            ui.armBolt.setPointerCapture?.(e.pointerId);
            startX = e.clientX - ui.armBolt.offsetLeft;
            ensureAudioContext();
            if(audio && audio.state === 'suspended') audio.resume().catch(()=>{});
        }

        function doDrag(e) {
            if(!isDragging) return;
            e.preventDefault();
            let x = e.clientX - startX;
            let max = ui.armCont.clientWidth - ui.armBolt.clientWidth;
            if(x < 0) x = 0; if(x > max) x = max;
            ui.armBolt.style.left = x + 'px';
            if(Math.round(x) % 18 === 0 && navigator.vibrate) navigator.vibrate(4);
            if(x >= max - 2) {
                isDragging = false;
                initiateProtocol();
            }
        }

        function endDrag() {
            if(!isDragging) return;
            isDragging = false;
            ui.armBolt.style.transition = 'left 0.2s'; ui.armBolt.style.left = '0px';
            setTimeout(() => ui.armBolt.style.transition = 'none', 200);
        }

        // --- CORE ENGINE ---

        function enterCockpit() {
            let k = progSelect.value;
            state.prog = PROGRAMMES[k];
            let d = document.getElementById('duration-select').value;
            state.duration = d === 'auto' ? state.prog.duration : (d === 'infinite' ? 0 : parseInt(d));
            
            ui.manifest.classList.add('hidden');
            ui.cockpit.classList.remove('hidden');
            state.mode = 'idle';
            ui.status.innerText = "IDLE";
            drawIdle();
        }

        function initiateProtocol() {
            if(navigator.vibrate) navigator.vibrate(50);
            state.mode = 'running';
            
            state.paused = false;
            state.totalPauseTime = 0;
            state.startTime = Date.now();
            state.lastFrameTime = state.startTime;
            state.elapsed = 0;
            state.lastHopBucket = -1;
            state.randomHopFreq = 5;
            
            ui.armCont.classList.add('hidden');
            document.getElementById('active-controls').classList.remove('hidden');
            ui.status.innerText = "GHOST: ACTIVE";
            
            ensureAudioContext();
            if(audio && audio.state === 'suspended') audio.resume().catch(()=>{});
            setupEngine(state.prog);
            if(state.prog.noise && state.prog.noise !== 'none') createNoise(state.prog.noise);
            requestWakeLock();

            requestAnimationFrame(render);
        }
        function terminateSession() {
            state.mode = 'manifest';
            state.paused = false;
            releaseWakeLock();

            const closingAudio = audio;
            const closingMaster = master;
            if(closingAudio && closingMaster) {
                try { closingMaster.gain.setTargetAtTime(0, closingAudio.currentTime, 0.05); } catch(e) {}
                setTimeout(() => { try { closingAudio.close(); } catch(e) {} }, 150);
            }
            audio = master = pulseGain = oscL = oscR = null;
            shepardNodes = []; chordNodes = []; auxNodes = []; noiseNodes = [];

            ui.cockpit.classList.add('hidden');
            document.getElementById('active-controls').classList.add('hidden');
            ui.armCont.classList.remove('hidden');
            ui.armBolt.style.left = '0px';
            const btn = document.getElementById('pause-btn');
            btn.innerText = "PAUSE"; btn.classList.remove('paused');
            ui.pauseOverlay.style.display = 'none';
            ui.manifest.classList.remove('hidden');
            ctx.fillStyle = '#000'; ctx.fillRect(0,0,state.w, state.h);
        }

        // SUSPENSION CONTROLS
        document.getElementById('pause-btn').onclick = () => {
            if(state.mode !== 'running') return;
            state.paused = !state.paused;
            const btn = document.getElementById('pause-btn');
            
            if(state.paused) {
                if(audio) audio.suspend().catch(()=>{});
                releaseWakeLock();
                btn.innerText = "RESUME";
                btn.classList.add('paused');
                ui.pauseOverlay.style.display = 'block';
                ui.status.innerText = "SYSTEM PAUSED";
            } else {
                if(audio) audio.resume().catch(()=>{});
                requestWakeLock();
                btn.innerText = "PAUSE";
                btn.classList.remove('paused');
                ui.pauseOverlay.style.display = 'none';
                ui.status.innerText = "GHOST: ACTIVE";
            }
        };

        document.getElementById('stop-btn').onclick = terminateSession;

        