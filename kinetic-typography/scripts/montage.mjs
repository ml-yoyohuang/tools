// Stack PNG files vertically into one image (for reviewing many snapshot sheets at once).
//   node scripts/montage.mjs out.png a.png b.png ...
import { chromium } from '@playwright/test';
import fs from 'node:fs';

const [out, ...files] = process.argv.slice(2);
const browser = await chromium.launch();
const page = await browser.newPage();
const datas = files.map((f) => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64'));
const png = await page.evaluate(async (datas) => {
  const imgs = await Promise.all(
    datas.map(async (d) => {
      const i = new Image();
      i.src = d;
      await i.decode();
      return i;
    }),
  );
  const c = document.createElement('canvas');
  c.width = Math.max(...imgs.map((i) => i.width));
  c.height = imgs.reduce((a, i) => a + i.height + 4, 0);
  const g = c.getContext('2d');
  g.fillStyle = '#444';
  g.fillRect(0, 0, c.width, c.height);
  let y = 0;
  for (const i of imgs) {
    g.drawImage(i, 0, y);
    y += i.height + 4;
  }
  return c.toDataURL('image/png');
}, datas);
fs.writeFileSync(out, Buffer.from(png.split(',')[1], 'base64'));
await browser.close();
console.log(out);
