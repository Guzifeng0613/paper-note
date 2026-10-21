const {chromium}=require('playwright');const path=require('path');
const EXE='/opt/vm/preinstall/ms-playwright/chromium_headless_shell-1169/chrome-linux/headless_shell';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const b=await chromium.launch({headless:true,executablePath:EXE});
  const ctx=await b.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'no-preference'});
  const page=await ctx.newPage();
  page.on('pageerror',e=>console.log('[pageerror]',e.message,'\n',e.stack&&e.stack.split('\n').slice(0,5).join('\n')));
  await page.goto('file://'+path.resolve('index.html'));
  await page.waitForFunction(()=>window.__app);await sleep(1200);
  await page.evaluate(()=>location.hash='#/home');await sleep(400);
  await page.evaluate(()=>{const c=document.querySelector('#notesWrap .note-card');window.__app.enterSelect(c.dataset.id);});
  await sleep(200);
  await page.evaluate(()=>{const c=document.querySelector('#notesWrap .note-card');
    const r=c.getBoundingClientRect();
    c.dispatchEvent(new PointerEvent('pointerdown',{clientX:r.left+30,clientY:r.top+30,bubbles:true}));});
  await page.evaluate(()=>window.__app.exitSelect());
  await sleep(200);
  const flip=await page.evaluate(()=>{
    const app=window.__app;
    app.prefs.notebooks=(app.prefs.notebooks||[]).concat(['AA新本','BB新本']);
    app.renderChips();
    return 1;
  });
  for(const s of ['trash','settings','edit','home','pan']){
    await page.evaluate(x=>location.hash='#/'+x,s);
    await sleep(300);
  }
  await page.evaluate(()=>location.hash='#/home');await sleep(300);
  await page.evaluate(()=>{const c=document.querySelector('#notesWrap .note-card');c.click();});
  await sleep(500);
  await page.evaluate(()=>location.hash='#/home');
  await sleep(600);
  await b.close();
})();
