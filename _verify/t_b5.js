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
  const dbg1=await page.evaluate(()=>({sel:document.querySelectorAll('#notesWrap .sel-circle').length,
    cards:document.querySelectorAll('#notesWrap .note-card').length,
    vis:window.__app.visibleNotes().length,
    selectedSize:window.__app ? 'n/a':0}));
  console.log('after enterSelect:',JSON.stringify(dbg1));
  await page.evaluate(()=>document.querySelector('#selectAll').click());
  await sleep(50);
  const dbg2=await page.evaluate(()=>({on:document.querySelectorAll('#notesWrap .sel-circle.on').length,
    allBtn:document.querySelector('#selectAll').className}));
  console.log('@50ms:',JSON.stringify(dbg2));
  await sleep(400);
  const dbg3=await page.evaluate(()=>({on:document.querySelectorAll('#notesWrap .sel-circle.on').length}));
  console.log('@450ms:',JSON.stringify(dbg3));
  await b.close();
})();
