/* 新功能验收：删除撤销 + 编辑器更多菜单（添加文件/导出） */
const { chromium } = require('playwright');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const browser=await chromium.launch({ executablePath:'/opt/vm/preinstall/ms-playwright/chromium_headless_shell-1169/chrome-linux/headless_shell', args:['--no-sandbox'] });
  const page=await browser.newPage({viewport:{width:360,height:792},deviceScaleFactor:4,hasTouch:false});
  const errs=[];
  page.on('pageerror',e=>errs.push('PAGEERR:'+e.message));
  page.on('console',m=>{ if(m.type()==='error') errs.push('CONSOLE:'+m.text()); });
  const results=[];
  const check=(name,cond,extra)=>results.push({name,pass:!!cond,extra:extra||''});
  const idle=()=>page.evaluate(()=>window.__opIdle&&window.__opIdle());

  await page.goto('http://localhost:8765/index.html',{waitUntil:'load'});
  await sleep(2500);

  // 新建笔记
  await page.click('#v16Fab'); await sleep(500);
  await page.evaluate(()=>document.querySelector('.v16-fab-item[data-f="note"]').click());
  await sleep(1200);
  await page.evaluate(()=>{ const t=document.getElementById('v16EdTitle'); t.value='撤销测试'; t.dispatchEvent(new Event('input',{bubbles:true})); });
  await sleep(600);
  // 输入正文
  await page.evaluate(()=>{ const b=document.getElementById('v16EdBody'); b.innerHTML='<p>这是一段正文</p>'; });
  await sleep(600);

  // 打开编辑器更多，确认有 添加文件/导出长截图/导出PDF
  await page.click('#v16EdMore'); await sleep(500);
  const menuText=await page.evaluate(()=>document.getElementById('v16SheetOpts').textContent);
  check('菜单含添加文件',menuText.includes('添加文件'));
  check('菜单含导出长截图',menuText.includes('长截图'));
  check('菜单含导出PDF',menuText.includes('PDF'));
  // 关闭菜单
  await page.click('#v16SheetCancel'); await sleep(400);

  // 删除
  await page.click('#v16EdMore'); await sleep(500);
  await page.evaluate(()=>{ Array.from(document.querySelectorAll('#v16SheetOpts .v16-sheet-opt')).find(e=>e.textContent.includes('删除'))?.click(); });
  await sleep(600);
  await page.click('#delConf'); await sleep(1400);
  await idle();
  // 确认在首页 + 出现撤销按钮
  const hasUndo=await page.evaluate(()=>document.querySelector('.v16-toast .v16-toast-act')!==null);
  check('删除后出现撤销按钮',hasUndo);
  // 点撤销
  await page.evaluate(()=>document.querySelector('.v16-toast .v16-toast-act')?.click());
  await sleep(1000);
  await idle();
  const restored=await page.evaluate(()=>document.querySelector('.v16-note-card[data-path="撤销测试.md"]')!==null);
  check('撤销后笔记恢复',restored);

  const fails=results.filter(r=>!r.pass);
  console.log('\n===== 新功能结果 =====');
  results.forEach(r=>console.log((r.pass?'✓':'✗')+' '+r.name));
  console.log('\n通过: '+(results.length-fails.length)+'/'+results.length);
  console.log('失败:',fails.map(r=>r.name));
  console.log('错误:',errs.slice(0,6));
  await browser.close();
})();
