// ==================== MODAL SYSTEM ====================
// Modal dialog management

const Modals = {
    // Active modal stack
    activeModals: [],
    
    /**
     * Show a modal by ID
     * @param {string} modalId - Modal element ID
     */
    show(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('hidden');
            this.activeModals.push(modalId);
        }
    },
    
    /**
     * Hide a modal by ID
     * @param {string} modalId - Modal element ID
     */
    hide(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('hidden');
            this.activeModals = this.activeModals.filter(id => id !== modalId);
        }
    },
    
    /**
     * Hide all modals
     */
    hideAll() {
        this.activeModals.forEach(id => {
            const modal = document.getElementById(id);
            if (modal) modal.classList.add('hidden');
        });
        this.activeModals = [];
    },
    
    /**
     * Check if any modal is open
     * @returns {boolean}
     */
    isAnyOpen() {
        return this.activeModals.length > 0;
    },
    
    /**
     * Close topmost modal (for ESC key)
     */
    closeTopmost() {
        if (this.activeModals.length > 0) {
            const topModal = this.activeModals[this.activeModals.length - 1];
            this.hide(topModal);
        }
    },
    
    // ===== SPECIFIC MODALS =====
    
    /**
     * Show mode info modal
     * @param {number} modeId - Mode ID
     */
    showModeInfo(modeId) {
        const info = i18n.modeInfo(modeId);
        if (!info || !info.name) {
            console.error('No info found for mode:', modeId);
            return;
        }
        
        const content = document.getElementById('info-content');
        if (!content) return;
        
        // Build HTML
        let html = `<h2>${info.name}</h2>`;
        
        // Tag
        if (info.tag) {
            html += `<span class="mode-tag">${info.tag}</span>`;
        }
        
        // Description
        if (info.description) {
            html += `<p class="mode-desc">${info.description}</p>`;
        }
        
        // How to play
        if (info.howTo && info.howTo.length) {
            html += `
                <div class="info-section">
                    <h4>${i18n.t('ui.howToPlay')}</h4>
                    <ul>${info.howTo.map(h => `<li>${h}</li>`).join('')}</ul>
                </div>
            `;
        }
        
        // Science
        if (info.science) {
            html += `
                <div class="info-section">
                    <h4>${i18n.t('ui.neuroscience')}</h4>
                    <p>${info.science}</p>
                </div>
            `;
        }
        
        // Improves
        if (info.improves && info.improves.length) {
            html += `
                <div class="info-section improves">
                    <h4>${i18n.t('ui.improves')}</h4>
                    <div class="improve-tags">
                        ${info.improves.map(imp => `<span class="improve-tag">${imp}</span>`).join('')}
                    </div>
                </div>
            `;
        }
        
        // Close button
        html += `<button class="modal-close-btn" onclick="Modals.hide('info-modal')">${i18n.t('ui.close')}</button>`;
        
        content.innerHTML = html;
        this.show('info-modal');
    },
    
    /**
     * Show settings modal
     */
    showSettings() {
        if (typeof updateSettingsUI === 'function') updateSettingsUI();
        if (typeof updateStrobeToggles === 'function') updateStrobeToggles();
        this.show('settings-modal');
        requestAnimationFrame(() => {
            if (typeof updateCrosshairPreview === 'function') updateCrosshairPreview();
        });
    },
    
    /**
     * Hide settings modal (with save)
     */
    hideSettings() {
        if (typeof saveSettings === 'function') saveSettings();
        this.hide('settings-modal');
    },
    
    /**
     * Show pause modal
     */
    showPause() {
        this.show('pause-modal');
    },
    
    /**
     * Hide pause modal
     */
    hidePause() {
        this.hide('pause-modal');
        this.hide('quit-confirm');
    },
    
    /**
     * Show quit confirmation
     */
    showQuitConfirm() {
        this.hide('pause-modal');
        this.show('quit-confirm');
    },
    
    /**
     * Cancel quit (back to pause)
     */
    cancelQuit() {
        this.hide('quit-confirm');
        this.show('pause-modal');
    },
    
    /**
     * Show training guide modal
     */
    showTrainingGuide() {
        if (typeof TrainingGuide !== 'undefined' && TrainingGuide.render) {
            TrainingGuide.render();
        }
        this.show('training-guide-modal');
    },
    
    /**
     * Hide training guide
     */
    hideTrainingGuide() {
        this.hide('training-guide-modal');
    },
    
    /**
     * Create modal container HTML
     * @returns {string} Modals HTML
     */
    createHTML() {
        return `
            <!-- Info Modal -->
            <div id="info-modal" class="modal-overlay hidden">
                <div class="modal-content info-modal-content">
                    <div id="info-content"></div>
                </div>
            </div>
            
            <!-- Settings Modal -->
            <div id="settings-modal" class="modal-overlay hidden">
                <div class="modal-content settings-modal-content">
                    <h2 data-i18n="ui.settings">Settings</h2>
                    
                    <div class="settings-section">
                        <h3 data-i18n="settings.audio">Audio</h3>
                        <div class="setting-row">
                            <label data-i18n="settings.sound">Sound</label>
                            <input type="checkbox" id="setting-soundEnabled" onchange="updateSetting('soundEnabled', this.checked)">
                        </div>
                        <div class="setting-row">
                            <label data-i18n="settings.volume">Volume</label>
                            <input type="range" id="setting-volume" min="0" max="1" step="0.1" onchange="updateVolume(this.value)">
                            <span id="volume-value">50%</span>
                        </div>
                    </div>
                    
                    <div class="settings-section">
                        <h3 data-i18n="settings.controls">Controls</h3>
                        <div class="setting-row">
                            <label data-i18n="settings.sensitivity">Sensitivity</label>
                            <input type="range" id="setting-sensitivity" min="0.2" max="3" step="0.1" onchange="updateSensitivity(this.value)">
                            <span id="sens-value">1.00x</span>
                        </div>
                    </div>
                    
                    <div class="settings-section">
                        <h3 data-i18n="settings.crosshair">Crosshair</h3>
                        <div class="crosshair-options">
                            <div class="crosshair-option" data-ch="cross" onclick="setCrosshair('cross')">+</div>
                            <div class="crosshair-option" data-ch="dot" onclick="setCrosshair('dot')">•</div>
                            <div class="crosshair-option" data-ch="circle" onclick="setCrosshair('circle')">○</div>
                            <div class="crosshair-option" data-ch="crossdot" onclick="setCrosshair('crossdot')">⊕</div>
                        </div>
                        <div class="setting-row">
                            <label data-i18n="settings.scale">Scale</label>
                            <input type="range" id="setting-scale" min="0.5" max="2" step="0.1" onchange="updateCrosshairScale(this.value)">
                            <span id="scale-value">1.0x</span>
                        </div>
                        <div class="crosshair-preview">
                            <canvas id="crosshair-preview-canvas"></canvas>
                        </div>
                    </div>
                    
                    <div class="settings-buttons">
                        <button class="btn-reset" onclick="resetSettings()" data-i18n="settings.reset">Reset</button>
                        <button class="btn-close" onclick="Modals.hideSettings()" data-i18n="ui.close">Close</button>
                    </div>
                </div>
            </div>
            
            <!-- Pause Modal -->
            <div id="pause-modal" class="modal-overlay hidden">
                <div class="modal-content pause-modal-content">
                    <h2 data-i18n="ui.paused">PAUSED</h2>
                    <div class="pause-buttons">
                        <button id="btn-resume" onclick="resumeGame()" data-i18n="ui.resume">RESUME</button>
                        <button onclick="Modals.showQuitConfirm()" data-i18n="ui.quit">QUIT</button>
                    </div>
                </div>
            </div>
            
            <!-- Quit Confirm -->
            <div id="quit-confirm" class="modal-overlay hidden">
                <div class="modal-content quit-confirm-content">
                    <h3 data-i18n="ui.quitConfirm">Quit this session?</h3>
                    <p data-i18n="ui.progressLost">Progress will not be saved.</p>
                    <div class="confirm-buttons">
                        <button onclick="quitGame()" class="btn-danger" data-i18n="ui.yesQuit">Yes, Quit</button>
                        <button onclick="Modals.cancelQuit()" data-i18n="ui.cancel">Cancel</button>
                    </div>
                </div>
            </div>
            
            <!-- Training Guide Modal -->
            <div id="training-guide-modal" class="modal-overlay hidden">
                <div class="modal-content training-guide-content">
                    <div id="training-guide-container"></div>
                    <button class="modal-close-btn" onclick="Modals.hideTrainingGuide()" data-i18n="ui.close">Close</button>
                </div>
            </div>
        `;
    }
};

// ===== GLOBAL HELPERS =====

function showModeInfo(modeId) {
    Modals.showModeInfo(modeId);
}

function closeInfoModal() {
    Modals.hide('info-modal');
}

function showSettings() {
    Modals.showSettings();
}

function closeSettings() {
    Modals.hideSettings();
}

function confirmQuit() {
    Modals.showQuitConfirm();
}

function cancelQuit() {
    Modals.cancelQuit();
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Modals;
}
