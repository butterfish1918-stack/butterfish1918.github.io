(() => {
  const $ = (selector) => document.querySelector(selector);
  const readout = $('.live-readout');
  const stateEl = $('.live-state');
  const bpmEl = $('.live-bpm');
  const dot = $('.live-dot');
  const selectedChip = $('.selected-chip strong');
  const help = $('.help-menu');

  const controls = () => ({
    play: $('.play-button'),
    generate: $('.left-button'),
    clear: $('.right-button')
  });

  const refresh = () => {
    const { play } = controls();
    const toneState = window.Tone && Tone.Transport ? Tone.Transport.state : 'stopped';
    const playing = toneState === 'started' || (play && play.textContent.includes('Ⅱ'));
    const bpm = window.Tone && Tone.Transport && Tone.Transport.bpm
      ? Math.round(Tone.Transport.bpm.value)
      : 120;

    if (readout) readout.classList.toggle('is-live', playing);
    if (stateEl) stateEl.textContent = playing ? 'Live' : 'Ready';
    if (bpmEl) bpmEl.textContent = `${bpm} BPM`;
    if (dot) dot.setAttribute('aria-label', playing ? 'Playing' : 'Stopped');
    if (play) play.classList.toggle('is-playing', playing);

    const statusRows = document.querySelectorAll('.status-row');
    if (selectedChip) {
      const label = statusRows[0] ? statusRows[0].textContent.replace(/^◉\s*/, '').trim() : '';
      if (label && /SYNCED$/i.test(label)) {
        selectedChip.textContent = label.replace(/\s+SYNCED$/i, '');
      } else {
        selectedChip.textContent = 'No track selected';
      }
    }
  };

  document.addEventListener('keydown', (event) => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const tag = event.target && event.target.tagName ? event.target.tagName.toLowerCase() : '';
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

    const key = event.key.toLowerCase();
    const { play, generate, clear } = controls();

    if (event.code === 'Space') {
      event.preventDefault();
      if (play) play.click();
    } else if (key === 'g') {
      if (generate) generate.click();
    } else if (key === 'x') {
      if (clear) clear.click();
    } else if (key === 'h' || key === '?') {
      if (help) help.open = !help.open;
    } else if (event.key === 'Escape') {
      if (help) help.open = false;
    }
  });

  if (help) {
    help.addEventListener('toggle', () => {
      const summary = help.querySelector('summary');
      if (summary) summary.setAttribute('aria-expanded', help.open ? 'true' : 'false');
    });
  }

  refresh();
  setInterval(refresh, 220);
})();
