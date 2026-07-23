// ==================== MODE 2: PURE TRACKING ====================
// Target cerebellum predictive motion tracking

class PureTrackingMode extends BaseMode {
    static ID = 2;
    static COLOR = '#00ff99';
    static PARAMS = {
        targetSize:      { min: 100, mid: 70, max: 3 },
        moveSpeed:       { min: 4, mid: 20, max: 50 },
        lockTime:        { min: 0.5, mid: 1.2, max: 3 },
        afterGazeTime:   { min: 300, mid: 300, max: 300 },
        gazeRadius:      { min: 100, mid: 70, max: 3 },
        curveComplexity: { min: 1, mid: 3, max: 6 },
        killTimeout:     3500
    };
    
    init() {
        this.state = {
            target: null,
            trackProgress: 0,
            isLocked: false,
            afterGaze: null,
            totalTrackTime: 0
        };
        this.spawnTarget();
    }
    
    spawnTarget() {
        const rangeX = 1440;
        const rangeY = 2000;
        
        this.state.target = {
            x: (Math.random() - 0.5) * rangeX,
            y: (Math.random() - 0.5) * rangeY,
            z: WALL_DISTANCE,
            vx: 0,
            vy: 0,
            size: this.param('targetSize'),
            phase: Math.random() * Math.PI * 2,
            spawnTime: this.now()
        };
        this.state.trackProgress = 0;
        this.state.isLocked = false;
        this.state.afterGaze = null;
        this.state.totalTrackTime = 0;
        this.startTrial();
    }
    
    update(dt) {
        const t = this.state.target;
        if (!t) return;
        
        
        // Timeout check
        const age = this.now() - t.spawnTime;
        if (age > this.constructor.PARAMS.killTimeout) {
            this.recordMiss(this.flashText('timeout'));
            this.spawnTarget();
            return;
        }
        
        // Organic Lissajous movement
        const speed = this.param('moveSpeed');
        const complexity = this.param('curveComplexity');
        const time = this.now() * 0.001;
        
        t.vx = Math.sin(time * 1.3 * complexity) * speed + Math.cos(time * 2.1) * speed * 0.5;
        t.vy = Math.cos(time * 1.1 * complexity) * speed + Math.sin(time * 2.7) * speed * 0.5;
        t.x += t.vx * (dt / 16.67);
        t.y += t.vy * (dt / 16.67);
        
        // Wall bounce
        const limitX = 720;
        const limitY = 1000;
        if (t.x < -limitX) { t.x = -limitX; t.vx *= -1; }
        if (t.x > limitX)  { t.x = limitX;  t.vx *= -1; }
        if (t.y < -limitY) { t.y = -limitY; t.vy *= -1; }
        if (t.y > limitY)  { t.y = limitY;  t.vy *= -1; }
        
        // Tracking logic
        const res = this.getDistanceFromCrosshair(t.x, t.y, t.z);
        const visualSize = t.size * res.scale;
        const trackRadius = t.size + 20;
        const lockTime = this.param('lockTime');
        
        if (res.dist <= trackRadius) {
            // 只增不减：在追踪范围内时增加进度
            this.state.trackProgress += dt / 1000;
            this.state.totalTrackTime += dt / 1000;
            if (this.state.trackProgress >= lockTime) {
                this.state.trackProgress = lockTime;
                this.state.isLocked = true;
                
                // 进度条读完自动击杀
                const rt = this.now() - t.spawnTime;
                
                // Track statistics
                if (typeof sessionStats !== 'undefined') {
                    if (!sessionStats.trackingTime) sessionStats.trackingTime = 0;
                    sessionStats.trackingTime += this.state.totalTrackTime;
                }
                
                this.recordHit(rt);
                this.spawnTarget();
                return;
            }
        }
        // 移除了进度减少逻辑，进度条只增不减
    }
    
    onClick(x, y) {
        // 不再需要点击击杀，此方法保留但不执行任何操作
        return false;
    }
    
    draw(ctx) {
        this.engine.range.syncMode(2, this.state, this); return;
        const t = this.state.target;
        if (!t) return;

        
        // Draw target
        const p = this.project(t.x, t.y, t.z);
        if (!p.visible) return;
        
        const visualSize = t.size * p.scale;
        const lockTime = this.param('lockTime');
        const progress = this.state.trackProgress / lockTime;
        
        // Target circle
        ctx.beginPath();
        ctx.arc(p.x, p.y, visualSize, 0, Math.PI * 2);
        ctx.fillStyle = this.state.isLocked ? '#00ff99' : `rgba(0, 255, 153, ${0.3 + progress * 0.4})`;
        ctx.fill();
        
        // Progress ring
        if (progress > 0) {
            ctx.strokeStyle = this.state.isLocked ? '#ffffff' : '#00ff99';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.arc(p.x, p.y, visualSize + 8, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
            ctx.stroke();
        }
        
        // 移除 LOCKED 文字提示，因为锁定后会立即击杀
    }
    
    
    cleanup() {
        this.state.target = null;
        this.state.afterGaze = null;
    }
}

ModeRegistry.register(PureTrackingMode);
