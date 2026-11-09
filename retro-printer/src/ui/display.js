// 把全尺寸的成品畫到畫面上。
// 成品是 PW × PW，畫面上常常小很多（手機、一般解析度的螢幕）；直接交給瀏覽器縮小時，
// 手帕這類很細的織紋會互相干擾出格狀的疊紋。這裡先依實際顯示的像素數，
// 每次縮一半、平均著縮下去，再畫到看得到的畫布上。下載用的仍是全尺寸的那一張。
export function showCanvas(src, dst) {
  const r = dst.getBoundingClientRect();
  const want = Math.round(r.width * (window.devicePixelRatio || 1));
  // 顯示尺寸接近原尺寸（例如高解析度螢幕）時直接畫，不必縮
  const size = !want || want >= src.width * 0.9 ? src.width : want;
  if (dst.width !== size) { dst.width = size; dst.height = size; }
  let cur = src;
  while (cur.width / 2 >= size * 1.0001 && cur.width > 2) {
    const half = document.createElement('canvas');
    half.width = half.height = Math.ceil(cur.width / 2);
    const hx = half.getContext('2d');
    hx.imageSmoothingQuality = 'high';
    hx.drawImage(cur, 0, 0, half.width, half.height);
    cur = half;
  }
  const x = dst.getContext('2d');
  x.imageSmoothingQuality = 'high';
  x.clearRect(0, 0, size, size);
  x.drawImage(cur, 0, 0, size, size);
}
