// ==================== MODE 7: DUAL-STRAFE BALL TRACKING ====================
// Small-ball tracking with deterministic inertial strafing and player sway.

const MODE7_CS_REFERENCE_SPEED = 250;
const MODE7_REFERENCE_HEAD_DIAMETER_LEGACY = 21.2755;
const MODE7_CAMERA_HEIGHT_METERS = 1.65;
const MODE7_TARGET_DEPTH_METERS = 20;

class DualStrafeBallTrackingMode extends BaseMode {
    static ID = 7;
    static COLOR = '#ff6600';
    static PARAMS = {
        // Preserve the existing difficulty curve while making every ball 1.5x
        // larger: Lv30 = 2.25 heads, Lv100 = 1.05 and Lv200 = 0.15.
        targetHeadScale: { min: 363 / 140, mid: 1.05, max: 0.15 },
        csSpeedMultiplier: { min: 0.5, mid: 1.2, max: 3 },
        // Two thirds of the previous 0.7 / 1.0 / 1.5 second thresholds.
        lockTime:        { min: 7 / 15, mid: 2 / 3, max: 1 },
        // Base timing is stretched by oscillationDistanceMultiplier so the
        // target covers more ground without exceeding its CS-calibrated speed.
        oscillationHalfPeriod: { min: 225, mid: 140, max: 90 },
        oscillationDuration:   { min: 450, mid: 420, max: 360 },
        oscillationDistanceMultiplier: { min: 2, mid: 2.25, max: 2.75 },
        traverseDuration:      { min: 200, mid: 230, max: 260 },
        movementPauseDuration: { min: 200, mid: 150, max: 100 },
        acceleration:          { min: 0.28, mid: 0.4, max: 0.58 },
        // The player's lane movement stays close to the spawn point. These
        // values are world metres and full-cycle milliseconds respectively.
        playerSwayAmplitude:   { min: 0.30, mid: 0.55, max: 0.75 },
        playerSwayPeriod:      { min: 1400, mid: 1000, max: 700 },
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
            currentVx: 0,       // Current velocity in CS units per second
            targetVx: 0,        // Desired velocity in CS units per second
            moveDir: 1,         // 1 for Right, -1 for Left
            movementPhase: 'pause',
            phaseTimeRemaining: 0,
            directionTimeRemaining: 0,
            pauseTimeRemaining: 0,
            pendingMovementPhase: 'oscillation',
            pendingMoveDir: 1,
            playerSwayPhase: 0,
            playerLateralOffset: 0
        };
        this.elevationBag = [];
        this.engine.range?.setPlayerLateralOffset(0);
        this.spawnTarget();
    }

    nextElevation() {
        if (!this.elevationBag.length) {
            this.elevationBag = [
                { band: 'low', min: 0.75, max: 1.15 },
                { band: 'mid', min: 1.45, max: 1.90 },
                { band: 'high', min: 2.25, max: 2.85 }
            ].sort(() => Math.random() - 0.5);
        }
        const selected = this.elevationBag.pop();
        return {
            band: selected.band,
            meters: selected.min + Math.random() * (selected.max - selected.min)
        };
    }
    
    spawnTarget() {
        const elevation = this.nextElevation();
        const profile = CFG.rangeProfiles[7];
        const referenceDepth = profile.targetDistance;
        const depthMeters = MODE7_TARGET_DEPTH_METERS;
        const depthRatio = depthMeters / referenceDepth;
        const rangeX = 1440 * depthRatio;
        const headScale = this.param('targetHeadScale');
        const legacyMetersPerUnit = referenceDepth / WALL_DISTANCE;
        
        this.state.target = {
            x: (Math.random() - 0.5) * rangeX,
            y: (MODE7_CAMERA_HEIGHT_METERS - elevation.meters) / legacyMetersPerUnit,
            z: WALL_DISTANCE * depthRatio,
            depthMeters,
            depthBand: 'wall',
            elevationMeters: elevation.meters,
            elevationBand: elevation.band,
            depthRatio,
            vx: 0,
            headScale,
            width: MODE7_REFERENCE_HEAD_DIAMETER_LEGACY * headScale,
            height: MODE7_REFERENCE_HEAD_DIAMETER_LEGACY * headScale,
            spawnTime: this.now()
        };
        
        // Reset physics state on spawn
        this.state.currentVx = 0;
        this.state.targetVx = 0;
        this.state.moveDir = Math.random() < 0.5 ? 1 : -1;
        this.startOscillation();
        
        this.state.trackProgress = 0;
        this.state.isLocked = false;
        this.state.totalTrackTime = 0;
        this.startTrial();
    }

    movementSpeed(target) {
        return MODE7_CS_REFERENCE_SPEED * this.param('csSpeedMultiplier') * target.depthRatio;
    }

    oscillationStrokeDuration() {
        return this.param('oscillationHalfPeriod') * this.param('oscillationDistanceMultiplier');
    }

    oscillationBurstDuration() {
        return this.param('oscillationDuration') * this.param('oscillationDistanceMultiplier');
    }

    setOscillationVelocity(target) {
        this.state.targetVx = this.movementSpeed(target) * this.state.moveDir;
    }

    pauseBeforeMovement(nextPhase, direction) {
        this.state.movementPhase = 'pause';
        this.state.pauseTimeRemaining = this.param('movementPauseDuration');
        this.state.pendingMovementPhase = nextPhase;
        this.state.pendingMoveDir = Math.sign(direction) || 1;
        this.state.targetVx = 0;
    }

    resumeMovement() {
        const nextPhase = this.state.pendingMovementPhase;
        const direction = this.state.pendingMoveDir;
        this.state.pauseTimeRemaining = 0;

        if (nextPhase === 'oscillation-turn') {
            this.state.movementPhase = 'oscillation';
            this.state.moveDir = direction;
            this.state.directionTimeRemaining = this.oscillationStrokeDuration();
            this.setOscillationVelocity(this.state.target);
        } else if (nextPhase === 'traverse') {
            this.startTraverse(direction, false);
        } else {
            this.startOscillation(direction, false);
        }
    }

    startOscillation(forcedDirection = 0, pauseFirst = true) {
        const target = this.state.target;
        if (!target) return;
        const direction = forcedDirection ? Math.sign(forcedDirection) : this.state.moveDir;
        if (pauseFirst) {
            this.pauseBeforeMovement('oscillation', direction);
            return;
        }
        this.state.movementPhase = 'oscillation';
        this.state.phaseTimeRemaining = this.oscillationBurstDuration();
        this.state.directionTimeRemaining = this.oscillationStrokeDuration();
        this.state.moveDir = direction;
        this.setOscillationVelocity(target);
    }

    startTraverse(forcedDirection = 0, pauseFirst = true) {
        const target = this.state.target;
        if (!target) return;
        const limitX = 720 * target.depthRatio;
        let direction = forcedDirection ? Math.sign(forcedDirection) : this.state.moveDir;
        // Travel inward near a wall; otherwise continue the final stroke of
        // the oscillation burst so the phase transition remains readable.
        if (!forcedDirection && target.x > limitX * 0.5) direction = -1;
        else if (!forcedDirection && target.x < -limitX * 0.5) direction = 1;
        if (pauseFirst) {
            this.pauseBeforeMovement('traverse', direction);
            return;
        }

        this.state.movementPhase = 'traverse';
        this.state.phaseTimeRemaining = this.param('traverseDuration');
        this.state.directionTimeRemaining = 0;
        this.state.moveDir = direction;
        this.state.targetVx = this.movementSpeed(target) * this.state.moveDir;
    }

    updateMovementPlan(target, dt) {
        if (this.state.movementPhase === 'pause') {
            this.state.pauseTimeRemaining -= dt;
            this.state.targetVx = 0;
            if (this.state.pauseTimeRemaining <= 0) this.resumeMovement();
            return;
        }

        this.state.phaseTimeRemaining -= dt;

        if (this.state.movementPhase === 'oscillation') {
            this.state.directionTimeRemaining -= dt;
            if (this.state.phaseTimeRemaining <= 0) this.startTraverse();
            else if (this.state.directionTimeRemaining <= 0) {
                this.pauseBeforeMovement('oscillation-turn', -this.state.moveDir);
            }
            return;
        }

        if (this.state.phaseTimeRemaining <= 0) this.startOscillation();
    }
    
    update(dt) {
        const t = this.state.target;
        if (!t) return;

        // Move the player laterally on a bounded sine path. A position curve
        // (instead of accumulating velocity) guarantees the camera never
        // drifts away from the range origin during a long session.
        const swayPeriod = Math.max(1, this.param('playerSwayPeriod'));
        this.state.playerSwayPhase = (
            this.state.playerSwayPhase + Math.PI * 2 * dt / swayPeriod
        ) % (Math.PI * 2);
        this.state.playerLateralOffset = Math.sin(this.state.playerSwayPhase)
            * this.param('playerSwayAmplitude');
        this.engine.range?.setPlayerLateralOffset(this.state.playerLateralOffset);
        
        // Timeout check
        const age = this.now() - t.spawnTime;
        if (age > this.constructor.PARAMS.killTimeout) {
            this.recordMiss(this.flashText('timeout'));
            this.spawnTarget();
            return;
        }
        
        // Fixed cadence: oscillation burst -> horizontal travel -> oscillation.
        // Difficulty shortens the half-period, so each level produces a
        // predictable increase in reversal frequency instead of random turns.
        this.updateMovementPlan(t, dt);
        
        // 2. Physics Layer (The Body)
        // Simulates acceleration/deceleration. 
        // We do not instantly snap to targetVx; we interpolate towards it.
        // This gives the "weight" feeling that trains the cerebellum.
        const accel = this.param('acceleration');
        
        // Simple Lerp: current += (target - current) * fraction
        const frameIndependentAlpha = 1 - Math.pow(1 - accel, dt / 16.67);
        this.state.currentVx += (this.state.targetVx - this.state.currentVx) * frameIndependentAlpha;
        
        // 3. Apply Movement
        // Velocities use CS-style units/second; dt converts them to displacement.
        t.x += this.state.currentVx * (dt / 1000);
        
        // 4. Wall Collisions (with bounce damping)
        const limitX = 720 * t.depthRatio;
        if (t.x < -limitX) {
            t.x = -limitX;
            this.state.currentVx = 0;
            this.startOscillation(1);
        }
        if (t.x > limitX) {
            t.x = limitX;
            this.state.currentVx = 0;
            this.startOscillation(-1);
        }
        
        // ====================================================================
        
        // Sync the current-frame ball before raycasting. Tracking counts only
        // when the center ray intersects the rendered sphere itself.
        let trackingProgressMultiplier = 0;
        if (this.engine.range?.getReticleTargetSilhouettePart) {
            this.engine.range.syncMode(7, this.state, this);
            const targetPart = this.engine.range.getReticleTargetSilhouettePart('m7-ball');
            trackingProgressMultiplier = targetPart === 'target' ? 1 : 0;
        } else {
            const res = this.getDistanceFromCrosshair(t.x, t.y, t.z);
            trackingProgressMultiplier = res.dist <= t.width / 2 ? 1 : 0;
        }
        const lockTime = this.param('lockTime');

        if (trackingProgressMultiplier > 0) {
            this.state.trackProgress += (dt / 1000) * trackingProgressMultiplier;
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
    
    draw() {
        this.engine.range.syncMode(7, this.state, this);
    }
    
    cleanup() {
        this.engine.range?.setPlayerLateralOffset(0);
        this.state.target = null;
    }
}

ModeRegistry.register(DualStrafeBallTrackingMode);
