#!/usr/bin/env node
/*!
 * Node 測試執行器：node tests/run-node.js
 * 測試函式可以同步執行，或回傳 Promise。
 */
'use strict';

const suite = require('./suite.js');

(async function main() {
    const results = [];
    let passed = 0;
    let failed = 0;

    for (const item of suite.tests) {
        try {
            await item.fn();
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
    console.log(`共 ${suite.tests.length} 項：通過 ${passed}，失敗 ${failed}`);
    process.exit(failed === 0 ? 0 : 1);
})();
