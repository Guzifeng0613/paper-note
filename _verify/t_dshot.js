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
  /* 折叠 3 个分组 */
  await page.evaluate(()=>{
    const gs=document.querySelectorAll('#settingsBody .set-group');
    gs[1].querySelector('.set-card-h').click();
    gs[2].querySelector('.set-card-h').click();
    gs[4].querySelector('.set-card-h').click();
  });
  await sleep(450);
  await page.screenshot({path:'_verify/shots/d_accordion.png'});
  /* 深色圆形扩散中段 */
  const p=await page.evaluate(()=>{
    const b=document.querySelector('#themeSeg [data-t="dark"]');
    const rc=b.getBoundingClientRect();return{x:rc.left+rc.width/2,y:rc.top+rc.height/2};
  });
  await page.mouse.move(p.x,p.y);await page.mouse.down();await page.mouse.up();
  await sleep(150);
  await page.screenshot({path:'_verify/shots/d_reveal.png'});
  await sleep(700);
  await page.evaluate(()=>{window.__app.prefs.theme='light';window.__app.persistPrefs();window.__app.applyTheme();});
  await b.close();
})();
