const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch({headless:true,executablePath:'/opt/vm/preinstall/ms-playwright/chromium_headless_shell-1169/chrome-linux/headless_shell'});
  const ctx=await b.newContext({viewport:{width:360,height:792,deviceScaleFactor:4},isMobile:true,hasTouch:true,reducedMotion:'no-preference'});
  const p=await ctx.newPage();
  await p.goto('http://localhost:8765/index.html');
  await p.waitForSelector('#v16root .v16-folder-card',{timeout:15000});
  await p.waitForTimeout(800);
  /* 直接调 Vault.move 验证落盘 */
  const r = await p.evaluate(async ()=>{
    /* 创建测试笔记 */
    const path = await window.Vault.create({title:'移动测试', folder:'工作', type:'note'});
    const before = await window.VaultFS.exists ? await window.VaultFS.exists(path) : true;
    /* 移动到根目录 */
    const newPath = await window.Vault.move(path, '');
    const moved = await window.VaultFS.read(newPath).catch(()=>null);
    const oldExists = await window.VaultFS.read(path).catch(()=>null);
    return { created: path, movedTo: newPath, movedContent: moved?moved.slice(0,40):null, oldGone: oldExists===null };
  });
  console.log(JSON.stringify(r,null,2));
  await b.close();
})();
