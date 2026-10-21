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
  const res=await page.evaluate(()=>{
    const h=document.querySelector('#selectAll').onclick;
    try{h.call(document.querySelector('#selectAll'));return {ok:true};}
    catch(e){return {err:e.message,stack:e.stack};}
  });
  console.log(JSON.stringify(res,null,1));
  await sleep(400);
  console.log('on:',await page.evaluate(()=>document.querySelectorAll('#notesWrap .sel-circle.on').length));
  await b.close();
})();
