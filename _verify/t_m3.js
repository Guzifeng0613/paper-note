/* ============================================================
   t_m3.js —— RealVault 真实 CRUD + 源码模式走查（M2/M3）
   真机 360×792 dpr4，isMobile/hasTouch/reducedMotion:no-preference。
   前提：localhost http://localhost:8765/ 已起（python3 -m http.server）。
   截图存 _verify/shots/m3/。
   ============================================================ */
'use strict';
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const SHOTS = path.resolve(__dirname, '../_verify/shots/m3');
fs.mkdirSync(SHOTS, { recursive: true });

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: '/opt/vm/preinstall/ms-playwright/chromium_headless_shell-1169/chrome-linux/headless_shell'
  });
  const ctx = await browser.newContext({
    viewport: { width: 360, height: 792, deviceScaleFactor: 4 },
    isMobile: true, hasTouch: true, reducedMotion: 'no-preference'
  });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  const shot = async (name) => { await page.screenshot({ path: path.join(SHOTS, name + '.png') }); console.log('  shot: ' + name); };

  await page.goto('http://localhost:8765/index.html');
  await page.waitForSelector('#v16root .v16-folder-card', { timeout: 15000 });
  await page.waitForTimeout(1500);

  /* ① 首页 seed 数据 */
  let info = await page.evaluate(() => ({
    backend: window.VaultFS.backend(),
    folders: document.querySelectorAll('.v16-folder-card').length,
    notes: document.querySelectorAll('.v16-note-card').length
  }));
  console.log('backend=' + info.backend, 'folders=' + info.folders, 'notes=' + info.notes);
  await shot('01_home_seed');

  /* ② 进入"工作"文件夹 */
  await page.evaluate(() => {
    const cards = document.querySelectorAll('.v16-folder-card');
    for (const c of cards) if (c.dataset.folder === '工作') c.click();
  });
  await page.waitForSelector('.v16-note-card', { timeout: 5000 });
  await page.waitForTimeout(500);
  info = await page.evaluate(() => ({
    crumb: document.getElementById('v16Crumbs').textContent,
    notes: document.querySelectorAll('.v16-note-card').length
  }));
  console.log('工作 folder: ' + info.crumb.replace(/\s+/g,' ') + ' notes=' + info.notes);
  await shot('02_in_work_crumb');

  /* ③ 网格/列表切换 */
  await page.evaluate(() => document.querySelector('#v16ViewSeg button[data-v="list"]').click());
  await page.waitForTimeout(300);
  await shot('03_list_view');
  await page.evaluate(() => document.querySelector('#v16ViewSeg button[data-v="grid"]').click());

  /* ④ 返回根目录，打开一篇 todo 笔记（本周采购清单） */
  await page.evaluate(() => {
    document.querySelector('#v16Crumbs .cr').click();
  });
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    const cards = document.querySelectorAll('.v16-folder-card');
    for (const c of cards) if (c.dataset.folder === '工作') c.click();
  });
  await page.waitForSelector('.v16-note-card', { timeout: 5000 });
  await page.evaluate(() => {
    const cards = document.querySelectorAll('.v16-note-card');
    for (const c of cards) if (c.dataset.path.includes('采购清单')) c.click();
  });
  await page.waitForSelector('#v16EdTitle', { timeout: 5000 });
  await page.waitForTimeout(500);
  await shot('04_todo_editor_render');

  /* ⑤ 勾选一个待办 */
  const todoRows = await page.$$('.v16-todo');
  if (todoRows.length > 0) {
    await todoRows[1].click();
    await page.waitForTimeout(800);
  }
  await shot('05_todo_checked');

  /* ⑥ 源码模式切换 */
  await page.evaluate(() => document.getElementById('v16EdSource').click());
  await page.waitForTimeout(600);
  const hasTextarea = await page.evaluate(() => !!document.getElementById('v16SourceTa'));
  console.log('source textarea shown: ' + hasTextarea);
  await shot('06_source_mode');

  /* ⑦ 源码编辑：追加一行 */
  if (hasTextarea) {
    await page.evaluate(() => {
      const ta = document.getElementById('v16SourceTa');
      ta.value = ta.value + '\n\n## 源码模式追加\n\n这行是 M3 直接编辑 md 后落盘。';
      ta.dispatchEvent(new Event('input'));
    });
    await page.waitForTimeout(1200);  /* 等防抖 500ms 保存 */
  }

  /* ⑧ 切回渲染态 */
  await page.evaluate(() => document.getElementById('v16EdSource').click());
  await page.waitForTimeout(800);
  await shot('07_back_to_render_with_new_line');

  /* ⑨ 返回，新建笔记（FAB 长按 → 新建笔记） */
  await page.evaluate(() => document.getElementById('v16EdBack').click());
  await page.waitForTimeout(600);
  await page.evaluate(async () => {
    /* 直接调 Vault.create 新建笔记 */
    const path = await window.Vault.create({ title: 'M3 新建测试', folder: '', type: 'note', content: '## 新建笔记\n\n这是 M2 真实 CRUD 新建的。' });
    await window.VUI.renderHome();
    return path;
  });
  await page.waitForTimeout(600);
  await shot('08_after_create_note');

  /* ⑩ 搜索 */
  await page.evaluate(() => document.getElementById('v16SearchBtn').click());
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    const inp = document.getElementById('v16SrInput');
    inp.value = '采购';
    inp.dispatchEvent(new Event('input'));
  });
  await page.waitForTimeout(600);
  await shot('09_search_result');

  /* ⑪ 回收站（空，因 seed 不进回收站；演示空态） */
  await page.evaluate(() => document.getElementById('v16SrBack').click());
  await page.waitForTimeout(300);
  await page.evaluate(() => document.getElementById('v16More').click());
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    const opts = document.querySelectorAll('.v16-sheet-opt');
    for (const o of opts) if (o.textContent.includes('回收站')) o.click();
  });
  await page.waitForTimeout(500);
  await shot('10_trash_empty');

  /* ⑫ 删除一篇笔记 → 回收站（直接调 Vault.remove） */
  await page.evaluate(() => document.getElementById('v16TrashBack').click());
  await page.waitForTimeout(300);
  await page.evaluate(async () => {
    await window.Vault.remove('M3 新建测试.md');
    await window.VUI.renderHome();
  });
  await page.waitForTimeout(600);
  await shot('11_after_delete');

  /* ⑬ 进回收站看刚删的 */
  await page.evaluate(() => document.getElementById('v16More').click());
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    const opts = document.querySelectorAll('.v16-sheet-opt');
    for (const o of opts) if (o.textContent.includes('回收站')) o.click();
  });
  await page.waitForTimeout(500);
  await shot('12_trash_has_item');

  /* ⑭ 深色主题 */
  await page.evaluate(() => document.getElementById('v16TrashBack').click());
  await page.waitForTimeout(300);
  await page.evaluate(() => window.VUI.toggleTheme(false));
  await page.waitForTimeout(400);
  await shot('13_dark_home');

  console.log('\npageerrors: ' + errs.length);
  if (errs.length) console.log(errs.slice(0, 5));
  await browser.close();
  process.exit(errs.length ? 1 : 0);
})();
