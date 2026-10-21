/* f01_blockers.js — 复核 4 阻断项：待办/左缘手势/序列化/颜色 */
'use strict';
const { chromium } = require('playwright');
const path = require('path');
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
  await page.waitForTimeout(800);

  log('=== 阻断①：受控待办 ===');
  await page.evaluate(()=>{[...document.querySelectorAll('.v16-folder-card')].find(f=>f.dataset.folder==='工作').click();});
  await page.waitForTimeout(400);
  await page.evaluate(()=>{const c=[...document.querySelectorAll('.v16-note-card')].find(x=>x.dataset.path.includes('采购清单')); c.click();});
  await page.waitForSelector('#v16EdBody', {timeout:5000});
  await page.waitForTimeout(400);
  const boxes = await page.$$eval('.v16-ed-todoinput', els=>els.map(e=>({checked:e.checked, key:e.dataset.key})));
  log('渲染出的 checkbox:', boxes);
  /* 初始应为 2 个 checked（咖啡豆/牛奶鸡蛋） */
  const initChecked = boxes.filter(b=>b.checked).length;
  log('初始已勾选数（期望 2）:', initChecked);
  /* 读初始 md */
  const md0 = await page.evaluate(async()=>await window.VaultFS.read('工作/本周采购清单.md'));
  log('初始 md 待办行:'); md0.split('\n').filter(l=>/^\s*- \[/.test(l)).forEach(l=>log('  '+l));

  /* 连续切换：勾"厨房纸巾"，再取消，再勾"周末的水果"，再取消 */
  const toggleNth = async (n)=>{ const b = await page.$$('.v16-ed-todoinput'); await b[n].click(); await page.waitForTimeout(400); };
  await toggleNth(2); /* 厨房纸巾 */
  await toggleNth(2); /* 取消 */
  await toggleNth(4); /* 周末的水果 */
  await page.waitForTimeout(400);
  const md1 = await page.evaluate(async()=>await window.VaultFS.read('工作/本周采购清单.md'));
  log('连续切换后 md 待办行:'); md1.split('\n').filter(l=>/^\s*- \[/.test(l)).forEach(l=>log('  '+l));
  log('#p/high 仍在?', /#p\/high/.test(md1));
  log('#p/low  仍在?', /#p\/low/.test(md1));
  log('周末的水果已勾?', /- \[x\] 周末的水果/.test(md1));
  log('厨房纸巾未勾?', /- \[ \] 厨房纸巾/.test(md1));

  log('\n=== 阻断②：左缘跟手返回手势（v16 编辑器屏） ===');
  const scrBefore = await page.evaluate(()=>document.querySelector('.v16-scr.on')?.dataset.scr);
  log('手势前:', scrBefore);
  await page.mouse.move(5, 400); await page.mouse.down();
  for(let x=5;x<=300;x+=12){ await page.mouse.move(x,400); await page.waitForTimeout(14); }
  await page.mouse.up();
  await page.waitForTimeout(600);
  const scrAfter = await page.evaluate(()=>document.querySelector('.v16-scr.on')?.dataset.scr);
  log('手势后:', scrAfter, '(期望 home)');

  log('\n=== 阻断④：颜色选择器 ===');
  /* 回编辑器打开另一个笔记 */
  await page.evaluate(()=>{const c=[...document.querySelectorAll('.v16-note-card')].find(x=>x.dataset.path.includes('产品灵感记录')); if(c)c.click();});
  await page.waitForSelector('#v16EdBody', {timeout:5000});
  await page.waitForTimeout(300);
  const colorBefore = await page.evaluate(async()=>{
    const m = await window.VaultFS.read('工作/产品灵感记录.md');
    const fm = window.MD.parseFrontmatter(m).fm; return fm.color;
  });
  log('改色前 frontmatter.color:', colorBefore);
  /* 打开更多菜单，找颜色 */
  await page.click('#v16EdMore'); await page.waitForTimeout(300);
  const moreOpts = await page.$$eval('#v16SheetOpts .v16-sheet-opt', els=>els.map(e=>e.textContent.trim()));
  log('笔记操作 sheet:', moreOpts);
  /* 找颜色项 */
  const hasColorOpt = moreOpts.some(o=>o.includes('颜色'));
  log('sheet 含"颜色"项?', hasColorOpt);
  if(hasColorOpt){
    await page.evaluate(()=>{[...document.querySelectorAll('#v16SheetOpts .v16-sheet-opt')].find(o=>o.textContent.includes('颜色')).click();});
    await page.waitForTimeout(400);
    /* 调色板圆点 */
    const dots = await page.$$('.v16cdot');
    log('调色板色点数:', dots.length);
    if(dots.length){ await dots[0].click(); await page.waitForTimeout(500); }
    const colorAfter = await page.evaluate(async()=>{
      const m = await window.VaultFS.read('工作/产品灵感记录.md');
      const fm = window.MD.parseFrontmatter(m).fm; return fm.color;
    });
    log('改色后 frontmatter.color:', colorAfter, '(点击了色点 0)');
  }

  log('\n=== 阻断③：WYSIWYG 序列化 ===');
  const ed = await page.$('#v16EdBody');
  await ed.click();
  await page.keyboard.press('End');
  /* 选末尾刚输入的词做 bold */
  await page.keyboard.type(' SEQBOLD');
  await page.waitForTimeout(200);
  await page.evaluate(()=>{
    const ed=document.getElementById('v16EdBody');
    const walker=document.createTreeWalker(ed, NodeFilter.SHOW_TEXT);
    let node; while(node=walker.nextNode()){ if(node.textContent.includes('SEQBOLD')){
      const r=document.createRange(); r.setStart(node, node.textContent.length-7); r.setEnd(node, node.textContent.length);
      const s=window.getSelection(); s.removeAllRanges(); s.addRange(r); break; } }
  });
  await page.click('#v16Dock button[data-t="bold"]');
  await page.waitForTimeout(1200);
  const md = await page.evaluate(async()=>await window.VaultFS.read('工作/产品灵感记录.md'));
  log('--- 落盘 MD 尾部 ---'); log(md.slice(-300));
  log('**SEQBOLD** 正确包裹?', /\*\*SEQBOLD\*\*/.test(md));

  log('\npageerrors:', errs); errs.forEach(e=>log('  '+e));
  await browser.close();
})();
