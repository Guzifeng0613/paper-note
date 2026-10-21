const {chromium}=require('playwright');const path=require('path');
const EXE='/opt/vm/preinstall/ms-playwright/chromium_headless_shell-1169/chrome-linux/headless_shell';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const b=await chromium.launch({headless:true,executablePath:EXE});
  const ctx=await b.newContext({viewport:{width:360,height:780},isMobile:true,hasTouch:true,deviceScaleFactor:4,reducedMotion:'no-preference'});
  const page=await ctx.newPage();
  await page.goto('file://'+path.resolve('index.html'));
  await page.waitForFunction(()=>window.__app);await sleep(400);
  await page.evaluate(()=>location.hash='#/settings');
  await sleep(500);
  const rects=await page.evaluate(()=>{
    const out={};
    document.querySelectorAll('#themeSeg button').forEach(b=>{
      const r=b.getBoundingClientRect();
      out[b.dataset.t]={left:Math.round(r.left),right:Math.round(r.right),top:Math.round(r.top),bottom:Math.round(r.bottom)};
    });
    const sb=document.querySelector('#settingsBack').getBoundingClientRect();
    out.back={left:Math.round(sb.left),right:Math.round(sb.right),top:Math.round(sb.top),bottom:Math.round(sb.bottom)};
    return out;
  });
  console.log(JSON.stringify(rects,null,1));
  await b.close();
})();
