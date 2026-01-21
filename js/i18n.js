// ==================== 语言配置 ====================
const LANG_KEY = 'neuroaim_language';

const i18n = {
    current: 'en',
    
    strings: {
        en: {
            // Menu Screen
            title: 'NEURO-AIM',
            subtitle: 'Neural-Optimized FPS Aiming Trainer',
            version: '8 MODES | ADAPTIVE DIFFICULTY',
            statistics: 'STATISTICS',
            trainingGuide: 'TRAINING GUIDE',
            settings: 'SETTINGS',
            adaptiveInfo: 'ADAPTIVE DIFFICULTY: Training auto-adjusts to your skill level (i+1 principle)',
            scienceTitle: 'Scientific Foundations of Aiming',
            
            // Mode Names
            mode1Name: 'GABOR SCOUT',
            mode1Tag: 'V1 CORTEX + PERCEPTION',
            mode1Desc: 'Identify <strong>Vertical</strong> targets in noise.',
            
            mode2Name: 'PURE TRACKING',
            mode2Tag: 'CEREBELLUM + PREDICTION',
            mode2Desc: 'Track <strong>organic curves</strong>.',
            
            mode3Name: 'NO CROSSHAIR SHOOTING',
            mode3Tag: 'PREMOTOR + INHIBITION',
            mode3Desc: 'Reduce your visual dependency, train your mouse-screen spatial awareness.',
            
            mode4Name: 'LANDOLT SACCADE',
            mode4Tag: 'DISCRIMINATION + VISUOMOTOR',
            mode4Desc: 'Aim at target → Press <strong>WASD</strong> for gap direction.',
            
            mode5Name: 'PARAFOVEAL GHOST',
            mode5Tag: 'PPC + COVERT ATTENTION',
            mode5Desc: 'Track center. Shoot <strong>blue</strong> ghosts. Ignore <strong>red</strong>.',
            
            mode6Name: 'MEMORY SEQUENCER',
            mode6Tag: 'dlPFC + SPATIAL MEMORY',
            mode6Desc: 'Memorize <strong>sequence</strong>. Shoot positions in order.',
            
            mode7Name: 'COGNITIVE SWITCH',
            mode7Tag: 'ACC + RULE FLEXIBILITY',
            mode7Desc: 'Rules change with <strong>environment</strong>. Adapt instantly.',

            mode8Name: 'HORIZONTAL TRACKING',
            mode8Tag: 'CEREBELLUM + PREDICTION',
            mode8Desc: 'Track a <strong>bar target</strong> moving smoothly left and right.',
            
            // HUD
            time: 'TIME',
            trials: 'TRIALS',
            accuracy: 'ACCURACY',
            difficulty: 'DIFFICULTY',
            escPause: '[ESC] PAUSE',
            
            // Game States
            clickToBegin: 'CLICK TO BEGIN',
            paused: 'PAUSED',
            resume: 'RESUME',
            quit: 'QUIT',
            confirmQuit: 'CONFIRM QUIT?',
            cancel: 'CANCEL',
            
            // Result Screen
            sessionComplete: 'SESSION COMPLETE',
            normal: 'NORMAL',
            strobeOn: 'STROBE ON',
            avgReaction: 'AVG REACTION',
            hitsTrials: 'HITS / TRIALS',
            finalDifficulty: 'FINAL DIFFICULTY',
            bestRT: 'BEST RT',
            worstRT: 'WORST RT',
            consistency: 'CONSISTENCY',
            menu: 'MENU',
            again: 'AGAIN',
            
            // Flash Messages
            invalid: 'INVALID',
            missed: 'MISSED',
            timeout: 'TIMEOUT',
            brokeGaze: 'BROKE GAZE',
            holdSteady: 'HOLD STEADY',
            gazeBroken: 'GAZE BROKEN',
            tracking: '+TRACKING',
            imprecise: 'IMPRECISE',
            wrong: 'WRONG',
            aimFirst: 'AIM FIRST',
            missedGhost: 'MISSED GHOST',
            returnFailed: 'RETURN FAILED',
            inhibit: 'INHIBIT!',
            wrongOrder: 'WRONG ORDER',
            wrongTarget: 'WRONG TARGET',
            ruleSwitch: 'RULE SWITCH',
            
            // Training Guide
            guideTitle: 'TRAINING GUIDE',
            neuralPathways: 'Neural Pathways',
            whenImprove: 'When Will I Improve?',
            protocol: 'Training Protocol',
            strobeMode: 'Strobe Mode',
            close: 'CLOSE',
            
            // Settings
            settingsTitle: 'SETTINGS',
            language: 'LANGUAGE',
            strobeSettings: 'STROBE TRAINING',
            strobeDesc: 'Enable strobe effect to increase training difficulty',
            strobeWarning: '⚠️ WARNING: Do NOT enable if you have photosensitive epilepsy!',
            strobeTooltip: 'Recommended for Mode 2. By intermittently depriving vision, it forces the cerebellum to work under high load, greatly improving tracking training efficiency.',
            mouse: 'CONTROLS',
            sensitivity: 'Sensitivity',
            audio: 'AUDIO',
            soundEffects: 'Sound Effects',
            volume: 'Volume',
            crosshair: 'CROSSHAIR',
            scale: 'Scale',
            reset: 'RESET ALL',
            saveClose: 'SAVE & CLOSE',
            
            // Stats Screen
            statsTitle: 'TRAINING ANALYTICS',
            back: '← BACK',
            totalSessions: 'TOTAL SESSIONS',
            trainingTime: 'TRAINING TIME',
            avgNCS: 'AVG NCS SCORE',
            avgAccuracy: 'AVG ACCURACY',
            avgRT: 'AVG RT',
            avgDifficulty: 'AVG DIFFICULTY',
            noData: 'NO TRAINING DATA',
            noDataDesc: 'Complete training sessions to see statistics.',
            overview: 'OVERVIEW',
            clearAllData: 'CLEAR ALL DATA',
            clearConfirm: 'Delete all training history? Cannot be undone.',
            
            // Stats page details
            completedSessions: 'Completed Sessions',
            totalTime: 'Total Time',
            globalAvgNCS: 'Global Avg NCS',
            globalAvgAcc: 'Global Avg Acc',
            globalAvgRT: 'Global Avg RT',
            globalAvgDiff: 'Global Avg Diff',
            modePerformance: 'Mode Performance',
            recentSessions: 'Recent Sessions',
            strobe: 'Strobe',
            noDataYet: 'No data',
            avgNCSLabel: 'Avg NCS',
            bestLabel: 'Best',
            bestAcc: 'Best Acc',
            peakLv: 'Peak Lv',
            trend: 'Trend (Last 50)',
            levelDistribution: 'Level Distribution',
            need2Sessions: 'Need 2+ sessions',
            needMoreData: 'Need more data',
            noSessionsYet: 'No sessions yet',
            clearData: 'Clear Data',
            deleteAllData: 'Delete all data?',
            sessions: 'sessions',
        },
        
        zh: {
            // Menu Screen
            title: 'Neuro-Aim',
            subtitle: '神经科学优化的FPS瞄准训练器',
            version: '8种模式 | 自适应难度',
            statistics: '统计数据',
            trainingGuide: '训练指南',
            settings: '设置',
            adaptiveInfo: '自适应难度：训练自动调整到你的技能水平（i+1原则）',
            scienceTitle: '瞄准的科学基础',
            
            // Mode Names
            mode1Name: 'GABOR侦察',
            mode1Tag: 'V1视皮层 + 感知',
            mode1Desc: '识别噪声中的<strong>竖向</strong>目标。',
            
            mode2Name: '纯粹追踪',
            mode2Tag: '小脑 + 预测',
            mode2Desc: '追踪<strong>曲线运动</strong>。击杀后保持稳定。',
            
            mode3Name: '无准星射击',
            mode3Tag: '前运动皮层 + 抑制',
            mode3Desc: '减少你的视觉依赖，训练你的鼠标-屏幕感知能力。',
            
            mode4Name: 'LANDOLT扫视',
            mode4Tag: '辨别 + 视觉运动',
            mode4Desc: '瞄准目标 → 按<strong>WASD</strong>指示缺口方向。',
            
            mode5Name: '副中央幽灵',
            mode5Tag: 'PPC + 隐蔽注意',
            mode5Desc: '追踪中心。射击<strong>蓝色</strong>幽灵。忽略<strong>红色</strong>。',
            
            mode6Name: '记忆序列',
            mode6Tag: 'dlPFC + 空间记忆',
            mode6Desc: '记住<strong>序列</strong>。按顺序射击位置。',
            
            mode7Name: '认知切换',
            mode7Tag: 'ACC + 规则灵活性',
            mode7Desc: '规则随<strong>环境</strong>变化。立即适应。',

            mode8Name: '水平追踪',
            mode8Tag: '小脑 + 预测',
            mode8Desc: '追踪一个<strong>条形目标</strong>，左右平滑移动。',
            
            // HUD
            time: '时间',
            trials: '尝试',
            accuracy: '准确率',
            difficulty: '难度',
            escPause: '[ESC] 暂停',
            
            // Game States
            clickToBegin: '点击开始',
            paused: '已暂停',
            resume: '继续',
            quit: '退出',
            confirmQuit: '确认退出？',
            cancel: '取消',
            
            // Result Screen
            sessionComplete: '训练完成',
            normal: '普通',
            strobeOn: '频闪开启',
            avgReaction: '平均反应',
            hitsTrials: '命中 / 尝试',
            finalDifficulty: '最终难度',
            bestRT: '最佳反应',
            worstRT: '最差反应',
            consistency: '一致性',
            menu: '菜单',
            again: '再来',
            
            // Flash Messages
            invalid: '无效',
            missed: '未命中',
            timeout: '超时',
            brokeGaze: '视线中断',
            holdSteady: '保持稳定',
            gazeBroken: '视线已断',
            tracking: '+追踪中',
            imprecise: '不精准',
            wrong: '错误',
            aimFirst: '先瞄准',
            missedGhost: '错过幽灵',
            returnFailed: '返回失败',
            inhibit: '抑制！',
            wrongOrder: '顺序错误',
            wrongTarget: '错误目标',
            ruleSwitch: '规则切换',
            
            // Training Guide
            guideTitle: '训练指南',
            neuralPathways: '神经通路',
            whenImprove: '何时会进步？',
            protocol: '训练方案',
            strobeMode: '频闪模式',
            close: '关闭',
            
            // Settings - 设置页面
            settingsTitle: '设置',
            language: '语言',
            strobeSettings: '频闪训练',
            strobeDesc: '启用频闪效果以增加训练难度',
            strobeWarning: '⚠️ 警告：如果您有光敏性癫痫，请勿启用！',
            strobeTooltip: '推荐用于模式2。通过间歇性剥夺视觉，迫使小脑在高负荷下工作，大大提高追踪训练效率。',
            mouse: '控制',
            sensitivity: '灵敏度',
            audio: '音频',
            soundEffects: '音效',
            volume: '音量',
            crosshair: '准星',
            scale: '缩放',
            reset: '重置全部',
            saveClose: '保存并关闭',
            
            // Stats Screen
            statsTitle: '训练分析',
            back: '← 返回',
            totalSessions: '总训练次数',
            trainingTime: '训练时长',
            avgNCS: '平均NCS分数',
            avgAccuracy: '平均准确率',
            avgRT: '平均反应时间',
            avgDifficulty: '平均难度',
            noData: '无训练数据',
            noDataDesc: '完成训练以查看统计数据。',
            overview: '总览',
            clearAllData: '清除所有数据',
            clearConfirm: '删除所有训练历史？无法撤销。',
            
            // Stats page details
            completedSessions: '完成训练',
            totalTime: '总时长',
            globalAvgNCS: '全局平均NCS',
            globalAvgAcc: '全局平均准确率',
            globalAvgRT: '全局平均反应',
            globalAvgDiff: '全局平均难度',
            modePerformance: '模式表现',
            recentSessions: '最近训练',
            strobe: '频闪',
            noDataYet: '无数据',
            avgNCSLabel: '平均NCS',
            bestLabel: '最佳',
            bestAcc: '最高准确',
            peakLv: '最高等级',
            trend: '趋势（最近50次）',
            levelDistribution: '等级分布',
            need2Sessions: '需要2次以上训练',
            needMoreData: '需要更多数据',
            noSessionsYet: '暂无训练',
            clearData: '清除数据',
            deleteAllData: '删除所有数据？',
            sessions: '次训练',
        }
    },
    
    
    async detectLanguageFromIP() {
        // 多个备用API，按顺序尝试
        const apis = [
            {
                url: 'https://ipapi.co/json/',
                getCountryCode: (data) => data.country_code
            },
            {
                url: 'https://ip-api.com/json/',
                getCountryCode: (data) => data.countryCode
            },
            {
                url: 'https://ipwhois.app/json/',
                getCountryCode: (data) => data.country_code
            }
        ];
        
        // 中国大陆、香港、澳门、台湾 → 中文
        const chineseRegions = ['CN', 'HK', 'MO', 'TW'];
        
        for (const api of apis) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 3000);
                
                const response = await fetch(api.url, {
                    signal: controller.signal
                });
                
                clearTimeout(timeoutId);
                
                if (!response.ok) continue;
                
                const data = await response.json();
                const countryCode = api.getCountryCode(data);
                
                console.log('IP location detected:', countryCode);
                
                if (chineseRegions.includes(countryCode)) {
                    return 'zh';
                }
                
                return 'en';
            } catch (error) {
                console.log('API failed, trying next:', api.url, error.message);
                continue;
            }
        }
        
        // 所有API都失败，默认英文
        console.log('All IP detection APIs failed, defaulting to English');
        return 'en';
    },
    async init() {
        const saved = localStorage.getItem(LANG_KEY);
        
        if (saved && (saved === 'en' || saved === 'zh')) {
            // 已有语言设置，直接使用
            this.current = saved;
            this.applyLanguage();
        } else {
            // 第一次访问，根据IP自动检测语言
            console.log('First visit, detecting language from IP...');
            const detectedLang = await this.detectLanguageFromIP();
            this.current = detectedLang;
            localStorage.setItem(LANG_KEY, detectedLang);
            this.applyLanguage();
            console.log('Language set to:', detectedLang);
        }
    },
    
    setLanguage(lang) {
        if (lang !== 'en' && lang !== 'zh') return;
        this.current = lang;
        localStorage.setItem(LANG_KEY, lang);
        this.applyLanguage();
    },
    
    t(key) {
        return this.strings[this.current][key] || this.strings.en[key] || key;
    },
    
    // FIX: Add modeName method
    modeName(modeId) {
        return this.t(`mode${modeId}Name`);
    },
    
    modeInfo(mode) {
        return {
            name: this.t(`mode${mode}Name`),
            description: this.t(`mode${mode}Desc`),
            tag: this.t(`mode${mode}Tag`)
        };
    },
    
    toggle() {
        const newLang = this.current === 'en' ? 'zh' : 'en';
        this.setLanguage(newLang);
    },
    
    applyLanguage() {
        // Update all elements with data-i18n attribute
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            const text = this.t(key);
            
            if (el.getAttribute('data-i18n-html') === 'true') {
                el.innerHTML = text;
            } else {
                el.textContent = text;
            }
        });
        
        // Update language selector
        const langSelect = document.getElementById('language-select');
        if (langSelect) {
            langSelect.value = this.current;
        }
    }
};


// Development/Testing helper - expose to console
if (typeof window !== 'undefined') {
    window.resetLanguage = function() {
        localStorage.removeItem('neuroaim_language');
        console.log('Language setting cleared. Reload page to trigger IP detection.');
        console.log('Run: location.reload()');
    };
    
    window.forceLanguage = function(lang) {
        if (lang !== 'en' && lang !== 'zh') {
            console.error('Invalid language. Use "en" or "zh"');
            return;
        }
        i18n.setLanguage(lang);
        console.log('Language set to:', lang);
    };
    
    console.log('🌐 Language helpers available:');
    console.log('  - resetLanguage() : Clear saved language and trigger IP detection on reload');
    console.log('  - forceLanguage("en"/"zh") : Force specific language');
}