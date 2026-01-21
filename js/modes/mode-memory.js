// ==================== MODE 6: MEMORY SEQUENCER (RESTORED) ====================
// Target dlPFC visuospatial working memory
// EXACT LOGIC RESTORATION: Wait -> Display -> Delay -> Reset(Center) -> Recall

class MemorySequencerMode extends BaseMode {
    static ID = 6;
    static COLOR = '#cc66ff';
    static PARAMS = {
        displayTime:       { min: 800, mid: 400, max: 50 },
        delayBeforeRecall: { min: 500, mid: 1500, max: 3000 },
        targetSize:        { min: 100, mid: 70, max: 10 },
        spatialSpread:     { min: 160, mid: 190, max: 300 },
        positionTolerance: { min: 80, mid: 50, max: 5 }
    };
    
    init() {
        this.state = {
            phase: 'waiting', // waiting -> display -> delay -> reset_aim -> recall -> complete -> error
            sequence: [],
            currentIndex: 0,
            displayIndex: 0,
            displayTimer: 0,
            delayTimer: 0,
            spawnTime: 0,
            waitTimer: 1000,
            completeTimer: 0,
            resetTarget: null,
            errorClickPos: null // 记录错误点击位置
        };
    }
    
    generateSequence() {
        const diff = this.engine.difficulty;
        // Sequence Length Logic (i+1)
        let count;
        if (diff < 0.3) count = 1;
        else if (diff < 0.7) count = 2;
        else if (diff < 1.5) count = 3;
        else count = 4;
        
        const params = this.constructor.PARAMS; // Use class params for raw access if needed, but helper exists
        const spread = this.param('spatialSpread');
        const size = this.param('targetSize');
        
        // Generate pool in world space
        const rangeX = 2000; 
        const rangeY = 1200;
        const cx = (Math.random() - 0.5) * rangeX;
        const cy = (Math.random() - 0.5) * rangeY;
        
        const positionPool = [];
        for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 8) {
            positionPool.push({ 
                x: cx + Math.cos(angle) * spread, 
                y: cy + Math.sin(angle) * spread, 
                size: size 
            });
        }
        
        // Shuffle
        for (let i = positionPool.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [positionPool[i], positionPool[j]] = [positionPool[j], positionPool[i]];
        }
        
        // Create sequence
        this.state.sequence = positionPool.slice(0, count).map((p, i) => ({
            x: p.x,
            y: p.y,
            z: WALL_DISTANCE,
            size: p.size,
            index: i
        }));
        
        // Reset counters
        this.state.displayIndex = 0;
        this.state.displayTimer = 0;
        this.state.currentIndex = 0;
        this.state.phase = 'display';
        this.state.spawnTime = performance.now();
    }
    
    update(dt) {
        const s = this.state;
        
        if (s.phase === 'waiting') {
            s.waitTimer -= dt;
            if (s.waitTimer <= 0) this.generateSequence();
            return;
        }
        
        if (s.phase === 'complete') {
            s.completeTimer -= dt;
            if (s.completeTimer <= 0) {
                s.phase = 'waiting';
                s.waitTimer = 1000;
            }
            return;
        }
        
        // 错误反馈阶段 - 与complete使用相同时间
        if (s.phase === 'error') {
            s.completeTimer -= dt;
            if (s.completeTimer <= 0) {
                s.phase = 'waiting';
                s.waitTimer = 1000;
                s.errorClickPos = null;
            }
            return;
        }
        
        if (s.phase === 'display') {
            s.displayTimer += dt;
            const displayTime = this.param('displayTime');
            
            if (s.displayTimer >= displayTime) {
                s.displayTimer = 0;
                s.displayIndex++;
                if (typeof playSound === 'function') playSound('click'); // Metronome tick
                
                if (s.displayIndex >= s.sequence.length) {
                    s.phase = 'delay';
                    s.delayTimer = this.param('delayBeforeRecall');
                }
            }
        } else if (s.phase === 'delay') {
            s.delayTimer -= dt;
            if (s.delayTimer <= 0) {
                s.phase = 'reset_aim';
                // Define reset target at center
                s.resetTarget = { x: 0, y: 0, z: WALL_DISTANCE, size: 30 };
            }
        }
    }
    
    onClick(x, y) {
        const s = this.state;
        
        // 1. Reset Phase: Click Center to Start Recall
        if (s.phase === 'reset_aim') {
            const res = this.getDistanceFromCrosshair(0, 0, WALL_DISTANCE);
            // Visual size roughly 160 scaled (from draw logic)
            if (res.dist <= 160) {
                if (typeof playSound === 'function') playSound('click');
                s.phase = 'recall';
                s.currentIndex = 0;
            }
            return;
        }
        
        // 2. Recall Phase: Click Targets in Order
        if (s.phase !== 'recall') return;
        
        // Ignore clicks on center area (attention reset zone)
        const centerRes = this.getDistanceFromCrosshair(0, 0, WALL_DISTANCE);
        if (centerRes.dist <= 160) {
            // Click on center is ignored - player is resetting attention
            return;
        }
        
        const target = s.sequence[s.currentIndex];
        if (!target) return;
        
        const res = this.getDistanceFromCrosshair(target.x, target.y, target.z);
        const tolerance = this.param('positionTolerance');
        const hitRadius = Math.max(target.size, tolerance);
        
        if (res.dist <= hitRadius) {
            // Correct Hit
            s.currentIndex++;
            if (typeof playSound === 'function') playSound('hit');
            
            // Sequence Complete
            if (s.currentIndex >= s.sequence.length) {
                const rt = performance.now() - s.spawnTime;
                this.recordHit(rt); // Records trial success
                if (this.engine.sessionStats) this.engine.sessionStats.perfectTrials++;
                s.phase = 'complete';
                s.completeTimer = 500;
            }
        } else {
            // Miss / Wrong Order - 记录错误点击位置并进入错误显示阶段
            this.engine.recordTrial(false);
            if (this.engine.sessionStats) this.engine.sessionStats.sequenceErrors++;
            flashEffect('penalty', this.flashText('wrongOrder')); // "WRONG ORDER"
            if (typeof playSound === 'function') playSound('error');
            
            // 保存错误点击的屏幕位置用于显示
            s.errorClickPos = { x: x, y: y };
            s.phase = 'error';
            s.completeTimer = 500; // 与成功相同的停留时间
        }
    }
    
    draw(ctx) {
        const s = this.state;
        
        // === COMPLETE FEEDBACK (成功 - 绿色) ===
        if (s.phase === 'complete') {
            const seq = s.sequence;
            for (let i = 0; i < seq.length; i++) {
                const t = seq[i];
                const p = this.project(t.x, t.y, t.z);
                if (p.visible) {
                    ctx.beginPath(); ctx.arc(p.x, p.y, t.size * p.scale, 0, Math.PI * 2);
                    ctx.fillStyle = 'rgba(0, 255, 150, 0.5)'; ctx.fill();
                    ctx.fillStyle = '#fff'; 
                    ctx.font = (24 * p.scale) + 'px monospace';
                    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                    ctx.fillText(i + 1, p.x, p.y);
                }
            }
            ctx.font = 'bold 32px monospace'; ctx.fillStyle = '#00ff99';
            ctx.textAlign = 'center'; 
            ctx.fillText(this.flashText('sequenceComplete'), canvasWidth / 2, canvasHeight / 2 - 100);
            return;
        }
        
        // === ERROR FEEDBACK (错误 - 红色) ===
        if (s.phase === 'error') {
            const seq = s.sequence;
            // 显示所有目标位置（红色）
            for (let i = 0; i < seq.length; i++) {
                const t = seq[i];
                const p = this.project(t.x, t.y, t.z);
                if (p.visible) {
                    ctx.beginPath(); ctx.arc(p.x, p.y, t.size * p.scale, 0, Math.PI * 2);
                    ctx.fillStyle = 'rgba(255, 80, 80, 0.5)'; ctx.fill();
                    ctx.strokeStyle = 'rgba(255, 80, 80, 0.8)';
                    ctx.lineWidth = 2;
                    ctx.stroke();
                    ctx.fillStyle = '#fff'; 
                    ctx.font = (24 * p.scale) + 'px monospace';
                    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                    ctx.fillText(i + 1, p.x, p.y);
                }
            }
            // 显示错误点击位置的X标记
            if (s.errorClickPos) {
                const ex = s.errorClickPos.x;
                const ey = s.errorClickPos.y;
                const crossSize = 20;
                ctx.strokeStyle = '#ff3333';
                ctx.lineWidth = 4;
                ctx.beginPath();
                ctx.moveTo(ex - crossSize, ey - crossSize);
                ctx.lineTo(ex + crossSize, ey + crossSize);
                ctx.moveTo(ex + crossSize, ey - crossSize);
                ctx.lineTo(ex - crossSize, ey + crossSize);
                ctx.stroke();
            }
            return;
        }
        
        // === RESET AIM (CENTER SHOOT) ===
        if (s.phase === 'reset_aim' || s.phase === 'delay') {
            const p = this.project(0, 0, WALL_DISTANCE);
            if (p.visible) {
                if (s.phase === 'reset_aim') {
                    // Draw "SHOOT" Ball
                    const drawRadius = (50 / 0.42) * p.scale; // Approx 120
                    ctx.beginPath(); ctx.arc(p.x, p.y, drawRadius, 0, Math.PI * 2);
                    ctx.fillStyle = '#ffcc00'; ctx.shadowColor = '#ffcc00'; ctx.shadowBlur = 30; ctx.fill();
                    ctx.shadowBlur = 0;
                    ctx.font = 'bold ' + (40 * p.scale) + 'px monospace'; ctx.fillStyle = '#000';
                    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                    ctx.fillText(this.flashText('shoot'), p.x, p.y);
                } else {
                    // Draw "RECALL IN..." text
                    ctx.font = (40 * p.scale) + 'px monospace'; ctx.fillStyle = '#ffcc00';
                    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                    ctx.fillText(this.flashText('recallIn'), p.x, p.y);
                }
            }
            return;
        }
        
        // === DISPLAY & RECALL ===
        if (s.phase === 'display' || s.phase === 'recall') {
            // Draw currently visible target in sequence
            if (s.phase === 'display' && s.displayIndex < s.sequence.length) {
                const t = s.sequence[s.displayIndex];
                const p = this.project(t.x, t.y, t.z);
                if (p.visible) {
                    ctx.beginPath(); ctx.arc(p.x, p.y, t.size * p.scale, 0, Math.PI * 2);
                    ctx.fillStyle = '#00d9ff'; ctx.shadowColor = '#00d9ff'; ctx.shadowBlur = 30 * p.scale; ctx.fill();
                    ctx.shadowBlur = 0;
                    ctx.fillStyle = '#000'; ctx.font = 'bold ' + (40 * p.scale) + 'px monospace';
                    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                    ctx.fillText(s.displayIndex + 1, p.x, p.y);
                }
            }
            // Draw already recalled targets (ghosts)
            else if (s.phase === 'recall') {
                for (let i = 0; i < s.sequence.length; i++) {
                    const t = s.sequence[i];
                    if (i < s.currentIndex) {
                        const p = this.project(t.x, t.y, t.z);
                        if (p.visible) {
                            ctx.beginPath(); ctx.arc(p.x, p.y, t.size * p.scale, 0, Math.PI * 2);
                            ctx.fillStyle = 'rgba(0, 255, 150, 0.3)'; ctx.fill();
                        }
                    }
                }
            }
        }
    }
}

ModeRegistry.register(MemorySequencerMode);