const {chromium}=require('playwright');const path=require('path');
const EXE='/opt/vm/preinstall/ms-playwright/chromium_headless_shell-1169/chrome-linux/headless_shell';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const b=await chromium.launch({headless:true,executablePath:EXE});
  const ctx=await b.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'no-preference'});
  const page=await ctx.newPage();
  await page.goto('file://'+path.resolve('index.html'));
  await page.waitForFunction(()=>window.__app);await sleep(400);
  await page.evaluate(()=>location.hash='#/settings');
  await sleep(500);
  const p=await page.evaluate(()=>{
    const b=document.querySelector('#themeSeg [data-t="dark"]');
    const rc=b.getBoundingClientRect();return{x:rc.left+rc.width/2,y:rc.top+rc.height/2};
  });
  await page.mouse.click(p.x,p.y);
  await sleep(260);
  await page.screenshot({path:'_verify/shots/f_reveal_mid.png'});
  await sleep(1200);
  const clean=await page.evaluate(()=>document.querySelectorAll('.theme-reveal').length);
  console.log('reveal after 1.5s:',clean);
  await page.screenshot({path:'_verify/shots/f_reveal_end.png'});
  await b.close();
})();
