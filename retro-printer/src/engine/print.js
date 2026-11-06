import { renderLayer } from './render.js';
import { smearLayer } from './wet.js';
import { coarseCover } from './mask.js';
import { composite } from './composite.js';

// 掀框：算出第 L 層的成品，並處理它對下層未乾墨的影響。
// 直接更新 job.layers 裡的資料（見 state.js）。
export function printLayer(job, L, C) {
  const layer = job.layers[L];
  const { alpha, vertical } = renderLayer({
    plate: layer.plate, rec: layer.rec, offset: layer.offset,
    clog: layer.clog, absorb: job.medium.absorb
  }, C);
  layer.stains = [];
  for (let j = 0; j < L; j++) {
    const under = job.layers[j], w = layer.wetAt[j];
    layer.stains.push({ rgb: under.ink.rgb, raw: under.alpha, k: C.stain * w, pick: layer.rec.pick[j] });
    under.alpha = smearLayer(under.alpha, layer.rec, vertical, w, C);
  }
  layer.alpha = alpha;
  layer.vertical = vertical;
  layer.cover = coarseCover(alpha);
}

export function compositeJob(job, C) {
  return composite(
    job.layers.map(l => ({ alpha: l.alpha, rgb: l.ink.rgb, stains: l.stains })),
    job.medium.paper, C
  );
}
