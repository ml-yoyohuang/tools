#!/usr/bin/env node
/*!
 * Node 測試執行器：node tests/run-node.js
 * 另外在 Node 中額外檢查 CSS 方塊配色的文字對比度（瀏覽器版無法讀檔，故略過）。
 */
'use strict';

const fs = require('fs');
const path = require('path');
const suite = require('./suite.js');

const tests = suite.tests.slice();

/* ---------- 僅在 Node 執行的配色對比度檢查 ---------- */

function relativeLuminance(hex) {
    const value = hex.replace('#', '');
    const channels = [0, 2, 4].map((i) => parseInt(value.substr(i, 2), 16) / 255)
        .map((c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrastRatio(a, b) {
    const l1 = relativeLuminance(a);
    const l2 = relativeLuminance(b);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

tests.push({
    name: '每個方塊的文字與底色對比度至少 4.5:1（淺色與深色主題）',
    fn() {
        const css = fs.readFileSync(path.join(__dirname, '..', 'css', 'style.css'), 'utf8');
        const blocks = {
            light: css.slice(css.indexOf(':root {'), css.indexOf('html[data-theme="dark"]')),
            dark: css.slice(css.indexOf('html[data-theme="dark"]'), css.indexOf('/* ---------- 基礎'))
        };

        let checked = 0;
        for (const [theme, block] of Object.entries(blocks)) {
            const pairs = {};
            const pattern = /--tile-([0-9]+|super)-(bg|fg):\s*(#[0-9a-fA-F]{6})/g;
            let match;
            while ((match = pattern.exec(block)) !== null) {
                pairs[match[1]] = pairs[match[1]] || {};
                pairs[match[1]][match[2]] = match[3];
            }
            const keys = Object.keys(pairs);
            if (keys.length < 12) {
                throw new Error(`${theme} 主題只找到 ${keys.length} 組方塊配色，應至少 12 組`);
            }
            for (const key of keys) {
                const { bg, fg } = pairs[key];
                if (!bg || !fg) throw new Error(`${theme} 主題的方塊 ${key} 缺少 bg 或 fg`);
                const ratio = contrastRatio(bg, fg);
                if (ratio < 4.5) {
                    throw new Error(`${theme} 主題方塊 ${key}（${bg} / ${fg}）對比度只有 ${ratio.toFixed(2)}:1`);
                }
                checked++;
            }
        }
        if (checked < 24) throw new Error(`只檢查了 ${checked} 組配色`);
    }
});

/* ---------- 執行 ---------- */

const results = [];
let passed = 0;
let failed = 0;

for (const item of tests) {
    try {
        item.fn();
        passed++;
        results.push({ ok: true, name: item.name });
    } catch (error) {
        failed++;
        results.push({ ok: false, name: item.name, error });
    }
}

for (const result of results) {
    if (result.ok) {
        console.log(`  ✓ ${result.name}`);
    } else {
        console.log(`  ✗ ${result.name}`);
        console.log(`      ${result.error && result.error.message}`);
    }
}

console.log('');
console.log(`共 ${tests.length} 項：通過 ${passed}，失敗 ${failed}`);
process.exit(failed === 0 ? 0 : 1);
