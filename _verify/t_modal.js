/* 应用内弹窗 + 裸 checkbox 待办验收（替代不弹的原生 prompt/confirm） */
const { chromium } = require('playwright');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const browser=await chromium.launch({ executablePath:'/opt/vm/preinstall/ms-playwright/chromium_headless_shell-1169/chrome-linux/headless_shell', args:['--no-sandbox'] });
  const page=await browser.newPage({viewport:{width:360,height:792},deviceScaleFactor:4,hasTouch:false});
  const errs=[];
  page.on('pageerror',e=>errs.push('PAGEERR:'+e.message));
  const results=[];
  const check=(name,cond)=>results.push({name,pass:!!cond});
  const idle=()=>page.evaluate(()=>window.__opIdle&&window.__opIdle());

  await page.goto('http://localhost:8765/index.html',{waitUntil:'load'});
  await sleep(2500);

  // 新建笔记
  await page.click('#v16Fab'); await sleep(500);
  await page.evaluate(()=>document.querySelector('.v16-fab-item[data-f="note"]').click());
  await sleep(1200);
  await page.evaluate(()=>{ const t=document.getElementById('v16EdTitle'); t.value='弹窗测试'; t.dispatchEvent(new Event('input',{bubbles:true})); });
  await sleep(600);

  // 1) 工具栏插入链接 → appPrompt 弹出输入框
  const dockBtns=await page.$$('#v16Dock button');
  await page.evaluate(()=>{
    const b=Array.from(document.querySelectorAll('#v16Dock button')).find(x=>x.dataset.t==='link');
    b && b.click();
  });
  await sleep(600);
  const promptShown=await page.evaluate(()=>document.querySelector('#appInput.modal-input')!==null);
  check('插入链接弹出应用内输入框',promptShown);
  // 填值并确认
  await page.evaluate(()=>{ const i=document.getElementById('appInput'); i.value='https://example.com'; });
  await page.click('#appOk');
  let linkInserted=false;
  for(let i=0;i<20;i++){
    linkInserted=await page.evaluate(()=>document.querySelector('#v16EdBody a[href="https://example.com"]')!==null);
    if(linkInserted) break;
    await sleep(200);
  }
  check('确认后链接插入正文',linkInserted);

  // 2) 工具栏插入待办（受控，带 data-key）→ 立即勾选 → 落盘为 - [x]
  await page.evaluate(()=>{
    const b=Array.from(document.querySelectorAll('#v16Dock button')).find(x=>x.dataset.t==='todo');
    b && b.click();
  });
  await sleep(800);
  await idle();
  const cbCount=await page.evaluate(()=>document.querySelectorAll('#v16EdBody .v16-ed-todoinput').length);
  check('工具栏插入受控待办',cbCount>=1);
  // 勾选新插入的待办
  await page.evaluate(()=>{
    const cb=Array.from(document.querySelectorAll('#v16EdBody .v16-ed-todoinput')).pop();
    if(cb){ cb.checked=true; cb.dispatchEvent(new Event('change',{bubbles:true})); }
  });
  await sleep(1000);
  await idle();
  /* 轮询等待 toggle 完成（toggle 直接调用未入 enqueue，idle 等不到） */
  let mdState=false;
  for(let i=0;i<20;i++){
    mdState=await page.evaluate(()=>{
      const S=window.__S();
      return S._cur && /- \[x\]/.test(S._cur.md||'');
    });
    if(mdState) break;
    await sleep(200);
  }
  check('待办勾选后落盘为 - [x]',mdState);

  const fails=results.filter(r=>!r.pass);
  console.log('\n===== 弹窗/待办结果 =====');
  results.forEach(r=>console.log((r.pass?'✓':'✗')+' '+r.name));
  console.log('\n通过: '+(results.length-fails.length)+'/'+results.length);
  console.log('失败:',fails.map(r=>r.name));
  console.log('错误:',errs.slice(0,6));
  await browser.close();
})();
