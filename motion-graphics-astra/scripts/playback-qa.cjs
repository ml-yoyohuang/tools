const path=require('node:path');
const fs=require('node:fs/promises');
const assert=require('node:assert/strict');
const runtime=process.env.NODE_MODULES||'C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';
const {chromium}=require(path.join(runtime,'playwright'));
const sharp=require(path.join(runtime,'sharp'));
const root=path.resolve(__dirname,'../motion-vol01');
(async()=>{
 const {works}=await import('../motion-vol01/shared/data.js');
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'C:/Users/user/AppData/Local/ms-playwright/chromium_headless_shell-1194/chrome-win/headless_shell.exe'});
 const context=await browser.newContext({viewport:{width:1280,height:960},deviceScaleFactor:1});
 const page=await context.newPage();const results=[],composites=[];
 for(const [id,work] of works.entries()){
  await page.goto('http://127.0.0.1:4178/motion-vol01/'+work.slug+'/?t=0');await page.waitForFunction(()=>window.__motion?.ready);
  await page.locator('img').evaluateAll(imgs=>Promise.all(imgs.map(img=>img.decode())));
  // Observe complete real-time loops; captures are taken from the running player.
  await page.evaluate(()=>{window.__motion.play();window.__qaStart=performance.now();});
  const observed=[];
  for(let k=0;k<9;k++){
   const deadline=(k+.2)/8*work.duration*1000;
   await page.waitForFunction(d=>performance.now()-window.__qaStart>=d,deadline);
   observed.push(await page.evaluate(()=>({time:__motion.time,playing:__motion.playing,wallMs:performance.now()-__qaStart})));
   const shot=await page.locator('.stage').screenshot();
   composites.push({input:await sharp(shot).resize(270,180,{fit:'contain',background:'#f1f0e9'}).png().toBuffer(),left:k*270,top:id*180});
  }
  assert.ok(observed.at(-1).time<work.duration*.2&&observed.at(-1).playing);
  await page.evaluate(()=>__motion.pause());
  // Frame intervals are profiled separately, without screenshots or synchronous seek bursts.
  const cadence=await page.evaluate(()=>new Promise(resolve=>{
   const intervals=[];let previous=0;__motion.restart();__motion.play();
   function sample(now){if(previous)intervals.push(now-previous);previous=now;if(intervals.length<180)requestAnimationFrame(sample);else{__motion.pause();intervals.sort((a,b)=>a-b);resolve({frames:intervals.length,medianMs:intervals[90],p95Ms:intervals[171],maxMs:intervals[179],over50ms:intervals.filter(v=>v>50).length});}}requestAnimationFrame(sample);
  }));
  results.push({work:work.name,fullLoop:true,observed,cadence});console.log(work.name+': complete real-time loop; median '+cadence.medianMs.toFixed(2)+'ms, p95 '+cadence.p95Ms.toFixed(2)+'ms');
 }
 // Retina / narrow landscape are separate rendering contexts.
 const retina=await browser.newContext({viewport:{width:820,height:1180},deviceScaleFactor:2});const rp=await retina.newPage();
 await rp.goto('http://127.0.0.1:4178/motion-vol01/04-moire-kinetics/?t=15');await rp.waitForFunction(()=>window.__motion?.ready);await rp.locator('.stage').screenshot({path:path.join(root,'review/04-retina.png')});
 await page.setViewportSize({width:844,height:390});
 const landscape=[];for(const work of works){await page.goto('http://127.0.0.1:4178/motion-vol01/'+work.slug+'/?t='+work.still);await page.waitForFunction(()=>window.__motion?.ready);landscape.push({work:work.name,overflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)});}
 assert.ok(landscape.every(r=>!r.overflow));
 await sharp({create:{width:2430,height:1080,channels:3,background:'#f1f0e9'}}).composite(composites).png().toFile(path.join(root,'review/live-loop-filmstrip.png'));
 await fs.writeFile(path.join(root,'review/playback.json'),JSON.stringify({date:new Date().toISOString(),browser:await browser.version(),results,landscape,notes:'Full real-time loops recorded as nine sampled screenshots per artwork. Cadence measured separately over 180 animation frames without screenshots; headless local test, not a hardware-independent guarantee.'},null,2));
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1);});
