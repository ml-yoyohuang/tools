import {TAU,pulse,mix,text,rect,label} from './math.js';

export function createSculpture() {
  const alphabet='MATTER',textures=[];
  for(const char of alphabet){
    const tile=document.createElement('canvas');tile.width=48;tile.height=64;
    const c=tile.getContext('2d');c.font='53px Anton';c.textAlign='center';c.textBaseline='middle';c.fillStyle='#252823';c.fillText(char,24,33.5);textures.push(tile);
  }
  const cols=36,rows=6,tiles=Array.from({length:cols*rows},(_,id)=>({i:id%cols,j:Math.floor(id/cols),p:new Float64Array(9),z:0,texture:textures[id%6]}));
  const depthOrder=(a,b)=>b.z-a.z;
  return function sculpture(c,w,h,t){
    const bg='#d7d8d1',ink='#252823';rect(c,0,0,w,h,bg);
    label(c,'06 / SPATIAL TYPOGRAPHY','MATTER / AFTER MATTER',w,h,ink);
    const b=pulse(t,4,6.8,9.5,12),d=pulse(t,10.3,12.8,15,17.9);
    const rx=.52+.08*Math.sin(TAU*t/18),ry=-.23+.15*Math.sin(TAU*t/18),rz=-.22;
    const scale=Math.min(w/760,(h-180)/550)*(1-d*.07),cx=w*.55,cy=h*.48;
    const cosX=Math.cos(rx),sinX=Math.sin(rx),cosY=Math.cos(ry),sinY=Math.sin(ry),cosZ=Math.cos(rz),sinZ=Math.sin(rz);
    const phase=Math.sin(t/18*TAU)*.5;
    // Reuse all vertex storage. No per-vertex arrays, maps or matrices are allocated.
    const project=(u,v,out,offset)=>{
      const a=u*TAU,beta=v*TAU,ringRadius=218+78*Math.cos(beta),helixRadius=145+(v-.5)*200,spiralAngle=a*1.3;
      let x=mix(mix(ringRadius*Math.cos(a),helixRadius*Math.cos(spiralAngle),b),(u-.5)*760,d);
      let y=mix(mix(78*Math.sin(beta),(u-.5)*470,b),(v-.5)*310,d);
      let z=mix(mix(ringRadius*Math.sin(a),helixRadius*Math.sin(spiralAngle),b),82*Math.sin(a+v*3+phase),d);
      let temp=y*cosX-z*sinX;z=y*sinX+z*cosX;y=temp;
      temp=x*cosY+z*sinY;z=-x*sinY+z*cosY;x=temp;
      temp=x*cosZ-y*sinZ;y=x*sinZ+y*cosZ;x=temp;
      const perspective=1000/(1000+z);
      out[offset]=cx+x*scale*perspective;out[offset+1]=cy+y*scale*perspective;out[offset+2]=z;
    };
    for(const tile of tiles){
      const u=tile.i/cols,v=tile.j/rows;
      project(u+.001,v+.014,tile.p,0);
      project(u+1/cols-.001,v+.014,tile.p,3);
      project(u+.001,v+1/rows-.014,tile.p,6);
      tile.z=(tile.p[2]+tile.p[5]+tile.p[8])/3;
    }
    tiles.sort(depthOrder);
    for(const tile of tiles){
      const p=tile.p;
      const ax=(p[3]-p[0])/48,ay=(p[4]-p[1])/48,bx=(p[6]-p[0])/64,by=(p[7]-p[1])/64;
      if(Math.abs(ax*by-ay*bx)<.00015)continue;
      c.save();c.globalAlpha=.48+.52*(1-(tile.z+350)/700);c.transform(ax,ay,bx,by,p[0],p[1]);c.drawImage(tile.texture,0,0);c.restore();
    }
    text(c,'MATTER',43,h-115,44,ink,'Manrope',750);
    text(c,'AFTER MATTER',43,h-78,29,ink,'Manrope',400);
    text(c,'ONE WORD. THREE SPATIAL CONDITIONS.',40,h-31,10,ink,'Manrope',650);
    text(c,d>.5?'III / SHEET':b>.5?'II / HELIX':'I / TORUS',w-40,h-31,11,ink,'Manrope',650,'right');
  };
}
