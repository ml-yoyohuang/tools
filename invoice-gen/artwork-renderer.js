/* Still adaptations of the user's existing works. No image-generation service. */
(() => {
  'use strict';
  const TAU=Math.PI*2,clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
  const smooth=x=>{x=clamp(x);return x*x*x*(x*(x*6-15)+10);};
  const span=(t,a,b)=>smooth((t-a)/(b-a));
  const pulse=(t,a,b,c,d)=>span(t,a,b)*(1-span(t,c,d));
  const defaultSettings={
    moire:[{moireSpacing:28,panX:16,panY:-6},{moireSpacing:32,panX:20,panY:-10},{moireSpacing:36,panX:24,panY:-14}],
    blob:[{zoom:106,panX:0,panY:0},{zoom:108,panX:0,panY:0},{zoom:110,panX:0,panY:0}],
    riso:[{zoom:108,panX:12,panY:-9},{zoom:108,panX:16,panY:14},{zoom:108,panX:-8,panY:5}]
  };

  function interference(c,type,x,y,r,angle,spacing){
    c.save();c.beginPath();c.arc(x,y,r,0,TAU);c.clip();c.translate(x,y);c.rotate(angle);c.beginPath();
    if(type===0)for(let a=-r*1.5;a<r*1.5;a+=spacing){c.moveTo(a,-r*1.5);c.lineTo(a,r*1.5);}
    if(type===1)for(let a=spacing;a<r*2.5;a+=spacing){c.moveTo(a,0);c.arc(0,0,a,0,TAU);}
    if(type===2){const count=Math.min(144,Math.floor(TAU*r/spacing));for(let a=0;a<count;a++){const angle=a/count*TAU;c.moveTo(0,0);c.lineTo(Math.cos(angle)*r*2,Math.sin(angle)*r*2);}}
    c.stroke();c.restore();
  }
  function moire(canvas,variant=0,options={}){
    // Geometry and phase mixing from motion-graphics-astra Vol.01 paintings.js.
    // Typography removed; paper palette and aperture placement adapted for card use.
    const c=canvas.getContext('2d'),scale=canvas.width/1000,w=1000,h=canvas.height/scale,t=8,spacing=options.moireSpacing;
    const [bg,ink]=[['#dfff00','#2446ff'],['#6940df','#dfff00'],['#fffefd','#f36b16']][variant];
    c.setTransform(scale,0,0,scale,0,0);c.fillStyle=bg;c.fillRect(0,0,w,h);
    // Oversized aperture: the circular field extends past both canvas edges.
    const R=Math.max(w,h)*.70,centers=[[.57,.48],[.59,.46],[.54,.50]],x=w*(centers[variant][0]+options.panX/100),y=h*(centers[variant][1]+options.panY/100);
    // Move the second circular line field only a few logical pixels relative to the first.
    const relativeShift=[[0,0],[8,-6],[-7,6]][variant];
    const second=pulse(t,5.2,6.8,10.9,12.5),third=pulse(t,11,12.8,17.2,19.7),weights=[(1-second)*(1-third),second*(1-third),third];
    // Large, confident rings stay legible even as a tiny gallery thumbnail.
    const motion=Math.sin(TAU*t/20),sub=Math.cos(TAU*t/20);
    c.strokeStyle=ink;c.lineWidth=spacing*.28;
    for(let mode=0;mode<3;mode++){
      if(weights[mode]<.001)continue;c.save();c.globalAlpha=weights[mode]*.9;
      interference(c,mode,x,y,R,mode===0?-.16:0,spacing);c.beginPath();c.arc(x,y,R,0,TAU);c.clip();
      c.globalAlpha=weights[mode]*.55;
      interference(c,mode,x+(mode===1?132+motion*22+relativeShift[0]:mode===2?30+motion*12:0),y+(mode===1?sub*14+relativeShift[1]:0),R*1.15,mode===0?-.06+motion*.10:mode===2?.018+motion*.025:0,spacing*(mode===1?1.015:1));c.restore();
    }
    c.fillStyle=bg;c.beginPath();c.arc(x,y,36+third*12,0,TAU);c.fill();c.fillStyle=ink;c.beginPath();c.arc(x,y,4,0,TAU);c.fill();
  }
  function rand(seed){let a=seed>>>0;return()=>{a=(a+0x6d2b79f5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};}
  function blob(canvas,variant=0,options={}){
    // Native JS port of Motion Atlas H06's Canvas draw routine and seeded paths.
    const c=canvas.getContext('2d'),scale=canvas.width/1000,W=1000,H=canvas.height/scale,m=Math.min(W,H),random=rand(617);
    const [paper,primary,secondary]=[['#ffffff','#3450ff','#ff1688'],['#ffec00','#951aff','#ff481f'],['#b8ffdb','#092d42','#ff3d71']][variant];
    c.setTransform(scale,0,0,scale,0,0);c.fillStyle=paper;c.fillRect(0,0,W,H);
    const spacing=19,soft=.35,outer=.055,t=[4.8,7.2,10.1][variant];
    // Three recognizable snapshots: retain seven fields, but let their positions
    // evolve visibly between palette choices instead of barely shifting in place.
    const anchors=[
      [[.22,.16],[.70,.18],[.46,.40],[.83,.47],[.17,.64],[.65,.73],[.39,.94]],
      [[.32,.13],[.82,.24],[.19,.39],[.60,.42],[.85,.68],[.38,.72],[.13,.90]],
      [[.13,.21],[.52,.16],[.86,.36],[.36,.48],[.71,.59],[.19,.78],[.65,.91]]
    ][variant];
    const balls=anchors.map(([x,y],i)=>({x,y,r:m*(.105+random()*.045)*(i===2?1.15:1),fx:.05+random()*.08,fy:.05+random()*.08,px:random()*TAU,py:random()*TAU}));
    const zoom=(options.zoom??100)/100;
    const positions=balls.map(b=>({x:W*(.5+(b.x-.5)*zoom+(options.panX??0)/100+.025*zoom*Math.sin(t*TAU*b.fx+b.px)),y:H*(.5+(b.y-.5)*zoom+(options.panY??0)/100+.025*zoom*Math.sin(t*TAU*b.fy+b.py)),r2:(b.r*zoom)**2}));
    const cols=Math.ceil(W/spacing)+1,rows=Math.ceil(H/spacing)+1,ox=(W-(cols-1)*spacing)/2,oy=(H-(rows-1)*spacing)/2;
    for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){
      const x=ox+i*spacing,y=oy+j*spacing;let f=0;for(const p of positions)f+=p.r2/((x-p.x)**2+(y-p.y)**2+1);
      const k=clamp((f-(1-soft))/(soft*1.4));const eased=k*k*(3-2*k),r=(outer+(1-outer)*eased)*spacing*.56;
      if(r<.3)continue;c.fillStyle=eased>.5?primary:secondary;c.beginPath();c.arc(x,y,r,0,TAU);c.fill();
    }
  }
  const surface=document.createElement('canvas');let gl=null,program=null;
  function riso(canvas,variant=0,options={}){
    surface.width=canvas.width;surface.height=canvas.height;
    // Preserve the original ink / paper shader, with a new aspect-aware camera
    // window. Fill the canvas by uniform scaling and cropping, never stretching.
    if(!gl){
      gl=surface.getContext('webgl',{preserveDrawingBuffer:true,alpha:false});if(!gl)throw Error('目前無法啟用 WebGL，第三張請以支援 WebGL 的瀏覽器開啟。');
      const compile=(type,source)=>{const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(shader));return shader;};
      let composition=window.InvoiceStudyShader.shaders.main.replace('vec2 p=(uv-.5)*vec2(asp,1.);\n  p*=mix(1.20,1.0,sat(asp-.6));','vec2 p=(uv-.5)*uCameraSize+uCamera;');
      composition=composition.replace('vec3 paper=vec3(.953,.937,.902);','vec3 paper=uPaper;').replace('vec3 pink=vec3(1.,.282,.690);','vec3 pink=uInkA;').replace('vec3 blue=vec3(0.,.471,.749);','vec3 blue=uInkB;');
      // White ink must be laid over dark stock; multiplying by the stock would make it disappear.
      composition=composition.replace('c=mix(c, c*blue*1.05, dB*.90);','c=mix(c, uDark>0.5 ? blue : c*blue*1.05, dB*.90);').replace('c=mix(c, c*pink*1.05, dA*.90);','c=mix(c, uDark>0.5 ? pink : c*pink*1.05, dA*.90);');
      program=gl.createProgram();gl.attachShader(program,compile(gl.VERTEX_SHADER,'attribute vec2 aPosition;varying vec2 vUv;void main(){vUv=aPosition*.5+.5;gl_Position=vec4(aPosition,0.,1.);}'));gl.attachShader(program,compile(gl.FRAGMENT_SHADER,window.InvoiceStudyShader.prelude+'\nuniform vec3 uPaper,uInkA,uInkB;uniform float uDark;uniform vec2 uCamera,uCameraSize;\n'+composition));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
      const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
    }
    gl.useProgram(program);gl.viewport(0,0,canvas.width,canvas.height);const loc=gl.getAttribLocation(program,'aPosition');gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0);
    gl.uniform2f(gl.getUniformLocation(program,'uRes'),canvas.width,canvas.height);gl.uniform2f(gl.getUniformLocation(program,'uMouse'),.5,.5);
    // The source artwork's dot-size control spans 0–100%; use its maximum.
    for(const [name,value]of Object.entries({uTime:[6.4,6.7,7.0][variant],uSeed:617,uP0:.42,uP1:1,uP2:.62,uMode:0,uFrame:1,uDt:.016,uActive:0}))gl.uniform1f(gl.getUniformLocation(program,name),value);
    const inks=[[[.953,.937,.902],[1.,.282,.690],[0.,.471,.749]],[[.949,1.,.671],[1.,.4,.2],[.392,.141,.91]],[[.075,.090,.204],[.98,.98,.96],[1.,.32,.63]]][variant];
    gl.uniform1f(gl.getUniformLocation(program,'uDark'),variant===2?1:0);
    const shifts=[[.035,-.035],[.043,-.028],[.027,-.043]],aspect=canvas.width/canvas.height,cameraHeight=Math.min(.74,.94/aspect)/((options.zoom??100)/100);
    gl.uniform2f(gl.getUniformLocation(program,'uCameraSize'),cameraHeight*aspect,cameraHeight);
    gl.uniform2f(gl.getUniformLocation(program,'uCamera'),shifts[variant][0]-(options.panX??0)/100*cameraHeight*aspect,shifts[variant][1]+(options.panY??0)/100*cameraHeight);
    ['uPaper','uInkA','uInkB'].forEach((name,i)=>gl.uniform3fv(gl.getUniformLocation(program,name),inks[i]));
    gl.drawArrays(gl.TRIANGLE_STRIP,0,4);gl.finish();
    canvas.getContext('2d').drawImage(surface,0,0);
  }
  const paints={moire,blob,riso};
  const metadata=[
    {id:'moire',name:'偏移的頻率',galleryVisible:false,colors:['#dfff00','#6940df','#fffefd'],labels:['萊姆藍','紫光萊姆','白橘']},
    {id:'blob',name:'浮力練習',colors:['#ffffff','#ffec00','#b8ffdb'],labels:['藍桃紅','黃紫橘','薄荷珊瑚']},
    {id:'riso',name:'兩種墨，一張紙',colors:['#f3efe6','#f2ffab','#131734'],labels:['粉藍套印','橘紫套印','白墨粉紅']}
  ];
  function create(id,variant=0,orientation='portrait',longEdge=2540,options={}){
    const canvas=document.createElement('canvas'),shortEdge=Math.round(longEdge*1595/2540);
    canvas.width=orientation==='portrait'?shortEdge:longEdge;canvas.height=orientation==='portrait'?longEdge:shortEdge;
    const art=metadata.find(item=>item.id===id);
    if(!art)throw Error('找不到作品');
    const selected=((variant%art.colors.length)+art.colors.length)%art.colors.length;
    paints[id](canvas,selected,{...defaultSettings[id][selected],...options});return canvas;
  }
  const files=new Map(),thumbs=new Map();
  function thumbnail(id,variant=0){const key=id+variant;if(!thumbs.has(key))thumbs.set(key,create(id,variant,'portrait',480).toDataURL('image/png'));return thumbs.get(key);}
  function imageURL(id,variant=0,orientation='portrait'){
    const key=[id,variant,orientation].join('-');
    if(!files.has(key)){
      const promise=Promise.resolve().then(()=>new Promise((resolve,reject)=>create(id,variant,orientation).toBlob(blob=>blob?resolve(URL.createObjectURL(blob)):reject(Error('圖片繪製失敗')),'image/png')));
      files.set(key,promise);promise.catch(()=>files.delete(key));
    }
    return files.get(key);
  }
  window.InvoiceArtworkRenderer={metadata,defaultSettings,create,thumbnail,imageURL};
})();
