export const TAU = Math.PI * 2;
export const clamp = (v, a=0, b=1) => Math.max(a, Math.min(b,v));
export const mix = (a,b,t) => a+(b-a)*t;
export const smooth = t => { t=clamp(t); return t*t*t*(t*(t*6-15)+10); };
export const span = (t,a,b) => smooth((t-a)/(b-a));
export const pulse = (t,a,b,c,d) => span(t,a,b)*(1-span(t,c,d));
export const easeOut = t => 1-Math.pow(1-clamp(t),3);
export function track(t, keys) {
  for(let i=1;i<keys.length;i++) if(t<=keys[i][0]) return mix(keys[i-1][1],keys[i][1],smooth((t-keys[i-1][0])/(keys[i][0]-keys[i-1][0])));
  return keys.at(-1)[1];
}
export function text(ctx,str,x,y,size,color='#171916',font='Manrope',weight=500,align='left') {
  ctx.fillStyle=color;ctx.font=`${weight} ${size}px "${font}"`;ctx.textAlign=align;ctx.textBaseline='alphabetic';ctx.fillText(str,x,y);
}
export function line(ctx,x1,y1,x2,y2,color,width=1) {ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();}
export function circle(ctx,x,y,r,color) {ctx.fillStyle=color;ctx.beginPath();ctx.arc(x,y,Math.max(.01,r),0,TAU);ctx.fill();}
export function rect(ctx,x,y,w,h,color) {ctx.fillStyle=color;ctx.fillRect(x,y,w,h);}
export function label(ctx,left,right,w,h,color) {
  text(ctx,left,40,40,11,color,'Manrope',650);text(ctx,right,w-40,40,11,color,'Manrope',650,'right');
  line(ctx,40,h-58,w-40,h-58,color,.65);
}
