// ==================== BASE MODE CLASS ====================
// Abstract base class for all training modes

class BaseMode {
    // ===== Static Properties (Override in subclass) =====
    static ID = 0;           // Mode number (1-8)
    static COLOR = '#ffffff'; // Mode theme color
    static PARAMS = {};       // Difficulty parameters {min, mid, max}
    
    /**
     * Constructor
     * @param {Object} engine - Reference to game engine
     */
    constructor(engine) {
        this.engine = engine;
        this.state = {};       // Mode-specific state
        this.startTime = 0;    // Trial start time for RT calculation
    }
    
    // ===== Difficulty Parameter Helper =====
    
    /**
     * Get scaled parameter value based on current difficulty
     * @param {string} key - Parameter name from static PARAMS
     * @returns {number} Interpolated value
     */
    param(key) {
        const paramObj = this.constructor.PARAMS[key];
        if (paramObj === undefined) {
            console.warn(`[${this.constructor.name}] Unknown param: ${key}`);
            return 0;
        }
        return getScaledParam(paramObj, this.engine.difficulty);
    }
    
    // ===== Lifecycle Methods (Override in subclass) =====
    
    /**
     * Initialize mode state. Called when mode starts.
     */
    init() {
        throw new Error('Subclass must implement init()');
    }
    
    /**
     * Update mode logic. Called every frame.
     * @param {number} dt - Delta time in seconds
     */
    update(dt) {
        throw new Error('Subclass must implement update()');
    }
    
    /**
     * Draw mode visuals. Called every frame.
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     */
    draw(ctx) {
        throw new Error('Subclass must implement draw()');
    }
    
    /**
     * Handle mouse click. Return true if click was consumed.
     * @param {number} x - Mouse X in canvas coordinates
     * @param {number} y - Mouse Y in canvas coordinates
     * @returns {boolean} Whether click was handled
     */
    onClick(x, y) {
        return false;
    }
    
    /**
     * Handle key press. Return true if key was consumed.
     * @param {string} key - Key code (e.g., 'KeyW', 'Space')
     * @returns {boolean} Whether key was handled
     */
    onKeyDown(key) {
        return false;
    }
    
    /**
     * Cleanup when mode ends or switches
     */
    cleanup() {
        // Override if needed
    }
    
    // ===== Utility Methods =====
    
    /**
     * Record a successful hit
     * @param {number} reactionTime - RT in milliseconds (optional, auto-calculated if not provided)
     */
    recordHit(reactionTime) {
        const rt = reactionTime || (this.now() - this.startTime);
        this.engine.recordTrial(true, rt);
        playSound('hit');
    }
    
    /**
     * Record a miss/failure
     * @param {string} flashText - Text to show in flash effect (optional)
     */
    recordMiss(flashText) {
        this.engine.recordTrial(false);
        if (flashText) {
            flashEffect('warn', flashText);
        }
        playSound('miss');
    }
    
    /**
     * Start timing a new trial
     */
    startTrial() {
        this.startTime = this.now();
    }
    
    /**
     * Get current trial duration in ms
     * @returns {number} Milliseconds since trial start
     */
    getTrialTime() {
        return this.now() - this.startTime;
    }

    now() {
        return this.engine?.activeNow ? this.engine.activeNow() : performance.now();
    }
    
    /**
     * 3D projection helper
     * @param {number} x - World X
     * @param {number} y - World Y  
     * @param {number} z - World Z (default: WALL_DISTANCE)
     * @returns {Object} {x, y, scale, visible}
     */
    project(x, y, z = WALL_DISTANCE) {
        return project3D(x, y, z, this.engine.mouseX, this.engine.mouseY);
    }
    
    /**
     * Get distance from crosshair ray to a 3D target point (true 3D ray casting)
     * @param {number} targetX - Target world X
     * @param {number} targetY - Target world Y
     * @param {number} targetZ - Target world Z (default: WALL_DISTANCE)
     * @returns {Object} {dist, scale, hitX, hitY} - distance in world units, scale factor, and hit point
     */
    getDistanceFromCrosshair(targetX, targetY, targetZ) {
        const z = targetZ || WALL_DISTANCE;
        
        // Use SENS_FACTOR from config.js (matches Valorant sensitivity)
        const yaw = (this.engine.mouseX || 0) * SENS_FACTOR;
        const pitch = (this.engine.mouseY || 0) * SENS_FACTOR;
        
        // 射线方向（从相机坐标系逆变换到世界坐标系）
        const cosPitch = Math.cos(pitch);
        const sinPitch = Math.sin(pitch);
        const cosYaw = Math.cos(yaw);
        const sinYaw = Math.sin(yaw);
        
        // 射线方向向量
        const rayDirX = cosPitch * sinYaw;
        const rayDirY = sinPitch;
        const rayDirZ = cosPitch * cosYaw;
        
        // 防止除零
        if (Math.abs(rayDirZ) < 0.001) {
            return { dist: 99999, scale: 1, hitX: 0, hitY: 0 };
        }
        
        // 射线与 z=targetZ 平面的交点
        const t = z / rayDirZ;
        const hitX = rayDirX * t;
        const hitY = rayDirY * t;
        
        // 计算交点到目标中心的距离（世界坐标）
        const dist = Math.sqrt((hitX - targetX) ** 2 + (hitY - targetY) ** 2);
        
        // 计算缩放因子
        const scale = (typeof focalLength !== 'undefined' ? focalLength : 600) / z;
        
        return {
            dist: dist,
            scale: scale,
            hitX: hitX,
            hitY: hitY
        };
    }
    
    /**
     * Get crosshair ray hit point on wall (for debugging/visualization)
     * @param {number} wallZ - Wall distance (default: WALL_DISTANCE)
     * @returns {Object} {x, y, z} - hit point in world coordinates
     */
    getCrosshairHitPoint(wallZ) {
        const z = wallZ || WALL_DISTANCE;
        // Use SENS_FACTOR from config.js (matches Valorant sensitivity)
        const yaw = (this.engine.mouseX || 0) * SENS_FACTOR;
        const pitch = (this.engine.mouseY || 0) * SENS_FACTOR;
        
        const cosPitch = Math.cos(pitch);
        const cosYaw = Math.cos(yaw);
        
        if (Math.abs(cosPitch * cosYaw) < 0.001) {
            return { x: 0, y: 0, z: z };
        }
        
        return {
            x: z * Math.tan(yaw),
            y: z * Math.tan(pitch) / cosYaw,
            z: z
        };
    }
    
    /**
     * Check if point is within circular target
     * @param {number} px - Point X
     * @param {number} py - Point Y
     * @param {number} tx - Target center X
     * @param {number} ty - Target center Y
     * @param {number} radius - Target radius
     * @returns {boolean}
     */
    isInCircle(px, py, tx, ty, radius) {
        return getDistance(px, py, tx, ty) <= radius;
    }
    
    /**
     * Generate random position within wall bounds
     * @param {number} margin - Distance from edge (default: 200)
     * @returns {Object} {x, y}
     */
    randomWallPosition(margin = 200) {
        const halfW = WALL_WIDTH / 2 - margin;
        const halfH = WALL_HEIGHT / 2 - margin;
        return {
            x: randomRange(-halfW, halfW),
            y: randomRange(-halfH, halfH)
        };
    }
    
    /**
     * Get localized flash text
     * @param {string} key - Key in flash translations
     * @returns {string}
     */
    flashText(key) {
        return i18n.t(key);
    }
    
    /**
     * Get mode color
     * @returns {string} Hex color
     */
    getColor() {
        return this.constructor.COLOR;
    }
    
    /**
     * Get mode ID
     * @returns {number}
     */
    getId() {
        return this.constructor.ID;
    }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BaseMode;
}
