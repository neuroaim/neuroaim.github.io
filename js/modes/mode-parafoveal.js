// ==================== MODE 5: PARAFOVEAL GHOST ====================
// Target PPC covert attention and peripheral detection

class ParafovealGhostMode extends BaseMode {
    static ID = 5;
    static COLOR = '#00ccff';
    static PARAMS = {
        primarySize:       { min: 100, mid: 60, max: 10 },
        primarySpeed:      { min: 2, mid: 4, max: 20 },
        ghostSize:         { min: 80, mid: 50, max: 10 },
        ghostDuration:     { min: 1000, mid: 600, max: 100 },
        ghostEccentricity: { min: 300, mid: 500, max: 1000 },
        ghostFrequency:    { min: 1000, mid: 600, max: 100 },
        blueRatio:         { min: 0.7, mid: 0.55, max: 0.4 },
        returnWindow:      { min: 1000, mid: 600, max: 100 },
        hitTolerance:      { min: 80, mid: 50, max: 10 },
        integrityGainRate: { min: 1.5, max: 1.5 },
        integrityLossIdle: { min: 0.8, max: 1.5 },
        integrityLossBlue: { min: 0.3, max: 0.5 },
        integrityLossRed:  { min: 2, max: 5 }
    };
    
    init() {
        this.state = {
            primary: {
                x: 0,
                y: 0,
                size: this.param('primarySize'),
                phase: Math.random() * Math.PI * 2,
                vx: 0,
                vy: 0
            },
            ghost: null,
            ghostTimer: this.param('ghostFrequency'),
            returnTimer: 0,
            trackingPrimary: true,
            integrity: 1.0,
            totalTrackTime: 0
        };
    }
    
    spawnGhost() {
        const eccentricity = this.param('ghostEccentricity');
        const angle = Math.random() * Math.PI * 2;
        const isBlue = Math.random() < this.param('blueRatio');
        
        this.state.ghost = {
            x: Math.cos(angle) * eccentricity,
            y: Math.sin(angle) * eccentricity,
            z: WALL_DISTANCE,
            size: this.param('ghostSize'),
            isBlue: isBlue,
            spawnTime: performance.now(),
            duration: this.param('ghostDuration'),
            hidden: false
        };
        
        this.startTrial();
    }
    
    update(dt) {
        const p = this.state.primary;
        if (!p) return;
        
        // Update primary target movement
        const speed = this.param('primarySpeed');
        const time = performance.now() * 0.001;
        
        p.vx = Math.sin(time * 1.1) * speed + Math.cos(time * 1.7) * speed * 0.5;
        p.vy = Math.cos(time * 0.9) * speed + Math.sin(time * 1.3) * speed * 0.5;
        p.x += p.vx * (dt / 16.67);
        p.y += p.vy * (dt / 16.67);
        
        // Keep primary in center area
        const margin = 200;
        p.x = Math.max(-margin, Math.min(margin, p.x));
        p.y = Math.max(-margin, Math.min(margin, p.y));
        
        // Check if tracking primary
        const res = this.getDistanceFromCrosshair(p.x, p.y, WALL_DISTANCE);
        this.state.trackingPrimary = res.dist <= (p.size + 30);
        
        // Update integrity
        if (this.state.trackingPrimary) {
            const gainRate = this.param('integrityGainRate');
            this.state.integrity = Math.min(1.0, this.state.integrity + dt / 1000 * gainRate);
            this.state.totalTrackTime += dt / 1000;
        } else {
            let lossRate;
            if (!this.state.ghost) {
                lossRate = this.param('integrityLossIdle');
            } else if (this.state.ghost.isBlue) {
                lossRate = this.param('integrityLossBlue');
            } else {
                lossRate = this.param('integrityLossRed');
            }
            this.state.integrity = Math.max(0, this.state.integrity - dt / 1000 * lossRate);
        }
        
        // Spawn ghost timer
        if (!this.state.ghost) {
            this.state.ghostTimer -= dt;
            if (this.state.ghostTimer <= 0) {
                this.spawnGhost();
                this.state.ghostTimer = this.param('ghostFrequency');
            }
        } else {
            // Update ghost
            const g = this.state.ghost;
            const ghostAge = performance.now() - g.spawnTime;
            
            if (ghostAge > g.duration && !g.hidden) {
                g.hidden = true;
            }
            
            if (ghostAge > g.duration) {
                if (g.isBlue) {
                    // Missed blue ghost - fail
                    this.engine.recordTrial(false);
                    flashEffect('warn', i18n.t('missedGhost'));
                    playSound('miss');
                } else {
                    // Successfully ignored red ghost
                    this.engine.recordTrial(true);
                    if (typeof sessionStats !== 'undefined') sessionStats.inhibitionSuccess++;
                }
                this.state.ghost = null;
            }
        }
        
        // Return timer check
        if (this.state.returnTimer > 0) {
            this.state.returnTimer -= dt;
            if (this.state.returnTimer <= 0 && !this.state.trackingPrimary) {
                this.engine.recordTrial(false);
                flashEffect('warn', i18n.t('returnFailed'));
                playSound('error');
            }
        }
    }
    
    onClick(x, y) {
        const g = this.state.ghost;
        if (!g) return false;
        
        // Check if clicking ghost
        const res = this.getDistanceFromCrosshair(g.x, g.y, g.z);
        const tolerance = this.param('hitTolerance');
        
        if (res.dist <= tolerance) {
            if (g.isBlue) {
                // Hit blue ghost - success
                const rt = performance.now() - g.spawnTime;
                
                if (typeof sessionStats !== 'undefined') {
                    if (!sessionStats.trackingTime) sessionStats.trackingTime = 0;
                    sessionStats.trackingTime += this.state.totalTrackTime;
                }
                
                this.recordHit(rt);
                this.state.returnTimer = this.param('returnWindow');
            } else {
                // Hit red ghost - fail (should have inhibited)
                this.engine.recordTrial(false);
                if (typeof sessionStats !== 'undefined') sessionStats.inhibitionFail++;
                flashEffect('penalty', i18n.t('flash.inhibit'));
                playSound('penalty');
            }
            this.state.ghost = null;
            return true;
        }
        
        return false;
    }
    
    draw(ctx) {
        const p = this.state.primary;
        if (!p) return;
        
        // Draw primary target
        const pp = this.project(p.x, p.y, WALL_DISTANCE);
        if (pp.visible) {
            const size = p.size * pp.scale;
            
            // Primary circle
            ctx.beginPath();
            ctx.arc(pp.x, pp.y, size, 0, Math.PI * 2);
            ctx.fillStyle = this.state.trackingPrimary ? 'rgba(0, 204, 255, 0.5)' : 'rgba(0, 204, 255, 0.2)';
            ctx.fill();
            ctx.strokeStyle = this.state.trackingPrimary ? '#00ccff' : '#006688';
            ctx.lineWidth = 3;
            ctx.stroke();
            
            // Integrity bar
            const barWidth = size * 2;
            const barHeight = 8;
            const barY = pp.y + size + 15;
            
            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.fillRect(pp.x - barWidth / 2, barY, barWidth, barHeight);
            
            const integrityColor = this.state.integrity > 0.5 ? '#00ff88' : 
                                   this.state.integrity > 0.25 ? '#ffaa00' : '#ff4444';
            ctx.fillStyle = integrityColor;
            ctx.fillRect(pp.x - barWidth / 2, barY, barWidth * this.state.integrity, barHeight);
            
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1;
            ctx.strokeRect(pp.x - barWidth / 2, barY, barWidth, barHeight);
        }
        
        // Draw ghost
        const g = this.state.ghost;
        if (g && !g.hidden) {
            const gp = this.project(g.x, g.y, g.z);
            if (gp.visible) {
                const size = g.size * gp.scale;
                const age = performance.now() - g.spawnTime;
                const fadeProgress = age / g.duration;
                const alpha = 1 - fadeProgress * 0.5;
                
                // Ghost circle
                ctx.beginPath();
                ctx.arc(gp.x, gp.y, size, 0, Math.PI * 2);
                
                if (g.isBlue) {
                    ctx.fillStyle = `rgba(0, 150, 255, ${alpha * 0.6})`;
                    ctx.strokeStyle = `rgba(0, 200, 255, ${alpha})`;
                } else {
                    ctx.fillStyle = `rgba(255, 50, 50, ${alpha * 0.6})`;
                    ctx.strokeStyle = `rgba(255, 100, 100, ${alpha})`;
                }
                
                ctx.fill();
                ctx.lineWidth = 3;
                ctx.stroke();
                
                // Pulsing effect
                const pulse = Math.sin(performance.now() * 0.01) * 0.2 + 0.8;
                ctx.beginPath();
                ctx.arc(gp.x, gp.y, size * pulse * 1.2, 0, Math.PI * 2);
                ctx.strokeStyle = g.isBlue ? `rgba(0, 200, 255, ${alpha * 0.3})` : `rgba(255, 100, 100, ${alpha * 0.3})`;
                ctx.lineWidth = 2;
                ctx.stroke();
            }
        }
        
        // Return timer indicator
        if (this.state.returnTimer > 0) {
            const returnWindow = this.param('returnWindow');
            const progress = this.state.returnTimer / returnWindow;
            
            ctx.fillStyle = '#ffaa00';
            ctx.font = 'bold 16px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(`RETURN: ${Math.ceil(this.state.returnTimer / 100) / 10}s`, canvasWidth / 2, 80);
        }
    }

    
    cleanup() {
        this.state.ghost = null;
    }
}

ModeRegistry.register(ParafovealGhostMode);
