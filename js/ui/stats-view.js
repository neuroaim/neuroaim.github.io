// ==================== STATISTICS VIEW ====================
// Training analytics display with charts and tables

// ===== NCS CALCULATION =====
function calculateNCS(session) {
    if (!session.trials || session.trials === 0) return 0;
    
    const avgDiff = ((session.startDifficulty || 0.3) + (session.endDifficulty || 0.3)) / 2;
    const accuracy = session.hits / session.trials;
    const rt = session.avgRt || 1000;
    
    const base = avgDiff * 1000 * Math.pow(accuracy, 1.5) * (400 / (Math.max(150, rt) + 50));
    const strobe = session.strobe ? 1.2 : 1.0;
    
    let tracking = 1.0;
    if ((session.mode === 2 || session.mode === 5) && session.trackingTime) {
        tracking = 1 + Math.min(0.5, session.trackingTime * 0.005);
    }
    
    return Math.round(base * strobe * tracking);
}

// ===== HELPER FUNCTIONS =====
function getModeName(mode) {
    return i18n.modeName(mode);
}

function getModeColor(mode) {
    return ModeRegistry.getColor(mode);
}

function filterSessions(stats, mode, strobe = null) {
    return stats.filter(s => s.mode === mode && (strobe === null || s.strobe === strobe));
}

// ===== MINI SPARKLINE =====
function createSparkline(data, color, width = 80, height = 24) {
    if (data.length < 2) return `<span class="spark-na">—</span>`;
    
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    
    const points = data.map((v, i) => {
        const x = (i / (data.length - 1)) * width;
        const y = height - ((v - min) / range) * height;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
    
    return `<svg class="sparkline" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
        <polyline points="${points}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
}

// ===== TREND CHART =====
function createTrendChart(sessions, isStrobe) {
    const recent = sessions.slice(-50);
    if (recent.length < 2) {
        return `<div class="chart-empty">${i18n.t('stats.need2Sessions')}</div>`;
    }
    
    const ncs = recent.map(s => s.ncs || calculateNCS(s));
    const rt = recent.map(s => s.avgRt || 0);
    const acc = recent.map(s => s.accuracy || 0);
    
    const w = 260, h = 80;
    const pad = { t: 8, r: 8, b: 20, l: 32 };
    const cw = w - pad.l - pad.r;
    const ch = h - pad.t - pad.b;
    
    function path(data, color, opacity = 1) {
        const min = Math.min(...data) * 0.95;
        const max = Math.max(...data) * 1.05;
        const range = max - min || 1;
        
        const pts = data.map((v, i) => {
            const x = pad.l + (i / (data.length - 1)) * cw;
            const y = pad.t + ch - ((v - min) / range) * ch;
            return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
        }).join(' ');
        
        return `<path d="${pts}" fill="none" stroke="${color}" stroke-width="1.5" opacity="${opacity}"/>`;
    }
    
    const ncsAvg = Math.round(ncs.reduce((a, b) => a + b, 0) / ncs.length);
    const rtAvg = Math.round(rt.reduce((a, b) => a + b, 0) / rt.length);
    const accAvg = Math.round(acc.reduce((a, b) => a + b, 0) / acc.length);
    
    return `
        <div class="trend-chart ${isStrobe ? 'strobe' : 'normal'}">
            <svg viewBox="0 0 ${w} ${h}">
                <line x1="${pad.l}" y1="${pad.t + ch}" x2="${pad.l + cw}" y2="${pad.t + ch}" stroke="rgba(255,255,255,0.1)"/>
                <line x1="${pad.l}" y1="${pad.t + ch / 2}" x2="${pad.l + cw}" y2="${pad.t + ch / 2}" stroke="rgba(255,255,255,0.05)"/>
                ${path(rt, '#00d9ff', 0.5)}
                ${path(acc, '#00ff99', 0.5)}
                ${path(ncs, '#9966ff', 1)}
            </svg>
            <div class="trend-legend">
                <span><i style="background:#9966ff"></i>NCS ${ncsAvg}</span>
                <span><i style="background:#00d9ff"></i>RT ${rtAvg}</span>
                <span><i style="background:#00ff99"></i>Acc ${accAvg}%</span>
            </div>
        </div>
    `;
}

// ===== MINI HISTOGRAM =====
function createMiniHistogram(sessions, color) {
    let trials = [];
    for (let i = sessions.length - 1; i >= 0 && trials.length < 100; i--) {
        const s = sessions[i];
        if (s.difficultyHistory?.length) {
            const take = Math.min(100 - trials.length, s.difficultyHistory.length);
            trials = s.difficultyHistory.slice(-take).concat(trials);
        }
    }
    
    if (trials.length < 5) {
        return `<div class="chart-empty">${i18n.t('stats.needMoreData')}</div>`;
    }
    
    const levels = trials.map(d => d * 100);
    const min = Math.min(...levels);
    const max = Math.max(...levels);
    const bins = new Array(8).fill(0);
    const binSize = Math.max(1, (max - min) / 8);
    
    levels.forEach(l => {
        bins[Math.min(7, Math.floor((l - min) / binSize))]++;
    });
    
    const maxBin = Math.max(...bins);
    
    const bars = bins.map(c => {
        const h = maxBin > 0 ? (c / maxBin) * 100 : 0;
        return `<div class="hbar" style="height:${h}%;background:${color}"></div>`;
    }).join('');
    
    return `
        <div class="mini-histogram">
            <div class="hbars">${bars}</div>
            <div class="hlabels"><span>Lv${Math.round(min)}</span><span>Lv${Math.round(max)}</span></div>
        </div>
    `;
}

// ===== MAIN UPDATE =====
function updateStatsDisplay() {
    const stats = Storage.getStats();
    const container = document.getElementById('stats-screen');
    if (!container) return;
    
    const header = container.querySelector('.stats-header');
    container.innerHTML = '';
    if (header) container.appendChild(header);
    
    if (stats.length === 0) {
        container.innerHTML += `
            <div class="stats-empty">
                <div class="empty-icon">📊</div>
                <h3>${i18n.t('stats.noData')}</h3>
                <p>${i18n.t('stats.noDataDesc')}</p>
            </div>
        `;
        return;
    }
    
    const main = document.createElement('div');
    main.className = 'stats-main-content';
    
    // Tab buttons
    const modeIds = ModeRegistry.getAllIds();
    const tabButtons = modeIds.map(m => 
        `<button class="tab" data-mode="${m}" onclick="switchStatsTab(${m})">${getModeName(m).split(' ')[0]}</button>`
    ).join('');
    
    main.innerHTML = `
        <div class="stats-tabs">
            <button class="tab active" data-mode="all" onclick="switchStatsTab('all')">${i18n.t('stats.overview')}</button>
            ${tabButtons}
        </div>
        <div id="stats-content"></div>
    `;
    container.appendChild(main);
    switchStatsTab('all');
    
    // Clear data button
    const clearBtn = document.createElement('button');
    clearBtn.className = 'clear-btn';
    clearBtn.textContent = i18n.t('ui.clearData');
    clearBtn.onclick = () => {
        if (confirm(i18n.t('ui.deleteAllData'))) {
            Storage.clearStats();
            updateStatsDisplay();
        }
    };
    container.appendChild(clearBtn);
}

window.switchStatsTab = function(mode) {
    document.querySelectorAll('.stats-tabs .tab').forEach(t => 
        t.classList.toggle('active', t.dataset.mode == mode)
    );
    
    const stats = Storage.getStats();
    const content = document.getElementById('stats-content');
    if (content) {
        content.innerHTML = mode === 'all' ? renderOverview(stats) : renderModeDetail(stats, +mode);
    }
};

// ===== OVERVIEW =====
function renderOverview(stats) {
    const total = stats.length;
    const completed = stats.filter(s => s.trials > 0).length;
    const mins = Math.round(total * CFG.sessionDuration / 60);
    const hrs = Math.floor(mins / 60);
    const time = hrs > 0 ? `${hrs}h${mins % 60}m` : `${mins}m`;
    const days = [...new Set(stats.map(s => new Date(s.timestamp).toDateString()))].length;
    
    // Calculate streak
    let streak = 0;
    const dates = [...new Set(stats.map(s => new Date(s.timestamp).toDateString()))].sort((a, b) => new Date(b) - new Date(a));
    if (dates.length) {
        const today = new Date().toDateString();
        const yest = new Date(Date.now() - 86400000).toDateString();
        if (dates[0] === today || dates[0] === yest) {
            streak = 1;
            let check = new Date(dates[0]);
            for (let i = 1; i < dates.length; i++) {
                check = new Date(check.getTime() - 86400000);
                if (dates[i] === check.toDateString()) streak++;
                else break;
            }
        }
    }
    
    let html = `
        <div class="overview-grid">
            <div class="stat-card accent"><div class="sc-val">${total}</div><div class="sc-label">${i18n.t('stats.sessions')}</div></div>
            <div class="stat-card green"><div class="sc-val">${Math.round(completed / total * 100) || 0}%</div><div class="sc-label">Completed</div></div>
            <div class="stat-card cyan"><div class="sc-val">${time}</div><div class="sc-label">${i18n.t('stats.trainingTime')}</div></div>
            <div class="stat-card yellow"><div class="sc-val">${days}</div><div class="sc-label">Days</div></div>
            <div class="stat-card purple"><div class="sc-val">${streak}</div><div class="sc-label">Streak</div></div>
        </div>
        <div class="section-head">${i18n.current === 'zh' ? '模式表现' : 'Mode Performance'}</div>
        <div class="mode-grid">
    `;
    
    ModeRegistry.getAllIds().forEach(m => {
        const all = filterSessions(stats, m);
        const norm = filterSessions(stats, m, false);
        const strb = filterSessions(stats, m, true);
        const color = getModeColor(m);
        
        if (all.length === 0) {
            html += `<div class="mode-card" style="border-color:${color}30"><div class="mc-head" style="color:${color}">${getModeName(m)}</div><div class="mc-empty">${i18n.t('stats.noSessions')}</div></div>`;
            return;
        }

        
        // Helper to get level
        const getLv = s => Math.round((s.endDifficulty || 0.3) * 100);

        // Get latest levels
        const normLv = norm.length ? getLv(norm[norm.length - 1]) : null;
        const strbLv = strb.length ? getLv(strb[strb.length - 1]) : null;
        
        // Sparklines
        const normSpk = createSparkline(norm.slice(-20).map(getLv), '#00d9ff');
        const strbSpk = createSparkline(strb.slice(-20).map(getLv), '#ff66cc');
        
        html += `
            <div class="mode-card" style="border-color:${color}">
                <div class="mc-head" style="color:${color}">${getModeName(m)}</div>
                <div class="mc-row">
                    <div class="mc-col">
                        <div class="mc-type">${i18n.t('stats.normalMode')}</div>
                        <div class="mc-ncs">Lv.${normLv ?? '—'}</div>
                        <div class="mc-spark">${normSpk}</div>
                        <div class="mc-count">${norm.length}</div>
                    </div>
                    <div class="mc-col strobe">
                        <div class="mc-type">${i18n.t('stats.strobeMode')}</div>
                        <div class="mc-ncs">Lv.${strbLv ?? '—'}</div>
                        <div class="mc-spark">${strbSpk}</div>
                        <div class="mc-count">${strb.length}</div>
                    </div>
                </div>
            </div>
        `;
    });
    
    html += `</div><div class="section-head">${i18n.t('stats.recentSessions')}</div>`;
    html += renderTable(stats.slice(-12).reverse());
    
    return html;
}

// ===== MODE DETAIL =====
function renderModeDetail(stats, mode) {
    const all = filterSessions(stats, mode);
    const norm = filterSessions(stats, mode, false);
    const strb = filterSessions(stats, mode, true);
    const color = getModeColor(mode);
    
    if (all.length === 0) {
        return `<div class="detail-empty"><h3 style="color:${color}">${getModeName(mode)}</h3><p>${i18n.t('stats.noSessions')}</p></div>`;
    }
    
    function calcStats(arr) {
        if (!arr.length) return null;
        const ncs = arr.map(s => s.ncs || calculateNCS(s));
        const rt = arr.filter(s => s.avgRt).map(s => s.avgRt);
        const acc = arr.map(s => s.accuracy || 0);
        const lvl = arr.map(s => (s.endDifficulty || 0.3) * 100);
        return {
            avg: Math.round(ncs.reduce((a, b) => a + b, 0) / ncs.length),
            best: Math.max(...ncs),
            rt: rt.length ? Math.min(...rt) : 0,
            acc: Math.max(...acc),
            lvl: Math.round(Math.max(...lvl)),
            count: arr.length
        };
    }
    
    const ns = calcStats(norm);
    const ss = calcStats(strb);
    
    let html = `
        <div class="detail-header" style="border-color:${color}">
            <h2 style="color:${color}">${getModeName(mode)}</h2>
        </div>
        <div class="compare-grid">
    `;
    
    [
        { label: i18n.t('stats.normalMode'), s: ns, data: norm, isStrobe: false },
        { label: i18n.t('stats.strobeMode'), s: ss, data: strb, isStrobe: true }
    ].forEach(({ label, s, data, isStrobe }) => {
        const cls = isStrobe ? 'strobe' : 'normal';
        if (!s) {
            html += `<div class="compare-card ${cls}"><div class="cc-head">${label}</div><div class="cc-empty">${i18n.t('stats.noSessions')}</div></div>`;
            return;
        }
        html += `
            <div class="compare-card ${cls}">
                <div class="cc-head">${label}<span>${s.count} ${i18n.t('stats.sessions')}</span></div>
                <div class="cc-stats">
                    <div class="cc-main">
                        <div class="cc-big">${s.avg}</div>
                        <div class="cc-lbl">${i18n.t('stats.avgNCSShort')}</div>
                    </div>
                    <div class="cc-main best">
                        <div class="cc-big">${s.best}</div>
                        <div class="cc-lbl">${i18n.t('stats.best')}</div>
                    </div>
                </div>
                <div class="cc-row">
                    <div><span>${i18n.t('stats.bestRT')}</span><b>${s.rt}ms</b></div>
                    <div><span>${i18n.t('stats.bestAcc')}</span><b>${s.acc}%</b></div>
                    <div><span>${i18n.t('stats.peakLv')}</span><b>${s.lvl}</b></div>
                </div>
                <div class="cc-section">
                    <div class="cc-subtitle">${i18n.t('stats.trend')}</div>
                    ${createTrendChart(data, isStrobe)}
                </div>
                <div class="cc-section">
                    <div class="cc-subtitle">${i18n.t('stats.levelDist')}</div>
                    ${createMiniHistogram(data, isStrobe ? '#ff66cc' : '#00d9ff')}
                </div>
            </div>
        `;
    });
    
    html += `</div><div class="section-head">${i18n.t('stats.recentSessions')}</div>`;
    html += `<div class="tables-row">`;
    html += `<div class="table-half"><div class="th-title normal">${i18n.t('stats.normalMode')}</div>${renderCompactTable(norm.slice(-8).reverse())}</div>`;
    html += `<div class="table-half"><div class="th-title strobe">${i18n.t('stats.strobeMode')}</div>${renderCompactTable(strb.slice(-8).reverse())}</div>`;
    html += `</div>`;
    
    return html;
}

// ===== TABLES =====
function renderTable(sessions) {
    if (!sessions.length) return `<div class="no-data">${i18n.t('stats.noSessions')}</div>`;
    
    return `
        <table class="data-table">
            <thead><tr>
                <th>${i18n.t('stats.mode')}</th>
                <th>${i18n.t('stats.ncs')}</th>
                <th>⚡</th>
                <th>${i18n.t('stats.acc')}</th>
                <th>${i18n.t('stats.rt')}</th>
                <th>${i18n.t('stats.lv')}</th>
                <th>${i18n.t('stats.date')}</th>
            </tr></thead>
            <tbody>${sessions.map(s => {
                const d = new Date(s.timestamp);
                const ncs = s.ncs || calculateNCS(s);
                const lv = Math.round((s.endDifficulty || 0.3) * 100);
                const diff = Math.round(((s.endDifficulty || 0.3) - (s.startDifficulty || 0.3)) * 100);
                return `<tr>
                    <td style="color:${getModeColor(s.mode)}">${getModeName(s.mode)?.split(' ')[0] || '?'}</td>
                    <td class="ncs">${ncs}</td>
                    <td>${s.strobe ? '⚡' : ''}</td>
                    <td>${s.accuracy}%</td>
                    <td>${s.avgRt}ms</td>
                    <td>${lv}<small class="${diff > 0 ? 'up' : diff < 0 ? 'down' : ''}">${diff > 0 ? '+' : ''}${diff}</small></td>
                    <td class="date">${d.toLocaleDateString('en', { month: 'short', day: 'numeric' })} ${d.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })}</td>
                </tr>`;
            }).join('')}</tbody>
        </table>
    `;
}

function renderCompactTable(sessions) {
    if (!sessions.length) return `<div class="no-data">${i18n.t('stats.noSessions')}</div>`;
    
    return `
        <table class="compact-table">
            <thead><tr>
                <th>${i18n.t('stats.ncs')}</th>
                <th>${i18n.t('stats.acc')}</th>
                <th>${i18n.t('stats.rt')}</th>
                <th>${i18n.t('stats.lv')}</th>
                <th>${i18n.t('stats.date')}</th>
            </tr></thead>
            <tbody>${sessions.map(s => {
                const d = new Date(s.timestamp);
                const ncs = s.ncs || calculateNCS(s);
                const lv = Math.round((s.endDifficulty || 0.3) * 100);
                const diff = Math.round(((s.endDifficulty || 0.3) - (s.startDifficulty || 0.3)) * 100);
                return `<tr>
                    <td class="ncs">${ncs}</td>
                    <td>${s.accuracy}%</td>
                    <td>${s.avgRt}</td>
                    <td>${lv}<small class="${diff > 0 ? 'up' : diff < 0 ? 'down' : ''}">${diff > 0 ? '+' : ''}${diff}</small></td>
                    <td class="date">${d.toLocaleDateString('en', { month: 'short', day: 'numeric' })}</td>
                </tr>`;
            }).join('')}</tbody>
        </table>
    `;
}

// ===== BACKWARD COMPATIBILITY =====
function loadStats() {
    return Storage.getStats();
}

function saveGameStats(session) {
    session.ncs = calculateNCS(session);
    Storage.addSession(session);
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        calculateNCS, updateStatsDisplay, loadStats, saveGameStats
    };
}
