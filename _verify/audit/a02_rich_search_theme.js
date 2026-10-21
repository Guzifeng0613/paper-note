/* a02_rich_search_theme.js — A2 富文本 / A5 搜索视图字体 / A6 主题 / A9 设置 / A8 AI 入口 / A10 手势 */
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
  const G = expr => page.evaluate(expr);

  await page.goto('http://localhost:8765/index.html', { waitUntil: 'load' });
  await page.waitForSelector('#v16root .v16-folder-card', { timeout: 15000 });
  await page.waitForTimeout(800);

  /* ===== A2 富文本：打开 工作/产品灵感记录.md，点工具栏按钮，验证落盘 MD ===== */
  log('=== A2 富文本工具栏 ===');
  await page.evaluate(()=>{[...document.querySelectorAll('.v16-folder-card')].find(f=>f.dataset.folder==='工作').click();});
  await page.waitForTimeout(400);
  await page.evaluate(()=>{const c=[...document.querySelectorAll('.v16-note-card')].find(x=>x.dataset.path.includes('产品灵感记录')); c.click();});
  await page.waitForSelector('#v16EdBody', {timeout:5000});
  await page.waitForTimeout(300);
  const dockBtns = await page.$$eval('#v16Dock button', els=>els.map(b=>b.dataset.t+':'+b.textContent.trim().slice(0,6)));
  log('dock 工具栏按钮:', dockBtns);
  /* 把正文清空，逐一点按钮并输入，最后读 MD */
  await page.evaluate(()=>{ const ed=document.getElementById('v16EdBody'); ed.innerHTML='<p><br></p>'; ed.focus(); });
  const clickDock = (t)=>page.evaluate((tt)=>{ const b=[...document.querySelectorAll('#v16Dock button')].find(x=>x.dataset.t===tt); b.click(); }, t);
  await clickDock('bold'); await page.keyboard.type('BOLD'); await page.keyboard.press('ArrowRight');
  await clickDock('italic'); await page.keyboard.type(' ITAL'); await page.keyboard.press('ArrowRight');
  await clickDock('underline'); await page.keyboard.type(' UND'); await page.keyboard.press('ArrowRight');
  await clickDock('strike'); await page.keyboard.type(' STRK'); await page.keyboard.press('ArrowRight');
  await clickDock('hl'); await page.keyboard.type(' HILITE'); await page.keyboard.press('ArrowRight');
  await clickDock('list'); await page.keyboard.type(' listitem');
  await page.keyboard.press('Enter'); await page.keyboard.type(' second');
  await clickDock('quote'); await page.keyboard.type(' quoted');
  await clickDock('code'); await page.keyboard.type(' codeblock');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(800); /* 等 500ms 保存 */
  const diskMd = await page.evaluate(async ()=>{
    const m = await window.VaultFS.read('工作/产品灵感记录.md');
    return m;
  });
  log('--- 落盘 MD（前 600 字）---');
  log(diskMd.slice(0,600));
  log('--- 断言 ---');
  log('  ** 加粗 ** :', /\*\*BOLD\*\*/.test(diskMd) || /<b>BOLD<\/b>|<strong>BOLD<\/strong>/.test(diskMd));
  log('  * 斜体 *   :', /\*ITAL\*|<i>ITAL|<em>ITAL/.test(diskMd));
  log('  <u>下划线</u>:', /<u>UND<\/u>|_UND_/.test(diskMd));
  log('  ~~删除线~~ :', /~~STRK~~|<s>STRK|<del>STRK|<strike>STRK/.test(diskMd));
  log('  ==高亮==   :', /==HILITE==|<mark>|<span[^>]*background/.test(diskMd));
  log('  无序列表   :', /- listitem|1\.|<ul>|<li>/.test(diskMd));
  log('  引用       :', /^> quoted|>\s*quoted|<blockquote>/.test(diskMd));
  log('  代码块     :', /```|<pre>|<code>/.test(diskMd));

  /* 返回首页 */
  await page.click('#v16EdBack'); await page.waitForTimeout(400);

  /* ===== A5 搜索 ===== */
  log('\n=== A5 搜索 ===');
  await page.click('#v16SearchBtn'); await page.waitForTimeout(400);
  await page.fill('#v16SrInput', '潜水艇');
  await page.waitForTimeout(400);
  let hits = await page.$$eval('.v16-sr-hit', els=>els.map(e=>e.querySelector('.ht')?.textContent));
  log('搜"潜水艇"（正文词）命中:', hits);
  await page.fill('#v16SrInput', '采购');
  await page.waitForTimeout(400);
  hits = await page.$$eval('.v16-sr-hit', els=>els.map(e=>e.querySelector('.ht')?.textContent));
  log('搜"采购"（标题词）命中:', hits);
  /* 标签搜索：先看现有标签 */
  await page.fill('#v16SrInput', '不存在的词xyz');
  await page.waitForTimeout(300);
  hits = await page.$$eval('.v16-sr-hit', els=>els.length);
  log('搜"不存在xyz"命中数:', hits);
  await page.click('#v16SrBack'); await page.waitForTimeout(300);

  /* ===== A5 网格/列表切换 ===== */
  log('\n=== A5 网格/列表视图 ===');
  await page.evaluate(()=>{ window.VUI.state.curFolder=''; window.VUI.show('home'); window.VUI.renderHome(); });
  await page.waitForTimeout(400);
  await page.evaluate(()=>{[...document.querySelectorAll('.v16-folder-card')].find(f=>f.dataset.folder==='工作').click();});
  await page.waitForTimeout(400);
  await page.click('#v16ViewSeg button[data-v="list"]');
  await page.waitForTimeout(300);
  const listCls = await page.evaluate(()=>{const b=document.querySelector('.v16-body > div'); return b?b.className:'none';});
  log('列表视图容器 class:', listCls);
  await page.click('#v16ViewSeg button[data-v="grid"]');
  await page.waitForTimeout(300);
  const gridCls = await page.evaluate(()=>{const b=document.querySelector('.v16-body > div'); return b?b.className:'none';});
  log('网格视图容器 class:', gridCls);

  /* ===== A6 主题 ===== */
  log('\n=== A6 主题圆形扩散 ===');
  await page.evaluate(()=>window.VUI.toggleTheme(true));
  await page.waitForTimeout(300);
  const revealCount = await page.$$eval('.v16-reveal', els=>els.length);
  const themeNow = await page.evaluate(()=>document.documentElement.dataset.theme);
  log('切换后 .v16-reveal 层数:', revealCount, ' theme=', themeNow);
  await page.waitForTimeout(900);
  await page.screenshot({path:path.resolve(__dirname,'shots/a02_dark.png')});
  /* 回到浅色 */
  await page.evaluate(()=>window.VUI.toggleTheme(true));
  await page.waitForTimeout(900);

  /* ===== A9/A8 设置审计 ===== */
  log('\n=== A9/A8 设置逐项 ===');
  await page.evaluate(()=>window.VUI.show('settings'));
  await page.evaluate(()=>window.VUI.renderSettings());
  await page.waitForTimeout(500);
  await page.screenshot({path:path.resolve(__dirname,'shots/a02_settings.png')});
  const rows = await page.$$eval('.v16-row[data-row]', els=>els.map(r=>({
    label: r.querySelector('.rl')?.textContent.trim(),
    action: r.dataset.row
  })));
  rows.forEach(r=>log('  设置行:', r.action.padEnd(10), r.label));
  /* 逐一点击非 stub 行动作，记录 toast */
  for(const r of rows){
    await page.evaluate((a)=>{ const row=[...document.querySelectorAll('.v16-row[data-row]')].find(x=>x.dataset.row===a); row.click(); }, r.action);
    await page.waitForTimeout(300);
    const toast = await page.$eval('.v16-toast', e=>e.textContent);
    log('   → ['+r.action+'] toast: '+toast);
    /* 关掉可能的 sheet */
    await page.evaluate(()=>{const m=document.getElementById('v16SheetMask'); if(m) m.click();});
    await page.waitForTimeout(200);
  }

  /* ===== A8 AI 入口检查 ===== */
  log('\n=== A8 AI 入口 ===');
  const hasAiBtn = await page.evaluate(()=>({
    v16HomeAi: !!document.querySelector('#v16root #openChat, #v16root [aria-label="AI"]'),
    oldOpenChat: !!document.getElementById('openChat'),
    oldOpenChatVisible: (()=>{const b=document.getElementById('openChat'); if(!b) return false; const r=b.getBoundingClientRect(); return r.width>0 && r.height>0;})(),
    v16EditorAiBtn: !!document.querySelector('#v16EdNoteAI, #v16root .note-ai-btn'),
    oldNoteAiVisible: (()=>{const b=document.getElementById('editNoteAI'); if(!b) return false; const r=b.getBoundingClientRect(); return r.width>0 && r.height>0;})()
  }));
  log(JSON.stringify(hasAiBtn, null, 2));

  /* ===== A10 左缘返回手势：在 v16 编辑器屏上从左缘拖动 ===== */
  log('\n=== A10 左缘返回手势（v16 编辑器） ===');
  await page.evaluate(()=>window.VUI.show('home'));
  await page.evaluate(()=>window.VUI.renderHome());
  await page.waitForTimeout(400);
  await page.evaluate(()=>{const c=[...document.querySelectorAll('.v16-folder-card')].find(f=>f.dataset.folder==='工作'); if(c)c.click();});
  await page.waitForTimeout(400);
  await page.evaluate(()=>{const c=[...document.querySelectorAll('.v16-note-card')].find(x=>x.dataset.path.includes('产品灵感记录')); if(c)c.click();});
  await page.waitForSelector('#v16EdBody', {timeout:5000});
  await page.waitForTimeout(300);
  const scrBefore = await page.evaluate(()=>document.querySelector('.v16-scr.on')?.dataset.scr);
  log('手势前 on 的 v16-screen:', scrBefore);
  /* 从左缘 (5, 400) 拖到 (250, 400) */
  await page.mouse.move(5, 400);
  await page.mouse.down();
  for(let x=5; x<=280; x+=15){ await page.mouse.move(x, 400); await page.waitForTimeout(16); }
  await page.mouse.up();
  await page.waitForTimeout(500);
  const scrAfter = await page.evaluate(()=>document.querySelector('.v16-scr.on')?.dataset.scr);
  log('左缘跟手拖动后 on 的 v16-screen:', scrAfter, '（期望 home）');
  const oldNavDragging = await page.evaluate(()=>!!document.querySelector('.nav-dragging'));
  log('旧屏 nav-dragging class:', oldNavDragging);

  log('\n=== pageerrors ('+errs.length+') ==='); errs.forEach(e=>log('  '+e));
  await browser.close();
})();
