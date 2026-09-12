// --- RANDOMNESS DISTRIBUTION ENGINE ---
        function resetRandomnessState() {
            const seed=(Date.now() ^ Math.floor((performance.now?performance.now():0)*1000) ^ Math.floor(Math.random()*0xffffffff))>>>0;
            randomnessState={x:.5,last:.5,step:0,seed:seed||0x6d2b79f5,mt:null,mtIndex:624,markov:1};
        }
        function cryptoUnit(){ try{const a=new Uint32Array(1); crypto.getRandomValues(a); return a[0]/4294967296;}catch{return Math.random();} }
        function xorshiftUnit(){ let x=randomnessState.seed>>>0; x^=x<<13; x^=x>>>17; x^=x<<5; randomnessState.seed=x>>>0; return (randomnessState.seed>>>0)/4294967296; }
        function lxmUnit(){ const l=(Math.imul(1664525,randomnessState.seed>>>0)+1013904223)>>>0; randomnessState.seed=l; let x=l^(l>>>15); x=Math.imul(x,0x2c1b3c6d); x^=x>>>12; return (x>>>0)/4294967296; }
        function mtSeed(seed){ const mt=new Uint32Array(624); mt[0]=seed>>>0; for(let i=1;i<624;i++) mt[i]=(Math.imul(1812433253,mt[i-1]^(mt[i-1]>>>30))+i)>>>0; randomnessState.mt=mt; randomnessState.mtIndex=624; }
        function mtUnit(){ if(!randomnessState.mt) mtSeed(randomnessState.seed); const mt=randomnessState.mt; if(randomnessState.mtIndex>=624){ for(let i=0;i<624;i++){ const y=(mt[i]&0x80000000)|(mt[(i+1)%624]&0x7fffffff); mt[i]=mt[(i+397)%624]^(y>>>1)^((y&1)?0x9908b0df:0); } randomnessState.mtIndex=0; } let y=mt[randomnessState.mtIndex++]; y^=y>>>11; y^=(y<<7)&0x9d2c5680; y^=(y<<15)&0xefc60000; y^=y>>>18; return (y>>>0)/4294967296; }
        function gaussianUnit(u1=Math.random(),u2=Math.random()){ u1=Math.max(1e-12,u1); const z=Math.sqrt(-2*Math.log(u1))*Math.cos(2*Math.PI*u2); return Math.max(0,Math.min(1,.5+z*.15)); }
        function poissonUnit(lambda=4){ let L=Math.exp(-lambda),k=0,p=1; do{k++;p*=Math.random();}while(p>L&&k<32); return Math.min(1,(k-1)/(lambda*3)); }
        function distRandom() {
            const u1=Math.random(),u2=Math.random(); randomnessState.step++;
            switch(currentRandomness) {
                case 'uniform': return u1;
                case 'quantum': return cryptoUnit();
                case 'thermal': return gaussianUnit(cryptoUnit(),cryptoUnit());
                case 'atmospheric': return (u1*.65 + ((Math.sin((Date.now()+hardwareEntropy)*.00037)+1)/2)*.35)%1;
                case 'brownian': randomnessState.x=Math.max(0,Math.min(1,randomnessState.x+(u1-.5)*.12)); return randomnessState.x;
                case 'shot': return poissonUnit(3);
                case 'jitter': return Math.max(0,Math.min(1,.5+(u1-u2)*.25));
                case 'pseudorandom': return xorshiftUnit();
                case 'csprng': return cryptoUnit();
                case 'kolmogorov': return (cryptoUnit()+xorshiftUnit()+lxmUnit())%1;
                case 'lxm': return lxmUnit();
                case 'mersenne': return mtUnit();
                case 'chaotic': { const r=3.99; randomnessState.x=r*Math.max(.0001,Math.min(.9999,randomnessState.last)); randomnessState.x*=1-randomnessState.last; randomnessState.last=randomnessState.x; return Math.max(0,Math.min(1,randomnessState.x)); }
                case 'gaussian': return gaussianUnit(u1,u2);
                case 'poisson': return poissonUnit(4);
                case 'exponential': return Math.min(1,-Math.log(Math.max(1e-12,1-u1))/5);
                case 'pareto': { const alpha=3,p=1/Math.pow(Math.max(1e-12,1-u1),1/alpha); return Math.min(1,(p-1)/10); }
                case 'levy': { const z=Math.tan(Math.PI*(u1-.5)); return Math.max(0,Math.min(1,.5+z*.08)); }
                case 'lognormal': { const g=Math.sqrt(-2*Math.log(Math.max(1e-12,u1)))*Math.cos(2*Math.PI*u2); return Math.min(1,Math.exp(g*.45-1.0)); }
                case 'randomwalk': randomnessState.x=(randomnessState.x+(u1-.5)*.06+1)%1; return randomnessState.x;
                case 'martingale': randomnessState.x=Math.max(0,Math.min(1,randomnessState.x+(u1<.5?-.04:.04))); return randomnessState.x;
                case 'markovian': { const trans=[[.72,.24,.04],[.16,.68,.16],[.04,.24,.72]],row=trans[randomnessState.markov||1]; let q=u1,st=0; while(st<2 && q>row[st]){q-=row[st];st++;} randomnessState.markov=st; return [u2*.33,.33+u2*.34,.67+u2*.33][st]; }
                case 'bernoulli': return u1>.5?1:0;
                case 'epistemic': { const confidence=.35+.45*((Math.sin(randomnessState.step*.13)+1)/2); randomnessState.x=confidence*randomnessState.x+(1-confidence)*u1; return randomnessState.x; }
                case 'hardware': return (cryptoUnit()+(hardwareEntropy/1000)+(performance.now()%997)/997)%1;
                default: return u1;
            }
        }

        function getTunedFreq(v) {
            const cleanRoot = currentRoot.match(/\(([^)]+)\)/)?.[1] || currentRoot.split(' ')[0];
            const rf = roots[cleanRoot] || 261.63;
            
            // --- UPDATED DIVISOR LOGIC ---
            let divisor = 12;
            if (tuningSystem === 'arab' || tuningSystem === 'persian') divisor = 24;
            else if (tuningSystem === 'ottoman') divisor = 53;
            else if (tuningSystem === 'byzantine') divisor = 72;
            // Western, Hindustani, Carnatic, Gamelan default to 12 in this simplified engine

            if (tuningSystem === 'western') { 
                const m = v.match(/([A-G]#?)(\d)/); 
                if(!m) return rf; 
                const note = m[1], oct = parseInt(m[2]); 
                const base = noteNames.indexOf(note); 
                const off = temperaments[currentTemperament][base] || 0; 
                let f = roots[note] * Math.pow(2, off / 1200); 
                return (oct === 3) ? f / 2 : (oct === 2) ? f / 4 : f; 
            } else if (['hindustani','carnatic','gamelan'].includes(tuningSystem)) {
                const m=v.match(/([A-G]#?)(\d)/); if(m){const idx=noteNames.indexOf(m[1]),oct=parseInt(m[2]); return rf*Math.pow(2,idx/12)*Math.pow(2,oct-4);} return rf;
            } else { 
                // Handle Quantum Step (Qx)
                let step = 0;
                if (v.startsWith("Q")) step = parseInt(v.replace('Q', ''));
                else step = parseInt(v.replace('C', '').replace(' (TR)', '')) || 0;
                
                return rf * Math.pow(2, step / divisor); 
            }
        }
