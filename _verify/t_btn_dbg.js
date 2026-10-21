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
  const bp=await page.evaluate(()=>{const r=document.querySelector('#settingsBack').getBoundingClientRect();
    return{x:r.left+10,y:r.top+r.height/2};});
  console.log('back btn point:',bp);
  let logs=[];
  page.on('console',m=>logs.push(m.text()));
  /* hook:监听 settingsBack 是否收到 click */
  await page.evaluate(()=>{
    document.querySelector('#settingsBack').addEventListener('click',()=>console.log('CLICK REACHED settingsBack'));
    const orig=window.history.back;
    window.history.back=function(){console.log('history.back called');orig.apply(this,arguments);};
  });
  await page.mouse.move(bp.x,bp.y);await page.mouse.down();
  await page.mouse.move(bp.x+40,bp.y,{steps:4});
  await page.mouse.move(bp.x+20,bp.y,{steps:3});
  await page.mouse.up();
  await sleep(700);
  console.log('hash:',await page.evaluate(()=>location.hash));
  console.log(logs.join('\n'));
  await b.close();
})();
