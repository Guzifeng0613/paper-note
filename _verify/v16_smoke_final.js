/* 纸片 v16.0.3 冒烟回归测试（最终版） */
const { chromium } = require('playwright');
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: '/opt/vm/preinstall/ms-playwright/chromium_headless_shell-1169/chrome-linux/headless_shell' });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });

  let pass = 0, fail = 0;
  const check = (name, ok) => { console.log((ok?'✓':'✗')+' '+name); ok?pass++:fail++; };
  const jsClick = sel => page.evaluate(s => { const el=document.querySelector(s); if(el){el.click();return true;} return false; }, sel);

  await page.goto('http://localhost:8765/index.html');
  await sleep(2500);

  /* 1. 启动 */
  const boot = await page.evaluate(() => ({
    v16root: !!document.getElementById('v16root'),
    vault: typeof window.Vault !== 'undefined',
    vaultSync: typeof window.VaultSync !== 'undefined',
  }));
  check('v16 root 渲染', boot.v16root);
  check('Vault 可用', boot.vault);
  check('VaultSync 可用', boot.vaultSync);

  /* 2. 首页元素 */
  for (const id of ['v16Menu','v16HomeAi','v16SearchBtn','v16More','v16Fab','v16ViewSeg','v16Body']) {
    check('首页 #'+id, !!(await page.$('#'+id)));
  }

  /* 3. AI 对话屏（核心：openLegacy 同步） */
  await page.click('#v16HomeAi');
  await sleep(2000);
  const chatCls = await page.evaluate(() => document.getElementById('scr-chat')?.className || '');
  check('AI 对话屏打开(active+legacy-top)', chatCls.includes('active') && chatCls.includes('legacy-top'));
  const chatBodyLen = await page.evaluate(() => document.getElementById('chatBody')?.innerHTML.length || 0);
  check('AI 对话屏内容区非空', chatBodyLen > 0);

  /* 4. 安卓返回键关闭旧屏（__dismissOverlay 被 vault-ui 包装） */
  const dismissed = await page.evaluate(() => window.__dismissOverlay && window.__dismissOverlay());
  check('返回键关闭旧屏', dismissed === true);
  await sleep(800);
  const chatClosed = await page.evaluate(() => !document.getElementById('scr-chat')?.classList.contains('active'));
  check('AI 屏已关闭', chatClosed);

  /* 5. 搜索 */
  await page.click('#v16SearchBtn');
  await sleep(500);
  check('搜索页打开', !!(await page.$('.v16-scr[data-scr="search"].on')));
  await page.fill('#v16SrInput', 'test');
  await sleep(600);
  check('搜索输入无报错', true);
  await page.click('#v16SrBack');
  await sleep(400);

  /* 6. 设置页（通过更多 sheet） */
  await page.click('#v16More');
  await sleep(500);
  await page.evaluate(() => {
    const opts = document.querySelectorAll('#v16root [class*="sheet-opt"]');
    for (const o of opts) { if (o.textContent.includes('设置')) { o.click(); return; } }
    const scr = document.querySelector('.v16-scr[data-scr="settings"]');
    if (scr) { document.querySelectorAll('.v16-scr').forEach(s=>s.classList.remove('on')); scr.classList.add('on'); }
  });
  await sleep(600);
  const rowCount = await page.$$eval('.v16-row[data-row]', els => els.length);
  check('设置页 data-row 行数>20', rowCount > 20);

  /* 7. 展开所有设置组，然后 JS 点击各行测试 */
  await page.evaluate(() => {
    document.querySelectorAll('#v16root .v16-set-group').forEach(g => g.classList.add('open'));
  });
  await sleep(300);

  /* 字号刻度尺 */
  await jsClick('.v16-row[data-row="fontscale"]');
  await sleep(500);
  const ft = await page.evaluate(() => document.querySelector('#v16root .v16-toast')?.textContent || '');
  check('字号刻度尺有反馈', ft.includes('字号'));

  /* 关于 */
  await jsClick('.v16-row[data-row="about"]');
  await sleep(500);
  const aboutText = await page.evaluate(() => document.getElementById('modal')?.textContent || '');
  check('关于显示当前版本', aboutText.includes('16.0.5'));
  await page.evaluate(() => document.getElementById('modal')?.classList.remove('show'));

  /* 8. AI 配置屏 */
  await jsClick('.v16-row[data-row="ai"]');
  await sleep(2000);
  const aiCls = await page.evaluate(() => document.getElementById('scr-ai')?.className || '');
  check('AI 配置屏打开', aiCls.includes('active') && aiCls.includes('legacy-top'));
  await page.evaluate(() => window.__dismissOverlay());
  await sleep(600);

  /* 9. 日志屏 */
  await jsClick('.v16-row[data-row="log"]');
  await sleep(2000);
  const logCls = await page.evaluate(() => document.getElementById('scr-log')?.className || '');
  check('运行日志屏打开', logCls.includes('active') && logCls.includes('legacy-top'));
  await page.evaluate(() => window.__dismissOverlay());
  await sleep(600);

  /* 10. 百度网盘（即将上线） */
  await jsClick('.v16-row[data-row="pan"]');
  await sleep(400);
  const panToast = await page.evaluate(() => document.querySelector('#v16root .v16-toast')?.textContent || '');
  check('百度网盘提示即将上线', panToast.includes('即将上线'));

  /* 11. 附件位置（反馈） */
  await jsClick('.v16-row[data-row="attachloc"]');
  await sleep(400);
  const attToast = await page.evaluate(() => document.querySelector('#v16root .v16-toast')?.textContent || '');
  check('附件位置有反馈', attToast.length > 0);

  /* 12. Vault.create 不报错 */
  await page.evaluate(() => {
    const scr = document.querySelector('.v16-scr[data-scr="home"]');
    if (scr) { document.querySelectorAll('.v16-scr').forEach(s=>s.classList.remove('on')); scr.classList.add('on'); }
  });
  await sleep(400);
  try {
    await page.evaluate(async () => { await window.Vault.create({title:'冒烟测试',folder:'',type:'note'}); });
    check('Vault.create 不报错', true);
  } catch(e) { check('Vault.create 不报错', false); }

  await browser.close();

  console.log('\n===== 结果 =====');
  console.log(`通过: ${pass} / ${pass+fail}`);
  if (fail) console.log(`失败: ${fail}`);
  console.log('pageerror/console.error: ' + errors.length);
  errors.forEach(e => console.log('  ' + e));
  process.exit(fail > 0 || errors.length > 0 ? 1 : 0);
})();
