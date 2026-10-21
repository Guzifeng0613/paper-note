const {chromium}=require('playwright');const path=require('path');
const EXE='/opt/vm/preinstall/ms-playwright/chromium_headless_shell-1169/chrome-linux/headless_shell';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const b=await chromium.launch({headless:true,executablePath:EXE});
  const ctx=await b.newContext({viewport:{width:360,height:792},isMobile:true,hasTouch:true,reducedMotion:'no-preference'});
  const page=await ctx.newPage();
  page.on('pageerror',e=>console.log('[pageerror]',e.message));
  const assert=(c,m)=>{if(c)console.log('PASS:',m);else{console.log('FAIL:',m);process.exitCode=1;}};
  await page.goto('file://'+path.resolve('index.html'));
  await page.waitForFunction(()=>window.__app);await sleep(400);
  await page.evaluate(()=>location.hash='#/settings');
  await sleep(500);
  await page.evaluate(()=>window.__db=document.querySelector('#themeSeg [data-t="dark"]'));
  const p=await page.evaluate(()=>{const r=document.querySelector('#themeSeg [data-t="dark"]').getBoundingClientRect();
    return{x:r.left+r.width/2,y:r.top+r.height/2};});
  const bp=await page.evaluate(()=>{const r=document.querySelector('#settingsBack').getBoundingClientRect();
    return{x:r.left+r.width/2,y:r.top+r.height/2};});
  await page.mouse.click(p.x,p.y);
  /* 扩散期间用真实鼠标事件点返回键（受 pointer-events 拦截） */
  await sleep(120);
  assert(await page.evaluate(()=>document.body.classList.contains('theme-reveal-on')),'扩散期间 body 已加锁');
  await page.mouse.click(bp.x,bp.y);
  await sleep(150);
  assert(await page.evaluate(()=>location.hash.includes('/settings')),'扩散期间真实点击返回键不退出');
  /* 扩散结束后锁解除 */
  await sleep(900);
  assert(await page.evaluate(()=>!document.body.classList.contains('theme-reveal-on')),'扩散结束后锁解除');
  assert(await page.evaluate(()=>document.querySelector('#themeSeg [data-t="dark"]')===window.__db),'设置页 DOM 未重建');
  assert(await page.evaluate(()=>document.querySelector('#themeSeg [data-t="dark"]').classList.contains('on')),'深色按钮 on');
  /* 真实点击返回键恢复正常 */
  await page.mouse.click(bp.x,bp.y);
  await sleep(500);
  assert(await page.evaluate(()=>location.hash.includes('/home')),'结束后返回键正常退出');
  /* 第二轮：浅色 */
  await page.evaluate(()=>location.hash='#/settings');
  await sleep(400);
  const lp=await page.evaluate(()=>{const r=document.querySelector('#themeSeg [data-t="light"]').getBoundingClientRect();
    return{x:r.left+r.width/2,y:r.top+r.height/2};});
  await page.mouse.click(lp.x,lp.y);
  await sleep(200);
  await page.mouse.click(bp.x,bp.y);
  await sleep(200);
  assert(await page.evaluate(()=>location.hash.includes('/settings')),'浅色切换期间点返回键也不退出');
  await b.close();
})();
