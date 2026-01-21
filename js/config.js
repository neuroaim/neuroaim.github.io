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
    
    // Mouse sensitivity factor
    // 0.001222 matches Valorant sensitivity (yaw 0.07)
    // Your in-game sens = 1.0 will feel like Valorant sens = 1.0
    sensitivityFactor: 0.001222,
    
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
            targetSize: { min: 100, mid: 100, max: 100 },
            ringRadius: { min: 500, mid: 500, max: 500 },
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

    // Mode 4: Landolt Saccade
    mode4: {
        params: {
            ringSize: { min: 50, mid: 15, max: 1 },
            contrast: { min: 1.0, mid: 0.6, max: 0.01 },
            timeout: { min: 2000, mid: 600, max: 100 },
            eccentricity: { min: 150, mid: 300, max: 480 }
        }
    },

    // Mode 5: Parafoveal Ghost
    mode5: {
        params: {
            primarySize: { min: 100, mid: 60, max: 10 },
            primarySpeed: { min: 2, mid: 4, max: 20 },
            ghostSize: { min: 80, mid: 50, max: 10 },
            ghostDuration: { min: 1000, mid: 600, max: 100 },
            ghostEccentricity: { min: 300, mid: 500, max: 1000 },
            ghostFrequency: { min: 1000, mid: 600, max: 100 },
            blueRatio: { min: 0.7, mid: 0.55, max: 0.4 },
            returnWindow: { min: 1000, mid: 600, max: 100 },
            hitTolerance: { min: 80, mid: 50, max: 10 },
            integrityGainRate: { min: 1.5, max: 1.5 },
            integrityLossIdle: { min: 0.8, max: 1.5 },
            integrityLossBlue: { min: 0.3, max: 0.5 },
            integrityLossRed: { min: 2, max: 5 }
        }
    },

    // Mode 6: Memory Sequencer
    mode6: {
        params: {
            displayTime: { min: 800, mid: 400, max: 50 },
            delayBeforeRecall: { min: 500, mid: 1500, max: 3000 },
            targetSize: { min: 100, mid: 70, max: 10 },
            spatialSpread: { min: 160, mid: 190, max: 300 },
            clusterRadius: { min: 700, mid: 500, max: 300 },
            positionTolerance: { min: 80, mid: 50, max: 5 }
        }
    },

    // Mode 7: Cognitive Switch
    mode7: {
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