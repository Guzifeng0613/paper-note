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
  await page.evaluate(()=>{
    const app=window.__app;
    for(let i=0;i<18;i++){app.notes.push({id:app.uid(),title:'测试便签 '+i,
      content:'<p>内容内容内容内容</p>'.repeat(6),files:[],todos:[],
      color:'cream',pinned:false,trashed:false,createdAt:Date.now()+i,updatedAt:Date.now()+i});}
    app.persist();app.renderNotes(true);
  });
  await sleep(500);
  const can=await page.evaluate(()=>{const el=document.querySelector('#scr-home .screen-body');return el.scrollHeight>el.clientHeight;});
  assert(can,'首页列表可滚动（18 条）');

  const mid=await page.evaluate(()=>{
    const el=document.querySelector('#scr-home .screen-body');
    el.scrollTop=300;
    const r=el.getBoundingClientRect();
    const x=r.left+100,y0=r.top+200;
    const mk=(y,type)=>{
      const tch=new Touch({identifier:1,target:el,clientX:x,clientY:y});
      const t=type==='end'?[]:[tch];
      el.dispatchEvent(new TouchEvent('touch'+type,{touches:t,targetTouches:t,changedTouches:[tch],bubbles:true,cancelable:true}));
    };
    mk(y0,'start');mk(y0+100,'move');
    const tf=el.style.transform;
    mk(y0+100,'end');
    return {tf,scrollTop:el.scrollTop};
  });
  assert(mid.tf==='','#6 非边界下拉不误触发（transform="'+mid.tf+'"）');
  console.log('errors:',err);
  await b.close();
})();
