const {chromium}=require('playwright');const path=require('path');
const EXE='/opt/vm/preinstall/ms-playwright/chromium_headless_shell-1169/chrome-linux/headless_shell';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const b=await chromium.launch({headless:true,executablePath:EXE});
  const page=await b.newPage({viewport:{width:390,height:844}});
  await page.goto('file://'+path.resolve('index.html'));
  await page.waitForFunction(()=>window.__app);await sleep(400);
  await page.evaluate(()=>location.hash='#/home');await sleep(300);
  page.evaluate(()=>location.hash='#/settings');
  for(const t of [30,80,160,300]){
    await sleep(t===30?30:t-[30,80,160,0][[30,80,160,300].indexOf(t)]);
    const st=await page.evaluate(()=>{
      const e=document.querySelector('#scr-settings');
      const cs=getComputedStyle(e);
      return {cls:e.className, transform:cs.transform, trans:cs.transitionDuration, vis:cs.visibility};
    });
    console.log('t='+t,JSON.stringify(st).slice(0,220));
  }
  await b.close();
})();
