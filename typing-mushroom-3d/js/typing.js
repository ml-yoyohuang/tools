/*!
 * 英打規則（不依賴 DOM）
 *
 * 從原版 main.js 抽出：逐字判定、幸運加成、瘋狂連打、閉眼連打、跳題。
 * 每個正確字元（字母、空格、標點）都呼叫一次 game.clickTarget，字母不分大小寫。
 * 回傳的結果只描述「發生了什麼」，畫面層依結果播放回饋，不回頭影響計算。
 */
(function (root, factory) {
    'use strict';
    var isNode = typeof module === 'object' && module.exports;
    var deps = isNode ? { Config: require('./config.js') } : { Config: root.MushConfig };
    var api = factory(deps);
    if (isNode) module.exports = api;
    else root.MushTyping = api;
})(typeof self !== 'undefined' ? self : this, function (deps) {
    'use strict';

    var Config = deps.Config;

    var CRAZY_TYPING_PROMPT = { text: 'aaaaaaaaaaaaaaaaaaaa', translation: '瘋狂連打！' };
    var CRAZY_TYPING_CHANCE = 0.02;
    var CRAZY_TYPING_GUARANTEE_AFTER = 9;      // 完成 9 題後保底（約第 10 題）
    var LUCKY_CHANCE = 0.04;
    var LUCKY_DAMAGE_MULT = 2;
    var FIRST_LUCKY_PROMPT = 5;                // 完成第 5 題時保底首次幸運
    var COMBO_MILESTONES = [3, 5];
    var BANK_NAMES = {
        geptElementary: '全民英檢初級單字',
        geptIntermediate: '全民英檢中級單字',
        sentences: '句子'
    };

    /**
     * @param {Object} options
     *  - game: MushGame.Game
     *  - banks: { sentences: [string], geptElementary: [{text, translation}], geptIntermediate: [...] }
     *  - bank: 目前題庫 ID
     *  - now: () => ms
     */
    function TypingSession(options) {
        this.game = options.game;
        this.banks = options.banks || {};
        this.bank = BANK_NAMES[options.bank] ? options.bank : 'geptElementary';
        this.now = options.now || function () { return Date.now(); };
        this.masked = false;

        this.promptIndex = 0;
        this.index = 0;
        this.blindWordStarted = false;
        this.crazyActive = false;
        this.promptIndex = this._randomIndex();
    }

    /*
     * 保底進度存在遊戲存檔（game.state），重新整理或換頁後仍然有效：
     *  - completed：累計完成題數（第 5 題保底幸運、完成 9 題後保底瘋狂連打）
     *  - firstLuckyGranted：首次幸運是否已發生
     */
    Object.defineProperty(TypingSession.prototype, 'completed', {
        get: function () { return this.game.state.promptsCompleted || 0; },
        set: function (value) { this.game.state.promptsCompleted = Math.max(0, Math.floor(value) || 0); }
    });
    Object.defineProperty(TypingSession.prototype, 'firstLuckyGranted', {
        get: function () { return !!(this.game.state.flags && this.game.state.flags.firstLuckyGranted); },
        set: function (value) {
            var flags = this.game.state.flags || (this.game.state.flags = {});
            flags.firstLuckyGranted = !!value;
        }
    });

    TypingSession.prototype.random = function () { return this.game.random(); };

    TypingSession.prototype.prompts = function () {
        if (this.crazyActive) return [CRAZY_TYPING_PROMPT];
        if (this.bank === 'geptElementary' || this.bank === 'geptIntermediate') return this.banks[this.bank] || [];
        return (this.banks.sentences || []).map(function (text) { return { text: text, translation: '' }; });
    };

    TypingSession.prototype.current = function () {
        var list = this.prompts();
        var prompt = list[this.promptIndex] || list[0] || { text: 'a', translation: '' };
        return { text: prompt.text, translation: prompt.translation || '', crazy: this.crazyActive };
    };

    /** 單字題（有翻譯、不是瘋狂連打）才提供閉眼模式。 */
    TypingSession.prototype.isVocabulary = function () {
        return !this.crazyActive && !!this.current().translation;
    };

    TypingSession.prototype.isBlindModeActive = function () {
        return !!this.masked && (this.bank === 'geptElementary' || this.bank === 'geptIntermediate');
    };

    TypingSession.prototype._randomIndex = function () {
        var length = this.prompts().length;
        return length ? Math.floor(this.random() * length) : 0;
    };

    TypingSession.prototype._nextIndex = function () {
        var length = this.prompts().length;
        if (length < 2) return 0;
        return (this.promptIndex + 1 + Math.floor(this.random() * (length - 1))) % length;
    };

    /** 回傳 true 代表首次保底剛觸發（呼叫端應立即存檔，避免重整後再次保底）。 */
    TypingSession.prototype._scheduleCrazy = function () {
        var state = this.game.state;
        var flags = state.flags || (state.flags = {});
        if (!flags.crazyTypingSeen) {
            if (this.completed < CRAZY_TYPING_GUARANTEE_AFTER) { this.crazyActive = false; return false; }
            flags.crazyTypingSeen = true;
            this.crazyActive = true;
            return true;
        }
        this.crazyActive = this.random() < CRAZY_TYPING_CHANCE;
        return false;
    };

    TypingSession.prototype.setBank = function (bank) {
        if (!BANK_NAMES[bank]) return false;
        this.bank = bank;
        this.game.resetBlindTypingCombo();
        this.blindWordStarted = false;
        this.crazyActive = false;
        this.promptIndex = this._randomIndex();
        this.index = 0;
        return true;
    };

    TypingSession.prototype.setMasked = function (masked) {
        this.masked = !!masked;
        this.game.resetBlindTypingCombo();
        this.blindWordStarted = false;
    };

    /**
     * 輸入一個字元。
     * @param {string} key 單一可列印字元
     * @param {Function} attack (uid, options) => clickTarget 結果；由呼叫端決定實際目標與畫面同步
     * @returns {Object} 本次輸入的結果描述
     */
    TypingSession.prototype.key = function (key, attack) {
        var game = this.game;
        var now = this.now();
        var prompt = this.current();
        var text = prompt.text;
        var blindActive = this.isBlindModeActive();
        var blindWord = blindActive && !this.crazyActive && !!prompt.translation;
        if (!blindActive && game.state.blindCombo) game.resetBlindTypingCombo();
        if (this.index === 0) this.blindWordStarted = blindWord;

        var expected = text.charAt(this.index);
        if (String(key).toLowerCase() !== expected.toLowerCase()) {
            if (blindWord) game.touchBlindTyping(now);
            return { correct: false, expected: expected };
        }

        var out = {
            correct: true, char: expected, charIndex: this.index, crazyStarted: false,
            attacked: false, lucky: false, combo: null, blindMilestone: null,
            shieldGate: null, completedPrompt: false, crazyTriggered: false, wasCrazy: this.crazyActive
        };
        var completesPrompt = this.index === text.length - 1;
        var completesWord = completesPrompt || text.charAt(this.index + 1) === ' ';

        var blindBefore = game.state.blindCombo || 0;
        var blindMult = 1;
        if (blindWord) {
            game.recordBlindTypingCharacter(now);
            blindMult = game.blindTypingDamageMult();
        }

        // 第 5 題完成時保底；若當下場上剛好沒有目標，之後的第一個攻擊字元補上
        var guaranteedLucky = !this.firstLuckyGranted &&
            (this.completed >= FIRST_LUCKY_PROMPT || (this.completed === FIRST_LUCKY_PROMPT - 1 && completesPrompt));
        var alive = game.aliveTargets();
        if (alive.length) {
            var lucky = guaranteedLucky || (this.firstLuckyGranted && this.random() < LUCKY_CHANCE);
            var uid = game.state.preferredUid || alive[0].uid;
            var comboBefore = game.state.combo;
            var damageMult = blindMult * (lucky ? LUCKY_DAMAGE_MULT : 1);
            var result = attack(uid, damageMult > 1 ? { damageMult: damageMult } : null);
            out.attacked = !!result;
            out.targetUid = game.state.preferredUid || uid;
            out.result = result;
            out.damageMult = damageMult;
            if (game.mode === 'boss' && result && result.combo > comboBefore) {
                var maxStacks = Config.BALANCE.combo.maxStacks;
                var marks = COMBO_MILESTONES.concat([maxStacks]);
                for (var i = 0; i < marks.length; i++) {
                    if (comboBefore < marks[i] && result.combo >= marks[i]) {
                        out.combo = { stacks: result.combo, mult: game.stats.comboMult, isMax: result.combo >= maxStacks };
                        break;
                    }
                }
            }
            if (lucky) {
                this.firstLuckyGranted = true;
                out.lucky = true;
                out.luckyMult = LUCKY_DAMAGE_MULT;
            }
        }

        var per = Config.BALANCE.blindCombo.charsPerBonus;
        if (blindWord && Math.floor((game.state.blindCombo || 0) / per) > Math.floor(blindBefore / per)) {
            out.blindMilestone = { streak: game.state.blindCombo, mult: game.blindTypingDamageMult() };
        }

        this.index++;
        if (completesWord) out.shieldGate = game.completeBossTypingWord();

        if (this.index >= text.length) {
            if (blindWord && this.blindWordStarted) game.completeBlindTypingWord(now);
            this.blindWordStarted = false;
            this.completed++;
            if (this.crazyActive) {
                this.crazyActive = false;
                this.promptIndex = this._randomIndex();
            } else {
                out.crazyTriggered = this._scheduleCrazy();
                out.crazyStarted = this.crazyActive;      // 首次保底或 2% 再次觸發都算
                this.promptIndex = this.crazyActive ? 0 : this._nextIndex();
            }
            this.index = 0;
            out.completedPrompt = true;
        }
        return out;
    };

    /** 跳過此題：不懲罰；閉眼連打歸零；跳題也有機會觸發瘋狂連打（首次保底除外）。 */
    TypingSession.prototype.skip = function () {
        this.game.resetBlindTypingCombo();
        this.blindWordStarted = false;
        var skippedCrazy = this.crazyActive;
        this.crazyActive = false;
        var crazyTriggered = this._scheduleCrazy();
        this.promptIndex = this.crazyActive ? 0 : (skippedCrazy ? this._randomIndex() : this._nextIndex());
        this.index = 0;
        return { skipped: true, crazyTriggered: crazyTriggered, crazyStarted: this.crazyActive };
    };

    return {
        TypingSession: TypingSession,
        BANK_NAMES: BANK_NAMES,
        CRAZY_TYPING_PROMPT: CRAZY_TYPING_PROMPT,
        CRAZY_TYPING_CHANCE: CRAZY_TYPING_CHANCE,
        LUCKY_CHANCE: LUCKY_CHANCE,
        LUCKY_DAMAGE_MULT: LUCKY_DAMAGE_MULT
    };
});
