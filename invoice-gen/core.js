/* Code 39: ISO/IEC 16388, narrow:wide = 1:3, no optional checksum.
   Classic script so this tool also works when opened directly from disk. */
(function (root) {
  'use strict';
  const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ-. $/+%';
  const patterns = [0x034,0x121,0x061,0x160,0x031,0x130,0x070,0x025,0x124,0x064,0x109,0x049,0x148,0x019,0x118,0x058,0x00d,0x10c,0x04c,0x01c,0x103,0x043,0x142,0x013,0x112,0x052,0x007,0x106,0x046,0x016,0x181,0x0c1,0x1c0,0x091,0x190,0x0d0,0x085,0x184,0x0c4,0x0a8,0x0a2,0x08a,0x02a];
  const table = Object.fromEntries([...alphabet].map((c, i) => [c, patterns[i]]));
  table['*'] = 0x094;
  const reverse = Object.fromEntries(Object.entries(table).map(([c, p]) => [p, c]));
  const MIN_RATIO = 0.42, MAX_RATIO = 2.4;
  const EASY_CARD = Object.freeze({widthCm:5.4,heightCm:8.6,dpi:750,portraitWidth:1595,portraitHeight:2540,landscapeWidth:2540,landscapeHeight:1595});
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  function normalize(value) {
    let result = value.normalize('NFKC').trim().toUpperCase();
    if (result && !result.startsWith('/')) result = '/' + result;
    return result;
  }
  function valid(value) { return /^\/[0-9A-Z.+-]{7}$/.test(value); }
  function dimensions(ratio, phone) {
    if (phone) return { width: phone[0], height: phone[1] };
    return ratio >= 1 ? { width: 1800, height: Math.round(1800 / ratio) } : { width: Math.round(1800 * ratio), height: 1800 };
  }
  function printCard(orientation) {
    return orientation==='portrait'
      ? {width:EASY_CARD.portraitWidth,height:EASY_CARD.portraitHeight}
      : {width:EASY_CARD.landscapeWidth,height:EASY_CARD.landscapeHeight};
  }
  async function jpegAtDpi(blob,dpi=EASY_CARD.dpi) {
    const bytes=new Uint8Array(await blob.arrayBuffer());
    // Canvas usually emits a JFIF density record. Set units to dots per inch
    // and preserve the requested print density in the exported JPEG.
    for(let i=2;i<Math.min(bytes.length-18,64);i++) {
      if(bytes[i]===0xff&&bytes[i+1]===0xe0&&bytes[i+4]===0x4a&&bytes[i+5]===0x46&&bytes[i+6]===0x49&&bytes[i+7]===0x46&&bytes[i+8]===0) {
        bytes[i+11]=1;bytes[i+12]=dpi>>8;bytes[i+13]=dpi&255;bytes[i+14]=dpi>>8;bytes[i+15]=dpi&255;
        return new Blob([bytes],{type:'image/jpeg'});
      }
    }
    if(bytes[0]===0xff&&bytes[1]===0xd8){
      const jfif=new Uint8Array([0xff,0xe0,0,16,0x4a,0x46,0x49,0x46,0,1,1,1,dpi>>8,dpi&255,dpi>>8,dpi&255,0,0]);
      return new Blob([bytes.slice(0,2),jfif,bytes.slice(2)],{type:'image/jpeg'});
    }
    throw new Error('無法為 JPG 設定印刷解析度，請重新匯出。');
  }
  function ratioText(ratio) {
    const pairs = [[1,1],[3,2],[2,3],[4,3],[3,4],[16,9],[9,16],[9,19.5],[9,20],[6,13]];
    const match = pairs.find(([w,h]) => Math.abs(w/h-ratio)<0.0005);
    return match ? `${match[0]} : ${match[1]}` : `${+(ratio.toFixed(4))} : 1`;
  }
  function snapRatio(ratio) {
    const ratios = [1, 3/2, 2/3, 4/3, 3/4, 16/9, 9/16];
    return ratios.find(r => Math.abs(ratio-r)/r < .025) || ratio;
  }
  function cardRect(width, height, state) {
    const margin = Math.max(18, width * .035);
    const maxWidth = Math.min(width - 2*margin, (height - 2*margin)/.40);
    const w = Math.min(width * state.cardScale, maxWidth);
    const h = w * .40;
    const x = clamp(state.cardX * width - w/2, margin, width-margin-w);
    const y = clamp(state.cardY * height - h/2, margin, height-margin-h);
    return {x, y, w, h};
  }
  function photoRect(width, height, layout) {
    if (layout === 'bottom' || layout === 'contain') return {x:0,y:0,w:width,h:Math.max(height*.24,height-width*.40)};
    if (layout === 'side') return {x:0,y:0,w:width*.29,h:height};
    return {x:0,y:0,w:width,h:height};
  }
  // All editor geometry uses output pixels, independent of preview size or device DPR.
  function photoGeometry(width, height, state) {
    if (!state.image) return null;
    const area = photoRect(width, height, state.layout);
    const rotated = state.rotation % 180 !== 0;
    const iw = rotated ? state.image.height : state.image.width;
    const ih = rotated ? state.image.width : state.image.height;
    const contain = state.layout === 'contain' || state.fit === 'contain';
    const base = contain ? Math.min(area.w / iw, area.h / ih) : Math.max(area.w / iw, area.h / ih);
    const scale = base * state.zoom, w = iw * scale, h = ih * scale;
    const limitX = contain ? area.w : Math.max(0, (w - area.w) / 2);
    const limitY = contain ? area.h : Math.max(0, (h - area.h) / 2);
    const dx = clamp(state.panX * area.w, -limitX, limitX);
    const dy = clamp(state.panY * area.h, -limitY, limitY);
    const cx = area.x + area.w / 2 + dx, cy = area.y + area.h / 2 + dy;
    return {area, x:cx-w/2, y:cy-h/2, w, h, cx, cy, scale, panX:dx/area.w, panY:dy/area.h};
  }
  function zoomCenter(geometry, oldZoom, newZoom, anchor, movedAnchor=anchor) {
    const factor = newZoom / oldZoom;
    return {x:movedAnchor.x-(anchor.x-geometry.cx)*factor, y:movedAnchor.y-(anchor.y-geometry.cy)*factor};
  }
  function rectAnchors(rect, axis) {
    const start = axis === 'x' ? rect.x : rect.y, size = axis === 'x' ? rect.w : rect.h;
    return [start + size / 2, start, start + size];
  }
  function snapRect(rect, targets, threshold) {
    const result = {...rect, guides:{x:null,y:null}};
    for (const axis of ['x','y']) {
      let nearest = null;
      for (const anchor of rectAnchors(rect, axis)) {
        for (const target of targets[axis]) {
          const delta = target - anchor;
          if (Math.abs(delta) <= threshold && (!nearest || Math.abs(delta) < Math.abs(nearest.delta))) nearest = {delta, target};
        }
      }
      if (nearest) {result[axis] += nearest.delta;result.guides[axis] = nearest.target;}
    }
    return result;
  }
  function alignmentTargets(width, height, area, other) {
    const margin = Math.max(18, width * .035);
    const targets = {
      x:[width/2,margin,width-margin,...rectAnchors(area,'x')],
      y:[height/2,margin,height-margin,...rectAnchors(area,'y')]
    };
    if (other) for (const axis of ['x','y']) targets[axis].push(...rectAnchors(other,axis));
    for (const axis of ['x','y']) targets[axis] = [...new Set(targets[axis])].filter(n=>n>=0&&n<=(axis==='x'?width:height));
    return targets;
  }
  function drawBarcode(ctx, value, box) {
    if (!valid(value)) throw new Error('載具格式不正確');
    const codes = '*' + value + '*';
    const units = codes.length*15 + codes.length-1;
    const narrow = Math.floor(box.w/(units+20));
    if (narrow < 2) throw new Error('條碼空間不足，請放大卡片');
    const totalWidth = units*narrow;
    let x = Math.round(box.x+(box.w-totalWidth)/2);
    const y = Math.round(box.y), h = Math.round(box.h);
    const startX = x;
    ctx.fillStyle='#fff';ctx.fillRect(Math.floor(box.x),y,Math.ceil(box.w),h);
    ctx.fillStyle='#000';
    for (const character of codes) {
      const p = table[character];
      for(let i=0;i<9;i++) {
        const span = narrow * ((p & (1 << (8-i))) ? 3 : 1);
        if(i%2===0) ctx.fillRect(x,y,span,h);
        x += span;
      }
      x += narrow;
    }
    return {x:startX,y,w:totalWidth,h,narrow,quietLeft:startX-box.x,quietRight:box.x+box.w-startX-totalWidth};
  }
  // Decode actual black/white pixels in the final composition, not the input string.
  // This verifies raster integrity; independent scanner tests are still necessary.
  function decodeRow(ctx, box, fraction) {
    const x = Math.floor(box.x), width = Math.floor(box.w), y = Math.round(box.y+box.h*fraction);
    const pixels = ctx.getImageData(x,y,width,1).data;
    const bits = Array.from({length:width},(_,i)=>pixels[i*4]<128 && pixels[i*4+1]<128 && pixels[i*4+2]<128);
    const first=bits.indexOf(true),last=bits.lastIndexOf(true);
    if(first<0) throw new Error('找不到條碼');
    const runs=[];let previous=true, length=0;
    for(let i=first;i<=last;i++) {if(bits[i]===previous) length++;else{runs.push(length);length=1;previous=bits[i];}}
    runs.push(length);
    const unit=Math.min(...runs);
    if (first < unit*10-1 || width-1-last < unit*10-1) throw new Error('條碼左右留白不足');
    if(runs.length!==99) throw new Error('條碼線條不完整');
    let result='';
    for(let offset=0;offset<runs.length;offset+=10) {
      let pattern=0;
      for(let i=0;i<9;i++) {
        const size=runs[offset+i]/unit;
        if(Math.abs(size-1)>.15 && Math.abs(size-3)>.15) throw new Error('條碼線條比例不正確');
        if(size>2) pattern|=1<<(8-i);
      }
      if(offset+9<runs.length && Math.abs(runs[offset+9]/unit-1)>.15) throw new Error('條碼字元間距不正確');
      if(reverse[pattern]===undefined) throw new Error('無法還原條碼');
      result+=reverse[pattern];
    }
    if(result[0]!=='*'||result.at(-1)!=='*') throw new Error('條碼起訖不完整');
    return result.slice(1,-1);
  }
  function verifyCanvas(canvas, box, expected) {
    const ctx=canvas.getContext('2d',{willReadFrequently:true});
    return [.2,.5,.8].every(f=>decodeRow(ctx,box,f)===expected);
  }
  const api={normalize,valid,dimensions,printCard,jpegAtDpi,EASY_CARD,ratioText,snapRatio,clamp,cardRect,photoRect,photoGeometry,zoomCenter,rectAnchors,snapRect,alignmentTargets,drawBarcode,verifyCanvas,MIN_RATIO,MAX_RATIO};
  root.InvoiceCore=api;
  if(typeof module!=='undefined'&&module.exports) module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:window);
