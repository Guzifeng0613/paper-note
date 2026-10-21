const {chromium}=require('playwright');const path=require('path');
const EXE='/opt/vm/preinstall/ms-playwright/chromium_headless_shell-1169/chrome-linux/headless_shell';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const b=await chromium.launch({headless:true,executablePath:EXE});
  const ctx=await b.newContext({viewport:{width:390,height:844},reducedMotion:'no-preference'});
  const page=await ctx.newPage();
  await page.goto('file://'+path.resolve('index.html'));
  await page.waitForFunction(()=>window.__app);await sleep(400);
  const r=await page.evaluate(()=>{
    const m=window.matchMedia('(prefers-reduced-motion:reduce)');
    const e=document.querySelector('#scr-settings');
    const cs=getComputedStyle(e);
    return {rm:m.matches, dur:cs.transitionDuration, prop:cs.transitionProperty,
      rules:[...document.styleSheets].flatMap(s=>{try{return [...s.cssRules]}catch(e){return []}})
        .filter(r=>r.selectorText&&r.selectorText.includes('.screen')&&r.style.transitionDuration)
        .map(r=>r.selectorText+' => '+r.style.transitionDuration)};
  });
  console.log(JSON.stringify(r,null,1));
  await b.close();
})();
