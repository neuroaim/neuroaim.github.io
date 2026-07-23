// ==================== MODE 5: PERIPHERAL POP ====================
// Single-target acquisition inside a 30-degree total circular FOV cone.

class PeripheralPopMode extends BaseMode {
    static ID = 5;
    static COLOR = '#ffd27a';
    static PARAMS = CFG.mode5.params;

    init() {
        this.state = {
            target: null,
            nextSpawnAt: this.now()
        };
        this.spawnTarget();
    }

    _currentViewBasis() {
        // The 30-degree cone is anchored to the range's original center, not
        // the current mouse/camera direction. Every trial shares this origin.
        return {
            forward: { x: 0, y: 0, z: 1 },
            right: { x: 1, y: 0, z: 0 },
            up: { x: 0, y: 1, z: 0 }
        };
    }

    _sampleDirection(size) {
        const basis = this._currentViewBasis();
        const coneRadius = this.param('fullConeDeg') * Math.PI / 360;
        const targetAngularRadius = Math.atan(Math.max(0, size) / WALL_DISTANCE);
        const maxCenterAngle = Math.max(0, coneRadius - targetAngularRadius);

        for (let attempt = 0; attempt < 20; attempt++) {
            // Uniform solid-angle sampling within the cone.
            const cosAlpha = 1 - Math.random() * (1 - Math.cos(maxCenterAngle));
            const sinAlpha = Math.sqrt(Math.max(0, 1 - cosAlpha * cosAlpha));
            const theta = Math.random() * Math.PI * 2;
            const tangentX = Math.cos(theta) * sinAlpha;
            const tangentY = Math.sin(theta) * sinAlpha;
            const direction = {
                x: basis.forward.x * cosAlpha + basis.right.x * tangentX + basis.up.x * tangentY,
                y: basis.forward.y * cosAlpha + basis.right.y * tangentX + basis.up.y * tangentY,
                z: basis.forward.z * cosAlpha + basis.right.z * tangentX + basis.up.z * tangentY
            };
            if (direction.z > 0.08) return direction;
        }

        // Extreme camera angles can point away from the target plane. Falling
        // back to forward keeps the trial finite without widening the cone.
        return basis.forward.z > 0.08 ? basis.forward : { x: 0, y: 0, z: 1 };
    }

    spawnTarget() {
        const size = this.param('ballSize');
        const direction = this._sampleDirection(size);
        const planeScale = WALL_DISTANCE / Math.max(0.08, direction.z);
        this.state.target = {
            x: direction.x * planeScale,
            y: direction.y * planeScale,
            z: WALL_DISTANCE,
            size,
            lifetime: this.param('dwellMs'),
            spawnTime: this.now()
        };
        this.startTrial();
    }

    _resolve(success, message) {
        const target = this.state.target;
        if (!target) return false;
        const reactionTime = this.now() - target.spawnTime;
        this.state.target = null;
        this.state.nextSpawnAt = this.now() + this.param('respawnDelayMs');
        if (success) this.recordHit(reactionTime);
        else this.recordMiss(message);
        return true;
    }

    update() {
        const target = this.state.target;
        if (!target) {
            if (this.now() >= this.state.nextSpawnAt) this.spawnTarget();
            return;
        }
        if (this.now() - target.spawnTime >= target.lifetime) {
            this._resolve(false, this.flashText('missed'));
        }
    }

    onClick() {
        const target = this.state.target;
        if (!target) return false;
        const result = this.getDistanceFromCrosshair(target.x, target.y, target.z);
        const isHit = result.dist <= target.size;
        return this._resolve(isHit, isHit ? null : this.flashText('missed'));
    }

    draw() {
        this.engine.range.syncMode(5, this.state, this);
    }

    cleanup() {
        this.state.target = null;
    }
}

ModeRegistry.register(PeripheralPopMode);
