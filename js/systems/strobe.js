// ==================== STROBE SYSTEM ====================
// Visual strobe/flicker effect for enhanced training

const StrobeSystem = {
    // State
    enabled: false,
    timer: 0,
    currentPeriod: 0,
    isBlindPhase: false,
    
    // Configuration
    config: {
        freqMin: 4,        // Minimum frequency (Hz)
        freqMax: 8,        // Maximum frequency (Hz)
        dutyCycle: 0.6,    // Visible portion of cycle (0-1)
        blindAlpha: 0.92   // Opacity during blind phase
    },
    
    /**
     * Initialize strobe system
     * @param {Object} config - Optional config override
     */
    init(config = null) {
        if (config) {
            this.config = { ...this.config, ...config };
        } else if (typeof CFG !== 'undefined' && CFG.strobe) {
            this.config = { ...this.config, ...CFG.strobe };
        }
        
        this.reset();
    },
    
    /**
     * Reset strobe state
     */
    reset() {
        this.timer = 0;
        this.currentPeriod = this.getRandomPeriod();
        this.isBlindPhase = false;
    },
    
    /**
     * Enable or disable strobe
     * @param {boolean} enabled - Enable state
     */
    setEnabled(enabled) {
        this.enabled = enabled;
        if (!enabled) {
            this.isBlindPhase = false;
        }
    },
    
    /**
     * Check if strobe is enabled for a mode
     * @param {number} modeId - Mode ID
     * @returns {boolean} Whether strobe is enabled
     */
    isEnabledForMode(modeId) {
        return Storage.isStrobeEnabled(modeId);
    },
    
    /**
     * Toggle strobe for a mode
     * @param {number} modeId - Mode ID
     * @param {boolean} enabled - Enable state
     */
    toggleForMode(modeId, enabled) {
        Storage.setStrobeEnabled(modeId, enabled);
    },
    
    /**
     * Get random strobe period based on frequency range
     * @returns {number} Period in milliseconds
     */
    getRandomPeriod() {
        const freq = this.config.freqMin + 
            Math.random() * (this.config.freqMax - this.config.freqMin);
        return 1000 / freq;
    },
    
    /**
     * Update strobe state
     * @param {number} dt - Delta time in milliseconds
     */
    update(dt) {
        if (!this.enabled) {
            this.isBlindPhase = false;
            return;
        }
        
        this.timer += dt;
        
        // Check for period completion
        if (this.timer >= this.currentPeriod) {
            this.timer = 0;
            this.currentPeriod = this.getRandomPeriod();
        }
        
        // Calculate current phase
        const visibleTime = this.currentPeriod * this.config.dutyCycle;
        this.isBlindPhase = this.timer > visibleTime;
    },
    
    /**
     * Draw strobe overlay if in blind phase
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {number} width - Canvas width
     * @param {number} height - Canvas height
     */
    draw(ctx, width, height) {
        if (!this.enabled || !this.isBlindPhase) return;
        
        ctx.fillStyle = `rgba(0, 0, 0, 1.0)`;
        ctx.fillRect(0, 0, width, height);
    },
    
    /**
     * Check if currently in blind phase
     * @returns {boolean} Whether in blind phase
     */
    isBlind() {
        return this.enabled && this.isBlindPhase;
    },
    
    /**
     * Get strobe info for display
     * @returns {Object} Strobe status info
     */
    getInfo() {
        return {
            enabled: this.enabled,
            isBlind: this.isBlindPhase,
            frequency: 1000 / this.currentPeriod,
            dutyCycle: this.config.dutyCycle
        };
    }
};

// ===== INTEGRATION WITH NOISE SYSTEM =====

/**
 * Connect strobe to noise system
 * Call this after both systems are initialized
 */
function connectStrobeToNoise() {
    if (typeof NoiseSystem !== 'undefined') {
        // Sync strobe state
        const originalSetEnabled = StrobeSystem.setEnabled.bind(StrobeSystem);
        StrobeSystem.setEnabled = function(enabled) {
            originalSetEnabled(enabled);
            NoiseSystem.setStrobeEnabled(enabled);
        };
    }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = StrobeSystem;
}
