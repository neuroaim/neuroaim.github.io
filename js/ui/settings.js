// ==================== SETTINGS UI ====================
// Settings panel controls and crosshair preview

// Global settings object (for backward compatibility)
var settings = {};

// ===== INITIALIZATION =====
function loadSettings() {
    settings = Storage.getSettings();
    return settings;
}

function saveSettings() {
    Storage.saveSettings(settings);
}

function resetSettings() {
    settings = JSON.parse(JSON.stringify(Storage.defaultSettings));
    Storage.saveSettings(settings);
    updateSettingsUI();
    updateCrosshairPreview();
}

// ===== UI UPDATE FUNCTIONS =====
function updateSettingsUI() {
    // Sound toggle
    const soundEl = document.getElementById('setting-soundEnabled');
    if (soundEl) soundEl.checked = settings.soundEnabled;
    
    // Volume slider
    const volEl = document.getElementById('setting-volume');
    const volVal = document.getElementById('volume-value');
    if (volEl) volEl.value = settings.volume;
    if (volVal) volVal.innerText = Math.round(settings.volume * 100) + '%';
    
    // Game-specific hip-fire sensitivity, converted to one angular scale.
    const profileId = settings.sensitivityGame || 'valorant';
    const profileEl = document.getElementById('setting-sensitivity-game');
    const sensEl = document.getElementById('setting-sensitivity');
    const sensInput = document.getElementById('sens-input');
    const profile = getSensitivityProfile(profileId);
    const sens = Number(settings.sensitivity) > 0 ? Number(settings.sensitivity) : 1;
    if (profileEl) profileEl.value = profileId;
    configureSensitivityInputs(profile);
    if (sensEl) sensEl.value = sens;
    if (sensInput) sensInput.value = formatSensitivity(sens, profile);
    updateSensitivityReadout();
    
    // Crosshair scale slider
    const scaleEl = document.getElementById('setting-scale');
    const scaleVal = document.getElementById('scale-value');
    if (scaleEl) scaleEl.value = settings.crosshairScale;
    if (scaleVal) scaleVal.innerText = settings.crosshairScale.toFixed(1) + 'x';
    
    // Crosshair type buttons
    document.querySelectorAll('.crosshair-option').forEach(el => {
        el.classList.toggle('active', el.dataset.ch === settings.crosshair);
    });
    
    // Per-mode strobe toggles - 从 Storage 读取而不是 settings
    const modeIds = [2, 7];
    for (const mode of modeIds) {
        const strobeEl = document.getElementById(`strobe-mode-${mode}`);
        if (strobeEl) {
            // 直接从 Storage 读取，确保数据一致
            strobeEl.checked = Storage.isStrobeEnabled(mode);
        }
    }
}

function updateSetting(key, value) {
    settings[key] = value;
    saveSettings();
}

function formatSensitivity(value, profile = getSensitivityProfile(settings.sensitivityGame)) {
    return Number(value).toFixed(profile.decimals ?? 2);
}

function clampSensitivity(value, profile = getSensitivityProfile(settings.sensitivityGame)) {
    const parsed = Number(value);
    const fallback = Number(settings.sensitivity) > 0 ? Number(settings.sensitivity) : 1;
    return Math.max(profile.min, Math.min(profile.max, Number.isFinite(parsed) ? parsed : fallback));
}

function configureSensitivityInputs(profile = getSensitivityProfile(settings.sensitivityGame)) {
    const sliderEl = document.getElementById('setting-sensitivity');
    const inputEl = document.getElementById('sens-input');
    const rangeEl = document.getElementById('sensitivity-range');
    [sliderEl, inputEl].forEach(el => {
        if (!el) return;
        el.min = profile.min;
        el.max = profile.max;
        el.step = profile.step;
    });
    if (rangeEl) rangeEl.textContent = `(${profile.min} - ${profile.max})`;
}

function updateSensitivityReadout() {
    const output = document.getElementById('sensitivity-equivalent');
    if (output) {
        const cs = convertSensitivity(settings.sensitivity, settings.sensitivityGame, 'cs2');
        const valorant = convertSensitivity(settings.sensitivity, settings.sensitivityGame, 'valorant');
        output.textContent = `CS ${cs.toFixed(6)} · VAL ${valorant.toFixed(6)}`;
    }
    const fovOutput = document.getElementById('trainer-fov-value');
    if (fovOutput) {
        const aspect = window.innerWidth / Math.max(1, window.innerHeight);
        const verticalRadians = CFG.camera.verticalFov * Math.PI / 180;
        const horizontalFov = 2 * Math.atan(Math.tan(verticalRadians / 2) * aspect) * 180 / Math.PI;
        fovOutput.textContent = `CS · ${horizontalFov.toFixed(2)}° H / ${CFG.camera.verticalFov.toFixed(2)}° V`;
    }
}

function updateSensitivityGame(profileId) {
    const previousId = settings.sensitivityGame || 'valorant';
    const nextId = CFG.sensitivityProfiles[profileId] ? profileId : 'valorant';
    const nextProfile = getSensitivityProfile(nextId);
    const converted = convertSensitivity(settings.sensitivity, previousId, nextId);
    settings.sensitivityGame = nextId;
    settings.sensitivity = clampSensitivity(converted, nextProfile);
    saveSettings();
    updateSettingsUI();
}

function updateSensitivity(value) {
    const profile = getSensitivityProfile(settings.sensitivityGame);
    const sens = clampSensitivity(value, profile);
    
    settings.sensitivity = sens;
    
    // 同步更新滑块和输入框
    const sliderEl = document.getElementById('setting-sensitivity');
    const inputEl = document.getElementById('sens-input');
    
    if (sliderEl) sliderEl.value = sens;
    if (inputEl) inputEl.value = formatSensitivity(sens, profile);
    updateSensitivityReadout();
    saveSettings();
}

// 处理灵敏度输入框的输入
function onSensitivityInput(value) {
    const profile = getSensitivityProfile(settings.sensitivityGame);
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return;
    const sens = clampSensitivity(parsed, profile);
    
    // 只更新滑块，不碰输入框
    const sliderEl = document.getElementById('setting-sensitivity');
    if (sliderEl) sliderEl.value = sens;
    
    settings.sensitivity = sens;
    updateSensitivityReadout();
    saveSettings();
}

// 处理灵敏度输入框失去焦点时的校验
function onSensitivityBlur(el) {
    const profile = getSensitivityProfile(settings.sensitivityGame);
    const sens = clampSensitivity(el.value, profile);
    el.value = formatSensitivity(sens, profile);
    updateSensitivity(sens);
}

function updateVolume(value) {
    settings.volume = parseFloat(value);
    const el = document.getElementById('volume-value');
    if (el) el.innerText = Math.round(settings.volume * 100) + '%';
    saveSettings();
}

function setCrosshair(type) {
    settings.crosshair = type;
    document.querySelectorAll('.crosshair-option').forEach(el => {
        el.classList.toggle('active', el.dataset.ch === type);
    });
    updateCrosshairPreview();
    saveSettings();
}

function updateCrosshairScale(value) {
    settings.crosshairScale = parseFloat(value);
    const el = document.getElementById('scale-value');
    if (el) el.innerText = settings.crosshairScale.toFixed(1) + 'x';
    updateCrosshairPreview();
    saveSettings();
}

function updateCrosshairPreview() {
    const canvas = document.getElementById('crosshair-preview-canvas');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const w = canvas.parentElement?.clientWidth || 200;
    const h = 80;
    canvas.width = w;
    canvas.height = h;
    
    // Background
    ctx.fillStyle = '#0a0a0f';
    ctx.fillRect(0, 0, w, h);
    
    // Draw crosshair preview
    drawCrosshairAt(ctx, w / 2, h / 2, settings.crosshair, settings.crosshairScale);
}

function drawCrosshairAt(ctx, x, y, style, scale) {
    ctx.save();
    ctx.strokeStyle = '#ffffff';
    ctx.fillStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#00d9ff';
    ctx.shadowBlur = 8;
    
    const size = 12 * scale;
    const gap = 4 * scale;
    
    switch (style) {
        case 'cross':
            ctx.beginPath();
            ctx.moveTo(x - size, y);
            ctx.lineTo(x - gap, y);
            ctx.moveTo(x + gap, y);
            ctx.lineTo(x + size, y);
            ctx.moveTo(x, y - size);
            ctx.lineTo(x, y - gap);
            ctx.moveTo(x, y + gap);
            ctx.lineTo(x, y + size);
            ctx.stroke();
            break;
            
        case 'dot':
            ctx.beginPath();
            ctx.arc(x, y, 3 * scale, 0, Math.PI * 2);
            ctx.fill();
            break;
            
        case 'circle':
            ctx.beginPath();
            ctx.arc(x, y, size * 0.6, 0, Math.PI * 2);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(x, y, 2 * scale, 0, Math.PI * 2);
            ctx.fill();
            break;
            
        case 'crossdot':
            // 纯粹的无空心小十字（无中间空隙）
            const smallSize = 8 * scale;
            ctx.beginPath();
            ctx.moveTo(x - smallSize, y);
            ctx.lineTo(x + smallSize, y);
            ctx.moveTo(x, y - smallSize);
            ctx.lineTo(x, y + smallSize);
            ctx.stroke();
            break;
    }
    
    ctx.restore();
}

// ===== STROBE TOGGLE =====
function toggleStrobe(mode, enabled) {
    if (mode !== 2 && mode !== 7) return;
    if (!settings.strobeEnabled) settings.strobeEnabled = {};
    settings.strobeEnabled[mode] = enabled;
    saveSettings();
    
    // Refresh mode cards if available
    if (typeof renderModeCards === 'function') {
        renderModeCards();
    }
}

// 用于HTML中的onchange调用
function toggleModeStrobe(mode, enabled) {
    if (mode !== 2 && mode !== 7) return;
    Storage.setStrobeEnabled(mode, enabled);
    
    // 同步更新settings对象
    if (!settings.strobeEnabled) settings.strobeEnabled = {};
    settings.strobeEnabled[mode] = enabled;
    
    // 刷新mode卡片显示
    if (typeof renderModeCards === 'function') {
        renderModeCards();
    }
}

// ===== DIFFICULTY LEVEL (Backward Compatibility) =====
function getDifficultyLevel(mode, isStrobe) {
    return Storage.getDifficultyLevel(mode, isStrobe);
}

function setDifficultyLevel(mode, isStrobe, level) {
    Storage.setDifficultyLevel(mode, isStrobe, level);
}

function isStrobeEnabled(mode) {
    return Storage.isStrobeEnabled(mode);
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        loadSettings, saveSettings, resetSettings,
        updateSettingsUI, updateSetting,
        updateSensitivity, updateSensitivityGame, updateVolume,
        setCrosshair, updateCrosshairScale,
        updateCrosshairPreview, drawCrosshairAt,
        toggleStrobe, getDifficultyLevel, setDifficultyLevel, isStrobeEnabled
    };
}
