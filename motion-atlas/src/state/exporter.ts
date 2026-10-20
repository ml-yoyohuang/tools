// PNG / WebM export. The strategy depends on the renderer capability:
//   canvas → copy the live canvas (optionally re-rendered without background)
//   svg    → serialise the live SVG, rasterise through an <img>
//   dom    → experimental: wrap a clone of the live DOM in SVG <foreignObject>
//   css3d  → not supported (foreignObject cannot reproduce preserve-3d reliably)
import type { Player } from '../engine/player';
import type { EffectDef } from '../engine/types';

export interface PngOptions {
  transparent: boolean;
  guides: boolean;
  guideOpacity: number;
}

export interface PngResult {
  blob: Blob | null;
  note?: string;
  error?: string;
}

/** Safe-area guide geometry in a w×h frame (shared by the overlay and the export). */
export function guideShapes(w: number, h: number) {
  const m = Math.min(w, h);
  const action = { x: w * 0.05, y: h * 0.05, w: w * 0.9, h: h * 0.9 };
  const title = { x: w * 0.1, y: h * 0.1, w: w * 0.8, h: h * 0.8 };
  const sub = { x: w * 0.1, y: h * 0.78, w: w * 0.8, h: h * 0.12 };
  const head = { cx: w / 2, cy: h * 0.36, r: m * 0.11 };
  const body = { cx: w / 2, top: h * 0.36 + m * 0.13, w: m * 0.42, bottom: h * 0.74 };
  return { action, title, sub, head, body };
}

export function drawGuides(g: CanvasRenderingContext2D, w: number, h: number, opacity: number) {
  const s = guideShapes(w, h);
  g.save();
  g.globalAlpha = opacity;
  g.lineWidth = Math.max(1, Math.min(w, h) * 0.003);
  g.setLineDash([Math.min(w, h) * 0.012, Math.min(w, h) * 0.008]);
  g.strokeStyle = '#00E0FF';
  g.strokeRect(s.action.x, s.action.y, s.action.w, s.action.h);
  g.strokeStyle = '#FFE35A';
  g.strokeRect(s.title.x, s.title.y, s.title.w, s.title.h);
  g.setLineDash([]);
  g.fillStyle = 'rgba(237,88,154,0.18)';
  g.strokeStyle = '#ED589A';
  g.fillRect(s.sub.x, s.sub.y, s.sub.w, s.sub.h);
  g.strokeRect(s.sub.x, s.sub.y, s.sub.w, s.sub.h);
  g.strokeStyle = '#FFFFFF';
  g.beginPath();
  g.arc(s.head.cx, s.head.cy, s.head.r, 0, Math.PI * 2);
  g.moveTo(s.body.cx - s.body.w / 2, s.body.bottom);
  g.quadraticCurveTo(s.body.cx - s.body.w / 2, s.body.top, s.body.cx, s.body.top);
  g.quadraticCurveTo(s.body.cx + s.body.w / 2, s.body.top, s.body.cx + s.body.w / 2, s.body.bottom);
  g.stroke();
  g.restore();
}

const toBlob = (c: HTMLCanvasElement) => new Promise<Blob | null>((r) => c.toBlob((b) => r(b), 'image/png'));

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image load failed'));
    img.src = url;
  });
}

async function rasterSvg(markup: string, W: number, H: number): Promise<HTMLCanvasElement> {
  // data: URL (not blob:) — Chromium does not taint the canvas for data-URL SVG with foreignObject
  const img = await loadImage('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(markup));
  const out = document.createElement('canvas');
  out.width = W;
  out.height = H;
  out.getContext('2d')!.drawImage(img, 0, 0, W, H);
  return out;
}

export async function capturePNG(player: Player, def: EffectDef, opts: PngOptions): Promise<PngResult> {
  const rt = player.currentRuntime;
  const cap = def.capabilities;
  if (!rt || !cap.png) return { blob: null, error: '此效果的 renderer 不支援 PNG 截取。' };
  const stage = player.stage;
  const w = stage.clientWidth;
  const h = stage.clientHeight;
  const transparent = opts.transparent && cap.transparentPng;
  let out: HTMLCanvasElement;
  let note: string | undefined;
  try {
    if (cap.png === 'canvas' && rt.canvas) {
      const src = rt.canvas;
      out = document.createElement('canvas');
      out.width = src.width;
      out.height = src.height;
      const g = out.getContext('2d')!;
      if (transparent) player.withTransparent(() => g.drawImage(src, 0, 0));
      else g.drawImage(src, 0, 0);
    } else if (cap.png === 'svg' && rt.svg) {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const W = Math.round(w * dpr);
      const H = Math.round(h * dpr);
      const clone = rt.svg.cloneNode(true) as SVGSVGElement;
      clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      clone.setAttribute('width', String(W));
      clone.setAttribute('height', String(H));
      clone.removeAttribute('style');
      if (!transparent) {
        const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        bg.setAttribute('width', '100%');
        bg.setAttribute('height', '100%');
        bg.setAttribute('fill', player.settings.background);
        clone.insertBefore(bg, clone.firstChild);
      }
      out = await rasterSvg(new XMLSerializer().serializeToString(clone), W, H);
      if (clone.querySelector('text')) note = 'SVG 轉點陣時無法使用網頁字體，文字會以系統字體呈現。';
    } else if (cap.png === 'dom') {
      const root = player.effectRoot;
      if (!root) return { blob: null, error: '畫面尚未就緒。' };
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const clone = root.cloneNode(true) as HTMLElement;
      clone.removeAttribute('aria-hidden');
      clone.setAttribute('style', `position:relative;width:${w}px;height:${h}px;overflow:hidden;background:${player.settings.background}`);
      const html = new XMLSerializer().serializeToString(clone);
      const markup = `<svg xmlns="http://www.w3.org/2000/svg" width="${w * dpr}" height="${h * dpr}" viewBox="0 0 ${w} ${h}"><foreignObject x="0" y="0" width="${w}" height="${h}">${html}</foreignObject></svg>`;
      out = await rasterSvg(markup, Math.round(w * dpr), Math.round(h * dpr));
      note = 'DOM 截取為實驗功能：網頁字體、濾鏡與部分 CSS 可能無法完整保留。';
    } else return { blob: null, error: '此效果目前無法截圖。' };
  } catch (err) {
    console.warn('[export] png failed', err);
    return { blob: null, error: '截圖失敗：瀏覽器拒絕把此畫面轉成圖片（可能是安全限制或不支援的 CSS）。' };
  }
  if (opts.guides) drawGuides(out.getContext('2d')!, out.width, out.height, opts.guideOpacity);
  try {
    const blob = await toBlob(out);
    return { blob, note };
  } catch {
    return { blob: null, error: '瀏覽器無法輸出 PNG（畫布可能被標記為不安全）。' };
  }
}

export function webmSupported(def: EffectDef): string | null {
  if (!def.capabilities.webm) return null;
  if (typeof MediaRecorder === 'undefined' || typeof HTMLCanvasElement.prototype.captureStream !== 'function') return null;
  return ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find((m) => MediaRecorder.isTypeSupported(m)) ?? null;
}

/** Record `seconds` of the live canvas in real time (restarts the effect first). */
export async function recordWebM(player: Player, def: EffectDef, seconds: number): Promise<Blob | null> {
  const mime = webmSupported(def);
  const canvas = player.currentRuntime?.canvas;
  if (!mime || !canvas) return null;
  const stream = canvas.captureStream(30);
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 6_000_000 });
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => {
    if (e.data.size) chunks.push(e.data);
  };
  const done = new Promise<void>((r) => (rec.onstop = () => r()));
  player.restart();
  rec.start(250);
  await new Promise((r) => setTimeout(r, seconds * 1000));
  rec.stop();
  await done;
  stream.getTracks().forEach((t) => t.stop());
  return chunks.length ? new Blob(chunks, { type: 'video/webm' }) : null;
}

export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
