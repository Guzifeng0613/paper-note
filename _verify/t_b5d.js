const {chromium}=require('playwright');const path=require('path');
const EXE='/opt/vm/preinstall/ms-playwright/chromium_headless_shell-1169/chrome-linux/headless_shell';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const b=await chromium.launch({headless:true,executablePath:EXE});
  const ctx=await b.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'no-preference'});
  const page=await ctx.newPage();
  page.on('pageerror',e=>console.log('[pageerror]',e.message));
  await page.goto('file://'+path.resolve('index.html'));
  await page.waitForFunction(()=>window.__app);await sleep(400);
  await page.evaluate(()=>location.hash='#/home');await sleep(300);
  await page.evaluate(()=>{const c=document.querySelector('#notesWrap .note-card');window.__app.enterSelect(c.dataset.id);});
  await sleep(300);
  const r=await page.evaluate(()=>{
    try{
      const rm=reduceMotion();
      let err=null;
      try{ haptic(12); }catch(e){err='haptic:'+e.message;}
      const btn=document.querySelector('#selectAll');
      btn.click();
      return {rm,err,hapticLen:haptic.toString().length,
        onNow:document.querySelectorAll('#notesWrap .sel-circle.on').length};
    }catch(e){return {fatal:e.message,stack:e.stack};}
  });
  console.log(JSON.stringify(r,null,1));
  await sleep(500);
  console.log('@500 on:',await page.evaluate(()=>document.querySelectorAll('#notesWrap .sel-circle.on').length));
  await b.close();
})();
