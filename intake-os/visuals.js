// --- VISUAL ENGINE ---
const Visuals = {
    canvas: document.getElementById('fluidCanvas'),
    ctx: document.getElementById('fluidCanvas').getContext('2d'),
    particles: [],
    width: window.innerWidth,
    height: window.innerHeight,

    init: function() {
        this.resize();
        window.addEventListener('resize', () => this.resize(), { passive: true });
        window.addEventListener('orientationchange', () => setTimeout(() => this.resize(), 120), { passive: true });
        const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
        const lowPower = (navigator.deviceMemory && navigator.deviceMemory <= 4) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4);
        const particleCount = lowPower ? 80 : (coarse ? 120 : 180);
        this.particles = Array.from({length: particleCount}, () => new Particle({ width: this.width, height: this.height }));
    },

    resize: function() {
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        this.canvas.width = Math.round(this.width * dpr);
        this.canvas.height = Math.round(this.height * dpr);
        this.canvas.style.width = `${this.width}px`;
        this.canvas.style.height = `${this.height}px`;
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    },

    render: function(phase, progress, mode) {
        const w = this.width;
        const h = this.height;
        const ctx = this.ctx;
        const center = { x: w/2, y: h/2 };

        if (mode === 'GHOST_TRAIL') {
            ctx.fillStyle = 'rgba(0,0,0,0.1)';
            ctx.fillRect(0,0,w,h);
        } else if (mode === 'STROBE') {
            const beat = (Math.sin((Date.now() / 428) * Math.PI * 2) + 1) / 2;
            ctx.fillStyle = `rgba(255, 215, 0, ${0.08 + beat * 0.32})`;
            ctx.fillRect(0,0,w,h);
            return;
        } else if (mode === 'NULL') {
            ctx.clearRect(0,0,w,h);
            ctx.fillStyle = `rgba(255,255,255, ${0.05 + Math.sin(Date.now()*0.005)*0.02})`;
            ctx.fillRect(center.x, center.y, 2, 2);
            return;
        } else if (mode === 'DATA_ONLY') {
            ctx.clearRect(0,0,w,h);
            ctx.fillStyle = '#fff';
            ctx.font = '20px Courier New';
            ctx.fillText('DATA STREAM ACTIVE', center.x - 80, center.y);
            return;
        } else {
            ctx.clearRect(0,0,w,h);
        }

        const container = document.getElementById('canvas-container');
        if(mode === 'SPIKES' && phase === 'IN') container.style.filter = 'contrast(100)';
        else if (mode === 'CRYSTAL' && phase === 'HOLD_IN') container.style.filter = 'none';
        else if (mode === 'GHOST_TRAIL') container.style.filter = 'none';
        else container.style.filter = 'blur(15px) contrast(30)';

        if (mode === 'BOX_ROTATION') {
            ctx.save();
            ctx.translate(center.x, center.y);
            if(phase === 'HOLD_IN' || phase === 'HOLD_OUT') ctx.rotate(Math.PI/2);
            ctx.strokeStyle = STATE.color;
            ctx.lineWidth = 5;
            ctx.strokeRect(-100, -100, 200, 200);
            ctx.restore();
        }

        if (mode === 'MONOLITH' && (phase === 'HOLD_IN' || phase === 'HOLD_OUT')) {
            ctx.fillStyle = '#778899';
            ctx.fillRect(center.x - 100, center.y - 150, 200, 300);
            return;
        }

        if (mode === 'CLAUSTRO') {
            ctx.fillStyle = STATE.color;
            ctx.fillRect(0,0,w,h);
            ctx.globalCompositeOperation = 'destination-in';
            ctx.beginPath();
            let r = 300;
            if (phase === 'HOLD_OUT') r = 300 - (progress * 250);
            ctx.arc(center.x, center.y, r, 0, Math.PI*2);
            ctx.fill();
            ctx.globalCompositeOperation = 'source-over';
            return;
        }

        this.particles.forEach((p, i) => {
            if (mode === 'GLITCH' && Date.now() % 10000 < 500) {
                ctx.globalCompositeOperation = 'screen';
                ctx.fillStyle = '#f00';
                ctx.beginPath(); ctx.arc(p.x+5, p.y, p.r, 0, Math.PI*2); ctx.fill();
                ctx.fillStyle = '#00f';
                ctx.beginPath(); ctx.arc(p.x-5, p.y, p.r, 0, Math.PI*2); ctx.fill();
                ctx.globalCompositeOperation = 'source-over';
                return;
            }

            if (mode === 'SCRUBBER' || mode === 'EMBERS') {
                if (p.y < 0) p.reset(w,h);
            } else if (mode === 'HEAVY_DRIP' && p.y > h) {
                p.reset(w,h);
            }

            p.update(phase, progress, mode, center, i);
            p.draw(ctx, STATE.color, mode);
        });
    }
};

class Particle {
    constructor(canvas) { this.reset(canvas.width, canvas.height); }

    reset(w, h) {
        this.x = w/2 + (Math.random()-0.5)*100;
        this.y = h + 50;
        this.vx = (Math.random()-0.5)*2;
        this.vy = (Math.random()-0.5)*2;
        this.r = 20 + Math.random()*30;
        this.baseX = this.x;
        this.baseY = this.y;
        this.angle = Math.random() * Math.PI * 2;
    }

    update(phase, progress, mode, center, i = 0) {
        if (mode === 'HEAVY_DRIP') {
            if (phase === 'IN') {
                this.x += (center.x - this.x) * 0.05;
                this.y += (center.y - this.y) * 0.02;
            } else {
                this.vy += 0.5;
                this.y += this.vy;
                this.x += (Math.random()-0.5);
            }
            return;
        }

        if (mode === 'CRYSTAL') {
            if (phase === 'HOLD_IN') return;
            if (phase === 'IN') this.y = center.y + Math.sin(Date.now()*0.002 + this.x)*20;
        }

        if (mode === 'GHOST_TRAIL') {
            this.angle += 0.02;
            this.x = center.x + Math.sin(this.angle) * 100;
            this.y = center.y + Math.sin(this.angle * 2) * 50;
            return;
        }

        if (mode === 'STARBURST') {
            if (phase === 'IN') {
                this.x += (this.x - center.x) * 0.1;
                this.y += (this.y - center.y) * 0.1;
            } else this.y += 50;
            if (Math.random() > 0.9) this.reset(center.x*2, center.y*2);
            return;
        }

        if (mode === 'TIDAL') {
            this.y = center.y*2 - 50 + Math.sin(Date.now()*0.002 + this.x*0.01)*20;
            return;
        }

        if (mode === 'SCRUBBER') {
            this.vy = -10 - Math.random()*10;
            this.y += this.vy;
            this.x += (Math.random()-0.5)*5;
            return;
        }

        if (mode === 'SPIKES') {
            if(phase === 'IN') {
                this.x += (this.x - center.x) * 0.2;
                this.y += (this.y - center.y) * 0.2;
            } else {
                this.x += (center.x - this.x) * 0.2;
                this.y += (center.y - this.y) * 0.2;
            }
            return;
        }

        if (mode === 'SHATTER') {
            if (phase === 'IN') {
                this.x += (center.x - this.x) * 0.1;
                this.y += (center.y - this.y) * 0.1;
            } else {
                this.x += this.vx * 10;
                this.y += this.vy * 10;
            }
            return;
        }

        if (mode === 'VORTEX') {
            const speed = phase === 'IN' ? 0.1 : 0.02;
            this.angle += speed;
            let r = 100 + Math.sin(this.angle)*20;
            if(phase==='OUT') r += 100;
            this.x = center.x + Math.cos(this.angle) * r;
            this.y = center.y + Math.sin(this.angle) * r;
            return;
        }

        if (mode === 'MATRIX') {
            this.y += 10;
            if(phase === 'HOLD_IN') this.y -= 10;
            if(this.y > center.y*2) this.y = 0;
            return;
        }

        if (mode === 'ELASTIC') {
            this.y = center.y;
            this.x = (this.x - center.x) * 1.01 + center.x;
            if(this.x > center.x*2 || this.x < 0) this.reset(center.x*2, center.y*2);
            return;
        }

        if (mode === 'ZOOM') {
            this.x += (this.x - center.x) * 0.05;
            this.y += (this.y - center.y) * 0.05;
            this.r *= 1.05;
            if(this.r > 100) this.reset(center.x*2, center.y*2);
            return;
        }

        if (mode === 'PULSE_MASS') {
            this.y = center.y + 100;
            const scale = 1 + Math.sin(Date.now()*0.005)*0.2;
            this.x = center.x + (this.x-center.x)*scale;
            return;
        }

        if (mode === 'EMBERS') {
            this.y -= 2;
            this.x += Math.sin(Date.now()*0.01 + this.y)*2;
            return;
        }

        if (mode === 'LAMINAR' || mode === 'RESONANCE') {
            const amp = phase === 'IN' ? progress * 100 : (1-progress)*100;
            this.x = center.x + Math.sin(Date.now()*0.002 + i)*amp;
            this.y = center.y + Math.cos(Date.now()*0.002 + i)*amp;
            if (mode === 'RESONANCE' && phase === 'OUT') this.x += (Math.random()-0.5)*10;
            return;
        }

        if (mode === 'CHURN') {
            this.angle += 0.01;
            this.x = center.x + Math.cos(this.angle + i) * 100;
            this.y = center.y + Math.sin(this.angle * 0.5 + i) * 100;
            return;
        }

        this.x += this.vx;
        this.y += this.vy;
        if(this.x < 0 || this.x > center.x*2) this.vx *= -1;
        if(this.y < 0 || this.y > center.y*2) this.vy *= -1;
    }

    draw(ctx, color, mode) {
        if (mode === 'FLICKER') ctx.globalAlpha = Math.random();
        if (mode === 'EMBERS') {
            const alpha = Math.max(0, this.y / 800);
            ctx.fillStyle = `rgba(255, 165, 0, ${alpha})`;
        } else ctx.fillStyle = color;

        ctx.beginPath();
        if (mode === 'MATRIX') ctx.fillRect(this.x, this.y, 2, 20);
        else ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
    }
}
