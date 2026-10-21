/* f02_ai_settings_trash_folder.js — 复核 AI 入口/设置接线/回收站刷新/文件夹重命名删除/字体 */
'use strict';
const { chromium } = require('playwright');
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

  log('=== AI 入口：首页 v16HomeAi ===');
  log('#v16HomeAi 存在?', await page.$('#v16HomeAi')!==null);
  await page.click('#v16HomeAi');
  await page.waitForTimeout(500);
  const chatLifted = await page.evaluate(()=>document.getElementById('scr-chat')?.classList.contains('legacy-top'));
  log('点首页 AI 后 scr-chat 提升为 legacy-top?', chatLifted);
  const chatVisible = await page.evaluate(()=>{const e=document.getElementById('scr-chat'); const r=e.getBoundingClientRect(); return r.width>0&&r.height>0;});
  log('scr-chat 可见?', chatVisible);
  /* 关 */
  await page.evaluate(()=>{const b=document.getElementById('chatDeskBack'); if(b) b.click();});
  await page.waitForTimeout(400);
  const chatClosed = await page.evaluate(()=>!document.getElementById('scr-chat').classList.contains('legacy-top'));
  log('关后 scr-chat 降回?', chatClosed);

  log('\n=== AI 入口：本页问答 v16EdAi ===');
  await page.evaluate(()=>{[...document.querySelectorAll('.v16-folder-card')].find(f=>f.dataset.folder==='工作').click();});
  await page.waitForTimeout(400);
  await page.evaluate(()=>{const c=[...document.querySelectorAll('.v16-note-card')].find(x=>x.dataset.path.includes('产品灵感记录')); c.click();});
  await page.waitForSelector('#v16EdBody', {timeout:5000});
  await page.waitForTimeout(300);
  log('#v16EdAi 存在?', await page.$('#v16EdAi')!==null);
  await page.click('#v16EdAi');
  await page.waitForTimeout(800);
  const naiOpen = await page.evaluate(()=>document.getElementById('noteAiPanel')?.classList.contains('open'));
  log('本页问答面板 open?', naiOpen);
  /* 关 */
  await page.evaluate(()=>{const b=document.getElementById('naiBack'); if(b) b.click();});
  await page.waitForTimeout(400);

  log('\n=== 设置行逐项 ===');
  await page.evaluate(()=>{ window.VUI.show('settings'); window.VUI.renderSettings(); });
  await page.waitForTimeout(500);
  const rows = await page.$$eval('.v16-row[data-row]', els=>els.map(r=>({a:r.dataset.row, l:r.querySelector('.rl').textContent.trim()})));
  for(const r of rows){
    await page.evaluate((a)=>{[...document.querySelectorAll('.v16-row[data-row]')].find(x=>x.dataset.row===a).click();}, r.a);
    await page.waitForTimeout(350);
    const toast = await page.$eval('.v16-toast', e=>e.textContent);
    /* 关掉可能的 sheet/modal */
    await page.evaluate(()=>{const m=document.getElementById('v16SheetMask'); if(m) m.click();});
    await page.evaluate(()=>{const m=document.getElementById('modal'); if(m && m.classList.contains('show')) m.click();});
    await page.waitForTimeout(150);
    log(`  [${r.a}] ${r.l} → toast: ${toast}`);
  }

  log('\n=== 关于/隐私 modal ===');
  await page.evaluate(()=>{[...document.querySelectorAll('.v16-row[data-row]')].find(x=>x.dataset.row==='about').click();});
  await page.waitForTimeout(400);
  const aboutTxt = await page.evaluate(()=>document.getElementById('modal')?.textContent.slice(0,120));
  log('关于 modal 文本:', aboutTxt);
  await page.evaluate(()=>{const m=document.getElementById('modal'); if(m) m.click();});
  await page.waitForTimeout(200);

  log('\n=== 字号刻度尺：fontSize 真变? ===');
  const fs0 = await page.evaluate(()=>document.getElementById('v16root').style.fontSize || '16px(默认)');
  await page.evaluate(()=>{[...document.querySelectorAll('.v16-row[data-row]')].find(x=>x.dataset.row==='fontscale').click();});
  await page.waitForTimeout(300);
  const fs1 = await page.evaluate(()=>document.getElementById('v16root').style.fontSize);
  log('点击前 fontSize:', fs0, ' 点击后:', fs1);

  log('\n=== 回收站清空 + 恢复刷新 ===');
  /* 强制关闭所有残留弹层，避免遮罩拦截后续点击 */
  await page.evaluate(()=>{
    const sm=document.getElementById('v16SheetMask'); if(sm) sm.classList.remove('open');
    const s=document.getElementById('v16Sheet'); if(s) s.classList.remove('open');
    const m=document.getElementById('modal'); if(m) m.classList.remove('show','v16-lift');
    const legacy=document.querySelector('.screen.legacy-top'); if(legacy) legacy.classList.remove('active','legacy-top');
  });
  await page.evaluate(()=>{ window.VUI.show('home'); window.VUI.state.curFolder=''; window.VUI.renderHome(); });
  await page.waitForTimeout(500);
  await page.waitForSelector('.v16-folder-card', {timeout: 5000});
  /* 删一篇进回收站 */
  await page.evaluate(()=>{const f=[...document.querySelectorAll('.v16-folder-card')].find(x=>x.dataset.folder==='生活'); if(f)f.click();});
  await page.waitForTimeout(400);
  const beforeCount = await page.$$eval('.v16-note-card', e=>e.length);
  await page.evaluate(()=>{const c=document.querySelector('.v16-note-card'); if(c)c.click();});
  await page.waitForSelector('#v16EdBody', {timeout:5000});
  await page.click('#v16EdMore'); await page.waitForTimeout(300);
  await page.evaluate(()=>{[...document.querySelectorAll('#v16SheetOpts .v16-sheet-opt')].find(o=>o.textContent.includes('删除')).click();});
  await page.waitForTimeout(300);
  await page.evaluate(()=>{const b=document.getElementById('delConf'); if(b && b.onclick) b.onclick();});
  await page.waitForTimeout(600);
  /* 进回收站 */
  await page.click('#v16More'); await page.waitForTimeout(300);
  await page.evaluate(()=>{[...document.querySelectorAll('#v16SheetOpts .v16-sheet-opt')].find(o=>o.textContent.includes('回收站')).click();});
  await page.waitForTimeout(500);
  const trashN = await page.$$eval('.v16-trash-item', e=>e.length);
  log('回收站条目数:', trashN);
  /* 点恢复 */
  await page.evaluate(()=>{const b=document.querySelector('.v16-trash-item .b-restore'); if(b)b.click();});
  await page.waitForTimeout(500);
  /* 点返回（v16TrashBack 应 renderHome） */
  await page.click('#v16TrashBack'); await page.waitForTimeout(500);
  const restoredVisible = await page.evaluate(()=>document.querySelector('.v16-note-card')!==null);
  log('恢复后返回首页卡片可见?', restoredVisible);
  /* 清空 */
  await page.click('#v16More'); await page.waitForTimeout(300);
  await page.evaluate(()=>{[...document.querySelectorAll('#v16SheetOpts .v16-sheet-opt')].find(o=>o.textContent.includes('回收站')).click();});
  await page.waitForTimeout(500);
  await page.click('#v16TrashEmpty'); await page.waitForTimeout(500);
  const afterEmpty = await page.$$eval('.v16-trash-item', e=>e.length);
  log('点清空后回收站条目数:', afterEmpty, '(期望 0)');

  log('\n=== 文件夹重命名/删除 ===');
  await page.evaluate(()=>{ window.VUI.show('home'); window.VUI.state.curFolder=''; window.VUI.renderHome(); });
  await page.waitForTimeout(400);
  /* 长按"生活"文件夹 */
  await page.evaluate(()=>{
    const c=[...document.querySelectorAll('.v16-folder-card')].find(f=>f.dataset.folder==='生活');
    c.dispatchEvent(new MouseEvent('mousedown',{bubbles:true}));
  });
  await page.waitForTimeout(700);
  await page.evaluate(()=>{
    const c=[...document.querySelectorAll('.v16-folder-card')].find(f=>f.dataset.folder==='生活');
    c.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));
  });
  await page.waitForTimeout(400);
  const opts = await page.$$eval('#v16SheetOpts .v16-sheet-opt', els=>els.map(e=>e.textContent.trim()));
  log('文件夹长按 sheet:', opts);
  /* 点重命名 */
  await page.evaluate(()=>{[...document.querySelectorAll('#v16SheetOpts .v16-sheet-opt')].find(o=>o.textContent.includes('重命名')).click();});
  await page.waitForTimeout(500);
  /* 此时应弹 prompt 或 sheet；观察 */
  log('重命名后 toast:', await page.$eval('.v16-toast', e=>e.textContent));

  log('\npageerrors:', errs); errs.forEach(e=>log('  '+e));
  await browser.close();
})();
