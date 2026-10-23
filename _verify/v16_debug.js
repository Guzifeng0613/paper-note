/* v16 冒烟测试 - 调试版 */
const { chromium } = require('playwright');
const path = require('path');
const EXE = '/opt/vm/preinstall/ms-playwright/chromium_headless_shell-1169/chrome-linux/headless_shell';
const BASE = path.resolve(__dirname, '..') + '/';
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: EXE });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const logs = [];
  page.on('console', m => logs.push(m.type() + ': ' + m.text()));
  page.on('pageerror', e => logs.push('PAGEERROR: ' + e.message));

  await page.goto('file://' + BASE + 'index.html');
  await sleep(2000);

  /* 检查 Vault/VaultSync 状态 */
  const state = await page.evaluate(() => {
    return {
      hasVault: typeof window.Vault !== 'undefined',
      hasVaultSync: typeof window.VaultSync !== 'undefined',
      hasVUI: typeof window.VUI !== 'undefined',
      vaultReady: window.Vault ? !!window.Vault._ready : false,
      notesLen: typeof notes !== 'undefined' ? notes.length : 'undefined',
    };
  });
  console.log('State:', JSON.stringify(state));

  /* 直接调用 openLegacy 并等待 */
  console.log('→ 调用 openLegacy(chat, home)…');
  const result = await page.evaluate(async () => {
    try {
      await openLegacy('chat', 'home');
      const el = document.getElementById('scr-chat');
      return { ok: true, classes: el ? el.className : 'no element' };
    } catch(e) {
      return { ok: false, error: e.message, stack: e.stack };
    }
  });
  console.log('Result:', JSON.stringify(result));
  await sleep(500);

  /* 检查 chat 屏状态 */
  const chatState = await page.evaluate(() => {
    const el = document.getElementById('scr-chat');
    return {
      className: el ? el.className : null,
      display: el ? getComputedStyle(el).display : null,
      zIndex: el ? getComputedStyle(el).zIndex : null,
      visibility: el ? getComputedStyle(el).visibility : null,
      chatBodyHTML: document.getElementById('chatBody') ? document.getElementById('chatBody').innerHTML.substring(0, 200) : null,
    };
  });
  console.log('Chat state:', JSON.stringify(chatState, null, 2));

  console.log('\n--- LOGS ---');
  logs.forEach(l => console.log(l));

  await browser.close();
})();
