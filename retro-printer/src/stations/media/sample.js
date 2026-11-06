import { CONFIG as C } from '../../config.js';
import { setRandom, seeded } from '../../engine/random.js';
import { startStroke, moveStroke } from '../../engine/record.js';
import { printLayer, compositeJob } from '../../engine/print.js';
import { createJob } from '../../state.js';

// 試印：用固定種子、正常速度把每一層刮兩道，讓不同媒材之間只差在媒材本身。
const SEED = 20261106;

function scrape(rec, x, under) {
  let t = 1000;
  startStroke(rec, { x, y: 76 }, t);
  for (let y = 82; y <= 524; y += 6) { t += 12; moveStroke(rec, { x, y }, t, under, C); }
}

export function samplePrint(plates, inks, medium) {
  setRandom(seeded(SEED));
  try {
    const job = createJob({ plates, inks, medium });
    job.layers.forEach((layer, L) => {
      const under = job.layers.slice(0, L).map(u => ({ wet: 0, cover: u.cover }));
      scrape(layer.rec, 235, under);
      scrape(layer.rec, 365, under);
      printLayer(job, L, C);
    });
    return compositeJob(job, C);
  } finally {
    setRandom(null);
  }
}
