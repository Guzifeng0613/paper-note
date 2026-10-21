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
    function walk(rules){
      let rs;try{rs=[...rules]}catch(e){return}
      for(const r of rs){
        if(r.type===CSSRule.MEDIA_RULE)walk(r.cssRules);
        else if(r.selectorText&&r.selectorText.includes('.screen')&&r.style.transition)
          out.push(r.selectorText+' => '+r.style.transition);
      }
    }
    Array.from(document.styleSheets).forEach(s=>walk(s.cssRules));
    return {out, computed:getComputedStyle(document.querySelector('#scr-settings')).transition};
  });
  console.log(JSON.stringify(r,null,1));
  await b.close();
})();
