// ==================== MODE 6: COGNITIVE SWITCH (RESTORED) ====================
// Target ACC conflict monitoring and rule flexibility
// EXACT LOGIC RESTORATION: Rule Switching (Cold/Warm), HUD, Warning Text

class CognitiveSwitchMode extends BaseMode {
    static ID = 6;
    static COLOR = '#ff8844';
    static PARAMS = {
        targetSize:      { min: 100, mid: 50, max: 10 },
        moveSpeed:       { min: 5, mid: 30, max: 80 },
        switchInterval:  { min: 10000, mid: 7000, max: 500 },
        warningTime:     { min: 3000, mid: 2000, max: 200 },
        targetFrequency: { min: 1000, mid: 800, max: 100 },
        inhibitionRatio: { min: 0.5, max: 0.5 }
    };
    
    init() {
        this.state = {
            rule: 'cold', // 'cold' = shoot red, 'warm' = shoot green
            switchTimer: this.param('switchInterval'),
            warningActive: false,
            targets: [],
            nextSpawnTimer: 500
        };
    }
    
    spawnTarget() {
        const rangeX = 1440;
        const rangeY = 2000;
        const isInhibit = Math.random() < this.param('inhibitionRatio');
        
        // Rule: COLD (Shoot Red), WARM (Shoot Green)
        // If inhibit, we spawn the WRONG color for the current rule
        // If not inhibit, we spawn the CORRECT color
        
        let color;
        if (this.state.rule === 'cold') {
            // Cold Rule: Red is target. 
            // Inhibit = Green (Don't shoot). Target = Red (Shoot).
            color = isInhibit ? 'green' : 'red';
        } else {
            // Warm Rule: Green is target.
            // Inhibit = Red (Don't shoot). Target = Green (Shoot).
            color = isInhibit ? 'red' : 'green';
        }
        
        const speed = this.param('moveSpeed');
        
        this.state.targets.push({
            x: (Math.random() - 0.5) * rangeX,
            y: (Math.random() - 0.5) * rangeY,
            z: WALL_DISTANCE,
            vx: (Math.random() - 0.5) * speed * 2,
            vy: (Math.random() - 0.5) * speed * 2,
            size: this.param('targetSize'),
            color: color,
            shouldShoot: !isInhibit, // Derived property
            spawnTime: this.now()
        });
    }
    
    update(dt) {
        // 1. Rule Switch Timer
        this.state.switchTimer -= dt;
        
        const warningTime = this.param('warningTime');
        
        // Warning Start
        if (this.state.switchTimer <= warningTime && !this.state.warningActive) {
            this.state.warningActive = true;
            if (typeof playSound === 'function') playSound('lock'); // Warning sound
        }
        
        // Switch Rule
        if (this.state.switchTimer <= 0) {
            this.state.rule = this.state.rule === 'cold' ? 'warm' : 'cold';
            this.state.switchTimer = this.param('switchInterval');
            this.state.warningActive = false;
            
            // Recalculate 'shouldShoot' for existing targets based on NEW rule
            this.state.targets.forEach(t => {
                if (this.state.rule === 'cold') {
                    t.shouldShoot = (t.color === 'red');
                } else {
                    t.shouldShoot = (t.color === 'green');
                }
            });
            
            flashEffect('warn', this.flashText('ruleSwitch'));
            if (typeof playSound === 'function') playSound('click');
        }
        
        // 2. Spawn Timer
        this.state.nextSpawnTimer -= dt;
        if (this.state.nextSpawnTimer <= 0) {
            this.spawnTarget();
            this.state.nextSpawnTimer = this.param('targetFrequency');
        }
        
        // 3. Move Targets
        const limitX = 720;
        const limitY = 1000;
        
        // Update physics
        this.state.targets.forEach(t => {
            t.x += t.vx * (dt / 16.67);
            t.y += t.vy * (dt / 16.67);
            
            // Bounce
            if (t.x < -limitX) { t.x = -limitX; t.vx *= -1; }
            if (t.x > limitX)  { t.x = limitX;  t.vx *= -1; }
            if (t.y < -limitY) { t.y = -limitY; t.vy *= -1; }
            if (t.y > limitY)  { t.y = limitY;  t.vy *= -1; }
        });
        
        // 4. Prune Old Targets
        const now = this.now();
        const newTargets = [];
        this.state.targets.forEach(t => {
            const age = now - t.spawnTime;
            if (age > 4000) {
                // Timeout logic
                if (t.shouldShoot) {
                    this.recordMiss(); // Missed a valid target
                } else {
                    // Successfully ignored a distractor
                    if (this.engine.sessionStats) this.engine.sessionStats.inhibitionSuccess++;
                    this.engine.recordTrial(true); // Small reward for inhibiting? Or just don't punish. 
                    // Original code recorded 'true' for inhibition success.
                }
            } else {
                newTargets.push(t);
            }
        });
        this.state.targets = newTargets;
    }
    
    onClick(x, y) {
        // Reverse iterate to hit top targets first
        for (let i = this.state.targets.length - 1; i >= 0; i--) {
            const t = this.state.targets[i];
            
            const res = this.getDistanceFromCrosshair(t.x, t.y, t.z);
            if (res.dist <= (t.size + 5)) {
                if (t.shouldShoot) {
                    // Correct Hit
                    const rt = this.now() - t.spawnTime;
                    this.recordHit(rt);
                } else {
                    // Wrong Target (Inhibition Fail)
                    this.engine.recordTrial(false);
                    if (this.engine.sessionStats) this.engine.sessionStats.switchErrors++;
                    flashEffect('penalty', this.flashText('wrongTarget'));
                    if (typeof playSound === 'function') playSound('penalty');
                }
                
                // Remove target
                this.state.targets.splice(i, 1);
                return;
            }
        }
    }
    
    draw(ctx) {
        this.engine.range.syncMode(6, this.state, this); return;
        // === HUD: Current Rule ===
        ctx.save();
        const rule = this.state.rule;
        const isWarm = rule === 'warm';
        
        const hudW = 320; 
        const hudH = 50;
        const hudX = canvasWidth / 2 - hudW / 2; 
        const hudY = canvasHeight - 80;
        
        ctx.globalAlpha = 1.0; 
        ctx.fillStyle = 'rgba(10, 15, 20, 0.9)';
        ctx.strokeStyle = isWarm ? '#00ff99' : '#ff3366'; 
        ctx.lineWidth = 3;
        
        // Helper for rounded rect if browser supports, else rect
        if (ctx.roundRect) {
            ctx.beginPath(); ctx.roundRect(hudX, hudY, hudW, hudH, 10); ctx.fill(); ctx.stroke();
        } else {
            ctx.fillRect(hudX, hudY, hudW, hudH); ctx.strokeRect(hudX, hudY, hudW, hudH);
        }
        
        ctx.fillStyle = ctx.strokeStyle; 
        ctx.font = 'bold 20px monospace';
        ctx.textAlign = 'center'; 
        ctx.textBaseline = 'middle';
        
        // Text: "SHOOT GREEN" or "SHOOT RED"
        // TODO: Localize these strings if needed, for now hardcoded to match visual style
        const text = isWarm ? 'SHOOT GREEN' : 'SHOOT RED';
        ctx.fillText(text, canvasWidth / 2, hudY + hudH / 2);
        
        // === WARNING COUNTDOWN ===
        if (this.state.warningActive) {
            const secondsLeft = Math.ceil(this.state.switchTimer / 1000);
            if (secondsLeft > 0 && secondsLeft <= 4) {
                const nextColor = (!isWarm) ? '#00ff99' : '#ff3366';
                ctx.fillStyle = nextColor; 
                ctx.font = 'bold 150px monospace';
                ctx.textAlign = 'center'; 
                ctx.textBaseline = 'middle';
                ctx.shadowColor = nextColor; 
                ctx.shadowBlur = 40;
                
                // Pulse opacity
                const pulse = 0.8 + Math.sin(this.engine.gameTime * 0.02) * 0.2;
                ctx.globalAlpha = pulse;
                
                ctx.fillText(secondsLeft, canvasWidth / 2, canvasHeight / 2 - 200);
            }
        }
        ctx.restore();
        
        // === DRAW TARGETS ===
        this.state.targets.forEach(t => {
            const p = this.project(t.x, t.y, t.z);
            if (p.visible) {
                const c = t.color === 'red' ? '#ff3366' : '#00ff99';
                ctx.beginPath(); 
                ctx.arc(p.x, p.y, t.size * p.scale, 0, Math.PI * 2);
                ctx.fillStyle = c; 
                ctx.shadowColor = c; 
                ctx.shadowBlur = 15 * p.scale;
                ctx.fill(); 
                ctx.shadowBlur = 0;
            }
        });
    }
}

ModeRegistry.register(CognitiveSwitchMode);
