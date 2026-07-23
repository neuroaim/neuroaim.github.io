// ==================== TRAINING ANALYTICS ====================
// Every chart keeps raw sessions visible. Rolling medians add context without
// replacing the underlying history, and pagination never truncates storage.

const StatsDashboardState = {
    mode: 'all',
    condition: 'all',
    historyPage: 0,
    pageSize: 20
};

function statsCopy(en, zh) {
    return i18n.current === 'zh' ? zh : en;
}

function statsEsc(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function statsNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
}

function statsTimestamp(session) {
    return statsNumber(session?.endedAt) ?? statsNumber(session?.timestamp) ?? 0;
}

function statsSessions() {
    const activeModes = new Set(ModeRegistry.getAllIds());
    return Storage.getStats()
        .filter(session => activeModes.has(Number(session?.mode)))
        .slice()
        .sort((a, b) => statsTimestamp(a) - statsTimestamp(b));
}

function statsModeName(mode) {
    return i18n.modeName(Number(mode));
}

function statsModeColor(mode) {
    return ModeRegistry.getColor(Number(mode));
}

function statsMedian(values) {
    const valid = values.map(statsNumber).filter(value => value !== null).sort((a, b) => a - b);
    if (!valid.length) return null;
    const middle = Math.floor(valid.length / 2);
    return valid.length % 2 ? valid[middle] : (valid[middle - 1] + valid[middle]) / 2;
}

function statsRollingMedian(values, windowSize = 5) {
    return values.map((_, index) => {
        if (index < windowSize - 1) return null;
        return statsMedian(values.slice(index - windowSize + 1, index + 1));
    });
}

function statsLevel(session, field = 'endDifficulty') {
    const value = statsNumber(session?.[field]);
    return value === null ? null : Math.round(value * 1000) / 10;
}

function statsAccuracy(session) {
    const explicit = statsNumber(session?.accuracy);
    if (explicit !== null) return Math.max(0, Math.min(100, explicit));
    const hits = statsNumber(session?.hits);
    const trials = statsNumber(session?.trials);
    return hits !== null && trials > 0 ? Math.round(hits / trials * 1000) / 10 : null;
}

function statsDate(session, includeTime = false) {
    const timestamp = statsTimestamp(session);
    if (!timestamp) return statsCopy('Unknown date', '日期未知');
    const options = includeTime
        ? { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }
        : { year: 'numeric', month: '2-digit', day: '2-digit' };
    return new Date(timestamp).toLocaleString(i18n.current === 'zh' ? 'zh-CN' : undefined, options);
}

function statsDuration(session) {
    const milliseconds = statsNumber(session?.durationMs);
    if (milliseconds === null) return '—';
    const totalSeconds = Math.max(0, Math.round(milliseconds / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return minutes ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

function statsFormat(value, suffix = '', digits = 0) {
    const number = statsNumber(value);
    return number === null ? '—' : `${number.toFixed(digits)}${suffix}`;
}

function statsDelta(value, suffix = '') {
    const number = statsNumber(value);
    if (number === null) return '—';
    return `${number > 0 ? '+' : ''}${Math.round(number * 10) / 10}${suffix}`;
}

function statsTrend(sessions) {
    const levels = sessions.map(session => statsLevel(session)).filter(value => value !== null);
    if (!levels.length) return { latest: null, long: null, recent: null, best: null };
    const latest = statsMedian(levels.slice(-5));
    const long = levels.length >= 10 ? latest - statsMedian(levels.slice(0, 5)) : null;
    const recent = levels.length >= 10
        ? statsMedian(levels.slice(-5)) - statsMedian(levels.slice(-10, -5))
        : null;
    return { latest, long, recent, best: Math.max(...levels) };
}

function statsSparkline(values, color) {
    const data = values.map(statsNumber).filter(value => value !== null).slice(-30);
    if (data.length < 2) return '<span class="analytics-na">—</span>';
    const width = 180, height = 38;
    const min = Math.min(...data), max = Math.max(...data), range = max - min || 1;
    const points = data.map((value, index) => {
        const x = index / (data.length - 1) * width;
        const y = height - 3 - ((value - min) / range) * (height - 6);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
    return `<svg class="analytics-sparkline" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true"><polyline points="${points}" fill="none" stroke="${color}" stroke-width="2" vector-effect="non-scaling-stroke"/></svg>`;
}

function statsNiceMax(value) {
    if (!Number.isFinite(value) || value <= 0) return 100;
    const magnitude = 10 ** Math.floor(Math.log10(value));
    const normalized = value / magnitude;
    const nice = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
    return nice * magnitude;
}

function statsLinePath(points) {
    let path = '';
    let drawing = false;
    points.forEach(point => {
        if (!point) {
            drawing = false;
            return;
        }
        path += `${drawing ? 'L' : 'M'}${point.x.toFixed(1)},${point.y.toFixed(1)} `;
        drawing = true;
    });
    return path.trim();
}

function statsChartFrame(title, subtitle, body, legend) {
    return `<section class="trajectory-panel">
        <div class="trajectory-heading"><div><h3>${title}</h3><p>${subtitle}</p></div>${legend || ''}</div>
        ${body}
    </section>`;
}

function renderLevelJourneyChart(sessions, color) {
    if (!sessions.length) return statsChartFrame(
        statsCopy('Level journey', '等级成长轨迹'), '',
        `<div class="analytics-empty-small">${statsCopy('No sessions in this filter.', '当前筛选条件下暂无训练记录。')}</div>`
    );
    const width = Math.max(920, 90 + sessions.length * 15), height = 310;
    const pad = { left: 52, right: 22, top: 22, bottom: 42 };
    const chartWidth = width - pad.left - pad.right;
    const chartHeight = height - pad.top - pad.bottom;
    const yMin = 10, yMax = 200;
    const x = index => pad.left + (sessions.length === 1 ? chartWidth / 2 : index / (sessions.length - 1) * chartWidth);
    const y = value => pad.top + chartHeight - (Math.max(yMin, Math.min(yMax, value)) - yMin) / (yMax - yMin) * chartHeight;
    const endLevels = sessions.map(session => statsLevel(session));
    const rolling = statsRollingMedian(endLevels);
    const rollingPoints = rolling.map((value, index) => value === null ? null : ({ x: x(index), y: y(value) }));
    const ticks = [10, 50, 100, 150, 200];
    const grid = ticks.map(tick => `<g><line class="chart-gridline" x1="${pad.left}" y1="${y(tick)}" x2="${width - pad.right}" y2="${y(tick)}"/><text class="chart-axis-label" x="${pad.left - 10}" y="${y(tick) + 4}" text-anchor="end">${tick}</text></g>`).join('');
    const raw = sessions.map((session, index) => {
        const start = statsLevel(session, 'startDifficulty');
        const end = endLevels[index];
        if (end === null) return '';
        const startValue = start === null ? end : start;
        const title = `${statsCopy('Session', '第')} ${index + 1} · ${statsDate(session)} · Lv${startValue} → Lv${end} · ${statsCopy('Accuracy', '正确率')} ${statsFormat(statsAccuracy(session), '%', 1)}`;
        return `<g class="chart-session"><line class="chart-session-range" x1="${x(index)}" y1="${y(startValue)}" x2="${x(index)}" y2="${y(end)}" style="stroke:${color}"/><circle class="chart-point" cx="${x(index)}" cy="${y(end)}" r="4" style="fill:${color}"><title>${statsEsc(title)}</title></circle></g>`;
    }).join('');
    const labels = sessions.length > 1 ? `<text class="chart-axis-label" x="${pad.left}" y="${height - 12}">#1</text><text class="chart-axis-label" x="${width - pad.right}" y="${height - 12}" text-anchor="end">#${sessions.length}</text>` : '';
    const svg = `<div class="trajectory-chart"><svg style="min-width:${width}px" viewBox="0 0 ${width} ${height}" role="img" aria-label="${statsEsc(statsCopy('Training level history', '训练等级历史'))}">${grid}${raw}<path class="chart-median" d="${statsLinePath(rollingPoints)}" style="stroke:${color}"/>${labels}</svg></div>`;
    const legend = `<div class="chart-legend"><span><i class="legend-raw" style="border-color:${color}"></i>${statsCopy('Session start → end', '单局开始 → 结束')}</span><span><i class="legend-line" style="background:${color}"></i>${statsCopy('5-session median', '5 局滚动中位数')}</span></div>`;
    return statsChartFrame(
        statsCopy('Level journey', '等级成长轨迹'),
        statsCopy('Fixed Lv10–200 scale. Hover a point for the exact session.', '固定 Lv10–200 坐标。悬停原始点可查看该局精确数据。'),
        svg, legend
    );
}

function renderMetricChart(sessions, definition, color) {
    const values = sessions.map(session => {
        const value = definition.get(session);
        return statsNumber(value);
    });
    if (!values.some(value => value !== null)) return '';
    const width = Math.max(920, 90 + sessions.length * 12), height = 245;
    const pad = { left: 52, right: 22, top: 20, bottom: 38 };
    const chartWidth = width - pad.left - pad.right;
    const chartHeight = height - pad.top - pad.bottom;
    const valid = values.filter(value => value !== null);
    const yMin = definition.min ?? 0;
    const yMax = definition.max ?? statsNiceMax(Math.max(...valid) * 1.05);
    const x = index => pad.left + (sessions.length === 1 ? chartWidth / 2 : index / (sessions.length - 1) * chartWidth);
    const y = value => pad.top + chartHeight - (Math.max(yMin, Math.min(yMax, value)) - yMin) / ((yMax - yMin) || 1) * chartHeight;
    const rolling = statsRollingMedian(values);
    const rollingPoints = rolling.map((value, index) => value === null ? null : ({ x: x(index), y: y(value) }));
    const ticks = [0, 0.25, 0.5, 0.75, 1].map(ratio => yMin + (yMax - yMin) * ratio);
    const grid = ticks.map(tick => `<g><line class="chart-gridline" x1="${pad.left}" y1="${y(tick)}" x2="${width - pad.right}" y2="${y(tick)}"/><text class="chart-axis-label" x="${pad.left - 10}" y="${y(tick) + 4}" text-anchor="end">${definition.tick ? definition.tick(tick) : Math.round(tick)}</text></g>`).join('');
    const points = values.map((value, index) => value === null ? '' : `<circle class="chart-point metric" cx="${x(index)}" cy="${y(value)}" r="3.8" style="fill:${color}"><title>${statsEsc(`${statsDate(sessions[index])} · ${definition.format(value)}`)}</title></circle>`).join('');
    const svg = `<div class="trajectory-chart metric-chart"><svg style="min-width:${width}px" viewBox="0 0 ${width} ${height}" role="img">${grid}<path class="chart-raw-line" d="${statsLinePath(values.map((value, index) => value === null ? null : ({ x: x(index), y: y(value) })))}" style="stroke:${color}"/>${points}<path class="chart-median" d="${statsLinePath(rollingPoints)}" style="stroke:${color}"/></svg></div>`;
    return statsChartFrame(definition.title, definition.subtitle, svg,
        `<div class="chart-legend"><span><i class="legend-dot" style="background:${color}"></i>${statsCopy('Raw sessions', '每局原始值')}</span><span><i class="legend-line" style="background:${color}"></i>${statsCopy('5-session median', '5 局滚动中位数')}</span></div>`);
}

function statsMetricDefinitions(mode) {
    const accuracy = {
        title: statsCopy('Accuracy', '正确率'),
        subtitle: statsCopy('Recognition or hit accuracy. Higher is better.', '辨认或命中正确率，越高越好。'),
        get: statsAccuracy, min: 0, max: 100,
        tick: value => `${Math.round(value)}%`, format: value => `${value.toFixed(1)}%`
    };
    const reaction = {
        title: statsCopy('Reaction time', '反应时间'),
        subtitle: statsCopy('Hit/response timing is supporting context, not the main growth score.', '命中/回答用时仅作为辅助信息，不混入主成长分。'),
        get: session => statsNumber(session.avgRt) > 0 ? Number(session.avgRt) : null,
        format: value => `${Math.round(value)} ms`
    };
    if (mode === 4) return [accuracy, {
        title: statsCopy('Target acquisition delay', '目标锁定等待'),
        subtitle: statsCopy('Average enemy appearance → head probe delay. Lower values indicate harder sessions.', '人物出现到头部符号闪现的平均等待；数值越低代表该局难度越高。'),
        get: session => statsNumber(session.averageLockDelayMs) > 0 ? Number(session.averageLockDelayMs) : null,
        format: value => `${Math.round(value)} ms`
    }, {
        title: statsCopy('Probe duration', '符号持续时间'),
        subtitle: statsCopy('Average head-symbol visibility. Shorter values are more demanding.', '头部符号平均可见时间；越短越难。'),
        get: session => statsNumber(session.averageProbeDurationMs) > 0 ? Number(session.averageProbeDurationMs) : null,
        format: value => `${Math.round(value)} ms`
    }];
    if (mode === 6) return [accuracy, {
        title: statsCopy('Switch errors', '规则切换错误'),
        subtitle: statsCopy('Wrong-target responses under the active rule. Lower is better.', '当前规则下击中错误目标的次数，越低越好。'),
        get: session => statsNumber(session.switchErrors),
        format: value => `${Math.round(value)} ${statsCopy('errors', '次')}`
    }];
    return [accuracy, reaction];
}

function renderDistribution(sessions, color) {
    const levels = [];
    sessions.forEach(session => {
        if (Array.isArray(session.difficultyHistory)) {
            session.difficultyHistory.forEach(value => {
                const level = statsNumber(value);
                if (level !== null) levels.push(level * 100);
            });
        }
    });
    if (levels.length < 5) return '';
    const bins = new Array(10).fill(0);
    levels.forEach(level => {
        const index = Math.max(0, Math.min(9, Math.floor((level - 10) / 19)));
        bins[index]++;
    });
    const max = Math.max(...bins) || 1;
    return `<section class="trajectory-panel distribution-panel"><div class="trajectory-heading"><div><h3>${statsCopy('Difficulty exposure', '难度经历分布')}</h3><p>${statsCopy('All recorded trials, grouped on the same Lv10–200 scale.', '汇总所有有记录的试次，并按 Lv10–200 固定区间分组。')}</p></div></div><div class="distribution-bars">${bins.map((count, index) => `<div class="distribution-column"><div class="distribution-value">${count}</div><div class="distribution-bar" style="height:${count / max * 100}%;background:${color}"></div><span>${10 + index * 19}</span></div>`).join('')}</div></section>`;
}

function statsSummaryCard(label, value, note = '') {
    return `<div class="growth-card"><div class="growth-label">${label}</div><div class="growth-value">${value}</div>${note ? `<div class="growth-note">${note}</div>` : ''}</div>`;
}

function statsModePrimary(session) {
    const mode = Number(session.mode);
    if (mode === 4) return {
        label: statsCopy('Avg lock delay', '平均锁定等待'),
        value: statsFormat(session.averageLockDelayMs, ' ms')
    };
    if (mode === 6) return {
        label: statsCopy('Switch errors', '切换错误'),
        value: statsFormat(session.switchErrors)
    };
    if (mode === 2 || mode === 7) return {
        label: statsCopy('Tracking volume', '跟枪时长'),
        value: statsFormat(session.trackingTime, ' s', 1)
    };
    return {
        label: statsCopy('Avg reaction', '平均反应'),
        value: statsNumber(session.avgRt) > 0 ? statsFormat(session.avgRt, ' ms') : '—'
    };
}

function statsSessionDetails(session) {
    const primary = statsModePrimary(session);
    const entries = [
        [statsCopy('Session ID', '单局 ID'), session.sessionId || statsCopy('Legacy record', '旧版记录')],
        [statsCopy('Start level', '开始等级'), statsLevel(session, 'startDifficulty') === null ? '—' : `Lv${statsLevel(session, 'startDifficulty')}`],
        [statsCopy('End level', '结束等级'), statsLevel(session) === null ? '—' : `Lv${statsLevel(session)}`],
        [statsCopy('Level change', '等级变化'), statsLevel(session) === null || statsLevel(session, 'startDifficulty') === null ? '—' : statsDelta(statsLevel(session) - statsLevel(session, 'startDifficulty'), ' Lv')],
        [statsCopy('Hits / misses / trials', '命中 / 未中 / 试次'), `${statsFormat(session.hits)} / ${statsFormat(session.misses)} / ${statsFormat(session.trials)}`],
        [statsCopy('Accuracy', '正确率'), statsFormat(statsAccuracy(session), '%', 1)],
        [statsCopy('Average / best RT', '平均 / 最佳反应'), `${statsFormat(session.avgRt, ' ms')} / ${statsFormat(session.minRt, ' ms')}`],
        [statsCopy('RT variability', '反应波动'), statsFormat(session.stdDevRt, ' ms')],
        [statsCopy('Training duration', '训练时长'), statsDuration(session)],
        [primary.label, primary.value]
    ];
    if (Number(session.mode) === 4) entries.push(
        [statsCopy('Probe duration', '符号持续'), statsFormat(session.averageProbeDurationMs, ' ms')],
        [statsCopy('Max decoys / noise', '最大干扰图案 / 噪声'), `${statsFormat(session.maxDecoyCount)} / ${statsFormat(session.maxNoiseCount)}`],
        [statsCopy('Valid / invalid trials', '有效 / 无效试次'), `${statsFormat(session.validFormalTrials)} / ${statsFormat(session.invalidTrials)}`]
    );
    if (Number(session.mode) === 6) entries.push(
        [statsCopy('Successful inhibition', '成功抑制'), statsFormat(session.inhibitionSuccess)]
    );
    return entries.map(([label, value]) => `<div><span>${label}</span><strong>${statsEsc(value)}</strong></div>`).join('');
}

function renderHistoryLedger(sessions) {
    const newest = sessions.slice().sort((a, b) => statsTimestamp(b) - statsTimestamp(a));
    const totalPages = Math.max(1, Math.ceil(newest.length / StatsDashboardState.pageSize));
    StatsDashboardState.historyPage = Math.min(Math.max(0, StatsDashboardState.historyPage), totalPages - 1);
    const start = StatsDashboardState.historyPage * StatsDashboardState.pageSize;
    const page = newest.slice(start, start + StatsDashboardState.pageSize);
    const rows = page.length ? page.map((session, index) => {
        const primary = statsModePrimary(session);
        const level = statsLevel(session);
        return `<details class="history-entry">
            <summary class="history-summary">
                <span class="history-index">#${newest.length - (start + index)}</span>
                <span class="history-mode"><i style="background:${statsModeColor(session.mode)}"></i>${statsEsc(statsModeName(session.mode))}</span>
                <span class="history-condition">${session.strobe ? statsCopy('Strobe', '频闪') : statsCopy('Normal', '普通')}</span>
                <span><small>${statsCopy('Final', '结束')}</small>${level === null ? '—' : `Lv${level}`}</span>
                <span><small>${statsCopy('Accuracy', '正确率')}</small>${statsFormat(statsAccuracy(session), '%', 1)}</span>
                <span><small>${primary.label}</small>${primary.value}</span>
                <time>${statsEsc(statsDate(session, true))}</time>
            </summary>
            <div class="history-detail-grid">${statsSessionDetails(session)}</div>
        </details>`;
    }).join('') : `<div class="analytics-empty-small">${statsCopy('No history in this filter.', '当前筛选条件下暂无历史记录。')}</div>`;
    const pagination = newest.length > StatsDashboardState.pageSize ? `<div class="history-pagination"><button onclick="changeStatsHistoryPage(-1)" ${StatsDashboardState.historyPage === 0 ? 'disabled' : ''}>← ${statsCopy('Newer', '较新')}</button><span>${statsCopy('Page', '第')} ${StatsDashboardState.historyPage + 1} / ${totalPages} · ${newest.length} ${statsCopy('sessions', '局')}</span><button onclick="changeStatsHistoryPage(1)" ${StatsDashboardState.historyPage >= totalPages - 1 ? 'disabled' : ''}>${statsCopy('Older', '较早')} →</button></div>` : '';
    return `<section class="history-ledger"><div class="section-title-row"><div><h3>${statsCopy('Session history', '单局历史')}</h3><p>${statsCopy('Every stored session is retained. Expand any row for full details.', '保留每一条历史；展开任意一局可查看完整细节。')}</p></div><span>${newest.length} ${statsCopy('sessions', '局')}</span></div>${rows}${pagination}</section>`;
}

function renderStatsModeCards(stats) {
    return `<div class="mode-progress-grid">${ModeRegistry.getAllIds().map(mode => {
        const sessions = stats.filter(session => Number(session.mode) === mode);
        const supportsStrobe = mode === 2 || mode === 7;
        const normal = sessions.filter(session => !session.strobe);
        const strobe = sessions.filter(session => session.strobe);
        const primary = supportsStrobe && normal.length ? normal : sessions;
        const trend = statsTrend(primary);
        const strobeTrend = statsTrend(strobe);
        const color = statsModeColor(mode);
        if (!sessions.length) return `<button class="mode-progress-card empty" onclick="switchStatsTab(${mode})" style="--mode-color:${color}"><div class="mode-progress-head"><strong>${statsEsc(statsModeName(mode))}</strong><span>0</span></div><div class="mode-card-empty">${statsCopy('No history yet', '暂无训练历史')}</div></button>`;
        return `<button class="mode-progress-card" onclick="switchStatsTab(${mode})" style="--mode-color:${color}">
            <div class="mode-progress-head"><strong>${statsEsc(statsModeName(mode))}</strong><span>${sessions.length} ${statsCopy('sessions', '局')}</span></div>
            <div class="mode-progress-level"><span>${supportsStrobe ? statsCopy('Normal · recent 5 median', '普通 · 近 5 局中位数') : statsCopy('Recent 5 median', '近 5 局中位数')}</span><b>Lv${Math.round(trend.latest)}</b></div>
            ${statsSparkline(primary.map(session => statsLevel(session)), color)}
            <div class="mode-progress-foot">${supportsStrobe
                ? `<span>${statsCopy('Normal growth', '普通成长')} <b class="${trend.long !== null && trend.long >= 0 ? 'positive' : 'negative'}">${statsDelta(trend.long, ' Lv')}</b></span><span>${statsCopy('Strobe recent', '频闪近期')} <b>${strobeTrend.latest === null ? '—' : `Lv${Math.round(strobeTrend.latest)}`}</b></span>`
                : `<span>${statsCopy('All-time', '长期')} <b class="${trend.long !== null && trend.long >= 0 ? 'positive' : 'negative'}">${statsDelta(trend.long, ' Lv')}</b></span><span>${statsCopy('Recent', '近期')} <b class="${trend.recent !== null && trend.recent >= 0 ? 'positive' : 'negative'}">${statsDelta(trend.recent, ' Lv')}</b></span>`}
            </div>
            <time>${statsDate(sessions[sessions.length - 1])}</time>
        </button>`;
    }).join('')}</div>`;
}

function renderOverview(stats) {
    const activeDays = new Set(stats.map(session => {
        const timestamp = statsTimestamp(session);
        return timestamp ? new Date(timestamp).toDateString() : null;
    }).filter(Boolean)).size;
    const totalTime = Stats.getTotalTime(stats).formatted;
    return `<div class="analytics-section">
        <div class="analytics-kpis">
            ${statsSummaryCard(statsCopy('Sessions', '训练局数'), stats.length)}
            ${statsSummaryCard(statsCopy('Training time', '训练时长'), totalTime)}
            ${statsSummaryCard(statsCopy('Active days', '训练天数'), activeDays)}
            ${statsSummaryCard(statsCopy('Current streak', '当前连续'), `${Stats.getStreak(stats)} ${statsCopy('days', '天')}`)}
        </div>
        <div class="section-title-row"><div><h3>${statsCopy('Growth by scenario', '各场景成长')}</h3><p>${statsCopy('Level is the shared progression scale; modes are never compared by mixed-unit composite scores.', '等级是统一成长尺度，不再用混合单位的综合分跨关卡比较。')}</p></div></div>
        ${renderStatsModeCards(stats)}
        ${renderHistoryLedger(stats)}
    </div>`;
}

function statsFilteredModeSessions(stats, mode) {
    return stats.filter(session => Number(session.mode) === mode && (
        StatsDashboardState.condition === 'all'
        || (StatsDashboardState.condition === 'strobe' ? Boolean(session.strobe) : !session.strobe)
    ));
}

function renderModeDetail(stats, mode) {
    const color = statsModeColor(mode);
    const modeSessions = stats.filter(session => Number(session.mode) === mode);
    const sessions = statsFilteredModeSessions(stats, mode);
    const trend = statsTrend(sessions);
    const canStrobe = mode === 2 || mode === 7;
    const filters = canStrobe ? `<div class="stats-filter-group">${[
        ['all', statsCopy('All', '全部')], ['normal', statsCopy('Normal', '普通')], ['strobe', statsCopy('Strobe', '频闪')]
    ].map(([key, label]) => `<button class="filter-button ${StatsDashboardState.condition === key ? 'active' : ''}" onclick="setStatsCondition('${key}')">${label}</button>`).join('')}</div>` : '';
    if (!modeSessions.length) return `<div class="analytics-section"><div class="mode-detail-title" style="--mode-color:${color}"><div><span>MODE ${mode}</span><h2>${statsEsc(statsModeName(mode))}</h2></div></div><div class="analytics-empty-large">${statsCopy('Complete a session to begin this growth history.', '完成一局训练后，这里会开始记录成长轨迹。')}</div></div>`;
    const summary = `<div class="growth-summary-grid">
        ${statsSummaryCard(statsCopy('Recent 5 median', '近 5 局中位数'), trend.latest === null ? '—' : `Lv${Math.round(trend.latest)}`, statsCopy('Stable current level', '当前稳定水平'))}
        ${statsSummaryCard(statsCopy('All-time growth', '长期成长'), statsDelta(trend.long, ' Lv'), statsCopy('Recent 5 vs first 5', '近 5 局对比最初 5 局'))}
        ${statsSummaryCard(statsCopy('Recent momentum', '近期趋势'), statsDelta(trend.recent, ' Lv'), sessions.length < 10 ? statsCopy('Needs 10 sessions', '需要至少 10 局') : statsCopy('Last 5 vs previous 5', '近 5 局对比此前 5 局'))}
        ${statsSummaryCard(statsCopy('Best final level', '最高结束等级'), trend.best === null ? '—' : `Lv${Math.round(trend.best)}`, `${sessions.length} ${statsCopy('sessions in view', '局符合筛选')}`)}
    </div>`;
    const metricCharts = statsMetricDefinitions(mode).map((definition, index) => renderMetricChart(sessions, definition, index === 0 ? '#53e6b5' : index === 1 ? '#5ec8ff' : '#ffbf69')).join('');
    return `<div class="analytics-section">
        <div class="mode-detail-title" style="--mode-color:${color}"><div><span>MODE ${mode}</span><h2>${statsEsc(statsModeName(mode))}</h2></div>${filters}</div>
        ${summary}
        ${renderLevelJourneyChart(sessions, color)}
        <div class="metric-panels">${metricCharts}</div>
        ${renderDistribution(sessions, color)}
        ${renderHistoryLedger(sessions)}
    </div>`;
}

function statsRenderCurrent() {
    const content = document.getElementById('stats-content');
    if (!content) return;
    const sessions = statsSessions();
    content.innerHTML = StatsDashboardState.mode === 'all'
        ? renderOverview(sessions)
        : renderModeDetail(sessions, Number(StatsDashboardState.mode));
}

function updateStatsDisplay() {
    const container = document.getElementById('stats-screen');
    if (!container) return;
    const header = container.querySelector('.stats-header');
    container.innerHTML = '';
    if (header) container.appendChild(header);
    const modeTabs = ModeRegistry.getAllIds().map(mode => `<button class="analytics-tab" data-mode="${mode}" onclick="switchStatsTab(${mode})"><span>${mode}</span>${statsEsc(statsModeName(mode))}</button>`).join('');
    const main = document.createElement('main');
    main.className = 'analytics-shell';
    main.innerHTML = `<div class="analytics-toolbar"><div class="analytics-tabs"><button class="analytics-tab" data-mode="all" onclick="switchStatsTab('all')">${statsCopy('OVERVIEW', '总览')}</button>${modeTabs}</div><div class="analytics-actions"><button class="stats-action-button" onclick="exportStatsHistory()">${statsCopy('Export history', '导出历史')}</button><button class="stats-action-button danger" onclick="clearStatsHistory()">${statsCopy('Clear', '清空')}</button></div></div><div id="stats-content"></div>`;
    container.appendChild(main);
    if (StatsDashboardState.mode !== 'all' && !ModeRegistry.getAllIds().includes(Number(StatsDashboardState.mode))) StatsDashboardState.mode = 'all';
    document.querySelectorAll('.analytics-tab').forEach(tab => tab.classList.toggle('active', String(tab.dataset.mode) === String(StatsDashboardState.mode)));
    statsRenderCurrent();
}

window.switchStatsTab = function switchStatsTab(mode) {
    StatsDashboardState.mode = mode === 'all' ? 'all' : Number(mode);
    StatsDashboardState.condition = mode === 'all' || ![2, 7].includes(Number(mode)) ? 'all' : 'normal';
    StatsDashboardState.historyPage = 0;
    document.querySelectorAll('.analytics-tab').forEach(tab => tab.classList.toggle('active', String(tab.dataset.mode) === String(StatsDashboardState.mode)));
    statsRenderCurrent();
};

window.setStatsCondition = function setStatsCondition(condition) {
    StatsDashboardState.condition = ['all', 'normal', 'strobe'].includes(condition) ? condition : 'all';
    StatsDashboardState.historyPage = 0;
    statsRenderCurrent();
};

window.changeStatsHistoryPage = function changeStatsHistoryPage(delta) {
    StatsDashboardState.historyPage = Math.max(0, StatsDashboardState.historyPage + Number(delta || 0));
    statsRenderCurrent();
    document.querySelector('.history-ledger')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

window.exportStatsHistory = function exportStatsHistory() {
    const data = JSON.stringify(Storage.exportData(), null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `neuroaim-history-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 0);
};

window.clearStatsHistory = function clearStatsHistory() {
    if (confirm(statsCopy('Delete every stored training session? This cannot be undone.', '确定删除全部训练历史吗？此操作无法撤销。'))) {
        Storage.clearStats();
        StatsDashboardState.historyPage = 0;
        updateStatsDisplay();
    }
};

// Backward-compatible entry points used by older integrations.
function loadStats() {
    return Storage.getStats();
}

function saveGameStats(session) {
    if (!session.sessionId) session.sessionId = `legacy-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    Storage.addSession(session);
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { updateStatsDisplay, loadStats, saveGameStats };
}
