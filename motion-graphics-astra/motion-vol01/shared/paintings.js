import {TAU,clamp,mix,span,pulse,track,text,line,circle,rect,label} from './math.js';

export function interval(c,w,h,t) {
  const ink='#21221b',paper='#f4e9d4',red='#e45136',tall=h>w;
  rect(c,0,0,w,h,red);label(c,'01 / STUDIES IN NEGATIVE SPACE','INTERVAL — 16 SECONDS',w,h,ink);
  const b=pulse(t,4.2,6.2,7.5,9.5),d=pulse(t,8,10.8,13,15.9);
  const rows=tall?[.32,.57,.82]:[.36,.61,.86];
  const words=['IN','TER','VAL'];
  // A threshold expands, becomes a cutting plane, then contracts to a margin.
  const gate=mix(mix(w*.56,w*.46,b),w*.28,d);
  rect(c,gate,75,w*.035+(w*.26)*(1-b)*(1-d),h-155,paper);
  c.save();c.translate(w-45,h*.61);c.rotate(-Math.PI/2);text(c,'THE SPACE BETWEEN IS ALSO A FORM',0,0,12,ink,'Manrope',650);c.restore();
  words.forEach((word,i)=>{
    const delay=i*.22;
    const entrance=span(t,1.8+delay,3.5+delay)*(1-span(t,14.4,16));
    const collision=pulse(t,4.2+delay,6.1+delay,7.3+delay,9.4+delay);
    const reform=pulse(t,8+delay,10.6+delay,12.7,15.9);
    const x=mix(mix(52+(i===1?12:0),[42,300,600][i],collision),[75,360,650][i],reform);
    const y=mix(mix(h*rows[i],[.37,.59,.82][i]*h,collision),[h*.80,h*.40,h*.74][i],reform);
    const size=mix(Math.min(h*(tall?.255:.28),310),Math.min(h*(tall?.27:.30),310),collision)*(1-reform*.22);
    c.save();c.translate(x+(i-1)*entrance*18,y);c.rotate(reform*[0,Math.PI/2,0][i]);
    c.scale(mix(1,tall?.76:.84,collision)*(1-reform*.15),1);
    c.font=`400 ${size}px Anton`;
    c.beginPath();c.rect(-4,-size*1.05,Math.max(500,c.measureText(word).width+10),size*1.07);c.clip();
    let advance=0;
    [...word].forEach((letter,j)=>{
      const reveal=i===0?1:span(t,1.8+i*.30+j*.13,3.1+i*.30+j*.13)*(1-span(t,14.4+j*.1,16));
      text(c,letter,advance,(1-reveal)*size*1.12,size,ink,'Anton',400);
      advance+=c.measureText(letter).width;
    });c.restore();
  });
  // Moving cream counterforms divide the letters without dissolving their weight.
  c.save();c.globalAlpha=b;rect(c,40,h*.43,w-80,h*.024,paper);rect(c,w*.48,h*.21,w*.018,h*.62,paper);c.restore();
  c.save();c.translate(gate+18,h*.78);c.rotate(-Math.PI/2);text(c,'空 間 / TIME AS ARCHITECTURE',0,0,11,ink,'Manrope',650);c.restore();
  text(c,'LETTERS OPEN. SPACE REMAINS.',40,h-31,11,ink,'Manrope',650);
  text(c,'I — V',w-40,h-31,11,ink,'Manrope',650,'right');
}

function half(c,x,y,r,rotation,color){c.save();c.translate(x,y);c.rotate(rotation);c.beginPath();c.arc(0,0,r,0,Math.PI);c.closePath();c.fillStyle=color;c.fill();c.restore();}
export function ballet(c,w,h,t) {
  const bg='#b6c4a7',ink='#173f32',cream='#f3e7ba',orange='#b45c3d';
  rect(c,0,0,w,h,bg);label(c,'02 / GEOMETRIC BALLET','A STUDY OF TRANSFER',w,h,ink);
  const tall=h>w,baseY=h*.53,R=Math.min(w*.235,h*.225),cx=w*.63;
  const cut=pulse(t,3.6,5.5,8,10),stack=pulse(t,7.4,9.5,10.6,13.8);
  const pass=pulse(t,1.8,3.5,10.6,13.8);
  text(c,'The weight',44,h*.16,tall?80:67,ink,'Bodoni',500);
  text(c,'of a pause.',44,h*.16+(tall?78:65),tall?80:67,ink,'Bodoni',500);
  const y1=baseY-cut*R*.40-stack*R*.30,y2=baseY+cut*R*.25+stack*R*.30;
  half(c,cx-cut*R*.25-stack*R*.37,y1,R,mix(Math.PI,Math.PI*1.5,stack),ink);
  half(c,cx+cut*R*.25+stack*R*.37,y2,R,mix(0,Math.PI*.5,stack),ink);
  // The circle becomes two scoops, then an hourglass with a shared negative space.
  circle(c,cx,baseY,R*.44*(1-stack),bg);
  const beamY=baseY+R*.05+stack*R*.66;
  line(c,70,beamY,w-60,beamY,ink,2.2);
  const hop=Math.sin(Math.PI*clamp((t-2.1)/1.8));
  const bx=mix(120,cx-R*.45,pass),by=beamY-R*.28-hop*R*.28;
  circle(c,bx,by,R*.28,cream);
  const impact=pulse(t,2.8,3.6,4.7,5.5);
  c.save();c.translate(cx+R+26,beamY);c.rotate(-impact*.18+stack*Math.PI/2);rect(c,-15,-85,30,85,orange);c.restore();
  // A travelling cut carries the first dancer's impulse across the page.
  const sweep=track(t,[[0,0],[3,0],[5,1],[8,1],[10,0],[14,0]]);
  line(c,70+(w-130)*sweep,beamY-18,70+(w-130)*sweep,beamY+18,cream,3);
  text(c,'A circle lends its weight.',44,h-112,14,ink,'Manrope',500);
  text(c,'A line remembers the gesture.',44,h-90,14,ink,'Manrope',500);
  text(c,'POISE / TRANSFER / CUT / COUNTERWEIGHT',40,h-31,10,ink,'Manrope',650);
  text(c,'14″',w-40,h-31,12,ink,'Manrope',650,'right');
}

function interference(c,type,x,y,r,angle,spacing) {
  c.save();c.beginPath();c.arc(x,y,r,0,TAU);c.clip();c.translate(x,y);c.rotate(angle);
  c.beginPath();
  if(type===0){for(let a=-r*1.5;a<r*1.5;a+=spacing){c.moveTo(a,-r*1.5);c.lineTo(a,r*1.5);}}
  if(type===1){for(let a=spacing;a<r*2.5;a+=spacing){c.moveTo(a,0);c.arc(0,0,a,0,TAU);}}
  if(type===2){const count=Math.min(144,Math.floor(TAU*r/spacing));for(let a=0;a<count;a++){const angle=a/count*TAU;c.moveTo(0,0);c.lineTo(Math.cos(angle)*r*2,Math.sin(angle)*r*2);}}
  c.stroke();c.restore();
}
export function moire(c,w,h,t,metrics={cssWidth:1000}) {
  const bg='#d4da6a',ink='#283327';rect(c,0,0,w,h,bg);
  label(c,'04 / OPTICAL FIELD NOTES','ALMOST, ALIGNED',w,h,ink);
  const R=Math.min(w*.37,h*.345),x=w*.52,y=h*.51;
  const second=pulse(t,5.2,6.8,10.9,12.5),third=pulse(t,11,12.8,17.2,19.7);
  const weights=[(1-second)*(1-third),second*(1-third),third];
  const motion=Math.sin(TAU*t/20),sub=Math.cos(TAU*t/20);
  const spacing=Math.max(7,3.2*w/metrics.cssWidth);
  c.strokeStyle=ink;c.lineWidth=Math.max(1.5,spacing*.21);
  for(let mode=0;mode<3;mode++){
    if(weights[mode]<.001) continue;
    c.save();c.globalAlpha=weights[mode]*.85;
    interference(c,mode,x,y,R,mode===0?-.16:0,spacing);
    // Clip both geometries to the same instrument aperture.
    c.beginPath();c.arc(x,y,R,0,TAU);c.clip();
    interference(c,mode,x+(mode===1?34+motion*22:mode===2?30+motion*12:0),y+(mode===1?sub*14:0),R*1.15,mode===0?-.06+motion*.10:mode===2?.018+motion*.025:0,spacing*(mode===1?1.015:1));
    c.restore();
  }
  // A quiet aperture stops the radial singularity from becoming a flickering hotspot.
  circle(c,x,y,14+third*12,bg);circle(c,x,y,2,ink);
  text(c,'ALMOST,',42,h*.18,h>w?92:73,ink,'Anton',400);
  text(c,'A L I G N E D .',45,h*.18+34,17,ink,'Manrope',650);
  line(c,x-R-22,y,x-R-7,y,ink);line(c,x+R+7,y,x+R+22,y,ink);
  text(c,'TWO ORDERS. A THIRD IMAGE.',40,h-31,11,ink,'Manrope',650);
  text(c,['01 / LINEAR','02 / CONCENTRIC','03 / RADIAL'][weights.indexOf(Math.max(...weights))],w-40,h-31,11,ink,'Manrope',650,'right');
}

export function chaos(c,w,h,t) {
  const bg='#262f40',salmon='#e7a794',muted='#9caab3';rect(c,0,0,w,h,bg);
  label(c,'05 / A DETERMINISTIC SYSTEM','A TENDER DISORDER',w,h,salmon);
  const cols=39,rows=h>w?43:26,dx=(w-145)/(cols-1),dy=(h-275)/(rows-1);
  const current=pulse(t,1.5,7,10,15.8),curl=pulse(t,5,8.2,10.8,14.5);
  const phase=TAU*t/16;
  c.save();c.beginPath();c.rect(42,144,w-84,h-263);c.clip();
  c.lineCap='round';c.lineWidth=Math.max(2.4,dx*.13);
  for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
    const u=(col/(cols-1)-.5)*2,v=(row/(rows-1)-.5)*2;
    const distance=Math.hypot(u+.55,v*.8);
    const front=span(t,1.6+distance*1.8,4+distance*1.8)*(1-span(t,12,16));
    const wave=Math.sin(u*3.8+v*2.3-phase)*current;
    const theta=Math.atan2(v,u),r=Math.hypot(u,v);
    const orbit=Math.sin(r*5.3-phase+theta)*curl;
    const edge=Math.pow(Math.max(0,Math.sin(col/(cols-1)*Math.PI)*Math.sin(row/(rows-1)*Math.PI)),.6);
    const x=72+col*dx+front*edge*(wave*41+orbit*26);
    const y=155+row*dy+front*edge*(Math.cos(u*4-v*2+phase)*30+Math.sin(theta+phase+r*2)*curl*48);
    const angle=wave*.9+orbit*1.25;
    const length=mix(6,15,(Math.sin(theta+r*4-phase)+1)*.5*curl);
    c.strokeStyle=(col+row)%9===0?muted:salmon;
    c.globalAlpha=.60+.40*(1-r/2);
    c.beginPath();c.moveTo(x-Math.sin(angle)*length/2,y-Math.cos(angle)*length/2);c.lineTo(x+Math.sin(angle)*length/2,y+Math.cos(angle)*length/2);c.stroke();
  }
  c.restore();c.globalAlpha=1;
  text(c,'A TENDER',45,112,52,salmon,'Manrope',300);
  text(c,'DISORDER.',w-45,h-87,48,salmon,'Manrope',750,'right');
  text(c,'EVERY DEVIATION BELONGS.',40,h-31,11,salmon,'Manrope',650);
  text(c,`${cols} × ${rows} / FIELD 005`,w-40,h-31,11,salmon,'Manrope',650,'right');
}
