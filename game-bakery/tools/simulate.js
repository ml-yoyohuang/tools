#!/usr/bin/env node
/*!
 * 數值模擬：用固定策略跑一輪，列出里程碑時間與產量曲線
 * 用法：node tools/simulate.js [模擬分鐘數]
 *
 * 用途是找出卡點與斷層，不能取代實際遊玩，
 * 也不能把這裡的時間當成「已驗證的遊玩體驗」。
 *
 * 假設（可在下方 STRATEGY 調整）：
 *  - 點擊頻率：前 3 分鐘每秒 3 下，之後每秒 0.4 下（偶爾點一下）
 *  - 購買策略：每秒評估一次，買「回本時間最短」且買得起的設備或升級
 *  - 道具：拿到就在產量最高的時候用掉（這裡簡化成一拿到就用）
 *  - 亂數：固定種子，結果可重現
 */
'use strict';

const Config = require('../js/config.js');
const Content = require('../js/content.js');
const Economy = require('../js/economy.js');
const { Game } = require('../js/game.js');
const Format = require('../js/format.js');

const STRATEGY = {
    earlyClickSeconds: 180,
    earlyClicksPerSecond: 3,
    lateClicksPerSecond: 0.4,
    maxPaybackSeconds: 900,   // 回本超過這個時間就先不買
    cheapRatio: 0.02,         // 但只要花費不到目前餘額的 2%，就直接買（模擬真人不會計較小錢）
    useItemsImmediately: true
};

const minutes = Number(process.argv[2]) || 60;
const totalMs = minutes * 60 * 1000;
const STEP_MS = 1000;

let seed = 20260101;
function random() {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
}

let now = 1700000000000;
const start = now;
const game = new Game({ now: () => now, random });

const timeline = [];
function mark(label) {
    timeline.push({ at: (now - start) / 1000, label, cps: game.stats.baseCps, cookies: game.state.cookies });
}

game.on('achievement', (ach) => mark(`成就：${ach.name}`));
const seenBuilding = {};
const seenUpgrade = {};

function currentClickRate() {
    const elapsed = (now - start) / 1000;
    return elapsed < STRATEGY.earlyClickSeconds
        ? STRATEGY.earlyClicksPerSecond
        : STRATEGY.lateClicksPerSecond;
}

/** 評估所有可買的東西，回傳回本時間最短的那個。 */
function bestPurchase() {
    const state = game.state;
    const discount = game.currentDiscount(now);
    let best = null;

    Config.BUILDINGS.forEach((building) => {
        if (!Economy.isRevealed(building, state)) return;
        const owned = state.buildings[building.id];
        const cost = Economy.unitCost(building, owned, discount);
        if (cost > state.cookies) return;
        const gain = Economy.cpsGainOf(state, building.id, 1, now);
        if (gain <= 0) return;
        const payback = cost / gain;
        if (!best || payback < best.payback) best = { kind: 'building', id: building.id, payback, cost };
    });

    Content.UPGRADES.forEach((upgrade) => {
        if (state.upgrades[upgrade.id]) return;
        if (!Economy.meetsRequirement(upgrade.req, state, game.stats)) return;
        if (upgrade.cost > state.cookies) return;
        const gain = Economy.upgradeGainOf(state, upgrade.id, now);
        // 點擊類升級用「每秒等效收益」粗估：以目前的實際點擊頻率計算
        const effective = gain.cps + gain.click * currentClickRate();
        const payback = effective > 0 ? upgrade.cost / effective : Infinity;
        if (!best || payback < best.payback) best = { kind: 'upgrade', id: upgrade.id, payback, cost: upgrade.cost };
    });

    return best;
}

let clickCarry = 0;
const samples = [];

while (now - start < totalMs) {
    const elapsed = (now - start) / 1000;

    // 點擊
    const rate = elapsed < STRATEGY.earlyClickSeconds
        ? STRATEGY.earlyClicksPerSecond
        : STRATEGY.lateClicksPerSecond;
    clickCarry += rate * (STEP_MS / 1000);
    while (clickCarry >= 1) {
        game.click(now);
        clickCarry -= 1;
    }

    // 購買（可能連續買好幾樣）
    for (let i = 0; i < 40; i++) {
        const pick = bestPurchase();
        const cheap = pick && pick.cost <= game.state.cookies * STRATEGY.cheapRatio;
        if (!pick || (pick.payback > STRATEGY.maxPaybackSeconds && !cheap)) break;
        if (pick.kind === 'building') {
            const before = game.state.buildings[pick.id];
            game.buyBuilding(pick.id, 1, now);
            if (before === 0 && game.state.buildings[pick.id] > 0 && !seenBuilding[pick.id]) {
                seenBuilding[pick.id] = true;
                mark(`首次購買：${Config.BUILDING_BY_ID[pick.id].name}`);
            }
        } else {
            game.buyUpgrade(pick.id, now);
            if (!seenUpgrade[pick.id]) {
                seenUpgrade[pick.id] = true;
                mark(`升級：${Content.UPGRADE_BY_ID[pick.id].name}`);
            }
        }
    }

    // 道具：一拿到就用
    if (STRATEGY.useItemsImmediately) {
        Config.ITEMS.forEach((item) => {
            while (game.state.items[item.id] > 0) {
                game.useItem(item.id, now);
            }
        });
    }

    // 黃金餅乾：出現就點
    if (game.state.golden) game.clickGolden(now);

    now += STEP_MS;
    game.tick(now);

    const t = Math.round((now - start) / 1000);
    if (t % 60 === 0) {
        samples.push({ minute: t / 60, cps: game.stats.baseCps, baked: game.state.baked });
    }
}

/* ---------------- 輸出 ---------------- */

function fmtTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    return `${String(m).padStart(3)}:${String(s).padStart(2, '0')}`;
}

console.log(`模擬 ${minutes} 分鐘（點擊：前 ${STRATEGY.earlyClickSeconds} 秒 ${STRATEGY.earlyClicksPerSecond}/秒，之後 ${STRATEGY.lateClicksPerSecond}/秒）\n`);

console.log('── 里程碑 ──');
timeline.filter((e) => e.label.startsWith('首次購買') || e.label.startsWith('升級'))
    .forEach((e) => console.log(`  ${fmtTime(e.at)}  ${e.label}  (產量 ${Format.rate(e.cps)}/秒)`));

console.log('\n── 產量曲線（每 5 分鐘）──');
samples.filter((s) => s.minute % 5 === 0).forEach((s) => {
    console.log(`  ${String(s.minute).padStart(3)} 分  產量 ${String(Format.rate(s.cps)).padStart(10)}/秒   累積 ${Format.short(s.baked)}`);
});

const state = game.state;
console.log('\n── 結束狀態 ──');
console.log(`  累積製作   ${Format.short(state.baked)}`);
console.log(`  每秒產量   ${Format.rate(game.stats.baseCps)}`);
console.log(`  點擊收益   ${Format.short(game.stats.clickValue)}`);
console.log(`  升級       ${Object.keys(state.upgrades).length} / ${Content.UPGRADES.length}`);
console.log(`  成就       ${Object.keys(state.achievements).length} / ${Content.ACHIEVEMENTS.length}`);
console.log('  設備       ' + Config.BUILDINGS.map((b) => `${b.short}:${state.buildings[b.id]}`).join('  '));

const missing = Config.BUILDINGS.filter((b) => state.buildings[b.id] === 0);
if (missing.length) {
    console.log('\n  ⚠ 這段時間內還沒買到：' + missing.map((b) => b.name).join('、'));
}
