const {chromium}=require('playwright');const path=require('path');
const EXE='/opt/vm/preinstall/ms-playwright/chromium_headless_shell-1169/chrome-linux/headless_shell';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const b=await chromium.launch({headless:true,executablePath:EXE});
  const ctx=await b.newContext({viewport:{width:360,height:780},isMobile:true,hasTouch:true,reducedMotion:'no-preference'});
  const page=await ctx.newPage();
  const cdp=await ctx.newCDPSession(page);
  await page.goto('file://'+path.resolve('index.html'));
  await page.waitForFunction(()=>window.__app);await sleep(400);
  await page.evaluate(()=>location.hash='#/settings');
  await sleep(500);
  await page.evaluate(()=>{
    window.__ev=[];
    const back=document.querySelector('#settingsBack');
    ['pointerdown','pointerup','click','touchstart','touchend','mousedown','mouseup','focus','focusin','pointerenter'].forEach(t=>
      back.addEventListener(t,e=>window.__ev.push(t),true));
    document.addEventListener('focusin',e=>window.__ev.push('focusin:'+(e.target&&e.target.id)),true);
  });
  /* 点深色按钮，按住 600ms（跨过 470ms DOM 重建） */
  const p=await page.evaluate(()=>{const r=document.querySelector('#themeSeg [data-t="dark"]').getBoundingClientRect();
    return{x:r.left+r.width/2,y:r.top+r.height/2};});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:p.x,y:p.y}]});
  await sleep(600);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await sleep(800);
  const ev=await page.evaluate(()=>window.__ev);
  console.log('返回键/聚焦事件:',JSON.stringify(ev));
  const h=await page.evaluate(()=>location.hash);
  console.log('hash:',h);
  await b.close();
})();
