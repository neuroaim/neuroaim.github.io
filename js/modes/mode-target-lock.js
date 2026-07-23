// Mode 4: Target Lock. A 60-second adaptive direction-discrimination drill.
// Response time is retained for QA only and never affects difficulty or score.
class TargetLockMode extends BaseMode {
    static ID = 4;
    static COLOR = '#a97cff';
    static KEY = 'target_lock';
    static PROTOCOL_KEY = 'direction_dynamic_v4';
    static PARAMS = CFG.mode4.params;

    init() {
        this.sessionStartedAt = this.now();
        this.refHz = CFG.mode4.referenceHz;
        this.frameMs = 1000 / this.refHz;
        this.trialLog = [];
        this.scoredTrials = [];
        this.invalidCount = 0;
        this.retryDescriptor = null;
        this.regionBag = [];
        this.probeBag = [];
        this.responses = { left: 0, right: 0 };
        this.peakDifficulty = this.engine.difficulty;
        this.engine.strobeEnabled = false;
        this.engine.range.clearTargets();
        this._syncSessionStats();
        this._beginTrial();
    }

    _shuffle(values) {
        for (let index = values.length - 1; index > 0; index--) {
            const swap = Math.floor(Math.random() * (index + 1));
            [values[index], values[swap]] = [values[swap], values[index]];
        }
        return values;
    }

    _nextProbe() {
        if (!this.probeBag.length) this.probeBag = this._shuffle(['left', 'right']);
        return this.probeBag.pop();
    }

    _nextRegion() {
        if (!this.regionBag.length) this.regionBag = this._shuffle([0, 1, 2, 3, 4, 5, 6, 7]);
        return this.regionBag.pop();
    }

    _peripheralPosition() {
        const width = Math.max(1, window.innerWidth);
        const height = Math.max(1, window.innerHeight);
        const region = this._nextRegion();
        const angle = region * Math.PI / 4;
        const minimumRadius = width * 0.15;
        const horizontalLimit = Math.abs(Math.cos(angle)) < 0.01
            ? width * 0.4
            : width * 0.34 / Math.abs(Math.cos(angle));
        const verticalLimit = Math.abs(Math.sin(angle)) < 0.01
            ? width * 0.4
            : height * 0.31 / Math.abs(Math.sin(angle));
        const maximumRadius = Math.max(minimumRadius, Math.min(width * 0.4, horizontalLimit, verticalLimit));
        const radius = minimumRadius + Math.random() * Math.max(1, maximumRadius - minimumRadius);
        const viewportX = 0.5 + Math.cos(angle) * radius / width;
        const viewportY = 0.5 + Math.sin(angle) * radius / height;
        const scale = 2.15;
        return {
            region,
            viewportX,
            viewportY,
            eccentricityPx: radius,
            world: this.engine.range.viewportDummyPosition(viewportX, viewportY, CFG.mode4.targetDepth, scale),
            scale,
        };
    }

    _normalizedDifficulty() {
        const span = Math.max(0.001, CFG.adaptive.maxLevel - CFG.adaptive.minLevel);
        return Math.max(0, Math.min(1, (this.engine.difficulty - CFG.adaptive.minLevel) / span));
    }

    _descriptor() {
        // Both acquisition delay and probe duration are timed in milliseconds
        // and may use fractional 144 Hz reference frames.
        const delayFrames = Math.max(0.01, this.param('targetDelayFrames'));
        const probeFrames = Math.max(0.01, this.param('probeFrames'));
        return {
            scored: true,
            fixation: 'flashing_dot',
            probe: this._nextProbe(),
            position: this._peripheralPosition(),
            difficultyBefore: this.engine.difficulty,
            complexity: this._normalizedDifficulty(),
            delayFrames,
            delayMs: delayFrames * this.frameMs,
            probeFrames,
            probeMs: probeFrames * this.frameMs,
            decoyCount: Math.max(0, Math.round(this.param('decoyCount'))),
            noiseCount: Math.max(0, Math.round(this.param('noiseCount'))),
            noiseSeed: Math.floor(Math.random() * 0x7fffffff),
            cueDurationMs: 250 + Math.random() * 250,
        };
    }

    _beginTrial() {
        const descriptor = this.retryDescriptor || this._descriptor();
        this.retryDescriptor = null;
        const now = this.now();
        this.trial = {
            ...descriptor,
            phase: 'cue',
            cueOnAt: now,
            phaseAt: now,
            invalid: false,
        };
        this.engine.range.clearTargets();
        this.engine.range.showLockCue();
        this.updateHud();
    }

    _showTarget(now) {
        const trial = this.trial;
        trial.targetOnAt = now;
        trial.phaseAt = now;
        trial.phase = 'orient_delay';
        this.engine.range.hideLockStimuli();
        this.engine.range.showLockDummy(trial.position.world, trial.position.scale);
    }

    _showProbe(now) {
        const trial = this.trial;
        this.engine.range.hide('lock-noise-mask');
        trial.phase = 'probe';
        trial.phaseAt = now;
        trial.probeOnAt = now;
        this.engine.range.showLockProbe(
            trial.position.world,
            trial.probe,
            trial.position.scale,
            trial.decoyCount,
            trial.noiseSeed,
        );
    }

    _showMask(now) {
        const trial = this.trial;
        trial.phase = 'mask';
        trial.phaseAt = now;
        trial.probeOffAt = now;
        trial.maskOnAt = now;
        this.engine.range.showLockMask(
            trial.position.world,
            trial.position.scale,
            trial.noiseCount,
            trial.noiseSeed,
        );
    }

    _openAnswer(now) {
        const trial = this.trial;
        trial.phase = 'answer';
        trial.phaseAt = now;
        trial.maskOffAt = now;
        trial.answerOnAt = now;
        this.engine.range.hideLockStimuli();
    }

    update() {
        const trial = this.trial;
        if (!trial || trial.invalid) return;
        const now = this.now();
        if (trial.phase === 'cue' && now - trial.cueOnAt >= trial.cueDurationMs) {
            this._showTarget(now);
        } else if (trial.phase === 'orient_delay' && now - trial.targetOnAt >= trial.delayMs) {
            this._showProbe(now);
        } else if (trial.phase === 'probe' && now - trial.probeOnAt >= trial.probeMs) {
            this._showMask(now);
        } else if (trial.phase === 'mask' && now - trial.maskOnAt >= CFG.mode4.maskFrames * this.frameMs) {
            this._openAnswer(now);
        } else if (trial.phase === 'cooldown' && now >= trial.nextAt) {
            this._beginTrial();
        }

        if (trial.phase === 'answer' && now - trial.answerOnAt > 10_000) this.invalidate('answer_timeout');
    }

    draw() {
        // Phase visuals are switched at RAF-driven state boundaries.
    }

    onClick(x, y, button = 0) {
        if (!this.trial || this.trial.phase !== 'answer' || ![0, 2].includes(button)) return false;
        this._answer(button === 0 ? 'left' : 'right');
        return true;
    }

    _answer(response) {
        const trial = this.trial;
        const responseAt = this.now();
        const correct = response === trial.probe;
        this.responses[response]++;

        this.engine.recordTrial(correct, null);
        if (typeof playSound === 'function') playSound(correct ? 'hit' : 'miss');
        const difficultyAfter = this.engine.difficulty;
        this.peakDifficulty = Math.max(this.peakDifficulty, difficultyAfter);
        this.scoredTrials.push({
            correct,
            delayFrames: trial.delayFrames,
            delayMs: trial.delayMs,
            probeFrames: trial.probeFrames,
            probeMs: trial.probeMs,
            decoyCount: trial.decoyCount,
            noiseCount: trial.noiseCount,
            difficultyBefore: trial.difficultyBefore,
            difficultyAfter,
        });
        this.trialLog.push({
            stage: 'timed_dynamic',
            scored: true,
            fixation: trial.fixation,
            probe: trial.probe,
            response,
            correct,
            delayFrames: trial.delayFrames,
            delayTargetMs: trial.delayMs,
            delayActualMs: trial.probeOnAt - trial.targetOnAt,
            probeFrames: trial.probeFrames,
            probeTargetMs: trial.probeMs,
            probeActualMs: trial.probeOffAt - trial.probeOnAt,
            decoyCount: trial.decoyCount,
            noiseCount: trial.noiseCount,
            noiseSeed: trial.noiseSeed,
            maskActualMs: trial.maskOffAt - trial.maskOnAt,
            responseTimeMsQA: responseAt - trial.answerOnAt,
            region: trial.position.region,
            viewportX: trial.position.viewportX,
            viewportY: trial.position.viewportY,
            eccentricityPx: trial.position.eccentricityPx,
            difficultyBefore: trial.difficultyBefore,
            difficultyAfter,
            valid: true,
        });

        this.engine.range.hitFeedback(
            this.engine.range._lockHeadPosition(trial.position.world, trial.position.scale),
            correct,
        );
        trial.phase = 'cooldown';
        trial.nextAt = responseAt + 200 + Math.random() * 200;
        this._syncSessionStats();
        this.updateHud();
    }

    invalidate(reason = 'interrupted') {
        const trial = this.trial;
        if (!trial || trial.invalid || trial.phase === 'cooldown') return;
        trial.invalid = true;
        this.invalidCount++;
        this.trialLog.push({
            stage: 'timed_dynamic',
            scored: false,
            valid: false,
            invalidReason: reason,
            probe: trial.probe,
            delayFrames: trial.delayFrames,
            probeFrames: trial.probeFrames,
            decoyCount: trial.decoyCount,
            noiseCount: trial.noiseCount,
            difficultyBefore: trial.difficultyBefore,
            region: trial.position.region,
        });
        this.retryDescriptor = {
            scored: true,
            fixation: trial.fixation,
            probe: trial.probe,
            position: trial.position,
            difficultyBefore: trial.difficultyBefore,
            complexity: trial.complexity,
            delayFrames: trial.delayFrames,
            delayMs: trial.delayMs,
            probeFrames: trial.probeFrames,
            probeMs: trial.probeMs,
            decoyCount: trial.decoyCount,
            noiseCount: trial.noiseCount,
            noiseSeed: trial.noiseSeed,
            cueDurationMs: 250 + Math.random() * 250,
        };
        this.engine.range.clearTargets();
        trial.phase = 'cooldown';
        trial.nextAt = this.now() + 100;
        trial.invalid = false;
    }

    interrupt(reason = 'interrupted') {
        this.invalidate(reason);
    }

    resume() {
        mouseInputAccumulator = { x: 0, y: 0 };
    }

    updateHud() {
        const accuracy = this.engine.trials
            ? `${Math.round(this.engine.hits / this.engine.trials * 100)}%`
            : '100%';
        const values = {
            'hud-time': String(Math.max(0, Math.ceil(this.engine.timeLeft))),
            'hud-trials': String(this.engine.trials),
            'hud-accuracy': accuracy,
            'hud-difficulty': `Lv.${Math.round(this.engine.difficulty * 100)}`,
            'hud-mode': 'TARGET LOCK',
        };
        Object.entries(values).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) element.textContent = value;
        });
        const zh = i18n.current === 'zh';
        const labels = {
            'hud-time': zh ? '时间' : 'TIME',
            'hud-trials': zh ? '尝试' : 'TRIALS',
            'hud-accuracy': zh ? '正确率' : 'ACCURACY',
            'hud-difficulty': zh ? '难度' : 'DIFFICULTY',
        };
        Object.entries(labels).forEach(([id, value]) => {
            const label = document.getElementById(id)?.previousElementSibling;
            if (label) label.textContent = value;
        });
    }

    _average(key) {
        if (!this.scoredTrials.length) return 0;
        return this.scoredTrials.reduce((sum, trial) => sum + (trial[key] || 0), 0) / this.scoredTrials.length;
    }

    _median(key) {
        const values = this.scoredTrials.map(trial => trial[key]).filter(Number.isFinite).sort((a, b) => a - b);
        if (!values.length) return 0;
        const middle = Math.floor(values.length / 2);
        return values.length % 2 ? values[middle] : (values[middle - 1] + values[middle]) / 2;
    }

    _syncSessionStats() {
        const responseTotal = this.responses.left + this.responses.right;
        this.engine.sessionStats.targetLock = {
            schemaVersion: 4,
            modeKey: TargetLockMode.KEY,
            protocolKey: TargetLockMode.PROTOCOL_KEY,
            sessionType: 'timed_dynamic',
            refHz: this.refHz,
            scoredCount: this.scoredTrials.length,
            validFormalTrials: this.scoredTrials.length,
            formalCorrect: this.scoredTrials.filter(trial => trial.correct).length,
            invalidTrials: this.invalidCount,
            averageLockDelayMs: Math.round(this._average('delayMs')),
            medianLockDelayMs: Math.round(this._median('delayMs')),
            averageProbeDurationMs: Math.round(this._average('probeMs')),
            maxNoiseCount: this.scoredTrials.reduce((max, trial) => Math.max(max, trial.noiseCount), 0),
            maxDecoyCount: this.scoredTrials.reduce((max, trial) => Math.max(max, trial.decoyCount), 0),
            peakDifficulty: this.peakDifficulty,
            responseBias: responseTotal
                ? Math.max(this.responses.left, this.responses.right) / responseTotal
                : 0,
            durationMs: Math.round(this.now() - this.sessionStartedAt),
            trialData: this.trialLog,
        };
    }

    finalizeSession() {
        this._syncSessionStats();
    }

    cleanup() {
        if (this.engine.range) this.engine.range.clearTargets();
    }
}

ModeRegistry.register(TargetLockMode);
