const engineStatus = document.getElementById('engine-status');

document.getElementById('start-btn').addEventListener('click', async () => {
    initAudio();
    if (audioCtx && audioCtx.state === 'suspended') {
        try { await audioCtx.resume(); } catch (_) {}
    }

    isRunning = true;
    document.body.classList.add('running');
    if (engineStatus) engineStatus.lastChild.textContent = ' Engine active';

    const overlay = document.getElementById('start-overlay');
    overlay.style.opacity = 0;
    overlay.style.pointerEvents = 'none';
    window.setTimeout(() => overlay.remove(), 850);
    draw();
});

window.addEventListener('pointerdown', () => {
    if (isRunning && audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => {});
    }
}, { capture: true, passive: true });

document.addEventListener('visibilitychange', () => {
    if (!document.hidden && isRunning && audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => {});
    }
});

let resizeTimer = null;
window.addEventListener('resize', () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(setupElements, 80);
});
window.addEventListener('orientationchange', () => {
    window.setTimeout(setupElements, 120);
});

let deferredInstallPrompt = null;
const installBtn = document.getElementById('install-btn');

window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredInstallPrompt = e;
    installBtn.hidden = false;
});

installBtn.addEventListener('click', async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    try { await deferredInstallPrompt.userChoice; } catch (_) {}
    deferredInstallPrompt = null;
    installBtn.hidden = true;
});

window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    installBtn.hidden = true;
});

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(() => {});
    });
}

setupElements();
