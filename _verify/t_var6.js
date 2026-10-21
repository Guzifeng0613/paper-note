const {chromium}=require('playwright');const path=require('path');
const EXE='/opt/vm/preinstall/ms-playwright/chromium_headless_shell-1169/chrome-linux/headless_shell';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const b=await chromium.launch({headless:true,executablePath:EXE});
  const ctx=await b.newContext({viewport:{width:390,height:844},reducedMotion:'no-preference'});
  const page=await ctx.newPage();
  await page.goto('file://'+path.resolve('index.html'));
  await page.waitForFunction(()=>window.__app);
  const r=await page.evaluate(()=>{
    const e=document.querySelector('#scr-settings');
    const out={base:getComputedStyle(e).transitionDuration};
    const st=document.createElement('style');
    st.textContent='.screen{transition-property:transform;transition-duration:.36s;transition-timing-function:cubic-bezier(.22,1,.36,1)}';
    document.head.appendChild(st);
    out.longhand=getComputedStyle(e).transitionDuration;
    const st2=document.createElement('style');
    st2.textContent='.screen{transition:transform .36s cubic-bezier(.22,1,.36,1)!important}';
    document.head.appendChild(st2);
    out.important=getComputedStyle(e).transitionDuration;
    return out;
  });
  console.log(JSON.stringify(r,null,1));
  await b.close();
})();
