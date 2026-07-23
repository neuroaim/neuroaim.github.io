// ==================== GLOBAL CONFIGURATION ====================
// Shared constants and utility functions

const CFG = {
    // Session
    sessionDuration: 60,
    
    // Wall (3D scene)
    wall: {
        distance: 1200,
        width: 3000,
        height: 2000
    },

    // Compact FPS practice-room layout (metres). Each mode constrains its own
    // spawn envelope so targets remain inside these ordinary room walls.
    rangeProfiles: {
        1: { targetDistance: 12, wallDistance: 13.5, roomWidth: 16 }, // Near Gabor wall
        2: { targetDistance: 15, wallDistance: 20, roomWidth: 24 }, // Tracking lane
        3: { targetDistance: 13.5, wallDistance: 14, roomWidth: 20 }, // Near-wall precision lane
        4: { targetDistance: 14, wallDistance: 19, roomWidth: 42 }, // Peripheral protocol exception
        5: { targetDistance: 11, wallDistance: 16, roomWidth: 20 }, // Peripheral room
        6: { targetDistance: 13, wallDistance: 18, roomWidth: 22 }, // Switch lane
        7: { targetDistance: 17, wallDistance: 22, roomWidth: 26 }  // Dummy lane
    },
    
    // Camera calibration. Counter-Strike exposes a 90 degree horizontal view
    // on a 4:3 reference viewport. Hor+ expansion makes that 106.26 degrees
    // horizontally (73.74 vertically) at the trainer's 16:9 reference aspect.
    camera: {
        verticalFov: 73.73979529168804,
        referenceAspect: 16 / 9,
        referenceHorizontalFov: 106.26020470831196
    },

    // Hip-fire degrees turned per raw mouse count at sensitivity 1.
    sensitivityProfiles: {
        cs2:          { label: 'Counter-Strike 2',  yaw: 0.022,        min: 0.01, max: 10,  step: 0.000001, decimals: 6 },
        valorant:     { label: 'Valorant',          yaw: 0.07,         min: 0.01, max: 10,  step: 0.000001, decimals: 6 },
        cod:          { label: 'Call of Duty / Warzone', yaw: 0.0066,  min: 0.01, max: 100, step: 0.000001, decimals: 6 },
        overwatch:    { label: 'Overwatch 2',       yaw: 0.0066,       min: 0.01, max: 100, step: 0.000001, decimals: 6 },
        marvelRivals: { label: 'Marvel Rivals',     yaw: 0.0066,       min: 0.01, max: 100, step: 0.000001, decimals: 6 },
        apex:         { label: 'Apex Legends',      yaw: 0.022,        min: 0.01, max: 20,  step: 0.000001, decimals: 6 },
        rainbow6:     { label: 'Rainbow Six Siege (default 0.02)', yaw: 0.005729578, min: 0.01, max: 100, step: 0.000001, decimals: 6 }
    },

    // Canonical internal scale: Valorant yaw 0.07 degrees/count.
    sensitivityFactor: 0.07 * Math.PI / 180,
    
    // Adaptive difficulty (streak-based)
    adaptive: {
        windowSize: 5,          // Only for statistics display
        successStreak: 2,       // Consecutive successes needed to level up
        failStreak: 1,          // Consecutive failures needed to level down
        stepUp: 0.015,
        stepDown: 0.02,
        minLevel: 0.1,
        maxLevel: 2.0,
        initialLevel: 0.3
    },
    
    // Mode 1: Gabor Scout
    mode1: {
        params: {
            targetSize: { min: 70, mid: 70, max: 70 },
            ringRadius: { min: 250, mid: 250, max: 250 },
            centerYOffset: -165,
            targetOpacity: { min: 0.5, mid: 0.03, max: 0.001 },
            contrast: { min: 0.5, mid: 0.03, max: 0.001 },
            timeout: { min: 5000, mid: 3000, max: 800 }
        }
    },

    // Mode 2: Pure Tracking
    mode2: {
        params: {
            targetSize: { min: 100, mid: 70, max: 3 },
            moveSpeed: { min: 4, mid: 20, max: 50 },
            lockTime: { min: 0.5, mid: 1.2, max: 2 },
            afterGazeTime: { min: 300, mid: 300, max: 300 },
            gazeRadius: { min: 100, mid: 70, max: 3 },
            curveComplexity: { min: 1, mid: 3, max: 6 },
            killTimeout: 7000
        }
    },

    // Mode 3: Surgical Lock
    mode3: {
        params: {
            coreSize: { min: 30, mid: 10, max: 1 },
            penaltySize: { min: 100, mid: 60, max: 10 },
            coreOffset: { min: 0.3, mid: 0.6, max: 0.9 },
            decoyCount: { min: 0, mid: 4, max: 8 },
            decoyMovement: { min: 0, mid: 1.5, max: 3 },
            colorSimilarity: { min: 0.1, mid: 0.5, max: 0.99 },
            shrinkTimeBase: 1500,
            jumpDistanceMin: { min: 500, mid: 500, max: 800 },
            jumpDistanceMax: { min: 800, mid: 800, max: 1000 }
        }
    },

    // Mode 4: Target Lock (timed dynamic training)
    mode4: {
        referenceHz: 144,
        maskFrames: 14,
        targetDepth: 14,
        params: {
            // All values are expressed at easy / standard / maximum difficulty.
            // Fractional 144 Hz reference frames preserve exact millisecond
            // anchors: Lv.100 delay = 100 ms and probe duration = 50 ms.
            targetDelayFrames: { min: 58, mid: 14.4, max: 2.88 },
            probeFrames: { min: 12, mid: 7.2, max: 2 },
            decoyCount: { min: 2, mid: 7, max: 12 },
            noiseCount: { min: 4, mid: 12.5, max: 20 }
        }
    },

    // Mode 5: Peripheral Pop
    mode5: {
        params: {
            ballSize: { min: 90, mid: 35, max: 5 },
            dwellMs: { min: 1800, mid: 200, max: 20 },
            fullConeDeg: 30,
            respawnDelayMs: 120
        }
    },

    // Mode 6: Cognitive Switch
    mode6: {
        params: {
            targetSize: { min: 100, mid: 50, max: 10 },
            moveSpeed: { min: 5, mid: 30, max: 80 },
            switchInterval: { min: 10000, mid: 7000, max: 500 },
            warningTime: { min: 3000, mid: 2000, max: 200 },
            targetFrequency: { min: 1000, mid: 800, max: 100 },
            inhibitionRatio: { min: 0.5, max: 0.5 }
        }
    },
    
    // Strobe effect
    strobe: {
        freqMin: 2,
        freqMax: 4,
        dutyCycle: 0.3,
        blindAlpha: 1.0
    },
    
    // Gabor noise field
    noise: {
        baseSpeed: 6,
        gaborField: {
            baseSize: 35,
            sizeVariance: 8
        }
    }
};

// Shorthand constants
const WALL_DISTANCE = CFG.wall.distance;
const WALL_WIDTH = CFG.wall.width;
const WALL_HEIGHT = CFG.wall.height;
const SENS_FACTOR = CFG.sensitivityFactor;

function getSensitivityProfile(profileId) {
    return CFG.sensitivityProfiles[profileId] || CFG.sensitivityProfiles.valorant;
}

function getSensitivityMultiplier(userSettings = {}) {
    const profile = getSensitivityProfile(userSettings.sensitivityGame);
    const value = Number(userSettings.sensitivity);
    const sensitivity = Number.isFinite(value) && value > 0 ? value : 1;
    return (profile.yaw * sensitivity) / CFG.sensitivityProfiles.valorant.yaw;
}

function convertSensitivity(value, fromProfileId, toProfileId) {
    const from = getSensitivityProfile(fromProfileId);
    const to = getSensitivityProfile(toProfileId);
    const sourceValue = Number(value);
    if (!Number.isFinite(sourceValue) || sourceValue <= 0) return 1;
    return sourceValue * from.yaw / to.yaw;
}

// ==================== DIFFICULTY SCALING ====================

/**
 * Three-point interpolation for difficulty scaling
 */
function getScaledParam(paramObj, difficulty) {
    if (typeof paramObj !== 'object' || paramObj === null) {
        return paramObj;
    }
    
    // Two-point linear interpolation (legacy compatibility)
    if (typeof paramObj.mid === 'undefined') {
        if (typeof paramObj.min !== 'undefined' && typeof paramObj.max !== 'undefined') {
            const t = (difficulty - CFG.adaptive.minLevel) / (CFG.adaptive.maxLevel - CFG.adaptive.minLevel);
            return paramObj.min + (paramObj.max - paramObj.min) * Math.max(0, Math.min(1, t));
        }
        return paramObj.min || paramObj || 0;
    }
    
    // Three-point interpolation
    if (difficulty <= 1.0) {
        // Stage 1: min → mid
        const progress = (difficulty - CFG.adaptive.minLevel) / (1.0 - CFG.adaptive.minLevel);
        return paramObj.min + (paramObj.mid - paramObj.min) * Math.max(0, Math.min(1, progress));
    } else {
        // Stage 2: mid → max
        const progress = (difficulty - 1.0) / (CFG.adaptive.maxLevel - 1.0);
        return paramObj.mid + (paramObj.max - paramObj.mid) * Math.max(0, Math.min(1, progress));
    }
}

// ==================== UTILITY FUNCTIONS ====================

function getDistance(x1, y1, x2, y2) {
    return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function randomRange(min, max) {
    return min + Math.random() * (max - min);
}

function randomInt(min, max) {
    return Math.floor(randomRange(min, max + 1));
}

function lerp(a, b, t) {
    return a + (b - a) * t;
}

function deepMerge(target, source) {
    const result = { ...target };
    for (const key in source) {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
            result[key] = deepMerge(target[key] || {}, source[key]);
        } else {
            result[key] = source[key];
        }
    }
    return result;
}

// Global helper for modes (backward compatibility)
function getScaledValue(paramObj) {
    return getScaledParam(paramObj, typeof currentDifficulty !== 'undefined' ? currentDifficulty : 0.3);
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CFG, getScaledParam, getScaledValue, getDistance, clamp, randomRange, randomInt, lerp, deepMerge };
}
