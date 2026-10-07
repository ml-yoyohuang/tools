#!/usr/bin/env node
/*!
 * 產生本地 dummy image（SVG）到 assets/
 * 用法：node tools/make-dummy-art.js
 *
 * 全部從設定表讀取，新增內容再跑一次就會補上占位圖。
 * 換成正式插畫時直接覆蓋同名檔案即可，不需要改任何程式。
 */
'use strict';

const fs = require('fs');
const path = require('path');
const Config = require('../js/config.js');
const Content = require('../js/content.js');

const OUT = path.join(__dirname, '..', 'assets');
const FONT = "'Segoe UI','PingFang TC','Microsoft JhengHei',system-ui,sans-serif";

function shade(hex, amount) {
    const num = parseInt(hex.slice(1), 16);
    const ch = [(num >> 16) & 255, (num >> 8) & 255, num & 255].map((c) => {
        const next = amount >= 0 ? c + (255 - c) * amount : c * (1 + amount);
        return Math.max(0, Math.min(255, Math.round(next)));
    });
    return '#' + ch.map((c) => c.toString(16).padStart(2, '0')).join('');
}

function esc(text) {
    return String(text).replace(/[&<>"']/g, (c) => (
        { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]
    ));
}

/** 蘑菇：以傘蓋輪廓 + 不同紋理區分。 */
function mushroomArt(m, id) {
    const cap = m.color;
    const ink = shade(cap, -0.55);
    const stem = '#f3ece0';
    const motifs = {
        round: `<circle cx="50" cy="38" r="7" fill="${ink}" opacity=".2"/><circle cx="68" cy="46" r="5" fill="${ink}" opacity=".2"/>`,
        nut: `<path d="M30 44 H70 M34 52 H66 M38 36 H62" stroke="${ink}" stroke-width="3" opacity=".45" fill="none"/>`,
        slim: `<path d="M44 34 V58 M50 30 V58 M56 34 V58" stroke="${ink}" stroke-width="3" opacity=".4" fill="none"/>`,
        sponge: `<g fill="${ink}" opacity=".3"><circle cx="38" cy="40" r="4"/><circle cx="52" cy="35" r="5"/><circle cx="64" cy="44" r="4"/><circle cx="46" cy="50" r="3.5"/></g>`,
        ice: `<path d="M50 26 V56 M38 33 L62 50 M62 33 L38 50" stroke="#ffffff" stroke-width="3.5" opacity=".75" fill="none" stroke-linecap="round"/>`,
        chest: `<rect x="34" y="34" width="32" height="20" rx="4" fill="${ink}" opacity=".5"/><path d="M34 44 H66" stroke="#e8c34a" stroke-width="3"/>`,
        gold: `<path d="M50 20 L55 34 L70 36 L59 46 L62 60 L50 52 L38 60 L41 46 L30 36 L45 34 Z" fill="#fff3bd" opacity=".85"/>`
    };
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100" role="img" aria-label="${esc(m.name)}">
  <title>${esc(m.name)}</title>
  <defs><linearGradient id="${id}" x1="25%" y1="10%" x2="75%" y2="90%">
    <stop offset="0" stop-color="${shade(cap, 0.35)}"/><stop offset="0.6" stop-color="${cap}"/>
    <stop offset="1" stop-color="${shade(cap, -0.28)}"/></linearGradient></defs>
  <rect x="41" y="52" width="18" height="34" rx="8" fill="${stem}" stroke="${ink}" stroke-width="2.5"/>
  <path d="M12 54 C12 28 30 14 50 14 C70 14 88 28 88 54 Z" fill="url(#${id})" stroke="${ink}" stroke-width="3"/>
  ${motifs[m.shape] || ''}
</svg>
`;
}

/** 菇王：更大、加上王冠。 */
function bossArt(b, id) {
    const cap = b.color;
    const ink = shade(cap, -0.55);
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120" role="img" aria-label="${esc(b.name)}">
  <title>${esc(b.name)}</title>
  <defs><linearGradient id="${id}" x1="25%" y1="8%" x2="75%" y2="92%">
    <stop offset="0" stop-color="${shade(cap, 0.35)}"/><stop offset="0.6" stop-color="${cap}"/>
    <stop offset="1" stop-color="${shade(cap, -0.3)}"/></linearGradient></defs>
  <rect x="46" y="62" width="28" height="46" rx="10" fill="#f3ece0" stroke="${ink}" stroke-width="3"/>
  <path d="M8 66 C8 32 30 14 60 14 C90 14 112 32 112 66 Z" fill="url(#${id})" stroke="${ink}" stroke-width="3.5"/>
  <path d="M38 22 L46 8 L54 20 L60 4 L66 20 L74 8 L82 22 Z" fill="${b.accent}" stroke="${ink}" stroke-width="2.5" stroke-linejoin="round"/>
</svg>
`;
}

/** 設備／道具／裝備／升級：統一的方塊圖示 + 名稱標籤。 */
function tile(color, label, glyph, id) {
    const ink = shade(color, -0.6);
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120" role="img" aria-label="${esc(label)}">
  <title>${esc(label)}</title>
  <defs><linearGradient id="${id}" x1="20%" y1="8%" x2="80%" y2="96%">
    <stop offset="0" stop-color="${shade(color, 0.32)}"/><stop offset="0.55" stop-color="${color}"/>
    <stop offset="1" stop-color="${shade(color, -0.26)}"/></linearGradient></defs>
  <rect x="6" y="6" width="108" height="108" rx="22" fill="url(#${id})" stroke="${ink}" stroke-width="3"/>
  <text x="60" y="58" text-anchor="middle" font-family="${FONT}" font-size="38" font-weight="700" fill="#ffffff" opacity=".95">${esc(glyph)}</text>
  <rect x="12" y="80" width="96" height="24" rx="12" fill="#ffffff" opacity=".9"/>
  <text x="60" y="96.5" text-anchor="middle" font-family="${FONT}" font-size="13" font-weight="700" fill="${ink}">${esc(label)}</text>
</svg>
`;
}

function courierArt() {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100" role="img" aria-label="迷路的外送員">
  <title>迷路的外送員</title>
  <rect x="26" y="20" width="48" height="36" rx="6" fill="#2f7dd1" stroke="#143a63" stroke-width="3"/>
  <text x="50" y="45" text-anchor="middle" font-family="${FONT}" font-size="20" font-weight="700" fill="#ffffff">外送</text>
  <path d="M12 58 C12 42 24 32 36 32 C48 32 58 42 58 58 Z" fill="#e8d4b0" stroke="#6b5231" stroke-width="3"/>
  <rect x="28" y="56" width="14" height="30" rx="6" fill="#f3ece0" stroke="#6b5231" stroke-width="2.5"/>
</svg>
`;
}

fs.mkdirSync(OUT, { recursive: true });
let count = 0;
const write = (name, content) => { fs.writeFileSync(path.join(OUT, name), content, 'utf8'); count++; };

Config.MUSHROOMS.forEach((m) => write(path.basename(m.image), mushroomArt(m, 'm' + m.id)));
Config.BOSSES.forEach((b) => write(path.basename(b.image), bossArt(b, 'k' + b.id)));
Config.DEVICES.forEach((d) => write(path.basename(d.image), tile(d.color, d.name.slice(0, 5), String(d.index + 1), 'd' + d.id)));
Content.ITEMS.forEach((i) => write(path.basename(i.image), tile(i.color, i.name.slice(0, 5), '★', 'i' + i.id)));
Content.EQUIPMENT.forEach((e, idx) => write(path.basename(e.image), tile('#7a5ea8', e.name.slice(0, 4), '◆', 'e' + idx)));

const GROUP_COLOR = { click: '#c2631c', auto: '#4f7aa8', syn: '#7a4fa8', eco: '#2f8a63', milestone: '#b3923a' };
const GROUP_GLYPH = { click: '✋', auto: '⚙', syn: '⇄', eco: '◎', milestone: '★' };
Content.UPGRADES.forEach((u) => write(path.basename(u.image),
    tile(GROUP_COLOR[u.group] || '#777', u.name.slice(0, 5), GROUP_GLYPH[u.group] || '◆', 'u' + u.id)));

write('courier.svg', courierArt());

console.log(`完成：共產生 ${count} 張占位圖到 assets/`);
