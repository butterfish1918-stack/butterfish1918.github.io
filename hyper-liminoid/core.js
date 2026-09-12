/**
 * HYPER-LIMINOID ENGINE v11.2 - THE TRANSPARENT VORTEX
 * Author: Curtis Orion
 * Implementation: Touch optimization for mobile interaction.
 */

const NOTES = [
    { name: 'C',  freq: 261.63, color: '0, 100%, 50%' },
    { name: 'C#', freq: 277.18, color: '20, 100%, 50%' },
    { name: 'D',  freq: 293.66, color: '40, 100%, 50%' },
    { name: 'D#', freq: 311.13, color: '60, 100%, 50%' },
    { name: 'E',  freq: 329.63, color: '100, 100%, 50%' },
    { name: 'F',  freq: 349.23, color: '140, 100%, 50%' },
    { name: 'F#', freq: 369.99, color: '180, 100%, 50%' },
    { name: 'G',  freq: 392.00, color: '210, 100%, 50%' },
    { name: 'G#', freq: 415.30, color: '250, 100%, 50%' },
    { name: 'A',  freq: 440.00, color: '280, 100%, 50%' },
    { name: 'A#', freq: 466.16, color: '310, 100%, 50%' },
    { name: 'B',  freq: 493.88, color: '340, 100%, 50%' }
];

const TEMPERAMENTS = [
    { name: "12-TET", cents: [0, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1100] },
    { name: "Pythagorean", cents: [0, 113.7, 203.9, 317.6, 407.8, 500, 611.7, 702, 815.6, 905.9, 1019.6, 1109.8] },
    { name: "Meantone", cents: [0, 75.7, 193.2, 268.9, 386.3, 503.4, 579.1, 696.6, 772.3, 889.7, 1007.1, 1082.9] },
    { name: "Just", cents: [0, 111.7, 203.9, 315.6, 386.3, 498, 590.2, 702, 813.7, 884.4, 1017.6, 1088.3] },
    { name: "Werckmeister III", cents: [0, 90.2, 192.2, 294.1, 390.2, 498, 588.3, 690.2, 792.2, 888.3, 996.1, 1092.2] },
    { name: "Kirnberger III", cents: [0, 90.2, 193.2, 297.5, 386.3, 498, 590.2, 696.6, 792.2, 889.7, 996.1, 1088.3] },
    { name: "Vallotti", cents: [0, 94.1, 196.1, 298, 392.2, 500, 592.2, 694.1, 796.1, 894.1, 998, 1090.2] },
    { name: "Young No. 2", cents: [0, 93.9, 195.9, 297.9, 391.9, 499.8, 592.1, 694.1, 795.9, 894, 997.9, 1090] },
    { name: "Neidhardt", cents: [0, 94.1, 196.1, 296.1, 396.1, 498, 594.1, 696.1, 796.1, 896.1, 998, 1096.1] },
    { name: "French Ordinaire", cents: [0, 84, 196, 280, 390, 500, 582, 698, 786, 892, 1002, 1088] }
];

let audioCtx, masterComp, masterMain, globalAnalyser;
let binauralL, binauralR, binauralGain, noiseBuffer;
let sigmoidCurve;

const globalParams = {
    gravity: 0.05,
    respiration: 0.15,
    transcendence: 7.83,
    binauralVol: 0.2,
    jitter: 0.05,
    hrtf: 1.0,
    photicSync: 1.0,
    intensity: 0.1,
    shadowDepth: 0.2,
    temporalWeight: 0.9,
    convergence: 0.0,
    visClarity: 0.7
};

const polyParams = NOTES.map(() => ({
    cutoff: 1200,
    res: 8,
    space: 0.4,
    attack: 0.5,
    release: 2.0,
    tempIndex: 0,
    gain: 0.7,
    inertia: 0.2,
    fractal: 0.1,
    lastCutoff: 1200
}));

let selectedNoteIndex = 0;
let duffingState = { x: 0.1, v: 0.0 };
let targetParams = JSON.parse(JSON.stringify(globalParams));
let targetPoly = JSON.parse(JSON.stringify(polyParams));
let lastFractureTime = 0;

let touchContext = {
    active: false,
    type: null,
    target: null,
    startY: 0,
    lastY: 0,
    isDragging: false
};

function createNoiseBuffer() {
    const size = 44100 * 2;
    const buffer = audioCtx.createBuffer(1, size, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < size; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
}

function makeSigmoidCurve(amount) {
    const n_samples = 44100;
    const curve = new Float32Array(n_samples);
    for (let i = 0; i < n_samples; ++i) {
        const x = i * 2 / n_samples - 1;
        curve[i] = Math.tanh(x * amount);
    }
    return curve;
}

class Voice {
    constructor(index, noteData) {
        this.index = index;
        this.baseFreq = 261.63;
        this.osc = null;
        this.shadow = null;
        this.vca = null;
        this.shadowGain = null;
        this.filter = null;
        this.waveguide = null;
        this.damping = null;
        this.feedback = null;
        this.panner = null;
        this.isPlaying = false;
    }

    calculateFreq() {
        const p = polyParams[this.index];
        const temp = TEMPERAMENTS[p.tempIndex] || TEMPERAMENTS[0];
        let base = this.baseFreq;
        const targetFreq = 110;
        base = base * (1 - globalParams.convergence) + targetFreq * globalParams.convergence;
        const centValue = temp.cents[this.index];
        const chaos = (duffingState.x * globalParams.jitter * 15);
        const jitter = (Math.random() - 0.5) * globalParams.jitter * 10;
        return base * Math.pow(2, (centValue + jitter + chaos) / 1200);
    }

    initNodes() {
        const t = audioCtx.currentTime;
        const currentFreq = this.calculateFreq();
        this.osc = audioCtx.createOscillator();
        this.osc.type = 'triangle';
        this.osc.frequency.setValueAtTime(currentFreq, t);
        this.shadow = audioCtx.createOscillator();
        this.shadow.type = 'sine';
        this.shadow.frequency.setValueAtTime(currentFreq / 2, t);
        this.vca = audioCtx.createGain();
        this.vca.gain.setValueAtTime(0, t);
        this.shadowGain = audioCtx.createGain();
        this.shadowGain.gain.setValueAtTime(0, t);
        this.filter = audioCtx.createBiquadFilter();
        this.filter.type = 'lowpass';
        this.waveguide = audioCtx.createDelay(1.0);
        this.waveguide.delayTime.value = 1 / Math.max(1, currentFreq);
        this.damping = audioCtx.createBiquadFilter();
        this.damping.type = 'lowpass';
        this.feedback = audioCtx.createGain();
        this.clipper = audioCtx.createWaveShaper();
        this.clipper.curve = sigmoidCurve;
        this.panner = audioCtx.createPanner();
        this.panner.panningModel = 'HRTF';
        this.osc.connect(this.vca);
        this.shadow.connect(this.shadowGain);
        this.vca.connect(this.filter);
        this.shadowGain.connect(this.filter);
        this.filter.connect(this.panner);
        this.panner.connect(globalAnalyser);
        this.filter.connect(this.waveguide);
        this.waveguide.connect(this.damping);
        this.damping.connect(this.clipper);
        this.clipper.connect(this.feedback);
        this.feedback.connect(this.filter);
        this.updateParams();
        this.osc.start(t);
        this.shadow.start(t);
    }

    updateParams() {
        if (!this.osc) return;
        const p = polyParams[this.index];
        const t = audioCtx.currentTime;
        const currentFreq = this.calculateFreq();
        this.osc.frequency.setTargetAtTime(currentFreq, t, 0.2);
        this.shadow.frequency.setTargetAtTime(currentFreq / 2, t, 0.2);
        this.filter.frequency.setTargetAtTime(p.cutoff, t, 0.1);
        this.filter.Q.setTargetAtTime(p.res, t, 0.1);
        this.damping.frequency.setTargetAtTime(Math.max(100, 20000 * (1 - p.inertia)), t, 0.1);
        this.feedback.gain.setTargetAtTime(0.4 + p.inertia * 0.5, t, 0.1);
        if (this.isPlaying) {
            this.vca.gain.setTargetAtTime(p.gain, t, 0.05);
            const shadowVol = p.gain * globalParams.shadowDepth * (0.5 + Math.sin(t * globalParams.transcendence) * 0.5 * globalParams.intensity);
            this.shadowGain.gain.setTargetAtTime(shadowVol, t, 0.1);
        }
        const azimuth = Math.sin(t * 0.15 + this.index) * 5;
        this.panner.positionX.setTargetAtTime(Math.cos(azimuth) * 5, t, 0.1);
        this.panner.positionZ.setTargetAtTime(Math.sin(azimuth) * 5, t, 0.1);
    }

    trigger() {
        const t = audioCtx.currentTime;
        this.vca.gain.linearRampToValueAtTime(polyParams[this.index].gain, t + polyParams[this.index].attack);
        this.isPlaying = true;
    }

    release() {
        if (!this.vca) return;
        const t = audioCtx.currentTime;
        this.vca.gain.exponentialRampToValueAtTime(0.001, t + polyParams[this.index].release);
        this.shadowGain.gain.exponentialRampToValueAtTime(0.001, t + polyParams[this.index].release);
        this.isPlaying = false;
    }
}

function triggerEntropyBurst(freq) {
    const t = audioCtx.currentTime;
    const source = audioCtx.createBufferSource();
    source.buffer = noiseBuffer;
    const noiseFilter = audioCtx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.value = freq;
    noiseFilter.Q.value = 20;
    const noiseGain = audioCtx.createGain();
    noiseGain.gain.setValueAtTime(0, t);
    noiseGain.gain.exponentialRampToValueAtTime(globalParams.intensity * 0.5, t + 0.01);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    source.connect(noiseFilter).connect(noiseGain).connect(masterComp);
    source.start(t);
    source.stop(t + 0.3);
}

function updateDirector() {
    const weight = globalParams.temporalWeight;
    for (let key in globalParams) {
        if (typeof globalParams[key] === 'number') {
            globalParams[key] = globalParams[key] * weight + targetParams[key] * (1 - weight);
        }
    }
    polyParams.forEach((p, i) => {
        const diff = Math.abs(p.cutoff - p.lastCutoff);
        if (diff > 50 && globalParams.intensity > 0.3) {
            triggerEntropyBurst(p.cutoff);
            lastFractureTime = Date.now();
        }
        p.lastCutoff = p.cutoff;
        for (let key in p) {
            if (typeof p[key] === 'number') {
                p[key] = p[key] * weight + targetPoly[i][key] * (1 - weight);
            }
        }
    });
    orbs.forEach(o => { if (o.voice) o.voice.updateParams(); });
}

let directorTimer = null;

function initAudio() {
    if (audioCtx) {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        return;
    }
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    globalAnalyser = audioCtx.createAnalyser();
    globalAnalyser.fftSize = 2048;
    sigmoidCurve = makeSigmoidCurve(12);
    noiseBuffer = createNoiseBuffer();
    masterComp = audioCtx.createDynamicsCompressor();
    masterMain = audioCtx.createGain();
    masterMain.gain.value = 0.8;
    globalAnalyser.connect(masterComp).connect(masterMain).connect(audioCtx.destination);
    orbs.forEach((orb, i) => {
        orb.voice = new Voice(i, NOTES[i]);
        orb.voice.initNodes();
    });
    directorTimer = window.setInterval(updateDirector, 2000);
}
