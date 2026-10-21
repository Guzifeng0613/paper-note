const {chromium}=require('playwright');const path=require('path');
const EXE='/opt/vm/preinstall/ms-playwright/chromium_headless_shell-1169/chrome-linux/headless_shell';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const b=await chromium.launch({headless:true,executablePath:EXE});
  const ctx=await b.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'no-preference'});
  const page=await ctx.newPage();
  page.on('pageerror',e=>console.log('[pageerror]',e.message));
  await page.goto('file://'+path.resolve('index.html'));
  await page.waitForFunction(()=>window.__app);await sleep(400);
  await page.evaluate(()=>location.hash='#/home');await sleep(300);
  await page.evaluate(()=>{
    const c=document.querySelector('#notesWrap .note-card');window.__app.enterSelect(c.dataset.id);
    const wrap=document.querySelector('#notesWrap');
    window.__log=[];
    new MutationObserver(m=>{
      m.forEach(x=>{
        if(x.type==='attributes'&&x.attributeName==='class'){
          const t=x.target;
          if(t.classList.contains('sel-circle'))window.__log.push(t.className);
        }
      });
    }).observe(wrap,{subtree:true,attributes:true,attributeFilter:['class']});
    // 统计 setTimeout 调用：猴子补丁在页面已加载后无法影响闭包内调用，改用标记：直接检查 on
  });
  await sleep(300);
  await page.evaluate(()=>{
    const orig=window.setTimeout;
    window.__timerCount=0;
    window.setTimeout=function(fn,d){window.__timerCount++;return orig.apply(this,arguments);};
    document.querySelector('#selectAll').click();
    window.setTimeout=orig;
  });
  console.log('timers scheduled at click:',await page.evaluate(()=>window.__timerCount));
  await sleep(500);
  console.log('on:',await page.evaluate(()=>document.querySelectorAll('#notesWrap .sel-circle.on').length));
  console.log('class log:',await page.evaluate(()=>window.__log.slice(0,20)));
  await b.close();
})();
