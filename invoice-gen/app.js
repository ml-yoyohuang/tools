/* No analytics, network APIs, third-party fonts, or external image services. */
(() => {
  'use strict';
  const C=window.InvoiceCore, $=id=>document.getElementById(id);
  const canvas=$('canvas'), ctx=canvas.getContext('2d',{willReadFrequently:true});
  const gallery=window.InvoiceArtwork;
  const state={image:null,imageName:'',imageId:null,rotation:0,zoom:1,panX:0,panY:0,fit:'cover',layout:'full',background:'#e9e2d1',size:'phone',ratio:1080/2340,phone:[1080,2340],customRatio:9/19.5,mode:'photo',carrier:'',cardX:.5,cardY:.74,cardScale:.84,radius:16,title:'我的發票載具',overlay:'none',loading:false};
  let frame=0, loadToken=0, toastTimer, resultURLs=[], lastBarcodeBox, gesture=null, exportBusy=false;
  const STORAGE='invoice-gen.carrier.v1';
  const pointers=new Map();
  let guideTimer, activeGuides={x:null,y:null};
  let ratioStart=state.ratio, customCardScale=false;
  const picker=window.createInvoiceArtworkPicker({getImageId:()=>state.imageId,getOrientation:()=>state.ratio>1?'landscape':'portrait',begin:()=>{loadToken++;state.loading=true;syncExport();},load:art=>loadImage(art.src,art.name,art.id,art.color,false,art.keepTransform),error:message=>{state.loading=false;syncExport();toast(message);}});
  const requestRender=()=>{if(!frame)frame=requestAnimationFrame(()=>{frame=0;render();});};
  function toast(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>{$('toast').hidden=true;},4500);}
  function pressed(selector, attribute, value){document.querySelectorAll(selector).forEach(el=>{const active=el.dataset[attribute]===value;el.classList.toggle('active',active);el.setAttribute('aria-pressed',String(active));});}
  function outputSize(){
    if(state.size==='portrait'||state.size==='landscape')return C.printCard(state.size);
    return C.dimensions(state.ratio,state.size==='phone'?state.phone:null);
  }
  function isPrintCard(){return state.size==='portrait'||state.size==='landscape';}
  function syncExport(){
    $('export').disabled=!C.valid(state.carrier)||!state.image||state.loading||exportBusy;
    $('mobile-export').disabled=$('export').disabled;
    $('export-status').textContent=state.loading?'正在讀取圖片…':!state.image?'請先在第四步選擇圖片，再儲存你的作品。':C.valid(state.carrier)?(isPrintCard()?'印刷版 JPG · 405 萬畫素 · 750 dpi · 儲存前檢查條碼':'PNG 清晰輸出 · 儲存前自動檢查成品條碼'):'填入正確格式的載具號碼，就可以儲存。';
  }
  function validateCarrier(){
    const normalized=C.normalize($('carrier').value);
    state.carrier=normalized;
    if($('carrier').value!==normalized){const input=$('carrier'),position=input.selectionStart,delta=normalized.length-input.value.length;input.value=normalized;input.setSelectionRange(Math.max(0,position+delta),Math.max(0,position+delta));}
    const valid=C.valid(normalized), status=$('carrier-status');
    status.className='field-status'+(valid?' success':normalized?' error':'');
    $('carrier').setAttribute('aria-invalid',String(Boolean(normalized&&!valid)));
    status.textContent=valid?'格式正確。請核對這是你已申請的載具號碼。':!normalized?'輸入「/」加 7 碼；也可以直接貼上後 7 碼。':!/^\/[0-9A-Z.+-]*$/.test(normalized)?'只接受大寫英文、數字，以及 . - +，請檢查字元。':`「/」後需要 7 碼，目前是 ${normalized.length-1} 碼。`;
    try{if($('remember').checked&&valid)localStorage.setItem(STORAGE,normalized);else localStorage.removeItem(STORAGE);}catch{if($('remember').checked){$('remember').checked=false;toast('瀏覽器無法儲存號碼，仍可正常製作圖片。');}}
    syncExport();requestRender();
  }
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
  function fitPreview(){
    const stage=$('stage'), maxW=stage.clientWidth-62;
    const maxH=matchMedia('(max-width:650px)').matches?430:Math.max(400,Math.min(530,innerHeight-290));
    const width=Math.min(maxW,maxH*state.ratio),height=width/state.ratio;
    $('canvas-wrap').style.width=width+'px';$('canvas-wrap').style.height=height+'px';
    stage.style.minHeight=(maxH+58)+'px';
  }
  function render(){
    const {width,height}=outputSize();
    const previewScale=Math.min(1,1400/Math.max(width,height));
    const previewWidth=Math.round(width*previewScale),previewHeight=Math.round(height*previewScale);
    if(canvas.width!==previewWidth||canvas.height!==previewHeight){canvas.width=previewWidth;canvas.height=previewHeight;}
    try{lastBarcodeBox=draw(ctx,previewWidth,previewHeight);}catch(error){$('export-status').textContent=error.message;$('export').disabled=true;}
    fitPreview();
    $('dimensions').textContent=`${width} × ${height} px`;
    $('ratio-display').textContent=C.ratioText(state.ratio);
    $('preview-label').textContent=C.valid(state.carrier)?'即時預覽':'示意預覽 · 尚未輸入載具';
    const card=C.cardRect(width,height,state),outline=$('card-outline');
    state.cardX=(card.x+card.w/2)/width;state.cardY=(card.y+card.h/2)/height;
    Object.assign(outline.style,{left:card.x/width*100+'%',top:card.y/height*100+'%',width:card.w/width*100+'%',height:card.h/height*100+'%'});
    updateOverlay();updateEditorUI();renderGuides();
  }
  function updateOverlay(){
    const show=state.size==='phone'&&state.overlay!=='none';
    $('phone-overlay').hidden=!show;$('phone-overlay').classList.toggle('home',state.overlay==='home');
    $('overlay-controls').hidden=state.size!=='phone';
  }
  function resetComposition(){
    state.panX=0;state.panY=0;state.zoom=1;$('zoom').value=100;$('zoom-value').textContent='100%';
    if(!customCardScale)state.cardScale=state.ratio>1?.66:.84;state.cardX=.5;state.cardY=state.size==='phone'?.74:.77;
    if(state.layout==='side'){state.cardScale=.64;state.cardX=.655;state.cardY=.5;}
    if(state.layout==='bottom'||state.layout==='contain')state.cardY=1;
    $('card-size').value=state.cardScale*100;$('card-size-value').textContent=Math.round(state.cardScale*100)+'%';
  }
  function setMode(mode){
    if(mode==='ratio'&&state.size!=='custom')setSize('custom',true);
    cancelGesture();clearGuides();state.mode=mode;pressed('[data-mode]','mode',mode);
    $('handles').hidden=mode!=='ratio';$('card-outline').hidden=mode!=='barcode';
    $('canvas-wrap').className='canvas-wrap mode-'+mode;
    $('gesture-hint').textContent={photo:'拖曳移動・滾輪或雙指縮放。方向鍵 1 px，Shift＋方向鍵 10 px；Alt 暫停吸附。',barcode:'拖曳卡片會吸附對齊。方向鍵 1 px，Shift＋方向鍵 10 px；Alt 暫停吸附。',ratio:'拖曳邊緣或角落改比例，接近常用比例會吸附。方向鍵以 1 px 調整寬高，Shift 為 10 px。'}[mode];updateEditorUI();
  }
  function syncRatioFields(){
    const parts=C.ratioText(state.ratio).split(' : ');$('ratio-w').value=parts[0];$('ratio-h').value=parts[1];
  }
  function setSize(size,keepRatio=false){
    clearGuides();
    state.size=size;pressed('[data-size]','size',size);
    $('phone-options').hidden=size!=='phone';$('ratio-options').hidden=size!=='custom';
    $('size-status').textContent='系統自動配置清晰的輸出尺寸。';
    if(size==='phone')setDevice(false);
    else if(size==='original'){
      const imageRatio=state.image?(state.rotation%180?state.image.height/state.image.width:state.image.width/state.image.height):1;
      state.ratio=imageRatio;
      // Preserve extreme original ratios by adding canvas breathing room instead of cutting off the subject.
      if(imageRatio<C.MIN_RATIO||imageRatio>C.MAX_RATIO){state.ratio=C.clamp(imageRatio,C.MIN_RATIO,C.MAX_RATIO);state.layout='contain';$('layout').value='contain';$('size-status').textContent='原圖較狹長，已加上底色留白以保留完整圖片與條碼空間。';}
    }else if(size==='custom'){
      if(keepRatio)state.customRatio=state.ratio;
      state.ratio=C.clamp(state.customRatio,C.MIN_RATIO,C.MAX_RATIO);ratioStart=state.ratio;syncRatioFields();
    }else if(size==='portrait'||size==='landscape'){
      const print=C.printCard(size);state.ratio=print.width/print.height;
      $('size-status').textContent=`悠遊卡標準尺寸 ${size==='portrait'?'5.4 × 8.6':'8.6 × 5.4'} cm · ${print.width} × ${print.height} px · 約 750 dpi`;
    }else state.ratio={square:1}[size];
    if(size!=='custom'&&state.mode==='ratio')setMode('photo');
    // Side-by-side works only with a sufficiently wide canvas.
    if(state.ratio<1.2&&state.layout==='side'){state.layout='bottom';$('layout').value='bottom';}
    $('fit').disabled=state.layout==='contain';$('fit').value=state.layout==='contain'?'contain':state.fit;
    if(!keepRatio)resetComposition();
    requestRender();
  }
  function setDevice(reset=true){
    const value=$('device').value;
    if(value==='current'){
      const dpr=window.devicePixelRatio||1;
      const w=Math.min(screen.width,screen.height),h=Math.max(screen.width,screen.height);
      const ratio=C.clamp(w/h,C.MIN_RATIO,1);
      const long=C.clamp(Math.round(h*dpr),1800,3200);
      state.phone=[Math.round(long*ratio),long];
      $('size-status').textContent='依螢幕資訊估算，可能與實際桌布解析度不同；電腦上建議選擇手機型號。';
    }else state.phone=value==='generic'?[1080,2340]:value.split(',').map(Number);
    state.ratio=state.phone[0]/state.phone[1];if(reset)resetComposition();requestRender();
  }
  function applyRatio(ratio,snap=false){
    if(!Number.isFinite(ratio)||ratio<=0){$('size-status').textContent='寬與高都需要是大於 0 的數字。';return false;}
    const limit=C.clamp(ratio,C.MIN_RATIO,C.MAX_RATIO);
    state.ratio=snap?C.snapRatio(limit):limit;state.customRatio=state.ratio;
    $('size-status').textContent=ratio!==limit?'已限制過於狹長的比例，確保條碼有足夠空間。':'尺寸自動計算，條碼不會隨畫布變形。';
    if(state.ratio<1.2&&state.layout==='side'){state.layout='bottom';$('layout').value='bottom';resetComposition();}
    requestRender();return true;
  }
  function photoWarning(){
    if(!state.image)return;
    const {width,height}=outputSize(),r=C.photoRect(width,height,state.layout);
    const rotated=state.rotation%180,iw=rotated?state.image.height:state.image.width,ih=rotated?state.image.width:state.image.height;
    const scale=(state.fit==='contain'||state.layout==='contain'?Math.min(r.w/iw,r.h/ih):Math.max(r.w/iw,r.h/ih))*state.zoom;
    if(scale>1.5)toast('照片解析度較小，放大後可能模糊；條碼仍會清晰繪製。');
  }
  async function loadImage(source,name,id,color,temporary=false,keepTransform=false){
    const token=++loadToken;state.loading=true;syncExport();
    try{
      const image=new Image();image.src=source;await image.decode();
      if(token!==loadToken)return;
      // Downsample very large photos once so repeated editing is light on mobile memory.
      const maxSide=4096, scale=Math.min(1,maxSide/Math.max(image.naturalWidth,image.naturalHeight));
      // Freeze one frame too: animated uploads must not change between preview and export.
      const small=document.createElement('canvas');small.width=Math.round(image.naturalWidth*scale);small.height=Math.round(image.naturalHeight*scale);small.getContext('2d').drawImage(image,0,0,small.width,small.height);state.image=small;
      state.imageName=name;state.imageId=id;if(!keepTransform)state.rotation=0;
      if(color){state.background=color;$('background').value=color;}
      if(!keepTransform){state.panX=0;state.panY=0;state.zoom=1;clearGuides();}
      if(state.size==='original'&&!keepTransform)setSize('original');
      document.querySelectorAll('.gallery-item').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.image===id)));
      $('file-name').textContent=id?'':name;
      photoWarning();requestRender();
    }catch{if(token===loadToken)toast('無法讀取這張圖片。若是 HEIC／HEIF，請先轉成 JPG 或 PNG 再試一次。');}
    finally{if(temporary)URL.revokeObjectURL(source);if(token===loadToken){state.loading=false;syncExport();}}
  }
  function upload(file){
    if(!file)return;
    if(file.size>30*1024*1024){toast('圖片超過 30 MB，請先縮小檔案。');return;}
    if(!/^image\/(jpeg|png|webp|avif|gif|heic|heif)$/.test(file.type)&&!(/\.(jpe?g|png|webp|avif|gif|heic|heif)$/i.test(file.name)&&!file.type)){toast('請選擇 JPG、PNG、WebP、AVIF 或 GIF 圖片。');return;}
    picker.reset();loadImage(URL.createObjectURL(file),file.name,null,null,true);
  }
  function buildGallery(){
    $('gallery').replaceChildren();
    gallery.forEach(item=>{
      const button=document.createElement('button');button.className='gallery-item';button.dataset.image=item.id;button.setAttribute('aria-pressed',String(state.imageId===item.id));button.setAttribute('aria-label',item.name+(item.kind==='pattern-group'?'，再次點選切換圖案':item.kind==='generative'?'，再次點選換色':item.kind==='illustration'?' 插畫':' 圖樣'));
      const img=document.createElement('img');img.src=item.thumbSrc||item.src;img.alt='';img.width=200;img.height=200;
      const label=document.createElement('span');label.textContent=item.name+(item.kind==='generative'||item.kind==='pattern-group'?' ↻':'');
      if(item.kind==='generative'){
        const crop=document.createElement('div');crop.className='artwork-thumb-crop';crop.append(img);button.append(crop,label);
      }else button.append(img,label);
      button.onclick=()=>picker.select(item,img,button);$('gallery').append(button);
    });
  }
  function initHandles(){
    const handles={nw:[0,0],n:[50,0],ne:[100,0],e:[100,50],se:[100,100],s:[50,100],sw:[0,100],w:[0,50]};
    const names={nw:'左上角',n:'上邊',ne:'右上角',e:'右邊',se:'右下角',s:'下邊',sw:'左下角',w:'左邊'};
    Object.entries(handles).forEach(([key,[x,y]])=>{const el=document.createElement('button');el.className='handle';el.dataset.handle=key;el.style.left=x+'%';el.style.top=y+'%';el.setAttribute('aria-label',`拖拉${names[key]}調整比例，亦可使用方向鍵`);$('handles').append(el);});
  }
  function minZoom(){return (state.layout==='contain'||state.fit==='contain') ? .25 : 1;}
  function updateEditorUI(){
    const hasImage=Boolean(state.image),photoMode=state.mode==='photo';
    $('empty-photo').hidden=hasImage;
    $('zoom').disabled=!hasImage;$('zoom').min=minZoom()*100;
    $('zoom').value=Math.round(state.zoom*100);
    $('zoom-value').textContent=$('canvas-zoom-value').textContent=Math.round(state.zoom*100)+'%';
    $('zoom-in').disabled=!hasImage||!photoMode||state.zoom>=4;
    $('zoom-out').disabled=!hasImage||!photoMode||state.zoom<=minZoom();
    $('rotate').disabled=$('reset-photo').disabled=!hasImage;
    const {width,height}=outputSize(),g=C.photoGeometry(width,height,state),card=C.cardRect(width,height,state);
    if(g){state.panX=g.panX;state.panY=g.panY;}
    const readout=$('edit-readout');
    const x=state.mode==='barcode'?card.x:g?g.panX*g.area.w:0;
    const y=state.mode==='barcode'?card.y:g?g.panY*g.area.h:0;
    readout.dataset.x=x.toFixed(4);readout.dataset.y=y.toFixed(4);
    readout.textContent=state.mode==='ratio'?`寬高比 ${C.ratioText(state.ratio)} · 輸出尺寸自動配置`:state.mode==='photo'&&!g?'選擇圖片後，可直接在畫板移動與縮放':`${state.mode==='barcode'?'條碼位置':'圖片位移'} X ${Math.round(x)} · Y ${Math.round(y)} px（輸出像素）`;
  }
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
    if($('alignment-snap').checked){
      for(const axis of ['x','y']){
        const value=guides[axis];
        if(value!==null&&C.rectAnchors(rect,axis).some(n=>Math.abs(n-value)<.05))activeGuides[axis]=value;
      }
    }
    renderGuides();
  }
  function alignedRect(rect,kind,magnetic=true,alt=false){
    if(!$('alignment-snap').checked||alt)return {...rect,guides:{x:null,y:null}};
    const {width,height}=outputSize(),area=C.photoRect(width,height,state.layout);
    const other=kind==='photo'?C.cardRect(width,height,state):C.photoGeometry(width,height,state);
    const targets=C.alignmentTargets(width,height,area,other);
    // Screen-pixel threshold gives the same magnetic feel on a phone and desktop.
    // Keyboard moves only display exact alignments, never override the requested 1 px step.
    const threshold=magnetic?6*width/$('canvas-wrap').getBoundingClientRect().width:.0001;
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
  function canvasPoint(point,rect=$('canvas-wrap').getBoundingClientRect()){
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
    const rect=$('canvas-wrap').getBoundingClientRect();
    const delta=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?rect.height:1);
    const factor=Math.exp(-C.clamp(delta,-200,200)*(event.ctrlKey ? .008 : .002));
    setZoom(state.zoom*factor,canvasPoint({x:event.clientX,y:event.clientY},rect),event.altKey);
  }
  function beginDrag(id,point,handle){
    const rect=$('canvas-wrap').getBoundingClientRect(),{width,height}=outputSize();
    const g=C.photoGeometry(width,height,state),card=C.cardRect(width,height,state);
    gesture={kind:'drag',id,x:point.x,y:point.y,rect,handle,mode:state.mode,
      photoX:g?.cx,photoY:g?.cy,cardX:card.x+card.w/2,cardY:card.y+card.h/2};
  }
  function beginPinch(){
    const [a,b]=[...pointers.values()],rect=$('canvas-wrap').getBoundingClientRect(),{width,height}=outputSize();
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
    (handle||$('canvas-wrap')).focus({preventScroll:true});
    // Some WebViews may decline capture. The same handlers still work within the canvas.
    try{$('canvas-wrap').setPointerCapture(event.pointerId);}catch{}
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
      const raw=w/nextH,snap=$('snap').checked&&!event.altKey;
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
    if($('canvas-wrap').hasPointerCapture(event.pointerId))$('canvas-wrap').releasePointerCapture(event.pointerId);
    if(wasPinch&&pointers.size){const [id,point]=[...pointers.entries()][0];beginDrag(id,point);}
    else if(!pointers.size){gesture=null;expireGuides();}
  }
  function cancelGesture(){
    const ids=[...pointers.keys()];pointers.clear();gesture=null;
    for(const id of ids)if($('canvas-wrap').hasPointerCapture(id))$('canvas-wrap').releasePointerCapture(id);
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
  async function createImage(backup){
    const size=backup?{width:1800,height:720}:outputSize(),result=document.createElement('canvas');result.width=size.width;result.height=size.height;
    const context=result.getContext('2d',{willReadFrequently:true}),box=draw(context,size.width,size.height,{backup});
    const mimeType=!backup&&isPrintCard()?'image/jpeg':'image/png';
    let blob=await new Promise((resolve,reject)=>result.toBlob(b=>b?resolve(b):reject(new Error('無法產生圖片，請重新嘗試。')),mimeType,mimeType==='image/jpeg'?.96:undefined));
    if(mimeType==='image/jpeg')blob=await C.jpegAtDpi(blob,C.EASY_CARD.dpi);
    // Reopen the actual exported image; verify the saved pixels, not only the live preview.
    const url=URL.createObjectURL(blob);
    try{
      const image=new Image();image.src=url;await image.decode();context.clearRect(0,0,result.width,result.height);context.drawImage(image,0,0);
      if(!C.verifyCanvas(result,box,state.carrier))throw new Error('成品條碼與輸入不一致，請調整後再試。');
    }catch(error){URL.revokeObjectURL(url);throw error;}
    return {blob,url,width:size.width,height:size.height,backup,mimeType,bytes:blob.size};
  }
  function appendResult(result){
    resultURLs.push(result.url);
    const extension=result.mimeType==='image/jpeg'?'jpg':'png';
    const name=result.backup?'invoice-barcode.png':`invoice-${isPrintCard()?'easycard':'wallpaper'}.${extension}`;
    const section=document.createElement('section');section.className='result-card';
    const img=document.createElement('img');img.src=result.url;img.alt=result.backup?'純條碼備用卡':'合成圖片';
    const title=document.createElement('h3');title.textContent=(result.backup?'純條碼備用卡':isPrintCard()?'悠遊卡印刷 JPG':'你的合成圖片')+` · ${result.width} × ${result.height}${!result.backup&&isPrintCard()?` · ${C.EASY_CARD.dpi} dpi`:''}`;
    const actions=document.createElement('div');actions.className='result-actions';
    const download=document.createElement('a');download.href=result.url;download.download=name;download.textContent='下載 '+extension.toUpperCase();
    const open=document.createElement('a');open.href=result.url;open.target='_blank';open.rel='noopener';open.textContent='開啟原圖';
    actions.append(download,open);
    const file=new File([result.blob],name,{type:result.mimeType});
    if(navigator.canShare?.({files:[file]})){
      const share=document.createElement('button');share.textContent='分享圖片';share.onclick=async()=>{try{await navigator.share({files:[file],title:'我的載具圖片'});}catch(error){if(error.name!=='AbortError')toast('目前無法分享，請改用下載或開啟原圖。');}};actions.append(share);
    }
    section.append(img,title,actions);
    if(!result.backup&&isPrintCard()){
      const note=document.createElement('p');note.className='small-note';note.textContent=`${(result.bytes/1024).toFixed(1)} KB · 4,051,300 畫素（符合 400 萬畫素條件）`;section.append(note);
    }
    $('export-results').append(section);
  }
  async function exportImages(){
    if(!C.valid(state.carrier)||!state.image||state.loading||exportBusy)return;
    exportBusy=true;syncExport();document.querySelector('.workspace').inert=true;$('export').textContent='正在檢查圖片…';
    const completed=[];
    try{
      completed.push(await createImage(false));if($('backup').checked)completed.push(await createImage(true));
      resultURLs.forEach(url=>URL.revokeObjectURL(url));resultURLs=[];$('export-results').replaceChildren();completed.forEach(appendResult);
      $('verified').textContent='✓ 已從輸出的圖片還原條碼，與輸入的載具號碼一致。';
      $('export-dialog').showModal();
    }catch(error){completed.forEach(item=>URL.revokeObjectURL(item.url));toast(error.message||'圖片儲存失敗，請重新嘗試。');}
    finally{exportBusy=false;document.querySelector('.workspace').inert=false;$('export').replaceChildren(document.createTextNode('儲存圖片 '));const arrow=document.createElement('span');arrow.textContent='↓';$('export').append(arrow);syncExport();}
  }
  function init(){
    buildGallery();initHandles();
    for(let i=0;i<24;i++)$('phone-overlay').querySelector('.app-icons').append(document.createElement('i'));
    ['#e9e2d1','#e8d9d2','#dfe6d7','#dce4e2','#dce0e9','#f6f3eb','#d9c7b5'].forEach(color=>{const button=document.createElement('button');button.style.background=color;button.setAttribute('aria-label','底色 '+color);button.onclick=()=>{state.background=color;$('background').value=color;requestRender();};$('swatches').append(button);});
    document.querySelectorAll('[data-source]').forEach(button=>button.onclick=()=>{pressed('[data-source]','source',button.dataset.source);$('gallery-panel').hidden=button.dataset.source!=='gallery';$('upload-panel').hidden=button.dataset.source!=='upload';if(button.dataset.source==='gallery')window.prepareInvoiceArtworkGallery($('gallery'));});
    document.querySelectorAll('[data-size]').forEach(button=>button.onclick=()=>{setSize(button.dataset.size);if(button.dataset.size==='custom')setMode('ratio');});
    document.querySelectorAll('[data-mode]').forEach(button=>button.onclick=()=>setMode(button.dataset.mode));
    document.querySelectorAll('[data-position]').forEach(button=>button.onclick=()=>{const {width,height}=outputSize();moveCard(state.cardX*width,{top:0,center:height/2,bottom:height}[button.dataset.position]);expireGuides();});
    $('carrier').addEventListener('input',event=>{if(!event.isComposing)validateCarrier();});$('carrier').addEventListener('compositionend',validateCarrier);
    $('remember').onchange=validateCarrier;
    $('forget').onclick=()=>{$('carrier').value='';$('remember').checked=false;resultURLs.forEach(url=>URL.revokeObjectURL(url));resultURLs=[];$('export-results').replaceChildren();validateCarrier();toast('已清除載具號碼與這台裝置上的記錄。');};
    $('file-input').onchange=event=>{upload(event.target.files[0]);event.target.value='';};
    $('drop-zone').ondragover=event=>{event.preventDefault();$('drop-zone').classList.add('dragover');};
    $('drop-zone').ondragleave=()=>$('drop-zone').classList.remove('dragover');
    $('drop-zone').ondrop=event=>{event.preventDefault();$('drop-zone').classList.remove('dragover');upload(event.dataTransfer.files[0]);};
    $('device').onchange=()=>setDevice();
    ['ratio-w','ratio-h'].forEach(id=>{$(id).oninput=()=>{const w=Number($('ratio-w').value),h=Number($('ratio-h').value);if(w>0&&h>0)applyRatio(w/h);else $('size-status').textContent='寬與高都需要是大於 0 的數字。';};$(id).onchange=()=>syncRatioFields();});
    $('swap-ratio').onclick=()=>{applyRatio(1/state.ratio);syncRatioFields();};
    $('reset-ratio').onclick=()=>{applyRatio(ratioStart);syncRatioFields();};
    $('layout').onchange=()=>{state.layout=$('layout').value;if(state.layout==='side'&&state.ratio<1.2){setSize('landscape');toast('左右分欄已套用橫式畫布，可在下一步調整比例。');}$('fit').disabled=state.layout==='contain';$('fit').value=state.layout==='contain'?'contain':state.fit;resetComposition();requestRender();};
    $('fit').onchange=()=>{state.fit=$('fit').value;state.zoom=Math.max(minZoom(),state.zoom);state.panX=0;state.panY=0;requestRender();};
    $('background').oninput=()=>{state.background=$('background').value;requestRender();};
    $('zoom').oninput=()=>setZoom(Number($('zoom').value)/100);
    $('zoom-in').onclick=()=>setZoom(state.zoom+.1);$('zoom-out').onclick=()=>setZoom(state.zoom-.1);
    $('alignment-snap').onchange=clearGuides;
    $('zoom').onchange=photoWarning;
    $('rotate').onclick=()=>{state.rotation=(state.rotation+90)%360;state.panX=0;state.panY=0;if(state.size==='original')setSize('original');requestRender();};
    $('reset-photo').onclick=()=>{state.rotation=0;state.panX=0;state.panY=0;state.zoom=1;$('zoom').value=100;$('zoom-value').textContent='100%';if(state.size==='original')setSize('original');requestRender();};
    $('card-size').oninput=()=>{customCardScale=true;state.cardScale=Number($('card-size').value)/100;$('card-size-value').textContent=$('card-size').value+'%';requestRender();};
    $('radius').oninput=()=>{state.radius=Number($('radius').value);$('radius-value').textContent=state.radius===0?'直角':state.radius<20?'適中':'圓潤';requestRender();};
    $('card-title').oninput=()=>{state.title=$('card-title').value;requestRender();};
    $('overlay').onchange=()=>{state.overlay=$('overlay').value;updateOverlay();};
    $('canvas-wrap').addEventListener('pointerdown',onPointerDown);$('canvas-wrap').addEventListener('pointermove',onPointerMove);
    ['pointerup','pointercancel','lostpointercapture'].forEach(type=>$('canvas-wrap').addEventListener(type,stopPointer));
    $('canvas-wrap').addEventListener('keydown',onCanvasKey);
    $('canvas-wrap').addEventListener('wheel',onWheel,{passive:false});
    window.addEventListener('blur',cancelGesture);
    document.addEventListener('visibilitychange',()=>{if(document.hidden)cancelGesture();});
    $('export').onclick=exportImages;$('mobile-export').onclick=exportImages;$('close-dialog').onclick=()=>$('export-dialog').close();
    $('export-dialog').addEventListener('click',event=>{if(event.target===$('export-dialog')){const r=$('export-dialog').getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)$('export-dialog').close();}});
    new ResizeObserver(fitPreview).observe($('stage'));window.addEventListener('resize',fitPreview);
    try{const saved=localStorage.getItem(STORAGE);if(saved&&C.valid(saved)){$('carrier').value=saved;$('remember').checked=true;}}catch{/* Private mode can disable storage. */}
    validateCarrier();setSize('phone');updateEditorUI();
  }
  init();
})();
