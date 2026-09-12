// --- ANDROID / PWA INTEGRATION ---
        async function requestWakeLock() {
            if(!('wakeLock' in navigator) || state.mode !== 'running' || state.paused || document.visibilityState !== 'visible') return;
            try { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; }); } catch(e) {}
        }
        async function releaseWakeLock() {
            if(wakeLock) { try { await wakeLock.release(); } catch(e) {} wakeLock = null; }
        }
        document.addEventListener('visibilitychange', () => {
            if(document.visibilityState === 'visible' && state.mode === 'running' && !state.paused) {
                if(audio && audio.state === 'suspended') audio.resume().catch(()=>{});
                requestWakeLock();
            }
        });
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault(); deferredInstallPrompt = e;
            document.getElementById('install-btn').classList.add('visible');
        });
        document.getElementById('install-btn').addEventListener('click', async () => {
            if(!deferredInstallPrompt) return;
            deferredInstallPrompt.prompt();
            try { await deferredInstallPrompt.userChoice; } catch(e) {}
            deferredInstallPrompt = null;
            document.getElementById('install-btn').classList.remove('visible');
        });
        window.addEventListener('appinstalled', () => {
            deferredInstallPrompt = null;
            document.getElementById('install-btn').classList.remove('visible');
        });
        if('serviceWorker' in navigator) {
            window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(()=>{}));
        }
