const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch({headless:true,executablePath:'/opt/vm/preinstall/ms-playwright/chromium_headless_shell-1169/chrome-linux/headless_shell'});
  const ctx=await b.newContext({viewport:{width:360,height:792,deviceScaleFactor:4},isMobile:true,hasTouch:true,reducedMotion:'no-preference'});
  const p=await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto('http://localhost:8765/index.html');
  await p.waitForSelector('#v16root .v16-folder-card',{timeout:15000});
  await p.waitForTimeout(800);
  await p.evaluate(()=>{const c=document.querySelector('.v16-folder-card[data-folder="工作"]');if(c)c.click();});
  await p.waitForTimeout(400);
  await p.click('#v16Fab'); await p.waitForTimeout(300);
  await p.evaluate(()=>document.querySelector('.v16-fab-item[data-f="note"]').click());
  await p.waitForSelector('#v16EdBody',{timeout:5000});
  await p.click('#v16EdMore'); await p.waitForTimeout(300);
  await p.evaluate(()=>{[...document.querySelectorAll('#v16SheetOpts .v16-sheet-opt')].find(o=>o.textContent.includes('删除')).click();});
  await p.waitForTimeout(600);
  await p.click('#v16More'); await p.waitForTimeout(300);
  await p.evaluate(()=>{[...document.querySelectorAll('#v16SheetOpts .v16-sheet-opt')].find(o=>o.textContent.includes('回收站')).click();});
  await p.waitForTimeout(600);
  /* 点恢复 */
  await p.evaluate(()=>{const b=document.querySelector('.v16-trash-item .b-restore'); if(b)b.click();});
  await p.waitForTimeout(1000);
  const after=await p.$$eval('.v16-trash-item', els=>els.length);
  console.log('恢复后条目数:', after);
  console.log('pageerrors:', errs);
  await b.close();
})();
