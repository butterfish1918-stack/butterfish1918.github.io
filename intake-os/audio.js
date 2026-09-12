// --- GLOBAL STATE ---
const STATE = {
    active: false,
    phase: 'IDLE',
    startTime: 0,
    phaseStartTime: 0,
    totalCycles: 0,
    protocol: null,
    durationLimit: 300,
    color: '#fff',
    animationId: null,
    audioEnabled: true,
    hapticsEnabled: true,
    keepAwake: true,
    wakeLock: null,
    installPrompt: null
};

const PHASE_COLORS = {
    'IN': '#00e5ff',
    'HOLD_IN': '#ffffff',
    'OUT': '#e040fb',
    'HOLD_OUT': '#78909c'
};

const AudioEngine = {
    ctx: null,
    nodes: [],
    masterGain: null,

    init: function() {
        if (!this.ctx) {
            const AC = window.AudioContext || window.webkitAudioContext;
            if (!AC) return false;
            this.ctx = new AC();
            this.masterGain = this.ctx.createGain();
            this.masterGain.connect(this.ctx.destination);
        }
        if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
        this.stop();
        return true;
    },

    stop: function() {
        this.nodes.forEach(n => {
            try {
                if(n.stop) n.stop();
                if(n.disconnect) n.disconnect();
            } catch(e){}
        });
        this.nodes = [];
        this.active = null;
        this.active2 = null;
        this.shepards = null;
        this.type = null;
    },

    osc: function(type, freq, gain) {
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = type;
        o.frequency.value = freq;
        g.gain.value = gain;
        o.connect(g);
        g.connect(this.masterGain);
        o.start();
        this.nodes.push(o, g);
        return { o, g };
    },

    noise: function(type) {
        const bs = 2 * this.ctx.sampleRate;
        const b = this.ctx.createBuffer(1, bs, this.ctx.sampleRate);
        const d = b.getChannelData(0);
        for(let i=0; i<bs; i++) d[i] = Math.random() * 2 - 1;
        const s = this.ctx.createBufferSource();
        s.buffer = b;
        s.loop = true;
        const f = this.ctx.createBiquadFilter();
        const g = this.ctx.createGain();
        s.connect(f);
        f.connect(g);
        g.connect(this.masterGain);
        s.start();
        this.nodes.push(s, f, g);
        return { s, f, g };
    },

    playPhaseTone: function(phase) {
        if (!this.ctx || !STATE.audioEnabled) return;
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.connect(g);
        g.connect(this.masterGain);
        g.gain.setValueAtTime(0.08, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
        switch(phase) {
            case 'IN':
                osc.type = 'sine';
                osc.frequency.setValueAtTime(440, t);
                osc.frequency.exponentialRampToValueAtTime(880, t + 0.1);
                break;
            case 'HOLD_IN':
                osc.type = 'triangle';
                g.gain.setValueAtTime(0.05, t);
                osc.frequency.setValueAtTime(880, t);
                break;
            case 'OUT':
                osc.type = 'sine';
                osc.frequency.setValueAtTime(880, t);
                osc.frequency.exponentialRampToValueAtTime(440, t + 0.15);
                break;
            case 'HOLD_OUT':
                osc.type = 'sine';
                g.gain.setValueAtTime(0.1, t);
                osc.frequency.setValueAtTime(110, t);
                break;
        }
        osc.start(t);
        osc.stop(t + 0.3);
    },

    setup: function(p) {
        if (!this.init()) return;
        this.type = p.audio;
        this.masterGain.gain.value = STATE.audioEnabled ? 0.5 : 0;
        switch(this.type) {
            case 'PITCH_DROP': this.active = this.osc('sine', 220, 0.5); break;
            case 'BROWN_NOISE':
                this.active = this.noise('white'); this.active.f.type = 'lowpass'; this.active.f.frequency.value = 150; break;
            case 'ISOCHRONIC': this.active = this.osc('sine', 200, 0); break;
            case 'STATIC_BURST': this.active = this.noise('white'); this.active.g.gain.value = 0; break;
            case 'CABIN_PRESSURE': this.active = this.noise('pink'); this.active.f.type = 'bandpass'; this.active.f.frequency.value = 400; break;
            case 'CLARITY': this.active = this.osc('sine', 880, 0.3); break;
            case 'SAWTOOTH': this.active = this.osc('sawtooth', 100, 0.1); break;
            case 'METRONOME': break;
            case 'KICK_DRUM': break;
            case 'METALLIC': this.active = this.osc('sine', 0, 0); break;
            case 'PANNING_PINK':
                if (this.ctx.createStereoPanner) {
                    const n = this.noise('pink');
                    const pan = this.ctx.createStereoPanner();
                    n.g.disconnect(); n.g.connect(pan); pan.connect(this.masterGain);
                    this.active = { ...n, pan };
                } else this.active = this.noise('pink');
                break;
            case 'TELEMETRY': break;
            case 'SILENCE': break;
            case 'SHEPARD':
                this.shepards = [this.osc('triangle', 110, 0), this.osc('triangle', 220, 0), this.osc('triangle', 440, 0)];
                break;
            case 'BINAURAL_WHISPER': {
                this.active = this.osc('sine', 200, 0.1);
                this.active2 = this.osc('sine', 204, 0.1);
                const w = this.noise('white'); w.f.frequency.value = 500; w.g.gain.value = 0.05;
                break;
            }
            case 'PHASING': this.active = this.osc('sine', 200, 0.2); this.active2 = this.osc('sine', 200.5, 0.2); break;
            case 'DRONE_LOW': {
                this.active = this.osc('sawtooth', 80, 0.2);
                const lp = this.ctx.createBiquadFilter(); lp.frequency.value = 80;
                this.active.o.disconnect(); this.active.o.connect(lp); lp.connect(this.active.g); this.nodes.push(lp);
                break;
            }
            case 'INFRASOUND': this.active = this.osc('sine', 40, 0.5); break;
            case 'SONAR': break;
            case 'VACUUM': this.active = this.noise('white'); this.active.f.type = 'highpass'; break;
            case 'ROAR':
                this.active = this.noise('pink'); this.active.f.type = 'peaking'; this.active.f.frequency.value = 300; this.active.f.gain.value = 15; break;
            case 'WARM_PAD': {
                this.active = this.osc('triangle', 150, 0.2);
                const lfo = this.ctx.createOscillator(); lfo.frequency.value = 0.2;
                const lfoG = this.ctx.createGain(); lfoG.gain.value = 50; lfo.connect(lfoG);
                const padF = this.ctx.createBiquadFilter(); padF.frequency.value = 400; lfoG.connect(padF.frequency);
                this.active.o.disconnect(); this.active.o.connect(padF); padF.connect(this.active.g); lfo.start();
                this.nodes.push(lfo, lfoG, padF);
                break;
            }
            case 'HISS': this.active = this.noise('white'); this.active.f.type = 'highpass'; break;
            case 'PURR': this.active = this.osc('square', 40, 0.2); break;
        }
    },

    update: function(progress, phase) {
        if (!this.ctx || !STATE.audioEnabled) return;
        const now = this.ctx.currentTime;
        switch(this.type) {
            case 'PITCH_DROP': this.active.o.frequency.setTargetAtTime(phase === 'OUT' ? 220 - (progress * 165) : 220, now, 0.1); break;
            case 'ISOCHRONIC': this.active.g.gain.setTargetAtTime((Date.now() % 10000) < 5000 ? 0.3 : 0, now, 0.1); break;
            case 'STATIC_BURST': this.active.g.gain.value = phase === 'IN' ? 0.5 : 0; break;
            case 'SAWTOOTH': this.active.o.frequency.setTargetAtTime(phase === 'IN' ? 100 + (progress * 300) : 100, now, 0.1); break;
            case 'METRONOME':
                if (Math.floor(Date.now()/1000) > this.lastTick) { this.lastTick = Math.floor(Date.now()/1000); this.playClick(1500, 0.05); }
                break;
            case 'KICK_DRUM':
                if (Date.now() - this.lastKick > 428) { this.lastKick = Date.now(); this.playKick(); }
                break;
            case 'METALLIC':
                if (phase === 'OUT' && !this.shattered) { this.playClick(2000, 0.5); this.shattered = true; }
                if (phase === 'IN') this.shattered = false;
                break;
            case 'PANNING_PINK': if(this.active.pan) this.active.pan.pan.value = Math.sin(now); break;
            case 'TELEMETRY': if (Math.random() > 0.95) this.playClick(800 + Math.random()*800, 0.1); break;
            case 'SHEPARD':
                this.shepards.forEach((s, i) => {
                    let f = 110 * (i+1); f *= phase === 'IN' ? (1 + progress) : (2 - progress);
                    s.o.frequency.setTargetAtTime(f, now, 0.1); s.g.gain.value = 0.2;
                });
                break;
            case 'SONAR':
                if (Math.floor(Date.now()/10000) > this.lastPing) { this.lastPing = Math.floor(Date.now()/10000); this.playClick(3000, 0.3); }
                break;
            case 'VACUUM': this.active.f.frequency.setTargetAtTime((phase === 'HOLD_OUT' || phase === 'OUT') ? 200 + progress*10000 : 200, now, 0.1); break;
            case 'HISS':
                this.active.f.frequency.setTargetAtTime(phase === 'OUT' ? 10000 - (progress * 9000) : 100, now, 0.1);
                this.active.g.gain.value = phase === 'OUT' ? 0.3 : 0;
                break;
        }
    },

    lastTick: 0,
    lastKick: 0,
    lastPing: 0,

    playClick: function(freq, dur) {
        const o = this.ctx.createOscillator(); const g = this.ctx.createGain();
        o.frequency.value = freq; g.gain.value = 0.5;
        g.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + dur);
        o.connect(g); g.connect(this.masterGain); o.start(); o.stop(this.ctx.currentTime + dur);
    },

    playKick: function() {
        const o = this.ctx.createOscillator(); const g = this.ctx.createGain();
        o.frequency.setValueAtTime(150, this.ctx.currentTime); o.frequency.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.5);
        g.gain.setValueAtTime(1, this.ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.5);
        o.connect(g); g.connect(this.masterGain); o.start(); o.stop(this.ctx.currentTime + 0.5);
    }
};
