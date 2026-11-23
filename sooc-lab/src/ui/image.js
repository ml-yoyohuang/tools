// Decoding (EXIF orientation is applied by the browser's <img> decoder) and resampling.

export async function decodeFile(file) {
  const url = URL.createObjectURL(file);
  const img = new Image();
  try {
    // onload rather than img.decode(): decode() can stall in background/hidden documents.
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = url;
    });
    if (!img.naturalWidth) throw new Error('EMPTY');
  } catch {
    URL.revokeObjectURL(url);
    const heic = /\.(heic|heif)$/i.test(file.name || '') || /hei[cf]/i.test(file.type || '');
    throw new Error(heic ? 'HEIC' : 'DECODE');
  }
  return { img, url, W: img.naturalWidth, H: img.naturalHeight };
}

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

// High-quality downscale by successive halving.
export function resample(src, sw, sh, w, h, sx = 0, sy = 0, cw = sw, ch = sh) {
  let cur = src, cx = sx, cy = sy, curW = cw, curH = ch;
  while (curW / 2 >= w * 1.2 && curH / 2 >= h * 1.2) {
    const nw = Math.round(curW / 2), nh = Math.round(curH / 2);
    const c = canvas(nw, nh);
    const g = c.getContext('2d');
    g.imageSmoothingQuality = 'high';
    g.drawImage(cur, cx, cy, curW, curH, 0, 0, nw, nh);
    cur = c; cx = 0; cy = 0; curW = nw; curH = nh;
  }
  const out = canvas(w, h);
  const g = out.getContext('2d');
  g.imageSmoothingQuality = 'high';
  g.drawImage(cur, cx, cy, curW, curH, 0, 0, w, h);
  return out;
}

export function fitLong(src, W, H, maxLong) {
  const s = Math.min(1, maxLong / Math.max(W, H));
  return resample(src, W, H, Math.max(1, Math.round(W * s)), Math.max(1, Math.round(H * s)));
}

export function squareCrop(src, W, H, size) {
  const m = Math.min(W, H);
  return resample(src, W, H, size, size, (W - m) / 2, (H - m) / 2, m, m);
}
