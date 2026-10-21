const {chromium}=require('playwright');const path=require('path');
const EXE='/opt/vm/preinstall/ms-playwright/chromium_headless_shell-1169/chrome-linux/headless_shell';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const b=await chromium.launch({headless:true,executablePath:EXE});
  const ctx=await b.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'no-preference'});
  const page=await ctx.newPage();
  await page.goto('file://'+path.resolve('index.html'));
  await page.waitForFunction(()=>window.__app);await sleep(300);
  await page.evaluate(()=>location.hash='#/home');await sleep(300);
  page.evaluate(()=>location.hash='#/settings');
  await sleep(45);
  let st=await page.evaluate(()=>{const e=document.querySelector('#scr-settings');const cs=getComputedStyle(e);return {cls:e.className,tr:cs.transform};});
  console.log('@45',JSON.stringify(st));
  await page.screenshot({path:'_verify/shots/push_45.png'});
  await b.close();
})();
