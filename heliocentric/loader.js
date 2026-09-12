(async () => {
  const parts = [
    './app.part00.txt',
    './app.part01.txt',
    './app.part02.txt',
    './app.part03.txt',
    './app.part04.txt'
  ];

  try {
    const responses = await Promise.all(parts.map((url) => fetch(url, { cache: 'no-store' })));
    if (responses.some((response) => !response.ok)) {
      throw new Error('Could not load application source.');
    }

    const chunks = await Promise.all(responses.map((response) => response.text()));

    // v1 was split at an unsafe character boundary. If that legacy overlap is
    // ever served from an old Android/PWA cache, remove it before compiling.
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
