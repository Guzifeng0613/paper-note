/* f04_cleanup.js — 干净验证：字号真变、回收站恢复刷新、清空、文件夹重命名 */
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
  await page.waitForTimeout(1500);

  log('=== 字号刻度尺 ===');
  await page.evaluate(()=>{ window.VUI.show('settings'); window.VUI.renderSettings(); });
  await page.waitForTimeout(500);
  /* 确保无 modal */
  await page.evaluate(()=>{const m=document.getElementById('modal'); if(m&&m.classList.contains('show')) m.classList.remove('show');});
  const fs0 = await page.evaluate(()=>document.getElementById('v16root').style.fontSize);
  await page.evaluate(()=>{[...document.querySelectorAll('.v16-row[data-row]')].find(x=>x.dataset.row==='fontscale').click();});
  await page.waitForTimeout(300);
  const fs1 = await page.evaluate(()=>document.getElementById('v16root').style.fontSize);
  log('fontSize:', JSON.stringify(fs0), '→', JSON.stringify(fs1));

  log('\n=== 回收站恢复后刷新 ===');
  await page.evaluate(()=>{ window.VUI.state.curFolder=''; window.VUI.show('home'); window.VUI.renderHome(); });
  await page.waitForTimeout(400);
  /* 删一篇 */
  await page.evaluate(()=>{[...document.querySelectorAll('.v16-folder-card')].find(f=>f.dataset.folder==='生活').click();});
  await page.waitForTimeout(400);
  const notePath = await page.evaluate(()=>document.querySelector('.v16-note-card').dataset.path);
  await page.evaluate(()=>document.querySelector('.v16-note-card').click());
  await page.waitForSelector('#v16EdBody', {timeout:5000});
  await page.waitForTimeout(300);
  await page.evaluate(()=>{document.getElementById('v16EdMore').click();});
  await page.waitForTimeout(300);
  await page.evaluate(()=>{[...document.querySelectorAll('#v16SheetOpts .v16-sheet-opt')].find(o=>o.textContent.includes('删除')).click();});
  await page.waitForTimeout(700);
  /* 回收站 */
  await page.evaluate(()=>{document.getElementById('v16More').click();});
  await page.waitForTimeout(300);
  await page.evaluate(()=>{[...document.querySelectorAll('#v16SheetOpts .v16-sheet-opt')].find(o=>o.textContent.includes('回收站')).click();});
  await page.waitForTimeout(500);
  log('回收站条目数:', await page.$$eval('.v16-trash-item', e=>e.length));
  await page.evaluate(()=>{document.querySelector('.v16-trash-item .b-restore').click();});
  await page.waitForTimeout(500);
  await page.evaluate(()=>{document.getElementById('v16TrashBack').click();});
  await page.waitForTimeout(600);
  const restored = await page.evaluate((p)=>!!document.querySelector(`.v16-note-card[data-path="${p}"]`), notePath);
  log('恢复后返回首页，原笔记卡片可见?', restored, '(path='+notePath+')');

  log('\n=== 回收站清空 ===');
  await page.evaluate(()=>{document.getElementById('v16More').click();});
  await page.waitForTimeout(300);
  await page.evaluate(()=>{[...document.querySelectorAll('#v16SheetOpts .v16-sheet-opt')].find(o=>o.textContent.includes('回收站')).click();});
  await page.waitForTimeout(500);
  /* 再删一篇 */
  await page.evaluate(()=>{document.querySelector('.v16-trash-item .b-del').click();});
  await page.waitForTimeout(400);
  log('手动彻底删除后条目数:', await page.$$eval('.v16-trash-item', e=>e.length));

  log('\n=== 文件夹重命名（prompt 模拟） ===');
  await page.evaluate(()=>{ window.VUI.show('home'); window.VUI.state.curFolder=''; window.VUI.renderHome(); });
  await page.waitForTimeout(400);
  await page.evaluate(()=>window.Vault.createFolder('', '待改名X'));
  await page.evaluate(()=>window.VUI.renderHome());
  await page.waitForTimeout(400);
  page.once('dialog', async d => { log('prompt:', d.message()); await d.accept('改名后Y'); });
  await page.evaluate(()=>{
    const c=[...document.querySelectorAll('.v16-folder-card')].find(f=>f.dataset.folder==='待改名X');
    c.dispatchEvent(new MouseEvent('mousedown',{bubbles:true}));
  });
  await page.waitForTimeout(700);
  await page.evaluate(()=>{
    const c=[...document.querySelectorAll('.v16-folder-card')].find(f=>f.dataset.folder==='待改名X');
    c.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));
  });
  await page.waitForTimeout(400);
  await page.evaluate(()=>{[...document.querySelectorAll('#v16SheetOpts .v16-sheet-opt')].find(o=>o.textContent.includes('重命名')).click();});
  await page.waitForTimeout(800);
  const renamed = await page.evaluate(async ()=>{
    try{ const l=await window.VaultFS.list('改名后Y'); return true; }catch(e){ return false; }
  });
  log('重命名后"改名后Y"在 vault?', renamed);

  log('\npageerrors:', errs); errs.forEach(e=>log('  '+e));
  await browser.close();
})();
