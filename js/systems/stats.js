// ==================== STATS CALCULATION ====================
// NCS scoring and session statistics

const Stats = {
    /**
     * Calculate Neuro-Cognitive Score (NCS) for a session
     * @param {Object} session - Session data
     * @returns {number} NCS score
     */
    calculateNCS(session) {
        if (!session.trials || session.trials === 0) return 0;
        
        const avgDiff = ((session.startDifficulty || 0.3) + (session.endDifficulty || 0.3)) / 2;
        const accuracy = session.hits / session.trials;
        const rt = session.avgRt || 1000;
        
        // Base score formula
        const base = avgDiff * 1000 * Math.pow(accuracy, 1.5) * (400 / (Math.max(150, rt) + 50));
        
        // Strobe multiplier
        const strobeMultiplier = session.strobe ? 1.2 : 1.0;
        
        // Tracking time bonus (Mode 2 only)
        let trackingMultiplier = 1.0;
        if (session.mode === 2 && session.trackingTime) {
            trackingMultiplier = 1 + Math.min(0.5, session.trackingTime * 0.005);
        }
        
        return Math.round(base * strobeMultiplier * trackingMultiplier);
    },
    
    /**
     * Calculate session statistics
     * @param {Array} reactionTimes - Array of reaction times
     * @param {number} hits - Hit count
     * @param {number} trials - Total trials
     * @returns {Object} Calculated stats
     */
    calculateSessionStats(reactionTimes, hits, trials) {
        const accuracy = trials > 0 ? Math.round((hits / trials) * 100) : 0;
        
        const avgRt = reactionTimes.length > 0
            ? Math.round(reactionTimes.reduce((a, b) => a + b, 0) / reactionTimes.length)
            : 0;
        
        const minRt = reactionTimes.length > 0 
            ? Math.round(Math.min(...reactionTimes)) 
            : 0;
        
        const maxRt = reactionTimes.length > 0 
            ? Math.round(Math.max(...reactionTimes)) 
            : 0;
        
        // Standard deviation
        let rtStdDev = 0;
        if (reactionTimes.length > 1) {
            const mean = avgRt;
            const squaredDiffs = reactionTimes.map(rt => Math.pow(rt - mean, 2));
            rtStdDev = Math.round(Math.sqrt(
                squaredDiffs.reduce((a, b) => a + b, 0) / reactionTimes.length
            ));
        }
        
        return {
            accuracy,
            avgRt,
            minRt,
            maxRt,
            rtStdDev
        };
    },
    
    /**
     * Build final session object for storage
     * @param {Object} params - Session parameters
     * @returns {Object} Complete session object
     */
    buildSessionObject(params) {
        const {
            modeId,
            strobeEnabled,
            startDifficulty,
            endDifficulty,
            hits,
            misses,
            trials,
            reactionTimes,
            durationMs,
            sessionStats
        } = params;
        
        const calcStats = this.calculateSessionStats(reactionTimes, hits, trials);
        
        const endedAt = Date.now();
        const activeDurationMs = Number.isFinite(durationMs)
            ? Math.max(0, Math.round(durationMs))
            : Number.isFinite(sessionStats.durationMs)
                ? Math.max(0, Math.round(sessionStats.durationMs))
                : CFG.sessionDuration * 1000;
        const sessionId = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
            ? crypto.randomUUID()
            : `session-${endedAt}-${Math.random().toString(36).slice(2, 10)}`;
        const session = {
            sessionSchemaVersion: 5,
            sessionId,
            mode: modeId,
            strobe: strobeEnabled,
            startDifficulty: startDifficulty,
            endDifficulty: endDifficulty,
            difficultyChange: endDifficulty - startDifficulty,
            accuracy: calcStats.accuracy,
            avgRt: calcStats.avgRt,
            minRt: calcStats.minRt,
            maxRt: calcStats.maxRt,
            rtStdDev: calcStats.rtStdDev,
            hits: hits,
            misses: misses,
            trials: trials,
            reactionTimes: reactionTimes.slice(-100),
            reactionTimeCount: reactionTimes.length,
            timestamp: endedAt,
            startedAt: endedAt - activeDurationMs,
            endedAt,
            durationMs: activeDurationMs,
            
            // Mode-specific stats
            gazeBreaks: sessionStats.gazeBreaks || 0,
            perfectTrials: sessionStats.perfectTrials || 0,
            switchErrors: sessionStats.switchErrors || 0,
            inhibitionSuccess: sessionStats.inhibitionSuccess || 0,
            inhibitionFail: sessionStats.inhibitionFail || 0,
            trackingTime: sessionStats.trackingTime || 0,
            difficultyHistory: Array.isArray(sessionStats.difficultyHistory)
                ? sessionStats.difficultyHistory.slice()
                : []
        };
        if (modeId === 4 && sessionStats.targetLock) Object.assign(session, sessionStats.targetLock);
        
        // Target Lock scores direction accuracy and adaptive level, not answer
        // speed or click throughput, so it is not folded into the NCS formula.
        session.ncs = modeId === 4 ? 0 : this.calculateNCS(session);
        
        return session;
    },
    
    /**
     * Get performance trend from sessions
     * @param {Array} sessions - Session array
     * @param {string} metric - Metric to analyze ('ncs', 'accuracy', 'avgRt')
     * @returns {Object} Trend info
     */
    getTrend(sessions, metric = 'ncs') {
        if (sessions.length < 2) {
            return { direction: 0, change: 0, recent: 0, previous: 0 };
        }
        
        const half = Math.floor(sessions.length / 2);
        const recent = sessions.slice(half);
        const previous = sessions.slice(0, half);
        
        const getValue = (s) => {
            switch (metric) {
                case 'ncs': return s.ncs || this.calculateNCS(s);
                case 'accuracy': return s.accuracy || 0;
                case 'avgRt': return s.avgRt || 0;
                default: return 0;
            }
        };
        
        const recentAvg = recent.reduce((a, s) => a + getValue(s), 0) / recent.length;
        const previousAvg = previous.reduce((a, s) => a + getValue(s), 0) / previous.length;
        
        const change = recentAvg - previousAvg;
        const direction = change > 0 ? 1 : change < 0 ? -1 : 0;
        
        // For RT, lower is better
        const adjustedDirection = metric === 'avgRt' ? -direction : direction;
        
        return {
            direction: adjustedDirection,
            change: Math.round(change),
            recent: Math.round(recentAvg),
            previous: Math.round(previousAvg)
        };
    },
    
    /**
     * Get best session for a mode
     * @param {Array} sessions - All sessions
     * @param {number} modeId - Mode ID
     * @param {boolean|null} strobe - Filter by strobe (null = all)
     * @returns {Object|null} Best session
     */
    getBestSession(sessions, modeId, strobe = null) {
        const filtered = sessions.filter(s => 
            s.mode === modeId && 
            (strobe === null || s.strobe === strobe)
        );
        
        if (filtered.length === 0) return null;
        
        return filtered.reduce((best, s) => {
            const sNcs = s.ncs || this.calculateNCS(s);
            const bestNcs = best.ncs || this.calculateNCS(best);
            return sNcs > bestNcs ? s : best;
        });
    },
    
    /**
     * Get streak (consecutive training days)
     * @param {Array} sessions - All sessions
     * @returns {number} Current streak
     */
    getStreak(sessions) {
        if (sessions.length === 0) return 0;
        
        const dates = [...new Set(
            sessions.map(s => new Date(s.timestamp).toDateString())
        )].sort((a, b) => new Date(b) - new Date(a));
        
        const today = new Date().toDateString();
        const yesterday = new Date(Date.now() - 86400000).toDateString();
        
        // Must have trained today or yesterday
        if (dates[0] !== today && dates[0] !== yesterday) {
            return 0;
        }
        
        let streak = 1;
        let checkDate = new Date(dates[0]);
        
        for (let i = 1; i < dates.length; i++) {
            checkDate = new Date(checkDate.getTime() - 86400000);
            if (dates[i] === checkDate.toDateString()) {
                streak++;
            } else {
                break;
            }
        }
        
        return streak;
    },
    
    /**
     * Get total training time
     * @param {Array} sessions - All sessions
     * @returns {Object} Time breakdown {minutes, hours, formatted}
     */
    getTotalTime(sessions) {
        const sessionDuration = typeof CFG !== 'undefined' ? CFG.sessionDuration : 60;
        const totalSeconds = sessions.reduce((sum, session) => {
            return sum + (Number.isFinite(session.durationMs) ? session.durationMs / 1000 : sessionDuration);
        }, 0);
        const minutes = Math.round(totalSeconds / 60);
        const hours = Math.floor(minutes / 60);
        
        return {
            minutes,
            hours,
            formatted: hours > 0 ? `${hours}h${minutes % 60}m` : `${minutes}m`
        };
    }
};

// Backward compatibility
function calculateNCS(session) {
    return Stats.calculateNCS(session);
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Stats;
}
