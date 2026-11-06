import { renderLayer } from './render.js';
import { smearLayer } from './wet.js';
import { coarseCover } from './mask.js';
import { composite } from './composite.js';
import { textureField } from './texture.js';
import { streakMap } from './ink.js';

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
  // 自調墨沒攪勻時的色紋（一般墨水不會多用到亂數，輸出不變）
  layer.inkMap = layer.ink.mix ? streakMap(layer.ink.mix, vertical) : null;
}

export function compositeJob(job, C) {
  return composite(
    job.layers.map(l => ({ alpha: l.alpha, rgb: l.ink.rgb, mix: l.ink.mix, inkMap: l.inkMap, stains: l.stains })),
    job.medium.paper, C, surfaceOf(job.medium)
  );
}

// 媒材的表面效果；紙卡沒有織紋、濃度為 1，回傳 null 讓輸出與原本完全相同
export function surfaceOf(medium) {
  const t = medium.texture, density = medium.density ?? 1;
  if (!t && density === 1) return null;
  return {
    tex: t ? textureField(medium.id, t) : null,
    ground: t ? t.ground : 0, ink: t ? t.ink : 0, density
  };
}
