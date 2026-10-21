const {chromium}=require('playwright');const path=require('path');
const EXE='/opt/vm/preinstall/ms-playwright/chromium_headless_shell-1169/chrome-linux/headless_shell';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const b=await chromium.launch({headless:true,executablePath:EXE});
  const ctx=await b.newContext({viewport:{width:360,height:792},isMobile:true,hasTouch:true,deviceScaleFactor:4,reducedMotion:'no-preference'});
  const page=await ctx.newPage();
  await page.goto('file://'+path.resolve('index.html'));
  await page.waitForFunction(()=>window.__app);await sleep(400);
  await page.evaluate(()=>location.hash='#/settings');
  await sleep(500);
  const p=await page.evaluate(()=>{const r=document.querySelector('#themeSeg [data-t="dark"]').getBoundingClientRect();
    return{x:r.left+r.width/2,y:r.top+r.height/2};});
  await page.mouse.click(p.x,p.y);
  /* 抓扩散各帧 */
  for(const t of [60,120,200,300,420,520]){
    await sleep(t-(t===60?0:0));
    await page.screenshot({path:'_verify/shots/rv_'+t+'.png'});
  }
  await b.close();
})();
