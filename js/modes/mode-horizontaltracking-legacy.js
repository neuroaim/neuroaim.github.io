// ==================== MODE 8: ORIGINAL HORIZONTAL TRACKING ====================
// Snapshot of Mode 7 before the deterministic oscillation redesign.

class HorizontalStrafeTrackingMode extends BaseMode {
    static ID = 8;
    static COLOR = '#ff6600';
    static PARAMS = {
        barWidth:        { min: 50, mid: 30, max: 10 },
        barHeight:       { min: 300, mid: 300, max: 300 },
        moveSpeed:       { min: 2, mid: 10, max: 25 },
        lockTime:        { min: 0.7, mid: 1, max: 1.5 },
        curveComplexity: { min: 1, mid: 6, max: 10 },
        killTimeout:     2500
    };

    init() {
        this.state = {
            target: null,
            trackProgress: 0,
            isLocked: false,
            totalTrackTime: 0,
            currentVx: 0,
            targetVx: 0,
            moveDir: 1,
            timeToNextChange: 0,
            acceleration: 0.25
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
        const referenceDepth = CFG.rangeProfiles[8].targetDistance;
        const depthRatio = depth.meters / referenceDepth;
        const rangeX = 1440 * depthRatio;

        this.state.target = {
            x: (Math.random() - 0.5) * rangeX,
            y: 0,
            z: WALL_DISTANCE * depthRatio,
            depthMeters: depth.meters,
            depthBand: depth.band,
            depthRatio,
            vx: 0,
            width: this.param('barWidth'),
            height: this.param('barHeight'),
            spawnTime: this.now()
        };

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
        const target = this.state.target;
        if (!target) return;

        const age = this.now() - target.spawnTime;
        if (age > this.constructor.PARAMS.killTimeout) {
            this.recordMiss(this.flashText('timeout'));
            this.spawnTarget();
            return;
        }

        this.state.timeToNextChange -= dt;
        if (this.state.timeToNextChange <= 0) {
            if (Math.random() < 0.7) this.state.moveDir *= -1;
            const baseSpeed = this.param('moveSpeed') * 2.5 * target.depthRatio;
            const randomSpeedMultiplier = 0.8 + Math.random() * 0.4;
            this.state.targetVx = baseSpeed * this.state.moveDir * randomSpeedMultiplier;
            this.state.timeToNextChange = 250 + Math.random() * 1000;
        }

        const frameIndependentAlpha = 1 - Math.pow(0.75, dt / 16.67);
        this.state.currentVx += (this.state.targetVx - this.state.currentVx) * frameIndependentAlpha;
        target.x += this.state.currentVx * (dt / 16.67);

        const limitX = 720 * target.depthRatio;
        if (target.x < -limitX) {
            target.x = -limitX;
            this.state.moveDir = 1;
            this.state.targetVx = Math.abs(this.state.targetVx);
            this.state.currentVx *= -0.5;
            this.state.timeToNextChange = 500 + Math.random() * 500;
        }
        if (target.x > limitX) {
            target.x = limitX;
            this.state.moveDir = -1;
            this.state.targetVx = -Math.abs(this.state.targetVx);
            this.state.currentVx *= -0.5;
            this.state.timeToNextChange = 500 + Math.random() * 500;
        }

        const result = this.getDistanceFromCrosshair(target.x, target.y, target.z);
        const trackRadius = target.width / 2 + 20;
        const lockTime = this.param('lockTime');
        if (result.dist <= trackRadius * 3) {
            this.state.trackProgress += dt / 1000;
            this.state.totalTrackTime += dt / 1000;
            if (this.state.trackProgress >= lockTime) {
                this.state.trackProgress = lockTime;
                this.state.isLocked = true;
                const reactionTime = this.now() - target.spawnTime;
                if (typeof sessionStats !== 'undefined') {
                    if (!sessionStats.trackingTime) sessionStats.trackingTime = 0;
                    sessionStats.trackingTime += this.state.totalTrackTime;
                }
                this.recordHit(reactionTime);
                this.spawnTarget();
            }
        }
    }

    onClick() {
        return false;
    }

    draw() {
        this.engine.range.syncMode(8, this.state, this);
    }

    cleanup() {
        this.state.target = null;
    }
}

ModeRegistry.register(HorizontalStrafeTrackingMode);
