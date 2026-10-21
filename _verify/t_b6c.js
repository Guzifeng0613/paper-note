const {chromium}=require('playwright');const path=require('path');
const EXE='/opt/vm/preinstall/ms-playwright/chromium_headless_shell-1169/chrome-linux/headless_shell';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const b=await chromium.launch({headless:true,executablePath:EXE});
  const ctx=await b.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'no-preference'});
  const page=await ctx.newPage();
  await page.goto('file://'+path.resolve('index.html'));
  await page.waitForFunction(()=>window.__app);await sleep(400);
  await page.evaluate(()=>{
    const app=window.__app;
    for(let i=0;i<18;i++){app.notes.push({id:app.uid(),title:'测试便签 '+i,body:'<p>内容内容内容内容</p>'.repeat(6),
      color:'cream',pinned:false,trashed:false,createdAt:Date.now()-i*1000,updatedAt:Date.now()-i*1000});}
    app.persist();location.hash='#/home';
  });
  await sleep(600);
  const m=await page.evaluate(()=>{
    const el=document.querySelector('#scr-home .screen-body');
    const r=el.getBoundingClientRect();
    return {sh:el.scrollHeight,ch:el.clientHeight,top:r.top,bottom:r.bottom,
      cards:document.querySelectorAll('#notesWrap .note-card').length,
      wrapH:document.querySelector('#notesWrap').getBoundingClientRect().height};
  });
  console.log(JSON.stringify(m,null,1));
  await b.close();
})();
