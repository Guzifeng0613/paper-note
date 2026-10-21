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

  // 首页顶部下拉阻尼
  const home=await page.evaluate(()=>{
    const el=document.querySelector('#scr-home .screen-body');
    el.scrollTop=0;
    const r=el.getBoundingClientRect();
    const x=r.left+100,y0=r.top+200;
    const mk=(y,type)=>{
      const tch=new Touch({identifier:1,target:el,clientX:x,clientY:y});
      const t=type==='end'?[]:[tch];
      el.dispatchEvent(new TouchEvent('touch'+type,{touches:t,targetTouches:t,changedTouches:[tch],bubbles:true,cancelable:true}));
    };
    mk(y0,'start');
    mk(y0+100,'move');   // 下拉 100px
    const pulled=el.style.transform;
    mk(y0+100,'end');
    return {pulled,canScroll:el.scrollHeight>el.clientHeight};
  });
  assert(home.canScroll,'首页列表可滚动（非短页）');
  assert(/translateY\(\s*[1-9]/.test(home.pulled),'#6 首页下拉阻尼生效（'+home.pulled+'）');
  await sleep(400);
  const released=await page.evaluate(()=>document.querySelector('#scr-home .screen-body').style.transform);
  assert(released==='','#6 松手后回弹复位（transform="'+released+'"）');

  // 非边界：scrollTop>0 时下拉不应接管
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
    return tf;
  });
  assert(mid==='','#6 非边界（scrollTop=300）不误触发');

  // 编辑器底部阻尼
  await page.evaluate(()=>{const c=document.querySelector('#notesWrap .note-card');c.click();});
  await sleep(500);
  const edit=await page.evaluate(()=>{
    const el=document.querySelector('#paperScroll');
    el.scrollTop=el.scrollHeight;  // 到底
    const r=el.getBoundingClientRect();
    const x=r.left+100,y0=r.top+200;
    const mk=(y,type)=>{
      const tch=new Touch({identifier:1,target:el,clientX:x,clientY:y});
      const t=type==='end'?[]:[tch];
      el.dispatchEvent(new TouchEvent('touch'+type,{touches:t,targetTouches:t,changedTouches:[tch],bubbles:true,cancelable:true}));
    };
    mk(y0,'start');
    mk(y0-110,'move');  // 上拉
    const tf=el.style.transform;
    mk(y0-110,'end');
    return {tf,bottom:el.scrollTop+el.clientHeight>=el.scrollHeight-1};
  });
  assert(edit.bottom&&/translateY\(-/.test(edit.tf),'#6 编辑器底部上拉阻尼生效（'+edit.tf+'）');
  await page.screenshot({path:'_verify/shots/b_rubber.png'});
  console.log('errors:',err);
  await b.close();
})();
