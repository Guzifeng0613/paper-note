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
  await page.evaluate(()=>location.hash='#/settings');
  await sleep(500);

  /* 模拟真机 WebView：WAAPI 动画的 onfinish 永远不触发（回调丢失） */
  await page.evaluate(()=>{
    const orig=Element.prototype.animate;
    window.__origAnimate=orig;
    Element.prototype.animate=function(){
      const a=orig.apply(this,arguments);
      /* 故意不触发 onfinish，模拟回调丢失的真机 */
      Object.defineProperty(a,'onfinish',{set(){/* 吞掉 */},get(){return null;},configurable:true});
      return a;
    };
  });
  const p=await page.evaluate(()=>{
    const b=document.querySelector('#themeSeg [data-t="dark"]');
    const rc=b.getBoundingClientRect();return{x:rc.left+rc.width/2,y:rc.top+rc.height/2};
  });
  await page.mouse.click(p.x,p.y);
  /* 立即截图：扩散中段应当有覆盖层（视觉正常） */
  await sleep(300);
  const mid=await page.evaluate(()=>document.querySelectorAll('.trl').length);
  assert(mid===1,'动画进行中存在扩散层（'+mid+'）');
  /* 等超过 740ms：即使 onfinish 丢失，定时器也强制移除 */
  await sleep(700);
  const after=await page.evaluate(()=>({
    rev:document.querySelectorAll('.trl').length,
    theme:document.documentElement.dataset.theme,
    pref:window.__app.prefs.theme
  }));
  assert(after.rev===0,'onfinish 丢失时，定时器强制移除扩散层（残留 '+after.rev+'）');
  assert(after.theme==='dark'&&after.pref==='dark','主题已真正切换为深色');

  /* 快速连点：浅色→深色→浅色，只允许一个扩散层，最终正确且无残留 */
  await page.evaluate(()=>{
    Element.prototype.animate=window.__origAnimate; /* 恢复 */
  });
  const pts=await page.evaluate(()=>{
    const l=document.querySelector('#themeSeg [data-t="light"]');
    const d=document.querySelector('#themeSeg [data-t="dark"]');
    const rc=e=>{const r=e.getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2};};
    return{l:rc(l),d:rc(d)};
  });
  await page.mouse.click(pts.l.x,pts.l.y);
  await sleep(60);
  await page.mouse.click(pts.d.x,pts.d.y);
  await sleep(60);
  await page.mouse.click(pts.l.x,pts.l.y);
  await sleep(1000);
  const final=await page.evaluate(()=>({
    rev:document.querySelectorAll('.trl').length,
    pref:window.__app.prefs.theme
  }));
  assert(final.rev===0&&final.pref==='light','快速连点后无残留扩散层、最终主题正确（'+JSON.stringify(final)+'）');

  /* 路由变化兜底清理 */
  await page.mouse.click(pts.d.x,pts.d.y);
  await sleep(150);
  await page.evaluate(()=>location.hash='#/home');
  await sleep(300);
  const left=await page.evaluate(()=>document.querySelectorAll('.trl').length);
  assert(left===0,'离开设置页时扩散层被路由兜底清除');
  console.log('errors:',err);
  await b.close();
})();
