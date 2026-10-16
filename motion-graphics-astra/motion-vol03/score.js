import {clamp,pulse,text,rect,line,circle,caption} from '../common/math.js';

// Original 8-bar miniature, 4/4 at 120 BPM; the final bar leaves a breath.
export const score=[];
for(let i=0;i<28;i++)score.push({at:.5+i*.5,duration:.12,voice:'rhythm',pitch:48+(i%4===3?7:0),strength:i%4===0?.8:.42,index:i});
const melody=[60,64,67,62,69,67,64,72,71,67,62,65,64,60];
melody.forEach((pitch,i)=>score.push({at:2+i*.875,duration:.7,voice:'melody',pitch,strength:.55,index:i}));
[[48,55,64],[45,52,60],[53,60,67],[48,55,62]].forEach((notes,i)=>notes.forEach(pitch=>score.push({at:.5+i*3.5,duration:2.9,voice:'harmony',pitch,strength:.14,index:i})));
score.sort((a,b)=>a.at-b.at);

export function createAudio(){
 let context=null,master=null,analyser=null,enabled=false,running=false,anchor=0,scheduled=0;const nodes=new Set(),samples=new Float32Array(1024);
 function clear(){for(const node of nodes){try{node.osc.stop();}catch{}node.osc.disconnect();node.gain.disconnect();}nodes.clear();}
 function schedule(t){
  if(!context||!enabled||!running)return;
  for(const event of score){const end=event.at+event.duration;if(end<=t)continue;
   const osc=context.createOscillator(),gain=context.createGain(),start=context.currentTime+Math.max(0,event.at-t),remaining=end-Math.max(t,event.at),peak=event.strength*.16;
   osc.type=event.voice==='rhythm'?'triangle':'sine';osc.frequency.value=440*2**((event.pitch-69)/12);
   if(event.voice==='rhythm')osc.frequency.exponentialRampToValueAtTime(osc.frequency.value*.55,start+remaining);
   gain.gain.setValueAtTime(.0001,start);gain.gain.exponentialRampToValueAtTime(peak,start+Math.min(.018,remaining*.2));gain.gain.exponentialRampToValueAtTime(.0001,start+remaining);
   osc.connect(gain);gain.connect(master);const node={osc,gain};nodes.add(node);osc.onended=()=>{osc.disconnect();gain.disconnect();nodes.delete(node);};osc.start(start);osc.stop(start+remaining+.015);scheduled++;
  }
 }
 const api={
  async toggle(t,playing){if(enabled){enabled=false;api.pause();return false;}if(!context){context=new AudioContext();master=context.createGain();master.gain.value=.8;analyser=context.createAnalyser();analyser.fftSize=1024;master.connect(analyser);analyser.connect(context.destination);}await context.resume();enabled=true;if(playing)api.play(t);return true;},
  play(t){if(!enabled)return;clear();running=true;anchor=context.currentTime-t;schedule(t);},
  pause(){running=false;clear();},
  seek(t){clear();if(enabled&&running){anchor=context.currentTime-t;schedule(t);}},
  tick(){},clock(){return enabled&&running?context.currentTime-anchor:null;},
  inspect(){let peak=0;if(analyser){analyser.getFloatTimeDomainData(samples);for(const s of samples)peak=Math.max(peak,Math.abs(s));}return {enabled,running,scheduled,active:nodes.size,peak,contextState:context?.state||'uncreated',clock:enabled&&running?context.currentTime-anchor:null};},
  dispose(){api.pause();master?.disconnect();analyser?.disconnect();if(context?.state!=='closed')context?.close();}
 };return api;
}

export function soundArchitecture(){const audio=createAudio();return {audio,render(c,w,h,t){
 const bg='#162f36',cream='#e4e4ce',gold='#d8ba83',clay='#b57051';rect(c,0,0,w,h,bg);caption(c,'16 / ROOMS FOR A SMALL ENSEMBLE','EIGHT BARS / THREE VOICES / ONE ROOM',w,h,cream);
 const floor=h*.74,H=Math.min(460,h*.44),breath=pulse(t,.3,2,13.8,16);
 // Sustained harmonic notes make broad planes. Each chord owns its own depth.
 for(let i=0;i<4;i++){const at=.5+i*3.5,level=pulse(t,at,at+.8,at+2.2,at+3.35);if(level<.001)continue;c.globalAlpha=.14+level*.12;rect(c,340+i*40,floor-H*(.63+.10*i),490-i*60,H*(.63+.10*i),i%2?clay:gold);c.globalAlpha=1;}
 // The melody is a row of architectural arches, never a frequency spectrum.
 for(let i=0;i<7;i++){
  const entries=score.filter(e=>e.voice==='melody'&&e.index%7===i);let activity=0;for(const e of entries)activity=Math.max(activity,pulse(t,e.at-.16,e.at+.08,e.at+.38,e.at+1.8));
  const x=310+i*76,archH=H*(.68+i*.045),lift=activity*20,thick=12+activity*9;
  c.strokeStyle=i%2?gold:cream;c.lineWidth=thick;c.globalAlpha=.25+breath*.65;c.beginPath();c.moveTo(x,floor);c.lineTo(x,floor-archH+36-lift);c.bezierCurveTo(x,floor-archH-15-lift,x+61,floor-archH-15-lift,x+61,floor-archH+36-lift);c.lineTo(x+61,floor);c.stroke();c.globalAlpha=1;
 }
 // Syncopated floor tiles translate the actual rhythmic onsets into short accents.
 for(let i=0;i<14;i++){let hit=0;for(const e of score)if(e.voice==='rhythm'&&e.index%14===i)hit=Math.max(hit,pulse(t,e.at-.04,e.at+.03,e.at+.08,e.at+.45)*e.strength);rect(c,85+i*61,floor+30-hit*11,44,7+hit*11,hit>.2?clay:gold);}
 text(c,'Rooms for',45,123,39,cream,'Bodoni',500);text(c,'a small ensemble.',45,170,39,cream,'Bodoni',500);
 text(c,'A rest is also a room.',45,h-75,21,gold,'Bodoni',500);
 }};}
