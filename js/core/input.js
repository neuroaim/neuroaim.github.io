// ==================== INPUT SYSTEM ====================
// Mouse and keyboard input handling with pointer lock

const Input = {
    // Accumulator for smooth mouse movement
    accumulator: { x: 0, y: 0 },
    
    // Pointer lock state
    isLocked: false,
    
    // References
    canvas: null,
    engine: null,
    
    /**
     * Initialize input system
     * @param {HTMLCanvasElement} canvas - Game canvas
     * @param {Object} engine - Game engine reference
     */
    init(canvas, engine) {
        this.canvas = canvas;
        this.engine = engine;
        this.accumulator = { x: 0, y: 0 };
        
        // Mouse movement
        document.addEventListener('mousemove', (e) => this.onMouseMove(e));
        
        // Mouse clicks
        document.addEventListener('mousedown', (e) => this.onMouseDown(e));
        
        // Keyboard
        document.addEventListener('keydown', (e) => this.onKeyDown(e));
        
        // Pointer lock change
        document.addEventListener('pointerlockchange', () => this.onPointerLockChange());
        
        // Click to lock
        canvas.addEventListener('click', () => this.requestLock());
        
        console.log('[Input] Initialized');
    },
    
    /**
     * Request pointer lock on canvas
     */
    requestLock() {
        if (!this.canvas) return;
        
        const phase = this.engine?.phase;
        if (phase === 'playing' || phase === 'countdown') {
            this.canvas.requestPointerLock = this.canvas.requestPointerLock || this.canvas.mozRequestPointerLock;
            if (typeof this.canvas.requestPointerLock === 'function') {
                this.canvas.requestPointerLock();
            }
        }
    },
    
    /**
     * Exit pointer lock
     */
    exitLock() {
        if (document.exitPointerLock) {
            document.exitPointerLock();
        }
    },
    
    /**
     * Handle pointer lock state change
     */
    onPointerLockChange() {
        this.isLocked = document.pointerLockElement === this.canvas;
        
        if (!this.isLocked && this.engine?.phase === 'playing') {
            // Pause game when pointer lock is lost
            if (typeof togglePause === 'function') {
                togglePause();
            }
        }
    },
    
    /**
     * Handle mouse movement
     * @param {MouseEvent} e - Mouse event
     */
    onMouseMove(e) {
        if (!this.isLocked) return;
        
        // Filter out abnormally large jumps (browser quirk on lock)
        if (Math.abs(e.movementX) > 300 || Math.abs(e.movementY) > 300) {
            return;
        }
        
        this.accumulator.x += e.movementX;
        this.accumulator.y += e.movementY;
    },
    
    /**
     * Handle mouse button press
     * @param {MouseEvent} e - Mouse event
     */
    onMouseDown(e) {
        if (this.engine?.phase !== 'playing') return;
        if (e.button !== 0) return; // Left click only
        
        if (this.engine?.mode) {
            this.engine.mode.onClick(e.clientX, e.clientY);
        }
    },
    
    /**
     * Handle keyboard press
     * @param {KeyboardEvent} e - Keyboard event
     */
    onKeyDown(e) {
        // ESC to pause (handled in screens.js)
        if (e.key === 'Escape') {
            return; // Let screens.js handle it
        }
        
        if (this.engine?.phase !== 'playing') return;
        
        if (this.engine?.mode) {
            this.engine.mode.onKeyDown(e.code);
        }
    },
    
    /**
     * Process accumulated input and update camera
     * Call this in game loop
     * @param {number} sensitivity - Mouse sensitivity multiplier
     * @returns {Object} Delta movement {dx, dy}
     */
    processInput(sensitivity = 1.0) {
        const dx = this.accumulator.x * sensitivity;
        const dy = this.accumulator.y * sensitivity;
        
        // Reset accumulator
        this.accumulator.x = 0;
        this.accumulator.y = 0;
        
        return { dx, dy };
    },
    
    /**
     * Reset input state
     */
    reset() {
        this.accumulator = { x: 0, y: 0 };
    }
};

// ===== HELPER FUNCTION =====

/**
 * Try to lock pointer (for UI buttons)
 */
function tryLockPointer() {
    Input.requestLock();
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Input;
}
