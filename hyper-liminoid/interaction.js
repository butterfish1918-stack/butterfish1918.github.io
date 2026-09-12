const activeParamLabel = document.getElementById('active-param');
function showLabel(orb) {
    let valStr = orb.getValue().toFixed(2);
    if (orb.id === 'tempIndex') valStr = TEMPERAMENTS[Math.round(orb.getValue())].name;
    activeParamLabel.innerText = `${orb.label}: ${valStr}`;
    activeParamLabel.style.opacity = 1;
    if (labelTimeout) clearTimeout(labelTimeout);
    if (!touchContext.active && !draggedOrb) labelTimeout = setTimeout(() => { activeParamLabel.style.opacity = 0; }, 1500);
}

function handleInputStart(x, y) {
    for (let c of controlOrbs) {
        if (Math.hypot(x - c.x, y - c.y) < 35) {
            touchContext.active = true;
            touchContext.type = 'control';
            touchContext.target = c;
            touchContext.lastY = y;
            draggedOrb = c;
            lastMouseY = y;
            showLabel(c);
            return;
        }
    }
    for (let o of orbs) {
        if (Math.hypot(x - o.x, y - o.y) < 45) {
            touchContext.active = true;
            touchContext.type = 'note';
            touchContext.target = o;
            touchContext.startY = y;
            touchContext.lastY = y;
            touchContext.isDragging = false;
            return;
        }
    }
}

function handleInputMove(x, y) {
    if (!touchContext.active) return;
    if (touchContext.type === 'control') {
        const delta = (touchContext.lastY - y) / touchContext.target.trackHeight;
        touchContext.target.updateValue(delta);
        touchContext.lastY = y;
        showLabel(touchContext.target);
    } else if (touchContext.type === 'note') {
        const totalDelta = touchContext.startY - y;
        if (Math.abs(totalDelta) > 10) touchContext.isDragging = true;
        if (touchContext.isDragging) {
            const step = (touchContext.lastY - y) * 0.005;
            const p = polyParams[touchContext.target.index];
            p.gain = Math.max(0, Math.min(1, p.gain + step));
            targetPoly[touchContext.target.index].gain = p.gain;
            if (touchContext.target.voice) touchContext.target.voice.updateParams();
            if (touchContext.target.index === selectedNoteIndex) {
                const gOrb = controlOrbs.find(k => k.id === 'gain');
                if (gOrb) gOrb.updateVisualPos();
            }
            activeParamLabel.innerText = `${touchContext.target.label} VOL: ${p.gain.toFixed(2)}`;
            activeParamLabel.style.opacity = 1;
            touchContext.lastY = y;
        }
    }
}

function handleInputEnd() {
    if (touchContext.type === 'note' && !touchContext.isDragging && touchContext.target) {
        const o = touchContext.target;
        if (selectedNoteIndex !== o.index) {
            selectedNoteIndex = o.index;
            controlOrbs.forEach(c => c.updateVisualPos());
            activeParamLabel.innerText = `Focus: ${o.label}`;
            activeParamLabel.style.opacity = 1;
            if (labelTimeout) clearTimeout(labelTimeout);
            labelTimeout = setTimeout(() => { activeParamLabel.style.opacity = 0; }, 1000);
        } else {
            o.toggle();
        }
    }
    touchContext.active = false;
    touchContext.target = null;
    touchContext.type = null;
    draggedOrb = null;
    if (labelTimeout) clearTimeout(labelTimeout);
    labelTimeout = setTimeout(() => { activeParamLabel.style.opacity = 0; }, 1000);
}

let activePointerId = null;

function isUiControlTarget(target) {
    return target && (
        target.id === 'vis-clarity' ||
        target.id === 'start-btn' ||
        target.id === 'install-btn'
    );
}

window.addEventListener('pointerdown', e => {
    if (!isRunning || isUiControlTarget(e.target)) return;
    if (activePointerId !== null) return;
    activePointerId = e.pointerId;
    if (e.pointerType === 'touch') e.preventDefault();
    handleInputStart(e.clientX, e.clientY);
    if (touchContext.active && e.target && e.target.setPointerCapture) {
        try { e.target.setPointerCapture(e.pointerId); } catch (_) {}
    }
}, { passive: false });

window.addEventListener('pointermove', e => {
    if (e.pointerId !== activePointerId || !touchContext.active) return;
    e.preventDefault();
    handleInputMove(e.clientX, e.clientY);
}, { passive: false });

function finishPointer(e) {
    if (activePointerId === null || (e && e.pointerId !== activePointerId)) return;
    handleInputEnd();
    activePointerId = null;
}

window.addEventListener('pointerup', finishPointer, { passive: true });
window.addEventListener('pointercancel', finishPointer, { passive: true });

window.addEventListener('wheel', e => {
    if (!isRunning) return;
    if (e.clientX > width - 200 && e.clientY < 60) return;
    for (let c of controlOrbs) {
        if (Math.hypot(e.clientX - c.x, e.clientY - c.y) < 40) {
            e.preventDefault();
            const direction = e.deltaY > 0 ? -1 : 1;
            const range = Math.max(1, c.max - c.min);
            const step = (c.id === 'tempIndex') ? 1/range : 0.05;
            c.updateValue(direction * step);
            showLabel(c);
            return;
        }
    }
    for (let o of orbs) {
        if (Math.hypot(e.clientX - o.x, e.clientY - o.y) < 40) {
            e.preventDefault();
            const p = polyParams[o.index];
            p.gain = Math.max(0, Math.min(1, p.gain + (e.deltaY > 0 ? -0.05 : 0.05)));
            targetPoly[o.index].gain = p.gain;
            if (o.voice) o.voice.updateParams();
            if (o.index === selectedNoteIndex) controlOrbs.find(k => k.id === 'gain').updateVisualPos();
            activeParamLabel.innerText = `${o.label} VOL: ${p.gain.toFixed(2)}`;
            activeParamLabel.style.opacity = 1;
            if (labelTimeout) clearTimeout(labelTimeout);
            labelTimeout = setTimeout(() => { activeParamLabel.style.opacity = 0; }, 1000);
            return;
        }
    }
}, { passive: false });

document.getElementById('vis-clarity').addEventListener('input', (e) => {
    globalParams.visClarity = parseFloat(e.target.value);
});
