/* Browser QA uses the desktop runtime's existing Playwright and Chromium.
   Override NODE_MODULES and CHROMIUM_PATH on another workstation. */
const {createRequire}=require('node:module');
const path=require('node:path');
const fs=require('node:fs/promises');
const runtime=process.env.NODE_MODULES||'C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';
const {chromium}=require(path.join(runtime,'playwright'));
const sharp=require(path.join(runtime,'sharp'));
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../motion-vol01');
const url='http://127.0.0.1:4178/motion-vol01/';
(async()=>{
 const {works}=await import('../motion-vol01/shared/data.js');
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'C:/Users/user/AppData/Local/ms-playwright/chromium_headless_shell-1194/chrome-win/headless_shell.exe'});
 const context=await browser.newContext({viewport:{width:1440,height:1100},deviceScaleFactor:1});
 const page=await context.newPage();const errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
 const results=[],stills=[],mobile=[];
 const times=[[4.2,6.4,10.8],[1,6.6,9.5],[1,7.8,13.8],[3,9,15],[1,5.5,9],[1.5,7.8,13.8]];
 for(let i=0;i<works.length;i++){
  const work=works[i];
  const r=await page.goto(url+work.slug+'/?t='+work.still);assert.equal(r.status(),200);
  await page.waitForFunction(()=>window.__motion?.ready);await page.locator('img').evaluateAll(imgs=>Promise.all(imgs.map(img=>img.decode())));
  for(let k=0;k<3;k++){
   await page.evaluate(t=>window.__motion.seek(t),times[i][k]);
   const output=path.join(root,`review/${String(i+1).padStart(2,'0')}-key-${k+1}.png`);
   await page.locator('.stage').screenshot({path:output});stills.push(output);
  }
  const deterministic=await page.evaluate(()=>{const m=window.__motion;const snapshot=()=>document.querySelector('canvas').hidden?document.querySelector('.editorial').innerHTML:document.querySelector('canvas').toDataURL();m.seek(3.25);const a=snapshot();m.seek(6.5);m.seek(3.25);return a===snapshot();});assert.ok(deterministic,work.name+' deterministic');
  await page.locator('.play').click();assert.ok(await page.evaluate(()=>__motion.playing));
  await page.waitForTimeout(140);await page.locator('.play').click();assert.equal(await page.evaluate(()=>__motion.playing),false);
  await page.locator('.restart').click();assert.equal(await page.evaluate(()=>__motion.time),0);
  await page.locator('.scrubber').fill('5');assert.equal(await page.evaluate(()=>__motion.time),5);
  await page.locator('.loop').click();assert.equal(await page.evaluate(()=>__motion.loop),false);
  await page.evaluate(()=>{__motion.seek(__motion.duration-.08);__motion.play();});await page.waitForTimeout(200);
  assert.equal(await page.evaluate(()=>__motion.playing),false);assert.equal(await page.evaluate(()=>__motion.time),work.duration);
  await page.locator('.loop').click();await page.evaluate(()=>{__motion.seek(__motion.duration-.08);__motion.play();});await page.waitForTimeout(200);assert.ok(await page.evaluate(()=>__motion.time<1&&__motion.playing));await page.evaluate(()=>__motion.pause());
  await page.locator('h1').click();await page.keyboard.press('Home');assert.equal(await page.evaluate(()=>__motion.time),0);await page.keyboard.press('ArrowRight');assert.equal(await page.evaluate(()=>__motion.time),1);await page.keyboard.press('Space');assert.ok(await page.evaluate(()=>__motion.playing));await page.keyboard.press('Space');
  await page.locator('.fullscreen').click();await page.waitForTimeout(100);assert.ok(await page.evaluate(()=>!!document.fullscreenElement));await page.evaluate(()=>document.exitFullscreen());
  const perf=await page.evaluate(()=>{const values=[];for(let i=0;i<120;i++){const a=performance.now();__motion.seek(i/120*__motion.duration);values.push(performance.now()-a);}values.sort((a,b)=>a-b);return {median:values[60],p95:values[114]};});
  const endpoint=[];for(const time of [0,work.duration]){await page.evaluate(t=>__motion.seek(t),time);endpoint.push(await page.locator('.stage').screenshot());}
  const rawA=await sharp(endpoint[0]).removeAlpha().raw().toBuffer(),rawB=await sharp(endpoint[1]).removeAlpha().raw().toBuffer();let difference=0;for(let n=0;n<rawA.length;n++)difference+=Math.abs(rawA[n]-rawB[n]);const loopMeanDelta=difference/rawA.length;assert.ok(loopMeanDelta<.05,work.name+' endpoint continuity');
  await page.setViewportSize({width:390,height:844});await page.evaluate(t=>__motion.seek(t),work.still);await page.waitForTimeout(80);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  const mobilePath=path.join(root,`review/${String(i+1).padStart(2,'0')}-mobile.png`);await page.screenshot({path:mobilePath,fullPage:true});mobile.push(mobilePath);
  await page.setViewportSize({width:820,height:1180});await page.waitForTimeout(40);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.setViewportSize({width:1100,height:1400});await page.evaluate(t=>{const stage=document.querySelector('.stage');stage.style.width='900px';stage.style.height='1000px';__motion.seek(t);},work.still);await page.waitForTimeout(120);const preview=await page.locator('.stage').screenshot();await sharp(preview).webp({quality:88}).toFile(path.join(root,`assets/preview-${i+1}.webp`));
  await page.setViewportSize({width:1440,height:1100});
  results.push({work:work.name,http:200,deterministic,controls:true,keyboard:true,fullscreen:true,mobileOverflow:false,tabletOverflow:false,loopMeanDelta,renderMs:perf});
 }
 await page.emulateMedia({reducedMotion:'reduce'});
 for(const work of works){await page.goto(url+work.slug+'/');await page.waitForFunction(()=>window.__motion?.ready);assert.equal(await page.evaluate(()=>__motion.playing),false);assert.equal(await page.evaluate(()=>__motion.time),work.still);await page.locator('.play').click();assert.ok(await page.evaluate(()=>__motion.playing));}
 await page.goto(url);assert.equal(await page.locator('.work').count(),6);await page.locator('img').evaluateAll(imgs=>Promise.all(imgs.map(img=>img.decode())));await page.screenshot({path:path.join(root,'review/catalogue-desktop.png'),fullPage:true});
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(root,'review/catalogue-mobile.png'),fullPage:true});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 assert.deepEqual(errors,[]);
 const tiles=await Promise.all(stills.map(async(p,i)=>({input:await sharp(p).resize(480,330,{fit:'contain',background:'#f1f0e9'}).png().toBuffer(),left:(i%3)*480,top:Math.floor(i/3)*330})));
 await sharp({create:{width:1440,height:1980,channels:3,background:'#f1f0e9'}}).composite(tiles).png().toFile(path.join(root,'review/contact-sheet.png'));
 const mt=await Promise.all(mobile.map(async(p,i)=>({input:await sharp(p).resize({width:260}).png().toBuffer(),left:i*260,top:0})));
 await sharp({create:{width:1560,height:1100,channels:3,background:'#f1f0e9'}}).composite(mt).png().toFile(path.join(root,'review/mobile-sheet.png'));
 await fs.writeFile(path.join(root,'review/verification.json'),JSON.stringify({date:new Date().toISOString(),browser:await browser.version(),errors,results,reducedMotion:'all six paused on representative composition; explicit play works',catalogue:'six links and decoded local previews; no mobile overflow'},null,2));
 console.log(JSON.stringify({passed:results.length,errors,results},null,2));await browser.close();
})().catch(e=>{console.error(e);process.exit(1);});
