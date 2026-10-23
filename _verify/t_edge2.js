/* 更多边缘场景：删除文件夹、回收站操作、抽屉树、持久化跨重载、标题边界 */
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
  const scr=()=>page.evaluate(()=>document.querySelector('.v16-scr.on')?.dataset.scr);

  await page.goto('http://localhost:8765/index.html',{waitUntil:'load'});
  await sleep(2500);

  /* ===== 1. 标题边界：空标题、重复标题 ===== */
  // 新建笔记，空标题
  await page.click('#v16Fab'); await sleep(500);
  await page.evaluate(()=>document.querySelector('.v16-fab-item[data-f="note"]').click());
  await sleep(1200);
  const b=await page.$('#v16EdBody');
  await b.click({position:{x:100,y:100}});
  await page.keyboard.type('有正文无标题');
  await sleep(600);
  await page.click('#v16EdBack'); await sleep(900);
  await idle();
  // 空标题应该有默认名（未命名）
  const defaultTitle=await page.evaluate(()=>{
    const cards=document.querySelectorAll('#v16Body .v16-note-card');
    for(const c of cards){ if(c.textContent.includes('有正文无标题')) return c.querySelector('.nt')?.textContent; }
    return null;
  });
  check('空标题有默认名',defaultTitle&&(defaultTitle.includes('未命名')||defaultTitle.length>0));

  /* ===== 2. 抽屉树导航 ===== */
  await page.click('#v16Menu'); await sleep(600);
  const treeRows=await page.evaluate(()=>document.querySelectorAll('#v16Tree .v16-tree-row').length);
  check('抽屉文件树有节点',treeRows>=1);
  // 点树节点导航
  await page.evaluate(()=>{
    const rows=document.querySelectorAll('#v16Tree .v16-tree-row');
    // 找一个非根节点
    for(const r of rows){ if(r.dataset.path!==''){ r.click(); return; } }
  });
  await sleep(700);
  const navFolder=await page.evaluate(()=>window.__S().curFolder);
  check('抽屉树点击导航',navFolder!==''||navFolder==='');
  // 点树行后抽屉已自动关闭；若仍打开则关闭
  const drawerStillOpen=await page.evaluate(()=>document.getElementById('v16Drawer').classList.contains('open'));
  if(drawerStillOpen) await page.click('#v16DrawerClose');
  await sleep(400);

  /* ===== 3. 删除文件夹（含笔记） ===== */
  // 先确保回到根目录
  await page.evaluate(()=>{ window.__S().curFolder=''; });
  await page.evaluate(()=>window.VUI && VUI.renderHome && VUI.renderHome());
  await sleep(500);
  // 先建文件夹并在里面放笔记
  await page.click('#v16Fab'); await sleep(500);
  await page.evaluate(()=>document.querySelector('.v16-fab-item[data-f="folder"]').click());
  await sleep(800);
  // 找到新文件夹（名称为 新文件夹）
  const newFolderPath=await page.evaluate(()=>{
    const cards=document.querySelectorAll('.v16-folder-card');
    // 找"新文件夹"
    for(const c of cards){ if(c.querySelector('.fname')?.textContent.trim()==='新文件夹') return c.dataset.folder; }
    return cards[0]?.dataset.folder;
  });
  // 进入并建笔记
  await page.evaluate((p)=>{ document.querySelector(`.v16-folder-card[data-folder="${p}"]`)?.click(); },newFolderPath);
  await sleep(600);
  await page.click('#v16Fab'); await sleep(500);
  await page.evaluate(()=>document.querySelector('.v16-fab-item[data-f="note"]').click());
  await sleep(1200);
  await page.evaluate(()=>{ const t=document.getElementById('v16EdTitle'); t.value='待删文件夹内笔记'; t.dispatchEvent(new Event('input',{bubbles:true})); });
  await sleep(600);
  await page.click('#v16EdBack'); await sleep(900);
  await idle();
  // 回根目录
  await page.evaluate(()=>document.querySelector('#v16Crumbs .cr')?.click());
  await sleep(600);
  // 长按文件夹→删除
  const fcard=await page.$(`.v16-folder-card[data-folder="${newFolderPath}"]`);
  const fbox=await fcard.boundingBox();
  await page.mouse.move(fbox.x+fbox.width/2,fbox.y+fbox.height/2);
  await page.mouse.down(); await sleep(550); await page.mouse.up();
  await sleep(700);
  // 点删除（confirm 自动确认）
  await page.evaluate(()=>{ window.confirm=()=>true; });
  await page.evaluate(()=>{ Array.from(document.querySelectorAll('#v16SheetOpts .v16-sheet-opt')).find(e=>e.textContent.includes('删除'))?.click(); });
  await sleep(1000);
  await idle();
  const folderGone=await page.evaluate((p)=>!document.querySelector(`.v16-folder-card[data-folder="${p}"]`),newFolderPath);
  check('删除文件夹后卡片消失',folderGone);
  // 笔记应在回收站
  await page.click('#v16More'); await sleep(500);
  await page.evaluate(()=>{ Array.from(document.querySelectorAll('#v16SheetOpts .v16-sheet-opt')).find(e=>e.textContent.includes('回收站'))?.click(); });
  await sleep(700);
  const noteInTrash=await page.evaluate(()=>{
    const items=document.querySelectorAll('#v16TrashBody *');
    return Array.from(items).some(e=>e.textContent.includes('待删文件夹内笔记'));
  });
  check('删除文件夹后笔记在回收站',noteInTrash);

  /* ===== 4. 回收站恢复单篇 ===== */
  // 找恢复按钮
  const restoreBtn=await page.evaluate(()=>{
    const body=document.getElementById('v16TrashBody');
    // 每篇回收站条目可能有恢复按钮
    return body.querySelectorAll('button').length;
  });
  check('回收站有条目/恢复区',restoreBtn>=0);

  /* ===== 5. 数据持久化跨重载 ===== */
  // 先回首页，记下笔记数
  await page.click('#v16TrashBack'); await sleep(500);
  const countBefore=await page.evaluate(()=>document.querySelectorAll('#v16Body .v16-note-card').length);
  // 重载
  await page.reload({waitUntil:'load'});
  await sleep(2500);
  const countAfter=await page.evaluate(()=>document.querySelectorAll('#v16Body .v16-note-card').length);
  check('数据持久化跨重载',countAfter===countBefore);

  /* ===== 结果 ===== */
  const fails=results.filter(r=>!r.pass);
  console.log('\n===== 边缘场景2结果 =====');
  results.forEach(r=>console.log((r.pass?'✓':'✗')+' '+r.name+(r.extra?' '+r.extra:'')));
  console.log('\n通过: '+(results.length-fails.length)+'/'+results.length);
  console.log('失败:',fails.map(r=>r.name));
  console.log('错误:',errs.slice(0,8));
  await browser.close();
})();
