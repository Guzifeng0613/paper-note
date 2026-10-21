const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch({headless:true,executablePath:'/opt/vm/preinstall/ms-playwright/chromium_headless_shell-1169/chrome-linux/headless_shell'});
  const ctx=await b.newContext({viewport:{width:360,height:792,deviceScaleFactor:4},isMobile:true,hasTouch:true,reducedMotion:'no-preference'});
  const p=await ctx.newPage();
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
  /* 直接调 Vault.restore */
  const r = await p.evaluate(async ()=>{
    const items = await window.Vault.trashList();
    const path = items[0].entry.path;
    const orig = await window.Vault.restore(path);
    const after = await window.Vault.trashList();
    return { restored: orig, trashAfter: after.length };
  });
  console.log(JSON.stringify(r,null,2));
  await b.close();
})();
