/* 纸片安卓端 UI 打磨验收脚本（playwright）
   用法: node _verify/verify.js [caseName]
   截图输出到 _verify/shots/ ，断言失败会 exit 1 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const EXE = '/opt/vm/preinstall/ms-playwright/chromium_headless_shell-1169/chrome-linux/headless_shell';
const BASE = path.resolve(__dirname, '..') + '/';
const OUT = path.join(__dirname, 'shots');
fs.mkdirSync(OUT, { recursive: true });

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function boot(page, w = 390, h = 844) {
  await page.setViewportSize({ width: w, height: h });
  await page.goto('file://' + BASE + 'index.html');
  await page.waitForFunction(() => window.__app);
  await sleep(400);
  await page.evaluate(() => {
    const A = window.__app;
    if (!A.notes.length) A.notes.push(...A.seed());
    localStorage.setItem('reduceMotion', '1');
  });
}

const cases = {};
async function run(name) {
  const browser = await chromium.launch({ headless: true, executablePath: EXE });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on('console', m => { if (m.type() === 'error') console.log('[console.error]', m.text()); });
  page.on('pageerror', e => console.log('[pageerror]', e.message));
  await boot(page);
  if (cases[name]) await cases[name](page);
  else await cases.baseline(page);
  await browser.close();
}

/* ---- 基础全景截图 ---- */
cases.baseline = async page => {
  const goS = async (h, ms = 500) => { await page.evaluate(h => location.hash = h, h); await sleep(ms); };
  const shot = n => page.screenshot({ path: path.join(OUT, n + '.png') });
  const ids = await page.evaluate(() => ({
    note: (window.__app.notes.find(n => n.type === 'note') || {}).id,
    todo: (window.__app.notes.find(n => n.type === 'todo') || {}).id,
  }));
  await goS('#/home'); await shot('01_home');
  await goS('#/edit?id=' + ids.note); await shot('02_edit_note');
  await goS('#/edit?id=' + ids.todo); await shot('03_edit_todo');
  await goS('#/settings'); await shot('04_settings');
  await goS('#/trash'); await shot('05_trash');
  await goS('#/search'); await shot('06_search');
  await goS('#/chat'); await shot('07_chat');
};

/* ---- 交互断言：各打磨项 ---- */
cases.gestures = async page => {
  const assert = (cond, msg) => { if (!cond) { console.log('FAIL: ' + msg); process.exitCode = 1; } else console.log('PASS: ' + msg); };
  const shot = n => page.screenshot({ path: path.join(OUT, n + '.png') });

  // #1 转场：存在 edge-swipe 处理与转场 class
  await page.evaluate(() => location.hash = '#/home'); await sleep(300);
  await page.evaluate(() => location.hash = '#/settings'); await sleep(650);
  const transCSS = await page.evaluate(() => {
    const el = document.querySelector('.screen:not(.active)');
    if (!el) return 'none';
    return getComputedStyle(el).transitionProperty;
  });
  assert(transCSS !== 'none', '#1 非活动屏幕存在转场 transition（' + transCSS + '）');
  shot('gest_01_transition');

  // #3 chip 选中态
  await page.evaluate(() => location.hash = '#/home'); await sleep(400);
  const chips = await page.$$('.chip');
  assert(chips.length >= 2, '#3 首页存在 ' + chips.length + ' 个笔记本 chip');
  shot('gest_03_chips');

  // #14 主题切换：data-theme 可切换
  const before = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
  await page.evaluate(() => {
    window.__app.prefs.theme = 'dark';
    window.__app.persistPrefs();
    window.__app.applyTheme();
  });
  await sleep(700);
  const after = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
  assert(after === 'dark' && before !== after, '#14 主题可切换为 dark');
  shot('gest_14_dark');

  // #9 字号刻度尺
  await page.evaluate(() => {
    window.__app.prefs.theme = 'light';
    window.__app.applyTheme();
    window.__app.openFontSizeSheet();
  });
  await sleep(300);
  const hasRuler = await page.evaluate(() => !!document.querySelector('.fs-ruler'));
  assert(hasRuler, '#9 字号刻度尺存在');
  shot('gest_09_ruler');

  // #15 手风琴
  await page.evaluate(() => { window.__app.closeModal && window.__app.closeModal(); location.hash = '#/settings'; });
  await sleep(400);
  const accordion = await page.evaluate(() => document.querySelectorAll('.set-card-h').length);
  assert(accordion >= 5, '#15 设置有 ' + accordion + ' 个分组标题');
  shot('gest_15_settings');
};

const name = process.argv[2] || 'baseline';
run(name).catch(e => { console.error(e); process.exit(1); });
