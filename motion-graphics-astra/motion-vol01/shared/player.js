import {works} from './data.js';
import {interval,ballet,moire,chaos} from './paintings.js';
import {createSculpture} from './sculpture.js';
import {createEditorial} from './editorial.js';
import {clamp} from './math.js';

const id=Number(document.body.dataset.work),work=works[id],stage=document.querySelector('.stage');
const canvas=document.querySelector('canvas'),ctx=canvas.getContext('2d',{alpha:false});
const play=document.querySelector('.play'),restart=document.querySelector('.restart'),scrub=document.querySelector('.scrubber'),loopButton=document.querySelector('.loop'),fullscreen=document.querySelector('.fullscreen'),timecode=document.querySelector('.timecode'),phase=document.querySelector('.phase'),status=document.querySelector('#playback-status');
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const params=new URLSearchParams(location.search),hasTime=params.has('t');
let time=hasTime?clamp(Number(params.get('t'))||0,0,work.duration):reduced.matches?work.still:0;
let playing=!hasTime&&!reduced.matches,loop=true,raf=0,last=0,W=1000,H=800,cssWidth=1000;
await Promise.all([document.fonts.load('400 100px Anton'),document.fonts.load('500 100px Bodoni'),document.fonts.load('italic 500 100px Bodoni'),document.fonts.load('500 14px Manrope')]);
const render=[interval,ballet,null,moire,chaos,null];render[2]=id===2?createEditorial(stage):null;render[5]=id===5?createSculpture():null;
if(id===2)canvas.hidden=true;
scrub.max=work.duration;scrub.value=time;
function draw(){render[id](ctx,W,H,time,{cssWidth});scrub.value=time;timecode.textContent=`${time.toFixed(1).padStart(4,'0')} / ${work.duration.toFixed(1)}`;scrub.setAttribute('aria-valuetext',`${time.toFixed(1)} of ${work.duration} seconds`);phase.textContent=work.phases.filter(p=>p[0]<=time).at(-1)[1];}
function state(){play.textContent=playing?'Ⅱ Pause':'▷ Play';play.setAttribute('aria-label',playing?'Pause animation':'Play animation');play.setAttribute('aria-pressed',String(playing));status.textContent=playing?'Playing':'Paused';loopButton.textContent=loop?'Loop on ↻':'Loop off';loopButton.setAttribute('aria-pressed',String(loop));}
function cancel(){cancelAnimationFrame(raf);raf=0;last=0;}
function frame(now){raf=0;if(!playing||document.hidden)return;if(last){const delta=(now-last)/1000;time+=delta;if(time>=work.duration){if(loop)time%=work.duration;else{time=work.duration;playing=false;state();}}}last=now;draw();if(playing)raf=requestAnimationFrame(frame);}
function start(){if(playing&&!document.hidden&&!raf){last=0;raf=requestAnimationFrame(frame);}}
function setPlaying(value){playing=value;if(playing&&time>=work.duration)time=0;if(!playing)cancel();state();draw();start();}
function seek(value){time=clamp(Number(value)||0,0,work.duration);draw();}
function setLoop(value){loop=Boolean(value);state();}
function resize(){const box=stage.getBoundingClientRect();cssWidth=box.width;H=W*box.height/box.width;const dpr=Math.min(devicePixelRatio||1,2);const scale=Math.min(dpr*box.width/W,2);canvas.width=Math.round(W*scale);canvas.height=Math.round(H*scale);ctx.setTransform(scale,0,0,scale,0,0);draw();}
play.addEventListener('click',()=>setPlaying(!playing));
restart.addEventListener('click',()=>{seek(0);last=0;});
scrub.addEventListener('input',()=>{const target=Number(scrub.value);setPlaying(false);seek(target);});
loopButton.addEventListener('click',()=>setLoop(!loop));
async function toggleFullscreen(){try{if(document.fullscreenElement)await document.exitFullscreen();else await stage.requestFullscreen();}catch{status.textContent='Fullscreen is not available in this browser.';}}
fullscreen.addEventListener('click',toggleFullscreen);
if(!stage.requestFullscreen){fullscreen.disabled=true;fullscreen.title='Fullscreen unavailable in this browser';}
document.addEventListener('keydown',e=>{
  if(e.ctrlKey||e.metaKey||e.altKey||e.target.matches('input,textarea,select,button,a'))return;
  if([' ','k','r','l','f','ArrowLeft','ArrowRight','Home','End'].includes(e.key))e.preventDefault();
  if(e.key===' '||e.key==='k')setPlaying(!playing);
  if(e.key==='r'){seek(0);last=0;}
  if(e.key==='l')setLoop(!loop);
  if(e.key==='f')toggleFullscreen();
  if(e.key==='ArrowLeft'||e.key==='ArrowRight'){setPlaying(false);seek(time+(e.key==='ArrowLeft'?-1:1)*(e.shiftKey?.1:1));}
  if(e.key==='Home'){setPlaying(false);seek(0);}
  if(e.key==='End'){setPlaying(false);seek(work.duration);}
});
document.addEventListener('visibilitychange',()=>{if(document.hidden)cancel();else start();});
window.addEventListener('pagehide',cancel);
window.addEventListener('pageshow',start);
reduced.addEventListener('change',e=>{if(e.matches){setPlaying(false);seek(work.still);document.querySelector('.reduced-notice').hidden=false;}});
document.querySelector('.reduced-notice').hidden=!reduced.matches;
const observer=new ResizeObserver(resize);observer.observe(stage);
state();resize();start();
// A narrow, documented inspection API also makes deterministic stills reproducible.
window.__motion={seek,pause:()=>setPlaying(false),play:()=>setPlaying(true),restart:()=>{seek(0);last=0;},setLoop,get time(){return time;},get playing(){return playing;},get loop(){return loop;},duration:work.duration,ready:true};
