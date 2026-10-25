/* Original procedural mesh assets. Geometry is shared by WebGL and OBJ export. */
(function(root,factory){var api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MushModels3D=api;})(typeof self!=='undefined'?self:this,function(){'use strict';
const meshes={};
function lathe(profile,segments=24){const data=[];for(let j=0;j<profile.length-1;j++){const [y0,r0]=profile[j],[y1,r1]=profile[j+1],slope=(r0-r1)/(y1-y0||.001);for(let i=0;i<segments;i++){const a=i/segments*Math.PI*2,b=(i+1)/segments*Math.PI*2;const vertex=(y,r,t)=>{let n=[Math.cos(t),slope,Math.sin(t)],l=Math.hypot(...n);return [r*Math.cos(t),y,r*Math.sin(t),...n.map(v=>v/l)]};const A=vertex(y0,r0,a),B=vertex(y1,r1,a),C=vertex(y0,r0,b),D=vertex(y1,r1,b);data.push(...A,...C,...B,...C,...D,...B)}}return data}
meshes.sphere=lathe(Array.from({length:17},(_,i)=>{const a=i/16*Math.PI;return [-Math.cos(a),Math.sin(a)]}));
meshes.cap=lathe([[-.12,0],[-.12,.4],[-.08,.82],[0,1],[.15,.98],[.36,.83],[.55,.54],[.64,0]]);
meshes.trumpet=lathe([[0,.26],[.2,.3],[.7,.37],[1,.48],[1.25,.85],[1.38,.99],[1.5,.7],[1.56,0]]);
meshes.stem=lathe([[-1,.7],[-.9,1],[.1,.8],[.8,.62],[1,.65]]);
meshes.cone=lathe([[-1,1],[1,0]],8);meshes.cylinder=lathe([[-1,0],[-1,1],[1,1],[1,0]]);
meshes.disk=lathe([[0,0],[0,1],[.03,1],[.03,0]]);
meshes.ring=lathe([[-.2,.85],[-.2,1],[.2,1],[.2,.85],[-.2,.85]]);
meshes.box=[];const corners=[[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]],faces=[[0,3,2,1,0,0,-1],[4,5,6,7,0,0,1],[0,4,7,3,-1,0,0],[1,2,6,5,1,0,0],[0,1,5,4,0,-1,0],[3,7,6,2,0,1,0]];faces.forEach(f=>[0,1,2,0,2,3].forEach(i=>meshes.box.push(...corners[f[i]],...f.slice(4))));
const part=(mesh,p,s,c,r=0)=>({mesh,p,s,c,r});
function mushroom(id){const a=[],add=(m,p,s,c,r)=>a.push(part(m,p,s,c,r)),gold=id==='sh_gold',boss=id.indexOf('boss_')===0;
let cap=gold?'#e7b532':'#d9cdb3',stem='#f1dcc1',height=1.55,width=.83;
if(id==='sh_enoki'){height=1.75;width=.4;cap='#efe2bd'}if(id==='sh_walnut'){cap='#9b643d';height=1.2;width=.83}if(id==='sh_sponge'){cap='#dfb746';height=1.5;width=.92}if(id==='sh_ice'){cap='#9ad9ef';stem='#d1edf4'}if(id==='boss_king'){cap='#b58b62';height=2.9;width=1.45}if(id==='boss_frozen'){cap='#6fbdde';stem='#bfdfeb';height=2.7;width=1.5}
add('disk',[0,.008,0],[width*.9,1,width*.65],'#35452e');
if(id==='sh_chest'){add('sphere',[0,.58,0],[.73,.58,.62],'#443633');add('box',[0,.95,0],[.67,.28,.52],'#604735');[-.4,.4].forEach(x=>add('box',[x,.92,0],[.05,.33,.56],'#d7ac55'));add('box',[0,.78,.58],[.15,.16,.06],'#e4be5b');height=.95;width=.75}
else if(id==='boss_tofu'){add('box',[0,1.37,0],[1.13,1.3,.9],'#f0e2b1');for(let i=-2;i<=2;i++){add('box',[i*.39,1.4,.916],[.014,1.12,.012],'#c5aa75');add('box',[0,1.4+i*.43,.92],[1.05,.015,.012],'#ccb47c')}height=2.5;width=1.15;cap='#e6cf8d';for(let i=-1;i<=1;i++)add('cone',[i*.5,2.98,0],[.22,.45,.23],'#e4b344')}
else{add('stem',[0,height*.49,0],[width*.39,height*.49,width*.33],stem);add('cylinder',[0,height*.85,0],[width*.28,height*.18,width*.27],stem);if(id==='boss_king')add('trumpet',[0,1.25,0],[1.5,1.12,1.35],cap);else add('cap',[0,height,0],[width,width*.76,width*.88],cap);
for(let i=0;i<14;i++){const t=i/14*Math.PI*2;add('box',[Math.sin(t)*width*.57,height-.055,Math.cos(t)*width*.57],[.015,.018,width*.35],'#c8b99a',t)}
if(!['sh_enoki','sh_walnut','boss_king'].includes(id))for(let i=0;i<7;i++){const t=i*2.399,r=.22+(i%3)*.17;add('sphere',[Math.cos(t)*width*r,height+width*(.32+(1-r)*.19),Math.sin(t)*width*r],[.1,.018,.07],gold?'#fff0a3':id==='sh_sponge'?'#9f7c26':'#efdfb8')}
}
const faceY=id==='boss_tofu'?1.5:height*.71,faceZ=id==='boss_tofu'?.94:width*.34;[-1,1].forEach(sign=>{add('sphere',[sign*width*.22,faceY,faceZ],[width*.055,.08,.04],'#2f3027');add('sphere',[sign*width*.24,faceY+.025,faceZ+.035],[.018,.022,.014],'#fff9df');add('sphere',[sign*width*.34,faceY-.14,faceZ-.015],[width*.10,.037,.02],gold?'#e7933c':'#dd987f')});add('sphere',[0,faceY-.15,faceZ+.035],[.085,.028,.025],'#794333');
if(id==='sh_walnut')for(let i=0;i<10;i++){const t=i*Math.PI/5;add('sphere',[Math.cos(t)*.63,1.26,Math.sin(t)*.56],[.23,.23,.19],i%2?'#80502f':'#a36e45')}
if(id==='sh_ice'||id==='boss_frozen'){for(let i=0;i<7;i++){let t=i*2.4;add('cone',[Math.cos(t)*width*.65,height+.6,Math.sin(t)*width*.6],[.17,.55+(i%3)*.16,.17],i%2?'#a9edff':'#e2faff',t)}}
if(gold){add('ring',[0,2.01,0],[.38,.4,.38],'#f4d366');for(let i=-1;i<=1;i++)add('cone',[i*.24,2.2,0],[.1,.25,.1],'#ffe6a0')}
if(boss){add('sphere',[-width*.85,.5,.1],[.3,.23,.35],stem);add('sphere',[width*.85,.5,.1],[.3,.23,.35],stem)}return a}
function scene(id){let a=[],add=(m,p,s,c,r)=>a.push(part(m,p,s,c,r));if(id==='zone_01'){
for(let i=-7;i<=7;i++){add('box',[i*1.65,-.18,-5],[.815,.17,12],i%2?'#b88b57':'#bf9564');for(let j=0;j<4;j++)add('box',[i*1.65-.4+j*.25,.001,-5+j],[.012,.005,10-j],'#a77d50')}
add('box',[0,-.8,-5],[12,.5,12],'#80664a');for(let side of [-1,1]){add('box',[side*13,1,-8],[.7,2.8,8],'#76866a');for(let j=0;j<7;j++)add('cylinder',[side*10,.65,-13+j*1.9],[.06,.65,.06],'#cab083')}
add('sphere',[-7,.4,-8],[2,.55,2],'#657d48');add('sphere',[-7,.9,-8],[1.5,.45,1.5],'#a5bd79');add('cone',[7,.4,-7],[.65,1.5,.6],'#d88b45');for(let j=-1;j<=1;j++)add('sphere',[7+j*.35,1.9,-7],[.16,.6,.16],'#547948');add('ring',[0,.4,-17],[4,1,4],'#d1b386');
}else if(id==='zone_02'){
add('cylinder',[0,-.5,-5],[12,.3,12],'#292f32');add('disk',[0,-.08,-5],[11.6,1,11.6],'#b88339');add('ring',[0,.3,-5],[12,2.2,12],'#3c4643');[-1,1].forEach(side=>{add('ring',[side*13,.6,-5],[2,.9,2],'#5d6660');add('box',[side*13,-1,-5],[1.4,.8,3],'#3a3630')});for(let i=0;i<40;i++){let t=i*2.399,r=3.5+(i%6);add('sphere',[Math.cos(t)*r,0,-5+Math.sin(t)*r],[.12+(i%3)*.1,.08,.17],i%2?'#e3ba6b':'#a9ad58')}for(let i=0;i<8;i++){add('cone',[-10+i*2.6,-1.1,-13],[.3,.7,.3],'#dd7436')}
}else{
for(let i=-5;i<=5;i++)for(let j=0;j<10;j++)add('box',[i*2.3,-.15,-j*2.3+5],[1.13,.14,1.13],(i+j)%2?'#93b7be':'#adc9cc');add('box',[0,5,-18],[13,5,.4],'#b4cbd0');[-1,1].forEach(side=>{add('box',[side*12.5,4,-5],[.4,4.5,13],'#9bbbc4');for(let j=0;j<3;j++){add('box',[side*9.4,1.5+j*2.3,-9],[2.7,.08,7],'#d7e5e4');for(let k=0;k<4;k++){add('cylinder',[side*9.4,2+j*2.3,-13+k*2.4],[.45,.4,.45],['#bfd5bc','#d5a881','#d6c6a4'][j]);add('cylinder',[side*9.4,2.43+j*2.3,-13+k*2.4],[.47,.06,.47],'#779fa4')}}});for(let i=0;i<15;i++)add('cone',[-11+i*1.6,4.5,-16],[.2,.8+(i%3)*.35,.23],'#d7f1f5');add('box',[0,7,-8],[3,.08,1],'#d9f5f4')}
return a}
function courier(){return [part('box',[0,.9,0],[.7,.8,.45],'#be8150'),part('box',[0,.96,.47],[.6,.55,.025],'#e2b57a'),part('ring',[0,1.8,0],[.25,.5,.18],'#5d4734'),...mushroom('sh_enoki').map(p=>({...p,p:[p.p[0]+.8,p.p[1]*.5,p.p[2]+.1],s:p.s.map(v=>v*.5)}))]}
return {meshes,mushroom,scene,courier,part};
});
