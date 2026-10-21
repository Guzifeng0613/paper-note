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

  /* ---------- #15 设置分组手风琴 ---------- */
  const groups=await page.evaluate(()=>document.querySelectorAll('#settingsBody .set-group').length);
  assert(groups>=5,'#15 分组被包装成折叠组（'+groups+' 组）');
  const chev=await page.evaluate(()=>!!document.querySelector('#settingsBody .set-group .set-chev'));
  assert(chev,'#15 每组标题带折叠箭头');
  const target=await page.evaluate(()=>{
    const g=document.querySelectorAll('#settingsBody .set-group')[1]; /* 云与目录 */
    g.querySelector('.set-card-h').click();
    return g.dataset.name;
  });
  await sleep(420);
  const col=await page.evaluate(()=>{
    const g=document.querySelectorAll('#settingsBody .set-group')[1];
    const rows=g.querySelector('.set-group-card');
    return{
      collapsed:g.classList.contains('collapsed'),
      grid:getComputedStyle(rows).gridTemplateRows,
      persisted:window.__app.prefs.setCollapsed.includes('云与目录')
    };
  });
  assert(col.collapsed&&(col.grid==='0fr'||col.grid==='0px')&&col.persisted,
    '#15 折叠后行高收到 0 且状态持久化（'+JSON.stringify(col)+'）');
  /* 展开恢复 */
  await page.evaluate(()=>document.querySelectorAll('#settingsBody .set-group')[1].querySelector('.set-card-h').click());
  await sleep(360);
  const exp=await page.evaluate(()=>{
    const g=document.querySelectorAll('#settingsBody .set-group')[1];
    const rows=g.querySelector('.set-group-card');
    return{collapsed:g.classList.contains('collapsed'),grid:getComputedStyle(rows).gridTemplateRows};
  });
  assert(!exp.collapsed&&exp.grid!=='0fr','#15 再点展开恢复（'+exp.grid+'）');

  /* ---------- #14 主题切换圆形扩散 ---------- */
  const themeBefore=await page.evaluate(()=>document.documentElement.dataset.theme);
  const darkBtn=await page.evaluate(()=>{
    const b=document.querySelector('#themeSeg [data-t="dark"]');
    const rc=b.getBoundingClientRect();
    return{x:rc.left+rc.width/2,y:rc.top+rc.height/2};
  });
  await page.mouse.click(darkBtn.x,darkBtn.y);
  await sleep(80);
  const reveal=await page.evaluate(()=>{
    const ov=document.querySelector('.trl');
    if(!ov)return null;
    return{
      clip:getComputedStyle(ov).clipPath,
      theme:ov.dataset.theme,
      bg:getComputedStyle(ov).backgroundColor,
      hasClone:!!ov.querySelector('.trl-screen#scr-settings'),
      darkInk:getComputedStyle(ov.querySelector('.trl-screen h1')||ov).color
    };
  });
  assert(reveal&&reveal.clip.startsWith('circle')&&reveal.theme==='dark'&&reveal.hasClone,
    '#14 切换瞬间出现圆形克隆层（新主题界面已在圈内）（'+JSON.stringify(reveal)+'）');
  assert(reveal&&reveal.bg==='rgb(26, 28, 32)',
    '#14 克隆层底色为深色主题页底色（非纯黑）（'+reveal.bg+'）');
  await sleep(700);
  const after=await page.evaluate(()=>({
    theme:document.documentElement.dataset.theme,
    prefs:window.__app.prefs.theme,
    gone:!document.querySelector('.trl')
  }));
  assert(after.theme==='dark'&&after.prefs==='dark'&&after.gone,'#14 深色主题落库并移除扩散层（'+JSON.stringify(after)+'）');
  /* 切回浅色 */
  const lightBtn=await page.evaluate(()=>{
    const b=document.querySelector('#themeSeg [data-t="light"]');
    const rc=b.getBoundingClientRect();
    return{x:rc.left+rc.width/2,y:rc.top+rc.height/2};
  });
  await page.mouse.click(lightBtn.x,lightBtn.y);
  await sleep(800);
  const back=await page.evaluate(()=>document.documentElement.dataset.theme);
  assert(back==='light','#14 可切回浅色');
  assert(themeBefore!=='dark','#14 初始非深色（基线正常）');

  /* ---------- #16 进度条弹性收尾 ---------- */
  /* 顶部细条 */
  await page.evaluate(()=>{
    const bar=document.querySelector('#syncTopBar');
    bar.classList.add('show');
    window.__app.finishSyncTopBar(true);
  });
  await sleep(80);
  const mid=await page.evaluate(()=>{
    const i=document.querySelector('#syncTopBar i');
    const anims=i.getAnimations?i.getAnimations().length:0;
    return{anims,width:getComputedStyle(i).width,anim:getComputedStyle(i).animationName};
  });
  assert(mid.anims>=1,'#16 收尾时顶部条播放弹性动画（'+mid.anims+'）');
  await sleep(700);
  const hidden=await page.evaluate(()=>document.querySelector('#syncTopBar').classList.contains('show'));
  assert(!hidden,'#16 收尾动画后顶部条淡出');
  /* 失败直接淡出 */
  await page.evaluate(()=>{
    const bar=document.querySelector('#syncTopBar');
    bar.classList.add('show');
    window.__app.finishSyncTopBar(false);
  });
  await sleep(100);
  const failHide=await page.evaluate(()=>!document.querySelector('#syncTopBar').classList.contains('show'));
  assert(failHide,'#16 失败时直接淡出无弹性动画');
  /* 圆环 100% 弹动 */
  await page.evaluate(()=>window.__app.syncProgress(60,''));
  await page.evaluate(()=>window.__app.syncProgress(100,'完成'));
  const ring=await page.evaluate(()=>({
    cls:document.querySelector('#syncRing').classList.contains('pulse-done'),
    pct:document.querySelector('#syncPct').textContent
  }));
  assert(ring.cls&&ring.pct==='100%','#16 圆环 100% 弹性收尾（'+JSON.stringify(ring)+'）');
  await page.evaluate(()=>window.__app.syncProgress(40,''));
  const reset=await page.evaluate(()=>!document.querySelector('#syncRing').classList.contains('pulse-done'));
  assert(reset,'#16 进度回退时圆环重新就绪');

  await page.screenshot({path:'_verify/shots/d_theme.png'});
  await page.evaluate(()=>{
    window.__app.prefs.theme='light';window.__app.persistPrefs();window.__app.applyTheme();
  });
  console.log('errors:',err);
  await b.close();
})();
