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
  await page.evaluate(()=>location.hash='#/home');await sleep(300);

  const hasCk=await page.evaluate(()=>{const on=document.querySelector('#chipsRow .chip.on');return !!on.querySelector('.chip-ck');});
  assert(hasCk,'#3 选中 chip 含对勾元素');

  // #2 静态按压倾斜
  const box=await page.evaluate(()=>{const c=document.querySelector('#notesWrap .note-card');const r=c.getBoundingClientRect();return {x:r.left+30,y:r.top+30};});
  await page.mouse.move(box.x,box.y);await page.mouse.down();
  await sleep(60);
  const tilt=await page.evaluate(()=>{const c=document.querySelector('.note-card.pressing');return c?{ry:c.style.getPropertyValue('--ry'),px:c.style.getPropertyValue('--px')}:null;});
  assert(tilt&&tilt.ry!=='0deg'&&tilt.px,'#2 静态按下时卡片按触点倾斜（'+JSON.stringify(tilt)+'）');
  await page.mouse.up();
  // 移动超 10px 取消
  await page.mouse.move(box.x,box.y);await page.mouse.down();
  await page.mouse.move(box.x+14,box.y+2,{steps:3});
  await sleep(50);
  assert(await page.evaluate(()=>!document.querySelector('.note-card.pressing')),'#2 滚动开始（移动>10px）取消倾斜');
  await page.mouse.up();
  // 点击正常进入编辑
  await page.mouse.click(box.x,box.y);
  await sleep(500);
  assert(await page.evaluate(()=>location.hash.includes('edit')),'#2 按压后仍正常点击进入编辑');
  await page.evaluate(()=>location.hash='#/home');await sleep(500);

  // #5 全选错峰
  await page.evaluate(()=>{const c=document.querySelector('#notesWrap .note-card');window.__app.enterSelect(c.dataset.id);});
  await sleep(200);
  await page.evaluate(()=>document.querySelector('#selectAll').click());
  await sleep(450);
  const total=await page.evaluate(()=>window.__app.visibleNotes().length);
  const onCount=await page.evaluate(()=>document.querySelectorAll('#notesWrap .sel-circle.on').length);
  assert(onCount===total,'#5 全选后 '+onCount+'/'+total+' 个错峰勾选');
  await page.screenshot({path:'_verify/shots/b_selectall.png'});
  await page.evaluate(()=>document.querySelector('#selectAll').click());
  await sleep(350);
  assert(await page.evaluate(()=>document.querySelectorAll('#notesWrap .sel-circle.on').length)===0,'#5 取消全选后清零');

  // #4 飞行删除（card0 已随取消全选清空，重新点选两张）
  await page.evaluate(()=>{
    const cards=document.querySelectorAll('#notesWrap .note-card');
    cards[0].click();cards[1].click();
  });
  await sleep(150);
  const selN=await page.evaluate(()=>document.querySelectorAll('#notesWrap .sel-circle.on').length);
  assert(selN===2,'#4 准备：选中 2 张（实际 '+selN+'）');
  const before=await page.evaluate(()=>window.__app.notes.filter(n=>n.trashed).length);
  await page.evaluate(()=>document.querySelector('#bbDelete').click());
  await sleep(150);
  const flying=await page.evaluate(()=>Array.from(document.querySelectorAll('body > *')).filter(e=>e.style.zIndex==='300').length);
  await page.screenshot({path:'_verify/shots/b_fly_mid.png'});
  await sleep(700);
  const after=await page.evaluate(()=>({trashed:window.__app.notes.filter(n=>n.trashed).length,toast:!!document.querySelector('#toast.show')}));
  assert(flying>=1,'#4 飞行克隆体存在（'+flying+'）');
  assert(after.trashed===before+2&&after.toast,'#4 删除落库 + 撤销 toast');
  await page.screenshot({path:'_verify/shots/b_after_delete.png'});
  // undo 恢复
  await page.evaluate(()=>{const b=document.querySelector('#tUndo');if(b)b.click();});
  await sleep(400);
  const restored=await page.evaluate(()=>window.__app.notes.filter(n=>n.trashed).length);
  assert(restored===before,'#4 撤销恢复正常（恢复后回收站 '+restored+'）');
  console.log('errors:',err);
  await b.close();
})();
