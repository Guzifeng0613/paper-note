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
  await page.screenshot({path:'_verify/shots/b_home_chips.png'});
  // 触点倾斜定格（JS 保持按压）
  const tilt=await page.evaluate(()=>{
    const c=document.querySelector('#notesWrap .note-card');
    const r=c.getBoundingClientRect();
    const ev=new PointerEvent('pointerdown',{clientX:r.left+40,clientY:r.top+30,bubbles:true});
    c.dispatchEvent(ev);
    return {x:Math.round(r.left+40),y:Math.round(r.top+30)};
  });
  await sleep(120);
  await page.screenshot({path:'_verify/shots/b_tilt.png'});
  await page.evaluate(()=>{
    const c=document.querySelector('#notesWrap .note-card.pressing');
    c.dispatchEvent(new PointerEvent('pointerup',{bubbles:true}));
  });
  // 错峰勾选定格
  await page.evaluate(()=>{const c=document.querySelector('#notesWrap .note-card');window.__app.enterSelect(c.dataset.id);});
  await sleep(150);
  await page.evaluate(()=>document.querySelector('#selectAll').click());
  await sleep(65);  // 定格错峰中间态
  await page.screenshot({path:'_verify/shots/b_stagger.png'});
  await b.close();
})();
