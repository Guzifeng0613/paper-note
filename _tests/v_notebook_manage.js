const {chromium}=require('playwright');
const EXE='/opt/vm/preinstall/ms-playwright/chromium_headless_shell-1169/chrome-linux/headless_shell';
const URL0='file:///home/user/Doubao/chats/38443854002369026/notes-app/index.html';
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:EXE});
  const page=await browser.newPage({viewport:{width:390,height:844}});
  const errs=[];const pageerrs=[];
  page.on('console',m=>{if(m.type()==='error')errs.push(m.text());});
  page.on('pageerror',e=>pageerrs.push(String(e)));
  const R=[];const ok=(n,c)=>{R.push([n,!!c]);console.log((c?'PASS':'FAIL')+' | '+n);};
  await page.goto(URL0);
  await page.waitForFunction(()=>window.__app);
  await page.waitForTimeout(400);

  /* 准备：新建笔记本「待管理本」，并把前 2 张便签移进去 */
  await page.evaluate(()=>{
    const A=window.__app;
    if(!A.prefs.notebooks.includes('待管理本'))A.prefs.notebooks.push('待管理本');
    A.notes.filter(n=>!n.trashed).slice(0,2).forEach(n=>n.notebook='待管理本');
  });
  const inNb=await page.evaluate(()=>window.__app.notes.filter(n=>n.notebook==='待管理本').length);
  ok('0 准备：2 张便签在「待管理本」',inNb===2);

  /* 打开笔记本选择器（筛选模式），点行内管理按钮 */
  await page.evaluate(()=>window.__app.openNotebookPicker('filter'));
  await page.waitForSelector('#nbPicker.open');
  await page.waitForTimeout(400);
  await page.click('.nbp-row:has-text("待管理本") .nbp-manage');
  await page.waitForSelector('#dynSheet.show');
  await page.waitForTimeout(200);
  const sheetLabels=await page.$$eval('#dynOpts .sheet-opt',els=>els.map(e=>e.textContent));
  ok('1 管理面板含 重命名/删除',sheetLabels.some(x=>x.includes('重命名'))&&sheetLabels.some(x=>x.includes('删除笔记本')));

  /* 重命名 */
  await page.click('#dynOpts .sheet-opt >> nth=0');
  await page.waitForSelector('#modal.show');
  await page.waitForTimeout(200);
  const oldVal=await page.$eval('#rnInput',e=>e.value);
  ok('2a 重命名输入框预填旧名',oldVal==='待管理本');
  await page.fill('#rnInput','已重命名本');
  await page.click('#rnOk');
  await page.waitForTimeout(600);
  const rnState=await page.evaluate(()=>({
    hasOld:window.__app.prefs.notebooks.includes('待管理本'),
    hasNew:window.__app.prefs.notebooks.includes('已重命名本'),
    moved:window.__app.notes.filter(n=>n.notebook==='已重命名本').length,
    leftOld:window.__app.notes.filter(n=>n.notebook==='待管理本').length}));
  ok('2b 重命名后列表更新、2 张便签迁移',
    !rnState.hasOld&&rnState.hasNew&&rnState.moved===2&&rnState.leftOld===0);

  /* 重命名为已存在名字 → 报错拦截 */
  await page.click('.nbp-row:has-text("已重命名本") .nbp-manage');
  await page.waitForSelector('#dynSheet.show');await page.waitForTimeout(200);
  await page.click('#dynOpts .sheet-opt >> nth=0');
  await page.waitForSelector('#modal.show');await page.waitForTimeout(200);
  /* 找一个别的笔记本名；没有就用“全部”概念，直接填一个造好的同名 */
  await page.evaluate(()=>{if(!window.__app.prefs.notebooks.includes('另一个本'))window.__app.prefs.notebooks.push('另一个本');});
  await page.fill('#rnInput','另一个本');
  await page.click('#rnOk');
  await page.waitForTimeout(400);
  const stillThere=await page.evaluate(()=>window.__app.prefs.notebooks.includes('已重命名本'));
  const modalStillOpen=await page.$eval('#modal',e=>e.classList.contains('show'));
  ok('2c 重命名为同名被拦截、未改动',stillThere&&modalStillOpen);
  await page.click('#modal [data-close]');await page.waitForTimeout(300);

  /* 删除笔记本：管理 → 删除 → 确认 */
  await page.click('.nbp-row:has-text("已重命名本") .nbp-manage');
  await page.waitForSelector('#dynSheet.show');await page.waitForTimeout(200);
  await page.click('#dynOpts .sheet-opt >> nth=1');
  await page.waitForSelector('#modal.show');await page.waitForTimeout(200);
  const delHint=await page.$eval('#modalBox',e=>e.innerText);
  ok('3a 删除确认提示便签不会被删除',delHint.includes('便签本身不会被删除')||delHint.includes('不会被删除'));
  await page.click('#dnOk');
  await page.waitForTimeout(700);
  const delState=await page.evaluate(()=>({
    nbGone:!window.__app.prefs.notebooks.includes('已重命名本'),
    notesToAll:window.__app.notes.filter(n=>n.notebook===null).length>=2,
    noStray:window.__app.notes.filter(n=>n.notebook==='已重命名本').length,
    filterCleared:window.__app.prefs.nbFilter===null}));
  ok('3b 删除后笔记本消失、便签移到全部、筛选复位',
    delState.nnbGone===undefined&&delState.nbGone&&delState.notesToAll&&delState.noStray===0&&delState.filterCleared);

  /* 删除空笔记本：不提示便签数 */
  await page.evaluate(()=>{if(!window.__app.prefs.notebooks.includes('空本本')){
    window.__app.prefs.notebooks.push('空本本');window.__app.openNotebookPicker('filter');}});
  await page.waitForTimeout(400);
  await page.click('.nbp-row:has-text("空本本") .nbp-manage');
  await page.waitForSelector('#dynSheet.show');await page.waitForTimeout(200);
  const delLabel=await page.$eval('#dynOpts .sheet-opt >> nth=1',e=>e.textContent);
  ok('4 空笔记本删除项不显示便签迁移说明',!delLabel.includes('便签'));
  await page.click('#dynOpts .sheet-opt >> nth=1');
  await page.waitForSelector('#modal.show');await page.waitForTimeout(200);
  await page.click('#dnOk');
  await page.waitForTimeout(500);
  ok('4b 空笔记本已删除',await page.evaluate(()=>!window.__app.prefs.notebooks.includes('空本本')));

  const pass=R.filter(x=>x[1]).length,fail=R.filter(x=>!x[1]).length;
  console.log('\n笔记本管理 '+pass+'/'+R.length);
  console.log('console错误: '+(errs.length?JSON.stringify(errs.slice(0,6)):'无'));
  console.log('pageerror: '+(pageerrs.length?JSON.stringify(pageerrs.slice(0,6)):'无'));
  if(fail)process.exitCode=1;
  await browser.close();
})().catch(e=>{console.error('SCRIPT ERROR',e);process.exit(2);});
