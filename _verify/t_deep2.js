const { chromium } = require('playwright');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const P=(r,name,cond)=>{console.log((cond?'✓ ':'✗ ')+name); if(!cond) r.fails.push(name);};
(async()=>{
  const r={fails:[]};
  const browser=await chromium.launch({ executablePath:'/opt/vm/preinstall/ms-playwright/chromium_headless_shell-1169/chrome-linux/headless_shell', args:['--no-sandbox'] });
  const page=await browser.newPage({viewport:{width:360,height:792},deviceScaleFactor:4});
  const errs=[]; page.on('pageerror',e=>errs.push('PE:'+e.message)); page.on('console',m=>{if(m.type()==='error')errs.push('CE:'+m.text());});
  await page.goto('http://localhost:8765/index.html',{waitUntil:'load'});
  await sleep(2500);
  const idle=()=>page.evaluate(()=>window.__opIdle());

  // 1. 新建文件夹
  await page.click('#v16Fab'); await sleep(500);
  await page.evaluate(()=>document.querySelector('.v16-fab-item[data-f="folder"]').click());
  await idle();
  const folderExists = await page.evaluate(()=>Array.from(document.querySelectorAll('.v16-folder-card')).some(c=>c.dataset.folder==='新文件夹'));
  P(r,'新建文件夹出现在首页', folderExists);

  // 2. 新建笔记，标题改名，等队列空
  await page.click('#v16Fab'); await sleep(500);
  await page.evaluate(()=>document.querySelector('.v16-fab-item[data-f="note"]').click());
  await sleep(1200);
  await page.evaluate(()=>{ const t=document.getElementById('v16EdTitle'); t.value='待办清单DDD'; t.dispatchEvent(new Event('input',{bubbles:true})); });
  await sleep(700);
  await idle();

  // 3. 插入待办
  await page.evaluate(()=>{
    const e=document.getElementById('v16EdBody'); e.focus();
    e.innerHTML='<p>购物清单</p>';
    document.querySelector('.v16-dock button[data-t="todo"]').click();
  });
  await sleep(600);
  const hasTodoInput = await page.evaluate(()=>!!document.querySelector('#v16EdBody input.v16-ed-todoinput'));
  P(r,'工具栏插入待办 checkbox', hasTodoInput);

  // 4. 勾选待办
  const toggleRes = await page.evaluate(async ()=>{
    const cb=document.querySelector('#v16EdBody input.v16-ed-todoinput');
    if(!cb) return null;
    const before=cb.checked; cb.click();
    await new Promise(r=>setTimeout(r,900));
    return {before, after:cb.checked};
  });
  P(r,'勾选待办状态翻转', toggleRes && toggleRes.before===false && toggleRes.after===true);

  // 5. 换颜色
  await page.click('#v16EdMore'); await sleep(600);
  await page.evaluate(()=>{ Array.from(document.querySelectorAll('#v16SheetOpts *')).find(e=>e.textContent.includes('颜色'))?.click(); });
  await sleep(700);
  await page.evaluate(()=>document.querySelector('#v16SheetOpts .v16cdot[data-c="green"]')?.click());
  await idle();
  const colorSet = await page.evaluate(()=>window.__S()._cur?.entry?.color);
  P(r,'更换颜色为绿色', colorSet==='green');

  // 6. 移动到 工作
  await page.click('#v16EdMore'); await sleep(600);
  await page.evaluate(()=>{ Array.from(document.querySelectorAll('#v16SheetOpts *')).find(e=>e.textContent.includes('移动'))?.click(); });
  await sleep(700);
  await page.evaluate(()=>{ Array.from(document.querySelectorAll('#v16SheetOpts *')).find(e=>e.textContent.trim()==='工作')?.click(); });
  await idle();
  const moved = await page.evaluate(()=>window.__S()._cur?.entry?.path);
  P(r,'移动到 工作 文件夹', moved && moved.startsWith('工作/'));

  // 7. 删除（二次确认）
  await page.click('#v16EdMore'); await sleep(600);
  await page.evaluate(()=>{ Array.from(document.querySelectorAll('#v16SheetOpts *')).find(e=>e.textContent.includes('删除'))?.click(); });
  await sleep(700);
  const confirmShown = await page.evaluate(()=>document.getElementById('modal').classList.contains('show') && document.getElementById('modal').textContent.includes('删除'));
  P(r,'删除弹出二次确认', confirmShown);
  await page.evaluate(()=>document.getElementById('delConf')?.click());
  await idle(); await sleep(500);

  // 8. 回收站
  await page.click('#v16More'); await sleep(600);
  await page.evaluate(()=>{ Array.from(document.querySelectorAll('#v16SheetOpts *')).find(e=>e.textContent.includes('回收站'))?.click(); });
  await sleep(900);
  const inTrash = await page.evaluate(()=>document.body.textContent.includes('待办清单DDD'));
  P(r,'删除后笔记在回收站', inTrash);

  // 9. 恢复
  const restored = await page.evaluate(()=>{
    const btns=document.querySelectorAll('#v16root button');
    for(const b of btns){ if(b.textContent.includes('恢复')){ b.click(); return true; } }
    return false;
  });
  await idle();
  P(r,'回收站点恢复', restored);

  console.log('\n===== 结果 =====');
  console.log('失败:', r.fails.length, r.fails);
  console.log('errors:', errs.slice(0,5));
  await browser.close();
})();
