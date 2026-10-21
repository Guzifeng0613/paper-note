/* f03_trash_folder_anim.js — 回收站清空/恢复刷新、文件夹重命名删除、字号真变、动效矩阵 */
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

  log('=== 字号刻度尺：真改 fontSize ===');
  await page.evaluate(()=>{ window.VUI.show('settings'); window.VUI.renderSettings(); });
  await page.waitForTimeout(400);
  const fs0 = await page.evaluate(()=>document.getElementById('v16root').style.fontSize);
  await page.evaluate(()=>{[...document.querySelectorAll('.v16-row[data-row]')].find(x=>x.dataset.row==='fontscale').click();});
  await page.waitForTimeout(300);
  const fs1 = await page.evaluate(()=>document.getElementById('v16root').style.fontSize);
  log('fontSize:', JSON.stringify(fs0), '→', JSON.stringify(fs1));

  log('\n=== 回收站：删→恢复→返回首页应可见；清空 ===');
  /* 强制关闭所有残留弹层 */
  await page.evaluate(()=>{
    const sm=document.getElementById('v16SheetMask'); if(sm) sm.classList.remove('open');
    const s=document.getElementById('v16Sheet'); if(s) s.classList.remove('open');
    const m=document.getElementById('modal'); if(m) m.classList.remove('show','v16-lift');
    const legacy=document.querySelector('.screen.legacy-top'); if(legacy) legacy.classList.remove('active','legacy-top');
  });
  await page.evaluate(()=>{ window.VUI.state.curFolder=''; window.VUI.show('home'); window.VUI.renderHome(); });
  await page.waitForTimeout(400);
  /* 进 生活 删一篇 */
  await page.evaluate(()=>{[...document.querySelectorAll('.v16-folder-card')].find(f=>f.dataset.folder==='生活').click();});
  await page.waitForTimeout(400);
  const firstNote = await page.evaluate(()=>{const c=document.querySelector('.v16-note-card'); return c?c.dataset.path:null;});
  log('待删笔记:', firstNote);
  await page.evaluate(()=>{document.querySelector('.v16-note-card').click();});
  await page.waitForSelector('#v16EdBody', {timeout:5000});
  await page.click('#v16EdMore'); await page.waitForTimeout(300);
  await page.evaluate(()=>{[...document.querySelectorAll('#v16SheetOpts .v16-sheet-opt')].find(o=>o.textContent.includes('删除')).click();});
  await page.waitForTimeout(400);
  await page.evaluate(()=>{ const b=document.getElementById('delConf'); if(b && b.onclick) b.onclick(); });
  await page.waitForTimeout(800);
  /* 进回收站 */
  await page.click('#v16More'); await page.waitForTimeout(300);
  await page.evaluate(()=>{[...document.querySelectorAll('#v16SheetOpts .v16-sheet-opt')].find(o=>o.textContent.includes('回收站')).click();});
  await page.waitForTimeout(500);
  log('回收站条目数:', await page.$$eval('.v16-trash-item', e=>e.length));
  /* 恢复 */
  await page.evaluate(()=>{document.querySelector('.v16-trash-item .b-restore').click();});
  await page.waitForTimeout(500);
  /* 返回 */
  await page.click('#v16TrashBack'); await page.waitForTimeout(600);
  const visible = await page.evaluate(()=>!!document.querySelector('.v16-note-card'));
  log('恢复后返回首页，笔记卡片可见?', visible);
  /* 再删，然后清空 */
  await page.evaluate(()=>{document.querySelector('.v16-note-card').click();});
  await page.waitForSelector('#v16EdBody', {timeout:5000});
  await page.click('#v16EdMore'); await page.waitForTimeout(300);
  await page.evaluate(()=>{[...document.querySelectorAll('#v16SheetOpts .v16-sheet-opt')].find(o=>o.textContent.includes('删除')).click();});
  await page.waitForTimeout(400);
  await page.evaluate(()=>{ const b=document.getElementById('delConf'); if(b && b.onclick) b.onclick(); });
  await page.waitForTimeout(800);
  await page.click('#v16More'); await page.waitForTimeout(300);
  await page.evaluate(()=>{[...document.querySelectorAll('#v16SheetOpts .v16-sheet-opt')].find(o=>o.textContent.includes('回收站')).click();});
  await page.waitForTimeout(500);
  log('清空前条目数:', await page.$$eval('.v16-trash-item', e=>e.length));
  await page.click('#v16TrashEmpty'); await page.waitForTimeout(500);
  log('清空后条目数:', await page.$$eval('.v16-trash-item', e=>e.length));

  log('\n=== 文件夹重命名 ===');
  await page.evaluate(()=>{ window.VUI.show('home'); window.VUI.state.curFolder=''; window.VUI.renderHome(); });
  await page.waitForTimeout(400);
  /* 先在 root 建一个文件夹用于重命名测试 */
  await page.evaluate(()=>window.Vault.createFolder('', '待重命名文件夹'));
  await page.evaluate(()=>window.VUI.renderHome());
  await page.waitForTimeout(400);
  /* 长按 */
  await page.evaluate(()=>{
    const c=[...document.querySelectorAll('.v16-folder-card')].find(f=>f.dataset.folder==='待重命名文件夹');
    c.dispatchEvent(new MouseEvent('mousedown',{bubbles:true}));
  });
  await page.waitForTimeout(700);
  await page.evaluate(()=>{
    const c=[...document.querySelectorAll('.v16-folder-card')].find(f=>f.dataset.folder==='待重命名文件夹');
    c.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));
  });
  await page.waitForTimeout(400);
  const opts = await page.$$eval('#v16SheetOpts .v16-sheet-opt', els=>els.map(e=>e.textContent.trim()));
  log('文件夹长按 sheet:', opts);
  /* 点重命名——会弹 prompt()，需要 dialog 处理 */
  page.once('dialog', async d => { log('重命名 prompt 弹窗:', d.message()); await d.accept('已重命名文件夹X'); });
  await page.evaluate(()=>{[...document.querySelectorAll('#v16SheetOpts .v16-sheet-opt')].find(o=>o.textContent.includes('重命名')).click();});
  await page.waitForTimeout(800);
  const exists = await page.evaluate(async ()=>{
    try{ await window.VaultFS.list('已重命名文件夹X'); return true; }catch(e){ return false; }
  });
  log('重命名后"已重命名文件夹X"在 vault 中?', exists);

  log('\n=== 16 动效：跑 anim_verify.js ===');
  log('(由外部脚本执行)');

  log('\npageerrors:', errs); errs.forEach(e=>log('  '+e));
  await browser.close();
})();
