/* Run: node invoice-gen/tests/core.test.cjs [temporary-fixture-directory] */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const zlib = require('node:zlib');
const C = require('../core.js');
let assertions = 0;
function check(condition, message) { assert.ok(condition, message); assertions++; }

// Minimal in-memory raster surface: it exercises real raster encoding and reading,
// without claiming to simulate browser layout or native Canvas behavior.
class Raster {
  constructor(width, height) { this.width=width;this.height=height;this.pixels=new Uint8Array(width*height).fill(255);this.fillStyle='#fff'; }
  getContext() { return this; }
  fillRect(x,y,w,h) {
    const value=this.fillStyle==='#000'?0:255;
    for(let yy=Math.max(0,Math.floor(y));yy<Math.min(this.height,Math.ceil(y+h));yy++)
      this.pixels.fill(value,yy*this.width+Math.max(0,Math.floor(x)),yy*this.width+Math.min(this.width,Math.ceil(x+w)));
  }
  getImageData(x,y,w,h) {
    const data=new Uint8ClampedArray(w*h*4);
    for(let j=0;j<h;j++)for(let i=0;i<w;i++){const index=(j*w+i)*4,value=this.pixels[(y+j)*this.width+x+i];data[index]=data[index+1]=data[index+2]=value;data[index+3]=255;}
    return {data};
  }
}
function png(raster) {
  const crc32=buffer=>{let crc=0xffffffff;for(const byte of buffer){crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;};
  const chunk=(type,data)=>{const name=Buffer.from(type),length=Buffer.alloc(4),crc=Buffer.alloc(4);length.writeUInt32BE(data.length);crc.writeUInt32BE(crc32(Buffer.concat([name,data])));return Buffer.concat([length,name,data,crc]);};
  const header=Buffer.alloc(13);header.writeUInt32BE(raster.width,0);header.writeUInt32BE(raster.height,4);header[8]=8;header[9]=0;
  const raw=Buffer.alloc((raster.width+1)*raster.height);
  for(let y=0;y<raster.height;y++)Buffer.from(raster.pixels.subarray(y*raster.width,(y+1)*raster.width)).copy(raw,y*(raster.width+1)+1);
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',zlib.deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]);
}
check(C.normalize(' abc+123 ') === '/ABC+123','Normalize pasted short number');
check(C.normalize('／ａｂｃ１２３４') === '/ABC1234','Normalize full-width typing');
check(C.valid('/ABC+123'),'Accept plus');
check(C.valid('/A.-019Z'),'Accept dot and dash');
for(const value of ['', '/', '/abcdefg', '/AB C123', '/ABC_123', '/ABC*123', '/ABC/123', '/123456', '/12345678'])check(!C.valid(value),'Reject '+value);
check(C.normalize('/O0I1ABC')==='/O0I1ABC','Never guess similar characters');
assert.deepEqual(C.dimensions(1.5),{width:1800,height:1200});assertions++;
assert.deepEqual(C.dimensions(2/3),{width:1200,height:1800});assertions++;
check(C.snapRatio(1.49)===1.5,'Snap near 3:2');
check(C.snapRatio(1.17)===1.17,'Do not snap unrelated ratio');

const photoState={image:{width:1200,height:1600},rotation:0,layout:'full',fit:'cover',zoom:2,panX:0,panY:0};
const geometry=C.photoGeometry(1080,2340,photoState);
const anchor={x:300,y:500},center=C.zoomCenter(geometry,2,3,anchor);
check(Math.abs((anchor.x-center.x)/3-(anchor.x-geometry.cx)/2)<1e-8,'Zoom preserves the image point under the cursor');
const moved=C.zoomCenter(geometry,2,3,anchor,{x:330,y:550});
check(moved.x-center.x===30&&moved.y-center.y===50,'Pinch midpoint movement also pans the image');
const clamped=C.photoGeometry(1080,2340,{...photoState,panX:100,panY:-100});
check(clamped.x<=0&&clamped.x+clamped.w>=1080&&clamped.y<=0&&clamped.y+clamped.h>=2340,'Cover pan never reveals blank bands');
const contained=C.photoGeometry(1800,1200,{...photoState,layout:'contain',fit:'contain',zoom:.25});
check(contained.w>0&&contained.h>0,'Contain layout can zoom out below 100%');
const rotated=C.photoGeometry(1800,1200,{...photoState,rotation:90,zoom:1});
check(rotated.w/rotated.h===1600/1200,'Alignment uses the rotated image bounds');
for(const [width,height,layout] of [[1080,2340,'full'],[1800,1200,'bottom'],[2540,1595,'side']])for(const tilt of [-45,-20,5,17,33,45])for(const [panX,panY] of [[0,0],[9,9],[-9,4],[3,-9]]) {
  const g=C.photoGeometry(width,height,{...photoState,layout,zoom:1,rotation:90,tilt,panX,panY}),r=(90+tilt)*Math.PI/180,a=g.area;
  const inside=[[a.x,a.y],[a.x+a.w,a.y],[a.x,a.y+a.h],[a.x+a.w,a.y+a.h]].every(([px,py])=>{
    const u=(px-g.cx)*Math.cos(r)+(py-g.cy)*Math.sin(r),v=-(px-g.cx)*Math.sin(r)+(py-g.cy)*Math.cos(r);
    return Math.abs(u)<=1200*g.scale/2+1e-6&&Math.abs(v)<=1600*g.scale/2+1e-6;
  });
  check(inside,`Tilted cover never reveals blank corners ${layout} ${tilt}°`);
}
const tilted=C.photoGeometry(1000,1000,{...photoState,image:{width:1000,height:1000},zoom:1,tilt:45});
check(Math.abs(tilted.scale-Math.SQRT2)<1e-9,'A 45° square must grow by √2 to keep covering');
for(const [layout,r] of [['full',.75],['bottom',.75],['bottom',1.5],['contain',9/16],['side',9/16],['side',2/3]]) {
  const ratio=C.photoAreaRatio(r,layout),area=C.photoRect(1000,1000/ratio,layout);
  check(Math.abs(area.w/area.h-r)<1e-9,`Original ratio fits the ${layout} photo area`);
}
for(const ratio of [.42,9/19.5,1,1.5,2.4])for(const cardRotation of [90,270])for(const cardScale of [.64,.94]) {
  const {width,height}=C.dimensions(ratio),flat=C.cardRect(width,height,{cardScale,cardX:.5,cardY:.5}),turned=C.cardRect(width,height,{cardScale,cardX:1,cardY:1,cardRotation});
  check(turned.h>turned.w&&Math.abs(turned.w/turned.h-.4)<1e-9,'A quarter-turned card swaps its footprint');
  check(turned.x>=0&&turned.y>=0&&turned.x+turned.w<=width&&turned.y+turned.h<=height,`Keep a turned card inside canvas ${ratio}`);
  check(turned.h<=width*cardScale+1e-9&&(flat.w<width*cardScale||turned.h<=flat.w+1e-9),'Turning keeps the card within its size setting');
}
const targets={x:[500],y:[300]},almost={x:403,y:252,w:200,h:100};
const snapped=C.snapRect(almost,targets,6);
check(snapped.x===400&&snapped.y===250,'Pointer movement snaps to both axes');
check(snapped.guides.x===500&&snapped.guides.y===300,'Return visible guide coordinates');
const exact=C.snapRect({...almost,x:401},targets,.0001);
check(exact.x===401,'A precise 1 px keyboard move is not pulled back to center');
check(C.snapRect({...almost,x:420},targets,6).x===420,'Leave the magnet when outside the screen-space threshold');
const align=C.alignmentTargets(1080,2340,C.photoRect(1080,2340,'bottom'),{x:100,y:200,w:300,h:100});
check(align.x.includes(540)&&align.x.includes(100)&&align.x.includes(250),'Canvas and other object contribute alignment targets');

for(const ratio of [.42,9/19.5,9/16,2/3,1,4/3,1.5,16/9,2.4]) {
  const {width,height}=C.dimensions(ratio);
  for(const cardScale of [.64,.84,.94])for(const cardX of [0,.5,1])for(const cardY of [0,.5,1]) {
    const rect=C.cardRect(width,height,{cardScale,cardX,cardY});
    check(rect.x>=0&&rect.y>=0&&rect.x+rect.w<=width&&rect.y+rect.h<=height,`Keep barcode card inside canvas ${ratio}`);
    const raster=new Raster(width,Math.ceil(rect.h)+20),box={x:rect.x+rect.w*.055,y:10,w:rect.w*.89,h:rect.h*.4};
    const result=C.drawBarcode(raster,'/A.-09Z+',box);
    check(result.narrow>=2,'At least two output pixels per narrow bar');
    check(result.quietLeft>=result.narrow*10&&result.quietRight>=result.narrow*10,'Ten modules of quiet zone');
    check(C.verifyCanvas(raster,box,'/A.-09Z+'),'Raster round trip across ratios and positions');
  }
}
const damaged=new Raster(1000,300),box={x:20,y:50,w:960,h:150};
const barcode=C.drawBarcode(damaged,'/ABC+123',box);
check(!C.verifyCanvas(damaged,box,'/ABC+124'),'Detect wrong payload');
damaged.fillStyle='#fff';damaged.fillRect(barcode.x,0,barcode.narrow,300);
assert.throws(()=>C.verifyCanvas(damaged,box,'/ABC+123'));assertions++;
assert.throws(()=>C.drawBarcode(new Raster(200,100),'/ABC+123',{x:0,y:0,w:200,h:100}));assertions++;
// Quarter-turned rasters: pixels move exactly, so the check must read columns or read backwards.
function turnRaster(source,turn){
  const side=turn%180!==0,target=new Raster(side?source.height:source.width,side?source.width:source.height);
  for(let y=0;y<source.height;y++)for(let x=0;x<source.width;x++){
    const [X,Y]=turn===90?[source.height-1-y,x]:turn===180?[source.width-1-x,source.height-1-y]:[y,source.width-1-x];
    target.pixels[Y*target.width+X]=source.pixels[y*source.width+x];
  }
  return target;
}
function turnBox(box,turn,width,height){
  if(turn===90)return {x:height-box.y-box.h,y:box.x,w:box.h,h:box.w};
  if(turn===180)return {x:width-box.x-box.w,y:height-box.y-box.h,w:box.w,h:box.h};
  return {x:box.y,y:width-box.x-box.w,w:box.h,h:box.w};
}
const upright=new Raster(1000,300),uprightBox={x:20,y:50,w:960,h:150};C.drawBarcode(upright,'/ABC+123',uprightBox);
for(const turn of [90,180,270]){
  const raster=turnRaster(upright,turn),turnedBox=turnBox(uprightBox,turn,1000,300);
  check(C.verifyCanvas(raster,turnedBox,'/ABC+123',turn),`Verify a barcode turned ${turn}°`);
  check((()=>{try{return !C.verifyCanvas(raster,turnedBox,'/ABC+123',(turn+180)%360);}catch{return true;}})(),`Reading the wrong direction fails ${turn}°`);
}

const directory=process.argv[2]||fs.mkdtempSync(path.join(os.tmpdir(),'invoice-gen-test-'));
fs.mkdirSync(directory,{recursive:true});
const samples=['/0123456','/789ABCD','/EFGHIJK','/LMNOPQR','/STUVWXY','/Z.+-012','/ABC+123'];
const manifest=[];
samples.forEach((value,index)=>{const raster=new Raster(1800,720);C.drawBarcode(raster,value,{x:90,y:150,w:1620,h:300});check(C.verifyCanvas(raster,{x:90,y:150,w:1620,h:300},value),'Fixture raster verification');const filename=path.join(directory,`barcode-${index}.png`);fs.writeFileSync(filename,png(raster));manifest.push({file:filename,expected:value});});
fs.writeFileSync(path.join(directory,'manifest.json'),JSON.stringify(manifest,null,2));
console.log(`PASS: ${assertions} assertions. Independent decoder fixtures: ${directory}/manifest.json`);
