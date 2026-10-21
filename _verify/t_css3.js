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
    const x0=c.getBoundingClientRect().left;
    c.style.transform='translateX(20px)';
    const cs=getComputedStyle(c).transform;
    const x1=c.getBoundingClientRect().left;
    // 对比一个普通 div
    const d=document.createElement('div');d.style.cssText='position:fixed;left:0;top:0;width:10px;height:10px;transform:perspective(820px) rotateX(2deg)';
    document.body.appendChild(d);
    const dcs=getComputedStyle(d).transform;
    // 卡片父级
    const parent=c.parentElement;
    const pcs=getComputedStyle(parent).display;
    // 检查卡片是否被任何选择器命中 transform
    return {cs,x1,x0,dcs,parentTag:parent.className,parentDisplay:pcs};
  });
  console.log(JSON.stringify(r,null,1));
  await b.close();
})();
