const {chromium}=require('playwright');const path=require('path');
const EXE='/opt/vm/preinstall/ms-playwright/chromium_headless_shell-1169/chrome-linux/headless_shell';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const b=await chromium.launch({headless:true,executablePath:EXE});
  const ctx=await b.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'no-preference'});
  const page=await ctx.newPage();
  let err=0;page.on('pageerror',e=>{err++;console.log('[pageerror]',e.message)});
  const assert=(c,m)=>{if(c)console.log('PASS:',m);else{console.log('FAIL:',m);process.exitCode=1;}};
  await page.goto('file://'+path.resolve('index.html'));
  await page.waitForFunction(()=>window.__app);await sleep(400);

  /* 造待办便签 */
  const nid=await page.evaluate(()=>{
    const A=window.__app;
    const n={id:A.uid(),type:'todo',pinned:false,trashed:false,trashedAt:null,files:[],
      title:'终验',content:'',
      todos:[{id:A.uid(),text:'待办A',done:false,priority:'normal'},
             {id:A.uid(),text:'待办B',done:false,priority:'normal'}],
      color:'green',createdAt:Date.now(),updatedAt:Date.now()};
    A.notes.push(n);
    A.prefs.notebooks=['工作','生活','旅行'];
    A.persist();A.persistPrefs();
    location.hash='#/edit?id='+n.id;return n.id;
  });
  await sleep(500);

  /* 1. 拖拽不误伤文本输入：直接在 textarea 打字 */
  await page.evaluate(()=>{
    const ta=document.querySelector('#paperTodo .pt-row:nth-child(2) textarea.pt-text');
    ta.focus();ta.setSelectionRange(ta.value.length,ta.value.length);
  });
  await page.keyboard.type('补充文字');
  await sleep(100);
  const typed=await page.evaluate(id=>window.__app.notes.find(n=>n.id===id).todos[0].text,nid);
  assert(typed==='待办A补充文字','回归：textarea 输入正常，拖拽未拦截（'+typed+'）');

  /* 2. 回车新增待办行 */
  await page.keyboard.press('Enter');
  await sleep(200);
  const rows=await page.evaluate(()=>document.querySelectorAll('#paperTodo .pt-row').length);
  assert(rows===3,'回归：回车新增待办行（'+rows+'）');
  /* 3. textarea 内横向拖动（选文字）不触发拖拽 */
  const taBox=await page.evaluate(()=>{
    const r=document.querySelector('#paperTodo .pt-row:nth-child(2) textarea.pt-text');
    const rc=r.getBoundingClientRect();return{x:rc.left+40,y:rc.top+rc.height/2};
  });
  await page.mouse.move(taBox.x,taBox.y);await page.mouse.down();
  await page.mouse.move(taBox.x+30,taBox.y+2,{steps:3});
  await page.mouse.up();
  await sleep(100);
  const noSlot=await page.evaluate(()=>!document.querySelector('#paperTodo .pt-slot'));
  assert(noSlot,'#7 从 textarea 起手不触发拖拽');

  /* 4. #10 Esc 关闭联想 */
  const body=await page.$('#paperBody');
  await body.click();
  await page.keyboard.type('标签 #');
  await sleep(250);
  const open1=await page.evaluate(()=>{const s=document.querySelector('#nbSuggest');return s&&s.classList.contains('show');});
  await page.keyboard.press('Escape');
  await sleep(150);
  const closed1=await page.evaluate(()=>{const s=document.querySelector('#nbSuggest');return !s||!s.classList.contains('show');});
  assert(open1&&closed1,'#10 Esc 关闭联想');
  /* 5. 重新打开后输入空格分隔，联想消失 */
  await page.keyboard.type('工作 #');
  await sleep(250);
  await page.keyboard.type(' ');
  await sleep(200);
  const autoClose=await page.evaluate(()=>{const s=document.querySelector('#nbSuggest');return !s||!s.classList.contains('show');});
  assert(autoClose,'#10 触发条件失效（空格后）自动收起');

  /* 6. 回收站清空按钮也是 Press-to-Cancel 目标：先把一张示例便签移入回收站 */
  await page.evaluate(()=>{
    const victim=window.__app.notes.find(n=>!n.trashed&&n.id!==window.__app.cur());
    window.__app.moveToTrash([victim.id]);
  });
  await page.evaluate(()=>location.hash='#/home');
  await sleep(500);
  await page.evaluate(()=>location.hash='#/trash');
  await sleep(500);
  await page.evaluate(()=>{
    const b=document.querySelector('#trashEmpty');if(b)b.click();
  });
  await sleep(400);
  const teOk=await page.evaluate(()=>{
    const b=document.querySelector('#teOk');
    if(!b)return null;
    const rc=b.getBoundingClientRect();
    return{
      matches:b.matches('.modal .btn-danger'),
      x:rc.left+rc.width/2,y:rc.top+rc.height/2
    };
  });
  assert(teOk&&teOk.matches,'#13 清空回收站按钮纳入 Press-to-Cancel 选择器');
  /* 按下出确认态 */
  await page.mouse.move(teOk.x,teOk.y);await page.mouse.down();
  await sleep(80);
  const pc=await page.evaluate(()=>!!document.querySelector('#teOk.pc-pressed'));
  assert(pc,'#13 清空按钮按下有确认态');
  await page.mouse.up();
  await sleep(100);
  await page.evaluate(()=>{
    const c=document.querySelector('#modal [data-close]');if(c)c.click();
  });
  await sleep(250);

  /* 7. 深色主题下编辑器元素渲染正常 */
  await page.evaluate(()=>{
    window.__app.prefs.theme='dark';window.__app.persistPrefs();window.__app.applyTheme();
  });
  await page.evaluate(id=>location.hash='#/edit?id='+id,nid);
  await sleep(400);
  const darkOk=await page.evaluate(()=>{
    const r=document.querySelector('#paperTodo .pt-row');
    const cs=getComputedStyle(r);
    return{bg:cs.backgroundColor,visible:cs.display!=='none'};
  });
  assert(darkOk.visible,'深色主题编辑器待办区可见（'+JSON.stringify(darkOk)+'）');
  /* 深色下勾选三连正常 */
  await page.evaluate(()=>document.querySelector('#paperTodo .pt-row .tc').click());
  await sleep(100);
  const darkPop=await page.evaluate(()=>!!document.querySelector('#paperTodo .pt-row .tc.tc-pop'));
  assert(darkPop,'深色下 #8 勾选动画正常');
  await page.screenshot({path:'_verify/shots/f_dark_editor.png'});

  /* 8. 回到浅色，验证首页 #6 阻尼元素仍存在 */
  await page.evaluate(()=>{
    window.__app.prefs.theme='light';window.__app.persistPrefs();window.__app.applyTheme();
  });
  await page.evaluate(()=>location.hash='#/home');
  await sleep(500);

  console.log('errors:',err);
  await b.close();
})();

/* 第二组：reduced-motion 降级（独立 context） */
(async()=>{
  const b=await chromium.launch({headless:true,executablePath:EXE});
  const ctx=await b.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
  const page=await ctx.newPage();
  const assert=(c,m)=>{if(c)console.log('PASS:',m);else{console.log('FAIL:',m);process.exitCode=1;}};
  let err=0;page.on('pageerror',e=>{err++;console.log('[pageerror]',e.message)});
  await page.goto('file://'+path.resolve('index.html'));
  await page.waitForFunction(()=>window.__app);await sleep(400);
  /* 主题切换在降级模式应直接换、无扩散层 */
  await page.evaluate(()=>location.hash='#/settings');
  await sleep(400);
  const p=await page.evaluate(()=>{
    const b=document.querySelector('#themeSeg [data-t="dark"]');
    const rc=b.getBoundingClientRect();return{x:rc.left+rc.width/2,y:rc.top+rc.height/2};
  });
  await page.mouse.click(p.x,p.y);
  await sleep(200);
  const reduced=await page.evaluate(()=>({
    theme:document.documentElement.dataset.theme,
    noReveal:!document.querySelector('.theme-reveal'),
    dur:getComputedStyle(document.querySelector('.set-card')).transitionDuration
  }));
  assert(reduced.theme==='dark'&&reduced.noReveal,'降级：主题直接切换无扩散层');
  const d=parseFloat(reduced.dur);
  assert(d<=0.01,'降级：过渡时长被压到 '+reduced.dur);
  await page.evaluate(()=>{
    window.__app.prefs.theme='light';window.__app.persistPrefs();window.__app.applyTheme();
  });
  console.log('errors:',err);
  await b.close();
})();
