export * from '../motion-vol01/shared/math.js';
export function polygon(c,points,color){c.beginPath();points.forEach((p,i)=>i?c.lineTo(...p):c.moveTo(...p));c.closePath();c.fillStyle=color;c.fill();}
export function caption(c,title,subtitle,w,h,ink){c.fillStyle=ink;c.font='600 11px Manrope';c.textAlign='left';c.fillText(title,42,40);c.textAlign='right';c.fillText(subtitle,w-42,h-32);c.textAlign='left';}
