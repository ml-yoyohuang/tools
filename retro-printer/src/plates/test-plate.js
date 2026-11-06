import { plateFromDraw } from './registration.js';

// 測試用的兩色版：第 1 層圓、第 2 層星。之後由製版站產出的版取代。
// 墨色由選墨水站決定（預設見 src/inks.js）。

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
