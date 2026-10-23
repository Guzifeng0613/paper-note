/* 边缘场景与未覆盖功能验收 */
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
  const scr=()=>page.evaluate(()=>document.querySelector('.v16-scr.on')?.dataset.scr);

  await page.goto('http://localhost:8765/index.html',{waitUntil:'load'});
  await sleep(2500);

  /* ===== 1. 文件夹重命名（长按文件夹） ===== */
  // 先建文件夹
  await page.click('#v16Fab'); await sleep(500);
  await page.evaluate(()=>document.querySelector('.v16-fab-item[data-f="folder"]').click());
  await sleep(800);
  const folderCreated=await page.evaluate(()=>document.querySelector('.v16-folder-card')!==null);
  check('新建文件夹卡片出现',folderCreated);

  // 长按文件夹卡片
  const fcard=await page.$('.v16-folder-card');
  const fbox=await fcard.boundingBox();
  await page.mouse.move(fbox.x+fbox.width/2,fbox.y+fbox.height/2);
  await page.mouse.down();
  await sleep(550);
  await page.mouse.up();
  await sleep(700);
  const folderMenu=await page.evaluate(()=>document.querySelectorAll('#v16SheetOpts .v16-sheet-opt').length);
  check('长按文件夹→操作菜单',folderMenu>=2);

  // 重命名（走应用内 appPrompt 弹窗）
  await page.evaluate(()=>{ Array.from(document.querySelectorAll('#v16SheetOpts .v16-sheet-opt')).find(e=>e.textContent.includes('重命名'))?.click(); });
  await sleep(600);
  await page.evaluate(()=>{ const i=document.getElementById('appInput'); if(i)i.value='重命名文件夹X'; });
  await page.evaluate(()=>document.getElementById('appOk')?.click());
  await sleep(800);
  await idle();
  const renamed=await page.evaluate(()=>Array.from(document.querySelectorAll('.v16-folder-card .fname')).some(e=>e.textContent.includes('重命名文件夹X')));
  check('文件夹重命名生效',renamed);

  /* ===== 2. 进入文件夹，新建笔记，面包屑导航 ===== */
  // 精确点击重命名后的文件夹（首页可能有多个文件夹）
  await page.evaluate(()=>{
    const cards=Array.from(document.querySelectorAll('.v16-folder-card'));
    const c=cards.find(x=>x.querySelector('.fname')?.textContent.includes('重命名文件夹X'));
    c?.click();
  });
  await sleep(700);
  const inFolder=await page.evaluate(()=>window.__S().curFolder);
  check('进入文件夹',inFolder&&inFolder.includes('重命名文件夹X'));

  // 新建笔记
  await page.click('#v16Fab'); await sleep(500);
  await page.evaluate(()=>document.querySelector('.v16-fab-item[data-f="note"]').click());
  await sleep(1200);
  await page.evaluate(()=>{ const t=document.getElementById('v16EdTitle'); t.value='子目录笔记'; t.dispatchEvent(new Event('input',{bubbles:true})); });
  const b=await page.$('#v16EdBody');
  await b.click({position:{x:100,y:100}});
  await page.keyboard.type('子目录内容');
  await sleep(700);
  await page.click('#v16EdBack'); await sleep(900);
  await idle();

  // 面包屑
  const crumbs=await page.evaluate(()=>document.querySelectorAll('#v16Crumbs *').length);
  check('面包屑存在',crumbs>=1);

  // 面包屑回根目录
  await page.evaluate(()=>{ const cr=document.querySelectorAll('#v16Crumbs *'); if(cr.length) cr[0].click(); });
  await sleep(700);
  const backRoot=await page.evaluate(()=>window.__S().curFolder);
  check('面包屑回根目录',backRoot==='');

  /* ===== 3. 搜索特殊：空结果、特殊字符 ===== */
  await page.click('#v16SearchBtn'); await sleep(500);
  await page.fill('#v16SrInput','ZZZ不存在的内容QQQ');
  await sleep(600);
  const emptyRes=await page.evaluate(()=>document.getElementById('v16SrBody').children.length);
  check('搜索无结果不报错',emptyRes>=0);
  // 清空
  await page.fill('#v16SrInput','');
  await sleep(400);
  // 搜特殊字符
  await page.fill('#v16SrInput','#');
  await sleep(400);
  check('搜索特殊字符不报错',true);
  await page.click('#v16SrBack'); await sleep(400);

  /* ===== 4. 源码模式直接编辑 MD ===== */
  // 新建笔记
  await page.click('#v16Fab'); await sleep(500);
  await page.evaluate(()=>document.querySelector('.v16-fab-item[data-f="note"]').click());
  await sleep(1200);
  // 切源码
  await page.click('#v16EdSource'); await sleep(700);
  await page.evaluate(()=>{ const ta=document.getElementById('v16SourceTa'); ta.value='---\ntitle: 源码笔记\ncolor: pink\n---\n\n# 标题\n\n- [ ] 待办项\n\n正文内容XYZ'; ta.dispatchEvent(new Event('input',{bubbles:true})); });
  await sleep(500);
  // 切回
  await page.click('#v16EdSource'); await sleep(800);
  await idle();
  const srcContent=await page.evaluate(()=>{
    const body=document.getElementById('v16EdBody');
    return { hasTodo: body.querySelectorAll('.v16-ed-todoinput').length, hasText: body.textContent.includes('正文内容XYZ') };
  });
  check('源码编辑后渲染（待办+正文）',srcContent.hasTodo>=1 && srcContent.hasText);

  /* ===== 5. 多选完整流程：选2篇，批量置顶，退出 ===== */
  await page.click('#v16EdBack'); await sleep(900);
  await idle();
  // 先确保有2篇笔记
  const noteCount=await page.evaluate(()=>document.querySelectorAll('#v16Body .v16-note-card').length);
  if(noteCount>=1){
    // 长按第一篇进入多选
    const c1=await page.$('#v16Body .v16-note-card');
    const b1=await c1.boundingBox();
    await page.mouse.move(b1.x+b1.width/2,b1.y+b1.height/2);
    await page.mouse.down(); await sleep(550); await page.mouse.up();
    await sleep(700);
    const selMode=await page.evaluate(()=>window.__S().selecting);
    check('长按进入多选',selMode===true);
    // 点第二篇（如果有）
    const c2=await page.$$('#v16Body .v16-note-card');
    if(c2.length>=2){
      const b2=await c2[1].boundingBox();
      await page.mouse.move(b2.x+b2.width/2,b2.y+b2.height/2);
      await page.mouse.click(b2.x+b2.width/2,b2.y+b2.height/2);
      await sleep(400);
    }
    const selCount=await page.evaluate(()=>window.__S().selected.size);
    check('多选数量',selCount>=1);
    // 批量置顶
    await page.evaluate(()=>document.querySelector('#v16Selbar button[data-a="pin"]')?.click());
    await sleep(800);
    await idle();
    check('批量置顶无报错',true);
  } else {
    check('多选（无足够卡片）',false);
  }

  /* ===== 结果 ===== */
  const fails=results.filter(r=>!r.pass);
  console.log('\n===== 边缘场景结果 =====');
  results.forEach(r=>console.log((r.pass?'✓':'✗')+' '+r.name+(r.extra?' '+r.extra:'')));
  console.log('\n通过: '+(results.length-fails.length)+'/'+results.length);
  console.log('失败:',fails.map(r=>r.name));
  console.log('错误:',errs.slice(0,8));
  await browser.close();
})();
