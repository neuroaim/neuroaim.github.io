// ==================== AUDIO SYSTEM ====================
// Procedural sound effects using Web Audio API

const Audio = {
    ctx: null,
    initialized: false,
    
    init() {
        if (this.initialized) return;
        try {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            this.initialized = true;
            console.log('[Audio] Initialized');
        } catch (e) {
            console.warn('[Audio] Web Audio not supported:', e);
        }
    },
    
    play(type) {
        const settings = Storage.getSettings();
        if (!settings.soundEnabled || !this.ctx) return;
        
        try {
            const vol = settings.volume || 0.5;
            
            switch (type) {
                case 'hit':
                    this.playTone(880, 0.08, vol * 0.4, 'sine');
                    this.playTone(1320, 0.06, vol * 0.3, 'sine', 0.02);
                    break;
                case 'miss':
                    this.playTone(220, 0.15, vol * 0.3, 'sawtooth');
                    break;
                case 'click':
                    this.playTone(660, 0.03, vol * 0.2, 'square');
                    break;
                case 'lock':
                    this.playTone(440, 0.1, vol * 0.3, 'sine');
                    this.playTone(660, 0.1, vol * 0.3, 'sine', 0.05);
                    break;
                case 'precision':
                    this.playTone(1046, 0.05, vol * 0.4, 'sine');
                    this.playTone(1318, 0.05, vol * 0.3, 'sine', 0.03);
                    this.playTone(1568, 0.08, vol * 0.3, 'sine', 0.06);
                    break;
                case 'error':
                    this.playTone(200, 0.1, vol * 0.4, 'sawtooth');
                    this.playTone(150, 0.15, vol * 0.3, 'sawtooth', 0.05);
                    break;
                case 'penalty':
                    this.playNoise(0.1, vol * 0.2);
                    this.playTone(110, 0.15, vol * 0.4, 'square');
                    break;
                case 'combo':
                    const baseFreq = 523;
                    this.playTone(baseFreq, 0.05, vol * 0.3, 'sine');
                    this.playTone(baseFreq * 1.25, 0.05, vol * 0.25, 'sine', 0.04);
                    this.playTone(baseFreq * 1.5, 0.08, vol * 0.3, 'sine', 0.08);
                    break;
            }
        } catch (e) {
            // Silently fail
        }
    },
    
    playTone(freq, duration, volume, type, delay = 0) {
        if (!this.ctx) return;
        
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.type = type;
        osc.frequency.value = freq;
        
        gain.gain.setValueAtTime(0, this.ctx.currentTime + delay);
        gain.gain.linearRampToValueAtTime(volume, this.ctx.currentTime + delay + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + delay + duration);
        
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        
        osc.start(this.ctx.currentTime + delay);
        osc.stop(this.ctx.currentTime + delay + duration + 0.01);
    },
    
    playNoise(duration, volume) {
        if (!this.ctx) return;
        
        const bufferSize = this.ctx.sampleRate * duration;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        
        const source = this.ctx.createBufferSource();
        const gain = this.ctx.createGain();
        
        source.buffer = buffer;
        gain.gain.setValueAtTime(volume, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
        
        source.connect(gain);
        gain.connect(this.ctx.destination);
        
        source.start();
        source.stop(this.ctx.currentTime + duration);
    }
};

// ===== COMBO SYSTEM =====
const Combo = {
    count: 0,
    max: 0,
    
    reset() {
        this.count = 0;
    },
    
    increment() {
        this.count++;
        if (this.count > this.max) this.max = this.count;
        
        // Play combo sound at milestones
        if (this.count > 0 && this.count % 5 === 0) {
            Audio.play('combo');
        }
    },
    
    get() {
        return this.count;
    },
    
    getMax() {
        return this.max;
    }
};

// Global helper function for backward compatibility
function playSound(type) {
    Audio.play(type);
}

function resetCombo() {
    Combo.reset();
}

// Auto-init on first user interaction
document.addEventListener('click', () => {
    const settings = Storage.getSettings();
    if (!Audio.initialized && settings.soundEnabled) {
        Audio.init();
    }
}, { once: true });

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Audio, Combo };
}
