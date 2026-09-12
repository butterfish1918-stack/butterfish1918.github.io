(async () => {
  const BUILD = '5';
  const parts = [
    `./app.part00.txt?v=${BUILD}`,
    `./app.part01.txt?v=${BUILD}`,
    `./app.part02.txt?v=${BUILD}`,
    `./app.part03.txt?v=${BUILD}`,
    `./app.part04.txt?v=${BUILD}`
  ];

  try {
    const responses = await Promise.all(parts.map((url) => fetch(url, { cache: 'no-store' })));
    if (responses.some((response) => !response.ok)) {
      throw new Error('Could not load application source.');
    }

    const chunks = await Promise.all(responses.map((response) => response.text()));

    // Early builds were split at an unsafe character boundary. If a legacy
    // overlap is ever returned by an old PWA cache, normalize it before Babel.
    const legacyOverlap = "', 'entropy', 'harmonicMorph', 'rootFreq', 'feedbackIntensity'];\n";
    if (chunks[2] && chunks[2].startsWith(legacyOverlap)) {
      chunks[2] = chunks[2].slice(legacyOverlap.length);
    }

    if (chunks.some((chunk) => !chunk || !chunk.trim())) {
      throw new Error('Application source is incomplete.');
    }

    const source = chunks.join('');
    const compiled = Babel.transform(source, { presets: ['react'], sourceType: 'script' }).code;
    new Function(compiled)();
  } catch (error) {
    console.error('Heliocentric startup error:', error);
    const root = document.getElementById('root');
    if (root) {
      root.innerHTML = '<div class="fatal-error"><strong>Heliocentric could not start.</strong><span>The app cache was repaired. Close this tab and open Heliocentric again.</span></div>';
    }
  }
})();
