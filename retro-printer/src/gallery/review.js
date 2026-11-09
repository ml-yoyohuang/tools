// 審圖頁：每個圖案隨機生成 12 張，用來檢查每一批新圖案。
import { GENERATORS, THEMES } from './registry.js';
import { makeItem } from './library.js';
import { drawWallPrint } from './render.js';
import { composeMasks } from './compose.js';

const PER = 12, SIZE = 300;
const root = document.getElementById('review');
const only = decodeURIComponent(location.hash.slice(1));
// #葉、#leaves 只看一個圖案；#characters 只看一個主題
const gens = GENERATORS.filter(g => !only || g.name === only || g.id === only || g.theme === only);

const jobs = [];
for (const gen of gens) {
  const sec = document.createElement('section');
  sec.innerHTML = `<h2></h2><div class="grid"></div>`;
  sec.querySelector('h2').innerHTML = `${gen.name}<small>${gen.id}・${THEMES[gen.theme] || gen.theme}${gen.star ? '・★' : ''}・${gen.layouts.join(' / ')}</small>`;
  const grid = sec.querySelector('.grid');
  for (let k = 0; k < PER; k++) {
    const item = makeItem(Math.random, [gen]);
    const fig = document.createElement('figure');
    const cv = document.createElement('canvas');
    cv.width = cv.height = SIZE;
    fig.appendChild(cv);
    const cap = document.createElement('figcaption');
    cap.textContent = `${item.layout}・${item.inks.map(i => i.name).join(' / ')}・${item.medium.name}`;
    fig.appendChild(cap);
    grid.appendChild(fig);
    jobs.push({ item, cv });
  }
  root.appendChild(sec);
}

// 主控台工具（開發用）：
//   reviewCheck(['planet', ...])  每個圖案在各版面、各色數跑幾次，回報錯誤與「幾乎沒印東西的一層」
//   reviewZoom(['planet', ...], ['center', 'grid3'])  在頁面上疊一張放大的檢視圖；reviewZoom() 關掉
window.reviewCheck = (ids, times = 8) => {
  const out = {};
  for (const gen of GENERATORS.filter(g => ids.includes(g.id))) {
    const errs = [], empty = {};
    for (const layout of gen.layouts) for (const n of gen.colors) for (let k = 0; k < times; k++) {
      try {
        composeMasks({ gen, layout, seed: Math.floor(Math.random() * 1e9), n }, 120).forEach((m, li) => {
          let s = 0; for (const v of m) s += v;
          if (s / m.length < 0.003) { const key = `${layout}/${n}色/第${li + 1}層`; empty[key] = (empty[key] || 0) + 1; }
        });
      } catch (e) { errs.push(`${layout}/${n}: ${e.message}`); }
    }
    out[gen.id] = { errors: errs.slice(0, 3), empty };
  }
  return out;
};
window.reviewZoom = (ids, layouts = ['center', 'center', 'grid3', 'badge']) => {
  document.getElementById('review-zoom')?.remove();
  if (!ids) return;
  const box = document.createElement('div');
  box.id = 'review-zoom';
  box.style.cssText = 'position:fixed;inset:0;z-index:99;background:#ECEBE7;display:grid;grid-template-columns:repeat(4,1fr);gap:8px;padding:8px;align-content:start;overflow:auto';
  for (const id of ids) {
    const gen = GENERATORS.find(g => g.id === id);
    for (const lay of layouts) {
      const want = gen.layouts.includes(lay) ? lay : gen.layouts[0];
      let item;
      do { item = makeItem(Math.random, [gen]); } while (item.layout !== want);
      const cv = document.createElement('canvas');
      cv.width = cv.height = 360; cv.style.width = '100%';
      drawWallPrint(item, cv);
      box.appendChild(cv);
    }
  }
  document.body.appendChild(box);
};

const errors = [];
const next = () => {
  const job = jobs.shift();
  if (!job) {
    if (errors.length) console.error('審圖失敗：', errors);
    return;
  }
  try { drawWallPrint(job.item, job.cv); } catch (e) { errors.push(`${job.item.genId}/${job.item.layout}: ${e.message}`); }
  setTimeout(next, 0);
};
next();
