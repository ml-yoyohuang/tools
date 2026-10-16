import {mix,pulse,span,text,rect,line,circle,polygon,caption} from '../common/math.js';

const bg='#c9d3ce',ink='#324d47',face='#faf0d8';
function beam(c,a,b,width=52){
 const dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy),nx=-dy/len*width/2,ny=dx/len*width/2;
 const quad=[[a[0]+nx,a[1]+ny],[b[0]+nx,b[1]+ny],[b[0]-nx,b[1]-ny],[a[0]-nx,a[1]-ny]];
 polygon(c,quad.map(([x,y])=>[x+12,y+18]),ink);polygon(c,quad,face);line(c,a[0]-nx,a[1]-ny,b[0]-nx,b[1]-ny,'#63786c',1);
}
function room(c,t){
 const p=[[-185,-105],[75,-105],[75,155],[-185,155]],q=p.map(([x,y])=>[x+105,y-100]),flip=pulse(t,1.4,3,4.2,5);
 const all=[...p,...q];for(const [a,b] of [[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]])beam(c,all[a],all[b],21);
 c.save();c.beginPath();c.rect(-95,-130,210,230);c.clip();
 if(flip>.5){beam(c,q[3],q[2],21);beam(c,q[3],q[0],21);}else{beam(c,p[1],p[2],21);beam(c,p[0],p[1],21);}c.restore();
 // An interior plane moves through the ambiguous front/back reading.
 c.globalAlpha=.35*flip;polygon(c,[q[3],q[2],p[2],p[3]],'#63786c');c.globalAlpha=1;
}
function triangle(c,t){
 const v=[[0,-210],[220,170],[-220,170]],edges=v.map((a,i)=>[a,v[(i+1)%3]]),stretch=.09*Math.sin(t*.7);
 const extended=edges.map(([a,b])=>{const dx=b[0]-a[0],dy=b[1]-a[1];return [[a[0]-dx*.09,a[1]-dy*.09],[b[0]+dx*.09,b[1]+dy*.09]];});
 extended.forEach(([a,b])=>beam(c,a,b,62));
 // Local patches impose a directed depth cycle. No global 3D ordering can satisfy it.
 // The base painter order already makes B>A and C>B. Only the A>C join
 // needs a local face override. Omitting artificial end caps preserves continuity.
 const a0=extended[0][0],d0=[v[1][0]-v[0][0],v[1][1]-v[0][1]],length=Math.hypot(...d0),b0=[v[0][0]+d0[0]/length*110,v[0][1]+d0[1]/length*110],nx=-d0[1]/length*31,ny=d0[0]/length*31;
 polygon(c,[[a0[0]+nx,a0[1]+ny],[b0[0]+nx,b0[1]+ny],[b0[0]-nx,b0[1]-ny],[a0[0]-nx,a0[1]-ny]],face);
 line(c,-95,205,100+stretch*30,205,ink,1);
}
function fork(c){
 // Three round-front prongs merge into only two square-backed supports.
 const ys=[-105,0,105],left=-220,right=190;
 for(const y of ys){c.fillStyle=face;c.beginPath();c.moveTo(left,y-24);c.lineTo(right,y-24);c.lineTo(right,y+24);c.lineTo(left,y+24);c.ellipse(left,y,15,24,0,Math.PI/2,Math.PI*1.5);c.fill();c.strokeStyle=ink;c.lineWidth=1.4;c.stroke();}
 polygon(c,[[70,-129],[225,-205],[225,-150],[70,-24]],face);
 polygon(c,[[70,81],[225,5],[225,60],[70,129]],face);
 polygon(c,[[225,-205],[255,-190],[255,75],[225,60],[225,5],[70,81],[70,24],[225,-52]],ink);
 // The central edge becomes a gap boundary as it meets the upper block.
 polygon(c,[[70,-24],[225,-150],[225,-52],[70,24]],bg);
 line(c,left,-24,70,-24,ink,1.4);line(c,left,24,70,24,ink,1.4);
 for(const y of ys){c.beginPath();c.ellipse(left,y,15,24,0,0,Math.PI*2);c.fillStyle='#9eafa5';c.fill();c.strokeStyle=ink;c.stroke();}
}
export function impossible(){return {render(c,w,h,t){
 rect(c,0,0,w,h,bg);caption(c,'14 / AN ADDRESS THAT CANNOT EXIST','A PLACE BUILT BY THE EYE.',w,h,ink);
 const a=span(t,4.4,5.5)*(1-span(t,13.4,16)),b=span(t,8.8,10)*(1-span(t,13.4,16));
 const cx=570,cy=h*.46,scale=Math.min(.98,(h-230)/520);
 const draw=(fn)=>{c.save();c.translate(cx,cy);c.scale(scale,scale);fn(c,t);c.restore();};
 draw(room);
 // A moving architectural curtain carries the replacement rather than a cross-fade.
 for(const [amount,fn] of [[a,triangle],[b,fork]])if(amount>0){c.save();c.beginPath();c.rect(cx-310*scale,cy-280*scale,620*scale*amount,560*scale);c.clip();rect(c,cx-310*scale,cy-280*scale,620*scale,560*scale,bg);draw(fn);c.restore();}
 text(c,'Elsewhere',45,h-112,61,ink,'Bodoni',500);text(c,'is a direction, not a place.',49,h-75,20,ink,'Bodoni',500);
 }};}

export function negative(){return {render(c,w,h,t){
 const paper='#ebe5d6',black='#282d28',appear=pulse(t,1.4,4.6,10.8,14),reverse=pulse(t,6,8.5,11.6,14),door=pulse(t,9.3,10.8,11.8,14),top=94,H=h-230;
 // A vase contour is simultaneously the inward contour of two profile-like solids.
 const profile=[[0,130],[.10,100],[.19,64],[.25,82],[.32,72],[.43,106],[.58,48],[.79,43],[.88,112],[1,125]];
 function scene(ground,solid){
  rect(c,0,0,w,h,ground);
  for(const side of [-1,1]){c.beginPath();c.moveTo(side<0?130:870,top);const pts=profile.map(([y,width])=>[500+side*mix(34,mix(width,92,door),appear),top+y*H]);c.lineTo(...pts[0]);
   for(let i=1;i<pts.length;i++){const p=pts[i-1],q=pts[i],mid=(p[1]+q[1])/2;c.bezierCurveTo(p[0],mid,q[0],mid,q[0],q[1]);}
   c.lineTo(side<0?130:870,top+H);c.closePath();c.fillStyle=solid;c.fill();
  }
  if(door>0){rect(c,130,top,740,H*.20*door,solid);}
  caption(c,'18 / THE GUEST IS THE GAP','WHAT IS ABSENT TAKES A BOW.',w,h,solid);text(c,'A place for',45,h-87,34,solid,'Bodoni',500);text(c,'no one.',45,h-49,34,solid,'Bodoni',500);
 }
 scene(paper,black);
 if(reverse>0){c.save();c.beginPath();c.rect(0,0,w*reverse,h);c.clip();scene(black,paper);c.restore();}
 }};}
