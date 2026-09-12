(async () => {
  const BUILD = '8';
  const root = document.getElementById('root');

  const fail = (message, detail = '') => {
    console.error('Heliocentric startup error:', message, detail);
    if (root) {
      const safe = String(detail || message || 'Unknown startup error')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      root.innerHTML = `<div class="fatal-error"><strong>Heliocentric could not start.</strong><span>${safe}</span></div>`;
    }
  };

  try {
    if (!window.React || !window.ReactDOM) {
      throw new Error('React runtime did not load.');
    }

    const partNames = [
      'app.part00.txt',
      'app.part01.txt',
      'app.part02.txt',
      'app.part03.txt',
      'app.part04.txt'
    ];

    const chunks = [];
    for (const name of partNames) {
      const response = await fetch(`./${name}?v=${BUILD}`, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`${name} failed to load (${response.status}).`);
      }
      const text = await response.text();
      if (!text.trim()) {
        throw new Error(`${name} was empty.`);
      }
      chunks.push(text);
    }

    const source = chunks.join('');
    new Function(`${source}\n//# sourceURL=heliocentric-app-v${BUILD}.js`)();
  } catch (error) {
    fail('Startup failed', error && (error.stack || error.message) ? (error.stack || error.message) : String(error));
  }
})();
