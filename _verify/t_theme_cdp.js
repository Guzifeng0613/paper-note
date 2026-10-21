const {chromium}=require('playwright');const path=require('path');
const EXE='/opt/vm/preinstall/ms-playwright/chromium_headless_shell-1169/chrome-linux/headless_shell';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const b=await chromium.launch({headless:true,executablePath:EXE});
  const ctx=await b.newContext({viewport:{width:360,height:780},isMobile:true,hasTouch:true,deviceScaleFactor:4,reducedMotion:'no-preference'});
  const page=await ctx.newPage();
  page.on('pageerror',e=>console.log('[pageerror]',e.message));
  const assert=(c,m)=>{if(c)console.log('PASS:',m);else{console.log('FAIL:',m);process.exitCode=1;}};
  const cdp=await ctx.newCDPSession(page);
  await page.goto('file://'+path.resolve('index.html'));
  await page.waitForFunction(()=>window.__app);await sleep(400);
  await page.evaluate(()=>location.hash='#/settings');
  await sleep(500);
  /* 真实触控：touchstart，落点轻微抖动 4px，再 touchend（拇指真实点击） */
  async function tap(x,y,jitter){
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}] });
    await sleep(20);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+3,y:y+2}]});
    await sleep(30);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  }
  for(const t of ['dark','light']){
    const p=await page.evaluate(t=>{const r=document.querySelector('#themeSeg [data-t="'+t+'"]').getBoundingClientRect();
      return{x:r.left+12,y:r.top+r.height/2};},t);
    /* 特意点在按钮最左缘（靠近屏幕边缘） */
    await tap(p.x,p.y);
    await sleep(1000);
    const h=await page.evaluate(()=>location.hash);
    assert(h.includes('/settings'),'真实触控点「'+t+'」左缘（带抖动）后仍在设置（'+h+'）');
  }
  await b.close();
})();
