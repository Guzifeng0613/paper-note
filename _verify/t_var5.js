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
    const out=[];
    const rulesOf=s=>{try{return [...s.cssRules]}catch(e){return []}};
    function walk(rules){
      for(const r of rules){
        if(r.type===CSSRule.MEDIA_RULE)walk(rulesOf(r));
        else if(r.cssRules)walk(rulesOf(r));
        else if(r.selectorText&&r.selectorText.includes('.screen')&&r.style.transition)
          out.push(r.selectorText+' => '+r.style.transition);
      }
    }
    Array.from(document.styleSheets).forEach(s=>walk(rulesOf(s)));
    return {out, computed:getComputedStyle(document.querySelector('#scr-settings')).transition};
  });
  console.log(JSON.stringify(r,null,1));
  await b.close();
})();
