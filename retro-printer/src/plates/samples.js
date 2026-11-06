import { S } from '../engine/geometry.js';
import { DESIGN_PX } from './registration.js';

// 範例圖：用程式畫的原創圖，在「提供圖片」站做好之前暫代圖片來源。
// 座標為 0..360（圖案區的紙張座標）。
export const SAMPLES = [
  { id: 'flower', name: '花', colors: 3, draw: drawFlower },
  { id: 'hills', name: '山', colors: 4, draw: drawHills },
  { id: 'shapes', name: '幾何', colors: 4, draw: drawShapes }
];

const cache = new Map();
export function sampleImage(id) {
  if (cache.has(id)) return cache.get(id);
  const s = SAMPLES.find(x => x.id === id) || SAMPLES[0];
  const c = document.createElement('canvas');
  c.width = c.height = DESIGN_PX;
  const x = c.getContext('2d');
  x.setTransform(S, 0, 0, S, 0, 0);
  x.fillStyle = '#F6F2E9';
  x.fillRect(0, 0, 360, 360);
  s.draw(x);
  const image = { canvas: c, data: x.getImageData(0, 0, DESIGN_PX, DESIGN_PX).data, w: DESIGN_PX, h: DESIGN_PX };
  cache.set(s.id, image);
  return image;
}

function drawFlower(x) {
  // 莖與葉
  x.strokeStyle = '#3E8E5A'; x.lineWidth = 7; x.lineCap = 'round';
  x.beginPath(); x.moveTo(180, 205); x.quadraticCurveTo(170, 280, 186, 340); x.stroke();
  x.fillStyle = '#3E8E5A';
  for (const [cx, cy, rot] of [[142, 280, -0.6], [214, 300, 0.7]]) {
    x.save(); x.translate(cx, cy); x.rotate(rot);
    x.beginPath(); x.ellipse(0, 0, 42, 15, 0, 0, Math.PI * 2); x.fill();
    x.restore();
  }
  // 花瓣
  x.fillStyle = '#F07C6A';
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI / 3 - Math.PI / 2;
    x.save(); x.translate(180 + Math.cos(a) * 52, 150 + Math.sin(a) * 52); x.rotate(a);
    x.beginPath(); x.ellipse(0, 0, 50, 30, 0, 0, Math.PI * 2); x.fill();
    x.restore();
  }
  // 花心
  x.fillStyle = '#F2B632';
  x.beginPath(); x.arc(180, 150, 34, 0, Math.PI * 2); x.fill();
}

function drawHills(x) {
  // 漸層天空：越往下越接近紙色，門檻決定天空印到哪裡
  const g = x.createLinearGradient(0, 0, 0, 230);
  g.addColorStop(0, '#7FC2DC');
  g.addColorStop(1, '#EEF4F2');
  x.fillStyle = g;
  x.fillRect(0, 0, 360, 230);
  x.fillStyle = '#EE7F3A';
  x.beginPath(); x.arc(250, 120, 42, 0, Math.PI * 2); x.fill();
  x.fillStyle = '#5A8FA6';
  x.beginPath(); x.moveTo(0, 230); x.lineTo(90, 130); x.lineTo(170, 215); x.lineTo(250, 150); x.lineTo(360, 240); x.lineTo(360, 360); x.lineTo(0, 360); x.fill();
  x.fillStyle = '#2C3D62';
  x.beginPath(); x.moveTo(0, 300); x.quadraticCurveTo(120, 220, 210, 285); x.quadraticCurveTo(290, 330, 360, 270); x.lineTo(360, 360); x.lineTo(0, 360); x.fill();
}

function drawShapes(x) {
  x.fillStyle = '#E8B23A';
  x.beginPath(); x.arc(130, 140, 88, 0, Math.PI * 2); x.fill();
  x.fillStyle = '#2A8C8C';
  x.fillRect(170, 150, 150, 170);
  x.fillStyle = '#D9483B';
  x.beginPath(); x.moveTo(40, 330); x.lineTo(140, 190); x.lineTo(240, 330); x.fill();
  // 細線與小點：看細節會不會被分丟
  x.strokeStyle = '#222'; x.lineWidth = 1.5;
  for (let i = 0; i < 6; i++) { x.beginPath(); x.moveTo(30, 40 + i * 9); x.lineTo(330, 40 + i * 9); x.stroke(); }
  x.fillStyle = '#222';
  for (let i = 0; i < 7; i++) for (let j = 0; j < 4; j++) { x.beginPath(); x.arc(200 + i * 18, 190 + j * 18, 2.6, 0, Math.PI * 2); x.fill(); }
}
