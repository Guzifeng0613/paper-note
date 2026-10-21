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
  const onSettings=()=>page.evaluate(()=>location.hash.includes('/settings'));

  /* 1. 左缘起手的纯纵向快速滑动（拇指滚动）——不应返回 */
  await page.mouse.move(10,400);await page.mouse.down();
  await page.mouse.move(11,300,{steps:4});await page.mouse.move(12,180,{steps:6});
  await page.mouse.up();
  await sleep(600);
  assert(await onSettings(),'左缘纵向滚动不误触返回');

  /* 2. 左缘对角线滑动（dy 略大于 dx）——不应返回 */
  await page.mouse.move(8,500);await page.mouse.down();
  await page.mouse.move(30,440,{steps:3});await page.mouse.move(48,380,{steps:5});
  await page.mouse.up();
  await sleep(600);
  assert(await onSettings(),'左缘小斜向滑动不误触返回');

  /* 3. 左缘起手纵向滚动后中途明显右移（常见拇指轨迹）——不应返回 */
  await page.mouse.move(12,600);await page.mouse.down();
  await page.mouse.move(14,500,{steps:3});
  await page.mouse.move(60,430,{steps:6});
  await page.mouse.up();
  await sleep(600);
  assert(await onSettings(),'先纵后横的拇指滚动不误触返回');

  /* 4. 明确的返回手势（大幅右滑）应返回 */
  await page.mouse.move(8,300);await page.mouse.down();
  await page.mouse.move(80,300,{steps:4});await page.mouse.move(140,300,{steps:5});
  await page.mouse.up();
  await sleep(600);
  assert(!(await onSettings()),'大幅水平右滑仍正常返回');
  console.log('done');
  await b.close();
})();
