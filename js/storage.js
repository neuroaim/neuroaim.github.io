// ==================== LOCAL STORAGE WRAPPER ====================
// Centralized storage management

const Storage = {
    keys: {
        settings: 'neuroaim_settings_v3',
        stats: 'neuroaim_stats_v3',
        language: 'neuroaim_language'
    },
    
    // ===== Generic Methods =====
    
    get(key, defaultValue = null) {
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : defaultValue;
        } catch (e) {
            console.warn(`[Storage] Read error for ${key}:`, e);
            return defaultValue;
        }
    },
    
    set(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (e) {
            console.warn(`[Storage] Write error for ${key}:`, e);
            return false;
        }
    },
    
    remove(key) {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (e) {
            return false;
        }
    },
    
    // ===== Settings =====
    
    // 基础默认设置（不包含 mode 相关的，因为 mode 数量是动态的）
    defaultSettings: {
        soundEnabled: true,
        volume: 0.5,
        crosshair: 'cross',
        crosshairScale: 1.0,
        sensitivity: 1.0,
        strobeEnabled: {},
        difficultyLevels: {}
    },
    
    getSettings() {
        const saved = this.get(this.keys.settings, {});
        return deepMerge(this.defaultSettings, saved);
    },
    
    saveSettings(settings) {
        return this.set(this.keys.settings, settings);
    },
    
    updateSetting(key, value) {
        const settings = this.getSettings();
        settings[key] = value;
        return this.saveSettings(settings);
    },
    
    // ===== Stats =====
    
    getStats() {
        return this.get(this.keys.stats, []);
    },
    
    saveStats(stats) {
        // Keep max 2000 sessions
        if (stats.length > 2000) {
            stats = stats.slice(-2000);
        }
        return this.set(this.keys.stats, stats);
    },
    
    addSession(session) {
        const stats = this.getStats();
        stats.push(session);
        return this.saveStats(stats);
    },
    
    clearStats() {
        return this.remove(this.keys.stats);
    },
    
    // ===== Difficulty Levels =====
    
    getDifficultyLevel(modeId, isStrobe) {
        const settings = this.getSettings();
        const levels = settings.difficultyLevels || {};
        const modeLevel = levels[modeId] || { normal: 0.3, strobe: 0.3 };
        return isStrobe ? modeLevel.strobe : modeLevel.normal;
    },
    
    setDifficultyLevel(modeId, isStrobe, level) {
        const settings = this.getSettings();
        if (!settings.difficultyLevels) {
            settings.difficultyLevels = {};
        }
        if (!settings.difficultyLevels[modeId]) {
            settings.difficultyLevels[modeId] = { normal: 0.3, strobe: 0.3 };
        }
        
        const key = isStrobe ? 'strobe' : 'normal';
        const clampedLevel = Math.max(CFG.adaptive.minLevel, Math.min(CFG.adaptive.maxLevel, level));
        settings.difficultyLevels[modeId][key] = clampedLevel;
        
        return this.saveSettings(settings);
    },
    
    // ===== Strobe Settings =====
    
    isStrobeEnabled(modeId) {
        const settings = this.getSettings();
        // 直接检查，不依赖默认值
        return settings.strobeEnabled?.[modeId] === true;
    },
    
    setStrobeEnabled(modeId, enabled) {
        const settings = this.getSettings();
        if (!settings.strobeEnabled) {
            settings.strobeEnabled = {};
        }
        settings.strobeEnabled[modeId] = enabled;
        return this.saveSettings(settings);
    },
    
    // ===== Export / Import =====
    
    exportData() {
        return {
            version: 3,
            exportDate: new Date().toISOString(),
            stats: this.getStats(),
            settings: this.getSettings()
        };
    },
    
    importData(data) {
        if (data.stats) {
            this.saveStats(data.stats);
        }
        if (data.settings) {
            this.saveSettings(data.settings);
        }
        return true;
    }
};

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Storage;
}