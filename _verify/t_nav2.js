const {chromium}=require('playwright');const path=require('path');
const EXE='/opt/vm/preinstall/ms-playwright/chromium_headless_shell-1169/chrome-linux/headless_shell';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const b=await chromium.launch({headless:true,executablePath:EXE});
  const page=await b.newPage({viewport:{width:390,height:844}});
  let err=0;page.on('pageerror',e=>{err++;console.log('[pageerror]',e.message)});
  await page.goto('file://'+path.resolve('index.html'));
  await page.waitForFunction(()=>window.__app);await sleep(400);
  await page.evaluate(()=>location.hash='#/home');await sleep(300);
  await page.evaluate(()=>location.hash='#/trash');
  await sleep(60);
  await page.screenshot({path:'_verify/shots/nav_push_trash_60.png'});
  await sleep(450);
  // 物理返回键等价：history.back
  await page.evaluate(()=>history.back());
  await sleep(120);
  await page.screenshot({path:'_verify/shots/nav_pop_120.png'});
  await sleep(450);
  console.log('errors:',err);
  await b.close();
})();
