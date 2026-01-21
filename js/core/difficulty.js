// ==================== ADAPTIVE DIFFICULTY SYSTEM ====================
// Dynamic difficulty adjustment based on player performance

const Difficulty = {
    // Current difficulty level (0.1 - 5.0)
    level: 0.3,
    
    // Consecutive success/fail counters for streak-based adjustment
    consecutiveSuccess: 0,
    consecutiveFail: 0,
    
    // Recent trial results for statistics only (not for adjustment)
    recentResults: [],
    
    // Configuration (loaded from CFG.adaptive)
    config: null,
    
    /**
     * Initialize difficulty system
     * @param {Object} config - Optional config override
     */
    init(config = null) {
        this.config = config || CFG.adaptive;
        this.reset();
    },
    
    /**
     * Reset to initial state
     */
    reset() {
        this.recentResults = [];
        this.consecutiveSuccess = 0;
        this.consecutiveFail = 0;
        this.level = this.config.initialLevel;
    },
    
    /**
     * Load saved difficulty for a mode
     * @param {number} modeId - Mode ID
     * @param {boolean} isStrobe - Strobe mode flag
     */
    loadForMode(modeId, isStrobe) {
        this.level = Storage.getDifficultyLevel(modeId, isStrobe);
        this.recentResults = [];
        this.consecutiveSuccess = 0;
        this.consecutiveFail = 0;
    },
    
    /**
     * Save current difficulty for a mode
     * @param {number} modeId - Mode ID
     * @param {boolean} isStrobe - Strobe mode flag
     */
    saveForMode(modeId, isStrobe) {
        Storage.setDifficultyLevel(modeId, isStrobe, this.level);
    },
    
    /**
     * Record a trial result and adjust difficulty
     * Uses streak-based adjustment: level up after N consecutive successes,
     * level down after M consecutive failures
     * @param {boolean} success - Whether trial was successful
     * @returns {Object} Adjustment info {adjusted, direction, newLevel}
     */
    recordTrial(success) {
        // Update recent results for statistics
        this.recentResults.push(success ? 1 : 0);
        if (this.recentResults.length > this.config.windowSize) {
            this.recentResults.shift();
        }
        
        // Update streak counters
        if (success) {
            this.consecutiveSuccess++;
            this.consecutiveFail = 0;
        } else {
            this.consecutiveFail++;
            this.consecutiveSuccess = 0;
        }
        
        return this.adjust();
    },
    
    /**
     * Perform difficulty adjustment based on consecutive streaks
     * @returns {Object} Adjustment info
     */
    adjust() {
        const result = {
            adjusted: false,
            direction: 0,
            newLevel: this.level,
            accuracy: this.getRecentAccuracy() / 100
        };
        
        // Level up: reached required consecutive successes
        if (this.consecutiveSuccess >= this.config.successStreak) {
            this.level = Math.min(
                this.config.maxLevel,
                this.level + this.config.stepUp
            );
            result.adjusted = true;
            result.direction = 1;
            this.consecutiveSuccess = 0;
        }
        // Level down: reached required consecutive failures
        else if (this.consecutiveFail >= this.config.failStreak) {
            this.level = Math.max(
                this.config.minLevel,
                this.level - this.config.stepDown
            );
            result.adjusted = true;
            result.direction = -1;
            this.consecutiveFail = 0;
        }
        
        result.newLevel = this.level;
        return result;
    },
    
    /**
     * Get current difficulty level
     * @returns {number} Current level
     */
    getLevel() {
        return this.level;
    },
    
    /**
     * Set difficulty level directly
     * @param {number} level - New level
     */
    setLevel(level) {
        this.level = Math.max(
            this.config.minLevel,
            Math.min(this.config.maxLevel, level)
        );
    },
    
    /**
     * Get scaled parameter value based on current difficulty
     * @param {Object} paramObj - Parameter with min/mid/max values
     * @returns {number} Scaled value
     */
    getScaledParam(paramObj) {
        return getScaledParam(paramObj, this.level);
    },
    
    /**
     * Get display string for current level
     * @returns {string} Level display (e.g., "Lv.30")
     */
    getDisplayLevel() {
        return 'Lv.' + Math.round(this.level * 100);
    },
    
    /**
     * Get recent accuracy percentage
     * @returns {number} Accuracy 0-100
     */
    getRecentAccuracy() {
        if (this.recentResults.length === 0) return 100;
        const sum = this.recentResults.reduce((a, b) => a + b, 0);
        return Math.round((sum / this.recentResults.length) * 100);
    },
    
    /**
     * Get current streak info (for debugging/display)
     * @returns {Object} {successStreak, failStreak}
     */
    getStreakInfo() {
        return {
            successStreak: this.consecutiveSuccess,
            failStreak: this.consecutiveFail
        };
    }
};

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Difficulty };
}