// 審圖頁：每個圖案隨機生成 12 張，用來檢查每一批新圖案。
import { GENERATORS, THEMES } from './registry.js';
import { makeItem } from './library.js';
import { drawWallPrint } from './render.js';

const PER = 12, SIZE = 300;
const root = document.getElementById('review');
const only = decodeURIComponent(location.hash.slice(1));
const gens = GENERATORS.filter(g => !only || g.name === only || g.id === only);

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
