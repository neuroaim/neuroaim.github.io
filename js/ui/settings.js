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
    
    // Sensitivity slider and input
    const sensEl = document.getElementById('setting-sensitivity');
    const sensInput = document.getElementById('sens-input');
    const sens = settings.sensitivity || 1.0;
    if (sensEl) sensEl.value = sens;
    if (sensInput) sensInput.value = sens.toFixed(2);
    
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
    const modeCount = ModeRegistry ? ModeRegistry.count() : 7;
    for (let mode = 1; mode <= modeCount; mode++) {
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

function updateSensitivity(value) {
    let sens = parseFloat(value);
    // 限制范围 0.01 - 10.00
    sens = Math.max(0.01, Math.min(10.00, sens));
    // 保留两位小数
    sens = Math.round(sens * 100) / 100;
    
    settings.sensitivity = sens;
    
    // 同步更新滑块和输入框
    const sliderEl = document.getElementById('setting-sensitivity');
    const inputEl = document.getElementById('sens-input');
    
    if (sliderEl) sliderEl.value = sens;
    if (inputEl) inputEl.value = sens.toFixed(2);
    
    saveSettings();
}

// 处理灵敏度输入框的输入
function onSensitivityInput(value) {
    let sens = parseFloat(value);
    if (isNaN(sens)) return;
    sens = Math.max(0.01, Math.min(10.00, sens));
    
    // 只更新滑块，不碰输入框
    const sliderEl = document.getElementById('setting-sensitivity');
    if (sliderEl) sliderEl.value = sens;
    
    settings.sensitivity = sens;
    saveSettings();
}

// 处理灵敏度输入框失去焦点时的校验
function onSensitivityBlur(el) {
    let sens = parseFloat(el.value) || 1.0;
    sens = Math.max(0.01, Math.min(10.00, sens));
    sens = Math.round(sens * 100) / 100;
    el.value = sens.toFixed(2);
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
        updateSensitivity, updateVolume,
        setCrosshair, updateCrosshairScale,
        updateCrosshairPreview, drawCrosshairAt,
        toggleStrobe, getDifficultyLevel, setDifficultyLevel, isStrobeEnabled
    };
}