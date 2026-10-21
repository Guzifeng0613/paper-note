const {chromium}=require('playwright');const path=require('path');
const EXE='/opt/vm/preinstall/ms-playwright/chromium_headless_shell-1169/chrome-linux/headless_shell';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const b=await chromium.launch({headless:true,executablePath:EXE});
  const ctx=await b.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'no-preference'});
  const page=await ctx.newPage();
  let err=0;page.on('pageerror',e=>{err++;console.log('[pageerror]',e.message)});
  await page.goto('file://'+path.resolve('index.html'));
  await page.waitForFunction(()=>window.__app);await sleep(400);
  await page.evaluate(()=>location.hash='#/home');await sleep(300);
  // 打开一个 todo 笔记
  const id=await page.evaluate(()=>{const n=window.__app.notes.find(x=>x.type==='todo');location.hash='#/edit?id='+n.id;return n.id;});
  await sleep(500);
  await page.screenshot({path:'_verify/shots/edit_push.png'});
  // 点返回箭头
  await page.click('#editBack');
  await sleep(150);
  await page.screenshot({path:'_verify/shots/edit_pop.png'});
  await sleep(400);
  console.log('hash:',await page.evaluate(()=>location.hash),'editor class:',
    await page.evaluate(()=>document.querySelector('#scr-edit').className));
  // 再次进入确认无残留
  await page.evaluate(()=>{location.hash='#/edit?id='+id;});
  await sleep(500);
  console.log('reenter class:',await page.evaluate(()=>document.querySelector('#scr-edit').className));
  await page.screenshot({path:'_verify/shots/edit_reenter.png'});
  console.log('errors:',err);
  await b.close();
})();
