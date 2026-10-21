const {chromium}=require('playwright');const path=require('path');
const EXE='/opt/vm/preinstall/ms-playwright/chromium_headless_shell-1169/chrome-linux/headless_shell';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const b=await chromium.launch({headless:true,executablePath:EXE});
  const ctx=await b.newContext({viewport:{width:360,height:780},isMobile:true,hasTouch:true,reducedMotion:'no-preference'});
  const page=await ctx.newPage();
  page.on('pageerror',e=>console.log('[pageerror]',e.message));
  const assert=(c,m)=>{if(c)console.log('PASS:',m);else{console.log('FAIL:',m);process.exitCode=1;}};
  await page.goto('file://'+path.resolve('index.html'));
  await page.waitForFunction(()=>window.__app);await sleep(400);
  await page.evaluate(()=>location.hash='#/settings');
  await sleep(500);
  const onSettings=()=>page.evaluate(()=>location.hash.includes('/settings'));
  /* 1. 直接在「浅色」按钮上（x=35，接近边缘）按下、抖动 10px 再抬手：不返回 */
  await page.mouse.move(35,133);await page.mouse.down();
  await page.mouse.move(45,132,{steps:3});await page.mouse.move(35,133,{steps:3});
  await page.mouse.up();
  await sleep(700);
  assert(await onSettings(),'浅色键附近抖动抬手不误返回');
  /* 2. 从左缘拖到浅色按钮区（小位移 52px）：不返回 */
  await page.mouse.move(8,133);await page.mouse.down();
  await page.mouse.move(20,133,{steps:3});await page.mouse.move(60,133,{steps:4});
  await page.mouse.up();
  await sleep(700);
  assert(await onSettings(),'从左缘短拖到主题按钮区不返回');
  /* 3. 正常主题按钮点击（深色）正常切换 */
  const dark=await page.evaluate(()=>{const r=document.querySelector('#themeSeg [data-t="dark"]').getBoundingClientRect();
    return{x:r.left+r.width/2,y:r.top+r.height/2};});
  await page.mouse.click(dark.x,dark.y);
  await sleep(1000);
  assert(await page.evaluate(()=>window.__app.prefs.theme==='dark'),'点击深色按钮正常切换');
  assert(await onSettings(),'切换主题后仍停留在设置页');
  /* 4. 从空白区正常右滑返回仍有效 */
  await page.mouse.move(10,300);await page.mouse.down();
  await page.mouse.move(80,300,{steps:4});await page.mouse.move(140,300,{steps:5});
  await page.mouse.up();
  await sleep(700);
  assert(await page.evaluate(()=>location.hash.includes('/home')),'从空白区正常右滑返回仍有效');
  await b.close();
})();
