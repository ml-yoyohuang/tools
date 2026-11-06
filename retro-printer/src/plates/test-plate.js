import { plateFromDraw } from './registration.js';

// 測試用的兩色版：粉紅圓、藍色星。之後由製版站產出的版取代。
export const TEST_INKS = [
  { name: '粉紅', rgb: [255, 72, 176] },
  { name: '藍', rgb: [50, 85, 164] }
];

export function testPlates() {
  const circle = plateFromDraw(ctx => {
    ctx.beginPath();
    ctx.arc(265, 275, 135, 0, Math.PI * 2);
    ctx.fill();
  });
  const star = plateFromDraw(ctx => {
    const cx = 335, cy = 330, R = 150, r = 64;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r : R;
      ctx[i ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fill();
  });
  return [circle, star];
}
