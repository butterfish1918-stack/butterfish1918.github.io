/* Rusty Needle DJ Deck — library, import, media and performance extensions */
(() => {
    const SETTINGS_KEY = 'rusty-needle-dj-settings-v1';
    const AUDIO_DB = 'rusty-needle-media-v1';
    const AUDIO_STORE = 'audio';
    const MAX_MIDI_NOTES = 12000;

    const ui = {
        search: document.getElementById('library-search'),
        favFilter: document.getElementById('btn-filter-favs'),
        random: document.getElementById('btn-random-pick'),
        count: document.getElementById('library-count'),
        queueCount: document.getElementById('queue-count'),
        autoDJ: document.getElementById('btn-auto-dj'),
        shuffle: document.getElementById('btn-shuffle-queue'),
        clearQueue: document.getElementById('btn-clear-queue'),
        favQueue: document.getElementById('btn-queue-favs'),
        seekBack: document.getElementById('btn-seek-back'),
        seekForward: document.getElementById('btn-seek-forward'),
        tempo: document.getElementById('tempo-control'),
        tempoValue: document.getElementById('tempo-value'),
        volume: document.getElementById('master-volume'),
        volumeValue: document.getElementById('volume-value'),
        importButton: document.getElementById('btn-import-files'),
        importInput: document.getElementById('file-import'),
        exportLibrary: document.getElementById('btn-export-library'),
        exportSelected: document.getElementById('btn-export-selected'),
        importStatus: document.getElementById('import-status'),
        nowTitle: document.getElementById('now-playing-title'),
        nowMeta: document.getElementById('now-playing-meta')
    };

    let favoritesOnly = false;
    let audioDbPromise = null;
    let currentAudioElement = null;
    let currentAudioSource = null;
    let currentAudioUrl = null;
    let autoDJEnabled = false;
    let autoDJIds = [];
    let autoDJIndex = -1;
    let autoDJTimer = null;
    let savedLoopState = true;
    let tempoPercent = 100;
    let volumePercent = 78;

    window.RustyNeedleDJ = {
        get tempo() { return tempoPercent / 100; },
        get volume() { return volumePercent / 100; }
    };

    function setStatus(message, tone = 'amber') {
        if (!ui.importStatus) return;
        ui.importStatus.textContent = message;
        ui.importStatus.dataset.tone = tone;
    }

    function loadSettings() {
        try {
            const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
            tempoPercent = Math.min(150, Math.max(50, Number(saved.tempo) || 100));
            volumePercent = Math.min(100, Math.max(0, Number(saved.volume) || 78));
            favoritesOnly = Boolean(saved.favoritesOnly);
        } catch (_) {}
        if (ui.tempo) ui.tempo.value = tempoPercent;
        if (ui.volume) ui.volume.value = volumePercent;
        if (ui.tempoValue) ui.tempoValue.textContent = `${tempoPercent}%`;
        if (ui.volumeValue) ui.volumeValue.textContent = `${volumePercent}%`;
        if (ui.favFilter) ui.favFilter.classList.toggle('active', favoritesOnly);
    }

    function saveSettings() {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify({ tempo: tempoPercent, volume: volumePercent, favoritesOnly }));
    }

    function applyMasterVolume() {
        if (!makeupGain || !audioContext) return;
        makeupGain.gain.setTargetAtTime((volumePercent / 100) * 2, audioContext.currentTime, 0.03);
    }

    function openAudioDb() {
        if (audioDbPromise) return audioDbPromise;
        audioDbPromise = new Promise((resolve, reject) => {
            if (!('indexedDB' in window)) return reject(new Error('IndexedDB unavailable'));
            const request = indexedDB.open(AUDIO_DB, 1);
            request.onupgradeneeded = () => {
                const db = request.result;
                if (!db.objectStoreNames.contains(AUDIO_STORE)) db.createObjectStore(AUDIO_STORE);
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error || new Error('Media database failed'));
        });
        return audioDbPromise;
    }

    async function audioDbPut(id, blob) {
        const db = await openAudioDb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(AUDIO_STORE, 'readwrite');
            tx.objectStore(AUDIO_STORE).put(blob, id);
            tx.oncomplete = resolve;
            tx.onerror = () => reject(tx.error);
        });
    }

    async function audioDbGet(id) {
        const db = await openAudioDb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(AUDIO_STORE, 'readonly');
            const req = tx.objectStore(AUDIO_STORE).get(id);
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => reject(req.error);
        });
    }

    async function audioDbDelete(id) {
        try {
            const db = await openAudioDb();
            await new Promise((resolve, reject) => {
                const tx = db.transaction(AUDIO_STORE, 'readwrite');
                tx.objectStore(AUDIO_STORE).delete(id);
                tx.oncomplete = resolve;
                tx.onerror = () => reject(tx.error);
            });
        } catch (_) {}
    }

    const isAudioSong = song => song && song.kind === 'audio';

    function inferSongBpm(song) {
        if (song.bpm) return Math.round(song.bpm);
        const match = String(song.abcData || '').match(/^Q:(?:.*?=)?\s*(\d+(?:\.\d+)?)/m);
        return match ? Math.round(Number(match[1])) : null;
    }

    function inferSongKey(song) {
        if (song.key) return song.key;
        const match = String(song.abcData || '').match(/^K:\s*([^\n%]+)/m);
        return match ? match[1].trim().split(/\s+/)[0] : null;
    }

    function updateCounts() {
        if (ui.count) ui.count.textContent = `${archiveData.length} RECORD${archiveData.length === 1 ? '' : 'S'}`;
        const q = document.querySelectorAll('.song-selector:checked').length;
        if (ui.queueCount) ui.queueCount.textContent = `${q}/10 QUEUED`;
    }

    function applyLibraryFilter() {
        const q = (ui.search?.value || '').trim().toLowerCase();
        document.querySelectorAll('#song-list .song-card').forEach((card, index) => {
            const song = archiveData[index];
            if (!song) { card.hidden = Boolean(q || favoritesOnly); return; }
            const haystack = `${song.title || ''} ${song.sourceFormat || ''} ${inferSongKey(song) || ''} ${inferSongBpm(song) || ''}`.toLowerCase();
            card.hidden = Boolean((q && !haystack.includes(q)) || (favoritesOnly && !song.favorite));
        });
    }

    function decorateCards() {
        document.querySelectorAll('#song-list .song-card').forEach((card, index) => {
            const song = archiveData[index];
            if (!song || card.classList.contains('empty')) return;
            if (isAudioSong(song)) card.classList.add('audio-track');
            const title = card.querySelector('.song-title');
            if (title && !card.querySelector('.track-badges')) {
                const badges = document.createElement('div');
                badges.className = 'track-badges';
                const fmt = song.sourceFormat || (isAudioSong(song) ? 'AUDIO' : 'ABC');
                const bpm = inferSongBpm(song);
                const key = inferSongKey(song);
                badges.innerHTML = `<span>${escapeHTML(String(fmt).toUpperCase())}</span>${bpm ? `<span>${bpm} BPM</span>` : ''}${key ? `<span>${escapeHTML(key)}</span>` : ''}`;
                title.insertAdjacentElement('afterend', badges);
            }
            if (!card.querySelector('.favorite-toggle')) {
                const fav = document.createElement('button');
                fav.type = 'button';
                fav.className = `favorite-toggle ${song.favorite ? 'active' : ''}`;
                fav.title = song.favorite ? 'Remove from favourites' : 'Add to favourites';
                fav.setAttribute('aria-label', fav.title);
                fav.textContent = song.favorite ? '★' : '☆';
                fav.addEventListener('click', e => {
                    e.stopPropagation();
                    song.favorite = !song.favorite;
                    persistArchive();
                    renderArchiveUI();
                });
                card.appendChild(fav);
            }
        });
        applyLibraryFilter();
        updateCounts();
    }

    const baseRenderArchiveUI = renderArchiveUI;
    renderArchiveUI = function() { baseRenderArchiveUI(); decorateCards(); };

    const baseDeleteComposition = window.deleteComposition;
    window.deleteComposition = async function(e, id) {
        const song = archiveData.find(s => s.id === id);
        if (isAudioSong(song)) await audioDbDelete(id);
        return baseDeleteComposition(e, id);
    };

    function getAllQueuedSongs() {
        const ids = Array.from(document.querySelectorAll('.song-selector:checked')).map(cb => cb.dataset.id);
        return ids.map(id => archiveData.find(song => song.id === id)).filter(Boolean);
    }

    const baseGetQueuedCompositions = getQueuedCompositions;
    getQueuedCompositions = function() { return baseGetQueuedCompositions().filter(song => !isAudioSong(song)); };

    function updateNowPlaying(song, mode = 'SOLO') {
        if (!ui.nowTitle || !ui.nowMeta) return;
        if (!song) {
            ui.nowTitle.textContent = 'NO RECORD ON THE PLATTER';
            ui.nowMeta.textContent = 'READY • LOCAL LIBRARY';
            return;
        }
        ui.nowTitle.textContent = song.title || 'UNTITLED RECORD';
        const bits = [mode];
        if (song.sourceFormat) bits.push(String(song.sourceFormat).toUpperCase());
        const bpm = inferSongBpm(song), key = inferSongKey(song);
        if (bpm) bits.push(`${bpm} BPM`);
        if (key) bits.push(`KEY ${key}`);
        ui.nowMeta.textContent = bits.join(' • ');
    }

    function touchPlayMetadata(song) {
        if (!song || !song.id || song.id === 'stochastic_matrix') return;
        const stored = archiveData.find(s => s.id === song.id);
        if (!stored) return;
        stored.playCount = (stored.playCount || 0) + 1;
        stored.lastPlayed = Date.now();
        persistArchive();
    }

    function scaleAbcTempo(abc) {
        const factor = tempoPercent / 100;
        if (!abc || Math.abs(factor - 1) < 0.001) return abc;
        if (/^Q:/m.test(abc)) {
            return abc.replace(/^Q:(.*?=)?\s*(\d+(?:\.\d+)?).*$/m, (line, prefix, bpm) => {
                const next = Math.max(20, Math.min(400, Math.round(Number(bpm) * factor)));
                return `Q:${prefix || '1/4='}${next}`;
            });
        }
        return abc.replace(/^K:/m, `Q:1/4=${Math.round(120 * factor)}\nK:`);
    }

    const baseExecutePlayback = executePlayback;
    executePlayback = async function(songs, mode, triggerBtn = null) {
        if (!songs || !songs.length) return;
        if (songs.length === 1 && isAudioSong(songs[0])) return executeAudioPlayback(songs[0], triggerBtn);
        songs.forEach(touchPlayMetadata);
        updateNowPlaying(songs[0], mode);
        const playSongs = songs.map(song => isAudioSong(song) ? song : ({ ...song, abcData: scaleAbcTempo(song.abcData || '') }));
        const result = await baseExecutePlayback(playSongs, mode, triggerBtn);
        applyMasterVolume();
        if (autoDJEnabled && mode === 'SOLO' && songs.length === 1 && totalTime > 0) {
            clearTimeout(autoDJTimer);
            autoDJTimer = setTimeout(() => { if (autoDJEnabled) advanceAutoDJ(); }, Math.max(600, totalTime * 1000 + 150));
        }
        return result;
    };

    const baseStopPlayback = stopPlayback;
    stopPlayback = function() {
        stopAudioCore();
        baseStopPlayback();
        if (!autoDJEnabled) updateNowPlaying(null);
    };

    function stopAudioCore() {
        if (currentAudioElement) {
            try { currentAudioElement.onended = null; currentAudioElement.pause(); currentAudioElement.removeAttribute('src'); currentAudioElement.load(); } catch (_) {}
        }
        if (currentAudioSource) { try { currentAudioSource.disconnect(); } catch (_) {} }
        if (currentAudioUrl) URL.revokeObjectURL(currentAudioUrl);
        currentAudioElement = null; currentAudioSource = null; currentAudioUrl = null;
    }

    async function executeAudioPlayback(song, triggerBtn = null) {
        stopPlayback();
        clearTimeout(autoDJTimer);
        try {
            await initAudioGraph();
            const blob = await audioDbGet(song.id);
            if (!blob) throw new Error('The original audio file is no longer stored on this device.');
            currentMode = 'AUDIO'; lastPlayedSongs = [song]; lastPlayedMode = 'AUDIO'; lastPlayedTriggerBtn = triggerBtn;
            btnStop.disabled = false;
            if (triggerBtn) triggerBtn.classList.add('active');
            currentAudioUrl = URL.createObjectURL(blob);
            const el = new Audio();
            currentAudioElement = el;
            el.preload = 'auto'; el.src = currentAudioUrl;
            await new Promise((resolve, reject) => {
                const ready = () => { cleanup(); resolve(); };
                const fail = () => { cleanup(); reject(new Error('Browser could not decode this audio file.')); };
                const cleanup = () => { el.removeEventListener('loadedmetadata', ready); el.removeEventListener('error', fail); };
                el.addEventListener('loadedmetadata', ready); el.addEventListener('error', fail); el.load();
            });
            el.playbackRate = tempoPercent / 100;
            currentAudioSource = audioContext.createMediaElementSource(el);
            currentAudioSource.connect(masterCompressor);
            totalTime = Number.isFinite(el.duration) ? el.duration : 0;
            startTime = audioContext.currentTime; isPlaying = true;
            touchPlayMetadata(song); updateNowPlaying(song, 'DECK'); applyMasterVolume();
            notationEl.innerHTML = `<div class="audio-now-playing"><div class="vinyl-stage"><div class="vinyl-record"><div class="vinyl-label"></div></div></div><div class="audio-copy"><span class="eyebrow">LOCAL AUDIO RECORD</span><strong>${escapeHTML(song.title || 'UNTITLED')}</strong><span>${escapeHTML(String(song.sourceFormat || 'AUDIO').toUpperCase())} • ${formatTime(totalTime)}</span></div></div>`;
            el.onended = () => {
                if (autoDJEnabled) advanceAutoDJ();
                else if (isLooping) executeAudioPlayback(song, triggerBtn);
                else stopPlayback();
            };
            await el.play();
            updateAudioUI();
        } catch (err) {
            console.error(err); setStatus(err.message || 'Audio playback failed', 'red'); alert(err.message || 'Audio playback failed.'); stopPlayback();
        }
    }

    function updateAudioUI() {
        if (!currentAudioElement || !isPlaying || currentMode !== 'AUDIO') return;
        const t = currentAudioElement.currentTime || 0, d = currentAudioElement.duration || totalTime || 0;
        timeDisplayEl.innerText = `${formatTime(t)} / ${formatTime(d)}`;
        animationFrameId = requestAnimationFrame(updateAudioUI);
    }

    function seekRelative(seconds) {
        if (!isPlaying) return;
        if (currentMode === 'AUDIO' && currentAudioElement) {
            currentAudioElement.currentTime = Math.max(0, Math.min(currentAudioElement.duration || 0, currentAudioElement.currentTime + seconds));
            return;
        }
        if (!audioContext || !totalTime) return;
        const elapsed = audioContext.currentTime - startTime;
        const target = Math.max(0, Math.min(totalTime, elapsed + seconds));
        const percent = totalTime ? target / totalTime : 0;
        activeSynths.forEach(synth => { try { if (typeof synth.seek === 'function') synth.seek(percent); } catch (_) {} });
        startTime = audioContext.currentTime - target;
        if (timingCallbacks?.setProgress) timingCallbacks.setProgress(percent);
    }

    function selectSong(song) {
        if (!song) return;
        selectedCompositionId = song.id; titleInput.value = song.title || ''; abcInput.value = song.abcData || '';
        renderArchiveUI();
        const index = archiveData.findIndex(s => s.id === song.id);
        const row = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(index / 6) % 26], col = (index % 6) + 1;
        selectionStatus.innerText = `LOCKED: SLOT ${row}${col}`; selectionStatus.style.color = 'var(--neon-green)'; archiveDropdown.value = song.id;
    }

    function clearQueue() {
        document.querySelectorAll('.song-selector, #rapid-queue-container input[type="checkbox"]').forEach(cb => cb.checked = false);
        document.querySelectorAll('.card-checkbox-zone').forEach(zone => zone.classList.remove('active-queue'));
        updateCounts();
    }

    function queueFavorites() {
        clearQueue();
        const favorites = archiveData.filter(s => s.favorite).slice(0, 10);
        favorites.forEach(song => {
            const cb = document.querySelector(`.song-selector[data-id="${song.id}"]`);
            if (cb) { cb.checked = true; cb.closest('.card-checkbox-zone')?.classList.add('active-queue'); }
            const rapid = document.querySelector(`#rapid-queue-container input[value="${song.id}"]`);
            if (rapid) rapid.checked = true;
        });
        updateCounts();
        setStatus(favorites.length ? `${favorites.length} favourite record${favorites.length === 1 ? '' : 's'} queued` : 'No favourite records yet');
    }

    function shuffled(items) {
        const copy = [...items];
        for (let i = copy.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [copy[i], copy[j]] = [copy[j], copy[i]]; }
        return copy;
    }

    function startAutoDJ() {
        const queue = getAllQueuedSongs(), source = queue.length ? queue : archiveData;
        if (!source.length) return alert('Import or archive at least one record first.');
        savedLoopState = isLooping; isLooping = false;
        btnLoop.innerText = 'LOOP: OFF'; btnLoop.style.borderColor = '#888'; btnLoop.style.color = '#888';
        autoDJIds = source.map(s => s.id); autoDJIndex = -1; autoDJEnabled = true;
        ui.autoDJ?.classList.add('active'); if (ui.autoDJ) ui.autoDJ.textContent = 'AUTO-DJ: ON';
        setStatus(`Auto-DJ armed with ${autoDJIds.length} record${autoDJIds.length === 1 ? '' : 's'}`, 'green'); advanceAutoDJ();
    }

    function stopAutoDJ() {
        autoDJEnabled = false; clearTimeout(autoDJTimer); autoDJTimer = null;
        ui.autoDJ?.classList.remove('active'); if (ui.autoDJ) ui.autoDJ.textContent = 'AUTO-DJ';
        isLooping = savedLoopState;
        btnLoop.innerText = `LOOP: ${isLooping ? 'ON' : 'OFF'}`;
        btnLoop.style.borderColor = isLooping ? '#4CAF50' : '#888'; btnLoop.style.color = isLooping ? '#4CAF50' : '#888';
        setStatus('Auto-DJ disengaged');
    }

    function advanceAutoDJ() {
        if (!autoDJEnabled || !autoDJIds.length) return;
        autoDJIndex = (autoDJIndex + 1) % autoDJIds.length;
        const song = archiveData.find(s => s.id === autoDJIds[autoDJIndex]);
        if (!song) return advanceAutoDJ();
        selectSong(song); executePlayback([song], 'SOLO', null);
    }

    function shuffleAutoDJ() {
        const source = getAllQueuedSongs();
        autoDJIds = shuffled((source.length ? source : archiveData).map(s => s.id)); autoDJIndex = -1;
        setStatus(`${autoDJIds.length} records shuffled for Auto-DJ`, 'green'); if (autoDJEnabled) advanceAutoDJ();
    }

    const getExt = name => { const dot = name.lastIndexOf('.'); return dot >= 0 ? name.slice(dot + 1).toLowerCase() : ''; };
    const stripExt = name => name.replace(/\.[^.]+$/, '');
    const sanitizeFileName = name => String(name || 'rusty-needle-record').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-') || 'rusty-needle-record';

    function downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob), a = document.createElement('a');
        a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1200);
    }

    async function getAudioDuration(file) {
        const url = URL.createObjectURL(file);
        try {
            const audio = new Audio(); audio.preload = 'metadata'; audio.src = url;
            return await new Promise(resolve => {
                audio.addEventListener('loadedmetadata', () => resolve(Number.isFinite(audio.duration) ? audio.duration : 0), { once: true });
                audio.addEventListener('error', () => resolve(0), { once: true }); audio.load();
            });
        } finally { URL.revokeObjectURL(url); }
    }

    function splitABCTunes(text, fallbackTitle) {
        const cleaned = String(text || '').replace(/\r\n/g, '\n').trim();
        if (!cleaned) return [];
        const starts = [...cleaned.matchAll(/^X:\s*\d+.*$/gm)];
        let chunks = [];
        if (starts.length > 1) {
            for (let i = 0; i < starts.length; i++) chunks.push(cleaned.slice(starts[i].index, i + 1 < starts.length ? starts[i + 1].index : cleaned.length).trim());
        } else chunks = [cleaned];
        return chunks.filter(chunk => /^K:/m.test(chunk)).map((abc, idx) => ({
            title: abc.match(/^T:\s*(.+)$/m)?.[1]?.trim() || `${fallbackTitle}${chunks.length > 1 ? ` ${idx + 1}` : ''}`, abcData: abc
        }));
    }

    function readVarLen(bytes, state) {
        let value = 0;
        for (let i = 0; i < 4; i++) { const b = bytes[state.pos++]; value = (value << 7) | (b & 0x7f); if (!(b & 0x80)) break; }
        return value;
    }

    function midiPitchToABC(pitch) {
        const names = ['C','^C','D','^D','E','F','^F','G','^G','A','^A','B'];
        const pc = ((pitch % 12) + 12) % 12, octave = Math.floor(pitch / 12) - 1;
        let note = names[pc];
        if (octave >= 5) { note = note.replace(/[A-G]/, m => m.toLowerCase()); if (octave > 5) note += "'".repeat(octave - 5); }
        else if (octave < 4) note += ",".repeat(4 - octave);
        return note;
    }

    function keyFromFifths(sf) {
        const major = ['Cb','Gb','Db','Ab','Eb','Bb','F','C','G','D','A','E','B','F#','C#'];
        return major[Math.max(0, Math.min(14, sf + 7))] || 'C';
    }

    function midiToABC(buffer, fallbackTitle) {
        const bytes = new Uint8Array(buffer), view = new DataView(buffer);
        const tag = p => String.fromCharCode(bytes[p], bytes[p+1], bytes[p+2], bytes[p+3]);
        if (tag(0) !== 'MThd') throw new Error('Not a Standard MIDI file.');
        const headerLen = view.getUint32(4), tracks = view.getUint16(10), divisionRaw = view.getUint16(12);
        if (divisionRaw & 0x8000) throw new Error('SMPTE-timed MIDI is not supported yet.');
        const ppq = divisionRaw || 480;
        let pos = 8 + headerLen, tempo = 120, beats = 4, beatType = 4, key = 'C', title = fallbackTitle, allNotes = [];

        for (let tr = 0; tr < tracks && pos + 8 <= bytes.length; tr++) {
            if (tag(pos) !== 'MTrk') break;
            const len = view.getUint32(pos + 4), end = Math.min(bytes.length, pos + 8 + len), state = { pos: pos + 8 };
            let tick = 0, running = 0; const active = new Map();
            while (state.pos < end) {
                tick += readVarLen(bytes, state);
                let status = bytes[state.pos++];
                if (status < 0x80) { state.pos--; status = running; } else if (status < 0xf0) running = status;
                if (status === 0xff) {
                    const type = bytes[state.pos++], size = readVarLen(bytes, state), start = state.pos;
                    if (type === 0x51 && size === 3 && tempo === 120) {
                        const micros = (bytes[start] << 16) | (bytes[start+1] << 8) | bytes[start+2]; if (micros) tempo = 60000000 / micros;
                    } else if (type === 0x58 && size >= 2) { beats = bytes[start] || 4; beatType = Math.pow(2, bytes[start+1]) || 4; }
                    else if (type === 0x59 && size >= 2) { const sf = bytes[start] > 127 ? bytes[start] - 256 : bytes[start]; key = keyFromFifths(sf); }
                    else if (type === 0x03 && size && title === fallbackTitle) { try { title = new TextDecoder().decode(bytes.slice(start, start + size)).trim() || fallbackTitle; } catch (_) {} }
                    state.pos += size; continue;
                }
                if (status === 0xf0 || status === 0xf7) { state.pos += readVarLen(bytes, state); continue; }
                const cmd = status & 0xf0, ch = status & 0x0f, d1 = bytes[state.pos++], two = ![0xc0, 0xd0].includes(cmd), d2 = two ? bytes[state.pos++] : 0;
                if (cmd === 0x90 && d2 > 0) {
                    const k = `${ch}:${d1}`; if (!active.has(k)) active.set(k, []); active.get(k).push({ start: tick, pitch: d1, velocity: d2 });
                } else if (cmd === 0x80 || (cmd === 0x90 && d2 === 0)) {
                    const k = `${ch}:${d1}`, stack = active.get(k);
                    if (stack?.length) {
                        const note = stack.shift(); allNotes.push({ ...note, end: Math.max(tick, note.start + 1) });
                        if (allNotes.length > MAX_MIDI_NOTES) throw new Error('MIDI file is too large for browser conversion.');
                    }
                }
            }
            pos = end;
        }
        if (!allNotes.length) throw new Error('No playable MIDI notes were found.');
        allNotes.sort((a,b) => a.start - b.start || a.pitch - b.pitch);
        const unitTicks = ppq / 4, quant = n => Math.max(0, Math.round(n / unitTicks)), groups = new Map();
        allNotes.forEach(n => { const start = quant(n.start), dur = Math.max(1, quant(n.end - n.start)); if (!groups.has(start)) groups.set(start, []); groups.get(start).push({ pitch: n.pitch, dur }); });
        const startsSorted = [...groups.keys()].sort((a,b) => a-b), measureUnits = Math.max(1, Math.round(beats * 16 / beatType));
        let cursor = 0, measureCursor = 0, body = '';
        const emitUnits = (token, units) => {
            let left = units;
            while (left > 0) {
                const room = measureUnits - measureCursor, take = Math.min(left, room);
                body += `${token}${take === 1 ? '' : take} `; cursor += take; measureCursor += take; left -= take;
                if (measureCursor >= measureUnits) { body += '|\n'; measureCursor = 0; }
            }
        };
        startsSorted.forEach(start => {
            if (start > cursor) emitUnits('z', start - cursor);
            const notes = groups.get(start), dur = Math.max(...notes.map(n => n.dur)), pitches = [...new Set(notes.map(n => n.pitch))].sort((a,b) => a-b);
            const token = pitches.length > 1 ? `[${pitches.map(midiPitchToABC).join('')}]` : midiPitchToABC(pitches[0]); emitUnits(token, dur);
        });
        body += measureCursor ? '|]' : ']';
        return { title, bpm: Math.round(tempo), key, abcData: `X:1\nT:${title}\nM:${beats}/${beatType}\nL:1/16\nQ:1/4=${Math.round(tempo)}\nK:${key}\n% Imported from Standard MIDI\n${body}` };
    }

    function xmlPitchToABC(note) {
        const step = note.querySelector('pitch > step')?.textContent || 'C', alter = Number(note.querySelector('pitch > alter')?.textContent || 0), octave = Number(note.querySelector('pitch > octave')?.textContent || 4);
        let acc = alter === 1 ? '^' : alter === -1 ? '_' : alter >= 2 ? '^^' : alter <= -2 ? '__' : '', letter = step.toUpperCase();
        if (octave >= 5) letter = letter.toLowerCase() + (octave > 5 ? "'".repeat(octave - 5) : '');
        else if (octave < 4) letter += ",".repeat(4 - octave);
        return acc + letter;
    }

    function musicXMLToABC(text, fallbackTitle) {
        const doc = new DOMParser().parseFromString(text, 'application/xml');
        if (doc.querySelector('parsererror')) throw new Error('MusicXML could not be parsed.');
        const title = doc.querySelector('work-title, movement-title')?.textContent?.trim() || fallbackTitle, part = doc.querySelector('part');
        if (!part) throw new Error('No MusicXML part found.');
        const divisions = Number(part.querySelector('divisions')?.textContent || 1), beats = Number(part.querySelector('time > beats')?.textContent || 4), beatType = Number(part.querySelector('time > beat-type')?.textContent || 4);
        const key = keyFromFifths(Number(part.querySelector('key > fifths')?.textContent || 0));
        const tempo = Math.round(Number(doc.querySelector('sound[tempo]')?.getAttribute('tempo') || doc.querySelector('per-minute')?.textContent || 120));
        const measureUnits = Math.max(1, Math.round(beats * 16 / beatType)); let body = '';
        part.querySelectorAll(':scope > measure').forEach(measure => {
            let used = 0;
            const notes = [...measure.querySelectorAll(':scope > note')].filter(note => { const voice = note.querySelector(':scope > voice')?.textContent; return !voice || voice === '1'; });
            for (let i = 0; i < notes.length; i++) {
                const note = notes[i]; if (note.querySelector(':scope > chord')) continue;
                const durationDiv = Number(note.querySelector(':scope > duration')?.textContent || divisions), units = Math.max(1, Math.round((durationDiv / divisions) * 4));
                let token = note.querySelector(':scope > rest') ? 'z' : xmlPitchToABC(note), chordPitches = [token], j = i + 1;
                let k = j;
                while (k < notes.length && notes[k].querySelector(':scope > chord')) { if (!notes[k].querySelector(':scope > rest')) chordPitches.push(xmlPitchToABC(notes[k])); k++; }
                if (chordPitches.length > 1 && token !== 'z') token = `[${chordPitches.join('')}]`;
                body += `${token}${units === 1 ? '' : units} `; used += units;
            }
            if (used < measureUnits) body += `z${measureUnits - used === 1 ? '' : measureUnits - used} `;
            body += '|\n';
        });
        return { title, bpm: tempo, key, abcData: `X:1\nT:${title}\nM:${beats}/${beatType}\nL:1/16\nQ:1/4=${tempo}\nK:${key}\n% Imported from MusicXML\n${body}|]` };
    }

    async function importFile(file) {
        const ext = getExt(file.name), fallbackTitle = stripExt(file.name) || 'Imported Record';
        if (['mp3','wav','ogg','m4a','aac','flac','webm','opus'].includes(ext)) {
            const id = newId(); await audioDbPut(id, file); const duration = await getAudioDuration(file);
            archiveData.unshift({ id, title: fallbackTitle, abcData: '', timestamp: Date.now(), kind: 'audio', sourceFormat: ext.toUpperCase(), duration, originalName: file.name, size: file.size }); return 1;
        }
        if (ext === 'mid' || ext === 'midi') {
            const c = midiToABC(await file.arrayBuffer(), fallbackTitle);
            archiveData.unshift({ id: newId(), title: c.title, abcData: c.abcData, timestamp: Date.now(), kind: 'notation', sourceFormat: 'MIDI', bpm: c.bpm, key: c.key, originalName: file.name }); return 1;
        }
        if (ext === 'musicxml' || ext === 'xml') {
            const c = musicXMLToABC(await file.text(), fallbackTitle);
            archiveData.unshift({ id: newId(), title: c.title, abcData: c.abcData, timestamp: Date.now(), kind: 'notation', sourceFormat: 'MUSICXML', bpm: c.bpm, key: c.key, originalName: file.name }); return 1;
        }
        if (ext === 'abc' || ext === 'txt') {
            const tunes = splitABCTunes(await file.text(), fallbackTitle);
            if (!tunes.length) throw new Error(`${file.name}: no ABC tune with a K: header was found.`);
            tunes.reverse().forEach(tune => archiveData.unshift({ id: newId(), title: tune.title, abcData: tune.abcData, timestamp: Date.now(), kind: 'notation', sourceFormat: 'ABC', originalName: file.name })); return tunes.length;
        }
        if (ext === 'json') {
            const parsed = JSON.parse(await file.text()), tracks = Array.isArray(parsed) ? parsed : parsed.tracks;
            if (!Array.isArray(tracks)) throw new Error(`${file.name}: not a Rusty Needle library backup.`);
            let count = 0;
            tracks.slice().reverse().forEach(track => {
                if (!track || typeof track.title !== 'string') return;
                if (track.kind === 'audio' && !track.abcData) return;
                archiveData.unshift({ ...track, id: newId(), timestamp: Date.now(), kind: track.kind || 'notation', sourceFormat: track.sourceFormat || 'JSON' }); count++;
            });
            return count;
        }
        throw new Error(`${file.name}: unsupported format.`);
    }

    async function handleFiles(files) {
        const list = [...files]; if (!list.length) return;
        setStatus(`Importing ${list.length} file${list.length === 1 ? '' : 's'}…`);
        let imported = 0; const errors = [];
        for (const file of list) { try { imported += await importFile(file); } catch (err) { console.error(err); errors.push(err.message || `${file.name}: import failed`); } }
        archiveData.sort((a,b) => (b.timestamp || 0) - (a.timestamp || 0)); persistArchive(); renderArchiveUI();
        setStatus(errors.length ? `${imported} imported • ${errors.length} failed` : `${imported} record${imported === 1 ? '' : 's'} imported`, errors.length ? 'red' : 'green');
        if (errors.length) alert(errors.join('\n'));
    }

    async function exportSelected() {
        const song = archiveData.find(s => s.id === selectedCompositionId);
        if (!song) return alert('Select a record first.');
        const base = sanitizeFileName(song.title);
        if (isAudioSong(song)) {
            const blob = await audioDbGet(song.id);
            if (!blob) return alert('The original audio file is no longer available on this device.');
            downloadBlob(blob, song.originalName || `${base}.${String(song.sourceFormat || 'audio').toLowerCase()}`);
        } else downloadBlob(new Blob([song.abcData || ''], { type: 'text/plain;charset=utf-8' }), `${base}.abc`);
    }

    function exportLibrary() {
        const tracks = archiveData.filter(song => !isAudioSong(song)).map(song => ({ ...song })), omitted = archiveData.filter(isAudioSong).length;
        const payload = { format: 'rusty-needle-library', version: 2, exportedAt: new Date().toISOString(), note: omitted ? `${omitted} local audio file(s) omitted; binary media stays in this browser.` : 'Complete notation library backup.', tracks };
        downloadBlob(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }), `rusty-needle-library-${new Date().toISOString().slice(0,10)}.json`);
        setStatus(omitted ? `Backup exported • ${omitted} audio file${omitted === 1 ? '' : 's'} kept local` : 'Library backup exported', 'green');
    }

    function wireUi() {
        loadSettings();
        ui.search?.addEventListener('input', applyLibraryFilter);
        ui.favFilter?.addEventListener('click', () => { favoritesOnly = !favoritesOnly; ui.favFilter.classList.toggle('active', favoritesOnly); saveSettings(); applyLibraryFilter(); });
        ui.random?.addEventListener('click', () => { const pool = archiveData.filter(song => !favoritesOnly || song.favorite); if (pool.length) selectSong(pool[Math.floor(Math.random() * pool.length)]); });
        ui.seekBack?.addEventListener('click', () => seekRelative(-10)); ui.seekForward?.addEventListener('click', () => seekRelative(10));
        ui.tempo?.addEventListener('input', e => { tempoPercent = Number(e.target.value); if (ui.tempoValue) ui.tempoValue.textContent = `${tempoPercent}%`; if (currentAudioElement) currentAudioElement.playbackRate = tempoPercent / 100; saveSettings(); });
        ui.volume?.addEventListener('input', e => { volumePercent = Number(e.target.value); if (ui.volumeValue) ui.volumeValue.textContent = `${volumePercent}%`; applyMasterVolume(); saveSettings(); });
        ui.autoDJ?.addEventListener('click', () => autoDJEnabled ? stopAutoDJ() : startAutoDJ()); ui.shuffle?.addEventListener('click', shuffleAutoDJ); ui.clearQueue?.addEventListener('click', clearQueue); ui.favQueue?.addEventListener('click', queueFavorites);
        ui.importButton?.addEventListener('click', () => ui.importInput?.click());
        ui.importInput?.addEventListener('change', e => { handleFiles(e.target.files); e.target.value = ''; });
        ui.exportLibrary?.addEventListener('click', exportLibrary); ui.exportSelected?.addEventListener('click', exportSelected);
        document.addEventListener('change', e => { if (e.target.matches('.song-selector, #rapid-queue-container input[type="checkbox"]')) setTimeout(updateCounts, 0); });
        const dropZone = document.querySelector('.ingest-slot');
        ['dragenter','dragover'].forEach(type => dropZone?.addEventListener(type, e => { e.preventDefault(); dropZone.classList.add('drag-active'); }));
        ['dragleave','drop'].forEach(type => dropZone?.addEventListener(type, e => { e.preventDefault(); dropZone.classList.remove('drag-active'); }));
        dropZone?.addEventListener('drop', e => handleFiles(e.dataTransfer.files));
        document.addEventListener('keydown', e => {
            if (e.target.matches('input, textarea, select')) return;
            if (e.code === 'Space') {
                e.preventDefault();
                if (isPlaying) stopPlayback();
                else if (selectedCompositionId) { const song = archiveData.find(s => s.id === selectedCompositionId); if (song) executePlayback([song], 'SOLO', btnPlaySolo); }
            } else if (e.key === 'ArrowLeft') seekRelative(-10); else if (e.key === 'ArrowRight') seekRelative(10);
        });
        btnStop.addEventListener('click', () => { stopAudioCore(); if (autoDJEnabled) stopAutoDJ(); updateNowPlaying(null); });
        decorateCards(); updateNowPlaying(null);
    }

    document.addEventListener('DOMContentLoaded', wireUi, { once: true });
})();
