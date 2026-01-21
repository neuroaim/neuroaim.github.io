// ==================== MODE 4: LANDOLT SACCADE ====================
// Target saccadic discrimination and visuomotor integration

class LandoltSaccadeMode extends BaseMode {
    static ID = 4;
    static COLOR = '#ff6699';
    static PARAMS = {
        ringSize:     { min: 50, mid: 15, max: 1 },
        contrast:     { min: 1.0, mid: 0.6, max: 0.01 },
        timeout:      { min: 2000, mid: 600, max: 100 },
        eccentricity: { min: 150, mid: 300, max: 480 }
    };
    
    init() {
        this.state = {
            phase: 'reset', // 'reset' or 'target'
            target: null
        };
    }
    
    spawnTarget() {
        const eccentricity = this.param('eccentricity');
        const angle = Math.random() * Math.PI * 2;
        
        this.state.target = {
            x: Math.cos(angle) * eccentricity,
            y: Math.sin(angle) * eccentricity,
            z: WALL_DISTANCE,
            size: this.param('ringSize'),
            contrast: this.param('contrast'),
            gapDir: Math.floor(Math.random() * 4), // 0=top, 1=left, 2=bottom, 3=right
            timeout: this.param('timeout'),
            spawnTime: performance.now()
        };
        this.state.phase = 'target';
        this.startTrial();
    }
    
    update(dt) {
        if (this.state.phase !== 'target' || !this.state.target) return;
        
        const age = performance.now() - this.state.target.spawnTime;
        if (age > this.state.target.timeout) {
            this.recordMiss(this.flashText('timeout'));
            this.state.phase = 'reset';
            this.state.target = null;
        }
    }
    
    onClick(x, y) {
        if (this.state.phase === 'reset') {
            // Click center to spawn target - use base class method (world space)
            const res = BaseMode.prototype.getDistanceFromCrosshair.call(this, 0, 0, WALL_DISTANCE);
            
            // Center trigger radius in world units
            if (res.dist <= 180) {
                playSound('click');
                this.spawnTarget();
                return true;
            }
        }
        return false;
    }
    
    onKeyDown(key) {
        if (this.state.phase !== 'target' || !this.state.target) return false;
        
        // Map key to direction
        let dir = -1;
        if (key === 'KeyW' || key === 'ArrowUp') dir = 0;    // top
        if (key === 'KeyA' || key === 'ArrowLeft') dir = 1;  // left
        if (key === 'KeyS' || key === 'ArrowDown') dir = 2;  // bottom
        if (key === 'KeyD' || key === 'ArrowRight') dir = 3; // right
        
        if (dir === -1) return false;
        
        const t = this.state.target;
        
        // Check if aiming at target - use base class method (world space)
        const res = BaseMode.prototype.getDistanceFromCrosshair.call(this, t.x, t.y, t.z);
        const hoverRadius = t.size * 2;
        
        if (res.dist <= hoverRadius) {
            if (dir === t.gapDir) {
                // Correct direction
                const rt = performance.now() - t.spawnTime;
                this.recordHit(rt);
            } else {
                // Wrong direction
                this.engine.recordTrial(false);
                flashEffect('warn', i18n.t('wrong'));
                playSound('error');
            }
            this.state.phase = 'reset';
            this.state.target = null;
        } else {
            flashEffect('warn', i18n.t('aimFirst'));
        }
        
        return true;
    }
    
    draw(ctx) {
        if (this.state.phase === 'reset') {
            // Draw center trigger ball
            const p = this.project(0, 0, WALL_DISTANCE);
            if (p.visible) {
                const baseRadius = 180 * p.scale;
                
                // Pulsing effect
                const pulse = Math.sin(performance.now() * 0.003) * 0.1 + 0.9;
                
                ctx.beginPath();
                ctx.arc(p.x, p.y, baseRadius * pulse, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(255, 102, 153, 0.3)';
                ctx.fill();
                ctx.strokeStyle = '#ff6699';
                ctx.lineWidth = 3;
                ctx.stroke();
                
                // Click instruction
                ctx.fillStyle = '#ffffff';
                ctx.font = 'bold 18px monospace';
                ctx.textAlign = 'center';
                ctx.fillText('CLICK', p.x, p.y + 5);
            }
            return;
        }
        
        // Draw Landolt C target
        const t = this.state.target;
        if (!t) return;
        
        const p = this.project(t.x, t.y, t.z);
        if (!p.visible) return;
        
        const size = t.size * p.scale;
        const contrast = t.contrast;
        
        // Draw ring with gap
        ctx.strokeStyle = `rgba(255, 255, 255, ${contrast})`;
        ctx.lineWidth = Math.max(2, size * 0.3);
        
        // Gap direction: 0=top, 1=left, 2=bottom, 3=right
        const gapAngle = [
            -Math.PI / 2,  // top
            Math.PI,       // left
            Math.PI / 2,   // bottom
            0              // right
        ][t.gapDir];
        
        const gapSize = Math.PI / 4; // 45 degree gap
        
        ctx.beginPath();
        ctx.arc(p.x, p.y, size, gapAngle + gapSize / 2, gapAngle + Math.PI * 2 - gapSize / 2);
        ctx.stroke();
        
        // Direction hint arrows (small, subtle)
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.font = '12px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('W', p.x, p.y - size - 20);
        ctx.fillText('S', p.x, p.y + size + 28);
        ctx.fillText('A', p.x - size - 20, p.y + 4);
        ctx.fillText('D', p.x + size + 20, p.y + 4);
        
        // Timeout indicator
        const age = performance.now() - t.spawnTime;
        const timeLeft = 1 - (age / t.timeout);
        
        if (timeLeft < 0.5) {
            ctx.strokeStyle = `rgba(255, 0, 0, ${(0.5 - timeLeft) * 2})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(p.x, p.y, size + 15, 0, Math.PI * 2);
            ctx.stroke();
        }
    }
    
    cleanup() {
        this.state.target = null;
        this.state.phase = 'reset';
    }
}

ModeRegistry.register(LandoltSaccadeMode);