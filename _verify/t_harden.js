const {chromium}=require('playwright');const path=require('path');
const EXE='/opt/vm/preinstall/ms-playwright/chromium_headless_shell-1169/chrome-linux/headless_shell';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const b=await chromium.launch({headless:true,executablePath:EXE});
  const ctx=await b.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'no-preference'});
  const page=await ctx.newPage();
  let err=0;page.on('pageerror',e=>{err++;console.log('[pageerror]',e.message)});
  const assert=(c,m)=>{if(c)console.log('PASS:',m);else{console.log('FAIL:',m);process.exitCode=1;}};
  await page.goto('file://'+path.resolve('index.html'));
  await page.waitForFunction(()=>window.__app);await sleep(400);
  const nid=await page.evaluate(()=>{
    const A=window.__app;
    const n={id:A.uid(),type:'note',pinned:false,trashed:false,trashedAt:null,files:[],
      title:'标签持久化',content:'',todos:[],color:'cream',createdAt:Date.now(),updatedAt:Date.now()};
    A.notes.push(n);A.prefs.notebooks=['工作'];A.persist();A.persistPrefs();
    location.hash='#/edit?id='+n.id;return n.id;
  });
  await sleep(500);
  /* 插入标签后离开编辑器再回来，标签应仍在 */
  await page.click('#paperBody');
  await page.keyboard.type('记得带上 #');
  await sleep(300);
  await page.keyboard.press('Enter');
  await sleep(200);
  const tagAfter=await page.evaluate(()=>document.querySelector('#paperBody .nb-tag')?.textContent||null);
  assert(tagAfter==='#工作','插入标签（'+tagAfter+'）');
  await page.evaluate(()=>location.hash='#/home');
  await sleep(500);
  await page.evaluate(id=>location.hash='#/edit?id='+id,nid);
  await sleep(500);
  const tagPersist=await page.evaluate(()=>{
    const t=document.querySelector('#paperBody .nb-tag');
    return t?t.textContent:null;
  });
  assert(tagPersist==='#工作','标签随便签持久化、重开仍在');
  /* 首页卡片不因标签报错（重新渲染首页） */
  await page.evaluate(()=>location.hash='#/home');
  await sleep(500);
  const homeOk=await page.evaluate(()=>document.querySelectorAll('#notesWrap .note-card').length>0);
  assert(homeOk,'首页正常渲染含标签便签');

  /* 系统返回键（__dismissOverlay）逐层关闭浮层 */
  await page.evaluate(id=>location.hash='#/edit?id='+id,nid);
  await sleep(500);
  /* 联想浮层 */
  await page.click('#paperBody');
  await page.keyboard.type(' #');
  await sleep(300);
  let r=await page.evaluate(()=>window.__dismissOverlay());
  const sugClosed=await page.evaluate(()=>{const s=document.querySelector('#nbSuggest');return !s||!s.classList.contains('show');});
  assert(r===true&&sugClosed,'系统返回：先关闭笔记本联想');
  /* 再按返回：无浮层返回 false，交回原生 */
  r=await page.evaluate(()=>window.__dismissOverlay());
  assert(r===false,'无浮层时返回 false，交回原生处理');

  /* 深色主题截图巡检：编辑器 */
  await page.evaluate(()=>{
    window.__app.prefs.theme='dark';window.__app.persistPrefs();window.__app.applyTheme();
  });
  await sleep(200);
  await page.screenshot({path:'_verify/shots/f_dark_edit.png'});
  /* 深色首页 */
  await page.evaluate(()=>location.hash='#/home');
  await sleep(500);
  await page.screenshot({path:'_verify/shots/f_dark_home.png'});
  /* 深色刻度尺 */
  await page.evaluate(()=>window.__app.openFontSizeSheet());
  await sleep(300);
  await page.screenshot({path:'_verify/shots/f_dark_ruler.png'});
  await page.evaluate(()=>{const d=document.querySelector('#fsDone');if(d)d.click();else{const c=document.querySelector('#modal [data-close]');if(c)c.click();}});
  await sleep(200);
  /* 深色动作面板 danger 项 */
  await page.evaluate(id=>location.hash='#/edit?id='+id,nid);
  await sleep(500);
  await page.click('#editMore');
  await sleep(350);
  await page.screenshot({path:'_verify/shots/f_dark_sheet.png'});

  await page.evaluate(()=>{
    window.__app.prefs.theme='light';window.__app.persistPrefs();window.__app.applyTheme();
  });
  console.log('errors:',err);
  await b.close();
})();
