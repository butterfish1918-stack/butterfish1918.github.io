(async () => {
  const parts = [
    './app.part00.txt',
    './app.part01.txt',
    './app.part02.txt',
    './app.part03.txt',
    './app.part04.txt'
  ];
  try {
    const responses = await Promise.all(parts.map((url) => fetch(url, { cache: 'no-cache' })));
    if (responses.some((response) => !response.ok)) throw new Error('Could not load application source.');
    const source = (await Promise.all(responses.map((response) => response.text()))).join('');
    const compiled = Babel.transform(source, { presets: ['react'], sourceType: 'script' }).code;
    new Function(compiled)();
  } catch (error) {
    console.error(error);
    const root = document.getElementById('root');
    if (root) root.innerHTML = '<div class="fatal-error"><strong>Heliocentric could not start.</strong><span>Reload the page while online once, then try again.</span></div>';
  }
})();
