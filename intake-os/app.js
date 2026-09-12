// --- APP LOGIC ---

function loadSettings() {
    try {
        const saved = JSON.parse(localStorage.getItem('intake-os-settings') || '{}');
        if (Number.isFinite(saved.duration)) document.getElementById('duration-input').value = Math.min(60, Math.max(1, saved.duration));
        if (typeof saved.audio === 'boolean') document.getElementById('audio-toggle').checked = saved.audio;
        if (typeof saved.haptics === 'boolean') document.getElementById('haptics-toggle').checked = saved.haptics;
        if (typeof saved.wake === 'boolean') document.getElementById('wake-toggle').checked = saved.wake;
    } catch (_) {}
}

function saveSettings() {
    const duration = Math.min(60, Math.max(1, Number(document.getElementById('duration-input').value) || 5));
    document.getElementById('duration-input').value = duration;
    STATE.audioEnabled = document.getElementById('audio-toggle').checked;
    STATE.hapticsEnabled = document.getElementById('haptics-toggle').checked;
    STATE.keepAwake = document.getElementById('wake-toggle').checked;
    try {
        localStorage.setItem('intake-os-settings', JSON.stringify({ duration, audio: STATE.audioEnabled, haptics: STATE.hapticsEnabled, wake: STATE.keepAwake }));
    } catch (_) {}
}

function init() {
    loadSettings();
    saveSettings();
    populateMenu();
    Visuals.init();
    setupInstallPrompt();
    registerServiceWorker();
    document.addEventListener('visibilitychange', async () => {
        if (document.visibilityState === 'visible' && STATE.active && STATE.keepAwake) await requestWakeLock();
    });
    requestAnimationFrame(renderLoop);
}

function populateMenu() {
    const container = document.getElementById('protocol-container');
    container.innerHTML = '';
    Object.keys(CATEGORIES).forEach(catKey => {
        const details = document.createElement('details');
        details.className = 'category';
        details.open = true;
        const summary = document.createElement('summary');
        summary.innerText = CATEGORIES[catKey];
        details.appendChild(summary);
        const list = document.createElement('div');
        list.className = 'protocol-list';
        PROTOCOLS.filter(p => p.cat === catKey).forEach(p => {
            const item = document.createElement('div');
            item.className = 'protocol-item';
            item.setAttribute('role', 'button');
            item.tabIndex = 0;
            item.innerHTML = `<span class="p-name">${p.name}</span><span class="p-desc">${p.desc}</span><span class="p-meta">${p.meta}</span>`;
            const activate = () => selectProtocol(p);
            item.addEventListener('click', activate);
            item.addEventListener('keydown', e => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(); }
            });
            list.appendChild(item);
        });
        details.appendChild(list);
        container.appendChild(details);
    });
}

function selectProtocol(p) {
    saveSettings();
    STATE.protocol = p;
    STATE.durationLimit = Math.min(60, Math.max(1, Number(document.getElementById('duration-input').value) || 5)) * 60;
    startSession();
}

async function requestWakeLock() {
    if (!STATE.keepAwake || !('wakeLock' in navigator) || document.visibilityState !== 'visible') return;
    try {
        if (STATE.wakeLock) return;
        STATE.wakeLock = await navigator.wakeLock.request('screen');
        STATE.wakeLock.addEventListener('release', () => { STATE.wakeLock = null; });
    } catch (_) { STATE.wakeLock = null; }
}

async function releaseWakeLock() {
    if (!STATE.wakeLock) return;
    try { await STATE.wakeLock.release(); } catch (_) {}
    STATE.wakeLock = null;
}

function cycleDefinition(p) {
    return [['IN', Number(p.in) || 0], ['HOLD_IN', Number(p.holdIn) || 0], ['OUT', Number(p.out) || 0], ['HOLD_OUT', Number(p.holdOut) || 0]].filter(([, duration]) => duration > 0);
}

function getCycleState(p, elapsed) {
    if (p.id === 'DIVER') return { phase: 'HOLD_OUT', progress: Math.min(elapsed / STATE.durationLimit, 1), cycles: 0 };
    const phases = cycleDefinition(p);
    const cycleDuration = phases.reduce((sum, [, d]) => sum + d, 0);
    if (!cycleDuration || !phases.length) return { phase: 'IN', progress: 0, cycles: 0 };
    const cycles = Math.floor(elapsed / cycleDuration);
    let cursor = elapsed % cycleDuration;
    for (const [phase, duration] of phases) {
        if (cursor < duration) return { phase, progress: Math.min(cursor / duration, 1), cycles };
        cursor -= duration;
    }
    const [phase, duration] = phases[phases.length - 1];
    return { phase, progress: duration ? 1 : 0, cycles };
}

function triggerPhaseFeedback(phase) {
    AudioEngine.playPhaseTone(phase);
    if (STATE.hapticsEnabled && navigator.vibrate) navigator.vibrate(18);
    const label = document.getElementById('phase-label');
    const newColor = PHASE_COLORS[phase] || '#fff';
    label.style.borderColor = newColor;
    label.style.boxShadow = `0 0 10px ${newColor}40`;
    label.style.color = newColor;
}

function startSession() {
    if (STATE.active || !STATE.protocol) return;
    STATE.active = true;
    STATE.phase = STATE.protocol.id === 'DIVER' ? 'HOLD_OUT' : (cycleDefinition(STATE.protocol)[0]?.[0] || 'IN');
    STATE.startTime = Date.now();
    STATE.phaseStartTime = STATE.startTime;
    STATE.totalCycles = 0;
    STATE.color = STATE.protocol.color;
    document.getElementById('menu-layer').classList.add('hidden');
    document.getElementById('active-hud').style.opacity = 1;
    document.getElementById('current-mode-name').innerText = STATE.protocol.name.toUpperCase();
    document.getElementById('sound-btn').innerText = `AUDIO: ${STATE.audioEnabled ? 'ON' : 'OFF'}`;
    document.getElementById('sound-btn').setAttribute('aria-pressed', String(STATE.audioEnabled));
    AudioEngine.setup(STATE.protocol);
    triggerPhaseFeedback(STATE.phase);
    requestWakeLock();
}

function stopSession() {
    STATE.active = false;
    AudioEngine.stop();
    releaseWakeLock();
    document.getElementById('menu-layer').classList.remove('hidden');
    document.getElementById('active-hud').style.opacity = 0;
    document.getElementById('canvas-container').style.filter = 'blur(15px) contrast(30)';
    document.getElementById('breath-guide').style.transform = 'translate(-50%, -50%) scale(1)';
}

document.getElementById('stop-btn').addEventListener('click', stopSession);
document.getElementById('sound-btn').addEventListener('click', () => {
    STATE.audioEnabled = !STATE.audioEnabled;
    document.getElementById('audio-toggle').checked = STATE.audioEnabled;
    saveSettings();
    if (AudioEngine.ctx && AudioEngine.masterGain) AudioEngine.masterGain.gain.setTargetAtTime(STATE.audioEnabled ? 0.5 : 0, AudioEngine.ctx.currentTime, 0.02);
    if (STATE.audioEnabled && STATE.protocol && (!AudioEngine.ctx || !AudioEngine.type)) AudioEngine.setup(STATE.protocol);
    const btn = document.getElementById('sound-btn');
    btn.innerText = `AUDIO: ${STATE.audioEnabled ? 'ON' : 'OFF'}`;
    btn.setAttribute('aria-pressed', String(STATE.audioEnabled));
});

['duration-input', 'audio-toggle', 'haptics-toggle', 'wake-toggle'].forEach(id => document.getElementById(id).addEventListener('change', saveSettings));
window.addEventListener('keydown', e => { if (e.key === 'Escape' && STATE.active) stopSession(); });

function formatTime(s) {
    const min = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${min.toString().padStart(2,'0')}:${sec.toString().padStart(2,'0')}`;
}

function setupInstallPrompt() {
    const button = document.getElementById('install-btn');
    window.addEventListener('beforeinstallprompt', e => {
        e.preventDefault();
        STATE.installPrompt = e;
        button.classList.remove('hidden');
    });
    button.addEventListener('click', async () => {
        if (!STATE.installPrompt) return;
        STATE.installPrompt.prompt();
        try { await STATE.installPrompt.userChoice; } catch (_) {}
        STATE.installPrompt = null;
        button.classList.add('hidden');
    });
    window.addEventListener('appinstalled', () => { STATE.installPrompt = null; button.classList.add('hidden'); });
}

function registerServiceWorker() {
    if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}), { once: true });
}

function renderLoop() {
    requestAnimationFrame(renderLoop);
    if (!STATE.active || !STATE.protocol) return;
    const now = Date.now();
    const sessionElapsed = Math.max(0, (now - STATE.startTime) / 1000);
    if (sessionElapsed >= STATE.durationLimit) { stopSession(); return; }
    const p = STATE.protocol;
    const cycle = getCycleState(p, sessionElapsed);
    const previousPhase = STATE.phase;
    STATE.phase = cycle.phase;
    STATE.totalCycles = cycle.cycles;
    const progress = cycle.progress;
    if (STATE.phase !== previousPhase) triggerPhaseFeedback(STATE.phase);
    const remaining = Math.max(0, STATE.durationLimit - sessionElapsed);
    document.getElementById('timer').innerText = formatTime(remaining);
    let labelText = STATE.phase;
    if (p.id === 'DIVER') labelText = 'HOLD / APNEA';
    else if(labelText === 'IN') labelText = 'INHALE';
    else if(labelText === 'OUT') labelText = 'EXHALE';
    else if(labelText === 'HOLD_IN') labelText = 'HOLD (FULL)';
    else if(labelText === 'HOLD_OUT') labelText = 'HOLD (EMPTY)';
    document.getElementById('phase-label').innerText = labelText;
    document.getElementById('litres-display').innerText = p.id === 'DIVER' ? `ELAPSED: ${formatTime(sessionElapsed)}` : `CYCLES: ${STATE.totalCycles}`;
    document.getElementById('freq-display').innerText = `AUDIO: ${STATE.audioEnabled ? p.audio : 'MUTED'}`;
    let scale = 1;
    const guide = document.getElementById('breath-guide');
    if (p.id === 'DIVER') scale = 1.0 + Math.sin(Date.now()*0.003)*0.02;
    else if (STATE.phase === 'IN') scale = 1.0 + (progress * 0.5);
    else if (STATE.phase === 'HOLD_IN') scale = 1.5 + Math.sin(Date.now()*0.005)*0.02;
    else if (STATE.phase === 'OUT') scale = 1.5 - (progress * 0.5);
    else if (STATE.phase === 'HOLD_OUT') scale = 1.0 + Math.sin(Date.now()*0.005)*0.02;
    guide.style.transform = `translate(-50%, -50%) scale(${scale})`;
    guide.style.borderColor = STATE.color;
    AudioEngine.update(progress, STATE.phase);
    Visuals.render(STATE.phase, progress, p.physics);
}

init();
