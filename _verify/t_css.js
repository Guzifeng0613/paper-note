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
    const hits=[];
    for(const sheet of document.styleSheets){
      let rules;try{rules=sheet.cssRules;}catch(e){continue;}
      for(const rule of rules){
        if(rule.selectorText&&/pressing|note-card::after/.test(rule.selectorText))
          hits.push({sel:rule.selectorText,css:rule.style.cssText.slice(0,200)});
      }
    }
    return hits;
  });
  console.log(JSON.stringify(r,null,1));
  await b.close();
})();
