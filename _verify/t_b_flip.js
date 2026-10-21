const {chromium}=require('playwright');const path=require('path');
const EXE='/opt/vm/preinstall/ms-playwright/chromium_headless_shell-1169/chrome-linux/headless_shell';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const b=await chromium.launch({headless:true,executablePath:EXE});
  const ctx=await b.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'no-preference'});
  const page=await ctx.newPage();
  page.on('pageerror',e=>console.log('[pageerror]',e.message));
  const assert=(c,m)=>{if(c)console.log('PASS:',m);else{console.log('FAIL:',m);process.exitCode=1;}};
  await page.goto('file://'+path.resolve('index.html'));
  await page.waitForFunction(()=>window.__app);await sleep(1200);
  // 造 8 条保证多列多行
  await page.evaluate(()=>{
    const app=window.__app;
    for(let i=0;i<8;i++){app.notes.push({id:app.uid(),title:'补位测试 '+i,content:'<p>内容</p>'.repeat(4),files:[],todos:[],
      color:'cream',pinned:false,trashed:false,createdAt:Date.now()+100+i,updatedAt:Date.now()+100+i});}
    app.persist();app.renderNotes(true);
  });
  await sleep(300);
  await page.evaluate(()=>{const c=document.querySelector('#notesWrap .note-card');window.__app.enterSelect(c.dataset.id);});
  await sleep(150);
  await page.evaluate(()=>document.querySelector('#bbDelete').click());
  await sleep(560);  // 飞行结束
  const hit=await page.evaluate(()=>document.querySelector('#bbDelete').classList.contains('target-hit'));
  assert(hit,'#4 删除按钮 target-hit 承接动画');
  const flip=await page.evaluate(()=>Array.from(document.querySelectorAll('#notesWrap .note-card')).some(c=>{const t=getComputedStyle(c).transform;return t&&t!=='none'&&t!=='matrix(1, 0, 0, 1, 0, 0)';}));
  assert(flip,'#4 FLIP 补位：其余卡片有补位 transform');
  await sleep(600);
  const cleared=await page.evaluate(()=>Array.from(document.querySelectorAll('#notesWrap .note-card')).every(c=>{const t=getComputedStyle(c).transform;return !t||t==='none'||t==='matrix(1, 0, 0, 1, 0, 0)';}));
  assert(cleared,'#4 补位结束后 transform 清理');
  await b.close();
})();
