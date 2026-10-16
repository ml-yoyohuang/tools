import {TAU,mix,span,pulse,text,rect,line,circle,polygon,caption,clamp} from '../common/math.js';

export function analog(){
 const source=document.createElement('canvas'),s=source.getContext('2d'),echo=document.createElement('canvas'),ec=echo.getContext('2d'),word=document.createElement('canvas'),wc=word.getContext('2d');let oldH=0;
 function plate(h){source.width=word.width=1000;source.height=word.height=Math.ceil(h);const size=Math.min(h*.29,210);text(s,'STAY',55,h*.35,size,'#292e27','Anton',400);text(wc,'WITH',55,h*.64,size,'#292e27','Anton',400);text(s,'ME',675,h*.83,size,'#292e27','Anton',400);echo.width=source.width;echo.height=source.height;ec.drawImage(source,0,0);ec.drawImage(word,0,0);ec.globalCompositeOperation='source-in';ec.fillStyle='#a58e49';ec.fillRect(0,0,echo.width,echo.height);ec.globalCompositeOperation='source-over';oldH=h;}
 return {render(c,w,h,t){
  if(h!==oldH)plate(h);rect(c,0,0,w,h,'#ddd9c9');
  const drift=pulse(t,2,5,9,13),ghost=pulse(t,4.5,7,10,14),collapse=pulse(t,7,9,10.4,14),size=Math.min(h*.29,210),middle=h*.64-size*.45;
  if(ghost){c.globalAlpha=ghost*.17;c.drawImage(echo,24*ghost,6*ghost);c.globalAlpha=1;}
  for(let y=0;y<h;y+=2){const band=Math.exp(-Math.pow((y/h-.35-.12*Math.sin(t*.5))/.065,2));const dx=drift*(Math.sin(y*.018+t*.7)*11+band*66);c.drawImage(source,0,y,1000,2,dx,y,1000,2.4);if(y>h*.64-size&&y<h*.64+5){const dy=mix(y,middle+(y-middle)*.16,collapse);c.drawImage(word,0,y,1000,2,dx+collapse*90,dy,1000,mix(2.4,.48,collapse));}}
  // A low-contrast scan structure follows the printed signal, never flashes.
  c.globalAlpha=.045*drift;for(let y=80;y<h-65;y+=7)line(c,45,y,955,y,'#292e27',.8);c.globalAlpha=1;
  if(ghost){rect(c,43,h*.67,4,38*ghost,'#a58e49');}
  caption(c,'13 / PLEASE REMAIN IN THE PICTURE','A TRANSMISSION WITH A MEMORY.',w,h,'#292e27');text(c,'Do not adjust',49,h-113,29,'#292e27','Bodoni',500);text(c,'your tenderness.',49,h-76,29,'#292e27','Bodoni',500);
 }};
}

export function halftone(){return {render(c,w,h,t){
 const paper='#f0dfcc';rect(c,0,0,w,h,paper);const lines=pulse(t,4,7,9,12),diamonds=pulse(t,10,12.5,14.5,18),dots=(1-lines)*(1-diamonds),weights=[dots,lines*(1-diamonds),diamonds];
 const shift=pulse(t,2,5,11,18),overprint=pulse(t,7,10,13,17),R=Math.min(290,h*.32),cy=h*.44;
 const screens=[{x:485-90*shift,y:cy-30*shift,r:R,ink:'#ad4e60',a:-.12*shift},{x:650-110*overprint,y:cy+75*shift,r:R*.83,ink:'#315a75',a:.27+.10*shift}];
 c.save();c.beginPath();c.rect(70,90,860,h-205);c.clip();c.globalCompositeOperation='multiply';
 for(const [plate,p] of screens.entries()){
  c.save();c.translate(p.x,p.y);c.rotate(p.a);const pitch=14;
  for(let mode=0;mode<3;mode++){const alpha=weights[mode];if(alpha<.001)continue;c.globalAlpha=alpha;c.fillStyle=p.ink;c.strokeStyle=p.ink;
   if(mode===1){for(let y=-p.r;y<=p.r;y+=pitch){const edge=Math.sqrt(Math.max(0,p.r*p.r-y*y));c.lineWidth=3+4*Math.sqrt(Math.max(0,1-y*y/(p.r*p.r)));c.beginPath();c.moveTo(-edge,y);c.bezierCurveTo(-edge*.3,y-10*shift,edge*.3,y+10*shift,edge,y);c.stroke();}}
   else for(let y=-p.r-7;y<p.r+7;y+=pitch)for(let x=-p.r-7;x<p.r+7;x+=pitch){const r=Math.hypot(x,y),density=clamp((p.r-r)/35)*(.55+.45*(x/p.r+1)/2),radius=(mode===0?6.5:8)*density;if(radius<.08)continue;
    if(mode===0)circle(c,x+(plate?2:0),y,radius,p.ink);else{const r=pitch*.71;c.lineWidth=3.5*density;c.beginPath();c.moveTo(x,y-r);c.lineTo(x+r,y);c.lineTo(x,y+r);c.lineTo(x-r,y);c.closePath();c.stroke();}
   }
  }c.restore();
 }c.restore();
 caption(c,'15 / TWO INKS, A THIRD VOICE','THE IMAGE BELONGS TO NEITHER PLATE.',w,h,'#463b3a');text(c,'An imperfect',45,h-126,50,'#463b3a','Bodoni',500);text(c,'agreement.',45,h-72,50,'#463b3a','Bodoni',500);
 }};}

export function chromatic(){return {render(c,w,h,t){
 const bone='#ece0c7',russet='#a44832',straw='#d4b969',mineral='#303e39',peach='#d99b74';rect(c,0,0,w,h,bone);
 const area=pulse(t,2,5.5,8,14),arch=pulse(t,8,10.5,12.3,16),join=pulse(t,5.5,8,10,14),x=45,y=86,W=910,H=h-179;
 rect(c,x,y,W,H,straw);const border=mix(540,265,area),archTop=y+H*.20,archBase=y+H*.92;
 c.save();c.beginPath();c.rect(x,y,W,H);c.clip();
 // The two complementary masses share a curved boundary. The straw arch is their gap.
 const centre=mix(border,550,arch),left=mix(border,390,arch),right=mix(955,710,arch),roof=archTop+H*.18;
 c.fillStyle=russet;c.beginPath();c.moveTo(x,y);c.lineTo(centre,y);c.lineTo(centre,archTop);c.bezierCurveTo(left,archTop,left,roof,left,roof+H*.1);c.lineTo(left,y+H);c.lineTo(x,y+H);c.closePath();c.fill();
 c.fillStyle=mineral;c.beginPath();c.moveTo(955,y);c.lineTo(mix(955,550,arch),y);c.lineTo(mix(955,550,arch),archTop);c.bezierCurveTo(right,archTop,right,roof,right,roof+H*.1);c.lineTo(right,y+H);c.lineTo(955,y+H);c.closePath();c.fill();
 const a=mix(235,430,join),b=mix(715,560,join),side=130,sy=y+H*.47;
 rect(c,a-side/2,sy-side/2,side,side,peach);rect(c,b-side/2,sy-side/2,side,side,peach);
 c.restore();
 caption(c,'17 / THE COLOUR BETWEEN US','ONE COLOUR. TWO DIFFERENT LIVES.',w,h,mineral);
 text(c,'What changes is the neighbour.',45,h-57,18,mineral,'Bodoni',500);
 }};}
