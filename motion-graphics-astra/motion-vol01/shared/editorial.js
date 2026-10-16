import {pulse,mix} from './math.js';
export function createEditorial(stage) {
  const el=document.createElement('div');el.className='editorial';
  el.innerHTML=`<div class="ed-kicker">FIELD JOURNAL / BOTANICAL MEMORY</div><div class="ed-issue">VOL. 01 — 2026</div><div class="ed-image"><img src="../assets/photogram-fern.svg" alt="Original ochre contact print of a delicate branching fern"></div><div class="ed-image"><img src="../assets/photogram-leaf.svg" alt="Original dark botanical contact print with pale translucent leaves"></div><h2 class="ed-title">An herbarium<br>of <em>hours.</em></h2><p class="ed-copy">We gathered nothing<br>but an afternoon.<br><br>The leaf is gone.<br>The light remains.</p><div class="ed-number">01</div><div class="ed-caption">FIG. 01 — A FERN, AFTER LIGHT<br>Contact studies / imagined specimens</div><div class="ed-rule"></div><div class="ed-footer"><span>GATHER. PRESERVE. REMEMBER.</span><span>THE POETRY OF MOVING FORMS / 03</span></div>`;
  stage.append(el);
  const title=el.querySelector('.ed-title'),images=[...el.querySelectorAll('.ed-image')],copy=el.querySelector('.ed-copy'),number=el.querySelector('.ed-number'),caption=el.querySelector('.ed-caption');
  function pos(node,values){node.style.left=values[0]+'%';node.style.top=values[1]+'%';node.style.width=values[2]+'%';if(values[3]!==undefined)node.style.height=values[3]+'%';}
  return function editorial(c,w,h,t){
    const b=pulse(t,4,6.5,9.5,12),d=pulse(t,10,12.8,15,18),tall=h>w;
    const layouts=tall?[
      {title:[6,13,88],a:[29,31,65,46],b:[6,59,27,25],copy:[6,35,30],num:[76,78,20],caption:[6,85,90],size:12},
      {title:[8,46,90],a:[5,12,57,39],b:[66,18,29,25],copy:[58,64,36],num:[8,74,22],caption:[6,85,90],size:12.5},
      {title:[6,14,90],a:[6,40,38,37],b:[48,33,47,47],copy:[8,29,80],num:[73,78,20],caption:[6,85,90],size:11}
    ]:[
      {title:[5,15,85],a:[44,13,44,69],b:[8,65,24,18],copy:[8,43,27],num:[83,71,15],caption:[44,84,50],size:9.6},
      {title:[32,38,65],a:[5,13,33,68],b:[76,12,19,21],copy:[56,66,30],num:[40,72,16],caption:[5,84,60],size:8.8},
      {title:[7,14,85],a:[8,63,26,20],b:[47,33,44,49],copy:[8,41,30],num:[80,17,16],caption:[47,84,50],size:8.9}
    ];
    const interpolate=key=>layouts[0][key].map((v,i)=>mix(mix(v,layouts[1][key][i],b),layouts[2][key][i],d));
    pos(title,interpolate('title'));pos(images[0],interpolate('a'));pos(images[1],interpolate('b'));pos(copy,interpolate('copy'));pos(number,interpolate('num'));pos(caption,interpolate('caption'));
    title.style.fontSize=mix(mix(layouts[0].size,layouts[1].size,b),layouts[2].size,d)+'cqw';
    images[0].firstElementChild.style.transform=`scale(${1.07+b*.15+d*.06}) translate(${b*-5}%,${d*4}%)`;
    images[1].firstElementChild.style.transform=`scale(${1.05+d*.2}) translateY(${b*-5}%)`;
    number.textContent=d>.5?'03':b>.5?'02':'01';
    copy.style.opacity=tall?1-d*.8:1;
    if(tall)copy.style.fontSize=(d>0.5?1.8:2.3)+'cqw';
  };
}
