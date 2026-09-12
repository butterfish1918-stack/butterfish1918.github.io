        /* III. Main Controls */
        
        btnPlaySolo.addEventListener('click', () => {
            if(!selectedCompositionId) return alert("You must select a record from the carousel grid first.");
            const song = archiveData.find(s => s.id === selectedCompositionId);
            if(song) executePlayback([song], 'SOLO', btnPlaySolo);
        });

        btnMashup.addEventListener('click', () => {
            const queued = getQueuedCompositions();
            if(queued.length < 2) return alert("Queue at least TWO records using the checkboxes for a mashup.");
            executePlayback(queued, 'MASHUP', btnMashup);
        });

        btnStochastic.addEventListener('click', () => {
            const queued = getQueuedCompositions();
            if(queued.length < 2) return alert("Queue at least TWO records using the checkboxes for blending.");
            
            let header = "";
            let measures = [];

            queued.forEach((song, idx) => {
                const lines = song.abcData.split('\n');
                let inHeader = true;
                
                lines.forEach(line => {
                    const tline = line.trim();
                    if(tline === '') return;
                    
                    if(inHeader && /^[A-Za-z]:/.test(tline)) {
                        if(idx === 0) header += tline + '\n';
                    } else {
                        inHeader = false;
                        if(!tline.startsWith('%')) {
                            const parts = tline.split('|').map(p => p.trim()).filter(p => p !== '' && p !== ']');
                            measures.push(...parts);
                        }
                    }
                });
            });

            if(measures.length === 0) return;

            const bAlgo = parseInt(document.getElementById('b-algo').value);
            const lengthMod = parseInt(document.getElementById('b-p1').value) / 100;
            const phraseLength = Math.max(8, Math.floor(measures.length * lengthMod));
            const pRetro = document.getElementById('b-p2').value / 100;
            const pRest = document.getElementById('b-p3').value / 100;
            const pInv = document.getElementById('b-p4').value / 100;
            const repLimit = parseInt(document.getElementById('b-p5').value);
            const pMod = document.getElementById('b-p6').value / 100;
            const pOct = document.getElementById('b-p7').value / 100;
            const pSplice = document.getElementById('b-p8').value / 100;
            const pPad = document.getElementById('b-p9').value / 100;

            let stochasticScore = header + "\n% STOCHASTIC EXQUISITE CORPSE\n";
            let currentIdx = Math.floor(Math.random() * measures.length);
            let consecRepeats = 0;
            let lastMeasure = "";

            for(let i = 0; i < phraseLength; i++) {
                
                // 9. Markov Distance Clamping
                if (musicalityActive && document.getElementById('mus-9').checked) {
                    currentIdx = (currentIdx + (Math.random() > 0.5 ? 1 : -1) + measures.length) % measures.length;
                } else {
                    if (bAlgo === 0) { 
                        currentIdx = Math.floor(Math.random() * measures.length);
                    } else if (bAlgo === 1) { 
                        currentIdx = Math.random() > 0.4 ? (currentIdx + 1) % measures.length : Math.floor(Math.random() * measures.length);
                    } else if (bAlgo === 2) { 
                        currentIdx = (currentIdx + (Math.random() > 0.1 ? 1 : 2)) % measures.length;
                    } else if (bAlgo === 3) { 
                        currentIdx = (currentIdx + (Math.random() > 0.5 ? 1 : -1) + measures.length) % measures.length;
                    } else { 
                        if (i % measures.length === 0) measures.sort(() => Math.random() - 0.5); 
                        currentIdx = i % measures.length;
                    }
                }

                let rawMeasure = measures[currentIdx];

                if (rawMeasure === lastMeasure) {
                    consecRepeats++;
                    if (consecRepeats >= repLimit) {
                        currentIdx = Math.floor(Math.random() * measures.length);
                        rawMeasure = measures[currentIdx];
                        consecRepeats = 0;
                    }
                } else {
                    consecRepeats = 0;
                }
                lastMeasure = rawMeasure;

                if (Math.random() < pPad) rawMeasure = "z4"; 
                if (Math.random() < pRetro) rawMeasure = rawMeasure.split('').reverse().join('');
                if (Math.random() < pInv) rawMeasure = rawMeasure.replace(/[a-zA-Z]/g, c => c === c.toLowerCase() ? c.toUpperCase() : c.toLowerCase());
                if (Math.random() < pOct) rawMeasure = rawMeasure.replace(/[a-zA-Z]/g, c => Math.random() > 0.5 ? c + "'" : c + ",");
                if (Math.random() < pRest) rawMeasure = rawMeasure.replace(/[a-gA-G]/, 'z');

                if (Math.random() < pSplice && measures.length > 1) { 
                    const spliceTarget = measures[Math.floor(Math.random() * measures.length)];
                    rawMeasure = rawMeasure.substring(0, Math.floor(rawMeasure.length / 2)) + spliceTarget.substring(Math.floor(spliceTarget.length / 2));
                }

                if (Math.random() < pMod) stochasticScore += "[M:3/4] "; 

                stochasticScore += rawMeasure + " | ";
                if((i+1) % 4 === 0) stochasticScore += "\n"; 
            }

            if (musicalityActive && document.getElementById('mus-8').checked) {
                stochasticScore += "\n[ceg]4 |]"; 
            }

            const virtualSong = { id: 'stochastic_matrix', abcData: stochasticScore };
            executePlayback([virtualSong], 'STOCHASTIC', btnStochastic);
        });



        if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('./sw.js').catch(err => console.warn('Service worker registration failed:', err));
            });
        }
