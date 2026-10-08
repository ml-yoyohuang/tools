#!/usr/bin/env python3
"""
把去背的餅乾序列原圖整理成遊戲可用的 WebP 影格。

用法：
    python tools/prepare-cookie-frames.py <原圖資料夾> [輸出資料夾]

預設輸出到 assets/，檔名 cookie-01.webp ～ cookie-05.webp。

這個腳本只在「準備美術資源」時用，遊戲本身不需要它，
也不會成為執行時依賴。需要 Python 3 與 Pillow：

    pip install pillow

它做三件事：
 1. 透明區滲色修正：把透明與半透明像素的 RGB 填成鄰近的餅乾顏色。
    原圖的透明區殘留白色（247~253）或深色雜訊（42,24,27），
    縮圖取樣時會在邊緣滲出白邊或黑點。
 2. 統一對位：以「實心像素的重心」與「涵蓋 95% 質量的半徑」為基準，
    把每一張縮放平移到同一個正方畫布，播放序列時才不會跳動。
 3. 縮圖與壓縮：輸出 384×384 WebP，單張約 50KB（原圖每張 2.3MB）。
"""

import sys
import os
import glob

try:
    from PIL import Image
except ImportError:
    sys.exit('需要 Pillow：pip install pillow')

try:
    import numpy as np
except ImportError:
    sys.exit('需要 numpy：pip install numpy')

OUT_SIZE = 384          # 輸出邊長（遊戲顯示約 190 CSS px，2x 後 380）
TARGET_RADIUS = 168     # 餅乾在輸出畫布中的等效半徑，留約 12% 邊距給碎屑
BLEED_ITERATIONS = 14   # 透明區滲色的擴張次數
WEBP_QUALITY = 86


def bleed_rgb(rgba):
    """把 RGB 往透明區擴張，消除縮圖時的白邊與黑點。"""
    rgb = rgba[:, :, :3].astype(np.float32)
    alpha = rgba[:, :, 3]
    known = alpha > 200            # 只拿夠實心的顏色當來源

    for _ in range(BLEED_ITERATIONS):
        if known.all():
            break
        total = np.zeros_like(rgb)
        count = np.zeros(alpha.shape, np.float32)
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (1, -1), (-1, 1), (-1, -1)):
            shifted_rgb = np.roll(np.roll(rgb, dy, 0), dx, 1)
            shifted_known = np.roll(np.roll(known, dy, 0), dx, 1)
            total += shifted_rgb * shifted_known[:, :, None]
            count += shifted_known
        fill = (~known) & (count > 0)
        rgb[fill] = (total[fill] / count[fill][:, None])
        known = known | fill

    out = rgba.copy()
    out[:, :, :3] = np.clip(rgb, 0, 255).astype(np.uint8)
    return out


def measure(rgba):
    """回傳（重心 x, 重心 y, 涵蓋 95% 質量的半徑）。"""
    alpha = rgba[:, :, 3].astype(np.float32) / 255
    height, width = alpha.shape
    ys, xs = np.mgrid[0:height, 0:width]
    mass = alpha.sum()
    cx = float((xs * alpha).sum() / mass)
    cy = float((ys * alpha).sum() / mass)

    # 以重心為圓心，找涵蓋 95% 質量的半徑：碎屑不會把尺寸灌水
    dist = np.sqrt((xs - cx) ** 2 + (ys - cy) ** 2).ravel()
    weight = alpha.ravel()
    order = np.argsort(dist)
    cumulative = np.cumsum(weight[order])
    index = int(np.searchsorted(cumulative, cumulative[-1] * 0.95))
    radius = float(dist[order][min(index, len(order) - 1)])
    return cx, cy, radius


def process(path, out_path):
    image = Image.open(path).convert('RGBA')
    rgba = bleed_rgb(np.array(image))
    cx, cy, radius = measure(rgba)

    scale = TARGET_RADIUS / radius
    new_size = (max(1, round(image.width * scale)), max(1, round(image.height * scale)))
    scaled = Image.fromarray(rgba, 'RGBA').resize(new_size, Image.LANCZOS)

    canvas = Image.new('RGBA', (OUT_SIZE, OUT_SIZE), (0, 0, 0, 0))
    left = round(OUT_SIZE / 2 - cx * scale)
    top = round(OUT_SIZE / 2 - cy * scale)
    # 直接複製 RGBA，不要用遮罩貼上：
    # 用遮罩時 PIL 會拿畫布的黑色去合成，把半透明邊緣壓成深褐色。
    canvas.paste(scaled, (left, top))
    canvas.save(out_path, 'WEBP', quality=WEBP_QUALITY, method=6)
    return cx, cy, radius, os.path.getsize(out_path)


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    source = sys.argv[1]
    out_dir = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(__file__), '..', 'assets')
    os.makedirs(out_dir, exist_ok=True)

    # 忽略 __ 開頭的備份／重複檔
    files = [f for f in sorted(glob.glob(os.path.join(source, '*.png')))
             if not os.path.basename(f).startswith('__')]
    if not files:
        sys.exit(f'在 {source} 找不到 PNG')

    print(f'{"原圖":28} {"重心":>18} {"原半徑":>8}  {"輸出":>18} {"大小":>9}')
    print('-' * 90)
    for index, path in enumerate(files, start=1):
        name = f'cookie-{index:02d}.webp'
        out_path = os.path.join(out_dir, name)
        cx, cy, radius, size = process(path, out_path)
        print(f'{os.path.basename(path):28} {f"({cx:.1f}, {cy:.1f})":>18} {radius:8.1f}  '
              f'{name:>18} {size / 1024:8.1f} KB')

    print(f'\n完成：{len(files)} 張影格輸出到 {os.path.abspath(out_dir)}')
    print(f'每張 {OUT_SIZE}×{OUT_SIZE}，餅乾等效半徑統一為 {TARGET_RADIUS}px。')


if __name__ == '__main__':
    main()
