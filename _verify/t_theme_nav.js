const {chromium}=require('playwright');const path=require('path');
const EXE='/opt/vm/preinstall/ms-playwright/chromium_headless_shell-1169/chrome-linux/headless_shell';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const b=await chromium.launch({headless:true,executablePath:EXE});
  const ctx=await b.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'no-preference'});
  const page=await ctx.newPage();
  page.on('pageerror',e=>console.log('[pageerror]',e.message));
  page.on('console',m=>{const t=m.text();if(t.includes('hash')||t.includes('NAV'))console.log('[console]',t);});
  const assert=(c,m)=>{if(c)console.log('PASS:',m);else{console.log('FAIL:',m);process.exitCode=1;}};
  await page.goto('file://'+path.resolve('index.html'));
  await page.waitForFunction(()=>window.__app);await sleep(400);
  await page.evaluate(()=>location.hash='#/settings');
  await sleep(500);
  await page.evaluate(()=>{
    window.addEventListener('hashchange',()=>console.log('NAV hashchange -> '+location.hash));
  });
  /* 触控点击三个主题按钮（touchscreen 路径） */
  for(const t of ['dark','light','auto']){
    const p=await page.evaluate(t=>{const el=document.querySelector('#themeSeg [data-t="'+t+'"]');
      const r=el.getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2};},t);
    await page.touchscreen.tap(p.x,p.y);
    await sleep(1000);
    const h=await page.evaluate(()=>location.hash);
    assert(h.includes('/settings'),'触控点「'+t+'」后仍在设置页（'+h+'）');
  }
  await b.close();
})();
