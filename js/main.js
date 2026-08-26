// ==================== NEURO-AIM MAIN ====================
// Application entry point

(function() {
    'use strict';
    
    // ===== INITIALIZATION =====
    window.getModeInfo = function(modeId) {
        // Guard against i18n not being ready
        if (typeof i18n === 'undefined' || !i18n.modeInfo) {
             return { title: `Mode ${modeId}`, howTo: [], science: '' };
        }
        const info = i18n.modeInfo(modeId);
        return {
            title: info.name,
            // 如果 i18n 里没有 howTo 数组，这里提供默认值防止报错
            howTo: info.howTo || [i18n.t('ui.howToPlay')], 
            science: info.description + " - " + info.tag
        };
    };
    
    async function init() {
        console.log('[Neuro-Aim] Initializing...');
        
        try {
            // 1. Load i18n
            await i18n.init();
            console.log('[Neuro-Aim] i18n loaded:', i18n.current);
            
            // 2. Load settings
            loadSettings();
            console.log('[Neuro-Aim] Settings loaded');
            
            // 3. Initialize systems
            initSystems();
            console.log('[Neuro-Aim] Systems initialized');
            
            // 4. Register all modes
            registerModes();
            console.log('[Neuro-Aim] Modes registered:', ModeRegistry.getAllIds());
            
            // 5. Initialize UI
            initUI();
            console.log('[Neuro-Aim] UI initialized');
            
            // 6. Setup canvas
            setupCanvas();
            console.log('[Neuro-Aim] Canvas ready');
            
            // 7. Show menu
            showScreen('menu-screen');
            console.log('[Neuro-Aim] Ready!');
            
        } catch (error) {
            console.error('[Neuro-Aim] Initialization failed:', error);
        }
    }
    
    // ===== SYSTEM INITIALIZATION =====
    
    function initSystems() {
        // Initialize difficulty system
        Difficulty.init(CFG.adaptive);
        
        // Initialize strobe system
        if (typeof StrobeSystem !== 'undefined') {
            StrobeSystem.init(CFG.strobe);
        }
        
        // Initialize audio (lazy, on first interaction)
        document.addEventListener('click', () => {
            if (typeof Audio !== 'undefined' && Audio.init) Audio.init();
        }, { once: true });
    }
    
    // ===== MODE REGISTRATION =====
    
    function registerModes() {
        // Register all active modes with contiguous IDs after retiring memory sequence.
        // Ensure these Classes are available globally via script tags
        if (typeof GaborScoutMode !== 'undefined') ModeRegistry.register(GaborScoutMode);
        if (typeof PureTrackingMode !== 'undefined') ModeRegistry.register(PureTrackingMode);
        if (typeof NoCrosshairMode !== 'undefined') ModeRegistry.register(NoCrosshairMode);
        if (typeof TargetLockMode !== 'undefined') ModeRegistry.register(TargetLockMode);
        if (typeof PeripheralPopMode !== 'undefined') ModeRegistry.register(PeripheralPopMode);
        if (typeof CognitiveSwitchMode !== 'undefined') ModeRegistry.register(CognitiveSwitchMode);
        if (typeof VerticalBarTrackingMode !== 'undefined') ModeRegistry.register(VerticalBarTrackingMode);
    }
    
    // ===== UI INITIALIZATION =====
    
    function initUI() {
        // Initialize HUD
        if (typeof HUD !== 'undefined') HUD.init();
        
        // Update all i18n text
        if (typeof updateUIText === 'function') updateUIText();
        
        // Render mode cards
        renderModeCards();
        
        // Setup language toggle
        const langBtn = document.getElementById('btn-language');
        if (langBtn) {
            langBtn.addEventListener('click', () => {
                if (typeof i18n !== 'undefined') i18n.toggle();
                if (typeof renderModeCards === 'function') renderModeCards();
                if (typeof updateUIText === 'function') updateUIText();
            });
        }
        
        // Setup settings button
        const settingsBtn = document.getElementById('btn-settings');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', showSettings);
        }
        
        // Setup stats button
        const statsBtn = document.getElementById('btn-stats');
        if (statsBtn) {
            statsBtn.addEventListener('click', () => showScreen('stats-screen'));
        }
        
        // Setup guide button
        const guideBtn = document.getElementById('btn-guide');
        if (guideBtn) {
            guideBtn.addEventListener('click', () => {
                if (typeof TrainingGuide !== 'undefined') TrainingGuide.show();
            });
        }
        
        // Setup back buttons
        document.querySelectorAll('.btn-back').forEach(btn => {
            btn.addEventListener('click', () => showScreen('menu-screen'));
        });
    }
    
    function renderModeCards() {
        const container = document.querySelector('.mode-selector');
        if (!container) return;

        // 获取所有模式ID
        const modeIds = (typeof ModeRegistry !== 'undefined') ? ModeRegistry.getAllIds() : [1,2,3,4,5,6,7,8];
        
        let html = '';
        
        modeIds.forEach(id => {
            const info = i18n.modeInfo(id);
            const name = info.name || `Mode ${id}`;
            const desc = info.description || '';
            const tag = info.tag || '';
            const supportsStrobe = [2, 7, 8].includes(id);
            const isStrobe = supportsStrobe && Storage.isStrobeEnabled(id);
            const strobeControl = supportsStrobe ? `
                <label class="mode-strobe-toggle" onclick="event.stopPropagation()">
                    <span class="mode-strobe-label">${i18n.current === 'zh' ? '频闪' : 'STROBE'}</span>
                    <input type="checkbox" ${isStrobe ? 'checked' : ''} aria-label="${i18n.current === 'zh' ? '启用频闪训练' : 'Enable strobe training'}" onchange="toggleHomeStrobe(${id}, this.checked)">
                    <span class="mode-strobe-track" aria-hidden="true"><span></span></span>
                </label>` : '';
            html += `
            <div class="mode-card ${supportsStrobe ? 'has-strobe' : ''}" onclick="selectModeWithLock(${id})">
                <span class="mode-num">${id.toString().padStart(2, '0')}</span>
                <h3>${name}</h3>
                <p>${desc}</p>
                ${strobeControl}
            </div>
            `;
        });

        container.innerHTML = html;
    }

    // 导出给全局使用
    window.renderModeCards = renderModeCards;
    window.toggleHomeStrobe = function toggleHomeStrobe(modeId, enabled) {
        modeId = Number(modeId);
        if (![2, 7, 8].includes(modeId)) return;
        Storage.setStrobeEnabled(modeId, Boolean(enabled));
        if (typeof settings === 'object') {
            if (!settings.strobeEnabled) settings.strobeEnabled = {};
            if (enabled) settings.strobeEnabled[modeId] = true;
            else delete settings.strobeEnabled[modeId];
        }
        renderModeCards();
    };
    
    // ===== CANVAS SETUP =====
    
    function setupCanvas() {
        const canvas = document.getElementById('game-canvas');
        if (!canvas) {
            console.error('[Neuro-Aim] Canvas not found!');
            return;
        }
        
        // Set canvas size
        function resize() {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            
            // Update noise system dimensions
            if (typeof NoiseSystem !== 'undefined') {
                NoiseSystem.init(canvas.width, canvas.height);
            }
        }
        
        resize();
        window.addEventListener('resize', resize);
        
        // Initialize input system
        // Initialize game engine
        GameEngine.init(canvas);
    }
    
    // ===== GLOBAL FUNCTIONS =====
    
    // Start game (global access)
    window.startGame = function(modeId) {
        // Force clean state
        Modals.hideAll(); 
        GameEngine.startGame(modeId);
    };
    
    // Restart game
    window.restartGame = function() {
        Modals.hideAll(); // Ensure clean slate
        if (GameEngine.modeId) {
            GameEngine.startGame(GameEngine.modeId);
            tryLockPointer();
        } else {
            showScreen('menu-screen');
        }
    };
    
    // Pause/Resume
    window.togglePause = function() {
        const gameScreen = document.getElementById('game-screen');
        if (!gameScreen || !gameScreen.classList.contains('active')) return;
        
        // Don't pause during countdown
        if (GameEngine.phase === 'countdown') return;

        if (GameEngine.phase === 'playing') {
            if (GameEngine.modeId === 4 && GameEngine.mode?.interrupt) {
                GameEngine.mode.interrupt('manual_pause');
            }
            GameEngine.pauseClock();
            GameEngine.phase = 'paused';
            Modals.showPause();
        } else if (GameEngine.phase === 'paused') {
            resumeGame();
        }
    };
    
    window.resumeGame = function() {
        Modals.hidePause();
        Modals.hide('quit-confirm'); 
        GameEngine.requestResume();
    };
    
    window.quitGame = function() {
        Modals.hideAll();
        
        // Hide specific overlays potentially not in Modals stack
        const pauseModal = document.getElementById('pause-modal');
        const quitConfirm = document.getElementById('quit-confirm');
        if (pauseModal) pauseModal.classList.add('hidden');
        if (quitConfirm) quitConfirm.classList.add('hidden');

        GameEngine.phase = 'ended';
        if (GameEngine.mode) {
            GameEngine.mode.cleanup();
            GameEngine.mode = null;
        }
        showScreen('menu-screen');
        renderModeCards(); // Refresh cards to show any updates
    };
    
    // ===== SELECT MODE WITH LOCK =====
    window.selectModeWithLock = function(modeId) {
        if (document.pointerLockElement) {
            document.exitPointerLock();
        }
        startGame(modeId);
    };

    // ===== START =====
    
    // Wait for DOM
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
    
})();
