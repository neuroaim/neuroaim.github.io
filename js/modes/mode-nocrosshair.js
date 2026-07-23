// ==================== MODE 3: SURGICAL LOCK (SIMPLIFIED) ====================
// Wall-mounted target with no crosshair and persistent shot-origin feedback
// - 1 second timeout
// - Horizontal spawn option
// - Vertical limits

class NoCrosshairMode extends BaseMode {
    static ID = 3;
    static COLOR = '#ffcc00';
    static PARAMS = {
        // Target size
        targetSize: { min: 35, mid: 10, max: 2 },
        
        // Timeout fixed at 1 second
        timeout: { min: 1000, mid: 1000, max: 1000 },
        
        // Horizontal spawn chance (0-1)
        horizontalSpawnChance: { min: 0.7, mid: 0.7, max: 0.7 },
        
        // Vertical range (fraction of wall height)
        verticalRange: { min: 0.15, mid: 0.25, max: 0.35 },
        
        // Horizontal range (fraction of wall width)
        horizontalRange: { min: 0.5, mid: 0.7, max: 0.8 },
        
        // Jump distance
        jumpDistanceMin: { min: 50, mid: 100, max: 300 },
        jumpDistanceMax: { min: 100, mid: 600, max: 900 },

        // Restore the original dependency-removal ramp: fully visible for the
        // first five seconds, then fade smoothly to invisible over three more.
        crosshairFadeStart: { min: 5000, mid: 5000, max: 5000 },
        crosshairFadeEnd: { min: 8000, mid: 8000, max: 8000 }
    };
    
    init() {
        this.disposed = false;
        this.state = {
            target: null,
            gameStartTime: this.now(),
            lastX: 0,
            lastY: 0,
            // Feedback state
            feedback: null  // { x, y, z, size, isHit, startTime }
        };
        
        // Reset crosshair
        if (typeof setCrosshairOpacity === 'function') {
            setCrosshairOpacity(1.0);
        }
        
        // Force hide any flash elements
        const flashTexts = ['flash-text-penalty', 'flash-text-warn'];
        flashTexts.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.style.display = 'none';
                el.style.opacity = '0';
            }
        });
        
        this.spawnTarget();
    }
    
    spawnTarget() {
        const minJump = this.param('jumpDistanceMin') * 0.6;
        const maxJump = this.param('jumpDistanceMax') * 0.6;
        const horizontalChance = this.param('horizontalSpawnChance');
        const verticalRange = this.param('verticalRange');
        const horizontalRange = this.param('horizontalRange');
        
        const bx = this.state.lastX;
        const by = this.state.lastY;
        
        // Bounds - use range parameters with wall dimensions
        const limitX = 900 * horizontalRange;
        const limitY = (WALL_HEIGHT / 2) * verticalRange;
        
        let nx = 0, ny = 0;
        let valid = false;
        
        const isHorizontal = Math.random() < horizontalChance;
        
        // Calculate center bias based on current X position
        // The further from center, the more likely to spawn toward center
        // centerBias: 0.5 = no bias, higher = more likely to go toward center
        const normalizedX = bx / limitX; // -1 to 1
        // Base chance to go toward center: 50% + 40% * |normalizedX|
        // This means at center (x=0): 50% either way
        // At edge (x=limitX): 90% chance to go toward center
        const centerBiasStrength = 0.4;
        const baseCenterChance = 0.5 + centerBiasStrength * Math.abs(normalizedX);
        // Add some randomness to preserve chance of moving away from center
        const centerChance = Math.min(0.85, baseCenterChance); // Cap at 85% to keep some randomness
        
        for (let i = 0; i < 20; i++) {
            const dist = minJump + Math.random() * (maxJump - minJump);
            
            if (isHorizontal) {
                // Strictly horizontal: left or right with center bias
                let dir;
                if (bx > 0) {
                    // Currently on right side, bias toward left (negative)
                    dir = Math.random() < centerChance ? -1 : 1;
                } else if (bx < 0) {
                    // Currently on left side, bias toward right (positive)
                    dir = Math.random() < centerChance ? 1 : -1;
                } else {
                    // At center, 50/50
                    dir = Math.random() < 0.5 ? -1 : 1;
                }
                nx = bx + dir * dist;
                ny = by; // Strictly horizontal, no vertical change
            } else {
                // Any direction, but still apply center bias to X component
                const angle = Math.random() * Math.PI * 2;
                let dx = Math.cos(angle) * dist;
                let dy = Math.sin(angle) * dist;
                
                // Apply center bias to X movement
                if (bx > 0 && dx > 0 && Math.random() < centerChance - 0.5) {
                    dx = -dx; // Flip to go toward center
                } else if (bx < 0 && dx < 0 && Math.random() < centerChance - 0.5) {
                    dx = -dx; // Flip to go toward center
                }
                
                nx = bx + dx;
                ny = by + dy;
            }
            
            // Clamp to bounds
            ny = Math.max(-limitY, Math.min(limitY, ny));
            nx = Math.max(-limitX, Math.min(limitX, nx));
            
            // Check if position is valid (within bounds with some margin)
            if (nx >= -limitX && nx <= limitX) {
                valid = true;
                break;
            }
        }
        
        if (!valid) {
            // Fallback: spawn near center
            nx = (Math.random() - 0.5) * 400;
            ny = (Math.random() - 0.5) * limitY;
        }
        
        this.state.lastX = nx;
        this.state.lastY = ny;
        
        const size = this.param('targetSize');
        const profile = CFG.rangeProfiles[3];
        const depthScale = profile.targetDistance / 8;
        const physicalRadius = 0.38 * (size / 57) * depthScale;
        const wallFront = profile.wallDistance - 0.225;
        const physicalCenterDepth = wallFront - physicalRadius - 0.012;

        this.state.target = {
            x: nx,
            y: ny,
            // Each differently-sized sphere is tangent to the front face of
            // the backstop instead of floating on one arbitrary target plane.
            z: WALL_DISTANCE * physicalCenterDepth / profile.targetDistance,
            size,
            spawnTime: this.now(),
            timeout: this.param('timeout')
        };
        
        this.startTrial();
    }
    
    update(dt) {
        if (this.disposed) return;
        if (typeof setCrosshairOpacity === 'function') {
            const age = this.now() - this.state.gameStartTime;
            const fadeStart = this.param('crosshairFadeStart');
            const fadeEnd = this.param('crosshairFadeEnd');
            const opacity = age <= fadeStart
                ? 1
                : age >= fadeEnd
                    ? 0
                    : 1 - (age - fadeStart) / Math.max(1, fadeEnd - fadeStart);
            setCrosshairOpacity(opacity);
        }
        
        if (this.state.feedback) {
            if (this.now() - this.state.feedback.startTime >= 500) {
                this.state.feedback = null;
                this.spawnTarget();
            }
            return;
        }
        
        const t = this.state.target;
        if (!t) return;
        
        const targetAge = this.now() - t.spawnTime;
        
        // Timeout for current target
        if (targetAge >= t.timeout) {
            console.log('TIMEOUT');
            this.engine.recordTrial(false);
            if (typeof playSound === 'function') playSound('miss');
            
            // Show red feedback
            this.state.feedback = {
                x: t.x,
                y: t.y,
                z: t.z,
                size: t.size,
                isHit: false,
                startTime: this.now()
            };
            this.state.target = null;
            
        }
    }
    
    onClick(x, y) {
        const t = this.state.target;
        if (!t) return;
        
        // If showing feedback, ignore click
        if (this.state.feedback) return;
        
        // Force hide any existing flash IMMEDIATELY (disable transition)
        ['flash-text-penalty', 'flash-text-warn', 'flash-penalty', 'flash-warn'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.style.transition = 'none';
                el.style.display = 'none';
                el.style.opacity = '0';
            }
        });
        
        // Use the same real geometry intersection for both scoring and the
        // visible black impact decal. Hits land on the sphere; misses land on
        // the physical backstop at the exact current sight-line intersection.
        const impact = this.engine.range.showLatestShotImpact();
        const isHit = Boolean(impact?.isHit);
        const res = this.getDistanceFromCrosshair(t.x, t.y, t.z);
        
        console.log(isHit ? 'HIT' : 'MISS', { dist: res.dist.toFixed(0), size: t.size });
        
        // Record result
        if (isHit) {
            const rt = this.now() - t.spawnTime;
            this.engine.recordTrial(true, rt);
            if (typeof playSound === 'function') playSound('hit');
        } else {
            this.engine.recordTrial(false);
            if (typeof playSound === 'function') playSound('miss');
        }
        
        // Set feedback state, keep target position visible for 0.5 seconds
        this.state.feedback = {
            x: t.x,
            y: t.y,
            z: t.z,
            size: t.size,
            isHit: isHit,
            startTime: this.now()
        };
        
        // Clear current target
        this.state.target = null;
        
    }
    
    draw(ctx) {
        this.engine.range.syncMode(3, this.state, this); return;
        // Draw feedback (green for hit, red for miss)
        if (this.state.feedback) {
            const fb = this.state.feedback;
            const p = project3D(fb.x, fb.y, fb.z, this.engine.mouseX, this.engine.mouseY);
            if (p.visible) {
                const radius = fb.size * p.scale;
            const age = this.now() - fb.startTime;
                const alpha = Math.max(0, 1 - age / 500); // Fade out over 0.5 seconds
                
                ctx.save();
                ctx.globalAlpha = alpha;
                
                ctx.beginPath();
                ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
                ctx.fillStyle = fb.isHit ? '#00ff00' : '#ff0000';
                ctx.shadowColor = fb.isHit ? '#00ff00' : '#ff0000';
                ctx.shadowBlur = 15;
                ctx.fill();
                
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 2;
                ctx.shadowBlur = 0;
                ctx.stroke();
                
                ctx.restore();
            }
            return; // Don't draw new target during feedback
        }
        
        // Draw current target
        const t = this.state.target;
        if (!t) return;
        
        const p = project3D(t.x, t.y, t.z, this.engine.mouseX, this.engine.mouseY);
        if (!p.visible) return;
        
        const radius = t.size * p.scale;
        
        ctx.save();
        
        // Simple yellow circle
        ctx.beginPath();
        ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = '#ffcc00';
        ctx.shadowColor = '#ffcc00';
        ctx.shadowBlur = 12;
        ctx.fill();
        
        // White border
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.shadowBlur = 0;
        ctx.stroke();

        const anchorRadius = Math.max(2, radius * 0.15); // small circle at center
        
        ctx.beginPath();
        ctx.arc(p.x, p.y, anchorRadius, 0, Math.PI * 2);

        ctx.fillStyle = '#0033FF'; 
        ctx.fill();
        
        // Outer ring for visibility
        // if (radius > 10) {
        //     ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
        //     ctx.lineWidth = 1;
        //     ctx.stroke();
        // }
        
        ctx.restore();
    }
    
    cleanup() {
        this.disposed = true;
        this.state.target = null;
        this.state.feedback = null;
        if (typeof setCrosshairOpacity === 'function') {
            setCrosshairOpacity(1.0);
        }
    }
}

ModeRegistry.register(NoCrosshairMode);
