/* a02b_rich_debug.js — 聚焦调试 WYSIWYG：工具栏 → MD 落盘 */
'use strict';
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true,
    executablePath: '/opt/vm/preinstall/ms-playwright/chromium_headless_shell-1169/chrome-linux/headless_shell' });
  const ctx = await browser.newContext({ viewport: { width: 360, height: 792, deviceScaleFactor: 4 },
    isMobile: true, hasTouch: true, reducedMotion: 'no-preference' });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto('http://localhost:8765/index.html', { waitUntil: 'load' });
  await page.waitForSelector('#v16root .v16-folder-card', { timeout: 15000 });
  await page.waitForTimeout(800);

  await page.evaluate(()=>{[...document.querySelectorAll('.v16-folder-card')].find(f=>f.dataset.folder==='工作').click();});
  await page.waitForTimeout(400);
  await page.evaluate(()=>{const c=[...document.querySelectorAll('.v16-note-card')].find(x=>x.dataset.path.includes('产品灵感记录')); c.click();});
  await page.waitForSelector('#v16EdBody', {timeout:5000});
  await page.waitForTimeout(300);

  /* 1) 直接在 contenteditable 末尾聚焦并输入 */
  const ed = await page.$('#v16EdBody');
  await ed.click();
  await page.keyboard.press('End');
  await page.keyboard.type('PLAINTEXT123');
  await page.waitForTimeout(900);
  let md = await page.evaluate(async()=>await window.VaultFS.read('工作/产品灵感记录.md'));
  console.log('输入纯文本后落盘 MD 尾部:'); console.log(md.slice(-200));
  console.log('包含 PLAINTEXT123?', md.includes('PLAINTEXT123'));

  /* 2) 选中文本 + bold */
  await page.evaluate(()=>{
    const ed=document.getElementById('v16EdBody');
    const range=document.createRange(); range.selectNodeContents(ed); range.collapse(false);
    const s=window.getSelection(); s.removeAllRanges(); s.addRange(range);
  });
  /* 选中刚输入的词 */
  await page.evaluate(()=>{
    const ed=document.getElementById('v16EdBody');
    const walker=document.createTreeWalker(ed, NodeFilter.SHOW_TEXT);
    let node; while(node=walker.nextNode()){ if(node.textContent.includes('PLAINTEXT123')){
      const r=document.createRange(); r.setStart(node,0); r.setEnd(node,12);
      const s=window.getSelection(); s.removeAllRanges(); s.addRange(r); break; } }
  });
  await page.click('#v16Dock button[data-t="bold"]');
  await page.waitForTimeout(900);
  md = await page.evaluate(async()=>await window.VaultFS.read('工作/产品灵感记录.md'));
  console.log('bold 后落盘 MD 尾部:'); console.log(md.slice(-200));
  console.log('含 **PLAINTEXT123** 或 <b>?', /\*\*PLAINTEXT123\*\*|<b>PLAINTEXT123|<strong>PLAINTEXT123/.test(md));

  /* 3) 直接 execCommand italic */
  await page.evaluate(()=>{
    const ed=document.getElementById('v16EdBody'); ed.focus();
    document.execCommand('insertHTML', false, '<i>ITALX</i>');
    ed.dispatchEvent(new Event('input',{bubbles:true}));
  });
  await page.waitForTimeout(900);
  md = await page.evaluate(async()=>await window.VaultFS.read('工作/产品灵感记录.md'));
  console.log('insertHTML italic 后 MD 尾部:'); console.log(md.slice(-200));
  console.log('含 ITALX?', md.includes('ITALX'));

  console.log('pageerrors:', errs);
  await browser.close();
})();
