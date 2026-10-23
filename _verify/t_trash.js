/* 回收站完整流程：删除→恢复→再删→彻底删除→清空回收站 */
const { chromium } = require('playwright');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const browser=await chromium.launch({ executablePath:'/opt/vm/preinstall/ms-playwright/chromium_headless_shell-1169/chrome-linux/headless_shell', args:['--no-sandbox'] });
  const page=await browser.newPage({viewport:{width:360,height:792},deviceScaleFactor:4,hasTouch:false});
  const errs=[];
  page.on('pageerror',e=>errs.push('PAGEERR:'+e.message));
  page.on('console',m=>{ if(m.type()==='error') errs.push('CONSOLE:'+m.text()); });
  const results=[];
  const check=(name,cond,extra)=>results.push({name,pass:!!cond,extra:extra||''});
  const idle=()=>page.evaluate(()=>window.__opIdle&&window.__opIdle());

  await page.goto('http://localhost:8765/index.html',{waitUntil:'load'});
  await sleep(2500);

  // 新建笔记
  await page.click('#v16Fab'); await sleep(500);
  await page.evaluate(()=>document.querySelector('.v16-fab-item[data-f="note"]').click());
  await sleep(1200);
  await page.evaluate(()=>{ const t=document.getElementById('v16EdTitle'); t.value='回收站测试笔记'; t.dispatchEvent(new Event('input',{bubbles:true})); });
  await sleep(600);
  await page.click('#v16EdBack'); await sleep(900);
  await idle();

  // 删除（编辑器更多→删除，二次确认）
  await page.evaluate(()=>{
    const c=document.querySelector('.v16-note-card[data-path="回收站测试笔记.md"]');
    c?.click();
  });
  await sleep(1000);
  await page.click('#v16EdMore'); await sleep(500);
  await page.evaluate(()=>{ Array.from(document.querySelectorAll('#v16SheetOpts .v16-sheet-opt')).find(e=>e.textContent.includes('删除'))?.click(); });
  await sleep(600);
  // 点确认
  await page.click('#delConf'); await sleep(900);
  await idle();

  // 进回收站
  await page.click('#v16More'); await sleep(500);
  await page.evaluate(()=>{ Array.from(document.querySelectorAll('#v16SheetOpts .v16-sheet-opt')).find(e=>e.textContent.includes('回收站'))?.click(); });
  await sleep(700);
  const inTrash=await page.evaluate(()=>{
    return Array.from(document.querySelectorAll('#v16TrashBody .v16-trash-item')).some(e=>e.textContent.includes('回收站测试笔记'));
  });
  check('笔记在回收站',inTrash);

  // 恢复
  await page.evaluate(()=>{
    const items=document.querySelectorAll('#v16TrashBody .v16-trash-item');
    for(const it of items){
      if(it.textContent.includes('回收站测试笔记')){ it.querySelector('button[data-action="restore"]')?.click(); return; }
    }
  });
  await sleep(900);
  await idle();
  // 回首页，确认恢复
  await page.click('#v16TrashBack'); await sleep(500);
  const restored=await page.evaluate(()=>document.querySelector('.v16-note-card[data-path="回收站测试笔记.md"]')!==null);
  check('恢复后笔记回首页',restored);

  // 再删一次
  await page.evaluate(()=>document.querySelector('.v16-note-card[data-path="回收站测试笔记.md"]')?.click());
  await sleep(1000);
  await page.click('#v16EdMore'); await sleep(500);
  await page.evaluate(()=>{ Array.from(document.querySelectorAll('#v16SheetOpts .v16-sheet-opt')).find(e=>e.textContent.includes('删除'))?.click(); });
  await sleep(600);
  await page.click('#delConf'); await sleep(900);
  await idle();

  // 彻底删除
  await page.click('#v16More'); await sleep(500);
  await page.evaluate(()=>{ Array.from(document.querySelectorAll('#v16SheetOpts .v16-sheet-opt')).find(e=>e.textContent.includes('回收站'))?.click(); });
  await sleep(700);
  await page.evaluate(()=>{
    const items=document.querySelectorAll('#v16TrashBody .v16-trash-item');
    for(const it of items){
      if(it.textContent.includes('回收站测试笔记')){ it.querySelector('button[data-action="del"]')?.click(); return; }
    }
  });
  await sleep(600);
  // 二次确认
  await page.click('#delForeverConf'); await sleep(900);
  await idle();
  const goneForever=await page.evaluate(()=>{
    return !Array.from(document.querySelectorAll('#v16TrashBody .v16-trash-item')).some(e=>e.textContent.includes('回收站测试笔记'));
  });
  check('彻底删除后回收站无此笔记',goneForever);

  // 清空回收站（如果还有其他项）
  const hasItems=await page.evaluate(()=>document.querySelectorAll('#v16TrashBody .v16-trash-item').length);
  if(hasItems){
    await page.evaluate(()=>{ window.confirm=()=>true; });
    await page.click('#v16TrashEmpty'); await sleep(900);
    await idle();
    const empty=await page.evaluate(()=>{
      const body=document.getElementById('v16TrashBody');
      return body.textContent.includes('回收站为空')||body.querySelectorAll('.v16-trash-item').length===0;
    });
    check('清空回收站',empty);
  } else {
    check('清空回收站（已空）',true);
  }

  const fails=results.filter(r=>!r.pass);
  console.log('\n===== 回收站流程结果 =====');
  results.forEach(r=>console.log((r.pass?'✓':'✗')+' '+r.name));
  console.log('\n通过: '+(results.length-fails.length)+'/'+results.length);
  console.log('失败:',fails.map(r=>r.name));
  console.log('错误:',errs.slice(0,8));
  await browser.close();
})();
