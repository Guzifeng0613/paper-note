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
  const m=await page.evaluate(()=>{
    const app=window.__app;
    const before=app.notes.length;
    for(let i=0;i<18;i++){app.notes.push({id:app.uid(),title:'测试便签 '+i,body:'<p>内容内容内容内容</p>'.repeat(6),
      color:'cream',pinned:false,trashed:false,createdAt:Date.now()+i,updatedAt:Date.now()+i});}
    app.persist();
    app.renderNotes(true);
    return {before,total:app.notes.length,vis:app.visibleNotes().length,
      cards:document.querySelectorAll('#notesWrap .note-card').length};
  });
  console.log(JSON.stringify(m,null,1));
  await sleep(300);
  const m2=await page.evaluate(()=>{const el=document.querySelector('#scr-home .screen-body');return {sh:el.scrollHeight,ch:el.clientHeight,cards:document.querySelectorAll('#notesWrap .note-card').length};});
  console.log(JSON.stringify(m2,null,1));
  await b.close();
})();
