/* Draw across the full artboard so SVG pattern-tile clipping cannot create seams. */
const invoiceDotGrid=(art,radius)=>Array.from({length:8},(_,row)=>Array.from({length:6},(_,col)=>{
  const x=100+col*200,y=100+row*200;
  return `<circle cx="${x}" cy="${y}" r="${radius}" fill="${art.accent}"/>`;
}).join('')).join('');
const invoicePatterns=[
  {
    id:'waves',name:'波浪',color:'#f7f6ef',accent:'#3453ff',ink:'#ff6840',
    draw:art=>Array.from({length:12},(_,row)=>{
      const path=`M-400 ${row*170-85}`+'c100 -55 300 55 400 0'.repeat(5);
      return `<path d="${path}" fill="none" stroke="${art.accent}" stroke-width="78"/><path d="${path}" fill="none" stroke="${art.ink}" stroke-width="12"/>`;
    }).join('')
  },
  {
    id:'waves-even',name:'均勻波浪',color:'#ffffff',accent:'#ff692e',
    draw:art=>Array.from({length:9},(_,row)=>{
      const path=`M-420 ${row*205-15}`+'c60 -60 150 -60 210 0c60 60 150 60 210 0'.repeat(5);
      return `<path d="${path}" fill="none" stroke="${art.accent}" stroke-width="82"/>`;
    }).join('')
  },
  {
    id:'grid',name:'格子',color:'#2948f4',accent:'#fffefa',ink:'#fa6646',
    draw:art=>{
      const vertical=Array.from({length:8},(_,i)=>`M${i*180} 0V1600`).join('');
      const horizontal=Array.from({length:10},(_,i)=>`M0 ${i*180}H1200`).join('');
      const joints=Array.from({length:8},(_,x)=>Array.from({length:10},(_,y)=>`<rect x="${x*180-10}" y="${y*180-10}" width="20" height="20" fill="${art.ink}"/>`).join('')).join('');
      return `<path d="${vertical+horizontal}" fill="none" stroke="${art.accent}" stroke-width="13"/>${joints}`;
    }
  },
  {
    id:'grid-two-tone',name:'雙色格子',color:'#17665b',accent:'#f8df9b',
    draw:art=>{
      const vertical=Array.from({length:8},(_,i)=>`M${i*180} 0V1600`).join('');
      const horizontal=Array.from({length:10},(_,i)=>`M0 ${i*180}H1200`).join('');
      return `<path d="${vertical+horizontal}" fill="none" stroke="${art.accent}" stroke-width="18"/>`;
    }
  },
  {
    id:'cube-blocks',name:'立方體方塊',color:'#45cfc2',accent:'#2869bd',ink:'#ffb8aa',
    draw:art=>Array.from({length:8},(_,row)=>Array.from({length:6},(_,col)=>`
      <g transform="translate(${col*200} ${row*200})">
        <path d="M100 0V100H200L100 200H0V100Z" fill="${art.accent}"/>
        <rect x="100" width="100" height="100" fill="${art.ink}"/>
      </g>`).join('')).join('')
  },
  {
    id:'dots',name:'點點',color:'#42c65b',accent:'#ff9ac8',
    draw:art=>invoiceDotGrid(art,65)
  },
  {
    id:'dots-touching',name:'相切點點',color:'#42c65b',accent:'#ff9ac8',
    draw:art=>invoiceDotGrid(art,100)
  },
  {
    id:'diagonal',name:'斜線',color:'#fa4fa9',accent:'#fffdf5',ink:'#4f20a0',
    draw:art=>Array.from({length:33},(_,i)=>{
      const x=-1680+i*90,path=`M${x} 1600L${x+1600} 0`;
      return `<path d="${path}" fill="none" stroke="${art.accent}" stroke-width="25"/>${i%3===0?`<path d="${path}" fill="none" stroke="${art.ink}" stroke-width="5"/>`:''}`;
    }).join('')
  },
  {
    id:'diagonal-wide',name:'寬斜線',color:'#3c82f6',accent:'#ffcf4c',
    draw:art=>Array.from({length:24},(_,i)=>{
      const x=-1755+i*135,path=`M${x} 1600L${x+1600} 0`;
      return `<path d="${path}" fill="none" stroke="${art.accent}" stroke-width="38"/>`;
    }).join('')
  },
  {
    id:'quarter-circles',name:'四分之一圓',color:'#fff043',accent:'#3925c9',ink:'#fc6935',
    draw:art=>Array.from({length:8},(_,row)=>Array.from({length:6},(_,col)=>{
      const turn=(row+col)%2?'translate(240 0) rotate(90)':'';
      const path='M120 0A120 120 0 0 0 240 120M120 240A120 120 0 0 0 0 120';
      return `<g transform="translate(${col*240} ${row*240}) ${turn}"><path d="${path}" fill="none" stroke="${art.accent}" stroke-width="92" stroke-linecap="round"/><path d="${path}" fill="none" stroke="${art.ink}" stroke-width="20" stroke-linecap="round"/></g>`;
    }).join('')).join('')
  },
  {
    id:'quarter-mosaic',name:'四分之一圓拼貼',color:'#fff6e4',thumbViewBox:'200 400 800 800',palette:['#fff6e4','#313692','#dafa5a','#ec789f','#7bd0ce'],
    draw:art=>{
      const colors=art.palette;
      // Every square has a full background; corner circles are clipped by their square.
      const cells=[
        [[0,1,'tl'],[4,2,'tr'],[3,4,'bl'],[0,3,'br'],[3,1,'tl'],[1,4,'tr']],
        [[3,0,'br'],[0,4,'bl'],[1,0,'full'],[1,2,'tr'],[4,3,'tl'],[0,2,'full']],
        [[0,3,'bl'],[4,0,'tl'],[2,1,'tr'],[2,4,'br'],[0,3,'full'],[4,1,'bl']],
        [[2,4,'tl'],[1,4,'full'],[3,1,'br'],[0,4,'tr'],[1,3,'bl'],[3,0,'tl']],
        [[4,2,'br'],[0,1,'tr'],[3,2,'full'],[2,3,'bl'],[4,1,'tl'],[0,4,'br']],
        [[3,0,'tr'],[1,3,'bl'],[4,0,'full'],[0,2,'tl'],[3,4,'br'],[2,1,'tr']],
        [[0,4,'bl'],[2,1,'full'],[1,0,'tl'],[3,2,'tr'],[4,3,'bl'],[0,1,'br']],
        [[1,3,'br'],[4,0,'tr'],[0,2,'bl'],[2,4,'full'],[3,1,'tl'],[4,3,'br']]
      ];
      const corners={tl:[0,0],tr:[200,0],br:[200,200],bl:[0,200],full:[100,100]};
      return cells.map((row,y)=>row.map(([background,foreground,shape],x)=>{
        const [cx,cy]=corners[shape];
        return `<svg x="${x*200}" y="${y*200}" width="200" height="200" viewBox="0 0 200 200" overflow="hidden"><rect width="200" height="200" fill="${colors[background]}"/><circle cx="${cx}" cy="${cy}" r="${shape==='full'?100:200}" fill="${colors[foreground]}"/></svg>`;
      }).join('')).join('');
    }
  },
  {
    id:'squiggle',name:'彎彎曲線',color:'#36e5c4',accent:'#172762',ink:'#ff6943',
    draw:art=>Array.from({length:8},(_,row)=>{
      const y=85+row*220,x=row%2?-360:-240;
      const path=`M${x} ${y}`+'c60 -70 60 70 120 0c60 -70 60 70 120 0'.repeat(8);
      return `<path d="${path}" fill="none" stroke="${art.accent}" stroke-width="22" stroke-linecap="round"/><path d="${path}" fill="none" stroke="${art.ink}" stroke-width="5" stroke-linecap="round"/>`;
    }).join('')
  },
  {
    id:'squiggle-night',name:'不規則曲線 · 夜色',color:'#292054',accent:'#d9ff63',
    draw:art=>{
      const path=[
        'M-80 90',
        'C115 20 270 35 430 125',
        'C610 240 770 20 950 90',
        'C1150 155 1290 195 1240 300',
        'C1180 420 1020 345 860 310',
        'C670 260 550 380 660 450',
        'C780 525 980 450 1080 550',
        'C1210 680 990 750 840 670',
        'C690 580 560 595 420 685',
        'C300 765 110 625 0 760',
        'C-90 870 80 965 230 850',
        'C365 745 520 820 585 920',
        'C665 1040 820 835 950 900',
        'C1120 980 1260 910 1270 1030',
        'C1280 1160 1070 1110 930 1075',
        'C785 1030 680 1150 560 1130',
        'C420 1110 335 1030 195 1135',
        'C50 1240 -45 1270 -45 1375',
        'C-40 1480 145 1430 280 1370',
        'C410 1315 530 1425 660 1390',
        'C800 1350 870 1290 1010 1385',
        'C1140 1470 1210 1525 1300 1580'
      ].join(' ');
      return `<path d="${path}" fill="none" stroke="${art.accent}" stroke-width="34" stroke-linecap="round" stroke-linejoin="round"/>`;
    }
  },
  {
    id:'squiggle-free',name:'不規則曲線 · 暖紙',color:'#eee5d8',accent:'#b65b46',
    draw:art=>{
      const points=[
        [-80,65],[75,95],[180,40],[310,80],[255,190],[170,190],[130,300],
        [265,390],[365,300],[500,235],[635,320],[790,220],[930,175],
        [1080,275],[1110,405],[1010,490],[840,435],[720,535],[590,445],
        [460,520],[455,650],[580,740],[730,680],[890,750],[1050,660],
        [1140,790],[1070,945],[920,920],[805,1040],[660,950],[510,1020],
        [350,905],[200,950],[90,840],[35,1030],[150,1170],[310,1130],
        [400,1250],[330,1370],[160,1320],[85,1470],[240,1535],[420,1480],
        [500,1330],[650,1270],[780,1370],[900,1230],[1040,1150],
        [1135,1270],[1060,1450],[930,1510],[1090,1610],[1300,1590]
      ];
      let path=`M${points[0].join(' ')}`;
      for(let i=0;i<points.length-1;i++){
        const before=points[Math.max(0,i-1)],from=points[i],to=points[i+1],after=points[Math.min(points.length-1,i+2)];
        const x1=from[0]+(to[0]-before[0])/6,y1=from[1]+(to[1]-before[1])/6;
        const x2=to[0]-(after[0]-from[0])/6,y2=to[1]-(after[1]-from[1])/6;
        path+=` C${x1.toFixed(1)} ${y1.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)} ${to.join(' ')}`;
      }
      return `<path d="${path}" fill="none" stroke="${art.accent}" stroke-width="32" stroke-linecap="round" stroke-linejoin="round"/>`;
    }
  }
];
const invoicePatternAlternates={
  waves:{color:'#e7f8ff',accent:'#f746a6',ink:'#4937d7'},
  'waves-even':{color:'#d8f7e9',accent:'#7549e9'},
  grid:{color:'#ffdc48',accent:'#3548ad',ink:'#fa7089'},
  'grid-two-tone':{color:'#ff9aca',accent:'#6037bb'},
  'cube-blocks':{color:'#ffe2a7',accent:'#f46958',ink:'#5e52b8'},
  dots:{color:'#3159e9',accent:'#ffdf63'},
  'dots-touching':{color:'#f06b85',accent:'#baf5df'},
  diagonal:{color:'#04bda6',accent:'#fff080',ink:'#155dd5'},
  'diagonal-wide':{color:'#ffad78',accent:'#9144d6'},
  'quarter-circles':{color:'#48d4cf',accent:'#fff0cf',ink:'#ef4d82'},
  'quarter-mosaic':{color:'#273e70',palette:['#273e70','#fdf1da','#ff805a','#a4daf4','#ffd347']},
  squiggle:{color:'#ffebbd',accent:'#d53786',ink:'#f9684c'},
  'squiggle-night':{color:'#16434a',accent:'#ffb5db'},
  'squiggle-free':{color:'#f6dfae',accent:'#654aa7'}
};
const invoicePatternArtwork=invoicePatterns.map(({draw,thumbViewBox,...art})=>{
  const render=appearance=>{
    const artwork=`<title>${art.name}</title><rect width="1200" height="1600" fill="${appearance.color}"/>${draw(appearance)}`;
    const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1600" viewBox="0 0 1200 1600">${artwork}</svg>`;
    const thumb=thumbViewBox?`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="${thumbViewBox}">${artwork}</svg>`:null;
    return {color:appearance.color,src:'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg),...(thumb?{thumbSrc:'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(thumb)}:{})};
  };
  const variants=[render(art),render({...art,...invoicePatternAlternates[art.id]})];
  return {...art,kind:'pattern',...variants[0],variants};
});
const invoicePatternGroups=[
  {id:'pattern-waves',name:'流動的波浪',members:['waves-even','waves']},
  {id:'pattern-grid',name:'方格與立方',members:['grid','grid-two-tone','cube-blocks']},
  {id:'pattern-lines',name:'斜向節奏',members:['diagonal','diagonal-wide']},
  {id:'pattern-circles',name:'圓形拼貼',members:['dots','dots-touching','quarter-circles','quarter-mosaic']},
  {id:'pattern-curves',name:'自由曲線',members:['squiggle','squiggle-night','squiggle-free']}
];
window.InvoiceArtwork=invoicePatternGroups.map(group=>{
  const variants=group.members.flatMap(id=>{
    const art=invoicePatternArtwork.find(item=>item.id===id);
    return art.variants.map((variant,index)=>({...variant,label:`${art.name} · ${index?'異色版':'原色版'}`}));
  });
  return {id:group.id,name:group.name,kind:'pattern-group',src:variants[0].src,thumbSrc:variants[0].thumbSrc,color:variants[0].color,variants};
});

// These small JPEGs are interface assets; the full-size artwork renders on selection.
const invoiceArtworkThumb=(id,variant=0)=>`thumbs/${id}-${['original','alternate-1','alternate-2'][variant]}.jpg`;
if(window.InvoiceArtworkRenderer){
  for(const art of window.InvoiceArtworkRenderer.metadata){
    const src=invoiceArtworkThumb(art.id);
    window.InvoiceArtwork.push({id:'study-'+art.id,name:art.name,kind:'generative',artworkId:art.id,src,color:art.colors[0]});
  }
}
window.InvoiceArtwork.push({
  id:'cat-in-bag',name:'袋子裡有住戶',kind:'illustration',color:'#bcfa19',
  src:'thumbs/cat-in-bag.jpg',
  portraitSrc:'artworks/cat-in-bag-portrait.jpg',
  landscapeSrc:'artworks/cat-in-bag-landscape.jpg'
});
window.InvoiceArtwork.push({
  id:'orange-keeper',name:'橘子保管員',kind:'illustration',color:'#fffdf2',
  src:'thumbs/orange-keeper.jpg?v=4',
  portraitSrc:'artworks/orange-keeper-portrait.jpg?v=4',
  landscapeSrc:'artworks/orange-keeper-landscape.jpg?v=4'
});
window.prepareInvoiceArtworkGallery=function(root){
  const button=root.querySelector('[data-image="study-riso"]');
  if(!button)return;
  try{
    const canvas=document.createElement('canvas'),gl=canvas.getContext('webgl');
    if(!gl)button.remove();
    else gl.getExtension('WEBGL_lose_context')?.loseContext();
  }catch{button.remove();}
};
window.createInvoiceArtworkPicker=function({getImageId,getOrientation,begin,load,error}){
  let revision=0,lastId=null;const variants=new Map();
  return {
    reset(){revision++;lastId=null;},
    async select(art,img,button){
      const token=++revision,generated=art.kind==='generative',pattern=art.kind==='pattern-group'&&art.variants?.length>1;
      const R=window.InvoiceArtworkRenderer,meta=generated?R.metadata.find(item=>item.id===art.artworkId):null;
      const repeated=(generated||pattern)&&(lastId===art.id||getImageId()===art.id);
      const count=generated?meta.colors.length:pattern?art.variants.length:1;
      const variant=repeated?((variants.get(art.id)||0)+1)%count:(variants.get(art.id)||0);
      const selected=pattern?art.variants[variant]:null;
      lastId=art.id;if(generated||pattern)variants.set(art.id,variant);begin();
      try{
        const src=generated?await R.imageURL(art.artworkId,variant,getOrientation()):selected?selected.src:art.portraitSrc?(getOrientation()==='landscape'?art.landscapeSrc:art.portraitSrc):art.src;
        if(token!==revision)return;
        const keepTransform=(generated||pattern)&&getImageId()===art.id;
        await load({src,id:art.id,name:selected?`${art.name} · ${selected.label}`:art.name,color:generated?meta.colors[variant]:selected?selected.color:art.color,keepTransform,keepSheet:generated||(pattern&&repeated)});
        if(token!==revision)return;
        if(generated){img.src=invoiceArtworkThumb(art.artworkId,variant);button.dataset.variant=variant;button.setAttribute('aria-label',`${art.name}，${meta.labels[variant]}，再次點選換色`);}
        if(pattern){img.src=selected.thumbSrc||selected.src;button.dataset.variant=variant;button.setAttribute('aria-label',`${art.name}，${selected.label}，再次點選切換圖案`);}
      }catch(e){if(token===revision)error(e.message||'圖片無法讀取，請再試一次。');}
    }
  };
};
