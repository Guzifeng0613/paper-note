/* M1 验收：v16 新 UI 全页面 + mock vault，16.0.0-alpha.1
   用法: node _verify/t_m1.js
   截图 -> _verify/shots/m1/ ；全程 pageerror 收集并在末尾汇总 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const EXE = '/opt/vm/preinstall/ms-playwright/chromium_headless_shell-1169/chrome-linux/headless_shell';
const BASE = path.resolve(__dirname, '..') + '/';
const OUT = path.join(__dirname, 'shots', 'm1');
fs.mkdirSync(OUT, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));

const shot = async (page, name) => {
  await sleep(450);
  await page.screenshot({ path: path.join(OUT, name + '.png') });
  console.log('  shot:', name);
};

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: EXE });
  const ctx = await browser.newContext({
    viewport: { width: 360, height: 792 },
    deviceScaleFactor: 4,
    isMobile: true, hasTouch: true, reducedMotion: 'no-preference',
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE.ERROR: ' + m.text()); });

  await page.goto('file://' + BASE + 'dist/index.html');
  await page.waitForSelector('#v16root .v16-folder-card', { timeout: 8000 });
  await sleep(600);

  /* ① 首页网格 */
  await shot(page, '01_home_grid');

  /* ② 列表视图 */
  await page.click('#v16ViewSeg button[data-v="list"]');
  await shot(page, '02_home_list');

  /* 回网格 */
  await page.click('#v16ViewSeg button[data-v="grid"]');
  await sleep(300);

  /* ③ 抽屉文件树展开（点开"工作"） */
  await page.click('#v16Menu');
  await sleep(400);
  await page.evaluate(() => {
    const row = Array.from(document.querySelectorAll('#v16Tree .v16-tree-row'))
      .find(r => r.dataset.path === '工作');
    if (row && row.querySelector('.tw svg')) row.querySelector('.tw').click();
  });
  await sleep(400);
  await shot(page, '03_drawer_tree_open');
  /* 关抽屉 */
  await page.evaluate(() => document.getElementById('v16DrawerClose').click());
  await sleep(300);

  /* ④ 进入子文件夹（工作）的面包屑 */
  await page.evaluate(() => {
    const c = document.querySelector('.v16-folder-card[data-path="工作"]');
    if (c) c.click();
  });
  await sleep(500);
  await shot(page, '04_crumbs_subfolder');
  /* 回根 */
  await page.evaluate(() => { document.querySelector('#v16Crumbs .cr').click(); });
  await sleep(400);

  /* ⑤ 长按多选态 */
  await page.evaluate(() => {
    const card = document.querySelector('.v16-note-card[data-path="工作/周会纪要.md"]')
      || document.querySelector('.v16-note-card');
    if (card) {
      const ev = new Event('touchstart', { bubbles: true });
      card.dispatchEvent(ev);
      setTimeout(() => card.dispatchEvent(new Event('touchend', { bubbles: true })), 560);
    }
  });
  await sleep(700);
  await shot(page, '05_selecting');
  /* 退出多选 */
  await page.evaluate(() => { const b = document.querySelector('#v16Selbar button'); if (b) b.click(); });
  await sleep(400);

  /* ⑥ FAB 长按展开 */
  await page.evaluate(() => {
    const fab = document.getElementById('v16Fab');
    fab.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    setTimeout(() => fab.dispatchEvent(new MouseEvent('mouseup', { bubbles: true })), 560);
  });
  await sleep(600);
  await shot(page, '06_fab_longpress');
  /* 收起菜单 */
  await page.evaluate(() => { document.getElementById('v16Fab').click(); });
  await sleep(300);

  /* ⑦ 编辑器（普通笔记 + 富文本 + 附件）：搬家记录 */
  await page.evaluate(() => window.VUI.openNote('生活/搬家记录.md'));
  await sleep(700);
  await shot(page, '07_editor_rich_attach');

  /* ⑧ 源码模式 */
  await page.click('#v16EdSource');
  await sleep(400);
  await shot(page, '08_editor_source');
  /* 返回 */
  await page.click('#v16EdBack');
  await sleep(400);

  /* ⑨ todo 型编辑器（可勾选）：周会纪要 */
  await page.evaluate(() => window.VUI.openNote('工作/周会纪要.md'));
  await sleep(700);
  await shot(page, '09_editor_todo');
  /* 点一个待办勾选 */
  await page.evaluate(() => {
    const row = document.querySelector('#v16EdScroll .v16-todo:not(.done)');
    if (row) row.click();
  });
  await sleep(600);
  await shot(page, '09b_editor_todo_checked');
  await page.click('#v16EdBack');
  await sleep(400);

  /* ⑩ 设置资料库分组 */
  await page.evaluate(async () => { window.VUI.show('settings'); await window.VUI.renderSettings(); });
  await sleep(500);
  await shot(page, '10_settings_vault');

  /* ⑪ 搜索页 */
  await page.evaluate(() => window.VUI.show('search'));
  await sleep(300);
  await page.fill('#v16SrInput', '笔记');
  await sleep(500);
  await shot(page, '11_search');

  /* ⑫ 回收站 */
  await page.evaluate(async () => { window.VUI.show('trash'); await window.VUI.renderTrash(); });
  await sleep(600);
  await shot(page, '12_trash');

  /* ⑬ 深色主题首页 + 编辑器 */
  await page.evaluate(() => window.VUI.applyTheme('dark'));
  await sleep(400);
  await page.evaluate(() => window.VUI.show('home'));
  await sleep(400);
  await shot(page, '13a_dark_home');
  await page.evaluate(() => window.VUI.openNote('读书/读书笔记.md'));
  await sleep(700);
  await shot(page, '13b_dark_editor');
  await page.evaluate(() => window.VUI.applyTheme('light'));

  await browser.close();
  console.log('\n=== pageerror / console.error 数量:', errors.length);
  errors.forEach(e => console.log('  ' + e));
  if (errors.length) process.exitCode = 1;
})().catch(e => { console.error('FATAL', e); process.exit(1); });
