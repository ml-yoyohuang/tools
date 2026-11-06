// 不碰畫面的小工具：圖片放進方形圖案區的裁切範圍、打亂順序。

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// 把 w × h 的圖放進 size × size 的方形。
//   mode 'contain'：完整放進，空白處留紙色
//   mode 'cover'  ：裁成方形填滿；pan 為 [-1, 1] 的偏移，決定保留哪一塊
// 回傳來源範圍 s* 與目的範圍 d*（drawImage 的參數）
export function fitRect(w, h, size, mode = 'contain', pan = [0, 0]) {
  if (mode === 'contain') {
    const k = Math.min(size / w, size / h), dw = w * k, dh = h * k;
    return { sx: 0, sy: 0, sw: w, sh: h, dx: (size - dw) / 2, dy: (size - dh) / 2, dw, dh };
  }
  const side = Math.min(w, h), mx = (w - side) / 2, my = (h - side) / 2;
  return {
    sx: mx + clamp(pan[0], -1, 1) * mx, sy: my + clamp(pan[1], -1, 1) * my, sw: side, sh: side,
    dx: 0, dy: 0, dw: size, dh: size
  };
}

// 拖動 (dx, dy) 個顯示像素後的新偏移；display 為圖案區在畫面上的寬度
export function panBy(pan, dx, dy, w, h, display) {
  const side = Math.min(w, h), mx = (w - side) / 2, my = (h - side) / 2, k = side / display;
  return [
    mx > 0 ? clamp(pan[0] - dx * k / mx, -1, 1) : 0,
    my > 0 ? clamp(pan[1] - dy * k / my, -1, 1) : 0
  ];
}

// Fisher–Yates，回傳新陣列
export function shuffle(list, rnd = Math.random) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
