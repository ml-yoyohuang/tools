// 推版前執行：node scripts/stamp.mjs
// 依檔案內容替 index.html 的樣式、程式加上版本 hash，瀏覽器才不會拿到舊的快取。
//   - 樣式與入口程式：網址加上 ?v=hash
//   - 所有 JS 模組：寫進 import map，模組之間的 import 也會帶上各自的 hash
// 只改 index.html 裡 <!-- stamp --> 與 <!-- /stamp --> 之間的內容。
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const hash = f => createHash('sha1').update(readFileSync(join(root, f))).digest('hex').slice(0, 10);
const walk = d => readdirSync(join(root, d)).flatMap(n => {
  const p = `${d}/${n}`;
  return statSync(join(root, p)).isDirectory() ? walk(p) : [p];
});

const CSS = [
  'src/ui/tokens.css', 'src/ui/layout.css', 'src/ui/panel.css',
  'src/stations/entrance/entrance.css', 'src/stations/source/source.css', 'src/stations/plates/plates.css',
  'src/stations/inks/inks.css', 'src/stations/media/media.css', 'src/stations/workbench/workbench.css',
  'src/stations/finish/finish.css'
];
const js = walk('src').filter(f => f.endsWith('.js')).sort();
const imports = Object.fromEntries(js.map(f => [`./${f}`, `./${f}?v=${hash(f)}`]));

const block = [
  '<!-- stamp：由 scripts/stamp.mjs 產生，請勿手改 -->',
  ...CSS.map(f => `<link rel="stylesheet" href="${f}?v=${hash(f)}">`),
  `<script type="importmap">${JSON.stringify({ imports }, null, 1)}</script>`,
  `<script type="module" src="src/main.js?v=${hash('src/main.js')}"></script>`
].join('\n');

const file = join(root, 'index.html');
const html = readFileSync(file, 'utf8');
const re = /<!-- stamp -->[\s\S]*?<!-- \/stamp -->/;
if (!re.test(html)) throw new Error('index.html 裡找不到 <!-- stamp --> 區塊');
writeFileSync(file, html.replace(re, `<!-- stamp -->\n${block}\n<!-- /stamp -->`));
console.log(`stamped ${CSS.length} css, ${js.length} js (${relative(process.cwd(), file)})`);
