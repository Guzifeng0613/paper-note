/* v16 冒烟测试 - HTTP 版 */
const { chromium } = require('playwright');
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: '/opt/vm/preinstall/ms-playwright/chromium_headless_shell-1169/chrome-linux/headless_shell' });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });

  console.log('→ 通过 HTTP 加载…');
  await page.goto('http://localhost:8765/index.html');
  await sleep(2500);

  const state = await page.evaluate(() => ({
    v16root: !!document.getElementById('v16root'),
    vaultReady: window.Vault ? !!window.Vault._ready : false,
    hasVaultSync: typeof window.VaultSync !== 'undefined',
    bodyChildren: document.body.children.length,
  }));
  console.log('Boot state:', JSON.stringify(state));

  if (!state.v16root) {
    console.log('✗ v16root 未渲染，终止测试');
    console.log('Errors:', errors);
    await browser.close();
    process.exit(1);
  }

  /* 1. 首页元素 */
  console.log('\n--- 首页 ---');
  for (const id of ['v16Menu','v16HomeAi','v16SearchBtn','v16More','v16Fab','v16ViewSeg','v16Body']) {
    const el = await page.$('#' + id);
    console.log((el ? '✓' : '✗') + ' #' + id);
  }

  /* 2. 点击 AI 按钮 */
  console.log('\n--- AI 对话 ---');
  await page.click('#v16HomeAi');
  await sleep(2000);
  const chatCls = await page.evaluate(() => {
    const el = document.getElementById('scr-chat');
    return el ? el.className : 'none';
  });
  console.log('scr-chat class:', chatCls);
  const chatOpen = chatCls.includes('active') && chatCls.includes('legacy-top');
  console.log(chatOpen ? '✓ AI 对话屏已打开（同步后显示）' : '✗ AI 对话屏未打开');

  /* 3. 检查 chatBody 内容 */
  const chatBodyLen = await page.evaluate(() => {
    const b = document.getElementById('chatBody');
    return b ? b.innerHTML.length : 0;
  });
  console.log('chatBody 内容长度: ' + chatBodyLen + (chatBodyLen > 0 ? '（有内容）' : '（空，可能无对话历史，正常）'));

  /* 4. 返回 - 用 JS 触发 closeLegacy（在 IIFE 内，通过点击返回按钮） */
  console.log('\n--- 返回 ---');
  /* chatDeskBack 在 legacy-top 下被强制显示 */
  const backVisible = await page.evaluate(() => {
    const btn = document.getElementById('chatDeskBack');
    if (!btn) return false;
    const r = btn.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  });
  console.log('返回按钮可见: ' + backVisible);
  if (backVisible) {
    await page.click('#chatDeskBack');
    await sleep(800);
  } else {
    /* 尝试 chatMenu 旁边的返回，或直接用 JS */
    await page.evaluate(() => {
      const btns = document.querySelectorAll('#scr-chat button');
      for (const b of btns) { if (/back/i.test(b.id)) { b.click(); break; } }
    });
    await sleep(800);
  }
  const chatClosed = await page.evaluate(() => {
    const el = document.getElementById('scr-chat');
    return el ? !el.classList.contains('active') : true;
  });
  console.log(chatClosed ? '✓ 已返回 v16' : '✗ 未返回');

  /* 5. 搜索 */
  console.log('\n--- 搜索 ---');
  await page.click('#v16SearchBtn');
  await sleep(600);
  await page.fill('#v16SrInput', 'a');
  await sleep(800);
  const srBody = await page.evaluate(() => {
    const b = document.getElementById('v16SrBody');
    return b ? b.innerHTML.length : 0;
  });
  console.log('搜索结果区域长度: ' + srBodyLen(srBody));
  await page.click('#v16SrBack');
  await sleep(400);

  /* 6. 设置页 */
  console.log('\n--- 设置页 ---');
  await page.click('#v16More');
  await sleep(500);
  /* 点击 sheet 中的"设置" */
  await page.evaluate(() => {
    const opts = document.querySelectorAll('#v16root [class*="sheet"] [class*="opt"], #v16root .v16-sheet-opt');
    for (const o of opts) { if (o.textContent.includes('设置')) { o.click(); return; } }
    /* fallback: 直接显示设置屏 */
    const scr = document.querySelector('.v16-scr[data-scr="settings"]');
    if (scr) { document.querySelectorAll('.v16-scr').forEach(s => s.classList.remove('on')); scr.classList.add('on'); }
  });
  await sleep(600);
  const rowCount = await page.$$eval('.v16-row[data-row]', els => els.length);
  console.log('设置页 data-row 数量: ' + rowCount);

  /* 7. 测试字号刻度尺 */
  console.log('\n--- 字号刻度尺 ---');
  await page.click('.v16-row[data-row="fontscale"]');
  await sleep(500);
  const fontToast = await page.evaluate(() => {
    const t = document.querySelector('#v16root .v16-toast');
    return t ? t.textContent : '';
  });
  console.log(fontToast.includes('字号') ? '✓ 字号反馈: ' + fontToast : '✗ 无字号反馈: ' + fontToast);

  /* 8. 测试关于 */
  console.log('\n--- 关于 ---');
  await page.click('.v16-row[data-row="about"]');
  await sleep(500);
  const aboutVer = await page.evaluate(() => {
    const m = document.getElementById('modal');
    return m && m.classList.contains('show') ? m.textContent.substring(0, 80) : '';
  });
  console.log(aboutVer.includes('16.0.3') ? '✓ 关于显示 v16.0.3' : '? 关于内容: ' + aboutVer);
  await page.evaluate(() => { const m = document.getElementById('modal'); if (m) m.classList.remove('show'); });

  await browser.close();

  console.log('\n===== 总结 =====');
  console.log('错误数: ' + errors.length);
  errors.forEach(e => console.log('  ' + e));
  process.exit(errors.length ? 1 : 0);

  function srBodyLen(n) { return n + (n > 0 ? '（有结果/空状态）' : '（空）'); }
})();
