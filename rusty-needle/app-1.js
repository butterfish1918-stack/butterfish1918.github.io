const abcjs = window.ABCJS;
        const STORAGE_KEY = 'rusty-needle-archive-v1';

        let archiveData = [];
        let selectedCompositionId = null;

        // Musicality Master State
        let musicalityActive = false;

        const statusOverlay = document.getElementById('status-overlay');
        const statusText = document.getElementById('status-text');
        const songListEl = document.getElementById('song-list');
        const btnSave = document.getElementById('btn-save');
        const abcInput = document.getElementById('abc-input');
        const titleInput = document.getElementById('abc-title');
        const selectionStatus = document.getElementById('selection-status');
        const archiveDropdown = document.getElementById('archive-dropdown');
        const rapidQueueContainer = document.getElementById('rapid-queue-container');

        // Loop Subsystem State
        const btnLoop = document.getElementById('btn-loop');
        let isLooping = true;
        let lastPlayedSongs = [];
        let lastPlayedMode = 'SOLO';
        let lastPlayedTriggerBtn = null;

        btnLoop.addEventListener('click', () => {
            isLooping = !isLooping;
            if (isLooping) {
                btnLoop.innerText = "LOOP: ON";
                btnLoop.style.borderColor = "#4CAF50";
                btnLoop.style.color = "#4CAF50";
            } else {
                btnLoop.innerText = "LOOP: OFF";
                btnLoop.style.borderColor = "#888";
                btnLoop.style.color = "#888";
            }
        });

        // Service Hatch Subsystem
        const hatch = document.getElementById('service-hatch');
        const btnToggleHatch = document.getElementById('btn-toggle-hatch');
        const btnCloseHatch = document.getElementById('btn-close-hatch');
        btnToggleHatch.addEventListener('click', () => hatch.classList.toggle('open'));
        btnCloseHatch.addEventListener('click', () => hatch.classList.remove('open'));

        // Musicality Tuning Box
        const musicalityHatch = document.getElementById('musicality-hatch');
        const btnMusicality = document.getElementById('btn-musicality');
        const btnMusicalitySettings = document.getElementById('btn-musicality-settings');
        const btnCloseMusicality = document.getElementById('btn-close-musicality');

        function toggleMusicality() {
            musicalityActive = !musicalityActive;
            btnMusicality.classList.toggle('active', musicalityActive);
            btnMusicality.innerText = musicalityActive ? "MUSICALITY: ON" : "MUSICALITY: OFF";
        }
        btnMusicality.addEventListener('click', toggleMusicality);
        btnMusicality.addEventListener('dblclick', (e) => {
            e.preventDefault();
            musicalityHatch.classList.add('open');
        });
        if (btnMusicalitySettings) btnMusicalitySettings.addEventListener('click', () => musicalityHatch.classList.add('open'));
        btnCloseMusicality.addEventListener('click', () => musicalityHatch.classList.remove('open'));

        document.querySelectorAll('.hatch-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                document.querySelectorAll('.hatch-tab').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('#service-hatch .hatch-body').forEach(b => b.classList.remove('active'));
                e.currentTarget.classList.add('active');
                document.getElementById(e.currentTarget.dataset.target).classList.add('active');
            });
        });

        function newId() {
            if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
            return 'song_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 9);
        }

        function persistArchive() {
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(archiveData));
                return true;
            } catch (err) {
                console.error('Archive persistence failure:', err);
                statusText.innerText = 'STORAGE FULL / BLOCKED';
                statusOverlay.style.display = 'flex';
                setTimeout(() => statusOverlay.style.display = 'none', 1400);
                return false;
            }
        }

        function syncArchive() {
            try {
                const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
                archiveData = Array.isArray(saved) ? saved : [];
            } catch (err) {
                console.error('Archive read failure:', err);
                archiveData = [];
            }
            archiveData.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
            if (selectedCompositionId && !archiveData.find(s => s.id === selectedCompositionId)) selectedCompositionId = null;
            renderArchiveUI();
            statusOverlay.style.display = 'none';
        }

        async function addCompositionToArchive(title, abcString) {
            archiveData.unshift({ id: newId(), title, abcData: abcString, timestamp: Date.now() });
            persistArchive();
            renderArchiveUI();
        }

        window.deleteComposition = async function(e, id) {
            e.stopPropagation();
            archiveData = archiveData.filter(song => song.id !== id);
            if (selectedCompositionId === id) selectedCompositionId = null;
            persistArchive();
            renderArchiveUI();
        };

        // GitHub Pages / Android boot path: wait until all split scripts are loaded.
        window.addEventListener('DOMContentLoaded', syncArchive, { once: true });

        abcInput.addEventListener('input', () => {
            if(titleInput.value.trim() === '') {
                const titleMatch = abcInput.value.match(/^T:(.+)$/m);
                if(titleMatch) {
                    titleInput.value = titleMatch[1].trim();
                }
            }
        });

        btnSave.addEventListener('click', async () => {
            const explicitTitle = titleInput.value.trim();
            const rawText = abcInput.value.trim();
            
            if(!explicitTitle) {
                titleInput.style.background = '#400';
                titleInput.placeholder = "ERROR: NAME REQUIRED";
                setTimeout(() => {
                    titleInput.style.background = '#111';
                    titleInput.placeholder = "ENTER RECORD NAME...";
                }, 1000);
                return;
            }

            if(!rawText) return;
            
            btnSave.innerText = "STORING...";
            await addCompositionToArchive(explicitTitle, rawText);
            
            abcInput.value = '';
            titleInput.value = '';
            selectedCompositionId = null;
            archiveDropdown.value = '';
            selectionStatus.innerText = `AWAITING SELECTION...`;
            selectionStatus.style.color = 'var(--neon-amber)';
            
            btnSave.innerText = "ARCHIVE TO EMPTY SLOT";
            renderArchiveUI(); 
        });

        archiveDropdown.addEventListener('change', (e) => {
            selectedCompositionId = e.target.value || null;
            if (selectedCompositionId) {
                const song = archiveData.find(s => s.id === selectedCompositionId);
                const index = archiveData.indexOf(song);
                const alphaMap = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
                const row = alphaMap[Math.floor(index / 6) % 26];
                const col = (index % 6) + 1;
                
                selectionStatus.innerText = `LOCKED: SLOT ${row}${col}`;
                selectionStatus.style.color = 'var(--neon-green)';
                
                titleInput.value = song.title;
                abcInput.value = song.abcData;
            } else {
                selectionStatus.innerText = `AWAITING SELECTION...`;
                selectionStatus.style.color = 'var(--neon-amber)';
                titleInput.value = '';
                abcInput.value = '';
            }
            renderArchiveUI(); 
        });

        window.toggleRapidQueue = function(songId, checkboxElement) {
            const currentlyQueuedCount = document.querySelectorAll('.song-selector:checked').length;
            
            if (checkboxElement.checked && currentlyQueuedCount >= 10) {
                alert("Maximum polyphonic density reached. Limited to 10 simultaneous tracks.");
                checkboxElement.checked = false;
                return;
            }

            const mainGridCheckbox = document.querySelector(`.song-selector[data-id="${songId}"]`);
            if (mainGridCheckbox) {
                mainGridCheckbox.checked = checkboxElement.checked;
                
                const zone = mainGridCheckbox.closest('.card-checkbox-zone');
                if (checkboxElement.checked) {
                    zone.classList.add('active-queue');
                    if (isPlaying && currentMode === 'MASHUP') {
                        const song = archiveData.find(s => s.id === songId);
                        if (song) injectLiveSynth(song);
                    }
                } else {
                    zone.classList.remove('active-queue');
                    if (isPlaying && currentMode === 'MASHUP') removeLiveSynth(songId);
                }
            }
        };

