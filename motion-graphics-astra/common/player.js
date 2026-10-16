import {clamp} from './math.js';

export async function mount(work,create){
 const stage=document.querySelector('.stage'),canvas=stage.querySelector('.main-canvas'),ctx=canvas.getContext('2d');
 const play=document.querySelector('.play'),scrub=document.querySelector('.scrubber'),loopButton=document.querySelector('.loop'),status=document.querySelector('#playback-status');
 const reduced=matchMedia('(prefers-reduced-motion: reduce)'),params=new URLSearchParams(location.search);
 let t=params.has('t')?clamp(Number(params.get('t'))||0,0,work.duration):reduced.matches?work.still:0;
 let playing=!params.has('t')&&!reduced.matches,loop=true,raf=0,last=0,w=1000,h=750,renderer;
 await Promise.allSettled([document.fonts.load('400 150px Anton'),document.fonts.load('500 70px Bodoni'),document.fonts.load('italic 500 70px Bodoni'),document.fonts.load('500 14px Manrope')]);
 try{renderer=await create({stage,canvas,ctx,work,params});}catch(error){console.error(error);stage.insertAdjacentHTML('beforeend','<p class="renderer-notice">Renderer unavailable. Please use a browser with WebGL enabled.</p>');return;}
 function draw(){ctx.clearRect(0,0,w,h);renderer.render(ctx,w,h,t);scrub.value=t;document.querySelector('.timecode').textContent=`${t.toFixed(1).padStart(4,'0')} / ${work.duration.toFixed(1)}`;scrub.setAttribute('aria-valuetext',`${t.toFixed(1)} of ${work.duration} seconds`);document.querySelector('.phase').textContent=work.phases.filter(p=>p[0]<=t).at(-1)[1];}
 function ui(){play.textContent=playing?'Ⅱ Pause':'▷ Play';play.setAttribute('aria-label',playing?'Pause animation':'Play animation');play.setAttribute('aria-pressed',String(playing));loopButton.textContent=loop?'Loop on ↻':'Loop off';loopButton.setAttribute('aria-pressed',String(loop));status.textContent=playing?'Playing':'Paused';}
 function cancel(){cancelAnimationFrame(raf);raf=0;last=0;renderer.audio?.pause();}
 function frame(now){raf=0;if(!playing||document.hidden)return;const audioTime=renderer.audio?.clock();if(audioTime!=null)t=audioTime;else if(last)t+=(now-last)/1000;if(t>=work.duration){if(loop){t%=work.duration;renderer.audio?.seek(t);}else{t=work.duration;playing=false;renderer.audio?.pause();ui();}}last=now;draw();renderer.audio?.tick(t);if(playing)raf=requestAnimationFrame(frame);}
 function start(){if(playing&&!document.hidden&&!raf){last=0;renderer.audio?.play(t);raf=requestAnimationFrame(frame);}}
 function setPlaying(value){playing=value;if(playing&&t>=work.duration)t=0;if(!playing)cancel();ui();draw();start();}
 function seek(value){t=clamp(Number(value)||0,0,work.duration);last=0;renderer.audio?.seek(t);draw();}
 function setLoop(value){loop=Boolean(value);ui();}
 function resize(){const box=stage.getBoundingClientRect();h=w*box.height/box.width;const scale=Math.min((devicePixelRatio||1)*box.width/w,1.7);canvas.width=Math.round(w*scale);canvas.height=Math.round(h*scale);ctx.setTransform(scale,0,0,scale,0,0);const gpuScale=Math.min(devicePixelRatio||1,1100/box.width,1100/box.height);renderer.resize?.(w,h,box.width*gpuScale,box.height*gpuScale);draw();}
 scrub.max=work.duration;play.onclick=()=>setPlaying(!playing);scrub.oninput=()=>{const value=scrub.value;setPlaying(false);seek(value);};document.querySelector('.restart').onclick=()=>seek(0);loopButton.onclick=()=>setLoop(!loop);
 async function fullscreen(){try{if(document.fullscreenElement)await document.exitFullscreen();else await stage.requestFullscreen();}catch{status.textContent='Fullscreen unavailable';}}
 document.querySelector('.fullscreen').onclick=fullscreen;
 document.addEventListener('keydown',e=>{if(e.ctrlKey||e.metaKey||e.altKey||e.target.matches('input,button,a,textarea'))return;if([' ','k','r','l','f','Home','End','ArrowLeft','ArrowRight'].includes(e.key))e.preventDefault();if(e.key===' '||e.key==='k')setPlaying(!playing);if(e.key==='r')seek(0);if(e.key==='l')setLoop(!loop);if(e.key==='f')fullscreen();if(e.key==='Home'||e.key==='End'){setPlaying(false);seek(e.key==='Home'?0:work.duration);}if(e.key.startsWith('Arrow')){setPlaying(false);seek(t+(e.key==='ArrowLeft'?-1:1)*(e.shiftKey?.1:1));}});
 document.addEventListener('visibilitychange',()=>document.hidden?cancel():start());
 const observer=new ResizeObserver(resize);observer.observe(stage);
 window.addEventListener('pagehide',e=>{cancel();if(!e.persisted){observer.disconnect();renderer.dispose?.();renderer.audio?.dispose();}});window.addEventListener('pageshow',()=>start());
 reduced.addEventListener('change',e=>{if(e.matches){setPlaying(false);seek(work.still);document.querySelector('.reduced-notice').hidden=false;}});
 document.querySelector('.reduced-notice').hidden=!reduced.matches;
 if(renderer.audio){const button=document.querySelector('.audio-control');button.hidden=false;button.onclick=async()=>{const enabled=await renderer.audio.toggle(t,playing);button.setAttribute('aria-pressed',String(enabled));button.textContent=enabled?'Sound on ♫':'Sound off ♫';};}
 ui();resize();start();
 window.__motion={ready:true,seek,pause:()=>setPlaying(false),play:()=>setPlaying(true),restart:()=>seek(0),setLoop,get time(){return t;},get playing(){return playing;},get loop(){return loop;},duration:work.duration,get audio(){return renderer.audio?.inspect();},get renderer(){return renderer.kind||'canvas';},setMaterial:renderer.setMaterial};
}
