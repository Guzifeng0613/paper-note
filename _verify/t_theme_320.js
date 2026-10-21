const {chromium}=require('playwright');const path=require('path');
const EXE='/opt/vm/preinstall/ms-playwright/chromium_headless_shell-1169/chrome-linux/headless_shell';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const b=await chromium.launch({headless:true,executablePath:EXE});
  const ctx=await b.newContext({viewport:{width:320,height:720},isMobile:true,hasTouch:true,reducedMotion:'no-preference'});
  const page=await ctx.newPage();
  await page.goto('file://'+path.resolve('index.html'));
  await page.waitForFunction(()=>window.__app);await sleep(400);
  await page.evaluate(()=>location.hash='#/settings');
  await sleep(500);
  const r=await page.evaluate(()=>{
    const l=document.querySelector('#themeSeg [data-t="light"]').getBoundingClientRect();
    const a=document.querySelector('#themeSeg [data-t="auto"]').getBoundingClientRect();
    return{light:{left:Math.round(l.left),right:Math.round(l.right)},auto:{left:Math.round(a.left),right:Math.round(a.right)},innerW:innerWidth};
  });
  console.log(JSON.stringify(r));
  await b.close();
})();
