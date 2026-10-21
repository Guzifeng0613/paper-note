const {chromium}=require('playwright');const path=require('path');
const EXE='/opt/vm/preinstall/ms-playwright/chromium_headless_shell-1169/chrome-linux/headless_shell';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const b=await chromium.launch({headless:true,executablePath:EXE});
  const ctx=await b.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'no-preference'});
  const page=await ctx.newPage();
  page.on('pageerror',e=>console.log('[pageerror]',e.message));
  await page.goto('file://'+path.resolve('index.html'));
  await page.waitForFunction(()=>window.__app);await sleep(1200);
  await page.evaluate(()=>{
    const app=window.__app;
    for(let i=0;i<8;i++){app.notes.push({id:app.uid(),title:'补位测试 '+i,content:'<p>内容</p>'.repeat(4),files:[],todos:[],
      color:'cream',pinned:false,trashed:false,createdAt:Date.now()+100+i,updatedAt:Date.now()+100+i});}
    app.persist();app.renderNotes(true);
  });
  await sleep(300);
  const before=await page.evaluate(()=>{
    const wrap=document.querySelector('#notesWrap');
    return Array.from(wrap.querySelectorAll('.note-card')).slice(0,4).map(c=>({id:c.dataset.id.slice(-4),t:Math.round(c.getBoundingClientRect().top)}));
  });
  await page.evaluate(()=>{const c=document.querySelector('#notesWrap .note-card');window.__app.enterSelect(c.dataset.id);});
  await sleep(150);
  await page.evaluate(()=>document.querySelector('#bbDelete').click());
  await sleep(520);
  const mid=await page.evaluate(()=>Array.from(document.querySelectorAll('#notesWrap .note-card')).slice(0,4).map(c=>({id:c.dataset.id.slice(-4),t:Math.round(c.getBoundingClientRect().top),tf:getComputedStyle(c).transform})));
  console.log('before:',JSON.stringify(before));
  console.log('@520:',JSON.stringify(mid));
  await b.close();
})();
