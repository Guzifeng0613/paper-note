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
  await sleep(200);
  // 只保留两张中间卡片选中（视觉可见）：取消，再点选第3、4张
  await page.evaluate(()=>document.querySelector('#selectAll').click());
  await sleep(450);
  await page.evaluate(()=>document.querySelector('#selectAll').click());
  await sleep(350);
  await page.evaluate(()=>{
    const cards=document.querySelectorAll('#notesWrap .note-card');
    cards[2].click();cards[3].click();
  });
  await sleep(200);
  await page.evaluate(()=>{document.querySelector('#scr-home .screen-body').scrollTop=0;document.querySelector('#bbDelete').click();});
  await sleep(260);
  await page.screenshot({path:'_verify/shots/b_fly_260.png'});
  console.log('clone at 260:',await page.evaluate(()=>Array.from(document.querySelectorAll('body > *')).filter(e=>e.style.zIndex==='300').length));
  await sleep(600);
  await b.close();
})();
