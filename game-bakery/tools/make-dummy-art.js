#!/usr/bin/env node
/*!
 * 產生本地 dummy image（SVG）到 assets/
 * 用法：node tools/make-dummy-art.js
 *
 * 內容直接從設定表讀取，之後新增設備／升級／道具再跑一次就會補上占位圖。
 * 要換成正式插畫時，直接覆蓋同名檔案即可，不需要改任何程式。
 */
'use strict';

const fs = require('fs');
const path = require('path');
const Config = require('../js/config.js');
const Content = require('../js/content.js');

const OUT = path.join(__dirname, '..', 'assets');

const PALETTE = {
    clicker: '#6b7cff', granny: '#c2567a', oven: '#d1612c', factory: '#4f8a8b',
    mine: '#8a6f3e', portal: '#7d4bc4', timeBaker: '#2d8a5f', council: '#b3892c'
};
const GROUP_COLOR = { click: '#c2631c', building: '#4f7aa8', synergy: '#7a4fa8', global: '#2f8a63' };
const ITEM_COLOR = { frenzy: '#d94f3d', goldenFinger: '#d6a521', discount: '#3f8fb0', timeSugar: '#7b61c9' };

function shade(hex, amount) {
    const num = parseInt(hex.slice(1), 16);
    const ch = [(num >> 16) & 255, (num >> 8) & 255, num & 255].map((c) => {
        const next = amount >= 0 ? c + (255 - c) * amount : c * (1 + amount);
        return Math.max(0, Math.min(255, Math.round(next)));
    });
    return '#' + ch.map((c) => c.toString(16).padStart(2, '0')).join('');
}

function escapeXml(text) {
    return String(text).replace(/[&<>"']/g, (c) => (
        { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]
    ));
}

const FONT = "'Segoe UI','PingFang TC','Microsoft JhengHei',system-ui,sans-serif";

/** 共用外框：圓角方塊 + 標籤文字，確保每張圖都看得懂是什麼。 */
function tile(color, label, glyph, id) {
    const light = shade(color, 0.32);
    const dark = shade(color, -0.26);
    const ink = shade(color, -0.62);
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120" role="img" aria-label="${escapeXml(label)}">
  <title>${escapeXml(label)}</title>
  <defs>
    <linearGradient id="${id}" x1="20%" y1="8%" x2="80%" y2="96%">
      <stop offset="0" stop-color="${light}"/>
      <stop offset="0.55" stop-color="${color}"/>
      <stop offset="1" stop-color="${dark}"/>
    </linearGradient>
  </defs>
  <rect x="6" y="6" width="108" height="108" rx="24" fill="url(#${id})" stroke="${ink}" stroke-width="3"/>
  <text x="60" y="58" text-anchor="middle" font-family="${FONT}" font-size="40" font-weight="700"
        fill="#ffffff" opacity=".95">${escapeXml(glyph)}</text>
  <rect x="14" y="80" width="92" height="24" rx="12" fill="#ffffff" opacity=".88"/>
  <text x="60" y="96.5" text-anchor="middle" font-family="${FONT}" font-size="13" font-weight="700"
        fill="${ink}">${escapeXml(label)}</text>
</svg>
`;
}

/** 主餅乾：圓形 + 巧克力豆，透明背景。 */
function mainCookie() {
    const base = '#c98b45';
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200" role="img" aria-label="大餅乾">
  <title>大餅乾</title>
  <defs>
    <radialGradient id="ck" cx="36%" cy="30%" r="78%">
      <stop offset="0" stop-color="${shade(base, 0.35)}"/>
      <stop offset="0.6" stop-color="${base}"/>
      <stop offset="1" stop-color="${shade(base, -0.3)}"/>
    </radialGradient>
  </defs>
  <circle cx="100" cy="100" r="92" fill="url(#ck)" stroke="${shade(base, -0.5)}" stroke-width="5"/>
  <g fill="${shade(base, -0.62)}">
    <circle cx="68" cy="66" r="13"/><circle cx="131" cy="78" r="11"/>
    <circle cx="96" cy="112" r="14"/><circle cx="58" cy="128" r="10"/>
    <circle cx="137" cy="134" r="12"/><circle cx="104" cy="44" r="8"/>
  </g>
  <ellipse cx="68" cy="52" rx="26" ry="16" fill="#ffffff" opacity=".18" transform="rotate(-28 68 52)"/>
</svg>
`;
}

function goldenCookie() {
    const base = '#e8b320';
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120" role="img" aria-label="黃金餅乾">
  <title>黃金餅乾</title>
  <defs>
    <radialGradient id="gc" cx="34%" cy="28%" r="80%">
      <stop offset="0" stop-color="#fff3c4"/>
      <stop offset="0.55" stop-color="${base}"/>
      <stop offset="1" stop-color="${shade(base, -0.35)}"/>
    </radialGradient>
  </defs>
  <circle cx="60" cy="60" r="52" fill="url(#gc)" stroke="${shade(base, -0.5)}" stroke-width="4"/>
  <g fill="${shade(base, -0.55)}" opacity=".75">
    <circle cx="44" cy="44" r="7"/><circle cx="78" cy="52" r="6"/><circle cx="58" cy="76" r="8"/>
  </g>
  <path d="M60 6 L66 24 L84 20 L72 34 L60 6Z" fill="#fff6d0" opacity=".8"/>
</svg>
`;
}

fs.mkdirSync(OUT, { recursive: true });

let count = 0;
function write(name, content) {
    fs.writeFileSync(path.join(OUT, name), content, 'utf8');
    count++;
}

write('cookie-main.svg', mainCookie());
write('cookie-golden.svg', goldenCookie());

Config.BUILDINGS.forEach((building) => {
    const color = PALETTE[building.id] || '#777777';
    write(path.basename(building.image), tile(color, building.short, String(building.tier), 'b' + building.id));
});

Config.ITEMS.forEach((item, index) => {
    const color = ITEM_COLOR[item.id] || '#777777';
    write(path.basename(item.image), tile(color, item.name.slice(0, 4), '★', 'i' + index));
});

Content.UPGRADES.forEach((upgrade) => {
    const color = GROUP_COLOR[upgrade.group] || '#777777';
    const glyph = { click: '✋', building: '⚙', synergy: '⇄', global: '◎' }[upgrade.group] || '◆';
    write(path.basename(upgrade.image), tile(color, upgrade.name.slice(0, 5), glyph, 'u' + upgrade.id));
});

console.log(`完成：共產生 ${count} 張占位圖到 assets/`);
