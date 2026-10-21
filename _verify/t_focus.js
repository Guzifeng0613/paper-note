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
    window.__f=[];
    document.addEventListener('focusin',e=>{
      const t=e.target;
      window.__f.push((t.tagName||'')+'#'+(t.id||'')+'.'+(t.className&&t.className.baseVal!==undefined?'(svg)':t.className));
    },true);
  });
  const p=await page.evaluate(()=>{const r=document.querySelector('#themeSeg [data-t="dark"]').getBoundingClientRect();
    return{x:r.left+r.width/2,y:r.top+r.height/2};});
  /* 快速点击（真实点按节奏） */
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:p.x,y:p.y}]});
  await sleep(60);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await sleep(900);
  console.log(JSON.stringify(await page.evaluate(()=>window.__f)));
  console.log('activeElement:',await page.evaluate(()=>{const a=document.activeElement;return (a.tagName||'')+'#'+(a.id||'')}));
  await b.close();
})();
