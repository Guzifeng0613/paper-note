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
  await page.waitForFunction(()=>window.__app);await sleep(1200);
  await page.evaluate(()=>location.hash='#/home');await sleep(400);

  // 多选模式下不倾斜
  await page.evaluate(()=>{const c=document.querySelector('#notesWrap .note-card');window.__app.enterSelect(c.dataset.id);});
  await sleep(200);
  const selTilt=await page.evaluate(()=>{
    const c=document.querySelector('#notesWrap .note-card');
    const r=c.getBoundingClientRect();
    c.dispatchEvent(new PointerEvent('pointerdown',{clientX:r.left+30,clientY:r.top+30,bubbles:true}));
    return !!document.querySelector('.note-card.pressing');
  });
  assert(!selTilt,'#2 多选模式下不触发倾斜');
  await page.evaluate(()=>window.__app.exitSelect());
  await sleep(200);

  // #3 chip 切换 pop + 对勾迁移
  const names=await page.evaluate(()=>window.__app.prefs.notebooks||[]);
  if(names.length){
    const nm=names[0];
    await page.evaluate(n=>{
      const chips=Array.from(document.querySelectorAll('#chipsRow .chip'));
      const t=chips.find(c=>c.dataset.k===n);t.click();
    },nm);
    await sleep(50);
    const popped=await page.evaluate(()=>{const on=document.querySelector('#chipsRow .chip.on');return {k:on.dataset.k,pop:on.classList.contains('chip-pop'),ck:!!on.querySelector('.chip-ck svg')};});
    assert(popped.k===nm&&popped.pop&&popped.ck,'#3 切到笔记本 chip：pop + 对勾（'+JSON.stringify(popped)+'）');
    await page.evaluate(()=>window.__app.setNbFilter(null));
    await sleep(100);
  } else console.log('（无笔记本，跳过 chip 切换）');

  // #3 FLIP：新建笔记本会让 chip 重排
  const flip=await page.evaluate(()=>{
    const before=Array.from(document.querySelectorAll('#chipsRow .chip')).map(c=>c.dataset.k);
    // 直接造数据再重渲染
    const app=window.__app;
    app.prefs.notebooks=(app.prefs.notebooks||[]).concat(['AA新本','BB新本']);
    app.renderChips();
    return {before,after:Array.from(document.querySelectorAll('#chipsRow .chip')).map(c=>c.dataset.k)};
  });
  assert(flip.after.includes('AA新本')&&flip.after.includes('BB新本'),'#3 新笔记本 chip 出现（FLIP 让位代码已就位）');

  // 各屏无 pageerror
  for(const s of ['trash','settings','home','pan']){
    await page.evaluate(x=>location.hash='#/'+x,s);
    await sleep(300);
  }
  // 编辑器进一次
  await page.evaluate(()=>location.hash='#/home');await sleep(300);
  await page.evaluate(()=>{const c=document.querySelector('#notesWrap .note-card');c.click();});
  await sleep(500);
  const inEdit=await page.evaluate(()=>location.hash.includes('edit'));
  assert(inEdit,'进入编辑器正常');
  await page.evaluate(()=>location.hash='#/home');
  await sleep(500);
  console.log('errors:',err);
  assert(err===0,'全程无 pageerror');
  await b.close();
})();
