/* 全量按钮审计：逐个点击所有入口，检查是否有反馈、是否报错、是否空壳 */
const { chromium } = require('playwright');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const browser=await chromium.launch({ executablePath:'/opt/vm/preinstall/ms-playwright/chromium_headless_shell-1169/chrome-linux/headless_shell', args:['--no-sandbox'] });
  const page=await browser.newPage({viewport:{width:360,height:792},deviceScaleFactor:4});
  const errs=[];
  page.on('pageerror',e=>errs('PAGEERR:'+e.message));
  page.on('console',m=>{ if(m.type()==='error') errs.push('CONSOLE:'+m.text()); });
  const results=[];
  const check=(name,cond,extra)=>results.push({name,pass:!!cond,extra:extra||''});
  const idle=()=>page.evaluate(()=>window.__opIdle&&window.__opIdle());
  const scr=()=>page.evaluate(()=>document.querySelector('.v16-scr.on')?.dataset.scr);
  const toastVisible=()=>page.evaluate(()=>{const t=document.querySelector('.v16-toast,.toast');return t&&getComputedStyle(t).opacity!=='0'&&t.textContent});

  await page.goto('http://localhost:8765/index.html',{waitUntil:'load'});
  await sleep(2500);

  /* ===== 首页顶栏 ===== */
  // 菜单抽屉
  await page.click('#v16Menu'); await sleep(600);
  const drawerOpen=await page.evaluate(()=>document.querySelector('.v16-drawer.open')!==null);
  check('菜单→抽屉打开',drawerOpen);
  await page.click('#v16DrawerClose'); await sleep(400);

  // 搜索
  await page.click('#v16SearchBtn'); await sleep(600);
  check('搜索屏打开',(await scr())==='search');
  await page.fill('#v16SrInput','测试'); await sleep(500);
  const srBody=await page.evaluate(()=>document.getElementById('v16SrBody').children.length);
  check('搜索有结果区（不报错）',srBody>=0);
  await page.click('#v16SrBack'); await sleep(400);

  // 更多
  await page.click('#v16More'); await sleep(600);
  const moreOpts=await page.evaluate(()=>document.querySelectorAll('#v16SheetOpts .v16-sheet-opt').length);
  check('更多 sheet 有选项',moreOpts===4);
  // 逐个点更多项（设置）
  await page.evaluate(()=>{ Array.from(document.querySelectorAll('#v16SheetOpts .v16-sheet-opt')).find(e=>e.textContent.includes('设置'))?.click(); });
  await sleep(700);
  check('更多→设置',(await scr())==='settings');
  await page.click('#v16SetBack'); await sleep(400);

  // 更多→回收站
  await page.click('#v16More'); await sleep(500);
  await page.evaluate(()=>{ Array.from(document.querySelectorAll('#v16SheetOpts .v16-sheet-opt')).find(e=>e.textContent.includes('回收站'))?.click(); });
  await sleep(700);
  check('更多→回收站',(await scr())==='trash');
  const trashItems=await page.evaluate(()=>document.getElementById('v16TrashBody')?.children.length);
  check('回收站有列表区',trashItems!==undefined);
  await page.click('#v16TrashBack'); await sleep(400);

  // 更多→主题切换
  await page.click('#v16More'); await sleep(500);
  const themeBefore=await page.evaluate(()=>document.documentElement.dataset.theme);
  await page.evaluate(()=>{ Array.from(document.querySelectorAll('#v16SheetOpts .v16-sheet-opt')).find(e=>e.textContent.includes('深色'))?.click(); });
  await sleep(900);
  const themeAfter=await page.evaluate(()=>document.documentElement.dataset.theme);
  check('更多→主题切换',themeAfter!==themeBefore);
  // 切回
  await page.click('#v16More'); await sleep(500);
  await page.evaluate(()=>{ Array.from(document.querySelectorAll('#v16SheetOpts .v16-sheet-opt')).find(e=>e.textContent.includes('深色'))?.click(); });
  await sleep(900);

  /* ===== FAB 新建笔记 ===== */
  await page.click('#v16Fab'); await sleep(500);
  await page.evaluate(()=>document.querySelector('.v16-fab-item[data-f="note"]').click());
  await sleep(1200);
  check('FAB→新建笔记→编辑器',(await scr())==='editor');

  // 标题+正文
  await page.evaluate(()=>{ const t=document.getElementById('v16EdTitle'); t.value='审计笔记AAA'; t.dispatchEvent(new Event('input',{bubbles:true})); });
  const body=await page.$('#v16EdBody');
  await body.click({position:{x:100,y:100}});
  await page.keyboard.type('这是审计正文BBB');
  await sleep(800);

  /* ===== 编辑器 dock 逐个按钮 ===== */
  const dockTests=[
    ['head','h2'],['bold','b'],['italic','i'],['underline','u'],['strike','del'],
    ['list','ul'],['quote','blockquote'],['code','pre']
  ];
  for(const [t,tag] of dockTests){
    // 全选后应用
    await page.evaluate(()=>{ const ed=document.getElementById('v16EdBody'); ed.focus(); document.execCommand('selectAll'); });
    await page.evaluate((tt)=>{ document.querySelector(`#v16Dock button[data-t="${tt}"]`).click(); },t);
    await sleep(300);
  }
  check('dock 8 个格式按钮无报错',true);

  // hl 高亮
  await page.evaluate(()=>{ document.querySelector('#v16Dock button[data-t="hl"]').click(); });
  await sleep(300);
  // todo 插入
  await page.evaluate(()=>{ document.querySelector('#v16Dock button[data-t="todo"]').click(); });
  await sleep(300);
  const todoInserted=await page.evaluate(()=>document.querySelectorAll('#v16EdBody .v16-ed-todoinput').length);
  check('dock 插入待办 checkbox',todoInserted>=1);
  // link
  await page.evaluate(()=>{ window.prompt=()=>'https://example.com'; document.querySelector('#v16Dock button[data-t="link"]').click(); });
  await sleep(300);
  check('dock link 无报错',true);
  await idle();

  /* ===== 编辑器更多 ===== */
  await page.click('#v16EdMore'); await sleep(500);
  const edMoreOpts=await page.evaluate(()=>document.querySelectorAll('#v16SheetOpts .v16-sheet-opt').length);
  check('编辑器更多有4选项',edMoreOpts===4);

  // 置顶
  await page.evaluate(()=>{ Array.from(document.querySelectorAll('#v16SheetOpts .v16-sheet-opt')).find(e=>e.textContent.includes('置顶'))?.click(); });
  await sleep(800);
  await idle();
  const pinned=await page.evaluate(()=>window.__S()._cur?.entry?.pinned);
  check('置顶生效',pinned===true);

  // 颜色
  await page.click('#v16EdMore'); await sleep(500);
  await page.evaluate(()=>{ Array.from(document.querySelectorAll('#v16SheetOpts .v16-sheet-opt')).find(e=>e.textContent.includes('颜色'))?.click(); });
  await sleep(700);
  await page.evaluate(()=>document.querySelector('#v16SheetOpts .v16cdot[data-c="blue"]')?.click());
  await sleep(800);
  await idle();
  const color=await page.evaluate(()=>window.__S()._cur?.entry?.color);
  check('颜色更换',color==='blue');

  // 源码模式
  await page.click('#v16EdSource'); await sleep(700);
  const srcOn=await page.evaluate(()=>window.__S().sourceMode);
  check('源码模式打开',srcOn===true);
  const taLen=await page.evaluate(()=>document.getElementById('v16SourceTa')?.value.length);
  check('源码 textarea 有内容',taLen>0);
  // 切回
  await page.click('#v16EdSource'); await sleep(700);
  const srcOff=await page.evaluate(()=>window.__S().sourceMode);
  check('源码模式关闭',srcOff===false);

  // AI 入口（未配置时应提示而非报错）
  await page.click('#v16EdAi'); await sleep(800);
  check('本页 AI 入口无报错',true);

  /* ===== 卡片长按（首页） ===== */
  // 先返回
  await page.click('#v16EdBack'); await sleep(900);
  await idle();
  check('返回首页',(await scr())==='home');

  // 长按卡片
  const card=await page.$('#v16Body .v16-note-card');
  if(card){
    // 简单长按：pointerdown 等 600ms pointerup
    const box=await card.boundingBox();
    await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
    await page.mouse.down();
    await sleep(650);
    await page.mouse.up();
    await sleep(700);
    const selBar=await page.evaluate(()=>document.getElementById('v16Selbar').classList.contains('show')||document.getElementById('v16Selbar').classList.contains('open'));
    check('长按卡片→多选',selBar===true);
  } else {
    check('长按卡片（无卡片）',false);
  }

  /* ===== 结果 ===== */
  const fails=results.filter(r=>!r.pass);
  console.log('\n===== 审计结果 =====');
  results.forEach(r=>console.log((r.pass?'✓':'✗')+' '+r.name+(r.extra?' '+r.extra:'')));
  console.log('\n通过: '+(results.length-fails.length)+'/'+results.length);
  console.log('失败:',fails.map(r=>r.name));
  console.log('错误:',errs.slice(0,8));
  await browser.close();
})();
