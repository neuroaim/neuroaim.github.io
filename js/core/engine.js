// ==================== GAME ENGINE ====================
// Core game loop, state management, input handling, adaptive difficulty
// MERGED: User's Exact Logic + Click-to-Start Feature + Bullet Holes

// ===== GLOBAL STATE =====
var canvas;
var canvasWidth = window.innerWidth;
var canvasHeight = window.innerHeight;
var mouseX = 0;
var mouseY = 0;
var mouseInputAccumulator = { x: 0, y: 0 };

var rawMouseX = window.innerWidth / 2;
var rawMouseY = window.innerHeight / 2;

// ===== BULLET HOLE SYSTEM =====
const BulletHoles = {
    holes: [],
    nextId: 1,
    maxHoles: 5,
    duration: 1500, // 1.5 seconds
    
    // Add a new bullet hole at world position
    add(worldX, worldY, worldZ) {
        this.holes.push({
            id: this.nextId++,
            x: worldX,
            y: worldY,
            z: worldZ || WALL_DISTANCE,
            spawnTime: performance.now(),
            isHit: true // Can differentiate hit/miss later
        });
        
        // Limit max holes
        if (this.holes.length > this.maxHoles) {
            this.holes.shift();
        }
    },
    
    // Add hole from crosshair position (screen center to wall)
    addFromCrosshair(camX, camY) {
        // Calculate where on the wall the crosshair is pointing based on camera rotation
        // Use SENS_FACTOR from config.js (matches Valorant sensitivity)
        const yaw = (camX || 0) * SENS_FACTOR;
        const pitch = (camY || 0) * SENS_FACTOR;
        
        const cosYaw = Math.cos(yaw);
        
        // Prevent extreme angles
        if (Math.abs(cosYaw) < 0.1) return;
        
        // Ray from camera through screen center to wall at z = WALL_DISTANCE
        const worldX = WALL_DISTANCE * Math.tan(yaw);
        const worldY = WALL_DISTANCE * Math.tan(pitch) / cosYaw;
        
        this.add(worldX, worldY, WALL_DISTANCE);
    },
    
    // Clear all holes
    clear() {
        this.holes = [];
    },
    
    // Update holes (remove expired ones)
    update() {
        const now = performance.now();
        this.holes = this.holes.filter(h => now - h.spawnTime < this.duration);
    },
    
    // Draw all holes
    draw(ctx, camX, camY) {
        const now = performance.now();
        
        this.holes.forEach(hole => {
            const age = now - hole.spawnTime;
            const progress = age / this.duration;
            
            // Fade out over time
            const alpha = 1 - progress;
            if (alpha <= 0) return;
            
            // Project hole position to screen
            const p = project3D(hole.x, hole.y, hole.z, camX, camY);
            if (!p.visible) return;
            
            const size = 3 * p.scale;
            
            ctx.save();
            ctx.globalAlpha = alpha;
            
            // Outer ring (light gray)
            ctx.beginPath();
            ctx.arc(p.x, p.y, size * 1.5, 0, Math.PI * 2);
            ctx.fillStyle = '#888888';
            ctx.fill();
            
            // Middle ring (white-gray)
            ctx.beginPath();
            ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
            ctx.fillStyle = '#cccccc';
            ctx.fill();
            
            // Inner hole (dark)
            ctx.beginPath();
            ctx.arc(p.x, p.y, size * 0.4, 0, Math.PI * 2);
            ctx.fillStyle = '#333333';
            ctx.fill();
            
            // White border for visibility
            ctx.beginPath();
            ctx.arc(p.x, p.y, size * 1.5, 0, Math.PI * 2);
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.stroke();
            
            ctx.restore();
        });
    }
};

// ===== CROSSHAIR OPACITY CONTROL =====
var crosshairOpacity = 1.0;

function setCrosshairOpacity(opacity) {
    crosshairOpacity = Math.max(0, Math.min(1, opacity));
}

function getCrosshairOpacity() {
    return crosshairOpacity;
}

// Expose to global scope
window.setCrosshairOpacity = setCrosshairOpacity;
window.getCrosshairOpacity = getCrosshairOpacity;

// ===== GAME ENGINE CLASS =====
const GameEngine = {
    // State
    phase: 'menu',          // menu, countdown, playing, paused, ended
    mode: null,             // Current mode instance
    modeId: 1,              // Current mode ID
    strobeEnabled: false,
    strobeTimer: 0,
    strobePeriod: 0,
    isBlindPhase: false,
    difficulty: 0.3,
    
    // Countdown State (NEW)
    waitingForStart: false,
    countdownCallback: null,
    
    // Session tracking
    hits: 0,
    misses: 0,
    trials: 0,
    reactionTimes: [],
    recentResults: [],
    consecutiveSuccess: 0,
    consecutiveFail: 0,
    sessionStats: {},
    timeLeft: 0,
    gameStartTime: 0,
    lastFrameTime: 0,
    gameTime: 0,
    totalPausedMs: 0,
    pauseStartedAt: 0,
    
    // Mouse position (for mode access)
    get mouseX() { return mouseX; },
    get mouseY() { return mouseY; },

    activeNow() {
        const now = performance.now();
        const currentPause = this.pauseStartedAt ? now - this.pauseStartedAt : 0;
        return now - this.totalPausedMs - currentPause;
    },

    pauseClock() {
        if (!this.pauseStartedAt) this.pauseStartedAt = performance.now();
    },

    resumeClock() {
        if (!this.pauseStartedAt) return;
        this.totalPausedMs += performance.now() - this.pauseStartedAt;
        this.pauseStartedAt = 0;
    },
    
    // ===== INITIALIZATION =====
    
    init() {
        canvas = document.getElementById('game-canvas');
        this.range = new TrainingRange3D(canvas);
        
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
        
        // Reset camera
        mouseX = 0;
        mouseY = 0;
        mouseInputAccumulator = { x: 0, y: 0 };
        if (this.range) this.range.setLook(0, 0);

        rawMouseX = canvasWidth / 2;
        rawMouseY = canvasHeight / 2;
        
        // Input handlers
        document.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        document.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));
        document.addEventListener('pointerlockchange', () => this.handlePointerLockChange());
        document.addEventListener('pointerlockerror', () => {
            if (this.phase !== 'resuming') return;
            this.phase = 'paused';
            if (typeof Modals !== 'undefined') Modals.showPause();
        });
        
        // Click Listener - For Click-to-Start logic
        canvas.addEventListener('click', () => {
            // Case 1: Waiting for start click (pointer lock already active)
            if (this.phase === 'countdown' && this.waitingForStart) {
                if (document.pointerLockElement === canvas) this.triggerCountdownTimer();
                else requestAimPointerLock(canvas);
            } 
            // Case 2: Already playing but lost lock (re-lock)
            else if (this.phase === 'playing' && document.pointerLockElement !== canvas) {
                requestAimPointerLock(canvas);
            }
        });
        
        // Start game loop
        requestAnimationFrame((t) => this.gameLoop(t));
    },
    
    resizeCanvas() {
        // Update global variables (critical for renderer.js)
        window.canvasWidth = canvasWidth = window.innerWidth;
        window.canvasHeight = canvasHeight = window.innerHeight;
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;
        if (this.range) {
            this.range.resize();
            this.range.setModeProfile(this.modeId);
        }
        
        if (typeof NoiseSystem !== 'undefined') {
            NoiseSystem.init(canvasWidth, canvasHeight);
        }
    },
    
    // ===== GAME CONTROL =====
    
    startGame(modeId) {
        if (this.mode?.cleanup) this.mode.cleanup();
        if (this.range) this.range.clearTargets();
        // Reset camera at the start of a new game
        mouseX = 0;
        mouseY = 0;
        mouseInputAccumulator = { x: 0, y: 0 };
        if (this.range) this.range.setLook(0, 0);
        
        // Reset crosshair opacity
        crosshairOpacity = 1.0;
        
        // Clear bullet holes
        BulletHoles.clear();
        
        if (typeof showScreen === 'function') showScreen('game-screen');
        
        this.modeId = modeId;
        if (this.range) this.range.setModeProfile(modeId);
        this.strobeEnabled = [2, 7, 8].includes(modeId) && Storage.isStrobeEnabled(modeId);
        this.difficulty = Storage.getDifficultyLevel(modeId, this.strobeEnabled);
        const lockInstructions = document.getElementById('target-lock-instructions');
        if (lockInstructions) {
            lockInstructions.style.display = modeId === 4 ? 'block' : 'none';
            lockInstructions.textContent = i18n.current === 'zh'
                ? '头部缺口向左：左键　　头部缺口向右：右键　　回答速度不计分'
                : 'HEAD GAP LEFT: LEFT CLICK　　HEAD GAP RIGHT: RIGHT CLICK　　RESPONSE SPEED IS NOT SCORED';
        }
        
        // Reset session
        this.hits = 0;
        this.misses = 0;
        this.trials = 0;
        this.reactionTimes = [];
        this.recentResults = [];
        this.consecutiveSuccess = 0;
        this.consecutiveFail = 0;
        this.sessionStats = {
            mode: modeId,
            strobe: this.strobeEnabled,
            startDifficulty: this.difficulty,
            gazeBreaks: 0,
            perfectTrials: 0,
            switchErrors: 0,
            inhibitionSuccess: 0,
            inhibitionFail: 0,
            difficultyHistory: []
        };
        this.totalPausedMs = 0;
        this.pauseStartedAt = 0;
        
        if (typeof Combo !== 'undefined') Combo.reset();
        this.setupNoiseForMode(modeId);
        
        this.timeLeft = CFG.sessionDuration;
        this.gameTime = 0;
        this.updateHUD();
        
        // Create mode instance
        this.mode = null;
        
        // Enter countdown phase
        this.phase = 'countdown';
        this.waitingForStart = true;
        
        // Define what happens after countdown finishes
        // NOTE: Do NOT reset mouseX/mouseY here - keep the position from countdown phase
        this.countdownCallback = () => {
            this.mode = ModeRegistry.create(this.modeId, this);
            this.mode.init();

            this.phase = 'playing';
            this.gameStartTime = performance.now();
            this.lastFrameTime = performance.now();
        };
        
        // Immediately request pointer lock (hide system cursor)
        if (canvas) {
            canvas.requestPointerLock = canvas.requestPointerLock || canvas.mozRequestPointerLock;
            if (typeof canvas.requestPointerLock === 'function') {
                requestAimPointerLock(canvas);
            }
        }
        
        // Show "Click to Start" prompt
        this.showClickPrompt();
    },
    
    // NEW: Show "Click to Start" (Step 1)
    showClickPrompt() {
        const overlay = document.getElementById('countdown-overlay');
        const countText = document.getElementById('countdown-text');
        const prompt = document.getElementById('click-prompt');
        
        if (overlay) overlay.style.display = 'flex';
        if (prompt) prompt.style.display = 'block';     // Show Prompt
        if (countText) countText.style.display = 'none'; // Hide Numbers
    },

    // Actual Countdown (Step 2 - Triggered by Click)
    triggerCountdownTimer() {
        if (!this.waitingForStart) return;
        this.waitingForStart = false;
        
        const countText = document.getElementById('countdown-text');
        const prompt = document.getElementById('click-prompt');
        
        if (prompt) prompt.style.display = 'none';      // Hide Prompt
        if (countText) countText.style.display = 'block'; // Show Numbers
        
        // Start countdown (pointer lock already active from startGame)
        this.startCountdown(3, this.countdownCallback);
    },
    
    setupNoiseForMode(modeId) {
        if (typeof NoiseSystem === 'undefined') return;
        
        let noiseLevel = 0;
        if (modeId === 1) {
            noiseLevel = Math.floor(1 + this.difficulty * 3);
        } else {
            noiseLevel = 0;
        }
        
        NoiseSystem.setStrobeEnabled(this.strobeEnabled);
        NoiseSystem.setNoiseCount(noiseLevel);
        NoiseSystem.regenerate();
    },
    
    // MODIFIED: Adapted to be called by triggerCountdownTimer
    startCountdown(seconds, callback) {
        if (this.countdownTimer) clearInterval(this.countdownTimer);
        let count = seconds;
        const overlay = document.getElementById('countdown-overlay');
        const countText = document.getElementById('countdown-text');
        
        if (overlay) overlay.style.display = 'flex';
        if (countText) {
            countText.style.display = 'block';
            countText.innerText = count;
        }
        
        playSound('click');
        
        this.countdownTimer = setInterval(() => {
            count--;
            if (count > 0) {
                if (countText) countText.innerText = count;
                playSound('click');
            } else {
                clearInterval(this.countdownTimer);
                this.countdownTimer = null;
                if (overlay) overlay.style.display = 'none';
                if (callback) callback();
            }
        }, 1000);
    },

    cancelCountdown() {
        if (this.countdownTimer) clearInterval(this.countdownTimer);
        this.countdownTimer = null;
        this.waitingForStart = true;
        this.showClickPrompt();
    },

    handlePointerLockChange() {
        if (document.pointerLockElement === canvas) {
            if (this.phase === 'resuming') {
                this.resumeClock();
                this.phase = 'playing';
                if (this.mode?.resume) this.mode.resume();
            }
            return;
        }
        mouseInputAccumulator = { x: 0, y: 0 };
        if (this.phase === 'countdown') {
            this.cancelCountdown();
        } else if (this.phase === 'playing') {
            if (this.modeId === 4 && this.mode?.interrupt) this.mode.interrupt('pointer_lock_lost');
            if (typeof togglePause === 'function') togglePause();
        }
    },

    requestResume() {
        if (document.pointerLockElement === canvas) {
            this.resumeClock();
            this.phase = 'playing';
            if (this.mode?.resume) this.mode.resume();
            return;
        }
        this.phase = 'resuming';
        requestAimPointerLock(canvas);
    },
    
    endGame() {
        this.phase = 'ended';
        if (this.mode?.finalizeSession) this.mode.finalizeSession();
        if (document.exitPointerLock) {
            document.exitPointerLock();
        }
        
        // Save difficulty
        Storage.setDifficultyLevel(this.modeId, this.strobeEnabled, this.difficulty);
        
        // Calculate final stats
        const stats = Stats.buildSessionObject({
            modeId: this.modeId,
            strobeEnabled: this.strobeEnabled,
            startDifficulty: this.sessionStats.startDifficulty,
            endDifficulty: this.difficulty,
            hits: this.hits,
            misses: this.misses,
            trials: this.trials,
            reactionTimes: this.reactionTimes,
            durationMs: this.gameTime,
            sessionStats: this.sessionStats
        });
        
        // Save to storage
        Storage.addSession(stats);
        
        // Show results
        if (typeof showResults === 'function') {
            showResults(stats);
        }
        
        // Cleanup mode
        if (this.mode) {
            this.mode.cleanup();
            this.mode = null;
        }
    },
    
    // ===== ADAPTIVE DIFFICULTY =====
    
    recordTrial(success, reactionTime, options = {}) {
        this.trials++;
        if (success) { this.hits++; if (reactionTime) this.reactionTimes.push(reactionTime); }
        else this.misses++;
        
        // Update recent results for statistics display
        this.recentResults.push(success ? 1 : 0);
        if (this.recentResults.length > CFG.adaptive.windowSize) {
            this.recentResults.shift();
        }
        
        if (!options.skipDifficulty) {
            if (success) {
                this.consecutiveSuccess++;
                this.consecutiveFail = 0;
            } else {
                this.consecutiveFail++;
                this.consecutiveSuccess = 0;
            }
            if (!this.sessionStats.difficultyHistory) this.sessionStats.difficultyHistory = [];
            this.sessionStats.difficultyHistory.push(this.difficulty);
            this.adjustDifficulty();
        }
        this.updateHUD();
    },
    
    adjustDifficulty() {
        // Level up: reached required consecutive successes
        if (this.consecutiveSuccess >= CFG.adaptive.successStreak) {
            this.difficulty = Math.min(CFG.adaptive.maxLevel, this.difficulty + CFG.adaptive.stepUp);
            this.consecutiveSuccess = 0;
        }
        // Level down: reached required consecutive failures
        else if (this.consecutiveFail >= CFG.adaptive.failStreak) {
            this.difficulty = Math.max(CFG.adaptive.minLevel, this.difficulty - CFG.adaptive.stepDown);
            this.consecutiveFail = 0;
        }
    },
    
    // ===== GAME LOOP =====
    
    gameLoop(timestamp) {
        // Process mouse input during countdown AND playing phases
        // This allows pre-aiming during countdown
        if (document.pointerLockElement === canvas && (this.phase === 'countdown' || this.phase === 'playing')) {
            const settings = Storage.getSettings();
            const sens = getSensitivityMultiplier(settings);
            
            // Basic jump filter to prevent browser glitches
            if (this.modeId !== 4 && Math.abs(mouseInputAccumulator.x) < 300 && Math.abs(mouseInputAccumulator.y) < 300) {
                 mouseX += mouseInputAccumulator.x * sens;
                 mouseY += mouseInputAccumulator.y * sens;
            }
            mouseInputAccumulator = { x: 0, y: 0 };
        }
        
        // Calculate delta time
        if (!this.lastFrameTime) this.lastFrameTime = timestamp;
        let dt = timestamp - this.lastFrameTime;
        this.lastFrameTime = timestamp;
        if (dt > 100 && this.modeId === 4 && this.mode?.interrupt) this.mode.interrupt('long_frame');
        if (dt > 100) dt = 16.67;
        
        // Update game state
        if (this.phase === 'playing') {
            this.gameTime += dt;
            this.timeLeft -= dt / 1000;
            
            if (this.timeLeft <= 0) {
                this.endGame();
            } else {
                if (typeof NoiseSystem !== 'undefined') NoiseSystem.update(dt);
                
                // 独立的 strobe 更新逻辑
                if (this.strobeEnabled) {
                    this.strobeTimer += dt;
                    if (this.strobeTimer >= this.strobePeriod) {
                        this.strobeTimer = 0;
                        // 随机频率 2-4 Hz
                        const freq = 2 + Math.random() * 2;
                        this.strobePeriod = 1000 / freq;
                    }
                    // 30% 可见时间，70% 遮挡
                    const visibleTime = this.strobePeriod * 0.3;
                    this.isBlindPhase = this.strobeTimer > visibleTime;
                } else {
                    this.isBlindPhase = false;
                }
                
                if (this.mode) this.mode.update(dt);
                
                // Update bullet holes
                BulletHoles.update();
            }
            this.updateHUD();
        }
        
        // Render
        this.render();
        
        requestAnimationFrame((t) => this.gameLoop(t));
    },
    
    render() {
        const gameScreen = document.getElementById('game-screen');
        if (!gameScreen?.classList.contains('active')) return;
        const renderNow = performance.now();
        if (this.phase === 'paused' && renderNow - (this.lastPausedRenderAt || 0) < 100) return;
        if (this.phase === 'paused') this.lastPausedRenderAt = renderNow;
        const strobeCurtain = document.getElementById('strobe-curtain');
        if (strobeCurtain) {
            strobeCurtain.classList.toggle('blind', this.phase === 'playing' && this.strobeEnabled && this.isBlindPhase);
        }
        if (this.range) {
            this.range.setLook(mouseX * SENS_FACTOR, mouseY * SENS_FACTOR);
            const reticleVisible = this.modeId !== 4 && !(this.strobeEnabled && this.isBlindPhase);
            const settings = Storage.getSettings();
            this.range.setReticle(reticleVisible, crosshairOpacity, settings.crosshair || 'cross', settings.crosshairScale || 1);
            if (this.mode) this.mode.draw(); // draw is now a Three.js state sync, never Canvas2D painting.
            this.range.syncBulletHoles(BulletHoles.holes);
            this.range.render(renderNow);
        }
    },
    
    updateHUD() {
        if (this.modeId === 4 && this.mode?.updateHud) {
            this.mode.updateHud();
            return;
        }
        const timeEl = document.getElementById('hud-time');
        if (timeEl) timeEl.innerText = Math.max(0, Math.ceil(this.timeLeft));
        
        const accEl = document.getElementById('hud-accuracy');
        const acc = this.trials > 0 ? Math.round((this.hits / this.trials) * 100) : 100;
        if (accEl) accEl.innerText = acc + '%';
        
        const diffEl = document.getElementById('hud-difficulty');
        if (diffEl) diffEl.innerText = 'Lv.' + Math.round(this.difficulty * 100);
        
        const trialsEl = document.getElementById('hud-trials');
        if (trialsEl) trialsEl.innerText = this.trials;

        const modeEl = document.getElementById('hud-mode');
        if (modeEl) modeEl.innerText = i18n.modeName(this.modeId);

        const labels = {
            'hud-time': i18n.t('time'),
            'hud-trials': i18n.t('trials'),
            'hud-accuracy': i18n.t('accuracy'),
            'hud-difficulty': i18n.t('difficulty'),
        };
        Object.entries(labels).forEach(([id, value]) => {
            const label = document.getElementById(id)?.previousElementSibling;
            if (label) label.textContent = value;
        });
    },
    
    // ===== INPUT HANDLERS =====
    
    handleMouseMove(e) {
        if (document.pointerLockElement === canvas) {
            if (this.modeId !== 4) {
                mouseInputAccumulator.x += e.movementX;
                mouseInputAccumulator.y += e.movementY;
            }
        }
        else {
            rawMouseX = e.clientX;
            rawMouseY = e.clientY;
        }
    },
    
    handleMouseDown(e) {
        if (this.phase === 'playing' && this.mode) {
            if (document.pointerLockElement !== canvas) {
                e.preventDefault();
                requestAimPointerLock(canvas);
                return;
            }
            // Add bullet hole on every click
            if (this.modeId !== 3 && this.modeId !== 4) BulletHoles.addFromCrosshair(mouseX, mouseY);
            
            if (e.button === 2) e.preventDefault();
            this.mode.onClick(e.clientX, e.clientY, e.button);
        }
    },
    
    handleKeyDown(e) {
        if (this.phase === 'playing' && this.mode) this.mode.onKeyDown(e.code);
    }
};

document.addEventListener('contextmenu', (e) => { if (GameEngine.phase === 'playing') e.preventDefault(); });
document.addEventListener('visibilitychange', () => {
    if (document.hidden && GameEngine.modeId === 4 && GameEngine.mode?.interrupt) {
        GameEngine.mode.interrupt('page_hidden');
    }
});

// ===== GLOBAL HELPERS FOR BACKWARD COMPATIBILITY =====

// Expose sessionStats globally for mode access
if (!window.hasOwnProperty('sessionStats')) {
    Object.defineProperty(window, 'sessionStats', {
        get: () => GameEngine.sessionStats,
        set: (val) => { GameEngine.sessionStats = val; },
        configurable: true
    });
}

// Global game time accessor
if (!window.hasOwnProperty('gameTime')) {
    Object.defineProperty(window, 'gameTime', {
        get: () => GameEngine.gameTime,
        configurable: true
    });
}

// Global difficulty accessor
if (!window.hasOwnProperty('currentDifficulty')) {
    Object.defineProperty(window, 'currentDifficulty', {
        get: () => GameEngine.difficulty,
        set: (val) => { GameEngine.difficulty = val; },
        configurable: true
    });
}

// Backward compatible startGame
window.startGame = function(mode) {
    GameEngine.startGame(mode);
};

// Global flash effect helper
function flashEffect(type, text) {
    const el = document.getElementById(type === 'penalty' ? 'flash-penalty' : 'flash-warn');
    const txt = document.getElementById(type === 'penalty' ? 'flash-text-penalty' : 'flash-text-warn');
    
    if (el) {
        el.style.opacity = type === 'penalty' ? 0.4 : 0.25;
        setTimeout(() => { el.style.opacity = 0; }, 150);
    }
    
    if (txt && text) {
        txt.innerText = text;
        txt.style.display = 'block';
        txt.style.opacity = 1;
        txt.style.top = '40%';
        txt.style.left = '50%';
        
        setTimeout(() => {
            txt.style.opacity = 0;
            setTimeout(() => { txt.style.display = 'none'; }, 200);
        }, 400);
    }
}
window.flashEffect = flashEffect;

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GameEngine;
}
