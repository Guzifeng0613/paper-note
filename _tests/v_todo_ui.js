const {chromium}=require('playwright');
const EXE='/opt/vm/preinstall/ms-playwright/chromium_headless_shell-1169/chrome-linux/headless_shell';
const URL0='file:///home/user/Doubao/chats/38443854002369026/notes-app/index.html';
let pass=0,fail=0;const logs=[];
function ok(c,m){if(c){pass++;console.log('PASS |',m);}else{fail++;console.log('FAIL |',m);}}
const orderOf=page=>page.evaluate(()=>{const sc=document.querySelector('#paperScroll');
  const idx=id=>[...sc.children].findIndex(e=>e.id===id);
  return {todo:idx('paperTodo'),body:idx('paperBody'),attach:idx('paperAttach')};});
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:EXE});
  const page=await browser.newPage({viewport:{width:390,height:844}});
  page.on('pageerror',e=>logs.push(e.message));
  page.on('console',m=>{if(m.type()==='error')logs.push(m.text());});
  await page.goto(URL0);await page.waitForFunction(()=>window.__app);await page.waitForTimeout(400);
  await page.click('#fab');await page.waitForSelector('#scr-edit.active');await page.waitForTimeout(300);

  /* 1. 顶部按钮不重叠（390） */
  await page.click('#dockTodo');await page.waitForTimeout(500);
  const overlap=await page.evaluate(()=>{
    const bs=[...document.querySelectorAll('.edit-top .icon-btn')].map(b=>b.getBoundingClientRect()).filter(r=>r.width>0&&r.height>0);
    for(let i=1;i<bs.length;i++)if(Math.round(bs[i].left)<Math.round(bs[i-1].right)-1)return true;
    return false;});
  ok(!overlap,'1 编辑器顶栏撤销/重做/AI/分享/更多按钮互不重叠');

  /* 2. 待办默认置底：todo 在 body 后、attach 前 */
  let o=await orderOf(page);
  ok(o.todo>o.body&&o.todo<o.attach,'2 待办默认显示在正文最下面（正文与附件之间）');

  /* 3. 位置开关存在，且在“隐藏进度条”眼睛按钮左边 */
  const posInfo=await page.evaluate(()=>{
    const pos=document.querySelector('#ptPosToggle'),eye=document.querySelector('#ptProgToggle');
    return {pos:!!pos,eye:!!eye,
      posLeft:pos?pos.getBoundingClientRect().left:0,
      eyeLeft:eye?eye.getBoundingClientRect().left:0};
  });
  ok(posInfo.pos&&posInfo.eye,'3a 同时存在位置开关与进度显示开关');
  ok(posInfo.posLeft<posInfo.eyeLeft,'3b 位置开关在隐藏进度条（眼睛）按钮的左边');

  /* 4. 颜色统一：分隔线与进度条轨道使用冷色语义变量，无暖色硬编码 */
  const colors=await page.evaluate(()=>{
    const row=document.querySelector('.pt-row'),bar=document.querySelector('.pt-progress .bar');
    return {rowBorder:getComputedStyle(row).borderBottomColor,
      barBg:getComputedStyle(bar).backgroundColor};
  });
  ok(colors.rowBorder.startsWith('rgba'),'4a 待办分隔线使用统一冷色变量（不再是暖色 #eef0ea）');
  ok(colors.barBg.startsWith('rgba'),'4b 进度条轨道使用统一冷色变量（不再是暖色 #e9ebe4）');

  /* 5. 点位置开关 → 置顶，状态写入 n.todoPosition */
  await page.click('#ptPosToggle');await page.waitForTimeout(400);
  o=await orderOf(page);
  ok(o.todo<o.body,'5a 点击开关后待办置顶（在正文上面）');
  const persistedTop=await page.evaluate(()=>window.__app.cur().todoPosition);
  ok(persistedTop==='top','5b 置顶状态已持久化到便签数据');

  /* 6. 再点 → 回到置底 */
  await page.click('#ptPosToggle');await page.waitForTimeout(400);
  o=await orderOf(page);
  ok(o.todo>o.body,'6 再次点击开关后待办回到正文最下面');

  /* 7. 历史抽屉垃圾桶仍在 */
  await page.evaluate(()=>location.hash='#/chat');
  await page.waitForSelector('#scr-chat.active');await page.waitForTimeout(300);
  await page.click('#chatNewTop');await page.waitForTimeout(200);
  await page.click('#chatMenu');await page.waitForSelector('#chatDrawer.open');await page.waitForTimeout(400);
  const del=await page.evaluate(()=>({
    items:document.querySelectorAll('.cd-item').length,
    dels:document.querySelectorAll('.cd-item .cd-del').length}));
  ok(del.dels===del.items&&del.items>0,'7 历史抽屉每行有垃圾桶删除键');

  /* 8. 窄屏 360 顶部也不重叠 */
  const p2=await browser.newPage({viewport:{width:360,height:800}});
  await p2.goto(URL0);await p2.waitForFunction(()=>window.__app);await p2.waitForTimeout(400);
  await p2.click('#fab');await p2.waitForSelector('#scr-edit.active');await p2.waitForTimeout(400);
  const ov360=await p2.evaluate(()=>{
    const bs=[...document.querySelectorAll('.edit-top .icon-btn')].map(b=>b.getBoundingClientRect()).filter(r=>r.width>0&&r.height>0);
    for(let i=1;i<bs.length;i++)if(Math.round(bs[i].left)<Math.round(bs[i-1].right)-1)return true;
    return false;});
  ok(!ov360,'8 窄屏（360dp）顶栏按钮也不重叠');

  ok(logs.length===0,'9 全程无报错: '+(logs[0]||'无'));
  console.log('\n待办位置/顶栏/颜色 '+(pass)+'/'+(pass+fail)+(fail?'  有失败':''));
  await browser.close();
  process.exit(fail?1:0);
})();
