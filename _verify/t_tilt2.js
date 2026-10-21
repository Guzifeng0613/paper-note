const {chromium}=require('playwright');const path=require('path');
const EXE='/opt/vm/preinstall/ms-playwright/chromium_headless_shell-1169/chrome-linux/headless_shell';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const b=await chromium.launch({headless:true,executablePath:EXE});
  const ctx=await b.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'no-preference'});
  const page=await ctx.newPage();
  await page.goto('file://'+path.resolve('index.html'));
  await page.waitForFunction(()=>window.__app);await sleep(1000);
  await page.evaluate(()=>location.hash='#/home');await sleep(800);
  const r=await page.evaluate(()=>{
    const wrap=document.querySelector('#notesWrap');
    const c=document.querySelector('#notesWrap .note-card');
    const b=c.getBoundingClientRect();
    c.dispatchEvent(new PointerEvent('pointerdown',{clientX:b.left+40,clientY:b.top+30,bubbles:true}));
    const cs=getComputedStyle(c);
    const af=getComputedStyle(c,'::after');
    return {wrapClass:wrap.className,cardAnim:cs.animationName,cardAnimDur:cs.animationDuration,
      transform:cs.transform,afterOpacity:af.opacity,
      pressedRuleMatch:c.matches('.note-card.pressing'),
      vars:{rx:c.style.getPropertyValue('--rx'),ry:c.style.getPropertyValue('--ry')}};
  });
  console.log(JSON.stringify(r,null,1));
  await b.close();
})();
