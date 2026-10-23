const { chromium } = require('playwright');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const P=(r,name,cond)=>{console.log((cond?'✓ ':'✗ ')+name); if(!cond) r.fails.push(name);};
(async()=>{
  const r={fails:[]};
  const browser=await chromium.launch({ executablePath:'/opt/vm/preinstall/ms-playwright/chromium_headless_shell-1169/chrome-linux/headless_shell', args:['--no-sandbox'] });
  const page=await browser.newPage({viewport:{width:360,height:792},deviceScaleFactor:4});
  const errs=[];
  page.on('pageerror',e=>errs.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errs.push(m.text());});
  await page.goto('http://localhost:8765/index.html',{waitUntil:'load'});
  await sleep(2500);

  // 1. 短按 FAB 展开菜单
  await page.click('#v16Fab');
  await sleep(500);
  const menuOpen = await page.evaluate(()=>document.getElementById('v16FabMenu').classList.contains('open'));
  P(r,'短按 FAB 展开菜单', menuOpen);

  // 2. 点新建笔记
  await page.evaluate(()=>document.querySelector('.v16-fab-item[data-f="note"]').click());
  await sleep(1200);
  const edScr = await page.evaluate(()=>document.querySelector('.v16-scr[data-scr="editor"]').classList.contains('on'));
  P(r,'新建笔记打开编辑器', edScr);

  // 3. 标题 + 正文
  const hasTitle = await page.evaluate(()=>!!document.getElementById('v16EdTitle'));
  P(r,'编辑器有标题输入框', hasTitle);
  await page.evaluate(()=>{ const t=document.getElementById('v16EdTitle'); if(t){ t.value='测试笔记XYZ'; t.dispatchEvent(new Event('input',{bubbles:true})); } });
  const body = await page.$('#v16EdBody');
  P(r,'编辑器有正文 contenteditable', !!body);
  await page.evaluate(()=>{ const e=document.getElementById('v16EdBody'); e.innerHTML='这是一段独特内容AAABBB。'; e.dispatchEvent(new Event('input',{bubbles:true})); });
  await sleep(800);

  // 4. 工具栏 bold
  await page.evaluate(()=>{
    const e=document.getElementById('v16EdBody'); e.focus();
    document.execCommand('selectAll'); document.execCommand('bold');
  });
  const after = await page.evaluate(()=>document.getElementById('v16EdBody').innerHTML);
  P(r,'工具栏 bold 生效', /<b>|<strong>/.test(after));

  // 5. 保存返回（back 现在会先 flush 落盘，多等一会）
  await page.click('#v16EdBack');
  await sleep(1600);
  const homeScr = await page.evaluate(()=>document.querySelector('.v16-scr[data-scr="home"]').classList.contains('on'));
  P(r,'返回首页', homeScr);
  const homeHas = await page.evaluate(()=>document.getElementById('v16Body').textContent.includes('测试笔记XYZ'));
  P(r,'新笔记出现在首页', homeHas);

  // 6. 搜索能找到
  await page.click('#v16SearchBtn');
  await sleep(600);
  await page.evaluate(()=>{ const i=document.getElementById('v16SrInput'); i.value='AAABBB'; i.dispatchEvent(new Event('input',{bubbles:true})); });
  await sleep(800);
  const searchRes = await page.evaluate(()=>document.body.textContent.includes('测试笔记XYZ'));
  P(r,'搜索找到正文独特内容', searchRes);
  await page.click('#v16SrBack');
  await sleep(500);

  // 7. 重开笔记，内容持久化
  await page.evaluate(()=>{
    const cards=document.querySelectorAll('#v16Body *');
    for(const c of cards){ if(c.textContent.includes('测试笔记XYZ')){ c.click(); return; } }
  });
  await sleep(900);
  const persisted = await page.evaluate(()=>document.getElementById('v16EdBody').textContent.includes('AAABBB'));
  P(r,'重开笔记内容持久化', persisted);

  // 8. 更多菜单有删除
  await page.click('#v16EdMore');
  await sleep(700);
  const hasDelete = await page.evaluate(()=>Array.from(document.querySelectorAll('#v16SheetOpts *')).some(e=>e.textContent.includes('删除')));
  P(r,'编辑器更多菜单有删除', hasDelete);

  console.log('\n===== 结果 =====');
  console.log('失败:', r.fails.length, r.fails);
  console.log('errors:', errs.slice(0,5));
  await browser.close();
})();
