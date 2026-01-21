// ==================== HUD SYSTEM ====================
// In-game heads-up display rendering

const HUD = {
    // Element references
    elements: {
        time: null,
        accuracy: null,
        difficulty: null,
        trials: null,
        combo: null,
        mode: null
    },
    
    /**
     * Initialize HUD system
     */
    init() {
        this.elements = {
            time: document.getElementById('hud-time'),
            accuracy: document.getElementById('hud-accuracy'),
            difficulty: document.getElementById('hud-difficulty'),
            trials: document.getElementById('hud-trials'),
            combo: document.getElementById('hud-combo'),
            mode: document.getElementById('hud-mode')
        };
    },
    
    /**
     * Update all HUD elements
     * @param {Object} data - HUD data
     */
    update(data) {
        const {
            timeLeft = 0,
            hits = 0,
            trials = 0,
            difficulty = 0.3,
            combo = 0,
            modeId = 1,
            strobeEnabled = false
        } = data;
        
        // Time remaining
        if (this.elements.time) {
            this.elements.time.innerText = Math.max(0, Math.ceil(timeLeft));
        }
        
        // Accuracy
        if (this.elements.accuracy) {
            const acc = trials > 0 ? Math.round((hits / trials) * 100) : 100;
            this.elements.accuracy.innerText = acc + '%';
        }
        
        // Difficulty level
        if (this.elements.difficulty) {
            this.elements.difficulty.innerText = 'Lv.' + Math.round(difficulty * 100);
        }
        
        // Trial count
        if (this.elements.trials) {
            this.elements.trials.innerText = trials;
        }
        
        // Combo (if visible)
        if (this.elements.combo && combo > 0) {
            this.elements.combo.innerText = combo + 'x';
            this.elements.combo.style.display = 'block';
        } else if (this.elements.combo) {
            this.elements.combo.style.display = 'none';
        }
        
        // Mode name
        if (this.elements.mode) {
            const name = i18n.modeName(modeId);
            const strobeIndicator = strobeEnabled ? ' ⚡' : '';
            this.elements.mode.innerText = name + strobeIndicator;
        }
    },
    
    /**
     * Show/hide HUD
     * @param {boolean} visible - Visibility state
     */
    setVisible(visible) {
        const container = document.getElementById('hud-container');
        if (container) {
            container.style.display = visible ? 'flex' : 'none';
        }
    },
    
    /**
     * Flash effect for feedback
     * @param {string} type - 'penalty' or 'warn'
     * @param {string} text - Flash text message
     */
    flash(type, text) {
        const flashEl = document.getElementById(type === 'penalty' ? 'flash-penalty' : 'flash-warn');
        const textEl = document.getElementById(type === 'penalty' ? 'flash-text-penalty' : 'flash-text-warn');
        
        if (flashEl) {
            flashEl.style.opacity = type === 'penalty' ? '0.4' : '0.25';
            setTimeout(() => { flashEl.style.opacity = '0'; }, 150);
        }
        
        if (textEl && text) {
            textEl.innerText = text;
            textEl.style.display = 'block';
            textEl.style.opacity = '1';
            textEl.style.top = '40%';
            textEl.style.left = '50%';
            
            setTimeout(() => {
                textEl.style.opacity = '0';
                setTimeout(() => { textEl.style.display = 'none'; }, 200);
            }, 400);
        }
    },
    
    /**
     * Show countdown overlay
     * @param {number} count - Current count
     */
    showCountdown(count) {
        const overlay = document.getElementById('countdown-overlay');
        const text = document.getElementById('countdown-text');
        const prompt = document.getElementById('click-prompt');
        
        if (overlay) overlay.style.display = 'flex';
        if (prompt) prompt.style.display = 'none';
        if (text) {
            text.style.display = 'block';
            text.innerText = count;
            text.style.color = '#00d9ff';
        }
    },
    
    /**
     * Hide countdown overlay
     */
    hideCountdown() {
        const overlay = document.getElementById('countdown-overlay');
        if (overlay) overlay.style.display = 'none';
    },
    
    /**
     * Create HUD HTML structure
     * @returns {string} HUD HTML
     */
    createHTML() {
        return `
            <div id="hud-container" class="hud-container">
                <div class="hud-left">
                    <div class="hud-item">
                        <span class="hud-label" data-i18n="hud.time">TIME</span>
                        <span id="hud-time" class="hud-value">60</span>
                    </div>
                    <div class="hud-item">
                        <span class="hud-label" data-i18n="hud.accuracy">ACC</span>
                        <span id="hud-accuracy" class="hud-value">100%</span>
                    </div>
                </div>
                
                <div class="hud-center">
                    <span id="hud-mode" class="hud-mode"></span>
                    <span id="hud-combo" class="hud-combo" style="display:none"></span>
                </div>
                
                <div class="hud-right">
                    <div class="hud-item">
                        <span class="hud-label" data-i18n="hud.level">LEVEL</span>
                        <span id="hud-difficulty" class="hud-value">Lv.30</span>
                    </div>
                    <div class="hud-item">
                        <span class="hud-label" data-i18n="hud.trials">TRIALS</span>
                        <span id="hud-trials" class="hud-value">0</span>
                    </div>
                </div>
            </div>
            
            <!-- Flash overlays -->
            <div id="flash-warn" class="flash-overlay warn"></div>
            <div id="flash-penalty" class="flash-overlay penalty"></div>
            <div id="flash-text-warn" class="flash-text warn"></div>
            <div id="flash-text-penalty" class="flash-text penalty"></div>
            
            <!-- Countdown overlay -->
            <div id="countdown-overlay" class="countdown-overlay" style="display:none">
                <div id="click-prompt" class="click-prompt" data-i18n="hud.clickToStart">Click to start</div>
                <div id="countdown-text" class="countdown-text" style="display:none">3</div>
            </div>
        `;
    }
};

// Global helper for backward compatibility
function flashEffect(type, text) {
    HUD.flash(type, text);
}

function updateHUD() {
    if (typeof GameEngine !== 'undefined') {
        HUD.update({
            timeLeft: GameEngine.timeLeft,
            hits: GameEngine.hits,
            trials: GameEngine.trials,
            difficulty: GameEngine.difficulty,
            combo: Combo.get(),
            modeId: GameEngine.modeId,
            strobeEnabled: GameEngine.strobeEnabled
        });
    }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = HUD;
}
