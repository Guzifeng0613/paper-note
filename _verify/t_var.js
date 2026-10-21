const {chromium}=require('playwright');const path=require('path');
const EXE='/opt/vm/preinstall/ms-playwright/chromium_headless_shell-1169/chrome-linux/headless_shell';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const b=await chromium.launch({headless:true,executablePath:EXE});
  const page=await b.newPage({viewport:{width:390,height:844}});
  await page.goto('file://'+path.resolve('index.html'));
  await page.waitForFunction(()=>window.__app);
  const r=await page.evaluate(()=>{
    const cs=getComputedStyle(document.documentElement);
    const e=document.querySelector('#scr-settings');
    const cs2=getComputedStyle(e);
    return {dur4:cs.getPropertyValue('--dur-4'),ease:cs.getPropertyValue('--ease-decel'),
      full:cs2.transition};
  });
  console.log(JSON.stringify(r));
  await b.close();
})();
