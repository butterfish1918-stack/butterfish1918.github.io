(() => {
  'use strict';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const root = document.documentElement;
  const field = document.getElementById('aquaticParticles');
  const wavePaths = [...document.querySelectorAll('[data-wave-path]')];
  const currentPaths = [...document.querySelectorAll('[data-current-path]')];
  let phase = 0;
  let viscosity = 1;
  let lastPoint = null;

  function hash(input = '') {
    let h = 2166136261;
    for (let i = 0; i < input.length; i++) {
      h ^= input.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function rand(seed, min, max) {
    const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
    const n = x - Math.floor(x);
    return min + n * (max - min);
  }

  function seedWaterColumn() {
    if (!field || field.childElementCount) return;
    const frag = document.createDocumentFragment();
    const particleCount = window.innerWidth < 600 ? 30 : 52;
    const bubbleCount = window.innerWidth < 600 ? 8 : 14;

    for (let i = 0; i < particleCount; i++) {
      const p = document.createElement('i');
      p.className = 'plankton';
      p.style.setProperty('--x', `${rand(i + 2, 1, 99)}vw`);
      p.style.setProperty('--y', `${rand(i + 20, 0, 100)}vh`);
      p.style.setProperty('--size', `${rand(i + 70, 1.2, 4.8)}px`);
      p.style.setProperty('--dur', `${rand(i + 120, 10, 30)}s`);
      p.style.setProperty('--delay', `${rand(i + 180, -26, 0)}s`);
      p.style.setProperty('--drift', `${rand(i + 240, -75, 75)}px`);
      frag.appendChild(p);
    }

    for (let i = 0; i < bubbleCount; i++) {
      const b = document.createElement('i');
      b.className = 'bubble';
      b.style.setProperty('--x', `${rand(i + 320, 3, 97)}vw`);
      b.style.setProperty('--size', `${rand(i + 370, 4, 14)}px`);
      b.style.setProperty('--dur', `${rand(i + 420, 12, 28)}s`);
      b.style.setProperty('--delay', `${rand(i + 470, -25, 0)}s`);
      b.style.setProperty('--drift', `${rand(i + 520, -55, 55)}px`);
      frag.appendChild(b);
    }
    field.appendChild(frag);
  }

  function decorateTasks(scope = document) {
    scope.querySelectorAll('.task:not([data-aquatic])').forEach((card, index) => {
      const key = card.querySelector('[data-edit]')?.dataset.edit || card.textContent || String(index);
      const h = hash(key);
      card.dataset.aquatic = '1';
      card.style.setProperty('--swayX', `${rand(h + 1, -16, 16).toFixed(1)}px`);
      card.style.setProperty('--swayY', `${rand(h + 2, -13, 13).toFixed(1)}px`);
      card.style.setProperty('--rot', `${rand(h + 3, -2.8, 2.8).toFixed(2)}deg`);
      card.style.setProperty('--floatDur', `${rand(h + 4, 8, 15).toFixed(1)}s`);
      card.style.setProperty('--morphDur', `${rand(h + 5, 18, 32).toFixed(1)}s`);
      card.style.setProperty('--delay', `${rand(h + 6, -12, 0).toFixed(1)}s`);
    });
  }

  function decoratePanels(scope = document) {
    scope.querySelectorAll('.hero,.card,.stats .card').forEach((el, i) => {
      if (el.dataset.waterDecorated) return;
      el.dataset.waterDecorated = '1';
      el.style.setProperty('--panelDelay', `${-(i % 7) * 1.7}s`);
    });
  }

  function makeWave(idx, p) {
    const pts = [];
    for (let i = 0; i <= 48; i++) {
      const y = (i / 48) * 190;
      let xOff = 0;
      if (idx === 0) {
        const modY = ((y - p * 54) % 280 + 280) % 280 - 45;
        const sech = 1 / Math.cosh(modY * 0.075);
        xOff = 4 * Math.sin(p + y * 0.05) + 23 * sech * sech;
      } else if (idx === 1) {
        xOff = 7 * Math.sin(p * 2.5 + y * 0.28) + 2 * Math.sin(p * 4 + y * 0.52);
      } else if (idx === 2) {
        xOff = 24 * Math.exp(-y / 105) * Math.sin(p * 1.45 - y * 0.06);
      } else if (idx === 3) {
        xOff = 18 * Math.sin(p * 0.42 + y * 0.018) * Math.cos(p * 0.14);
      } else {
        xOff = 10 * Math.sin(p * 1.15 + y * 0.09) + 5 * Math.cos(p * 0.55 + y * 0.035);
      }
      pts.push(`${34 + xOff},${y}`);
    }
    return `M ${pts.join(' L ')}`;
  }

  function makeCurrent(idx, p) {
    const base = [95, 235, 405, 585][idx] || 300;
    const amp = [22, 32, 18, 28][idx] || 20;
    const pts = [];
    for (let i = 0; i <= 50; i++) {
      const x = (i / 50) * 1000;
      const y = base + amp * Math.sin(x * (0.009 + idx * 0.0015) + p * (0.35 + idx * 0.1)) + 9 * Math.cos(x * 0.021 - p * 0.22);
      pts.push(`${x},${y}`);
    }
    return `M ${pts.join(' L ')}`;
  }

  function animate() {
    if (!reduceMotion) {
      phase += 0.012 * viscosity;
      wavePaths.forEach((path, i) => path.setAttribute('d', makeWave(i, phase)));
      currentPaths.forEach((path, i) => path.setAttribute('d', makeCurrent(i, phase)));
    }
    requestAnimationFrame(animate);
  }

  function rheology(x, y) {
    if (lastPoint) {
      const dx = x - lastPoint.x;
      const dy = y - lastPoint.y;
      const speed = Math.hypot(dx, dy);
      const target = Math.max(.45, Math.min(2.5, speed / 35));
      viscosity = viscosity * .93 + target * .07;
    }
    lastPoint = { x, y };
    root.style.setProperty('--cursorX', `${(x / innerWidth - .5) * 18}px`);
    root.style.setProperty('--cursorY', `${(y / innerHeight - .5) * 18}px`);
    root.style.setProperty('--viscosity', viscosity.toFixed(2));
  }

  function burst(x, y, accent = '#5ee8ff') {
    if (reduceMotion || !field) return;
    for (let i = 0; i < 7; i++) {
      const b = document.createElement('i');
      b.className = 'burst-bubble';
      b.style.left = `${x}px`;
      b.style.top = `${y}px`;
      b.style.setProperty('--bx', `${rand(i + x, -34, 34)}px`);
      b.style.setProperty('--by', `${rand(i + y, -72, -28)}px`);
      b.style.setProperty('--bs', `${rand(i + x + y, 3, 10)}px`);
      b.style.setProperty('--burstColor', accent);
      field.appendChild(b);
      setTimeout(() => b.remove(), 950);
    }
  }

  document.addEventListener('pointermove', e => rheology(e.clientX, e.clientY), { passive: true });
  document.addEventListener('touchmove', e => {
    const t = e.touches && e.touches[0];
    if (t) rheology(t.clientX, t.clientY);
  }, { passive: true });

  document.addEventListener('click', e => {
    const target = e.target.closest('.orb,.done,.nav-button,.primary,.secondary');
    if (!target) return;
    const r = target.getBoundingClientRect();
    const accent = target.closest('.task')?.style.getPropertyValue('--accent') || '#5ee8ff';
    burst(r.left + r.width / 2, r.top + r.height / 2, accent);
  }, true);

  const observer = new MutationObserver(mutations => {
    let changed = false;
    for (const m of mutations) if (m.addedNodes.length || m.removedNodes.length) { changed = true; break; }
    if (changed) {
      decorateTasks();
      decoratePanels();
    }
  });

  seedWaterColumn();
  decorateTasks();
  decoratePanels();
  observer.observe(document.body, { childList: true, subtree: true });
  animate();
})();