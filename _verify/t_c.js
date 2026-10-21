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

  /* 造一个含 5 条待办的便签 */
  const nid=await page.evaluate(()=>{
    const A=window.__app;
    const n={id:A.uid(),type:'todo',pinned:false,trashed:false,trashedAt:null,files:[],
      title:'批次C验收',content:'',
      todos:[
        {id:A.uid(),text:'第一条待办',done:false,priority:'normal'},
        {id:A.uid(),text:'第二条待办',done:false,priority:'normal'},
        {id:A.uid(),text:'第三条待办',done:true,priority:'normal'},
        {id:A.uid(),text:'第四条待办',done:false,priority:'normal'},
        {id:A.uid(),text:'第五条待办',done:false,priority:'normal'}
      ],
      color:'green',createdAt:Date.now(),updatedAt:Date.now()};
    A.notes.push(n);
    A.prefs.notebooks=['工作','生活','旅行'];
    A.persist();A.persistPrefs();
    location.hash='#/edit?id='+n.id;
    return n.id;
  });
  await sleep(500);

  /* ---------- #8 勾选三连 ---------- */
  const rows=await page.$$('#paperTodo .pt-row');
  assert(rows.length===5,'#8 准备：5 条待办行（实际 '+rows.length+'）');
  const tc0=await page.$('#paperTodo .pt-row:nth-child(2) .tc');
  await tc0.click();
  await sleep(420);
  const pop=await page.evaluate(()=>{
    const tc=document.querySelector('#paperTodo .pt-row .tc.tc-pop');
    const pct=document.querySelector('#paperTodo .pt-od-pct').textContent;
    const done=document.querySelector('#paperTodo .pt-od-done').textContent;
    const fill=document.querySelector('#paperTodo .pt-progress .bar i');
    const anims=fill.getAnimations?fill.getAnimations().length:0;
    return{pop:!!tc,pct,done,anims};
  });
  assert(pop.pop,'#8 勾选圆圈加 tc-pop 弹动类');
  assert(pop.done==='2'&&pop.pct==='40','#8 进度数字 2/5 · 40%（实际 '+pop.done+'/'+pop.pct+'）');
  assert(pop.anims>=1,'#8 进度条播放超调 WAAPI（动画数 '+pop.anims+'）');
  /* 取消勾选回弹 */
  await tc0.click();await sleep(400);
  const pop2=await page.evaluate(()=>({
    pct:document.querySelector('#paperTodo .pt-od-pct').textContent,
    unpop:!!document.querySelector('#paperTodo .pt-row .tc.tc-unpop')}));
  assert(pop2.pct==='20'&&pop2.unpop,'#8 取消勾选：回弹动画 + 数字回到 20%');

  /* ---------- #7 弹簧拖拽：把第 1 行拖到第 4 行之后 ---------- */
  const r0=await page.evaluate(()=>{
    const r=document.querySelector('#paperTodo .pt-row');
    const rc=r.getBoundingClientRect();
    return{x:rc.left+120,y:rc.top+4,h:rc.height};
  });
  await page.mouse.move(r0.x,r0.y);
  await page.mouse.down();
  /* 第一步越过 8px 阈值，落点槽张开 */
  await page.mouse.move(r0.x,r0.y+16,{steps:2});
  await sleep(120);
  const slotOpen=await page.evaluate(()=>{
    const s=document.querySelector('#paperTodo .pt-slot');
    if(!s)return null;
    const h=+getComputedStyle(s).height.replace('px','');
    return{h,open:s.classList.contains('open')};
  });
  assert(slotOpen&&slotOpen.open&&slotOpen.h>10,'#7 开始拖动：落点槽张开（'+JSON.stringify(slotOpen)+'）');
  const lift=await page.evaluate(()=>{
    const r=document.querySelector('#paperTodo .pt-row.lift.dragging');
    return r?r.getBoundingClientRect().top:null;
  });
  assert(lift!==null,'#7 提升行 fixed 跟手');
  /* 一路下移到第 5 行之后（每步 0.55 行，共 9 步 ≈ 5 行） */
  for(let k=1;k<=9;k++){
    await page.mouse.move(r0.x,r0.y+r0.h*k*0.55,{steps:2});
    await sleep(50);
  }
  await page.mouse.up();
  await sleep(600);
  const order=await page.evaluate(()=>window.__app.notes.find(n=>n.id===window.__app.cur().id).todos.map(t=>t.text));
  assert(order[0]!=='第一条待办'&&order[order.length-1]==='第一条待办',
    '#7 拖到底部后顺序落库（'+JSON.stringify(order)+'）');
  assert(await page.evaluate(()=>!document.querySelector('#paperTodo .pt-slot')&&!document.querySelector('#paperTodo .pt-row.lift')),
    '#7 松手后槽位与提升态清理干净');

  /* ---------- #12 删除收拢 ---------- */
  const beforeRows=await page.evaluate(()=>document.querySelectorAll('#paperTodo .pt-row').length);
  const rdBox=await page.evaluate(()=>{
    const r=document.querySelector('#paperTodo .pt-row .rd');
    const rc=r.getBoundingClientRect();return{x:rc.left+rc.width/2,y:rc.top+rc.height/2};
  });
  await page.mouse.click(rdBox.x,rdBox.y);
  const midCollapse=await page.evaluate(()=>!!document.querySelector('#paperTodo .pt-row.row-collapse'));
  assert(midCollapse,'#12 删除时行加 row-collapse 收拢');
  await sleep(380);
  const afterRows=await page.evaluate(()=>document.querySelectorAll('#paperTodo .pt-row').length);
  assert(afterRows===beforeRows-1,'#12 收拢后行被移除（'+beforeRows+'→'+afterRows+'）');

  /* ---------- #10 正文 #笔记本 内联联想 ---------- */
  const body=await page.$('#paperBody');
  await body.click();
  await page.keyboard.type('记得带上资料 #');
  await sleep(300);
  const sug=await page.evaluate(()=>{
    const s=document.querySelector('#nbSuggest');
    return{show:s&&s.classList.contains('show'),
      items:s?s.querySelectorAll('.ns-item').length:0};
  });
  assert(sug.show&&sug.items>=3,'#10 输入 # 弹出联想（'+sug.items+' 项）');
  await page.keyboard.type('工');
  await sleep(200);
  const filt=await page.evaluate(()=>Array.from(document.querySelectorAll('#nbSuggest .ns-item')).map(e=>e.textContent.trim()));
  assert(filt.some(t=>t.includes('工作'))&&filt.some(t=>t.includes('新建笔记本')),'#10 关键词过滤 + 新建项（'+JSON.stringify(filt)+'）');
  await page.keyboard.press('Enter');
  await sleep(200);
  const tag=await page.evaluate(()=>{
    const t=document.querySelector('#paperBody .nb-tag');
    return t?t.textContent:null;
  });
  assert(tag==='#工作','#10 选中后插入标签（'+tag+'）');
  const nbExists=await page.evaluate(()=>window.__app.prefs.notebooks.includes('工作'));
  assert(nbExists,'#10 笔记本数据存在');

  /* ---------- #9 字号刻度尺 ---------- */
  await page.evaluate(()=>window.__app.openFontSizeSheet());
  await sleep(300);
  const ruler=await page.evaluate(()=>{
    const r=document.querySelector('.fs-ruler');
    if(!r)return null;
    const ticks=r.querySelectorAll('.fs-tick').length;
    return{ticks,on:!!r.querySelector('.fs-tick.on'),cursor:!!r.querySelector('.fs-cursor'),num:document.querySelector('#fsNum').textContent};
  });
  assert(ruler&&ruler.ticks===10&&ruler.on&&ruler.cursor,'#9 刻度尺 10 档 + 居中光标 + 高亮（'+JSON.stringify(ruler)+'）');
  /* 拖动刻度尺到最左（85%） */
  const rr=await page.evaluate(()=>{const r=document.querySelector('.fs-ruler');const rc=r.getBoundingClientRect();return{x:rc.left+rc.width/2,y:rc.top+rc.height/2};});
  await page.mouse.move(rr.x,rr.y);await page.mouse.down();
  await page.mouse.move(rr.x+150,rr.y,{steps:6});
  await sleep(100);
  await page.mouse.up();
  await sleep(400);
  const fs=await page.evaluate(()=>({zoom:document.documentElement.style.zoom,prefs:window.__app.prefs.fontScale,num:document.querySelector('#fsNum').textContent}));
  assert(Math.abs(fs.prefs-.85)<0.001&&fs.num==='85','#9 吸附到 85% 并持久化（'+JSON.stringify(fs)+'）');
  /* 重置 */
  await page.click('#fsReset');await sleep(100);
  await page.click('#fsDone');await sleep(300);
  const reset=await page.evaluate(()=>({zoom:document.documentElement.style.zoom,prefs:window.__app.prefs.fontScale}));
  assert((!reset.zoom||reset.zoom==='1')&&reset.prefs===1,'#9 重置回 100%');

  /* ---------- #13 危险按钮 Press-to-Cancel ---------- */
  /* 打开编辑器更多操作面板，删除项是 danger */
  await page.click('#editMore');
  await sleep(350);
  const dangerBtn=await page.evaluate(()=>{
    const b=document.querySelector('#dynOpts .sheet-opt.danger');
    if(!b)return null;
    const rc=b.getBoundingClientRect();
    return{x:rc.left+rc.width/2,y:rc.top+rc.height/2};
  });
  assert(dangerBtn,'#13 操作面板存在 danger 项');
  /* 按下后滑出，抬手取消：面板不应关闭、便签不应删除 */
  await page.mouse.move(dangerBtn.x,dangerBtn.y);
  await page.mouse.down();
  await sleep(80);
  const pressed=await page.evaluate(()=>!!document.querySelector('#dynOpts .sheet-opt.danger.pc-pressed'));
  assert(pressed,'#13 按下时 danger 显示确认态');
  await page.mouse.move(dangerBtn.x+40,dangerBtn.y+160,{steps:5});
  await sleep(80);
  const out=await page.evaluate(()=>!document.querySelector('#dynOpts .sheet-opt.danger.pc-pressed'));
  assert(out,'#13 滑出按钮后确认态消失');
  await page.mouse.up();
  await sleep(300);
  const cancelled=await page.evaluate(()=>({
    mask:document.querySelector('#mask').classList.contains('show'),
    stillEdit:location.hash.includes('edit'),
    exists:!!window.__app.notes.find(n=>n.id===window.__app.cur().id)
  }));
  assert(cancelled.mask&&cancelled.stillEdit&&cancelled.exists,'#13 滑出抬手：取消删除，面板保留（'+JSON.stringify(cancelled)+'）');
  /* 正常点按：删除生效 */
  await page.click('#dynOpts .sheet-opt.danger');
  await sleep(500);
  const gone=await page.evaluate((id)=>{
    const n=window.__app.notes.find(x=>x.id===id);
    return{home:location.hash.includes('home'),trashed:n&&n.trashed};
  },nid);
  assert(gone.home&&gone.trashed,'#13 原位抬手：正常执行删除（'+JSON.stringify(gone)+'）');

  await page.screenshot({path:'_verify/shots/c_final.png'});
  console.log('errors:',err);
  await b.close();
})();
