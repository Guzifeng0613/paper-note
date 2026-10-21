const {chromium}=require('playwright');const path=require('path');
const EXE='/opt/vm/preinstall/ms-playwright/chromium_headless_shell-1169/chrome-linux/headless_shell';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const b=await chromium.launch({headless:true,executablePath:EXE});
  const ctx=await b.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'no-preference'});
  const page=await ctx.newPage();
  await page.goto('file://'+path.resolve('index.html'));
  await page.waitForFunction(()=>window.__app);await sleep(400);
  await page.evaluate(()=>{window.__app.prefs.theme='dark';window.__app.persistPrefs();window.__app.applyTheme();});
  await page.evaluate(()=>location.hash='#/settings');
  await sleep(500);
  const p=await page.evaluate(()=>{
    const b=document.querySelector('#themeSeg [data-t="light"]');
    const rc=b.getBoundingClientRect();return{x:rc.left+rc.width/2,y:rc.top+rc.height/2};
  });
  await page.mouse.click(p.x,p.y);
  await sleep(150);
  await page.screenshot({path:'_verify/shots/f_reveal_to_light.png'});
  await sleep(900);
  const clean=await page.evaluate(()=>document.querySelectorAll('.trl').length);
  const theme=await page.evaluate(()=>document.documentElement.dataset.theme);
  console.log('leftover:',clean,'theme:',theme);
  await b.close();
})();
