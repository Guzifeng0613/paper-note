const {chromium}=require('playwright');const path=require('path');
const EXE='/opt/vm/preinstall/ms-playwright/chromium_headless_shell-1169/chrome-linux/headless_shell';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const b=await chromium.launch({headless:true,executablePath:EXE});
  const ctx=await b.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'no-preference'});
  const page=await ctx.newPage();
  page.on('pageerror',e=>console.log('[pageerror]',e.message));
  const assert=(c,m)=>{if(c)console.log('PASS:',m);else{console.log('FAIL:',m);process.exitCode=1;}};
  await page.goto('file://'+path.resolve('index.html'));
  await page.waitForFunction(()=>window.__app);await sleep(400);
  await page.evaluate(()=>location.hash='#/settings');
  await sleep(500);
  const bp=await page.evaluate(()=>{const r=document.querySelector('#settingsBack').getBoundingClientRect();
    return{x:r.left+10,y:r.top+r.height/2};});
  /* 在返回键上按下，向右拖 40px（锁成返回手势）再拖回原位抬手：取消手势，click 应被吞掉 */
  await page.mouse.move(bp.x,bp.y);await page.mouse.down();
  await page.mouse.move(bp.x+40,bp.y,{steps:4});
  await page.mouse.move(bp.x+20,bp.y,{steps:3});
  await page.mouse.up();
  await sleep(700);
  const still=await page.evaluate(()=>location.hash.includes('/settings'));
  assert(still,'返回键上拖出又拖回，不触发返回');
  /* 普通点击返回键仍然有效 */
  await page.mouse.click(bp.x,bp.y);
  await sleep(600);
  const home=await page.evaluate(()=>location.hash.includes('/home'));
  assert(home,'正常点击返回键仍可返回');
  await b.close();
})();
