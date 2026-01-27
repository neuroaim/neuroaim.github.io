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
            errorClickPos: null, // Records error click position for visual feedback
            lastClickTime: 0     // [ADDED] Timer for input debounce
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
        
        const params = this.constructor.PARAMS;
        const spread = this.param('spatialSpread');
        const size = this.param('targetSize');
        
        // Generate pool in world space
        const rangeX = 2000; 
        const rangeY = 1200;
        
        let finalSequence = [];
        let attempts = 0;
        
        // [FIX] Loop to ensure we get a valid sequence where ALL targets are outside the danger zone
        // We need 'count' valid targets. If a batch fails, we retry with a new center.
        while (finalSequence.length < count && attempts < 20) {
            attempts++;
            
            // 1. Pick a random center for the cluster
            const cx = (Math.random() - 0.5) * rangeX;
            const cy = (Math.random() - 0.5) * rangeY;
            
            // 2. Generate candidate points around the center
            const candidates = [];
            for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 8) {
                const px = cx + Math.cos(angle) * spread;
                const py = cy + Math.sin(angle) * spread;
                
                // [FIX] Crucial Check: Ensure target is far enough from center (0,0)
                // The reset click zone is 160 radius. We use 200 to be safe.
                if (Math.sqrt(px * px + py * py) > 200) {
                    candidates.push({ 
                        x: px, 
                        y: py, 
                        size: size 
                    });
                }
            }
            
            // 3. Do we have enough valid candidates?
            if (candidates.length >= count) {
                // Shuffle candidates
                for (let i = candidates.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
                }
                
                // Select the first 'count' items
                finalSequence = candidates.slice(0, count).map((p, i) => ({
                    x: p.x,
                    y: p.y,
                    z: WALL_DISTANCE,
                    size: p.size,
                    index: i
                }));
            }
            // If not enough candidates, loop continues to try a new center position
        }
        
        // Fallback if random generation fails repeatedly (extremely rare)
        if (finalSequence.length === 0) {
            console.warn("[MemoryMode] Fallback sequence used");
            for (let i = 0; i < count; i++) {
                finalSequence.push({
                    x: 600 + i * 150, // Safe position on the right
                    y: 0,
                    z: WALL_DISTANCE,
                    size: size,
                    index: i
                });
            }
        }
        
        this.state.sequence = finalSequence;
        
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
        
        // Error Feedback Phase - Same duration as complete
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
        const now = performance.now();

        // [FIX] Debounce: Ignore clicks if too close to the previous one (< 100ms)
        // This prevents double-clicks from registering as a hit on index N and immediate miss on index N+1
        if (now - (s.lastClickTime || 0) < 100) return;
        
        // 1. Reset Phase: Click Center to Start Recall
        if (s.phase === 'reset_aim') {
            const res = this.getDistanceFromCrosshair(0, 0, WALL_DISTANCE);
            // Visual size roughly 160 scaled (from draw logic)
            if (res.dist <= 160) {
                if (typeof playSound === 'function') playSound('click');
                s.phase = 'recall';
                s.currentIndex = 0;
                s.lastClickTime = now;
            }
            return;
        }
        
        // 2. Recall Phase: Click Targets in Order
        if (s.phase !== 'recall') return;
        
        const target = s.sequence[s.currentIndex];
        if (!target) return;
        
        const res = this.getDistanceFromCrosshair(target.x, target.y, target.z);
        const tolerance = this.param('positionTolerance');
        const hitRadius = Math.max(target.size, tolerance);
        
        // [FIX] Check HIT condition FIRST.
        // We must prioritize a valid target hit over the center "ignore" zone.
        if (res.dist <= hitRadius) {
            // Correct Hit
            s.currentIndex++;
            s.lastClickTime = now; // Update timer
            if (typeof playSound === 'function') playSound('hit');
            
            // Sequence Complete
            if (s.currentIndex >= s.sequence.length) {
                const rt = performance.now() - s.spawnTime;
                this.recordHit(rt); // Records trial success
                if (this.engine.sessionStats) this.engine.sessionStats.perfectTrials++;
                s.phase = 'complete';
                s.completeTimer = 500;
            }
            return; // Exit here, do not check failure conditions
        }

        // [FIX] Check Ignore Zone SECOND.
        // If the player clicked near the center (Reset Zone) but NOT on a target, ignore it.
        // This allows players to re-center their mouse without penalty if needed.
        const centerRes = this.getDistanceFromCrosshair(0, 0, WALL_DISTANCE);
        if (centerRes.dist <= 160) {
            return;
        }

        // [FIX] Miss / Wrong Order
        // If it wasn't a hit, and it wasn't in the safe zone, it's an error.
        this.engine.recordTrial(false);
        if (this.engine.sessionStats) this.engine.sessionStats.sequenceErrors++;
        flashEffect('penalty', this.flashText('wrongOrder')); // "WRONG ORDER"
        if (typeof playSound === 'function') playSound('error');
        
        // Save error position for rendering X mark
        s.errorClickPos = { x: x, y: y };
        s.phase = 'error';
        s.completeTimer = 500; // Display error for same duration as success
        s.lastClickTime = now;
    }
    
    draw(ctx) {
        const s = this.state;
        
        // === COMPLETE FEEDBACK (Success - Green) ===
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
        
        // === ERROR FEEDBACK (Failure - Red) ===
        if (s.phase === 'error') {
            const seq = s.sequence;
            // Show all target positions (Red)
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
            // Show X mark at click position
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