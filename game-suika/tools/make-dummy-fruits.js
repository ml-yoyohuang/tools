#!/usr/bin/env node
/*!
 * 產生 11 張本地假圖（SVG）到 assets/fruits/
 * 用法：node tools/make-dummy-fruits.js
 *
 * 這些只是暫時的占位圖。要換成正式插畫時，直接覆蓋 assets/fruits/fruit-NN.svg
 * （或改 js/config.js 裡的 image 路徑），不需要動到任何遊戲邏輯。
 */
'use strict';

const fs = require('fs');
const path = require('path');
const config = require('../js/config.js');

const OUT_DIR = path.join(__dirname, '..', 'assets', 'fruits');

/** 把顏色調亮或調暗，用來做漸層與陰影。 */
function shade(hex, amount) {
    const num = parseInt(hex.slice(1), 16);
    const channels = [(num >> 16) & 255, (num >> 8) & 255, num & 255].map((c) => {
        const next = amount >= 0 ? c + (255 - c) * amount : c * (1 + amount);
        return Math.max(0, Math.min(255, Math.round(next)));
    });
    return '#' + channels.map((c) => c.toString(16).padStart(2, '0')).join('');
}

/** 每個等級的裝飾圖形，確保不單靠顏色就能分辨。 */
function motif(shape, color) {
    const ink = shade(color, -0.45);
    // 注意：stroke-width 由各 motif 自行指定，不要放進這裡，
    // 否則同一個元素會出現重複屬性，SVG（嚴格 XML）會解析失敗。
    const line = `stroke="${ink}" fill="none" stroke-linecap="round"`;
    const w = (value) => `stroke-width="${value}"`;
    switch (shape) {
        case 'dot':
            return `<circle cx="50" cy="44" r="6" fill="${ink}" opacity=".55"/>`;
        case 'pair':
            return `<circle cx="40" cy="44" r="6" fill="${ink}" opacity=".55"/>
    <circle cx="60" cy="44" r="6" fill="${ink}" opacity=".55"/>`;
        case 'ring':
            return `<circle cx="50" cy="46" r="16" ${line} ${w(3.2)} opacity=".6"/>`;
        case 'wedge':
            return `<path d="M50 28 L68 58 L32 58 Z" fill="${ink}" opacity=".45"/>`;
        case 'segment':
            return `<g ${line} ${w(3.2)} opacity=".55"><path d="M50 26 V66"/><path d="M30 46 H70"/>
    <path d="M36 32 L64 60"/><path d="M64 32 L36 60"/></g>`;
        case 'leaf':
            return `<path d="M50 24 C62 24 68 32 66 42 C56 44 48 38 50 24 Z" fill="${ink}" opacity=".45"/>
    <path d="M50 26 V48" ${line} ${w(3.2)} opacity=".5"/>`;
        case 'pearl':
            return `<circle cx="50" cy="46" r="17" ${line} ${w(3.2)} opacity=".5"/>
    <circle cx="50" cy="46" r="7" fill="${ink}" opacity=".5"/>`;
        case 'cleft':
            return `<path d="M50 24 V68" ${line} ${w(4.5)} opacity=".55"/>`;
        case 'grid':
            return `<g ${line} ${w(3.2)} opacity=".5"><path d="M34 34 L66 58"/><path d="M34 58 L66 34"/>
    <path d="M50 26 V66"/></g>`;
        case 'net':
            return `<g ${line} ${w(2.6)} opacity=".5"><path d="M28 40 H72"/><path d="M28 54 H72"/>
    <path d="M40 26 V68"/><path d="M60 26 V68"/></g>`;
        case 'stripe':
            return `<g ${line} ${w(5)} opacity=".5"><path d="M36 24 V70"/>
    <path d="M50 22 V72"/><path d="M64 24 V70"/></g>`;
        default:
            return '';
    }
}

function svgFor(item) {
    const light = shade(item.color, 0.3);
    const dark = shade(item.color, -0.22);
    const ink = shade(item.color, -0.55);
    const id = 'g' + item.level;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100" role="img" aria-label="等級 ${item.level} ${item.name}">
  <title>等級 ${item.level}：${item.name}</title>
  <defs>
    <linearGradient id="${id}" x1="28%" y1="14%" x2="74%" y2="92%">
      <stop offset="0" stop-color="${light}"/>
      <stop offset="0.55" stop-color="${item.color}"/>
      <stop offset="1" stop-color="${dark}"/>
    </linearGradient>
  </defs>
  <circle cx="50" cy="50" r="47" fill="url(#${id})" stroke="${ink}" stroke-width="2.5"/>
  <ellipse cx="37" cy="31" rx="15" ry="10" fill="#ffffff" opacity=".28" transform="rotate(-28 37 31)"/>
  ${motif(item.shape, item.color)}
  <g>
    <rect x="34" y="70" width="32" height="20" rx="10" fill="#ffffff" opacity=".9"/>
    <text x="50" y="84.5" text-anchor="middle" font-family="'Segoe UI', 'PingFang TC', system-ui, sans-serif"
          font-size="15" font-weight="700" fill="${ink}">${item.level}</text>
  </g>
</svg>
`;
}

fs.mkdirSync(OUT_DIR, { recursive: true });

let written = 0;
for (const item of config.LEVELS) {
    const file = path.join(OUT_DIR, path.basename(item.image));
    fs.writeFileSync(file, svgFor(item), 'utf8');
    written++;
    console.log(`  寫入 ${path.relative(path.join(__dirname, '..'), file)}  (${item.name}，半徑 ${item.radius})`);
}
console.log(`\n完成：共 ${written} 張假圖。`);
