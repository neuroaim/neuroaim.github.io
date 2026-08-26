// ==================== LOCAL STORAGE WRAPPER ====================
// Centralized storage management

const Storage = {
    strobeModeIds: [2, 7, 8],

    keys: {
        settings: 'neuroaim_settings_v3',
        stats: 'neuroaim_stats_v3',
        language: 'neuroaim_language',
        contiguousModeMigration: 'neuroaim_contiguous_mode_ids_v1',
        horizontalTrackingSplitMigration: 'neuroaim_horizontal_tracking_split_v1'
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

    _remapLegacySettings(settings) {
        const migrated = JSON.parse(JSON.stringify(settings || {}));
        for (const field of ['difficultyLevels', 'strobeEnabled']) {
            const source = migrated[field] || {};
            const next = {};
            Object.entries(source).forEach(([rawId, value]) => {
                const id = Number(rawId);
                if (id === 6) return; // Retired memory-sequence setting.
                if (id === 7) next[6] = value;
                else if (id === 8) next[7] = value;
                else next[rawId] = value;
            });
            migrated[field] = next;
        }
        return migrated;
    },

    _remapLegacyStats(stats) {
        return (Array.isArray(stats) ? stats : [])
            .filter(session => Number(session?.mode) !== 6)
            .map(session => ({
                ...session,
                mode: Number(session.mode) === 7 ? 6 : Number(session.mode) === 8 ? 7 : session.mode
            }));
    },

    _migrateLegacyModeIds() {
        try {
            if (localStorage.getItem(this.keys.contiguousModeMigration)) return;
            const settings = this.get(this.keys.settings, {});
            const stats = this.get(this.keys.stats, []);
            this.set(this.keys.settings, this._remapLegacySettings(settings));
            this.set(this.keys.stats, this._remapLegacyStats(stats));
            localStorage.setItem(this.keys.contiguousModeMigration, '1');
        } catch (error) {
            console.warn('[Storage] Mode ID migration failed:', error);
        }
    },

    _remapTrackingSplitSettings(settings) {
        const migrated = JSON.parse(JSON.stringify(settings || {}));
        for (const field of ['difficultyLevels', 'strobeEnabled']) {
            const source = migrated[field] || {};
            if (Object.prototype.hasOwnProperty.call(source, 7)) {
                if (!Object.prototype.hasOwnProperty.call(source, 8)) source[8] = source[7];
                delete source[7];
            }
            migrated[field] = source;
        }
        return migrated;
    },

    _remapTrackingSplitStats(stats) {
        return (Array.isArray(stats) ? stats : []).map(session => ({
            ...session,
            mode: Number(session?.mode) === 7 ? 8 : session.mode
        }));
    },

    _migrateHorizontalTrackingSplit() {
        try {
            if (localStorage.getItem(this.keys.horizontalTrackingSplitMigration)) return;
            const settings = this.get(this.keys.settings, {});
            const stats = this.get(this.keys.stats, []);
            this.set(this.keys.settings, this._remapTrackingSplitSettings(settings));
            this.set(this.keys.stats, this._remapTrackingSplitStats(stats));
            localStorage.setItem(this.keys.horizontalTrackingSplitMigration, '1');
        } catch (error) {
            console.warn('[Storage] Horizontal tracking split migration failed:', error);
        }
    },
    
    // ===== Settings =====
    
    // 基础默认设置（不包含 mode 相关的，因为 mode 数量是动态的）
    defaultSettings: {
        soundEnabled: true,
        volume: 0.5,
        crosshair: 'cross',
        crosshairScale: 1.0,
        sensitivityGame: 'valorant',
        sensitivity: 1.0,
        strobeEnabled: {},
        difficultyLevels: {}
    },

    _sanitizeSettings(settings) {
        const clean = { ...(settings || {}), strobeEnabled: {} };
        const source = settings?.strobeEnabled || {};
        this.strobeModeIds.forEach(modeId => {
            if (source[modeId] === true) clean.strobeEnabled[modeId] = true;
        });
        return clean;
    },
    
    getSettings() {
        this._migrateLegacyModeIds();
        this._migrateHorizontalTrackingSplit();
        const saved = this.get(this.keys.settings, {});
        return this._sanitizeSettings(deepMerge(this.defaultSettings, saved));
    },
    
    saveSettings(settings) {
        return this.set(this.keys.settings, this._sanitizeSettings(settings));
    },
    
    updateSetting(key, value) {
        const settings = this.getSettings();
        settings[key] = value;
        return this.saveSettings(settings);
    },
    
    // ===== Stats =====
    
    getStats() {
        this._migrateLegacyModeIds();
        this._migrateHorizontalTrackingSplit();
        return this.get(this.keys.stats, []);
    },
    
    saveStats(stats) {
        // Preserve every session. The history UI paginates presentation rather
        // than deleting older records from the underlying collection.
        return this.set(this.keys.stats, Array.isArray(stats) ? stats : []);
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
        if (!this.strobeModeIds.includes(Number(modeId))) return false;
        const settings = this.getSettings();
        // 直接检查，不依赖默认值
        return settings.strobeEnabled?.[modeId] === true;
    },
    
    setStrobeEnabled(modeId, enabled) {
        modeId = Number(modeId);
        if (!this.strobeModeIds.includes(modeId)) enabled = false;
        const settings = this.getSettings();
        if (!settings.strobeEnabled) {
            settings.strobeEnabled = {};
        }
        if (enabled) settings.strobeEnabled[modeId] = true;
        else delete settings.strobeEnabled[modeId];
        return this.saveSettings(settings);
    },
    
    // ===== Export / Import =====
    
    exportData() {
        return {
            version: 6,
            exportDate: new Date().toISOString(),
            stats: this.getStats(),
            settings: this.getSettings()
        };
    },
    
    importData(data) {
        const version = Number(data.version || 3);
        const legacyIds = version < 4;
        const splitTrackingIds = version < 6;
        if (data.stats) {
            const legacyStats = legacyIds ? this._remapLegacyStats(data.stats) : data.stats;
            this.saveStats(splitTrackingIds ? this._remapTrackingSplitStats(legacyStats) : legacyStats);
        }
        if (data.settings) {
            const legacySettings = legacyIds ? this._remapLegacySettings(data.settings) : data.settings;
            this.saveSettings(splitTrackingIds ? this._remapTrackingSplitSettings(legacySettings) : legacySettings);
        }
        return true;
    }
};

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Storage;
}
