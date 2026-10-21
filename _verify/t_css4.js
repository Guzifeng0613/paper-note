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
    const out={matched:[]};
    function walk(rules){
      for(const rule of rules){
        if(rule.cssRules){walk(rule.cssRules);continue;}
        if(rule.selectorText){
          try{
            if(c.matches(rule.selectorText)&&rule.style.transform){
              out.matched.push({sel:rule.selectorText,transform:rule.style.transform,
                priority:rule.style.getPropertyPriority('transform')});
            }
          }catch(e){}
        }
      }
    }
    for(const sheet of document.styleSheets){try{walk(sheet.cssRules);}catch(e){}}
    out.inline=c.getAttribute('style');
    c.style.setProperty('transform','translateX(20px)','important');
    out.importantRect=Math.round(c.getBoundingClientRect().left);
    out.computedWithImportant=getComputedStyle(c).transform;
    return out;
  });
  console.log(JSON.stringify(r,null,1));
  await b.close();
})();
