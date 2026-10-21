const {chromium}=require('playwright');const path=require('path');const fs=require('fs');
const EXE='/opt/vm/preinstall/ms-playwright/chromium_headless_shell-1169/chrome-linux/headless_shell';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const b=await chromium.launch({headless:true,executablePath:EXE});
  const ctx=await b.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'no-preference'});
  const page=await ctx.newPage();
  await page.goto('file://'+path.resolve('index.html'));
  await page.waitForFunction(()=>window.__app);await sleep(400);
  await page.evaluate(()=>window.__app.openFontSizeSheet());
  await sleep(300);
  await page.screenshot({path:'_verify/shots/c_ruler.png'});
  await page.evaluate(()=>closeModal());
  await b.close();
})();
