const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch({headless:true,executablePath:'/opt/vm/preinstall/ms-playwright/chromium_headless_shell-1169/chrome-linux/headless_shell'});
  const ctx=await b.newContext({viewport:{width:360,height:792,deviceScaleFactor:4},isMobile:true,hasTouch:true,reducedMotion:'no-preference'});
  const p=await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto('http://localhost:8765/index.html');
  await p.waitForSelector('#v16root .v16-folder-card',{timeout:15000});
  await p.waitForTimeout(1000);

  /* ① VaultSync 存在 */
  const hasSync = await p.evaluate(()=>typeof window.VaultSync);
  console.log('VaultSync 类型:', hasSync);

  /* ② syncVaultToStore：vault → 全局 notes */
  const r1 = await p.evaluate(async ()=>{
    const before = (typeof notes!=='undefined') ? notes.length : -1;
    const res = await window.VaultSync.syncVaultToStore();
    const after = (typeof notes!=='undefined') ? notes.length : -1;
    const sample = (typeof notes!=='undefined' && notes[0]) ? {id:notes[0].id, title:notes[0].title, type:notes[0].type, hasContent: !!notes[0].content, todoCount:(notes[0].todos||[]).length} : null;
    return {syncCount: res.count, beforeNotes: before, afterNotes: after, sample};
  });
  console.log('syncVaultToStore:', JSON.stringify(r1,null,2));

  /* ③ 设置新导出行存在 */
  await p.evaluate(()=>window.VUI.renderSettings());
  await p.waitForTimeout(300);
  const rows = await p.$$eval('.v16-row[data-row]', els=>els.map(e=>e.dataset.row));
  console.log('设置 data-row 列表:', JSON.stringify(rows));

  console.log('pageerrors:', errs.length);
  await b.close();
})();
