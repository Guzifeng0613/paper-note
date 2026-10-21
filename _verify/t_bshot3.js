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
    c.classList.add('pressing');
    c.style.setProperty('--rx','14deg');c.style.setProperty('--ry','-12deg');
  });
  await sleep(200);
  await page.screenshot({path:'_verify/shots/b_tilt3.png'});
  await b.close();
})();
