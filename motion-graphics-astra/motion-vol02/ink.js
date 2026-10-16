import {TAU,mix,pulse,span,clamp,text,rect,line,circle,caption} from '../common/math.js';
import {gpu,fullscreenVertex} from '../common/gl.js';

export function liquid({stage}){
 const shader=gpu(stage,fullscreenVertex,`precision highp float;varying vec2 vUV;uniform sampler2D uTexture;uniform vec2 uPixel;uniform float uBlur;void main(){float a=0.;float total=0.;for(int x=-1;x<=1;x++){for(int y=-1;y<=1;y++){float wt=exp(-.5*float(x*x+y*y));a+=texture2D(uTexture,vUV+vec2(float(x),float(y))*uPixel*uBlur).a*wt;total+=wt;}}float ink=smoothstep(.35,.43,a/total);gl_FragColor=vec4(mix(vec3(.929,.902,.839),vec3(.251,.216,.169),ink),1.);}`);
 const mask=document.createElement('canvas'),m=mask.getContext('2d');
 const glyphs=[...'MELT'].map(letter=>{const g=document.createElement('canvas');g.width=280;g.height=430;const q=g.getContext('2d');q.fillStyle='#000';q.font='370px Anton';q.textAlign='center';q.fillText(letter,140,370);return g;});
 return {kind:'webgl',resize(w,h,pw,ph){const budget=Math.min(1,800/pw,800/ph);shader.resize(pw*budget,ph*budget);mask.width=1000;mask.height=Math.round(h);},render(c,w,h,t){
  const melt=pulse(t,2,6.5,8,12),layout=pulse(t,8.4,11.3,13.3,16),join=pulse(t,4.2,6.2,7.7,9);
  m.setTransform(1,0,0,1,0,0);m.clearRect(0,0,w,h);
  const gh=Math.min(h*.49,430),baseY=h*.22;
  glyphs.forEach((glyph,i)=>{
   const x=mix(50+i*225,[170,480,270,580][i],layout),y=mix(baseY,i<2?h*.12:h*.47,layout),height=mix(gh,Math.min(h*.36,400),layout);
   for(let sy=0;sy<430;sy+=1){const v=sy/430,weight=Math.pow(v,3),dx=melt*weight*Math.sin(v*7+i*1.3)*27,dy=melt*weight*(25+32*Math.sin(i*1.7+v*3));m.drawImage(glyph,0,sy,280,1,x+dx,y+v*height+dy,230,height/430+1.1);}
  });
  if(join>.001){m.strokeStyle='#000';m.lineCap='round';m.lineWidth=42*join;[[200,340],[425,585],[690,845]].forEach(([a,b],i)=>{const y=baseY+gh*(.76-i*.035);m.beginPath();m.moveTo(a,y);m.bezierCurveTo(a+35,y+65,b-35,y+65,b,y-12);m.stroke();});}
  shader.texture(mask);shader.uniform('uPixel',1/mask.width,1/mask.height);shader.uniform('uBlur',melt*7);shader.draw();
  caption(c,'07 / THE DISSOLUTION OF LANGUAGE','NOTHING KEEPS ITS EDGES.',w,h,'#40372b');
  text(c,'A word is only',45,h-121,34,'#40372b','Bodoni',500);text(c,'a temporary boundary.',45,h-82,34,'#40372b','Bodoni',500);
 },dispose:()=>shader.dispose()};
}

const paths=[[['M',0,1],['L',0,0],['L',.48,0],['C',1,0,1,.48,.48,.48],['L',0,.48]],[['M',0,0],['L',0,.66],['C',0,1.1,.83,1.1,.83,.66],['L',.83,0]],[['M',0,0],['L',0,1],['L',.84,1]],[['M',0,0],['L',0,1],['L',.84,1]]];
export function elastic(){return {render(c,w,h,t){
 const bg='#dfc4cc',ink='#542c42';rect(c,0,0,w,h,bg);caption(c,'08 / TYPOGRAPHY UNDER TENSION','FORCE → MEMORY → REST',w,h,ink);
 text(c,'Held,',45,h*.19,76,ink,'Bodoni',500);text(c,'then released.',w-45,h-85,58,ink,'Bodoni',500,'right');
 const top=h*.37,H=Math.min(280,h*.35),width=172,step=218,start=90;
 function deformation(x,y,i){const local=t-2-i*.36-y*.25;if(local<0)return [x,y];const attack=span(local,0,.65),recovery=1-span(t,10,14);const force=attack*Math.exp(-local*.36)*recovery;const wave=Math.sin(local*(3.4+i*.31)-y*2.1);return [x+force*(.34*Math.sin(y*Math.PI)*wave+.10*Math.sin(local*4)),y+force*.26*Math.sin(local*4.5-x*1.8)];}
 for(let echo=3;echo>=0;echo--){for(let i=0;i<4;i++){c.beginPath();for(const command of paths[i]){const values=[];for(let k=1;k<command.length;k+=2){const [x,y]=deformation(command[k],command[k+1],i);values.push(start+i*step+x*width,top+y*H+echo*10);}if(command[0]==='M')c.moveTo(...values);else if(command[0]==='L')c.lineTo(...values);else c.bezierCurveTo(...values);}c.lineCap='round';c.lineJoin='round';c.lineWidth=echo?1.1:38;c.strokeStyle=ink;c.globalAlpha=echo?.24:1;c.stroke();}}
 c.globalAlpha=1;const force=pulse(t,1.8,2.8,4.7,6.5);circle(c,74+force*200,top+H*.35,8+force*8,'#efe092');
 text(c,'One impulse. Four different memories.',45,h-40,11,ink,'Manrope',600);
}};}

export function timeMaterial(){return {render(c,w,h,t){
 const bg='#332f31',copper='#d49b69';rect(c,0,0,w,h,bg);caption(c,'12 / THE SHAPE OF AN AFTERIMAGE','DURATION IS A MATERIAL.',w,h,'#e3cfac');
 const motion=pulse(t,2,7,14,20),history=pulse(t,4,8,14,19),slices=pulse(t,7,10,13,17),layers=pulse(t,9,12,14,18);
 const cx=w*.60,cy=h*.49,R=Math.min(w*.26,h*.28);
 const pose=(q)=>({x:cx+Math.sin(q*TAU)*R*.56,y:cy+Math.cos(q*TAU)*R*.27,a:q*TAU*.75-.8,sx:.7+.3*Math.sin(q*TAU+.5)});
 function arc(q,alpha,width,fill=false){const p=pose(q);c.save();c.translate(p.x,p.y);c.rotate(p.a);c.scale(p.sx,1);c.globalAlpha=alpha;c.strokeStyle=copper;c.fillStyle='#e3cfac';c.lineWidth=width;c.beginPath();c.ellipse(0,0,R*.8,R,0,-Math.PI*.7,Math.PI*.7);if(fill){c.closePath();c.fill();}else c.stroke();c.restore();}
 const phase=motion*.56;
 for(let i=0;i<150;i++){const q=phase-history*.62*i/149;arc(q,history*.22*(1-i/190),1.1);}
 for(let i=0;i<12;i++)arc(phase-history*.62*i/11,slices*.47,1.6);
 for(let i=0;i<3;i++)arc(phase-i*.18,layers*.075,0,true);
 arc(phase,1,2.5);
 c.globalAlpha=1;text(c,'AFTER',40,h-100,Math.min(128,w*.17),copper,'Anton',400);text(c,'What remains of a gesture?',45,h-66,15,'#e3cfac','Manrope',400);
}};}

