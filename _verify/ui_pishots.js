/* UI polish screenshot walkthrough — v16
   Viewport 360x792, deviceScaleFactor=4.
   Usage: node _verify/ui_pishots.js [outdir]
*/
const {chromium}=require('playwright');
const path=require('path');
const fs=require('fs');
const EXE='/opt/vm/preinstall/ms-playwright/chromium_headless_shell-1169/chrome-linux/headless_shell';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const OUT=process.argv[2]||'_verify/shots/ui-polish';
fs.mkdirSync(OUT,{recursive:true});

(async()=>{
  const b=await chromium.launch({headless:true,executablePath:EXE});
  const ctx=await b.newContext({
    viewport:{width:360,height:792},isMobile:true,hasTouch:true,
    deviceScaleFactor:4,reducedMotion:'no-preference',
    // simulate android safe-area
    hasTouch:true,
  });
  const page=await ctx.newPage();
  page.on('pageerror',e=>console.log('[pageerror]',e.message));
  page.on('console',m=>{ if(m.type()==='error') console.log('[console.error]',m.text()); });

  // Make safe-area-inset non-zero to exercise env() padding
  await page.addInitScript(()=>{
    Object.defineProperty(window,'getComputedStyle',{value:()=>null});
  });
  // CSS env() can't be easily faked in headless; we'll rely on the padding fallback.

  await page.goto('http://127.0.0.1:8765/index.html');
  await page.waitForFunction(()=>window.VUI && window.VUI.boot,{timeout:15000});
  await sleep(800);

  const shot=async(name)=>{
    await sleep(350);
    await page.screenshot({path:path.join(OUT,name+'.png')});
    console.log('shot:',name);
  };

  /* ---------- seed extra data (app already seeds 工作/生活 folders) ---------- */
  await page.evaluate(async()=>{
    const V=window.Vault;
    // add a few root notes with long titles / long summaries to test truncation
    const titles=[
      '阅读清单：长篇标题用来测试截断边界到底会不会被切掉一半',
      '待办：本周三件大事（高优先级）',
      '旅行攻略：云南七日游超长文件名测试看看到底能多长',
    ];
    for(let i=0;i<titles.length;i++){
      const t=titles[i];
      const md = [
        '# '+t,
        '',
        '这是一段正文，用来测试卡片摘要在 3 行内截断的表现。' + '句子越长越能看出边缘是否贴边。'.repeat(3),
        '',
        '- [x] 已完成事项示例长一点看看会不会换行',
        '- [ ] 待办事项一',
        '- [ ] 待办事项二（高优先级）',
        '',
        '> 这是一段引用文字，测试引用块左边距是否合理。',
        '',
        '## 小标题',
        '正文段落。' + '#tag1 #tag2 '.repeat(4),
      ].join('\n');
      await V.create({title:t, folder:'', type:i===1?'todo':'note', content:md});
    }
    // one trashed note
    const p=await V.create({title:'回收站里的旧笔记', folder:'', type:'note', content:'# 旧笔记'});
    await V.remove(p);
    await window.VUI.renderHome();
  });
  await sleep(600);

  /* ---------- 首页：网格视图（有内容） ---------- */
  await page.evaluate(()=>{ window.VUI.show('home'); window.VUI.state.viewMode='grid'; window.VUI.renderHome(); });
  await shot('01-home-grid-light');

  /* ---------- 首页：列表视图 ---------- */
  await page.evaluate(()=>{ window.VUI.state.viewMode='list'; window.VUI.renderHome(); });
  await shot('02-home-list-light');

  /* ---------- 首页：空态（临时清空） ---------- */
  await page.evaluate(async()=>{
    const V=window.Vault;
    await V.createFolder('','_tmp');
    const { notes } = await V.entries('');
    for(const e of notes){ try{ await V.move(e.path,'_tmp'); }catch(_){} }
    window.VUI.state.curFolder='';
    await window.VUI.renderHome();
  });
  await sleep(400);
  await shot('03-home-empty-light');
  // restore
  await page.evaluate(async()=>{
    const V=window.Vault;
    const { notes } = await V.entries('_tmp');
    for(const e of notes){ try{ await V.move(e.path,''); }catch(_){} }
    window.VUI.state.curFolder='';
    await window.VUI.renderHome();
  });
  await sleep(400);

  /* ---------- FAB 菜单打开 ---------- */
  await page.evaluate(()=>{ document.getElementById('v16Fab').click(); });
  await shot('04-home-fabmenu-light');
  await page.evaluate(()=>{ document.getElementById('v16Fab').click(); });
  await sleep(200);

  /* ---------- 文件树抽屉 ---------- */
  await page.evaluate(()=>{ document.getElementById('v16Menu').click(); });
  await shot('05-drawer-open-light');
  await page.evaluate(()=>{ document.getElementById('v16DrawerClose').click(); });
  await sleep(300);

  /* ---------- 编辑器：WYSIWYG ---------- */
  await page.evaluate(async()=>{
    // open first non-trashed note
    const V=window.Vault;
    const { notes: ents } = await V.entries('');
    if(ents.length) await window.VUI.openNote(ents[0].path);
  });
  await sleep(500);
  await shot('06-editor-wysiwyg-light');

  /* ---------- 编辑器：待办列表（打开待办那篇） ---------- */
  await page.evaluate(async()=>{
    const V=window.Vault;
    const { notes: ents } = await V.entries('');
    const todo=ents.find(e=>e.title && e.title.indexOf('待办')===0) || ents[0];
    await window.VUI.openNote(todo.path);
  });
  await sleep(500);
  await shot('07-editor-todo-light');

  /* ---------- 编辑器：源码模式 ---------- */
  await page.evaluate(()=>{ document.getElementById('v16EdSource').click(); });
  await sleep(400);
  await shot('08-editor-source-light');
  await page.evaluate(()=>{ document.getElementById('v16EdSource').click(); });
  await sleep(300);

  /* ---------- 编辑器：底部工具栏（聚焦正文后） ---------- */
  await page.evaluate(()=>{
    const ed=document.getElementById('v16EdBody');
    if(ed){ ed.focus(); }
    // scroll editor to bottom to show attachments area
    const sc=document.getElementById('v16EdScroll');
    if(sc) sc.scrollTop = sc.scrollHeight;
  });
  await sleep(300);
  await shot('09-editor-dock-light');

  /* ---------- 返回首页 ---------- */
  await page.evaluate(()=>{ document.getElementById('v16EdBack').click(); });
  await sleep(400);

  /* ---------- 设置页 ---------- */
  await page.evaluate(()=>{ window.VUI.show('settings'); window.VUI.renderSettings(); });
  await sleep(500);
  await shot('10-settings-light');

  /* ---------- 回收站 ---------- */
  await page.evaluate(()=>{ window.VUI.show('trash'); window.VUI.renderTrash(); });
  await sleep(400);
  await shot('11-trash-light');

  /* ---------- 搜索结果页 ---------- */
  await page.evaluate(()=>{
    window.VUI.show('search');
    const inp=document.getElementById('v16SrInput');
    if(inp){ inp.value='清单'; inp.dispatchEvent(new Event('input',{bubbles:true})); }
  });
  await sleep(500);
  await shot('12-search-light');

  /* ---------- 底部 sheet（更多菜单） ---------- */
  await page.evaluate(()=>{
    window.VUI.show('home');
    // open more sheet
    const more=document.getElementById('v16More');
    if(more) more.click();
  });
  await sleep(400);
  await shot('13-sheet-more-light');
  // close sheet
  await page.evaluate(()=>{
    const c=document.getElementById('v16SheetCancel'); if(c) c.click();
  });
  await sleep(300);

  /* ---------- 暗色主题：各屏 ---------- */
  const switchDark=async()=>{
    await page.evaluate(()=>{
      document.documentElement.setAttribute('data-theme','dark');
      if(window.VUI.applyTheme) window.VUI.applyTheme('dark');
    });
    await sleep(400);
  };
  const switchLight=async()=>{
    await page.evaluate(()=>{
      document.documentElement.setAttribute('data-theme','light');
      if(window.VUI.applyTheme) window.VUI.applyTheme('light');
    });
    await sleep(400);
  };

  await switchDark();
  await page.evaluate(()=>{ window.VUI.show('home'); window.VUI.state.viewMode='grid'; window.VUI.renderHome(); });
  await shot('14-home-grid-dark');

  await page.evaluate(()=>{ document.getElementById('v16Menu').click(); });
  await sleep(300);
  await shot('15-drawer-dark');
  await page.evaluate(()=>{ document.getElementById('v16DrawerClose').click(); });
  await sleep(200);

  await page.evaluate(async()=>{
    const V=window.Vault; const { notes: ents } = await V.entries('');
    if(ents.length) await window.VUI.openNote(ents[0].path);
  });
  await sleep(400);
  await shot('16-editor-dark');

  await page.evaluate(()=>{ window.VUI.show('settings'); window.VUI.renderSettings(); });
  await sleep(300);
  await shot('17-settings-dark');

  await page.evaluate(()=>{ window.VUI.show('trash'); window.VUI.renderTrash(); });
  await sleep(300);
  await shot('18-trash-dark');

  await switchLight();

  console.log('ALL SHOTS DONE ->',OUT);
  await b.close();
})().catch(e=>{ console.error(e); process.exit(1); });
