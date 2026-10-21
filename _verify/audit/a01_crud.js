/* a01_crud.js — A1 便签 CRUD + 回收站 + A3 文件夹/移动/重命名 真实操作 */
'use strict';
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const browser = await chromium.launch({ headless: true,
    executablePath: '/opt/vm/preinstall/ms-playwright/chromium_headless_shell-1169/chrome-linux/headless_shell' });
  const ctx = await browser.newContext({ viewport: { width: 360, height: 792, deviceScaleFactor: 4 },
    isMobile: true, hasTouch: true, reducedMotion: 'no-preference' });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  const log = (...a) => console.log(...a);

  await page.goto('http://localhost:8765/index.html', { waitUntil: 'load' });
  await page.waitForSelector('#v16root .v16-folder-card', { timeout: 15000 });
  await page.waitForTimeout(800);

  log('=== A1.1 初始 vault 状态 ===');
  log('Vault global OK:', await page.evaluate(()=>!!window.Vault));

  /* 进入"工作"文件夹 */
  await page.evaluate(()=>{[...document.querySelectorAll('.v16-folder-card')].find(f=>f.dataset.folder==='工作').click();});
  await page.waitForTimeout(400);
  let notes = await page.$$eval('.v16-note-card', els=>els.map(e=>e.dataset.path));
  log('工作/ 下笔记:', notes);

  log('\n=== A1.2 新建笔记（长按 FAB → 新建笔记） ===');
  /* 长按 FAB 展开菜单 */
  await page.touchscreen.tap(10,10); // noop warmup
  const fab = await page.$('#v16Fab');
  const fb = await fab.boundingBox();
  await page.mouse.move(fb.x+fb.width/2, fb.y+fb.height/2);
  await page.mouse.down();
  await page.waitForTimeout(800); /* 长按 520ms 触发菜单 */
  await page.mouse.move(10, 10);   /* 移开，避免抬手落在 FAB 上触发关闭 click */
  await page.mouse.up();
  await page.waitForTimeout(300);
  const menuOpen = await page.$eval('#v16FabMenu', el=>el.classList.contains('open'));
  log('FAB 长按菜单展开:', menuOpen);
  await page.screenshot({path:path.resolve(__dirname,'shots/a01_fabmenu.png')});
  if(menuOpen){
    await page.evaluate(()=>document.querySelector('.v16-fab-item[data-f="note"]').click());
    await page.waitForSelector('#v16EdBody', {timeout:5000});
    await page.waitForTimeout(400);
    log('编辑器打开, title value =', await page.$eval('#v16EdTitle', e=>e.value));
    /* 输入标题 */
    await page.click('#v16EdTitle');
    await page.fill('#v16EdTitle', '审计测试笔记AAA');
    await page.waitForTimeout(900); /* 等 600ms 防抖 rename */
    const edPath = await page.evaluate(()=>document.querySelector('.v16-ed-meta')?.textContent);
    log('编辑器 meta（含路径）:', edPath);
    /* 在正文输入 */
    await page.click('#v16EdBody');
    await page.keyboard.type('审计正文 hello');
    await page.waitForTimeout(800);
    /* 返回 */
    await page.click('#v16EdBack');
    await page.waitForTimeout(600);
    const afterCreate = await page.$$eval('.v16-note-card', els=>els.map(e=>e.dataset.path));
    log('创建后当前目录笔记:', afterCreate);
    const existsOnDisk = await page.evaluate(async ()=>{
      try{ const m = await window.VaultFS.read('工作/审计测试笔记AAA.md'); return m.slice(0,120); }
      catch(e){ return 'READ FAIL: '+e.message; }
    });
    log('磁盘读回 工作/审计测试笔记AAA.md:', existsOnDisk);
  }

  log('\n=== A1.3 置顶（编辑器更多 → 置顶） ===');
  /* 重新打开该笔记 */
  await page.evaluate(()=>{const c=[...document.querySelectorAll('.v16-note-card')].find(x=>x.dataset.path.includes('审计测试笔记AAA')); if(c)c.click();});
  await page.waitForSelector('#v16EdBody', {timeout:5000});
  await page.click('#v16EdMore');
  await page.waitForTimeout(300);
  /* 在 sheet 里点"置顶/取消" */
  const sheetOpts = await page.$$eval('#v16SheetOpts .v16-sheet-opt', els=>els.map(e=>e.textContent.trim()));
  log('笔记操作 sheet 选项:', sheetOpts);
  await page.evaluate(()=>{[...document.querySelectorAll('#v16SheetOpts .v16-sheet-opt')].find(o=>o.textContent.includes('置顶')).click();});
  await page.waitForTimeout(500);
  /* 检查 md frontmatter pinned */
  const pinnedMd = await page.evaluate(async ()=>{
    const m = await window.VaultFS.read('工作/审计测试笔记AAA.md');
    return /pinned:\s*true/.test(m);
  });
  log('frontmatter pinned:true 已写入:', pinnedMd);
  await page.click('#v16EdBack');
  await page.waitForTimeout(400);

  log('\n=== A1.4 删除进回收站 ===');
  await page.evaluate(()=>{const c=[...document.querySelectorAll('.v16-note-card')].find(x=>x.dataset.path.includes('审计测试笔记AAA')); if(c)c.click();});
  await page.waitForSelector('#v16EdBody', {timeout:5000});
  await page.click('#v16EdMore');
  await page.waitForTimeout(300);
  await page.evaluate(()=>{[...document.querySelectorAll('#v16SheetOpts .v16-sheet-opt')].find(o=>o.textContent.includes('删除')).click();});
  await page.waitForTimeout(600);
  const stillHere = await page.evaluate(()=>!!document.querySelector('.v16-note-card[data-path*="审计测试笔记AAA"]'));
  log('删除后首页卡片还在?', stillHere);

  log('\n=== A1.5 回收站：恢复/彻底删除/清空 ===');
  await page.click('#v16More');
  await page.waitForTimeout(300);
  const moreOpts = await page.$$eval('#v16SheetOpts .v16-sheet-opt', els=>els.map(e=>e.textContent.trim()));
  log('更多 sheet 选项:', moreOpts);
  await page.evaluate(()=>{[...document.querySelectorAll('#v16SheetOpts .v16-sheet-opt')].find(o=>o.textContent.includes('回收站')).click();});
  await page.waitForTimeout(500);
  const trashItems = await page.$$eval('.v16-trash-item', els=>els.map(e=>e.textContent.trim().slice(0,80)));
  log('回收站条目:', trashItems);
  /* 点"恢复" */
  await page.evaluate(()=>{const b=document.querySelector('.v16-trash-item .b-restore'); if(b)b.click();});
  await page.waitForTimeout(500);
  const trashAfterRestore = await page.$$eval('.v16-trash-item', els=>els.length);
  log('恢复后回收站条目数:', trashAfterRestore);
  /* 文件是否真的回到 vault */
  const restoredOnDisk = await page.evaluate(async ()=>{
    try{ await window.VaultFS.read('工作/审计测试笔记AAA.md'); return true; }catch(e){ return false; }
  });
  log('恢复后文件在 vault 磁盘上:', restoredOnDisk);
  /* 点返回首页（v16TrashBack 只 show('home')，不 renderHome —— 检查是否 stale） */
  await page.click('#v16TrashBack');
  await page.waitForTimeout(400);
  const restoredHome = await page.evaluate(()=>!!document.querySelector('.v16-note-card[data-path*="审计测试笔记AAA"]'));
  log('返回首页后卡片立即可见（无手动刷新）?', restoredHome);
  /* 手动 renderHome 后 */
  await page.evaluate(()=>window.VUI.renderHome());
  await page.waitForTimeout(400);
  const afterManual = await page.evaluate(()=>!!document.querySelector('.v16-note-card[data-path*="审计测试笔记AAA"]'));
  log('手动 renderHome 后卡片可见?', afterManual);
  /* 再删一次进回收站，然后彻底删除 */
  await page.click('#v16TrashBack');
  await page.waitForTimeout(300);
  await page.evaluate(()=>{const c=[...document.querySelectorAll('.v16-note-card')].find(x=>x.dataset.path.includes('审计测试笔记AAA')); if(c)c.click();});
  await page.waitForSelector('#v16EdBody', {timeout:5000});
  await page.click('#v16EdMore'); await page.waitForTimeout(200);
  await page.evaluate(()=>{[...document.querySelectorAll('#v16SheetOpts .v16-sheet-opt')].find(o=>o.textContent.includes('删除')).click();});
  await page.waitForTimeout(500);
  await page.click('#v16More'); await page.waitForTimeout(200);
  await page.evaluate(()=>{[...document.querySelectorAll('#v16SheetOpts .v16-sheet-opt')].find(o=>o.textContent.includes('回收站')).click();});
  await page.waitForTimeout(500);
  /* 点"彻底删除" */
  await page.evaluate(()=>{const b=document.querySelector('.v16-trash-item .b-del'); if(b)b.click();});
  await page.waitForTimeout(500);
  const afterDel = await page.$$eval('.v16-trash-item', els=>els.length);
  log('彻底删除后回收站条目数:', afterDel);
  /* 清空按钮 */
  await page.screenshot({path:path.resolve(__dirname,'shots/a01_trash.png')});
  await page.click('#v16TrashEmpty');
  await page.waitForTimeout(300);
  const toastTxt = await page.$eval('.v16-toast', e=>e.textContent);
  log('点"清空"后 toast:', toastTxt);

  log('\n=== A3.1 新建文件夹 + 文件树 + 重命名/删除文件夹 ===');
  await page.click('#v16TrashBack'); await page.waitForTimeout(300);
  /* 抽屉 → 新建文件夹 */
  await page.click('#v16Menu'); await page.waitForTimeout(400);
  await page.screenshot({path:path.resolve(__dirname,'shots/a01_drawer.png')});
  const treeRows = await page.$$eval('.v16-tree-row', els=>els.map(e=>e.querySelector('.tname')?.textContent));
  log('文件树节点:', treeRows);
  await page.click('#v16DrawerNew'); await page.waitForTimeout(600);
  const drawerAfterNew = await page.$$eval('.v16-tree-row', els=>els.map(e=>e.querySelector('.tname')?.textContent));
  log('新建后文件树:', drawerAfterNew);
  await page.click('#v16DrawerClose');
  /* 首页应出现"新文件夹"卡片 */
  const folderCards = await page.$$eval('.v16-folder-card', els=>els.map(f=>f.dataset.folder));
  log('首页文件夹卡片:', folderCards);
  /* 长按文件夹 → 重命名/删除 */
  await page.evaluate(()=>{
    const c=[...document.querySelectorAll('.v16-folder-card')].find(f=>f.dataset.folder==='新文件夹');
    if(c){ c.dispatchEvent(new MouseEvent('mousedown',{bubbles:true})); }
  });
  await page.waitForTimeout(700);
  await page.evaluate(()=>{
    const c=[...document.querySelectorAll('.v16-folder-card')].find(f=>f.dataset.folder==='新文件夹');
    if(c){ c.dispatchEvent(new MouseEvent('mouseup',{bubbles:true})); }
  });
  await page.waitForTimeout(400);
  const sheetTitle = await page.$eval('#v16SheetTitle', e=>e.textContent);
  const sheetOpts2 = await page.$$eval('#v16SheetOpts .v16-sheet-opt', els=>els.map(e=>e.textContent.trim()));
  log('文件夹长按 sheet title:', sheetTitle, 'opts:', sheetOpts2);
  /* 点重命名看是否真的重命名 */
  const renameOpt = await page.evaluate(()=>{const o=[...document.querySelectorAll('#v16SheetOpts .v16-sheet-opt')].find(x=>x.textContent.includes('重命名')); if(o)o.click(); return true;});
  await page.waitForTimeout(500);
  const toastAfterRename = await page.$eval('.v16-toast', e=>e.textContent);
  log('点"重命名"后 toast:', toastAfterRename);

  log('\n=== A3.2 移动笔记（编辑器"移动到…"） ===');
  /* 进入 工作/产品灵感记录.md */
  await page.evaluate(()=>{[...document.querySelectorAll('.v16-folder-card')].find(f=>f.dataset.folder==='工作').click();});
  await page.waitForTimeout(400);
  await page.evaluate(()=>{const c=[...document.querySelectorAll('.v16-note-card')].find(x=>x.dataset.path.includes('产品灵感记录')); if(c)c.click();});
  await page.waitForSelector('#v16EdBody', {timeout:5000});
  await page.click('#v16EdMove');
  await page.waitForTimeout(400);
  const moveOpts = await page.$$eval('#v16SheetOpts .v16-sheet-opt', els=>els.map(e=>e.textContent.trim()));
  log('移动到 sheet 选项:', moveOpts);
  /* 选"根目录" */
  await page.evaluate(()=>{[...document.querySelectorAll('#v16SheetOpts .v16-sheet-opt')].find(o=>o.textContent.includes('根目录')).click();});
  await page.waitForTimeout(700);
  const atRoot = await page.evaluate(async ()=>{
    try{ await window.VaultFS.read('产品灵感记录.md'); return 'root 有'; }catch(e){ return 'root 无'; }
  });
  log('移到根目录后, 根目录下读到:', atRoot);

  log('\n=== pageerrors ===', errs.length); errs.forEach(e=>log('  '+e));
  await browser.close();
})();
