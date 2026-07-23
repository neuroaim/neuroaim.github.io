// ==================== MODE 7: HORIZONTAL TRACKING ====================
// Vertical bar left-right tracking mode with Inertial Strafe physics

class VerticalBarTrackingMode extends BaseMode {
    static ID = 7;
    static COLOR = '#ff6600';
    static PARAMS = {
        barWidth:        { min: 50, mid: 30, max: 10 },
        barHeight:       { min: 300, mid: 300, max: 300 },
        moveSpeed:       { min: 2, mid: 10, max: 25 },
        lockTime:        { min: 0.7, mid: 1, max: 1.5 },
        // Note: curveComplexity is less relevant now but kept for compatibility
        curveComplexity: { min: 1, mid: 6, max: 10 }, 
        killTimeout:     2500
    };
    
    init() {
        this.state = {
            target: null,
            trackProgress: 0,
            isLocked: false,
            totalTrackTime: 0,
            
            // Physics State for Inertial Strafing
            currentVx: 0,       // Current velocity (with inertia)
            targetVx: 0,        // Desired velocity (instant)
            moveDir: 1,         // 1 for Right, -1 for Left
            timeToNextChange: 0,// Timer for the next movement decision
            acceleration: 0.25  // Inertia factor: Lower = slippery/heavy, Higher = snappy/responsive
                                // 0.25 simulates a realistic acceleration curve (like Apex/Overwatch)
        };
        this.depthBag = [];
        this.spawnTarget();
    }

    nextDepth() {
        if (!this.depthBag.length) {
            this.depthBag = [
                { band: 'near', min: 10.5, max: 12.5 },
                { band: 'mid', min: 15.5, max: 17.5 },
                { band: 'far', min: 19.5, max: 21.0 }
            ].sort(() => Math.random() - 0.5);
        }
        const selected = this.depthBag.pop();
        return {
            band: selected.band,
            meters: selected.min + Math.random() * (selected.max - selected.min)
        };
    }
    
    spawnTarget() {
        const depth = this.nextDepth();
        const referenceDepth = CFG.rangeProfiles[7].targetDistance;
        const depthRatio = depth.meters / referenceDepth;
        const rangeX = 1440 * depthRatio;
        
        this.state.target = {
            x: (Math.random() - 0.5) * rangeX,
            y: 0,  // Vertical bar centered vertically
            z: WALL_DISTANCE * depthRatio,
            depthMeters: depth.meters,
            depthBand: depth.band,
            depthRatio,
            vx: 0,
            width: this.param('barWidth'),
            height: this.param('barHeight'),
            spawnTime: this.now()
        };
        
        // Reset physics state on spawn
        this.state.currentVx = 0;
        this.state.targetVx = 0;
        this.state.timeToNextChange = 0;
        this.state.moveDir = Math.random() < 0.5 ? 1 : -1;
        
        this.state.trackProgress = 0;
        this.state.isLocked = false;
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
        
        // ==================== NEW: INERTIAL STRAFE LOGIC ====================
        // Simulates realistic AD strafing: Decision -> Inertia -> Movement
        
        this.state.timeToNextChange -= dt;
        
        // 1. Decision Layer (The Brain)
        // Determines WHERE to go next based on random intervals
        if (this.state.timeToNextChange <= 0) {
            // Randomly decide to switch direction (70% chance)
            if (Math.random() < 0.7) {
                this.state.moveDir *= -1;
            }
            
            // Set new Target Velocity (Full speed)
            // Multiplier adds slight variance to walk speed (0.8x to 1.2x)
            const baseSpeed = this.param('moveSpeed') * 2.5 * t.depthRatio;
            const randomSpeedMult = 0.8 + Math.random() * 0.4;
            
            this.state.targetVx = baseSpeed * this.state.moveDir * randomSpeedMult;
            
            // Set time until next decision
            // Short intervals = fast strafes, Long intervals = long tracking
            const minTime = 250;
            const maxTime = 1250;
            this.state.timeToNextChange = minTime + Math.random() * (maxTime - minTime);
        }
        
        // 2. Physics Layer (The Body)
        // Simulates acceleration/deceleration. 
        // We do not instantly snap to targetVx; we interpolate towards it.
        // This gives the "weight" feeling that trains the cerebellum.
        const accel = this.state.acceleration;
        
        // Simple Lerp: current += (target - current) * fraction
        const frameIndependentAlpha = 1 - Math.pow(1 - accel, dt / 16.67);
        this.state.currentVx += (this.state.targetVx - this.state.currentVx) * frameIndependentAlpha;
        
        // 3. Apply Movement
        // Scale by dt/16.67 to maintain consistency with frame rates
        t.x += this.state.currentVx * (dt / 16.67);
        
        // 4. Wall Collisions (with bounce damping)
        const limitX = 720 * t.depthRatio;
        if (t.x < -limitX) {
            t.x = -limitX;
            this.state.moveDir = 1; // Force Right
            this.state.targetVx = Math.abs(this.state.targetVx);
            this.state.currentVx *= -0.5; // Lose 50% kinetic energy on bounce
            this.state.timeToNextChange = 500 + Math.random() * 500;
        }
        if (t.x > limitX) {
            t.x = limitX;
            this.state.moveDir = -1; // Force Left
            this.state.targetVx = -Math.abs(this.state.targetVx);
            this.state.currentVx *= -0.5; // Lose 50% kinetic energy on bounce
            this.state.timeToNextChange = 500 + Math.random() * 500;
        }
        
        // ====================================================================
        
        // Tracking Logic - Only checking X-axis distance
        const res = this.getDistanceFromCrosshair(t.x, t.y, t.z);
        const trackRadius = t.width / 2 + 20;
        const lockTime = this.param('lockTime');
        
        // Note: Since this is a vertical bar, we mostly care about horizontal proximity
        // Using a slightly wider tolerance for the bar shape
        if (res.dist <= trackRadius * 3) { 
            // Progress only increases (accumulates)
            this.state.trackProgress += dt / 1000;
            this.state.totalTrackTime += dt / 1000;
            
            if (this.state.trackProgress >= lockTime) {
                this.state.trackProgress = lockTime;
                this.state.isLocked = true;
                
                // Auto-kill when progress bar is full
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
    }
    
    onClick(x, y) {
        // No click to kill required
        return false;
    }
    
    draw(ctx) {
        this.engine.range.syncMode(7, this.state, this); return;
        const t = this.state.target;
        if (!t) return;

        // Project 3D position to 2D screen
        const p = this.project(t.x, t.y, t.z);
        if (!p.visible) return;
        
        const visualWidth = t.width * p.scale;
        const visualHeight = t.height * p.scale;
        const lockTime = this.param('lockTime');
        const progress = this.state.trackProgress / lockTime;
        
        const barX = p.x - visualWidth / 2;
        const barY = p.y - visualHeight / 2;
        
        // Draw Bar Body
        ctx.fillStyle = this.state.isLocked ? '#ff6600' : `rgba(255, 102, 0, ${0.3 + progress * 0.5})`;
        ctx.fillRect(barX, barY, visualWidth, visualHeight);
        
        // Draw Bar Border
        ctx.strokeStyle = '#ff6600';
        ctx.lineWidth = 2;
        ctx.strokeRect(barX, barY, visualWidth, visualHeight);
        
        // Draw Progress Bar (at the bottom of the target)
        if (progress > 0) {
            const progressBarWidth = visualWidth;
            const progressBarHeight = 8;
            const progressY = barY + visualHeight + 15;
            
            // Progress Background
            ctx.fillStyle = 'rgba(255, 102, 0, 0.3)';
            ctx.fillRect(barX, progressY, progressBarWidth, progressBarHeight);
            
            // Progress Fill
            ctx.fillStyle = this.state.isLocked ? '#ffffff' : '#ff6600';
            ctx.fillRect(barX, progressY, progressBarWidth * progress, progressBarHeight);
            
            // Progress Border
            ctx.strokeStyle = '#ff6600';
            ctx.lineWidth = 1;
            ctx.strokeRect(barX, progressY, progressBarWidth, progressBarHeight);
        }
    }
    
    cleanup() {
        this.state.target = null;
    }
}

ModeRegistry.register(VerticalBarTrackingMode);
