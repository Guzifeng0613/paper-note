const {chromium}=require('playwright');const path=require('path');
const fs=require('fs');
const EXE='/opt/vm/preinstall/ms-playwright/chromium_headless_shell-1169/chrome-linux/headless_shell';
const dir='/tmp/pw-clean-'+Date.now();
(async()=>{
  const b=await chromium.launch({headless:true,executablePath:EXE,args:['--user-data-dir='+dir]});
  const ctx=await b.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'no-preference'});
  const page=await ctx.newPage();
  page.on('pageerror',e=>console.log('[pageerror]',e.message));
  await page.goto('file://'+path.resolve('index.html'));
  await page.waitForFunction(()=>window.__app);await new Promise(r=>setTimeout(r,400));
  const n=await page.evaluate(()=>window.__app.notes.length);
  console.log('clean profile notes count:',n);
  await b.close();
})();
