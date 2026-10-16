import {pulse,text,rect,caption} from '../common/math.js';
export function paper({stage}){
 const world=document.createElement('div');world.className='paper-world';stage.append(world);
 const titles=['A letter','to the','wind.','Fold the','distance.','Keep the air.'];const backs=['Nothing','arrives','unchanged.','The fold','remembers','your hands.'];
 const panels=titles.map((title,i)=>{const node=document.createElement('div');node.className='paper-panel';node.innerHTML=`<div class="paper-face"><strong>${title}</strong><p>${i===3?'There is no address for an afternoon. Only a crease where the light was held.':i===5?'An unsent letter / a small geography of distance.':''}</p>${i>2?'<svg class="map-lines" viewBox="0 0 280 200">'+Array.from({length:15},(_,j)=>`<ellipse cx="140" cy="145" rx="${30+j*10}" ry="${15+j*7}"/>`).join('')+'</svg>':''}<span class="crease-number">${String(i+1).padStart(2,'0')} / AN UNSENT LETTER</span></div><div class="paper-face paper-back"><strong>${backs[i]}</strong><p>What is hidden<br>is still part of the page.</p><span class="crease-number">VERSO / ${i+1}</span></div>`;node.querySelector(".paper-face strong").style.fontSize=(title.length>=8?42:57)+"px";node.querySelector(".paper-back strong").style.fontSize=(backs[i].length>=8?34:46)+"px";world.append(node);return node;});
 return {kind:'css3d',render(c,w,h,t){
  rect(c,0,0,w,h,'#a95e43');caption(c,'09 / THE MEMORY OF A FOLD','A LETTER TO THE WIND.',w,h,'#f0e5cf');
  const accordion=pulse(t,2.8,6.5,9.4,14.5),cross=pulse(t,9,12,14,18),reveal=pulse(t,10,12.8,14.8,18.5);
  const s=Math.min(w*.81/660,(h-185)*.94/500),originX=w*.5-330*s,originY=h*.53-250*s;
  world.style.left=originX/w*100+'%';world.style.top=originY/h*100+'%';world.style.transform=`scale(${s*stage.clientWidth/w}) rotateX(${-8*accordion}deg) rotateZ(${-5*cross}deg)`;
  const angles=[-.90*accordion,1.1*accordion,-.95*accordion+3.5*reveal];
  let x=0,z=0;
  for(let col=0;col<3;col++){
   const a=angles[col];
   for(let row=0;row<2;row++){
    const node=panels[row*3+col],fold=row?(2.35+col*.1)*cross:0;
    node.style.transform=`translate3d(${x}px,${row*250}px,${z}px) rotateY(${a}rad) rotateX(${fold}rad)`;
    node.querySelector('.paper-back').style.transform=row?'rotateX(180deg) translateZ(.8px)':'rotateY(180deg) translateZ(.8px)';
    node.querySelector('.paper-face').style.backgroundColor=`rgb(${238-Math.round(Math.abs(a)*8)},${232-Math.round(Math.abs(a)*10)},${213-Math.round(Math.abs(a)*11)})`;
   }
   x+=220*Math.cos(a);z-=220*Math.sin(a);
  }
  text(c,'The front is a statement. The back is a secret.',43,h-68,12,'#f0e5cf','Manrope',500);
 },dispose(){world.remove();}};
}


