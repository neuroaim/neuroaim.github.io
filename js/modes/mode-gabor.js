// ==================== MODE 1: GABOR SCOUT ====================
// Target V1 orientation selectivity with Gabor patches

class GaborScoutMode extends BaseMode {
    static ID = 1;
    static COLOR = '#00ffcc';
    static PARAMS = {
        targetSize:     { min: 100, mid: 100, max: 100 },
        ringRadius:     { min: 300, mid: 300, max: 300 },
        targetOpacity:  { min: 0.5, mid: 0.02, max: 0.001 },
        contrast:       { min: 0.5, mid: 0.02, max: 0.001 },
        timeout:        { min: 5000, mid: 3000, max: 800 }
    };
    
    init() {
        if (typeof NoiseSystem !== 'undefined') {
            NoiseSystem.setNoiseCount(0);
        }
        this.state = {
            targets: [],
            spawnTime: 0,
            realTargetIndex: -1,
            animationDuration: 500,
            brownianTimer: 0,
            timeout: 0
        };
        this.spawnTargets();
    }
    
    spawnTargets() {
        const ringRadius = this.param('ringRadius');
        const targetSize = this.param('targetSize');
        const targetOpacity = this.param('targetOpacity');
        const timeout = this.param('timeout');
        
        const targets = [];
        const count = 9;
        const realTargetIndex = Math.floor(Math.random() * count);
        
        // Generate targets in a ring around world center
        for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
            targets.push({
                finalX: Math.cos(angle) * ringRadius,
                finalY: Math.sin(angle) * ringRadius,
                currentX: 0,
                currentY: 0,
                z: WALL_DISTANCE,
                size: targetSize,
                isReal: (i === realTargetIndex),
                isVertical: (i === realTargetIndex),
                opacity: targetOpacity,
                brownianX: 0,
                brownianY: 0
            });
        }
        
        this.state.targets = targets;
        this.state.realTargetIndex = realTargetIndex;
        this.state.spawnTime = performance.now();
        this.state.brownianTimer = 0;
        this.state.timeout = timeout;
        this.startTrial();
    }
    
    update(dt) {
        if (!this.state.targets || this.state.targets.length === 0) return;
        
        const elapsed = performance.now() - this.state.spawnTime;
        
        // Timeout check
        if (elapsed > this.state.timeout + this.state.animationDuration) {
            this.recordMiss(this.flashText('timeout'));
            this.spawnTargets();
            return;
        }
        
        // Animation progress
        const animProgress = Math.min(1, elapsed / this.state.animationDuration);
        const ease = 1 - (1 - animProgress) * (1 - animProgress); // Ease out quad
        const brownianActive = animProgress >= 1.0;
        
        // Brownian motion for added difficulty
        if (brownianActive) {
            this.state.brownianTimer += dt;
            if (this.state.brownianTimer > 66) {
                this.state.brownianTimer = 0;
                this.state.targets.forEach(t => {
                    const amp = 2 + Math.random() * 2;
                    const angle = Math.random() * Math.PI * 2;
                    t.brownianX = Math.cos(angle) * amp;
                    t.brownianY = Math.sin(angle) * amp;
                });
            }
        }
        
        // Update target positions (expand from center)
        this.state.targets.forEach(t => {
            const animX = t.finalX * ease;
            const animY = t.finalY * ease;
            t.currentX = animX + (brownianActive ? t.brownianX : 0);
            t.currentY = animY + (brownianActive ? t.brownianY : 0);
        });
    }
    
    onClick(x, y) {
        if (!this.state.targets || this.state.targets.length === 0) return false;
        
        const elapsed = performance.now() - this.state.spawnTime;
        
        // Don't allow clicks during animation
        if (elapsed < this.state.animationDuration * 0.8) return false;
        
        // Check each target - use base class getDistanceFromCrosshair (world space)
        for (let i = 0; i < this.state.targets.length; i++) {
            const t = this.state.targets[i];
            
            // 3D hit detection using base class method (returns world space distance)
            const res = BaseMode.prototype.getDistanceFromCrosshair.call(this, t.currentX, t.currentY, t.z);
            
            if (res.dist <= t.size * 1.3) {
                if (t.isReal) {
                    // Correct target hit
                    let rt = elapsed - this.state.animationDuration;
                    if (rt < 0) rt = 0;
                    this.recordHit(rt);
                    this.spawnTargets();
                } else {
                    // Wrong target
                    this.engine.recordTrial(false);
                    flashEffect('penalty', i18n.t('wrongTarget'));
                    playSound('error');
                    this.spawnTargets();
                }
                return true;
            }
        }
        return false;
    }
    
    draw(ctx) {
        if (!this.state.targets || this.state.targets.length === 0) return;
        
        const elapsed = performance.now() - this.state.spawnTime;
        const animProgress = Math.min(1, elapsed / this.state.animationDuration);
        
        // Draw each Gabor target using global drawGaborPatch function
        this.state.targets.forEach((t, index) => {
            const p = this.project(t.currentX, t.currentY, t.z);
            if (!p.visible) return;
            
            const visualSize = t.size * p.scale;
            
            // Use the global drawGaborPatch function from renderer.js
            if (typeof drawGaborPatch === 'function') {
                drawGaborPatch(ctx, p.x, p.y, visualSize, t.isVertical, t.opacity * animProgress);
            }
        });
    }
    
    cleanup() {
        this.state.targets = [];
    }
}

// Register mode
ModeRegistry.register(GaborScoutMode);