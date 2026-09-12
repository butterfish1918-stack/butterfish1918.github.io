        function renderArchiveUI() {
            const previouslyQueued = Array.from(document.querySelectorAll('.song-selector:checked')).map(cb => cb.dataset.id);
            songListEl.innerHTML = '';
            
            const TOTAL_SLOTS = Math.max(24, Math.ceil(archiveData.length / 6) * 6);

            archiveDropdown.innerHTML = '<option value="">-- SELECT STORED RECORD --</option>';
            rapidQueueContainer.innerHTML = ''; 

            archiveData.forEach(song => {
                const opt = document.createElement('option');
                opt.value = song.id;
                opt.innerText = song.title;
                if (song.id === selectedCompositionId) opt.selected = true;
                archiveDropdown.appendChild(opt);

                const isQueued = previouslyQueued.includes(song.id);
                const qDiv = document.createElement('label');
                qDiv.className = 'rapid-queue-item';
                qDiv.innerHTML = `
                    <input type="checkbox" value="${song.id}" onchange="toggleRapidQueue('${song.id}', this)" ${isQueued ? 'checked' : ''}>
                    <span>${escapeHTML(song.title)}</span>
                `;
                rapidQueueContainer.appendChild(qDiv);
            });

            for (let i = 0; i < TOTAL_SLOTS; i++) {
                const li = document.createElement('li');
                
                const alphaMap = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
                const row = alphaMap[Math.floor(i / 6) % 26];
                const col = (i % 6) + 1;
                const slotCode = `${row}${col}`;

                const song = archiveData[i];

                if (song) {
                    const isSelected = (song.id === selectedCompositionId);
                    const isQueued = previouslyQueued.includes(song.id);
                    
                    li.className = `song-card ${isSelected ? 'selected' : ''}`;
                    
                    li.innerHTML = `
                        <div class="card-checkbox-zone ${isQueued ? 'active-queue' : ''}">
                            <span>QUEUE</span>
                            <input type="checkbox" class="song-selector" data-id="${song.id}" ${isQueued ? 'checked' : ''}>
                        </div>
                        <div class="card-content">
                            <div class="song-title" title="${escapeHTML(song.title)}">${escapeHTML(song.title)}</div>
                            <div class="card-id">SLOT ${slotCode}</div>
                        </div>
                        <button class="btn-delete" onclick="deleteComposition(event, '${song.id}')">DEL</button>
                    `;

                    const checkboxZone = li.querySelector('.card-checkbox-zone');
                    const checkbox = li.querySelector('.song-selector');

                    checkboxZone.onclick = async (e) => {
                        e.stopPropagation();
                        if (e.target !== checkbox) checkbox.checked = !checkbox.checked;
                        
                        const qCheckbox = rapidQueueContainer.querySelector(`input[value="${song.id}"]`);
                        
                        if (checkbox.checked) {
                            const currentlyQueuedCount = document.querySelectorAll('.song-selector:checked').length;
                            if (currentlyQueuedCount > 10) {
                                alert("Maximum polyphonic density reached. Limited to 10 tracks.");
                                checkbox.checked = false;
                                return;
                            }

                            checkboxZone.classList.add('active-queue');
                            if (qCheckbox) qCheckbox.checked = true;
                            if (isPlaying && currentMode === 'MASHUP') await injectLiveSynth(song);
                        } else {
                            checkboxZone.classList.remove('active-queue');
                            if (qCheckbox) qCheckbox.checked = false;
                            if (isPlaying && currentMode === 'MASHUP') removeLiveSynth(song.id);
                        }
                    };

                    li.onclick = (e) => {
                        if(!e.target.closest('.card-checkbox-zone') && !e.target.classList.contains('btn-delete')) {
                            selectedCompositionId = song.id;
                            selectionStatus.innerText = `LOCKED: SLOT ${slotCode}`;
                            selectionStatus.style.color = 'var(--neon-green)';
                            
                            titleInput.value = song.title;
                            abcInput.value = song.abcData;
                            
                            renderArchiveUI(); 
                        }
                    };

                } else {
                    li.className = 'song-card empty';
                    li.innerHTML = `
                        <div class="card-content">
                            <div class="song-title" style="color: #666;">-- EMPTY --</div>
                            <div class="card-id">SLOT ${slotCode}</div>
                        </div>
                    `;
                }
                
                songListEl.appendChild(li);
            }
        }

        function escapeHTML(str) {
            return str.replace(/[&<>'"]/g, tag => ({
                '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
            }[tag] || tag));
        }

        function getQueuedCompositions() {
            const checkboxes = document.querySelectorAll('.song-selector:checked');
            const selectedIds = Array.from(checkboxes).map(cb => cb.dataset.id);
            return archiveData.filter(song => selectedIds.includes(song.id));
        }

