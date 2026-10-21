// M0 验收：真机尺寸 360x792 dpr4 截首页/编辑页/设置页，确认无 pageerror
const {chromium}=require('playwright');const path=require('path');
const EXE='/opt/vm/preinstall/ms-playwright/chromium_headless_shell-1169/chrome-linux/headless_shell';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const b=await chromium.launch({headless:true,executablePath:EXE});
  const ctx=await b.newContext({viewport:{width:360,height:792},deviceScaleFactor:4,isMobile:true,hasTouch:true,reducedMotion:'no-preference'});
  const page=await ctx.newPage();
  const errs=[];
  page.on('pageerror',e=>errs.push(e.message));
  await page.goto('file://'+path.resolve('index.html'));
  await page.waitForFunction(()=>window.__app);await sleep(500);
  await page.screenshot({path:'scratch/after/shot_home.png'});
  // 进编辑页：打开第一张卡片
  await page.evaluate(()=>{const c=document.querySelector('#notesWrap .note-card');if(c)c.click();});
  await sleep(600);
  await page.screenshot({path:'scratch/after/shot_editor.png'});
  await page.evaluate(()=>history.back());await sleep(500);
  await page.evaluate(()=>location.hash='#/settings');await sleep(500);
  await page.screenshot({path:'scratch/after/shot_settings.png'});
  console.log('PAGEERRORS:',errs.length?errs.join(' | '):'none');
  await b.close();
})();
