#!/usr/bin/env node
/*!
 * 數值模擬：用固定策略跑一輪，列出里程碑時間與產出曲線
 * 用法：node tools/simulate.js [模擬分鐘數]
 *
 * 用途是找出卡點、主導策略與失控組合，不能取代實際遊玩，
 * 也不能把這裡的時間當成「已驗證的遊玩體驗」。
 *
 * 假設（可在 STRATEGY 調整）：
 *  - 點擊：前 5 分鐘每秒 3 下，之後每秒 1 下（普通玩家不連點）
 *  - 購買：每秒評估一次，買「回本時間最短」且買得起的設備或升級；
 *          花費低於餘額 3% 的東西直接買（模擬真人不計較小錢）
 *  - 菇王：估算 60 秒內打得完就開打，打不完就退出繼續農
 *  - 道具：解鎖後，打菇王時用提神飲料，平時不亂用
 *  - 亂數：固定種子，結果可重現
 */
'use strict';

const Config = require('../js/config.js');
const Content = require('../js/content.js');
const Combat = require('../js/combat.js');
const { Game } = require('../js/game.js');
const Format = require('../js/format.js');

const STRATEGY = {
    earlyClickSeconds: 300,
    earlyClicksPerSecond: 3,
    lateClicksPerSecond: 1,
    maxPaybackSeconds: 1200,
    cheapRatio: 0.03,
    bossAttemptSeconds: 600,
    exploreRatio: 0.6        // 沒買過的設備，只要花費不到餘額 20% 就買一台試試
};

const minutes = Number(process.argv[2]) || 90;
const totalMs = minutes * 60 * 1000;
const STEP_MS = 1000;

let seed = 20260207;
const random = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };

let now = 1700000000000;
const start = now;
const game = new Game({ now: () => now, random });

const timeline = [];
const seen = {};
function mark(label) {
    if (seen[label]) return;
    seen[label] = true;
    timeline.push({ at: (now - start) / 1000, label, dps: game.stats.autoDps, coins: game.state.coins });
}

game.on('bossDefeated', (e) => mark('擊敗菇王：' + Config.BOSS_BY_ID[e.bossId].name));
game.on('achievement', (a) => mark('成就：' + a.name));
game.on('milestone', (u) => mark('里程碑：' + u.name));

function clickRate() {
    return (now - start) / 1000 < STRATEGY.earlyClickSeconds
        ? STRATEGY.earlyClicksPerSecond : STRATEGY.lateClicksPerSecond;
}

/** 估一次設備購買能增加多少 DPS。 */
function dpsAfterDevice(deviceId, count) {
    const snap = {
        devices: Object.assign({}, game.state.devices),
        upgrades: game.state.upgrades, achievements: game.state.achievements,
        equipped: game.state.equipped, lifetimeCoins: game.state.lifetimeCoins,
        baseDamageAuto: game.state.baseDamageAuto, baseDamageClick: game.state.baseDamageClick,
        combo: 0, buffs: {}, deviceCooldowns: {}, slowActive: false
    };
    snap.devices[deviceId] = (snap.devices[deviceId] || 0) + count;
    return Combat.computeStats(snap, now).autoDps;
}

function dpsAfterUpgrade(upgradeId) {
    const snap = {
        devices: game.state.devices,
        upgrades: Object.assign({}, game.state.upgrades),
        achievements: game.state.achievements, equipped: game.state.equipped,
        lifetimeCoins: game.state.lifetimeCoins,
        baseDamageAuto: game.state.baseDamageAuto, baseDamageClick: game.state.baseDamageClick,
        combo: 0, buffs: {}, deviceCooldowns: {}, slowActive: false
    };
    snap.upgrades[upgradeId] = true;
    const stats = Combat.computeStats(snap, now);
    return { dps: stats.autoDps, click: stats.clickDamage };
}

/** 真人會為了「效果描述」買下沒買過的支援設備，即使它不直接加 DPS。 */
function exploreUnownedDevice() {
    for (const device of Config.DEVICES) {
        if (game.state.devices[device.id] > 0) continue;
        if (!game.deviceUnlocked(device)) continue;
        const plan = game.planDevicePurchase(device.id, 1);
        if (!plan.count || !plan.affordable) continue;
        if (plan.cost > game.state.coins * STRATEGY.exploreRatio) continue;
        return device.id;
    }
    return null;
}

function bestPurchase() {
    const state = game.state;
    const baseDps = game.stats.autoDps;
    const baseClick = game.stats.clickDamage;
    let best = null;

    Config.DEVICES.forEach((device) => {
        if (!game.deviceUnlocked(device)) return;
        const plan = game.planDevicePurchase(device.id, 1);
        if (!plan.count || !plan.affordable) return;
        const gain = dpsAfterDevice(device.id, 1) - baseDps;
        if (!(gain > 0)) return;
        const payback = plan.cost / gain;
        if (!best || payback < best.payback) best = { kind: 'device', id: device.id, payback, cost: plan.cost };
    });

    Content.UPGRADES.forEach((upgrade) => {
        if (upgrade.auto || state.upgrades[upgrade.id]) return;
        if (!game.meetsRequirement(upgrade.req)) return;
        const cost = upgrade.cost * game.stats.shopDiscount;
        if (cost > state.coins) return;
        if ((upgrade.brothCost || 0) > state.broth) return;
        const after = dpsAfterUpgrade(upgrade.id);
        const effective = (after.dps - baseDps) + (after.click - baseClick) * clickRate();
        const payback = effective > 0 ? cost / effective : Infinity;
        if (!best || payback < best.payback) best = { kind: 'upgrade', id: upgrade.id, payback, cost };
    });

    return best;
}

/** 估計打贏目前地區菇王需要多久。 */
function bossTimeEstimate() {
    const zone = game.zone();
    const boss = Config.BOSS_BY_ID[zone.bossId];
    if (!boss || game.state.bosses[boss.id]) return Infinity;
    const dps = game.stats.autoDps + game.stats.clickDamage * clickRate();
    if (!(dps > 0)) return Infinity;
    const holdPenalty = boss.mechanic === 'holdShield' ? boss.shields * boss.holdSeconds : 0;
    return boss.hp / dps + holdPenalty;
}

let clickCarry = 0;
const samples = [];
let bossTries = 0;

while (now - start < totalMs) {
    // 購買
    const explore = exploreUnownedDevice();
    if (explore) {
        game.buyDevice(explore, 1, now);
        mark('首次購買：' + Config.DEVICE_BY_ID[explore].name);
    }
    for (let i = 0; i < 60; i++) {
        const pick = bestPurchase();
        const cheap = pick && pick.cost <= game.state.coins * STRATEGY.cheapRatio;
        if (!pick || (pick.payback > STRATEGY.maxPaybackSeconds && !cheap)) break;
        if (pick.kind === 'device') {
            const before = game.state.devices[pick.id];
            game.buyDevice(pick.id, 1, now);
            if (before === 0) mark('首次購買：' + Config.DEVICE_BY_ID[pick.id].name);
        } else {
            game.buyUpgrade(pick.id, now);
            mark('升級：' + Content.UPGRADE_BY_ID[pick.id].name);
        }
    }

    // 菇王
    const zone = game.zone();
    const boss = Config.BOSS_BY_ID[zone.bossId];
    if (game.mode === 'field' && boss && !game.state.bosses[boss.id]) {
        if (bossTimeEstimate() <= STRATEGY.bossAttemptSeconds) {
            game.startBoss(now);
            bossTries++;
            if (game.itemShopOpen() && game.state.items.i_energy > 0) game.useItem('i_energy', now);
        }
    }
    if (game.mode === 'boss' && game.boss) {
        if (game.boss.mechanic === 'holdShield' && game.targets[0] && game.targets[0].shields > 0) {
            if (!game.holdStartedAt) game.startHold(now);
        }
        if (Object.keys(game.state.frozen).length) {
            Object.keys(game.state.frozen).forEach((id) => game.unfreezeDevice(id));
        }
    }

    // 升到下一個已解鎖且更高階的地區
    const zones = Config.ZONES.filter((z) => game.state.unlockedZones[z.id]);
    const top = zones[zones.length - 1];
    if (top && top.id !== game.state.zoneId && game.mode === 'field') game.switchZone(top.id, now);

    // 點擊
    clickCarry += clickRate() * (STEP_MS / 1000);
    while (clickCarry >= 1) {
        const alive = game.aliveTargets();
        if (alive.length) game.clickTarget(alive[0].uid, now);
        clickCarry -= 1;
    }

    // 外送員
    if (game.state.courier) game.clickCourier(now);

    now += STEP_MS;
    game.tick(now);

    const t = Math.round((now - start) / 1000);
    if (t % 60 === 0) samples.push({ minute: t / 60, dps: game.stats.autoDps, coins: game.state.lifetimeCoins });
}

function fmtTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    return `${String(m).padStart(3)}:${String(s).padStart(2, '0')}`;
}

console.log(`模擬 ${minutes} 分鐘（點擊：前 ${STRATEGY.earlyClickSeconds} 秒 ${STRATEGY.earlyClicksPerSecond}/秒，之後 ${STRATEGY.lateClicksPerSecond}/秒）\n`);
console.log('── 里程碑 ──');
timeline.filter((e) => !e.label.startsWith('成就'))
    .forEach((e) => console.log(`  ${fmtTime(e.at)}  ${e.label}  (自動 DPS ${Format.rate(e.dps)})`));

console.log('\n── 產出曲線（每 10 分鐘）──');
samples.filter((s) => s.minute % 10 === 0).forEach((s) => {
    console.log(`  ${String(s.minute).padStart(3)} 分  自動 DPS ${String(Format.rate(s.dps)).padStart(10)}   歷史菇幣 ${Format.short(s.coins)}`);
});

const state = game.state;
console.log('\n── 結束狀態 ──');
console.log(`  菇幣 ${Format.short(state.coins)}（歷史 ${Format.short(state.lifetimeCoins)}）　金湯滴 ${state.broth}（歷史 ${state.brothLifetime}）`);
console.log(`  自動 DPS ${Format.rate(game.stats.autoDps)}　點擊傷害 ${Format.short(game.stats.clickDamage)}`);
console.log(`  升級 ${Object.keys(state.upgrades).length} / ${Content.UPGRADES.length}　成就 ${Object.keys(state.achievements).length} / ${Content.ACHIEVEMENTS.length}`);
console.log(`  菇王 ${Object.keys(state.bosses).length} / ${Config.BOSSES.length}　地區 ${Object.keys(state.unlockedZones).length} / ${Config.ZONES.length}`);
console.log('  設備 ' + Config.DEVICES.map((d) => `${d.name.slice(0, 3)}:${state.devices[d.id]}`).join('  '));

const missingDevice = Config.DEVICES.filter((d) => state.devices[d.id] === 0);
if (missingDevice.length) console.log('\n  ⚠ 還沒買到：' + missingDevice.map((d) => d.name).join('、'));
const missingBoss = Config.BOSSES.filter((b) => !state.bosses[b.id]);
if (missingBoss.length) console.log('  ⚠ 還沒擊敗：' + missingBoss.map((b) => b.name).join('、'));
