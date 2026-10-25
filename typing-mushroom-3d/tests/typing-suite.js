/*!
 * 英打規則測試：node tests/run-node.js
 * 驗證 3D 版承接規格第 3、4.1 節的逐字攻擊、幸運、瘋狂連打與閉眼連打。
 */
'use strict';

const assert = require('assert');
const Config = require('../js/config.js');
const GameAPI = require('../js/game.js');
const Typing = require('../js/typing.js');
const Prompts = require('../js/typing-prompts.js').MushTypingPrompts;
const Vocab = require('../js/typing-vocab.js').MushTypingVocab;

const tests = [];
function test(name, fn) { tests.push({ name: '[英打] ' + name, fn }); }

function seq(values) {
    let i = 0;
    return () => values[Math.min(i++, values.length - 1)];
}

function setup(options) {
    options = options || {};
    let clock = 1000000;
    const game = new GameAPI.Game({ now: () => clock, random: options.random || (() => 0.5) });
    game.tick(clock);
    const session = new Typing.TypingSession({
        game,
        banks: options.banks || { sentences: ['ab c.'], geptElementary: [{ text: 'Cat', translation: '貓' }], geptIntermediate: [{ text: 'dog', translation: '狗' }] },
        bank: options.bank || 'sentences',
        now: () => clock
    });
    const attacks = [];
    const attack = (uid, opts) => {
        attacks.push({ uid, opts });
        const result = game.clickTarget(uid, clock, opts);
        game.state.preferredUid = uid;
        return result;
    };
    return {
        game, session, attacks, attack,
        advance(ms) { clock += ms; },
        type(text) {
            return Array.from(text).map(ch => {
                const r = session.key(ch, attack);
                clock += 50;
                game.tick(clock);      // 讓戰場補上新蘑菇，與真實主迴圈一致
                return r;
            });
        }
    };
}

test('每個正確字元（含空格與標點）各造成一次英打攻擊', () => {
    const t = setup();
    const before = t.game.state.clicks;
    t.type('ab c.');
    assert.strictEqual(t.attacks.length, 5);
    assert.strictEqual(t.game.state.clicks - before, 5);
});

test('字母不分大小寫；空格與標點必須正確', () => {
    const t = setup({ bank: 'geptElementary' });
    const results = t.type('cAT');
    assert.ok(results.every(r => r.correct));
    const t2 = setup();
    assert.strictEqual(t2.session.key('a', t2.attack).correct, true);
    assert.strictEqual(t2.session.key('b', t2.attack).correct, true);
    assert.strictEqual(t2.session.key('_', t2.attack).correct, false, '空格不能用其他符號代替');
});

test('錯字不攻擊，也不前進', () => {
    const t = setup();
    const r = t.session.key('x', t.attack);
    assert.strictEqual(r.correct, false);
    assert.strictEqual(t.attacks.length, 0);
    assert.strictEqual(t.session.index, 0);
});

test('完成第 5 題時保底觸發首次幸運 ×2', () => {
    const t = setup({ random: () => 0.99 });
    for (let i = 0; i < 4; i++) {
        const results = t.type('ab c.');
        assert.ok(!results.some(r => r.lucky), '前 4 題不應幸運');
    }
    const fifth = t.type('ab c.');
    assert.ok(fifth[4].lucky, '第 5 題最後一字保底幸運');
    assert.strictEqual(t.attacks[t.attacks.length - 1].opts.damageMult, 2);
});

test('首次幸運後，每個正確字元依 4% 機率觸發', () => {
    const t = setup({ random: () => 0.99 });
    for (let i = 0; i < 5; i++) t.type('ab c.');
    t.game.random = () => 0.03;
    const r = t.session.key('a', t.attack);
    assert.ok(r.lucky);
    t.game.random = () => 0.05;
    const r2 = t.session.key('b', t.attack);
    assert.ok(!r2.lucky);
});

test('瘋狂連打：完成 9 題後保底，題目為 20 個 a', () => {
    const t = setup({ random: () => 0.99 });
    for (let i = 0; i < 8; i++) {
        t.type('ab c.');
        assert.strictEqual(t.session.crazyActive, false);
    }
    const ninth = t.type('ab c.');
    assert.ok(ninth[4].crazyTriggered);
    const prompt = t.session.current();
    assert.strictEqual(prompt.text, 'a'.repeat(20));
    assert.strictEqual(prompt.translation, '瘋狂連打！');
    const before = t.attacks.length;
    t.type('a'.repeat(20));
    assert.strictEqual(t.attacks.length - before, 20, '每個 a 都各自攻擊');
});

test('提前跳題不會提早觸發首次瘋狂連打', () => {
    const t = setup({ random: () => 0.0 });
    for (let i = 0; i < 20; i++) {
        t.session.skip();
        assert.strictEqual(t.session.crazyActive, false);
    }
});

test('首次保底後，完成或跳過各有 2% 機率再次觸發', () => {
    const t = setup({ random: () => 0.99 });
    t.game.state.flags.crazyTypingSeen = true;
    t.game.random = () => 0.019;
    t.session.skip();
    assert.ok(t.session.crazyActive);
    t.game.random = () => 0.5;
    t.session.skip();
    assert.ok(!t.session.crazyActive);
});

test('閉眼連打：每 10 字 +5%，上限 +25%，只在閉眼單字題累積', () => {
    const t = setup({ bank: 'geptElementary', banks: { geptElementary: [{ text: 'abcdefghij', translation: '測試' }], sentences: ['ab'] } });
    t.session.setMasked(true);
    let milestone = null;
    for (let round = 0; round < 6; round++) {
        t.type('abcdefghij').forEach(r => { if (r.blindMilestone) milestone = r.blindMilestone; });
    }
    assert.ok(milestone, '跨級時回報里程碑');
    assert.ok(Math.abs(t.game.blindTypingDamageMult() - 1.25) < 1e-9, '最多 +25%');
    t.advance(3100);
    t.game.tick(t.game.now());
    assert.strictEqual(t.game.state.blindCombo, 0, '3 秒沒有正確輸入歸零');
});

test('睜眼或句子題不累積閉眼連打', () => {
    const t = setup({ bank: 'sentences' });
    t.session.setMasked(true);
    t.type('ab c.');
    assert.strictEqual(t.game.state.blindCombo, 0);
});

test('菇王戰連擊 3、5、10 層回報里程碑', () => {
    const t = setup();
    t.game.state.zoneTypingAttacks.zone_01 = 100;
    assert.ok(t.game.startBoss(t.game.now()));
    const marks = [];
    for (let i = 0; i < 12; i++) {
        const r = t.session.key('ab c.'.charAt(t.session.index), t.attack);
        if (r.combo) marks.push(r.combo.stacks);
        t.advance(100);
    }
    assert.deepStrictEqual(marks, [3, 5, Config.BALANCE.combo.maxStacks]);
});

test('豆腐菇：完成單字推進護盾門檻', () => {
    const t = setup({ bank: 'geptElementary', banks: { geptElementary: [{ text: 'ab', translation: '測試' }], sentences: [] } });
    t.game.state.unlockedZones.zone_02 = true;
    t.game.switchZone('zone_02', t.game.now());
    t.game.state.zoneTypingAttacks.zone_02 = 100;
    assert.ok(t.game.startBoss(t.game.now()));
    t.game.targets[0].shields = 2;
    const results = t.type('ab');
    assert.ok(results[1].shieldGate);
    assert.strictEqual(results[1].shieldGate.progress, 1);
});

test('題庫筆數符合規格（初級 2,218、中級 2,568、句子 500）', () => {
    assert.strictEqual(Vocab.geptElementary.length, 2218);
    assert.strictEqual(Vocab.geptIntermediate.length, 2568);
    assert.strictEqual(Prompts.length, 500);
    assert.ok(Vocab.geptElementary.every(v => v.translation), '初級題目都有中文翻譯');
});

test('中級題庫不混入初級詞彙（同形異義字只收中級字義）', () => {
    const elementary = new Map(Vocab.geptElementary.map(v => [v.text.toLowerCase(), v.translation]));
    const sameMeaning = Vocab.geptIntermediate.filter(v =>
        elementary.has(v.text.toLowerCase()) && elementary.get(v.text.toLowerCase()) === v.translation);
    assert.strictEqual(sameMeaning.length, 0, '重複：' + sameMeaning.slice(0, 5).map(v => v.text).join(', '));
});

test('設備開火事件只供畫面使用，不改變傷害結果', () => {
    const run = (listen) => {
        const t = setup({ random: () => 0.3 });
        t.game.state.devices.auto_tongs = 3;
        t.game.refreshStats(t.game.now());
        let fires = 0;
        if (listen) t.game.on('deviceFire', () => { fires++; });
        for (let i = 0; i < 50; i++) { t.advance(100); t.game.tick(t.game.now()); }
        return { damage: t.game.state.totalDamage, fires };
    };
    const a = run(false), b = run(true);
    assert.strictEqual(a.damage, b.damage);
    assert.ok(b.fires > 0);
});

test('保底進度存進存檔：重新整理後仍在第 9 題保底觸發瘋狂連打', () => {
    const StorageAPI = require('../js/storage.js');
    const t = setup({ random: () => 0.99 });
    for (let i = 0; i < 6; i++) t.type('ab c.');
    // 模擬重新整理：快照 → 存檔驗證 → 新遊戲載入 → 新的英打工作階段
    const checked = StorageAPI.validateState(JSON.parse(JSON.stringify(t.game.snapshot())));
    assert.ok(checked.ok);
    assert.strictEqual(checked.state.promptsCompleted, 6);
    assert.strictEqual(checked.state.flags.firstLuckyGranted, true, '首次幸運已在第 5 題發生，不會重複保底');
    const reloaded = setup({ random: () => 0.99 });
    reloaded.game.loadSnapshot(checked.state, reloaded.game.now());
    reloaded.game.tick(reloaded.game.now() + 50);
    assert.strictEqual(reloaded.session.completed, 6);
    let started = null;
    for (let i = 0; i < 3; i++) {
        const results = reloaded.type('ab c.');
        if (results[4].crazyStarted) started = i;
    }
    assert.strictEqual(started, 2, '累計第 9 題完成時觸發');
    assert.strictEqual(reloaded.session.current().text, 'a'.repeat(20));
});

test('首次幸運未觸發就重新整理，之後仍會補上', () => {
    const t = setup({ random: () => 0.99 });
    t.game.state.promptsCompleted = 5;          // 已完成 5 題但幸運尚未發生（例如當時場上沒有目標）
    const r = t.session.key('a', t.attack);
    assert.ok(r.lucky);
    assert.strictEqual(t.game.state.flags.firstLuckyGranted, true);
});

test('2% 再次觸發的瘋狂連打也會回報開始（畫面需提示）', () => {
    const t = setup({ random: () => 0.99 });
    t.game.state.flags.crazyTypingSeen = true;
    t.game.random = () => 0.01;
    const skip = t.session.skip();
    assert.strictEqual(skip.crazyStarted, true);
    assert.strictEqual(skip.crazyTriggered, false, '不是首次保底，不需要立即存檔');
});

module.exports = { tests };
