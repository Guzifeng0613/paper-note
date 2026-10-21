const {chromium}=require('playwright');
const path=require('path');
const EXE='/opt/vm/preinstall/ms-playwright/chromium_headless_shell-1169/chrome-linux/headless_shell';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const b=await chromium.launch({headless:true,executablePath:EXE,args:['--force-prefers-reduced-motion=no']});
  const page=await b.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
  page.on('pageerror',e=>console.log('[pageerror]',e.message));
  await page.goto('file://'+path.resolve('index.html'));
  await page.waitForFunction(()=>window.__app);await sleep(400);
  await page.evaluate(()=>location.hash='#/home');await sleep(300);
  // push 到设置，中途截图
  await page.evaluate(()=>location.hash='#/settings');
  await sleep(120);
  await page.screenshot({path:'_verify/shots/nav_push_mid.png'});
  await sleep(500);
  // 边缘跟手拖动（模拟一半）
  const cx=10, cy=400;
  await page.mouse.move(cx,cy);
  await page.mouse.down();
  await page.mouse.move(60,cy,{steps:5});await sleep(60);
  await page.mouse.move(150,cy,{steps:8});await sleep(60);
  await page.screenshot({path:'_verify/shots/nav_drag_mid.png'});
  await page.mouse.move(170,cy,{steps:4});await sleep(40);
  await page.mouse.up();
  await sleep(500);
  await page.screenshot({path:'_verify/shots/nav_after_back.png'});
  const hash=await page.evaluate(()=>location.hash);
  console.log('after gesture hash:',hash);
  await b.close();
})();
