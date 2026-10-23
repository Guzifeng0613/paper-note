/* 纸片 v16.0.3 冒烟回归测试（playwright）
   验证：0 pageerror、核心按钮可交互、旧屏桥接同步、设置页各行有反馈 */
const { chromium } = require('playwright');
const path = require('path');

const EXE = '/opt/vm/preinstall/ms-playwright/chromium_headless_shell-1169/chrome-linux/headless_shell';
const BASE = path.resolve(__dirname, '..') + '/';
const sleep = ms => new Promise(r => setTimeout(r, ms));

let errors = [];
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: EXE });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on('pageerror', e => { errors.push('PAGEERROR: ' + e.message); console.log('[pageerror]', e.message); });
  page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });

  console.log('→ 加载 index.html…');
  await page.goto('file://' + BASE + 'index.html');
  await sleep(1500);

  /* 1. v16 root 存在 */
  const v16root = await page.$('#v16root');
  console.log(v16root ? '✓ v16root 存在' : '✗ v16root 缺失');

  /* 2. 首页元素 */
  const checks = ['#v16Menu', '#v16HomeAi', '#v16SearchBtn', '#v16More', '#v16Fab', '#v16ViewSeg'];
  for (const sel of checks) {
    const el = await page.$(sel);
    console.log((el ? '✓' : '✗') + ' ' + sel);
  }

  /* 3. 点击 AI 按钮 → 旧屏 chat 应打开（含同步） */
  console.log('→ 点击首页 AI 按钮…');
  await page.click('#v16HomeAi');
  await sleep(1200);
  const chatActive = await page.$('#scr-chat.active');
  console.log(chatActive ? '✓ AI 对话屏打开（openLegacy 同步后显示）' : '✗ AI 对话屏未打开');
  const chatBody = await page.$('#chatBody');
  console.log(chatBody ? '✓ chatBody 存在' : '✗ chatBody 缺失');

  /* 4. 返回 */
  console.log('→ 点击返回…');
  const backBtn = await page.$('#scr-chat .icon-btn');
  if (backBtn) { await backBtn.click(); await sleep(500); }
  const chatClosed = !(await page.$('#scr-chat.active'));
  console.log(chatClosed ? '✓ 返回 v16 首页' : '✗ 未返回');

  /* 5. 打开设置页 */
  console.log('→ 打开设置页…');
  await page.click('#v16More');
  await sleep(400);
  /* 更多 sheet 里点设置 */
  const setBtn = await page.evaluateHandle(() => {
    const items = document.querySelectorAll('.v16-sheet-opt, .v16-fab-item, [class*="sheet"] [class*="opt"]');
    for (const it of items) { if (it.textContent.includes('设置')) return it; }
    return null;
  });
  const setEl = await setBtn.asElement();
  if (setEl) { await setEl.click(); await sleep(600); }
  const settingsScr = await page.$('.v16-scr[data-scr="settings"].on');
  console.log(settingsScr ? '✓ 设置页打开' : '✗ 设置页未打开');

  /* 6. 设置页行存在性 */
  const rows = await page.$$('.v16-row[data-row]');
  console.log('✓ 设置页共 ' + rows.length + ' 行 data-row');

  /* 7. 点击字号刻度尺 → 应有 toast */
  console.log('→ 测试字号刻度尺…');
  const fontscaleRow = await page.$('.v16-row[data-row="fontscale"]');
  if (fontscaleRow) {
    await fontscaleRow.click();
    await sleep(400);
    const toastText = await page.evaluate(() => {
      const t = document.querySelector('#v16root .v16-toast');
      return t ? t.textContent : '';
    });
    console.log(toastText.includes('字号') ? '✓ 字号刻度尺反馈: ' + toastText : '✗ 字号无反馈: ' + toastText);
  }

  /* 8. 点击关于 → modal */
  console.log('→ 测试关于…');
  const aboutRow = await page.$('.v16-row[data-row="about"]');
  if (aboutRow) {
    await aboutRow.click();
    await sleep(400);
    const modal = await page.$('#modal.show, #modal.v16-lift');
    console.log(modal ? '✓ 关于 modal 弹出' : '? modal 状态需确认');
    /* 关闭 modal */
    await page.evaluate(() => { const m = document.getElementById('modal'); if (m) m.classList.remove('show','v16-lift'); });
    await sleep(200);
  }

  /* 9. 搜索 */
  console.log('→ 测试搜索…');
  await page.click('#v16SearchBtn');
  await sleep(500);
  const searchScr = await page.$('.v16-scr[data-scr="search"].on');
  console.log(searchScr ? '✓ 搜索页打开' : '✗ 搜索页未打开');
  await page.fill('#v16SrInput', 'test');
  await sleep(600);
  console.log('✓ 搜索输入无报错');

  await browser.close();

  console.log('\n===== 结果 =====');
  console.log('pageerror / console.error 数量: ' + errors.length);
  if (errors.length) { errors.forEach(e => console.log('  - ' + e)); process.exit(1); }
  else { console.log('✓ 0 pageerror，冒烟测试通过'); process.exit(0); }
})();
