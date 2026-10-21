/* ============================================================
   t_m4.js —— WYSIWYG 编辑器 + 富文本 + 待办回写走查（beta.2）
   前提：http://localhost:8765/ 已起。截图存 _verify/shots/m4/。
   ============================================================ */
'use strict';
const { chromium } = require('playwright');
const path = require('path'); const fs = require('fs');
const SHOTS = path.resolve(__dirname, '../_verify/shots/m4');
fs.mkdirSync(SHOTS, { recursive: true });

(async () => {
  const browser = await chromium.launch({ headless: true,
    executablePath: '/opt/vm/preinstall/ms-playwright/chromium_headless_shell-1169/chrome-linux/headless_shell' });
  const ctx = await browser.newContext({ viewport: { width: 360, height: 792, deviceScaleFactor: 4 },
    isMobile: true, hasTouch: true, reducedMotion: 'no-preference' });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  const shot = async (n) => { await page.screenshot({ path: path.join(SHOTS, n + '.png') }); console.log('  shot: ' + n); };

  await page.goto('http://localhost:8765/index.html');
  await page.waitForSelector('#v16root .v16-folder-card', { timeout: 15000 });
  await page.waitForTimeout(1200);

  /* 进入工作文件夹，打开采购清单（todo） */
  await page.evaluate(() => { const c=document.querySelectorAll('.v16-folder-card'); for(const x of c) if(x.dataset.folder==='工作') x.click(); });
  await page.waitForSelector('.v16-note-card', { timeout: 5000 });
  await page.evaluate(() => { const c=document.querySelectorAll('.v16-note-card'); for(const x of c) if(x.dataset.path.includes('采购清单')) x.click(); });
  await page.waitForSelector('#v16EdBody', { timeout: 5000 });
  await page.waitForTimeout(600);

  /* ① WYSIWYG 编辑中（含工具栏） */
  await shot('01_wysiwyg_todo_editor');

  /* ② 选中正文文本，点加粗 + 高亮 */
  await page.evaluate(() => {
    const ed = document.getElementById('v16EdBody');
    ed.focus();
    /* 选中 h2 文本 */
    const range = document.createRange();
    const h2 = ed.querySelector('h2');
    range.selectNodeContents(h2);
    const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(range);
  });
  await page.evaluate(() => document.querySelector('#v16Dock button[data-t="bold"]').click());
  await page.evaluate(() => document.querySelector('#v16Dock button[data-t="hl"]').click());
  await page.waitForTimeout(400);
  await shot('02_after_bold_highlight');

  /* ③ 插入无序列表 + 引用 + 代码块 */
  await page.evaluate(() => document.execCommand('insertParagraph'));
  await page.evaluate(() => document.querySelector('#v16Dock button[data-t="list"]').click());
  await page.waitForTimeout(200);
  await page.evaluate(() => document.execCommand('insertText', false, 'M4 列表项'));
  await page.evaluate(() => document.execCommand('insertParagraph'));
  await page.evaluate(() => document.querySelector('#v16Dock button[data-t="quote"]').click());
  await page.evaluate(() => document.execCommand('insertText', false, 'M4 引用文本'));
  await page.waitForTimeout(400);
  await shot('03_list_quote_added');

  /* ④ 勾选一个待办 */
  const inputs = await page.$$('.v16-ed-todoinput');
  if(inputs.length >= 2){ await inputs[1].click(); await page.waitForTimeout(500); }
  await shot('04_todo_checked_in_editor');

  /* ⑤ 等待防抖保存（500ms），返回首页再打开，校验 md 包含加粗/高亮/列表/引用/todo */
  await page.waitForTimeout(1500);
  await page.evaluate(() => document.getElementById('v16EdBack').click());
  await page.waitForTimeout(600);
  await page.evaluate(() => { const c=document.querySelectorAll('.v16-folder-card'); for(const x of c) if(x.dataset.folder==='工作') x.click(); });
  await page.waitForSelector('.v16-note-card', { timeout: 5000 });
  await page.evaluate(() => { const c=document.querySelectorAll('.v16-note-card'); for(const x of c) if(x.dataset.path.includes('采购清单')) x.click(); });
  await page.waitForSelector('#v16EdBody', { timeout: 5000 });
  await page.waitForTimeout(800);
  const verify = await page.evaluate(async () => {
    const ed = document.getElementById('v16EdBody');
    return {
      strong: ed.querySelectorAll('strong, b').length,
      mark: ed.querySelectorAll('mark, highlight').length,
      ul: ed.querySelectorAll('ul').length,
      blockquote: ed.querySelectorAll('blockquote').length,
      todos: ed.querySelectorAll('.v16-ed-todoinput').length,
      checkedTodos: ed.querySelectorAll('.v16-ed-todoinput:checked').length
    };
  });
  console.log('重开校验:', JSON.stringify(verify));
  await shot('05_reopened_after_save');

  /* ⑥ 深色主题 */
  await page.evaluate(() => window.VUI.toggleTheme(false));
  await page.waitForTimeout(400);
  await shot('06_dark_editor');

  console.log('\npageerrors: ' + errs.length);
  if(errs.length) console.log(errs.slice(0,5));
  await browser.close();
  process.exit(errs.length ? 1 : 0);
})();
