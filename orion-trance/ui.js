/**
 * ORION-TRANCE TERMINAL v6.5
 * Professional UI layer / mobile-safe controls
 */

const state = {
  mode: 'manifest',
  prog: null,
  duration: 0,
  startTime: 0,
  elapsed: 0,
  currentFreq: 0,
  w: 0, h: 0,
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
  pauseOverlay: document.getElementById('pause-overlay'),
  idleControls: document.getElementById('idle-controls'),
  cockpitProgram: document.getElementById('cockpit-program')
};

const progSelect = document.getElementById('prog-select');
const durationSelect = document.getElementById('duration-select');
let cats = {};
for (let k in PROGRAMMES) {
  const c = PROGRAMMES[k].cat;
  if (!cats[c]) cats[c] = [];
  cats[c].push(k);
}
for (let c in cats) {
  const grp = document.createElement('optgroup'); grp.label = c;
  cats[c].forEach(k => {
    const o = document.createElement('option');
    o.value = k; o.innerText = PROGRAMMES[k].name;
    grp.appendChild(o);
  });
  progSelect.appendChild(grp);
}

function formatDuration(seconds) {
  if (!seconds) return 'INF';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

function selectedDurationFor(p) {
  const d = durationSelect.value;
  return d === 'auto' ? p.duration : (d === 'infinite' ? 0 : parseInt(d));
}

function refreshProtocolBrief() {
  const p = PROGRAMMES[progSelect.value];
  if (!p) return;
  document.getElementById('prog-desc').innerText = p.desc;
  document.getElementById('prog-cat').innerText = p.cat;
  document.getElementById('prog-duration').innerText = formatDuration(selectedDurationFor(p));
  document.getElementById('prog-goal').innerText = p.man.goal;
  document.getElementById('prog-audio').innerText = p.man.audio;
  document.getElementById('prog-visual').innerText = p.man.visual;
}
progSelect.addEventListener('change', refreshProtocolBrief);
durationSelect.addEventListener('change', refreshProtocolBrief);
refreshProtocolBrief();

const manContent = document.getElementById('manual-content');
for (let c in cats) {
  const h = document.createElement('div');
  h.className = 'man-header'; h.innerText = c; manContent.appendChild(h);
  cats[c].forEach(k => {
    const p = PROGRAMMES[k];
    const d = document.createElement('div'); d.className = 'manual-text';
    d.innerHTML = `<strong>${p.name}</strong><br>GOAL&nbsp;&nbsp; ${p.man.goal}<br>AUDIO&nbsp; ${p.man.audio}<br>VISUAL ${p.man.visual}`;
    manContent.appendChild(d);
  });
}

document.getElementById('manual-btn').onclick = () => {
  ui.manifest.classList.add('hidden'); ui.manual.classList.remove('hidden');
};
document.getElementById('close-manual').onclick = () => {
  ui.manual.classList.add('hidden'); ui.manifest.classList.remove('hidden');
};
document.getElementById('load-btn').onclick = enterCockpit;
document.getElementById('cockpit-back-btn').onclick = exitIdleCockpit;

let isDragging = false;
let startX = 0;
ui.armBolt.addEventListener('pointerdown', startDrag);
window.addEventListener('pointermove', doDrag, { passive: false });
window.addEventListener('pointerup', endDrag);
window.addEventListener('pointercancel', endDrag);

function startDrag(e) {
  isDragging = true;
  ui.armBolt.setPointerCapture?.(e.pointerId);
  startX = e.clientX - ui.armBolt.offsetLeft;
  ensureAudioContext();
  if (audio && audio.state === 'suspended') audio.resume().catch(() => {});
}

function doDrag(e) {
  if (!isDragging) return;
  e.preventDefault();
  let x = e.clientX - startX;
  const max = ui.armCont.clientWidth - ui.armBolt.clientWidth;
  if (x < 0) x = 0; if (x > max) x = max;
  ui.armBolt.style.left = x + 'px';
  if (Math.round(x) % 18 === 0 && navigator.vibrate) navigator.vibrate(4);
  if (x >= max - 2) {
    isDragging = false;
    initiateProtocol();
  }
}

function endDrag() {
  if (!isDragging) return;
  isDragging = false;
  ui.armBolt.style.transition = 'left .2s';
  ui.armBolt.style.left = '0px';
  setTimeout(() => ui.armBolt.style.transition = 'none', 200);
}

function enterCockpit() {
  const k = progSelect.value;
  state.prog = PROGRAMMES[k];
  state.duration = selectedDurationFor(state.prog);
  ui.manifest.classList.add('hidden');
  ui.cockpit.classList.remove('hidden');
  ui.idleControls.classList.remove('hidden');
  state.mode = 'idle';
  ui.status.innerText = 'IDLE / AWAITING ARM';
  ui.cockpitProgram.innerText = `${state.prog.cat} / ${state.prog.name}`;
  ui.timer.innerText = state.duration === 0 ? 'INF' : formatDuration(state.duration);
  ui.hrv.innerText = '--';
  drawIdle();
}

function exitIdleCockpit() {
  if (state.mode !== 'idle') return;
  state.mode = 'manifest';
  ui.cockpit.classList.add('hidden');
  ui.manifest.classList.remove('hidden');
  ui.armBolt.style.left = '0px';
  ctx.fillStyle = '#000'; ctx.fillRect(0,0,state.w,state.h);
}

function initiateProtocol() {
  if (navigator.vibrate) navigator.vibrate(50);
  state.mode = 'running';
  state.paused = false;
  state.totalPauseTime = 0;
  state.startTime = Date.now();
  state.lastFrameTime = state.startTime;
  state.elapsed = 0;
  state.lastHopBucket = -1;
  state.randomHopFreq = 5;

  ui.armCont.classList.add('hidden');
  ui.idleControls.classList.add('hidden');
  document.getElementById('active-controls').classList.remove('hidden');
  ui.status.innerText = 'GHOST / ACTIVE';

  ensureAudioContext();
  if (audio && audio.state === 'suspended') audio.resume().catch(() => {});
  setupEngine(state.prog);
  if (state.prog.noise && state.prog.noise !== 'none') createNoise(state.prog.noise);
  requestWakeLock();
  requestAnimationFrame(render);
}

function terminateSession() {
  state.mode = 'manifest';
  state.paused = false;
  releaseWakeLock();

  const closingAudio = audio;
  const closingMaster = master;
  if (closingAudio && closingMaster) {
    try { closingMaster.gain.setTargetAtTime(0, closingAudio.currentTime, .05); } catch(e) {}
    setTimeout(() => { try { closingAudio.close(); } catch(e) {} }, 150);
  }
  audio = master = pulseGain = oscL = oscR = null;
  shepardNodes = []; chordNodes = []; auxNodes = []; noiseNodes = [];

  ui.cockpit.classList.add('hidden');
  document.getElementById('active-controls').classList.add('hidden');
  ui.idleControls.classList.remove('hidden');
  ui.armCont.classList.remove('hidden');
  ui.armBolt.style.left = '0px';

  const btn = document.getElementById('pause-btn');
  btn.innerText = 'PAUSE'; btn.classList.remove('paused');
  ui.pauseOverlay.style.display = 'none';
  ui.manifest.classList.remove('hidden');
  ctx.fillStyle = '#000'; ctx.fillRect(0,0,state.w,state.h);
}

document.getElementById('pause-btn').onclick = () => {
  if (state.mode !== 'running') return;
  state.paused = !state.paused;
  const btn = document.getElementById('pause-btn');
  if (state.paused) {
    if (audio) audio.suspend().catch(() => {});
    releaseWakeLock();
    btn.innerText = 'RESUME'; btn.classList.add('paused');
    ui.pauseOverlay.style.display = 'block';
    ui.status.innerText = 'SYSTEM / PAUSED';
  } else {
    if (audio) audio.resume().catch(() => {});
    requestWakeLock();
    btn.innerText = 'PAUSE'; btn.classList.remove('paused');
    ui.pauseOverlay.style.display = 'none';
    ui.status.innerText = 'GHOST / ACTIVE';
  }
};

document.getElementById('stop-btn').onclick = terminateSession;
