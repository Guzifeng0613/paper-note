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
    for(const s of document.styleSheets){
      let rules;try{rules=s.cssRules}catch(e){continue}
      for(const r of rules){
        if(r.type===CSSRule.MEDIA_RULE){
          for(const sub of r.cssRules){
            if(sub.selectorText&&sub.selectorText.includes('.screen')&&sub.style.transitionDuration)
              out.push(r.media.mediaText+' | '+sub.selectorText+' | '+sub.style.transitionDuration+' | media='+window.matchMedia(r.media.mediaText).matches);
          }
        }
      }
    }
    const e=document.querySelector('#scr-settings');
    e.style.transition='transform .36s cubic-bezier(.22,1,.36,1)';
    return {out, inlineDur:getComputedStyle(e).transitionDuration,
      rootDur:getComputedStyle(document.documentElement).getPropertyValue('--dur-4')};
  });
  console.log(JSON.stringify(r,null,1));
  await b.close();
})();
