const {chromium}=require('playwright');const path=require('path');
const EXE='/opt/vm/preinstall/ms-playwright/chromium_headless_shell-1169/chrome-linux/headless_shell';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const b=await chromium.launch({headless:true,executablePath:EXE});
  const ctx=await b.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'no-preference'});
  const page=await ctx.newPage();
  await page.goto('file://'+path.resolve('index.html'));
  await page.waitForFunction(()=>window.__app);await sleep(600);
  const r=await page.evaluate(()=>{
    const c=document.querySelector('#notesWrap .note-card');
    const out={};
    out.baseTransform=getComputedStyle(c).transform;
    c.classList.add('pressing');
    c.style.setProperty('--rx','2.21deg');c.style.setProperty('--ry','-2.96deg');
    out.pressingTransform=getComputedStyle(c).transform;
    out.shadow=getComputedStyle(c).boxShadow.slice(0,40);
    c.style.transform='perspective(820px) rotateX(2deg) rotateY(-3deg) scale(.98)';
    out.inlineTransform=getComputedStyle(c).transform;
    return out;
  });
  console.log(JSON.stringify(r,null,1));
  await b.close();
})();
