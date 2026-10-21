const {chromium}=require('playwright');const path=require('path');
const EXE='/opt/vm/preinstall/ms-playwright/chromium_headless_shell-1169/chrome-linux/headless_shell';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const b=await chromium.launch({headless:true,executablePath:EXE});
  const ctx=await b.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'no-preference'});
  const page=await ctx.newPage();
  page.on('pageerror',e=>console.log('[pageerror]',e.message));
  page.on('console',m=>console.log('[console]',m.text()));
  await page.goto('file://'+path.resolve('index.html'));
  await page.waitForFunction(()=>window.__app);await sleep(400);
  await page.evaluate(()=>location.hash='#/home');await sleep(300);
  await page.evaluate(()=>{const c=document.querySelector('#notesWrap .note-card');window.__app.enterSelect(c.dataset.id);});
  await sleep(300);
  // 直接手动执行与 handler 相同的逻辑
  const r=await page.evaluate(()=>{
    const vis=window.__app.visibleNotes();
    const cards=Array.from(document.querySelectorAll('#notesWrap .note-card'));
    vis.forEach(n=>null);
    let fired=[];
    cards.forEach((el,i)=>{
      const circle=el.querySelector('.sel-circle');
      setTimeout(()=>{circle.classList.add('on');fired.push(i);},i*26);
    });
    return new Promise(res=>setTimeout(()=>res({fired,on:document.querySelectorAll('#notesWrap .sel-circle.on').length,cards:cards.length}),400));
  });
  console.log('manual stagger:',JSON.stringify(r));
  await b.close();
})();
