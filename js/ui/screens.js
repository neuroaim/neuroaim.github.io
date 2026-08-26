// ==================== UI SCREENS ====================
// Screen management, modals, dynamic mode cards

// Global pause timer
var pauseResumeTimer = null;

// ===== POINTER LOCK HELPER =====
function tryLockPointer() {
    const canvas = document.getElementById('game-canvas');
    if (canvas) {
        canvas.style.display = 'block';
        canvas.focus();
        
        canvas.requestPointerLock = canvas.requestPointerLock || canvas.mozRequestPointerLock;
        if (typeof canvas.requestPointerLock === 'function') {
            requestAnimationFrame(() => {
                requestAimPointerLock(canvas);
            });
        }
    }
}

// ===== SCREEN TRANSITIONS =====
function showScreen(screenId) {
    // 1. 隐藏所有屏幕
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    
    // 2. 显示目标屏幕
    const screen = document.getElementById(screenId);
    if (screen) screen.classList.add('active');
    
    // 3. 关键修复：管理 HUD 的显示/隐藏
    const hud = document.getElementById('hud-container');
    if (hud) {
        if (screenId === 'game-screen') {
            hud.style.display = 'flex';
            // 确保进入游戏时背景是透明的（让 Canvas 可见）
            if (screen) screen.style.background = 'transparent';
        } else {
            hud.style.display = 'none';
            // 恢复其他菜单的背景色
            if (screen) screen.style.background = ''; 
        }
    }
    
    // 4. 特殊处理
    if (screenId === 'stats-screen' && typeof updateStatsDisplay === 'function') {
        updateStatsDisplay();
    }
    
    if (screenId === 'menu-screen') {
        renderModeCards();
    }
}

// ===== MODE INFO =====
function showModeInfo(mode) {
    console.log('showModeInfo called for mode:', mode);
    
    if (typeof getModeInfo !== 'function') {
        console.error('getModeInfo is undefined! Ensure mode-info.js is loaded.');
        return;
    }
    
    const info = getModeInfo(mode);
    if (!info) {
        console.error('No info found for mode:', mode);
        return;
    }
    
    const closeText = (typeof i18n !== 'undefined' && i18n.t) ? i18n.t('close') : 'CLOSE';
    const howToPlayText = (typeof i18n !== 'undefined' && i18n.current === 'zh') ? '专家指引 & 操作' : 'EXPERT CUES & CONTROLS';
    const scienceText = (typeof i18n !== 'undefined' && i18n.current === 'zh') ? '神经机制' : 'NEUROSCIENCE';
    
    let html = `<h2>${info.title}</h2>`;
    html += `<div class="info-section">
                <h4>${howToPlayText}</h4>
                <ul>${info.howTo.map(h => `<li>${h}</li>`).join('')}</ul>
             </div>`;
    html += `<div class="info-section">
                <h4>${scienceText}</h4>
                <p>${info.science}</p>
             </div>`;
    html += `<button class="info-close" onclick="closeInfoModal()">${closeText}</button>`;
    
    const contentEl = document.getElementById('info-content');
    const modalEl = document.getElementById('info-modal');
    
    if (contentEl && modalEl) {
        contentEl.innerHTML = html;
        modalEl.classList.remove('hidden');
    }
}

function closeInfoModal() {
    const modal = document.getElementById('info-modal');
    if (modal) modal.classList.add('hidden');
}

// ===== SETTINGS MODAL =====
function showSettings() {
    if (typeof updateSettingsUI === 'function') updateSettingsUI();
    updateStrobeToggles();
    
    const modal = document.getElementById('settings-modal');
    if (modal) {
        modal.classList.remove('hidden');
        requestAnimationFrame(() => {
            if (typeof updateCrosshairPreview === 'function') updateCrosshairPreview();
        });
    }
}

function closeSettings() {
    const settings = Storage.getSettings();
    Storage.saveSettings(settings);
    
    const modal = document.getElementById('settings-modal');
    if (modal) modal.classList.add('hidden');
}

function updateStrobeToggles() {
    const settings = Storage.getSettings();
    
    for (const mode of ModeRegistry.getAllIds()) {
        const el = document.getElementById(`strobe-mode-${mode}`);
        if (el && settings.strobeEnabled) {
            el.checked = settings.strobeEnabled[mode] || false;
        }
    }
}

function toggleModeStrobe(mode, enabled) {
    if (![2, 7, 8].includes(mode)) return;
    Storage.setStrobeEnabled(mode, enabled);
}

// ===== RESULT SCREEN =====
function showResults(stats) {
    const zh = i18n.current === 'zh';
    const modeName = i18n.modeName(stats.mode);
    const modeEl = document.getElementById('result-mode');
    if (modeEl) modeEl.innerText = modeName;

    const strobeText = stats.strobe ? i18n.t('strobeOn') : i18n.t('normal');
    const strobeEl = document.getElementById('result-strobe');
    if (strobeEl) {
        strobeEl.innerText = strobeText;
        strobeEl.className = stats.strobe ? 'strobe-badge active' : 'strobe-badge';
    }

    const accEl = document.getElementById('result-accuracy');
    const rtEl = document.getElementById('result-avgrt');
    const trialsEl = document.getElementById('result-trials');
    const diffEl = document.getElementById('result-difficulty');
    const changeEl = document.getElementById('result-diff-change');
    const minRtEl = document.getElementById('result-minrt');
    const maxRtEl = document.getElementById('result-maxrt');
    const consEl = document.getElementById('result-consistency');
    const labels = {
        primary: document.getElementById('result-primary-label'),
        secondary: document.getElementById('result-secondary-label'),
        trials: document.getElementById('result-trials-label'),
        difficulty: document.getElementById('result-difficulty-label'),
        min: document.getElementById('result-min-label'),
        max: document.getElementById('result-max-label'),
        consistency: document.getElementById('result-consistency-label'),
    };

    if (stats.mode === 4) {
        if (accEl) accEl.innerText = `${stats.accuracy}%`;
        if (rtEl) rtEl.innerText = `Lv.${Math.round(stats.endDifficulty * 100)}`;
        if (trialsEl) trialsEl.innerText = `${stats.hits} / ${stats.trials}`;
        if (diffEl) diffEl.innerText = `${stats.averageLockDelayMs || 0} ms`;
        if (changeEl) {
            const change = Math.round((stats.endDifficulty - stats.startDifficulty) * 100);
            changeEl.style.display = '';
            changeEl.innerText = `${change >= 0 ? '+' : ''}${change}`;
            changeEl.className = `diff-change ${change > 0 ? 'positive' : change < 0 ? 'negative' : ''}`;
        }
        if (minRtEl) minRtEl.innerText = `Lv.${Math.round((stats.peakDifficulty || stats.endDifficulty) * 100)}`;
        if (maxRtEl) maxRtEl.innerText = `${stats.averageProbeDurationMs || 0} ms`;
        if (consEl) consEl.innerText = `${stats.maxDecoyCount || 0} / ${stats.maxNoiseCount || 0}`;
        if (labels.primary) labels.primary.innerText = zh ? '正确率' : 'ACCURACY';
        if (labels.secondary) labels.secondary.innerText = zh ? '最终难度' : 'FINAL DIFFICULTY';
        if (labels.trials) labels.trials.innerText = zh ? '正确 / 尝试' : 'CORRECT / TRIALS';
        if (labels.difficulty) labels.difficulty.innerText = zh ? '平均符号等待' : 'AVG SYMBOL DELAY';
        if (labels.min) labels.min.innerText = zh ? '最高难度' : 'PEAK DIFFICULTY';
        if (labels.max) labels.max.innerText = zh ? '平均符号持续' : 'AVG SYMBOL DURATION';
        if (labels.consistency) labels.consistency.innerText = zh ? '最大干扰：周围 / 掩蔽' : 'MAX DISTRACTORS: AROUND / MASK';
    } else {
        const diffChange = stats.endDifficulty - stats.startDifficulty;
        if (accEl) accEl.innerText = `${stats.accuracy}%`;
        if (rtEl) rtEl.innerText = `${stats.avgRt} ms`;
        if (trialsEl) trialsEl.innerText = `${stats.hits} / ${stats.trials}`;
        if (diffEl) diffEl.innerText = `Lv.${Math.round(stats.endDifficulty * 100)}`;
        if (changeEl) {
            changeEl.style.display = '';
            changeEl.innerText = `${diffChange >= 0 ? '+' : ''}${Math.round(diffChange * 100)}`;
            changeEl.className = `diff-change ${diffChange > 0 ? 'positive' : diffChange < 0 ? 'negative' : ''}`;
        }
        if (minRtEl) minRtEl.innerText = `${stats.minRt}ms`;
        if (maxRtEl) maxRtEl.innerText = `${stats.maxRt}ms`;
        if (consEl) consEl.innerText = `±${stats.rtStdDev}ms`;
        if (labels.primary) labels.primary.innerText = i18n.t('accuracy');
        if (labels.secondary) labels.secondary.innerText = i18n.t('avgReaction');
        if (labels.trials) labels.trials.innerText = i18n.t('hitsTrials');
        if (labels.difficulty) labels.difficulty.innerText = i18n.t('finalDifficulty');
        if (labels.min) labels.min.innerText = i18n.t('bestRT');
        if (labels.max) labels.max.innerText = i18n.t('worstRT');
        if (labels.consistency) labels.consistency.innerText = i18n.t('consistency');
    }

    showScreen('result-screen');
}

function restartGame() {
    if (typeof GameEngine !== 'undefined' && GameEngine.modeId) {
        GameEngine.startGame(GameEngine.modeId);
        tryLockPointer();
    } else {
        showScreen('menu-screen');
    }
}

// ===== START GAME WITH LOCK =====
function selectModeWithLock(mode) {
    if (typeof GameEngine !== 'undefined') {
        GameEngine.startGame(mode);
        tryLockPointer();
    } else if (typeof startGame === 'function') {
        startGame(mode);
        tryLockPointer();
    }
}

// ===== PAUSE / RESUME =====
function togglePause() {
    const gameScreen = document.getElementById('game-screen');
    if (!gameScreen || !gameScreen.classList.contains('active')) return;
    
    const pauseModal = document.getElementById('pause-modal');
    const resumeBtn = document.getElementById('btn-resume');
    
    if (GameEngine.phase === 'playing') {
        if (GameEngine.modeId === 4 && GameEngine.mode?.interrupt) {
            GameEngine.mode.interrupt('manual_pause');
        }
        GameEngine.pauseClock();
        GameEngine.phase = 'paused';
        if (pauseModal) pauseModal.classList.remove('hidden');
        
        if (resumeBtn) {
            let count = 2;
            resumeBtn.disabled = true;
            resumeBtn.style.opacity = '0.5';
            resumeBtn.style.cursor = 'not-allowed';
            resumeBtn.innerText = `RESUME (${count})`;
            
            if (pauseResumeTimer) clearInterval(pauseResumeTimer);
            
            pauseResumeTimer = setInterval(() => {
                count--;
                if (count > 0) {
                    resumeBtn.innerText = `RESUME (${count})`;
                } else {
                    clearInterval(pauseResumeTimer);
                    pauseResumeTimer = null;
                    resumeBtn.disabled = false;
                    resumeBtn.style.opacity = '1';
                    resumeBtn.style.cursor = 'pointer';
                    resumeBtn.innerText = i18n.t('ui.resume');
                }
            }, 1000);
        }
    } else if (GameEngine.phase === 'paused') {
        resumeGame();
    }
}

function resumeGame() {
    const resumeBtn = document.getElementById('btn-resume');
    if (resumeBtn && resumeBtn.disabled) return;
    
    if (pauseResumeTimer) {
        clearInterval(pauseResumeTimer);
        pauseResumeTimer = null;
    }
    
    const pauseModal = document.getElementById('pause-modal');
    const quitConfirm = document.getElementById('quit-confirm');
    
    if (pauseModal) pauseModal.classList.add('hidden');
    if (quitConfirm) quitConfirm.classList.add('hidden');
    
    GameEngine.requestResume();
}

function confirmQuit() {
    const pauseModal = document.getElementById('pause-modal');
    const quitConfirm = document.getElementById('quit-confirm');
    
    if (pauseModal) pauseModal.classList.add('hidden');
    if (quitConfirm) quitConfirm.classList.remove('hidden');
}

function cancelQuit() {
    const pauseModal = document.getElementById('pause-modal');
    const quitConfirm = document.getElementById('quit-confirm');
    
    if (quitConfirm) quitConfirm.classList.add('hidden');
    if (pauseModal) pauseModal.classList.remove('hidden');
}

function quitGame() {
    const quitConfirm = document.getElementById('quit-confirm');
    if (quitConfirm) quitConfirm.classList.add('hidden');
    
    GameEngine.phase = 'ended';
    if (GameEngine.mode) {
        GameEngine.mode.cleanup();
        GameEngine.mode = null;
    }
    
    showScreen('menu-screen');
}

// ===== LANGUAGE TOGGLE =====
function toggleLanguage() {
    i18n.toggle();
    updateUIText();
}

function updateUIText() {
    // Update all data-i18n elements
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        el.innerHTML = i18n.t(key);
    });
    
    // Update title elements
    const titleEl = document.querySelector('.title');
    if (titleEl) titleEl.textContent = i18n.t('ui.title');
    
    const subtitleEl = document.querySelector('.subtitle');
    if (subtitleEl) subtitleEl.textContent = i18n.t('ui.subtitle');
}

// ===== EVENT LISTENERS =====
document.addEventListener('click', e => {
    if (e.target.classList.contains('info-modal')) closeInfoModal();
    if (e.target.classList.contains('settings-modal')) closeSettings();
});

document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
        if (typeof GameEngine !== 'undefined' && GameEngine.phase === 'playing') {
            togglePause();
            return;
        }
        
        const infoModal = document.getElementById('info-modal');
        const settingsModal = document.getElementById('settings-modal');
        
        if (infoModal && !infoModal.classList.contains('hidden')) {
            closeInfoModal();
        } else if (settingsModal && !settingsModal.classList.contains('hidden')) {
            closeSettings();
        }
    }
});

// ===== INITIALIZATION =====
function initUI() {
    // Register language change listener
    i18n.on('change', () => {
        updateUIText();
    });
    
    // Initial render
    updateUIText();
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        showScreen, showModeInfo, closeInfoModal,
        showSettings, closeSettings, showResults,
        togglePause, resumeGame, quitGame,
        initUI
    };
}
