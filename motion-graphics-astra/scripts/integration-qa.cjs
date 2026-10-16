const path=require('node:path'),assert=require('node:assert/strict'),fs=require('node:fs/promises');
const {chromium}=require(path.join(process.env.NODE_MODULES||'C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules','playwright'));
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'C:/Users/user/AppData/Local/ms-playwright/chromium_headless_shell-1194/chrome-win/headless_shell.exe'});
 const page=await browser.newPage(),errors=[],results=[];page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 for(let volume=1;volume<=3;volume++){
  const {works}=await import(volume===1?'../motion-vol01/shared/data.js':`../motion-vol0${volume}/data.js`);
  const base=`http://127.0.0.1:4178/motion-vol0${volume}/`;
  await page.goto(base);assert.equal(await page.locator('nav[aria-label="Other volumes"] a').count(),3);
  for(const href of await page.locator('a').evaluateAll(links=>links.map(a=>a.href))){assert.equal((await page.request.get(href)).status(),200);}
  for(const work of works){await page.goto(base+work.slug+'/?t=0');await page.waitForFunction(()=>window.__motion?.ready);
   await page.evaluate(()=>{__motion.setLoop(false);__motion.seek(__motion.duration-.04);__motion.play();});await page.waitForFunction(()=>!__motion.playing);assert.equal(await page.evaluate(()=>__motion.time),work.duration);
   await page.evaluate(()=>{__motion.setLoop(true);__motion.seek(__motion.duration-.04);__motion.play();});await page.waitForFunction(()=>__motion.time<1);await page.evaluate(()=>__motion.pause());
   await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await page.evaluate(()=>__motion.playing),false);await page.emulateMedia({reducedMotion:'no-preference'});
   for(const href of await page.locator('.masthead a,.next-work').evaluateAll(a=>a.map(x=>x.href)))assert.equal((await page.request.get(href)).status(),200);
   results.push({volume,work:work.name,loopStop:true,loopResume:true,liveReducedMotion:true,links:true});
  }
 }
 assert.deepEqual(errors,[]);await browser.close();await fs.writeFile(path.join(__dirname,'../motion-vol03/review/integration.json'),JSON.stringify({date:new Date().toISOString(),errors,results},null,2));console.log('PASS: all 18 artworks, three catalogue navs, actual links, loop stop/resume and live reduced-motion changes.');
})().catch(e=>{console.error(e);process.exit(1);});
