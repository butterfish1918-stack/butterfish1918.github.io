import * as THREE from 'https://esm.sh/three@0.180.0';
import * as Tone from 'https://esm.sh/tone@15.1.22';

import { MOOD_MATRIX } from './moods-v4.js?v=4.0';

const el = (id) => document.getElementById(id);
const ui = {
  app: el('app'), scene: el('scene'), veil: el('veil'), architecture: el('architecture'), entropy: el('entropy'),
  nodeId: el('nodeId'), startPanel: el('startPanel'), moodPanel: el('moodPanel'), initialise: el('initialise'),
  startError: el('startError'), runtimeError: el('runtimeError'), suiteLabel: el('suiteLabel'), moodName: el('moodName'),
  moodSubtitle: el('moodSubtitle'), nodeTag: el('nodeTag'), signal: el('signal'), previous: el('previous'), next: el('next'),
  playPause: el('playPause'), transportIcon: el('transportIcon'), transportLabel: el('transportLabel'),
  livePill: el('livePill'), liveLabel: el('liveLabel'), suiteNav: el('suiteNav'), nodeDots: el('nodeDots'),
  paramNoise: el('paramNoise'), paramTingle: el('paramTingle'), paramWet: el('paramWet'), paramBreath: el('paramBreath'),
  footerSuite: el('footerSuite'),
};

let isInitialised = false;
let isPlaying = false;
let isStarting = false;
let currentMood = MOOD_MATRIX[15];
let entropy = 20;
let audioEngine = null;
let audioFrame = 0;
let wakeLock = null;
let pulseNode = () => {};

function hexToRgb(hex) {
  const value = hex.replace('#', '');
  const full = value.length === 3 ? value.split('').map((c) => c + c).join('') : value;
  const num = Number.parseInt(full, 16);
  return `${(num >> 16) & 255},${(num >> 8) & 255},${num & 255}`;
}

MOOD_MATRIX.forEach((mood) => {
  const button = document.createElement('button');
  button.className = 'node-dot';
  button.type = 'button';
  button.dataset.node = String(mood.id);
  button.setAttribute('aria-label', `Select ${mood.name}`);
  button.textContent = String(mood.id).padStart(2, '0');
  button.addEventListener('click', () => selectMood(mood));
  ui.nodeDots.appendChild(button);
});

function showError(target, message = '') {
  target.textContent = message;
  target.classList.toggle('hidden', !message);
}

function renderMood() {
  const rgb = hexToRgb(currentMood.node);
  ui.app.style.setProperty('--accent', currentMood.node);
  ui.app.style.setProperty('--accent-rgb', rgb);
  ui.app.style.backgroundColor = isInitialised ? currentMood.color : '#000000';
  ui.architecture.textContent = `Architecture · v4.0 / ${isPlaying ? 'Active' : 'Suspended'}`;
  ui.livePill.dataset.live = String(isPlaying);
  ui.liveLabel.textContent = isPlaying ? 'Audio active' : 'Audio suspended';
  ui.nodeId.textContent = String(currentMood.id).padStart(2, '0');
  ui.nodeTag.textContent = `Node ${String(currentMood.id).padStart(2, '0')}`;
  ui.suiteLabel.textContent = `${currentMood.suite} suite`;
  ui.footerSuite.textContent = `${currentMood.suite} suite`;
  ui.moodName.textContent = currentMood.name;
  ui.moodSubtitle.textContent = `${currentMood.freq} Hz stochastic attractor · ${currentMood.noise} spectrum`;
  ui.paramNoise.textContent = currentMood.noise[0].toUpperCase() + currentMood.noise.slice(1);
  ui.paramTingle.textContent = `${currentMood.tingle}%`;
  ui.paramWet.textContent = `${Math.round(currentMood.wet * 100)}%`;
  ui.paramBreath.textContent = currentMood.breath ? 'On' : 'Off';
  ui.signal.style.backgroundColor = currentMood.node;
  ui.transportLabel.textContent = isPlaying ? 'Collapse activity' : 'Re-engage';
  ui.playPause.setAttribute('aria-label', isPlaying ? 'Pause audio' : 'Resume audio');
  ui.transportIcon.className = isPlaying ? 'pause-icon' : 'play-icon';
  ui.veil.style.backgroundColor = isPlaying ? 'rgba(0,0,0,0.07)' : 'rgba(0,0,0,0.80)';
  ui.veil.style.backdropFilter = `blur(${Math.min(15, entropy * .75)}px) saturate(${isPlaying ? 1.42 : 0.5})`;
  ui.moodPanel.style.opacity = String(Math.max(0.3, 1 - entropy / 35));
  document.querySelectorAll('.suite-button').forEach((button) => button.classList.toggle('active', button.dataset.suite === currentMood.suite));
  document.querySelectorAll('.node-dot').forEach((button) => button.classList.toggle('active', Number(button.dataset.node) === currentMood.id));
}

function renderEntropy() {
  ui.entropy.textContent = entropy.toFixed(5);
  ui.veil.style.backdropFilter = `blur(${Math.min(15, entropy * .75)}px) saturate(${isPlaying ? 1.42 : 0.5})`;
  ui.moodPanel.style.opacity = String(Math.max(0.3, 1 - entropy / 35));
}

async function requestWakeLock() {
  if (!('wakeLock' in navigator) || document.visibilityState !== 'visible' || wakeLock) return;
  try {
    wakeLock = await navigator.wakeLock.request('screen');
    wakeLock.addEventListener('release', () => { wakeLock = null; });
  } catch { /* Wake Lock is optional. */ }
}

async function releaseWakeLock() {
  if (!wakeLock) return;
  try { await wakeLock.release(); } catch { /* no-op */ }
  wakeLock = null;
}

function disposeAudioEngine() {
  if (!audioEngine) return;
  const disposed = new Set();
  Object.values(audioEngine).forEach((node) => {
    if (node && typeof node.dispose === 'function' && !disposed.has(node)) {
      disposed.add(node);
      try { node.dispose(); } catch { /* no-op */ }
    }
  });
  audioEngine = null;
}

async function initialiseAudio() {
  if (audioEngine || isStarting) return;
  isStarting = true;
  ui.initialise.disabled = true;
  ui.initialise.querySelector('span').textContent = 'Opening audio context';
  showError(ui.startError);

  try {
    await Tone.start();
    const ctx = Tone.getContext();
    if (ctx.state !== 'running') await ctx.resume();

    const droneNoise = new Tone.Noise(currentMood.noise);
    droneNoise.volume.value = -22;
    const droneFilter = new Tone.Filter(currentMood.freq, 'lowpass', -24);

    const crinkleSynth = new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.001, decay: 0.03, sustain: 0, release: 0.015 },
      volume: -24,
    });
    const crinkleFilter = new Tone.Filter(6000, 'bandpass');
    crinkleFilter.Q.value = 5;
    const crinklePanner = new Tone.AutoPanner({ frequency: 0.45, depth: 0.75 }).start();

    const clickSynth = new Tone.Synth({
      oscillator: { type: 'sine' },
      envelope: { attack: 0.001, decay: 0.02, sustain: 0, release: 0.01 },
      volume: -25,
    });
    const haasDelay = new Tone.PingPongDelay({ delayTime: 0.012, feedback: 0.12, wet: 0.55 });

    const breathNoise = new Tone.Noise('pink');
    breathNoise.volume.value = -31;
    const f1 = new Tone.Filter(500, 'bandpass').set({ Q: 8 });
    const f2 = new Tone.Filter(1500, 'bandpass').set({ Q: 10 });
    const f3 = new Tone.Filter(2500, 'bandpass').set({ Q: 12 });
    const breathTremolo = new Tone.Tremolo({ frequency: 0.13, depth: 0.8, spread: 0 }).start();
    const breathPanner = new Tone.AutoPanner({ frequency: 0.18, depth: 0.7 }).start();
    const breathGain = new Tone.Gain(currentMood.breath ? 1 : 0);

    const sibilanceSynth = new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.006, decay: 0.08, sustain: 0, release: 0.02 },
      volume: -31,
    });
    const sibilanceFilter = new Tone.Filter(7800, 'highpass');

    const compressor = new Tone.Compressor({ threshold: -20, ratio: 10, attack: 0.003, release: 0.12 });
    const limiter = new Tone.Limiter(-1);
    const reverb = new Tone.Reverb({ decay: 4.5, preDelay: 0.05, wet: 0.22 });
    await reverb.generate();
    const masterVolume = new Tone.Volume(-7);

    breathNoise.fan(f1, f2, f3);
    f1.connect(breathTremolo); f2.connect(breathTremolo); f3.connect(breathTremolo);
    breathTremolo.connect(breathPanner); breathPanner.connect(breathGain);
    crinkleSynth.connect(crinkleFilter); crinkleFilter.connect(crinklePanner);
    clickSynth.connect(haasDelay);
    sibilanceSynth.connect(sibilanceFilter); sibilanceFilter.connect(breathGain);
    droneNoise.connect(droneFilter); droneFilter.connect(compressor);
    crinklePanner.connect(compressor); haasDelay.connect(compressor); breathGain.connect(compressor);
    compressor.connect(limiter); limiter.connect(reverb); reverb.connect(masterVolume); masterVolume.toDestination();

    droneNoise.start();
    breathNoise.start();

    audioEngine = {
      droneNoise, droneFilter, crinkleSynth, crinkleFilter, crinklePanner,
      clickSynth, haasDelay, breathNoise, breathTremolo, breathPanner, breathGain,
      f1, f2, f3, sibilanceSynth, sibilanceFilter, compressor, limiter, reverb, masterVolume,
      currentFreq: currentMood.freq, targetFreq: currentMood.freq,
    };

    isInitialised = true;
    isPlaying = true;
    ui.startPanel.classList.add('hidden');
    ui.moodPanel.classList.remove('hidden');
    renderMood();
    startAudioLoop();
    requestWakeLock();
  } catch (error) {
    disposeAudioEngine();
    const message = error instanceof Error ? error.message : 'Audio could not start on this browser.';
    showError(ui.startError, message);
  } finally {
    isStarting = false;
    ui.initialise.disabled = false;
    ui.initialise.querySelector('span').textContent = 'Initialise audio engine';
  }
}

async function togglePlayback() {
  if (!audioEngine) return;
  const nextState = !isPlaying;
  showError(ui.runtimeError);

  if (nextState) {
    try {
      await Tone.start();
      const ctx = Tone.getContext();
      if (ctx.state !== 'running') await ctx.resume();
    } catch {
      showError(ui.runtimeError, 'Tap again to let this browser resume audio.');
      return;
    }
    audioEngine.masterVolume.mute = false;
    isPlaying = true;
    requestWakeLock();
  } else {
    audioEngine.masterVolume.mute = true;
    isPlaying = false;
    releaseWakeLock();
  }
  renderMood();
}

function selectMood(mood, withPulse = true) {
  currentMood = mood;
  if (audioEngine) {
    audioEngine.targetFreq = mood.freq;
    audioEngine.droneNoise.type = mood.noise;
    audioEngine.breathGain.gain.rampTo(mood.breath ? 1 : 0, 0.35);
    audioEngine.breathTremolo.depth.rampTo(mood.breath ? 0.8 : 0, 0.35);
    audioEngine.reverb.wet.rampTo(0.12 + mood.wet * 0.18, 0.45);
  }
  renderMood();
  if (withPulse) pulseNode(mood.id);
}

function stepMood(direction) {
  const nextId = (currentMood.id + direction + MOOD_MATRIX.length) % MOOD_MATRIX.length;
  selectMood(MOOD_MATRIX[nextId]);
}

function startAudioLoop() {
  if (audioFrame) cancelAnimationFrame(audioFrame);
  let lastTime = performance.now();
  let lastEntropyPaint = 0;
  let lastCrinkleTime = 0;
  let lastClickTime = 0;
  let lastSibilanceTime = 0;

  const drift = (time) => {
    if (audioEngine && isPlaying) {
      const dt = Math.min(0.05, Math.max(0, (time - lastTime) / 1000));
      lastTime = time;
      const toneNow = Tone.now();
      let current = audioEngine.currentFreq;
      const epsilon = (Math.random() - 0.5) * Math.max(4, currentMood.freq * 0.025);
      const pull = (audioEngine.targetFreq - current) * 0.035;
      current = Math.max(20, Math.min(8000, current + epsilon + pull));
      audioEngine.currentFreq = current;
      audioEngine.droneFilter.frequency.setTargetAtTime(current, toneNow, 0.08);

      const eventRate = (currentMood.tingle / 100) * 4.2;
      if (eventRate > 0 && Math.random() < Math.min(0.9, eventRate * dt)) {
        if (Math.random() < currentMood.wet) {
          if (toneNow > lastClickTime + 0.075) {
            audioEngine.clickSynth.frequency.cancelScheduledValues(toneNow);
            audioEngine.clickSynth.frequency.setValueAtTime(2600 + Math.random() * 1400, toneNow);
            audioEngine.clickSynth.frequency.exponentialRampToValueAtTime(110 + Math.random() * 90, toneNow + 0.026);
            audioEngine.clickSynth.triggerAttackRelease(0.03, toneNow);
            lastClickTime = toneNow;
          }
        } else if (toneNow > lastCrinkleTime + 0.065) {
          audioEngine.crinkleFilter.frequency.setValueAtTime(3200 + Math.random() * 3600, toneNow);
          audioEngine.crinkleSynth.triggerAttackRelease(0.025, toneNow);
          lastCrinkleTime = toneNow;
        }
      }

      if (currentMood.breath) {
        const breathRate = 0.13 + Math.sin(time * 0.00031) * 0.025;
        audioEngine.breathTremolo.frequency.setValueAtTime(breathRate, toneNow);
        audioEngine.f1.frequency.setTargetAtTime(500 + Math.sin(time * 0.004) * 85, toneNow, 0.1);
        audioEngine.f2.frequency.setTargetAtTime(1500 + Math.cos(time * 0.003) * 180, toneNow, 0.1);
        audioEngine.f3.frequency.setTargetAtTime(2500 + Math.sin(time * 0.005) * 260, toneNow, 0.1);
        const exhale = Math.sin(time * 0.001 * Math.PI * 2 * breathRate);
        if (exhale > 0.72 && Math.random() < 0.65 * dt && toneNow > lastSibilanceTime + 0.22) {
          audioEngine.sibilanceSynth.triggerAttackRelease(0.055, toneNow);
          lastSibilanceTime = toneNow;
        }
      }

      if (time - lastEntropyPaint > 90) {
        const variance = Math.abs(current - audioEngine.targetFreq);
        const targetEntropy = Math.min(25, variance / Math.max(8, currentMood.freq * 0.01));
        entropy += (targetEntropy - entropy) * 0.12;
        renderEntropy();
        lastEntropyPaint = time;
      }
    } else {
      lastTime = time;
    }
    audioFrame = requestAnimationFrame(drift);
  };
  audioFrame = requestAnimationFrame(drift);
}

function initialiseVisuals() {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.className = 'manifold-canvas';
  renderer.domElement.style.touchAction = 'none';
  ui.scene.appendChild(renderer.domElement);

  const torusMaterial = new THREE.MeshBasicMaterial({ color: 0xbec6ce, wireframe: true, transparent: true, opacity: 0.032 });
  const torus = new THREE.Mesh(new THREE.TorusGeometry(10, 3, 32, 112), torusMaterial);
  scene.add(torus);

  const echoTorus = new THREE.Mesh(
    new THREE.TorusGeometry(10, 3.08, 18, 72),
    new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.009 }),
  );
  echoTorus.rotation.set(0.16, 0.08, 0.12);
  torus.add(echoTorus);

  const nodes = MOOD_MATRIX.map((mood, i) => {
    const u = (i / MOOD_MATRIX.length) * Math.PI * 2;
    const v = (i % 6) * (Math.PI / 3);
    const node = new THREE.Mesh(
      new THREE.SphereGeometry(0.48, 18, 18),
      new THREE.MeshBasicMaterial({ color: mood.node, transparent: true, opacity: 0.45 }),
    );
    const halo = new THREE.Mesh(
      new THREE.SphereGeometry(0.82, 14, 14),
      new THREE.MeshBasicMaterial({ color: mood.node, transparent: true, opacity: 0.025, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    node.add(halo);
    node.position.set(
      (10 + 3 * Math.cos(v)) * Math.cos(u),
      (10 + 3 * Math.cos(v)) * Math.sin(u),
      3 * Math.sin(v),
    );
    node.userData = { ...mood, halo };
    node.scale.setScalar(0.82);
    torus.add(node);
    return node;
  });

  camera.position.z = 35;
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let isDragging = false;
  let pointerId = null;
  let down = { x: 0, y: 0 };
  let previous = { x: 0, y: 0 };

  pulseNode = (id) => {
    nodes.forEach((node) => {
      const selected = node.userData.id === id;
      const sameSuite = node.userData.suite === MOOD_MATRIX[id].suite;
      node.material.opacity = selected ? 1 : (sameSuite ? 0.56 : 0.28);
      node.userData.halo.material.opacity = selected ? 0.13 : 0.018;
      node.scale.setScalar(selected ? 1.34 : (sameSuite ? 0.9 : 0.76));
    });
    torusMaterial.color.set(MOOD_MATRIX[id].node);
    torusMaterial.opacity = 0.038;
    const node = nodes[id];
    if (!node) return;
    node.scale.setScalar(1.78);
    window.setTimeout(() => {
      if (node.parent && currentMood.id === id) node.scale.setScalar(1.34);
    }, 220);
  };

  function resize() {
    const rect = ui.scene.getBoundingClientRect();
    const width = Math.max(1, rect.width);
    const height = Math.max(1, rect.height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  }

  function setPointer(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  renderer.domElement.addEventListener('pointerdown', (event) => {
    if (event.button !== undefined && event.button !== 0) return;
    pointerId = event.pointerId;
    isDragging = true;
    down = previous = { x: event.clientX, y: event.clientY };
    renderer.domElement.setPointerCapture?.(event.pointerId);
  }, { passive: true });

  renderer.domElement.addEventListener('pointermove', (event) => {
    if (!isDragging || event.pointerId !== pointerId) return;
    torus.rotation.y += (event.clientX - previous.x) * 0.006;
    torus.rotation.x += (event.clientY - previous.y) * 0.006;
    previous = { x: event.clientX, y: event.clientY };
  }, { passive: true });

  const onPointerEnd = (event) => {
    if (event.pointerId !== pointerId) return;
    const travel = Math.hypot(event.clientX - down.x, event.clientY - down.y);
    if (travel < 12 && isInitialised) {
      setPointer(event);
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(nodes, false);
      if (hits.length) selectMood(hits[0].object.userData, true);
    }
    isDragging = false;
    pointerId = null;
  };
  renderer.domElement.addEventListener('pointerup', onPointerEnd, { passive: true });
  renderer.domElement.addEventListener('pointercancel', onPointerEnd, { passive: true });

  window.addEventListener('resize', resize, { passive: true });
  resize();

  const animate = () => {
    requestAnimationFrame(animate);
    if (isPlaying && !isDragging) {
      torus.rotation.y += 0.001;
      torus.rotation.x += 0.0005;
      echoTorus.rotation.z -= 0.00032;
    }
    renderer.render(scene, camera);
  };
  animate();
}

ui.initialise.addEventListener('click', initialiseAudio);
ui.playPause.addEventListener('click', togglePlayback);
ui.previous.addEventListener('click', () => stepMood(-1));
ui.next.addEventListener('click', () => stepMood(1));
document.querySelectorAll('.suite-button').forEach((button) => {
  button.addEventListener('click', () => selectMood(MOOD_MATRIX[Number(button.dataset.node)]));
});
window.addEventListener('keydown', (event) => {
  if (!isInitialised) return;
  if (event.key === 'ArrowLeft') stepMood(-1);
  if (event.key === 'ArrowRight') stepMood(1);
  if (event.code === 'Space') { event.preventDefault(); togglePlayback(); }
});

document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState === 'visible' && isPlaying && audioEngine) {
    try {
      const ctx = Tone.getContext();
      if (ctx.state !== 'running') await ctx.resume();
    } catch { /* Android may require another tap. */ }
    requestWakeLock();
  }
});

window.addEventListener('pagehide', () => {
  if (audioFrame) cancelAnimationFrame(audioFrame);
  releaseWakeLock();
});

initialiseVisuals();
renderMood();
pulseNode(currentMood.id);
