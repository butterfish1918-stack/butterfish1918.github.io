// --- Visual Engine ---

const canvas = document.getElementById('visualiser');
const ctx = canvas.getContext('2d', { alpha: false });
let width, height, orbs = [], controlOrbs = [], isRunning = false, draggedOrb = null, lastMouseY = 0;
const visualData = new Uint8Array(1024);
let labelTimeout = null;
let currentRingRadius = 0;

class NoteOrb {
    constructor(i, x, y, r, c, l) {
        this.index = i;
        this.x = x;
        this.y = y;
        this.radius = r;
        this.color = c;
        this.label = l;
        this.active = false;
        this.phase = Math.random() * 10;
    }

    update() {
        this.phase += 0.045;
    }

    draw(ctx) {
        const isSelected = selectedNoteIndex === this.index;
        const clarity = globalParams.visClarity;
        const pulse = 1 + Math.sin(this.phase) * 0.06;
        const halo = this.active ? this.radius * 5.5 : this.radius * 2.3;
        const glowAlpha = (this.active ? 0.58 : 0.12) * clarity;

        const glow = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, halo * pulse);
        glow.addColorStop(0, `hsla(${this.color}, ${glowAlpha})`);
        glow.addColorStop(0.22, `hsla(${this.color}, ${glowAlpha * 0.5})`);
        glow.addColorStop(1, `hsla(${this.color}, 0)`);
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(this.x, this.y, halo * pulse, 0, Math.PI * 2);
        ctx.fill();

        if (this.active) {
            ctx.strokeStyle = `hsla(${this.color}, ${0.34 * clarity})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius + 7 + Math.sin(this.phase) * 2, 0, Math.PI * 2);
            ctx.stroke();
        }

        if (isSelected) {
            ctx.strokeStyle = `rgba(244,244,245,${0.46 * clarity})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius + 16, 0, Math.PI * 2);
            ctx.stroke();

            ctx.strokeStyle = `rgba(161,161,170,${0.13 * clarity})`;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius + 21, -0.6, 1.35);
            ctx.stroke();
        }

        ctx.fillStyle = `rgba(3,3,4,${0.72 * clarity})`;
        ctx.beginPath();
        ctx.arc(this.x, this.y, Math.max(7, this.radius * 0.7), 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = `rgba(161,161,170,${(isSelected ? 0.38 : 0.16) * clarity})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(this.x, this.y, Math.max(7, this.radius * 0.7), 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = `rgba(244,244,245,${(isSelected || this.active ? 0.98 : 0.72) * clarity})`;
        ctx.font = `${isSelected ? '600' : '500'} ${isSelected ? 8 : 7}px ui-monospace, monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.label, this.x, this.y + 0.5);
    }

    toggle() {
        if (!this.voice) return;
        this.active = !this.active;
        this.active ? this.voice.trigger() : this.voice.release();
    }
}

class ControlOrb {
    constructor(id, x, y, r, c, l, min, max, isGlobal = false) {
        this.id = id;
        this.x = x;
        this.y = y;
        this.radius = r;
        this.color = c;
        this.label = l;
        this.min = min;
        this.max = max;
        this.isGlobal = isGlobal;
        this.trackY = y;
        this.trackHeight = Math.max(58, Math.min(90, height * 0.22));
        this.updateVisualPos();
    }

    getValue() {
        return this.isGlobal ? globalParams[this.id] : polyParams[selectedNoteIndex][this.id];
    }

    getNorm() {
        return Math.max(0, Math.min(1, (this.getValue() - this.min) / (this.max - this.min)));
    }

    updateVisualPos() {
        const norm = this.getNorm();
        this.y = this.trackY + (this.trackHeight / 2) - (norm * this.trackHeight);
    }

    updateValue(delta) {
        const range = this.max - this.min;
        const newVal = Math.max(this.min, Math.min(this.max, this.getValue() + (delta * range)));
        if (this.isGlobal) {
            globalParams[this.id] = newVal;
            targetParams[this.id] = newVal;
        } else {
            polyParams[selectedNoteIndex][this.id] = (this.id === 'tempIndex' ? Math.round(newVal) : newVal);
            targetPoly[selectedNoteIndex][this.id] = polyParams[selectedNoteIndex][this.id];
        }
        this.updateVisualPos();
        this.applyToSynth();
    }

    applyToSynth() {
        if (!audioCtx) return;
        if (this.isGlobal) {
            orbs.forEach(o => { if (o.voice) o.voice.updateParams(); });
        } else if (orbs[selectedNoteIndex] && orbs[selectedNoteIndex].voice) {
            orbs[selectedNoteIndex].voice.updateParams();
        }
    }

    draw(ctx) {
        const clarity = globalParams.visClarity;
        const top = this.trackY - this.trackHeight / 2;
        const bottom = this.trackY + this.trackHeight / 2;

        ctx.lineWidth = 1;
        ctx.strokeStyle = `rgba(161,161,170,${0.09 * clarity})`;
        ctx.beginPath();
        ctx.moveTo(this.x, top);
        ctx.lineTo(this.x, bottom);
        ctx.stroke();

        ctx.strokeStyle = `hsla(${this.color}, ${0.31 * clarity})`;
        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        ctx.lineTo(this.x, bottom);
        ctx.stroke();

        ctx.strokeStyle = `rgba(161,161,170,${0.16 * clarity})`;
        ctx.beginPath();
        ctx.moveTo(this.x - 3, top);
        ctx.lineTo(this.x + 3, top);
        ctx.moveTo(this.x - 3, bottom);
        ctx.lineTo(this.x + 3, bottom);
        ctx.stroke();

        const glow = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.radius * 3.2);
        glow.addColorStop(0, `hsla(${this.color}, ${0.34 * clarity})`);
        glow.addColorStop(0.34, `hsla(${this.color}, ${0.12 * clarity})`);
        glow.addColorStop(1, `hsla(${this.color}, 0)`);
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius * 3.2, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = `rgba(9,9,11,${0.88 * clarity})`;
        ctx.strokeStyle = `hsla(${this.color}, ${0.56 * clarity})`;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius * 0.72, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        if (this.isGlobal) {
            ctx.fillStyle = `rgba(161,161,170,${0.28 * clarity})`;
            ctx.fillRect(this.x - 1, bottom + 9, 2, 2);
        }

        ctx.fillStyle = `rgba(212,212,216,${0.72 * clarity})`;
        ctx.font = '600 6px ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(this.label, this.x, bottom + 19);
    }
}

function updateChaos() {
    const dt = 0.02;
    const delta = 0.3;
    const alpha = -1;
    const beta = 1;
    const gamma = 0.37;
    const omega = 1.2;
    const t = Date.now() / 1000;
    const dxdt = duffingState.v;
    const dvdt = gamma * Math.cos(omega * t) - delta * duffingState.v - alpha * duffingState.x - beta * Math.pow(duffingState.x, 3);
    duffingState.x += dxdt * dt;
    duffingState.v += dvdt * dt;
}

function drawGuideField() {
    const cx = width / 2;
    const cy = height / 2;
    const clarity = globalParams.visClarity;

    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.lineWidth = 1;

    ctx.strokeStyle = `rgba(161,161,170,${0.035 * clarity})`;
    ctx.beginPath();
    ctx.arc(cx, cy, currentRingRadius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = `rgba(161,161,170,${0.025 * clarity})`;
    ctx.beginPath();
    ctx.arc(cx, cy, currentRingRadius * 0.62, 0, Math.PI * 2);
    ctx.stroke();

    const reticle = Math.min(13, currentRingRadius * 0.08);
    ctx.strokeStyle = `rgba(161,161,170,${0.06 * clarity})`;
    ctx.beginPath();
    ctx.moveTo(cx - reticle, cy);
    ctx.lineTo(cx + reticle, cy);
    ctx.moveTo(cx, cy - reticle);
    ctx.lineTo(cx, cy + reticle);
    ctx.stroke();

    ctx.fillStyle = `rgba(212,212,216,${0.18 * clarity})`;
    ctx.beginPath();
    ctx.arc(cx, cy, 1.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}

function setupElements() {
    const oldOrbs = orbs;
    width = canvas.width = Math.max(1, window.innerWidth);
    height = canvas.height = Math.max(1, window.innerHeight);

    const cx = width / 2;
    const cy = height / 2;
    const portrait = height >= width;
    const compact = width < 700 || height < 600;

    const ringR = portrait
        ? Math.min(width * 0.34, height * 0.22)
        : Math.min(height * 0.31, width * 0.24);
    currentRingRadius = ringR;

    const noteRadius = compact ? 13 : 15;
    orbs = NOTES.map((n, i) => {
        const ang = (i / 12) * Math.PI * 2 - Math.PI / 2;
        const orb = new NoteOrb(i, cx + Math.cos(ang) * ringR, cy + Math.sin(ang) * ringR, noteRadius, n.color, n.name);
        if (oldOrbs[i]) {
            orb.voice = oldOrbs[i].voice || null;
            orb.active = !!oldOrbs[i].active;
            orb.phase = oldOrbs[i].phase || orb.phase;
        }
        return orb;
    });

    const sidePad = compact ? 22 : 30;
    const step = Math.min(45, Math.max(34, (width - sidePad * 2) / 8));
    const matrixWidth = step * 8;
    const clusterX = cx - matrixWidth / 2;
    const matrixY = compact ? cy - Math.min(22, height * 0.04) : cy - 30;

    controlOrbs = [
        new ControlOrb('gain', clusterX, matrixY, 8, '0, 0%, 90%', 'VOL', 0.0, 1.0),
        new ControlOrb('inertia', clusterX + step, matrixY, 8, '140, 50%, 70%', 'INR', 0.01, 1.0),
        new ControlOrb('tempIndex', clusterX + step * 2, matrixY, 8, '60, 100%, 70%', 'TMP', 0, TEMPERAMENTS.length - 1),
        new ControlOrb('cutoff', clusterX + step * 3, matrixY, 8, '40, 100%, 60%', 'CUT', 100, 4000),
        new ControlOrb('res', clusterX + step * 4, matrixY, 8, '40, 100%, 60%', 'RES', 0.1, 25),
        new ControlOrb('space', clusterX + step * 5, matrixY, 8, '280, 80%, 70%', 'SPC', 0, 0.9),
        new ControlOrb('attack', clusterX + step * 6, matrixY, 8, '180, 50%, 70%', 'ATK', 0.01, 3.0),
        new ControlOrb('release', clusterX + step * 7, matrixY, 8, '180, 50%, 70%', 'REL', 0.1, 8.0),
        new ControlOrb('fractal', clusterX + step * 8, matrixY, 8, '0, 100%, 50%', 'FRACT', 0.01, 1.0)
    ];

    const edgeGap = compact ? 34 : 60;
    const leftX = Math.max(sidePad, cx - ringR - edgeGap);
    const rightX = Math.min(width - sidePad, cx + ringR + edgeGap);
    const sideY = compact ? Math.min(36, ringR * 0.34) : 40;

    controlOrbs.push(
        new ControlOrb('intensity', leftX, cy - sideY, 8, '0, 100%, 50%', 'INT', 0, 1.0, true),
        new ControlOrb('shadowDepth', leftX, cy + sideY, 8, '240, 100%, 40%', 'SHD', 0, 1.0, true),
        new ControlOrb('temporalWeight', rightX, cy - sideY, 8, '60, 100%, 50%', 'TW', 0.1, 0.99, true),
        new ControlOrb('convergence', rightX, cy + sideY, 8, '120, 100%, 80%', 'CNV', 0, 1.0, true)
    );

    const minimumBottomTrackY = cy + ringR + (compact ? 66 : 100);
    const bottomTrackY = Math.min(height - (compact ? 72 : 82), minimumBottomTrackY);
    const bottomSpread = Math.min(60, Math.max(44, width * 0.12));

    controlOrbs.push(
        new ControlOrb('respiration', cx - bottomSpread, bottomTrackY, 8, '180, 50%, 50%', 'RESP', 0.05, 1.0, true),
        new ControlOrb('transcendence', cx, bottomTrackY, 8, '180, 50%, 50%', 'DLT', 0, 15, true),
        new ControlOrb('gravity', cx + bottomSpread, bottomTrackY, 8, '0, 0%, 50%', 'GRV', 0.01, 0.4, true)
    );
}

function draw() {
    if (!isRunning) return;
    requestAnimationFrame(draw);
    globalAnalyser.getByteFrequencyData(visualData);
    updateChaos();

    ctx.save();
    const zoom = 1.01 + (polyParams[selectedNoteIndex].fractal * 0.04);
    ctx.translate(width / 2, height / 2);
    ctx.rotate(Math.sin(Date.now() / 10000) * 0.03);
    ctx.translate(-width / 2, -height / 2);
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(canvas, (width - width * zoom) / 2, (height - height * zoom) / 2, width * zoom, height * zoom);
    ctx.fillStyle = `rgba(1, 1, 1, ${globalParams.gravity})`;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();

    drawGuideField();

    ctx.globalCompositeOperation = 'lighter';
    orbs.forEach(o => {
        o.update();
        o.draw(ctx);
    });
    controlOrbs.forEach(c => c.draw(ctx));

    if (Date.now() - lastFractureTime < 300) {
        ctx.strokeStyle = `rgba(255,255,255,${0.065 * globalParams.visClarity})`;
        ctx.lineWidth = Math.max(0.5, globalParams.intensity * 1.6);
        for (let i = 0; i < 5; i++) {
            ctx.beginPath();
            ctx.moveTo(Math.random() * width, Math.random() * height);
            ctx.lineTo(Math.random() * width, Math.random() * height);
            ctx.stroke();
        }
    }
}
