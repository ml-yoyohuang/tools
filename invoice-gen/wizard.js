/* Three small steps. User images and carrier numbers stay on this device. */
(() => {
  'use strict';
  const C=window.InvoiceCore,$=id=>document.getElementById(id),canvas=$('canvas'),ctx=canvas.getContext('2d');
  const state={step:1,carrier:'',layout:'full',size:'phone',ratio:1080/2340,phone:[1080,2340],background:'#ff6633',image:null,imageId:null,rotation:0,zoom:1,panX:0,panY:0,cardX:.5,cardY:.74,cardScale:.84,radius:16,title:'我的發票載具',fit:'cover',mode:'photo'};
  const colors=['#ff6633','#2446ff','#dfff00','#ff1688','#00c78b','#a737ff','#ffd000','#00c9ff','#ffffff','#111111'];
  const artColors=[['#ff6633','#dfff00','#2446ff'],['#ff1688','#ffd000','#6b00e8'],['#dfff00','#2446ff','#ff6633'],['#00c9ff','#a737ff','#dfff00'],['#2446ff','#ff6633','#dfff00'],['#a737ff','#00e6ad','#ff1688']];
  const artworks=window.InvoiceArtwork.map((art,i)=>{
    if(art.kind==='generative')return art;
    const [background,accent,ink]=artColors[i];
    const svg=decodeURIComponent(art.src.slice(art.src.indexOf(',')+1)).replaceAll(art.color,background).replaceAll(art.accent,accent).replaceAll(art.ink,ink);
    return {...art,color:background,src:'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg)};
  });
  let renderFrame=0,gesture=null,activeGuides={x:null,y:null},guideTimer,toastTimer,loading=false,loadToken=0,resizing=false,result=null,busy=false,colorChosen=false;
  const pointers=new Map();
  const requestRender=()=>{if(!renderFrame)renderFrame=requestAnimationFrame(()=>{renderFrame=0;render();});};
  const outputSize=()=>state.size==='portrait'||state.size==='landscape'?C.printCard(state.size):C.dimensions(state.ratio,state.size==='phone'?state.phone:null);
  const minZoom=()=>state.layout==='contain'||state.fit==='contain'?.25:1;
  const picker=window.createInvoiceArtworkPicker({getImageId:()=>state.imageId,getOrientation:()=>state.ratio>1?'landscape':'portrait',begin:()=>{loadToken++;loading=true;syncForms();},load:art=>loadImage(art.src,art.id,art.color,false,art),error:message=>{loading=false;syncForms();toast(message);}});
  function toast(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>{$('toast').hidden=true;},3500);}
  function pressed(selector,key,value){document.querySelectorAll(selector).forEach(el=>el.setAttribute('aria-pressed',String(el.dataset[key]===value)));}
  function validCarrier(){
    const field=$('carrier'),text=C.normalize(field.value);state.carrier=text;if(text!==field.value)field.value=text;
    const valid=C.valid(text);$('continue').disabled=!valid;field.setAttribute('aria-invalid',String(Boolean(text&&!valid)));
    $('carrier-error').textContent=text&&!valid?'請輸入 / 加 7 碼英文字母、數字或 . - +':'';
    requestRender();
  }
  function closeSheet(){if($('sheet').open)$('sheet').close();$('sheet').style.transform='';}
  function openSheet(name){
    cancelGesture();document.querySelectorAll('[data-sheet]').forEach(el=>el.hidden=el.dataset.sheet!==name);
    $('sheet-title').textContent={layout:'選擇版型',size:'畫布形狀',image:'選一張圖片',adjust:'調整',save:'儲存圖片'}[name];
    syncForms();if(!$('sheet').open)$('sheet').showModal();
  }
  function goStep(step){
    closeSheet();cancelGesture();resizing=false;state.step=step;state.mode='photo';document.body.dataset.step=step;
    $('carrier-screen').hidden=step!==1;$('workspace').hidden=step===1;$('toolbar').hidden=step===1;$('next').hidden=step===1;
    $('step-title').textContent=['','輸入你的載具','選擇版型與形狀','選一張圖片'][step];
    $('next').textContent=step===3?'完成':'下一步';
    document.querySelectorAll('[data-panel]').forEach(el=>el.hidden=!({2:['layout','size'],3:['image','adjust']}[step]||[]).includes(el.dataset.panel));
    requestRender();
  }
  function setMode(mode){if(state.mode!==mode)cancelGesture();state.mode=mode;syncForms();requestRender();}
  function resetPhoto(){state.panX=state.panY=state.rotation=0;state.zoom=1;clearGuides();}
  function resetCard(){state.cardScale=state.ratio>1?.66:.84;state.cardX=state.layout==='side'?.655:.5;state.cardY=state.layout==='side'?.5:state.layout==='bottom'||state.layout==='contain'?1:.74;if(state.layout==='side')state.cardScale=.64;}
  function setSize(size){
    state.size=size;resizing=false;
    if(size==='phone')state.ratio=state.phone[0]/state.phone[1];
    else if(size==='portrait'||size==='landscape'){const dim=C.printCard(size);state.ratio=dim.width/dim.height;}
    else if(size==='original')state.ratio=state.image?C.clamp(state.image.width/state.image.height,C.MIN_RATIO,C.MAX_RATIO):1;
    else if(size==='square')state.ratio=1;
    if(state.layout==='side'&&state.ratio<1.2)state.layout='bottom';
    resetPhoto();resetCard();clearGuides();syncForms();requestRender();
  }
  function applyRatio(ratio,snap=false){
    if(!Number.isFinite(ratio)||ratio<=0)return;
    const bounded=C.clamp(ratio,C.MIN_RATIO,C.MAX_RATIO);state.ratio=snap?C.snapRatio(bounded):bounded;
    if(state.layout==='side'&&state.ratio<1.2){state.layout='bottom';resetCard();}
    requestRender();
  }
  function syncRatioFields(){const [w,h]=C.ratioText(state.ratio).split(' : ');$('ratio-w').value=w;$('ratio-h').value=h;}
  function syncForms(){
    pressed('[data-layout]','layout',state.layout);pressed('[data-size]','size',state.size);pressed('[data-object]','object',state.mode==='barcode'?'barcode':'photo');
    $('phone-options').hidden=state.size!=='phone';$('custom-options').hidden=state.size!=='custom';
    $('photo-settings').hidden=state.mode==='barcode';$('barcode-settings').hidden=state.mode!=='barcode';
    $('zoom').min=minZoom()*100;$('zoom').value=Math.round(state.zoom*100);$('zoom-value').textContent=Math.round(state.zoom*100)+'%';
    $('zoom').disabled=$('rotate').disabled=$('reset-photo').disabled=!state.image;
    $('fit').value=state.layout==='contain'?'contain':state.fit;$('fit').disabled=state.layout==='contain';
    $('card-scale').value=state.cardScale*100;$('radius').value=state.radius;$('card-title').value=state.title;$('color').value=state.background;
    document.querySelectorAll('[data-color]').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.color===state.background)));
    document.querySelectorAll('[data-image]').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.image===state.imageId)));
    $('next').disabled=loading||busy||(state.step===3&&!state.image);
  }
  function updateEditorUI(){syncForms();}
  function fit(){
    const stage=$('stage'),pad=resizing?24:0,w=Math.max(40,stage.clientWidth-pad),h=Math.max(40,stage.clientHeight-pad),width=Math.min(w,h*state.ratio);
    $('frame').style.width=width+'px';$('frame').style.height=width/state.ratio+'px';
  }
  function render(){
    if(state.step===1)return;
    const {width,height}=outputSize(),scale=Math.min(1,1600/Math.max(width,height));canvas.width=Math.round(width*scale);canvas.height=Math.round(height*scale);
    draw(ctx,canvas.width,canvas.height);fit();
    const card=C.cardRect(width,height,state),g=C.photoGeometry(width,height,state);
    state.cardX=(card.x+card.w/2)/width;state.cardY=(card.y+card.h/2)/height;if(g){state.panX=g.panX;state.panY=g.panY;}
    $('selection').hidden=state.step!==3||state.mode!=='barcode';
    Object.assign($('selection').style,{left:card.x/width*100+'%',top:card.y/height*100+'%',width:card.w/width*100+'%',height:card.h/height*100+'%'});
    $('handles').hidden=!resizing||state.step!==2;renderGuides();syncForms();
  }
  async function loadImage(src,id,color,temporary=false,options={}){
    const token=++loadToken;loading=true;syncForms();
    try{
      const img=new Image();img.src=src;await img.decode();if(token!==loadToken)return;
      const scale=Math.min(1,4096/Math.max(img.naturalWidth,img.naturalHeight)),small=document.createElement('canvas');
      small.width=Math.max(1,Math.round(img.naturalWidth*scale));small.height=Math.max(1,Math.round(img.naturalHeight*scale));small.getContext('2d').drawImage(img,0,0,small.width,small.height);
      state.image=small;state.imageId=id;if(!options.keepTransform)resetPhoto();if(color&&!colorChosen)state.background=color;
      if(state.size==='original'&&!options.keepTransform){state.ratio=C.clamp(small.width/small.height,C.MIN_RATIO,C.MAX_RATIO);if(small.width/small.height!==state.ratio)state.layout='contain';resetCard();}
      state.mode='photo';if(!options.keepSheet)closeSheet();requestRender();
      const dim=outputSize(),geometry=C.photoGeometry(dim.width,dim.height,state);if(geometry.scale>1.5)toast('圖片較小，放大後可能模糊。');
    }catch{if(token===loadToken)toast('無法讀取圖片，請改用 JPG、PNG 或 WebP。');}
    finally{if(temporary)URL.revokeObjectURL(src);if(token===loadToken){loading=false;syncForms();}}
  }
  async function exportImage(){
    if(!state.image||!C.valid(state.carrier)||loading||busy)return;
    busy=true;cancelGesture();syncForms();$('wizard').inert=true;$('next').textContent='處理中';
    let url;
    try{
      const dim=outputSize(),out=document.createElement('canvas');out.width=dim.width;out.height=dim.height;
      const context=out.getContext('2d',{willReadFrequently:true}),box=draw(context,out.width,out.height),print=['portrait','landscape'].includes(state.size),type=print?'image/jpeg':'image/png';
      let blob=await new Promise((resolve,reject)=>out.toBlob(b=>b?resolve(b):reject(Error('圖片無法儲存，請再試一次。')),type,.96));
      if(print)blob=await C.jpegAtDpi(blob);url=URL.createObjectURL(blob);
      const decoded=new Image();decoded.src=url;await decoded.decode();context.clearRect(0,0,out.width,out.height);context.drawImage(decoded,0,0);
      if(!C.verifyCanvas(out,box,state.carrier))throw Error('條碼檢查未通過，請重新調整。');
      if(result)URL.revokeObjectURL(result.url);result={url,file:new File([blob],print?'invoice-easycard.jpg':'invoice-wallpaper.png',{type})};
      $('result').src=url;$('result-link').href=url;$('download').href=url;$('download').download=result.file.name;
      $('result-info').textContent=print?'印刷 JPG · 405 萬畫素 · 750 dpi':'PNG · '+dim.width+' × '+dim.height;
      $('share').hidden=!navigator.canShare?.({files:[result.file]});openSheet('save');
    }catch(error){if(url&&result?.url!==url)URL.revokeObjectURL(url);toast(error.message||'無法儲存，請再試一次。');}
    finally{busy=false;$('wizard').inert=false;$('next').textContent='完成';syncForms();}
  }
  function init(){
    colors.forEach((color,i)=>{const button=document.createElement('button');button.dataset.color=color;button.style.background=color;button.setAttribute('aria-label',['亮橘','電光藍','萊姆綠','桃紅','翡翠綠','紫羅蘭','亮黃','亮青','白','黑'][i]);button.onclick=()=>{colorChosen=true;state.background=color;syncForms();requestRender();};$('swatches').append(button);});
    artworks.forEach(art=>{const button=document.createElement('button');button.dataset.image=art.id;button.setAttribute('aria-label',art.name+(art.kind==='generative'?'，再次點選換色':'占位圖'));const img=document.createElement('img');img.src=art.src;img.alt='';const name=document.createElement('span');name.textContent=art.name+(art.kind==='generative'?' ↻':'');button.append(img,name);button.onclick=()=>picker.select(art,img,button);$('gallery').append(button);});
    const positions={nw:[0,0],n:[50,0],ne:[100,0],e:[100,50],se:[100,100],s:[50,100],sw:[0,100],w:[0,50]};
    Object.entries(positions).forEach(([key,[x,y]])=>{const button=document.createElement('button');button.className='handle';button.dataset.handle=key;button.style.left=x+'%';button.style.top=y+'%';button.setAttribute('aria-label','調整比例 '+key);$('handles').append(button);});
    $('carrier').addEventListener('input',e=>{if(!e.isComposing)validCarrier();});$('carrier').addEventListener('compositionend',validCarrier);
    $('continue').onclick=()=>{if(C.valid(state.carrier)){document.activeElement.blur();goStep(2);}};
    $('carrier').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.isComposing&&C.valid(state.carrier))$('continue').click();});
    $('back').onclick=()=>{if(state.step===1)location.href='./index.html';else goStep(state.step-1);};
    $('next').onclick=()=>state.step<3?goStep(state.step+1):exportImage();
    document.querySelectorAll('[data-panel]').forEach(el=>el.onclick=()=>openSheet(el.dataset.panel));
    document.querySelectorAll('[data-layout]').forEach(el=>el.onclick=()=>{state.layout=el.dataset.layout;if(state.layout==='side'&&state.ratio<1.2)setSize('landscape');resetPhoto();resetCard();closeSheet();requestRender();});
    document.querySelectorAll('[data-size]').forEach(el=>el.onclick=()=>{setSize(el.dataset.size);if(state.size==='custom')syncRatioFields();else if(state.size!=='phone')closeSheet();});
    $('device').onchange=()=>{if($('device').value==='current'){const ratio=C.clamp(Math.min(screen.width,screen.height)/Math.max(screen.width,screen.height),C.MIN_RATIO,1);state.phone=[Math.round(2340*ratio),2340];}else state.phone=$('device').value.split(',').map(Number);setSize('phone');closeSheet();};
    ['ratio-w','ratio-h'].forEach(id=>{$(id).oninput=()=>{const w=Number($('ratio-w').value),h=Number($('ratio-h').value);if(w>0&&h>0)applyRatio(w/h);};$(id).onchange=syncRatioFields;});
    $('swap').onclick=()=>{applyRatio(1/state.ratio);syncRatioFields();};
    $('resize-canvas').onclick=()=>{resizing=true;state.mode='ratio';closeSheet();requestRender();};
    document.querySelectorAll('[data-source]').forEach(el=>el.onclick=()=>{pressed('[data-source]','source',el.dataset.source);$('upload-panel').hidden=el.dataset.source!=='upload';$('gallery').hidden=el.dataset.source!=='gallery';if(el.dataset.source==='gallery')window.prepareInvoiceArtworkGallery($('gallery'));});
    $('file').onchange=e=>{const file=e.target.files[0];e.target.value='';if(!file)return;if(file.size>30*1024*1024){toast('請選擇小於 30 MB 的圖片。');return;}if(file.type==='image/svg+xml'||!(/\.(jpe?g|png|webp|avif|gif|heic|heif)$/i.test(file.name))){toast('請選擇 JPG、PNG 或 WebP 圖片。');return;}picker.reset();loadImage(URL.createObjectURL(file),null,null,true);};
    document.querySelectorAll('[data-object]').forEach(el=>el.onclick=()=>setMode(el.dataset.object));
    $('zoom').oninput=()=>setZoom(Number($('zoom').value)/100);$('rotate').onclick=()=>{state.rotation=(state.rotation+90)%360;state.panX=state.panY=0;requestRender();};$('reset-photo').onclick=()=>{resetPhoto();requestRender();};
    $('fit').onchange=()=>{state.fit=$('fit').value;state.zoom=Math.max(minZoom(),state.zoom);state.panX=state.panY=0;requestRender();};
    $('card-scale').oninput=()=>{state.cardScale=Number($('card-scale').value)/100;requestRender();};$('radius').oninput=()=>{state.radius=Number($('radius').value);requestRender();};$('card-title').oninput=()=>{state.title=$('card-title').value;requestRender();};$('color').oninput=()=>{colorChosen=true;state.background=$('color').value;requestRender();};$('align').onchange=clearGuides;
    $('close-sheet').onclick=closeSheet;$('sheet').addEventListener('click',e=>{if(e.target===$('sheet')){const r=$('sheet').getBoundingClientRect();if(e.clientY<r.top||e.clientY>r.bottom||e.clientX<r.left||e.clientX>r.right)closeSheet();}});
    let dragStart=null;$('sheet-grip').onpointerdown=e=>{dragStart=e.clientY;$('sheet-grip').setPointerCapture(e.pointerId);};$('sheet-grip').onpointermove=e=>{if(dragStart!==null)$('sheet').style.transform=`translateY(${Math.max(0,e.clientY-dragStart)}px)`;};$('sheet-grip').onpointerup=e=>{if(dragStart!==null&&e.clientY-dragStart>70)closeSheet();dragStart=null;$('sheet').style.transform='';};$('sheet-grip').onpointercancel=()=>{dragStart=null;$('sheet').style.transform='';};
    $('frame').addEventListener('pointerdown',e=>{
      if(state.step!==3&&!(state.step===2&&resizing))return;
      if(state.step===3&&!pointers.size){const dim=outputSize(),p=canvasPoint({x:e.clientX,y:e.clientY}),card=C.cardRect(dim.width,dim.height,state);setMode(p.x>=card.x&&p.x<=card.x+card.w&&p.y>=card.y&&p.y<=card.y+card.h?'barcode':'photo');}
      onPointerDown(e);
    });$('frame').addEventListener('pointermove',onPointerMove);['pointerup','pointercancel','lostpointercapture'].forEach(type=>$('frame').addEventListener(type,stopPointer));
    $('frame').addEventListener('wheel',e=>{if(state.step===3)onWheel(e);},{passive:false});$('frame').addEventListener('keydown',e=>{if(state.step===3||resizing)onCanvasKey(e);});
    window.addEventListener('blur',cancelGesture);document.addEventListener('visibilitychange',()=>{if(document.hidden)cancelGesture();});
    $('share').onclick=async()=>{if(result)try{await navigator.share({files:[result.file],title:'我的載具圖片'});}catch(e){if(e.name!=='AbortError')toast('請改用儲存圖片。');}};
    const viewport=()=>{const vv=visualViewport;document.documentElement.style.setProperty('--visible-height',(vv?.height||innerHeight)+'px');$('sheet').style.bottom=innerWidth<700?Math.max(0,innerHeight-(vv?.height||innerHeight)-(vv?.offsetTop||0))+'px':'';fit();};
    window.addEventListener('resize',viewport);window.visualViewport?.addEventListener('resize',viewport);window.visualViewport?.addEventListener('scroll',viewport);new ResizeObserver(fit).observe($('stage'));
    validCarrier();goStep(1);viewport();
  }
  // Shared geometry and Code 39 primitives are provided by core.js.
  function roundRect(context,x,y,w,h,r){context.beginPath();context.roundRect(x,y,w,h,Math.min(r,w/2,h/2));context.fill();}
  function drawPhoto(context,w,h){
    if(!state.image)return;
    const image=state.image, geometry=C.photoGeometry(w,h,state), rect=geometry.area;
    context.save();context.beginPath();context.rect(rect.x,rect.y,rect.w,rect.h);context.clip();
    context.translate(geometry.cx,geometry.cy);context.rotate(state.rotation*Math.PI/180);context.scale(geometry.scale,geometry.scale);
    context.drawImage(image,-image.width/2,-image.height/2);context.restore();
  }
  function drawCard(context,w,h,options={}){
    const card=options.backup?{x:w*.05,y:h*.08,w:w*.9,h:h*.84}:C.cardRect(w,h,state);
    const unit=card.w;
    context.save();
    context.fillStyle='#fff';
    if(!options.backup){context.shadowColor='#23352212';context.shadowBlur=unit*.025;context.shadowOffsetY=unit*.008;}
    roundRect(context,card.x,card.y,card.w,card.h,state.radius/100*unit*.2);
    context.shadowColor='transparent';
    const box={x:card.x+unit*.055,y:card.y+card.h*.31,w:unit*.89,h:card.h*.40};
    const title=state.title.trim();
    if(title){context.fillStyle='#53614b';context.textAlign='center';context.textBaseline='middle';context.font=`${Math.round(unit*.031)}px -apple-system, sans-serif`;context.fillText(title,card.x+unit/2,card.y+card.h*.17,unit*.87);}
    const isValid=C.valid(state.carrier);
    if(isValid){C.drawBarcode(context,state.carrier,box);context.fillStyle='#18251b';context.textAlign='center';context.textBaseline='middle';context.font=`${Math.round(unit*.046)}px ui-monospace, monospace`;context.fillText(state.carrier,card.x+unit/2,card.y+card.h*.85);}
    else{
      context.fillStyle='#e6e8e0';
      for(let i=0;i<35;i++){const x=box.x+(i/35)*box.w;context.fillRect(x,box.y,box.w*(i%3===0?.014:.007),box.h);}
      context.fillStyle='#fff';context.fillRect(box.x,box.y+box.h*.25,box.w,box.h*.5);
      context.fillStyle='#7b8472';context.textAlign='center';context.textBaseline='middle';context.font=`${Math.round(unit*.038)}px sans-serif`;context.fillText('示意圖・請輸入你的載具',card.x+unit/2,box.y+box.h*.5);
      context.font=`${Math.round(unit*.035)}px sans-serif`;context.fillText('YOUR MOBILE BARCODE',card.x+unit/2,card.y+card.h*.86);
    }
    context.restore();return box;
  }
  function draw(context,w,h,options={}){context.clearRect(0,0,w,h);context.fillStyle=options.backup?'#fff':state.background;context.fillRect(0,0,w,h);if(!options.backup)drawPhoto(context,w,h);return drawCard(context,w,h,options);}

  function renderGuides(){
    const {width,height}=outputSize();
    for(const axis of ['x','y']){
      const el=$('guide-'+axis),value=activeGuides[axis];
      el.hidden=value===null;
      if(value!==null)el.style[axis==='x'?'left':'top']=value/(axis==='x'?width:height)*100+'%';
    }
  }
  function clearGuides(){clearTimeout(guideTimer);activeGuides={x:null,y:null};renderGuides();}
  function expireGuides(){clearTimeout(guideTimer);guideTimer=setTimeout(clearGuides,950);}
  function showGuides(guides,rect){
    clearTimeout(guideTimer);
    activeGuides={x:null,y:null};
    if($('align').checked){
      for(const axis of ['x','y']){
        const value=guides[axis];
        if(value!==null&&C.rectAnchors(rect,axis).some(n=>Math.abs(n-value)<.05))activeGuides[axis]=value;
      }
    }
    renderGuides();
  }
  function alignedRect(rect,kind,magnetic=true,alt=false){
    if(!$('align').checked||alt)return {...rect,guides:{x:null,y:null}};
    const {width,height}=outputSize(),area=C.photoRect(width,height,state.layout);
    const other=kind==='photo'?C.cardRect(width,height,state):C.photoGeometry(width,height,state);
    const targets=C.alignmentTargets(width,height,area,other);
    // Screen-pixel threshold gives the same magnetic feel on a phone and desktop.
    // Keyboard moves only display exact alignments, never override the requested 1 px step.
    const threshold=magnetic?6*width/$('frame').getBoundingClientRect().width:.0001;
    return C.snapRect(rect,targets,threshold);
  }
  function movePhoto(cx,cy,magnetic=true,alt=false){
    if(!state.image)return;
    const {width,height}=outputSize(),area=C.photoRect(width,height,state.layout);
    state.panX=(cx-area.x-area.w/2)/area.w;state.panY=(cy-area.y-area.h/2)/area.h;
    const candidate=C.photoGeometry(width,height,state),snapped=alignedRect(candidate,'photo',magnetic,alt);
    state.panX=candidate.panX+(snapped.x-candidate.x)/area.w;
    state.panY=candidate.panY+(snapped.y-candidate.y)/area.h;
    const actual=C.photoGeometry(width,height,state);
    state.panX=actual.panX;state.panY=actual.panY;showGuides(snapped.guides,actual);requestRender();
  }
  function moveCard(cx,cy,magnetic=true,alt=false){
    const {width,height}=outputSize();state.cardX=cx/width;state.cardY=cy/height;
    const candidate=C.cardRect(width,height,state),snapped=alignedRect(candidate,'barcode',magnetic,alt);
    state.cardX=(snapped.x+candidate.w/2)/width;state.cardY=(snapped.y+candidate.h/2)/height;
    const actual=C.cardRect(width,height,state);
    state.cardX=(actual.x+actual.w/2)/width;state.cardY=(actual.y+actual.h/2)/height;
    showGuides(snapped.guides,actual);requestRender();
  }
  function canvasPoint(point,rect=$('frame').getBoundingClientRect()){
    const {width,height}=outputSize();
    return {x:(point.x-rect.left)/rect.width*width,y:(point.y-rect.top)/rect.height*height};
  }
  function setZoom(zoom,anchor,alt=false){
    if(!state.image)return;
    const {width,height}=outputSize(),g=C.photoGeometry(width,height,state),oldZoom=state.zoom;
    state.zoom=C.clamp(zoom,minZoom(),4);
    if(!anchor)anchor={x:g.area.x+g.area.w/2,y:g.area.y+g.area.h/2};
    const center=C.zoomCenter(g,oldZoom,state.zoom,anchor);
    movePhoto(center.x,center.y,true,alt);updateEditorUI();expireGuides();
  }
  function onWheel(event){
    if(state.mode!=='photo'||!state.image||gesture)return;
    event.preventDefault();
    const rect=$('frame').getBoundingClientRect();
    const delta=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?rect.height:1);
    const factor=Math.exp(-C.clamp(delta,-200,200)*(event.ctrlKey ? .008 : .002));
    setZoom(state.zoom*factor,canvasPoint({x:event.clientX,y:event.clientY},rect),event.altKey);
  }
  function beginDrag(id,point,handle){
    const rect=$('frame').getBoundingClientRect(),{width,height}=outputSize();
    const g=C.photoGeometry(width,height,state),card=C.cardRect(width,height,state);
    gesture={kind:'drag',id,x:point.x,y:point.y,rect,handle,mode:state.mode,
      photoX:g?.cx,photoY:g?.cy,cardX:card.x+card.w/2,cardY:card.y+card.h/2};
  }
  function beginPinch(){
    const [a,b]=[...pointers.values()],rect=$('frame').getBoundingClientRect(),{width,height}=outputSize();
    gesture={kind:'pinch',mode:'photo',rect,zoom:state.zoom,distance:Math.max(1,Math.hypot(b.x-a.x,b.y-a.y)),
      anchor:canvasPoint({x:(a.x+b.x)/2,y:(a.y+b.y)/2},rect),geometry:C.photoGeometry(width,height,state)};
  }
  function onPointerDown(event){
    if(event.button!==0||event.target.closest('a'))return;
    const handle=event.target.closest('[data-handle]');
    if(state.mode==='photo'&&!state.image||state.mode==='ratio'&&!handle)return;
    if(pointers.size>=2)return;
    if(pointers.size&&(state.mode!=='photo'||event.pointerType!=='touch'||[...pointers.values()][0].type!=='touch'))return;
    const point={x:event.clientX,y:event.clientY,type:event.pointerType};
    if(state.mode==='barcode'){
      const {width,height}=outputSize(),card=C.cardRect(width,height,state),p=canvasPoint(point);
      if(p.x<card.x||p.x>card.x+card.w||p.y<card.y||p.y>card.y+card.h)return;
    }
    pointers.set(event.pointerId,point);
    (handle||$('frame')).focus({preventScroll:true});
    // Some WebViews may decline capture. The same handlers still work within the canvas.
    try{$('frame').setPointerCapture(event.pointerId);}catch{}
    if(pointers.size===2)beginPinch();else beginDrag(event.pointerId,point,handle?.dataset.handle);
    event.preventDefault();
  }
  function onPointerMove(event){
    if(!gesture||!pointers.has(event.pointerId))return;
    pointers.set(event.pointerId,{x:event.clientX,y:event.clientY,type:event.pointerType});
    if(gesture.kind==='pinch'){
      const [a,b]=[...pointers.values()];if(!a||!b)return;
      state.zoom=C.clamp(gesture.zoom*Math.hypot(b.x-a.x,b.y-a.y)/gesture.distance,minZoom(),4);
      const midpoint=canvasPoint({x:(a.x+b.x)/2,y:(a.y+b.y)/2},gesture.rect);
      const center=C.zoomCenter(gesture.geometry,gesture.zoom,state.zoom,gesture.anchor,midpoint);
      movePhoto(center.x,center.y,true,event.altKey);updateEditorUI();return;
    }
    const dx=event.clientX-gesture.x,dy=event.clientY-gesture.y,{width,height}=outputSize();
    if(gesture.mode==='ratio'){
      const h=gesture.handle,w=Math.max(50,gesture.rect.width+(h.includes('e')?dx:h.includes('w')?-dx:0));
      const nextH=Math.max(50,gesture.rect.height+(h.includes('s')?dy:h.includes('n')?-dy:0));
      const raw=w/nextH,snap=$('ratio-snap').checked&&!event.altKey;
      applyRatio(raw,snap);syncRatioFields();
      if(snap&&Math.abs(state.ratio-raw)>.00001&&state.ratio===C.snapRatio(raw)){
        const size=outputSize();activeGuides={x:size.width/2,y:size.height/2};renderGuides();
      }else clearGuides();
    }else if(gesture.mode==='barcode')moveCard(gesture.cardX+dx/gesture.rect.width*width,gesture.cardY+dy/gesture.rect.height*height,true,event.altKey);
    else movePhoto(gesture.photoX+dx/gesture.rect.width*width,gesture.photoY+dy/gesture.rect.height*height,true,event.altKey);
  }
  function stopPointer(event){
    if(!pointers.has(event.pointerId))return;
    if(event.type==='pointercancel'){cancelGesture();return;}
    const wasPinch=gesture?.kind==='pinch';pointers.delete(event.pointerId);
    if($('frame').hasPointerCapture(event.pointerId))$('frame').releasePointerCapture(event.pointerId);
    if(wasPinch&&pointers.size){const [id,point]=[...pointers.entries()][0];beginDrag(id,point);}
    else if(!pointers.size){gesture=null;expireGuides();}
  }
  function cancelGesture(){
    const ids=[...pointers.keys()];pointers.clear();gesture=null;
    for(const id of ids)if($('frame').hasPointerCapture(id))$('frame').releasePointerCapture(id);
    clearGuides();
  }
  function onCanvasKey(event){
    if(['+','=','-','_'].includes(event.key)&&state.mode==='photo'){
      event.preventDefault();setZoom(state.zoom+(['-','_'].includes(event.key)?-.05:.05));return;
    }
    if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;
    event.preventDefault();
    const step=event.shiftKey?10:1,dx=event.key==='ArrowLeft'?-step:event.key==='ArrowRight'?step:0,dy=event.key==='ArrowUp'?-step:event.key==='ArrowDown'?step:0;
    const {width,height}=outputSize();
    if(state.mode==='ratio'){
      const handle=event.target.dataset.handle||'se';
      const horizontal=handle.includes('e')||handle.includes('w'),vertical=handle.includes('n')||handle.includes('s');
      applyRatio(Math.max(1,width+(horizontal?(handle.includes('w')?-dx:dx):0))/Math.max(1,height+(vertical?(handle.includes('n')?-dy:dy):0)));
      syncRatioFields();clearGuides();
    }else if(state.mode==='barcode'){
      const card=C.cardRect(width,height,state);moveCard(card.x+card.w/2+dx,card.y+card.h/2+dy,false);
    }else if(state.image){const g=C.photoGeometry(width,height,state);movePhoto(g.cx+dx,g.cy+dy,false);}
    expireGuides();requestRender();
  }

  init();
})();
