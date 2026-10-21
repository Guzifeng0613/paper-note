const {chromium}=require('playwright');const path=require('path');
const EXE='/opt/vm/preinstall/ms-playwright/chromium_headless_shell-1169/chrome-linux/headless_shell';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const b=await chromium.launch({headless:true,executablePath:EXE});
  const ctx=await b.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'no-preference'});
  const page=await ctx.newPage();
  await page.goto('file://'+path.resolve('index.html'));
  await page.waitForFunction(()=>window.__app);await sleep(1200);
  await page.evaluate(()=>{
    const c=document.querySelector('#notesWrap .note-card');
    const r=c.getBoundingClientRect();
    c.dispatchEvent(new PointerEvent('pointerdown',{clientX:r.left+50,clientY:r.top+40,bubbles:true}));
  });
  await sleep(200);
  await page.screenshot({path:'_verify/shots/b_tilt2.png'});
  await b.close();
})();
