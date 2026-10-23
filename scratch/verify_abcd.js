const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch({headless:true,executablePath:'/opt/vm/preinstall/ms-playwright/chromium_headless_shell-1169/chrome-linux/headless_shell'});
  const ctx=await b.newContext({viewport:{width:360,height:792,deviceScaleFactor:4},isMobile:true,hasTouch:true,reducedMotion:'no-preference'});
  const p=await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto('http://localhost:8765/index.html');
  await p.waitForSelector('#v16root .v16-folder-card',{timeout:15000});
  await p.waitForTimeout(800);

  /* ① 字号刻度尺：点设置 fontscale */
  await p.evaluate(()=>window.VUI.renderSettings());
  await p.waitForTimeout(300);
  const before = await p.evaluate(()=>document.getElementById('v16root').style.fontSize || '16');
  await p.evaluate(()=>{ const r=document.querySelector('.v16-row[data-row="fontscale"]'); if(r)r.click(); });
  await p.waitForTimeout(300);
  const after = await p.evaluate(()=>document.getElementById('v16root').style.fontSize || '16');
  console.log('字号刻度尺: before='+before+' after='+after);

  /* ② 移动到…：打开工作文件夹→打开笔记→更多→移动到 */
  await p.evaluate(()=>{ window.VUI.show('home'); window.VUI.renderHome(); });
  await p.waitForTimeout(400);
  await p.evaluate(()=>{const c=document.querySelector('.v16-folder-card[data-folder="工作"]');if(c)c.click();});
  await p.waitForTimeout(400);
  await p.evaluate(()=>{const c=document.querySelector('.v16-note-card'); if(c)c.click();});
  await p.waitForSelector('#v16EdBody',{timeout:5000});
  await p.click('#v16EdMore'); await p.waitForTimeout(300);
  await p.evaluate(()=>{[...document.querySelectorAll('#v16SheetOpts .v16-sheet-opt')].find(o=>o.textContent.includes('移动到')).click();});
  await p.waitForTimeout(400);
  const moveOpts = await p.$$eval('#v16SheetOpts .v16-sheet-opt', els=>els.map(e=>e.textContent.trim()));
  console.log('移动到 sheet 选项:', JSON.stringify(moveOpts.slice(0,5)));

  /* ③ 网盘入口 */
  await p.evaluate(()=>window.VUI.renderSettings());
  await p.waitForTimeout(300);
  const panRow = await p.evaluate(()=>!!document.querySelector('.v16-row[data-row="pan"]'));
  console.log('网盘入口存在:', panRow);

  console.log('pageerrors:', errs.length);
  await b.close();
})();
