const {chromium}=require('playwright');
const EXE='/opt/vm/preinstall/ms-playwright/chromium_headless_shell-1169/chrome-linux/headless_shell';
const URL0='file:///home/user/Doubao/chats/38443854002369026/notes-app/index.html';
let pass=0,fail=0;const logs=[];
function ok(c,m){if(c){pass++;console.log('PASS |',m);}else{fail++;console.log('FAIL |',m);}}
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:EXE});
  const page=await browser.newPage({viewport:{width:390,height:844}});
  page.on('pageerror',e=>logs.push(e.message));
  await page.goto(URL0);await page.waitForFunction(()=>window.__app);await page.waitForTimeout(500);

  /* 进对话并新建，确保历史里有内容 */
  await page.evaluate(()=>location.hash='#/chat');
  await page.waitForSelector('#scr-chat.active');await page.waitForTimeout(300);
  await page.click('#chatNewTop');await page.waitForTimeout(200);
  await page.click('#chatMenu');
  await page.waitForSelector('#chatDrawer.open');await page.waitForTimeout(400);

  /* 1. 标题居中：占位 + b text-align center */
  const head=await page.evaluate(()=>{
    const sp=document.querySelector('.cd-head-sp');
    const b=document.querySelector('.cd-head b');
    return {sp:sp?Math.round(sp.getBoundingClientRect().width):0,
      bAlign:getComputedStyle(b).textAlign};
  });
  ok(head.sp===40,'1a 标题左侧占位等宽(40)，保证标题真正居中');
  ok(head.bAlign==='center','1b “历史对话”标题文本水平居中');

  /* 2. 历史行：无删除图标、文字居中 */
  const items=await page.evaluate(()=>{
    const it=document.querySelector('.cd-item');
    return {exists:!!it,
      total:document.querySelectorAll('.cd-item').length,
      del:document.querySelectorAll('.cd-item .cd-del').length,
      align:it?getComputedStyle(it.querySelector('b')).textAlign:null};
  });
  ok(items.exists,'2a 存在历史记录行');
  ok(items.del===items.total&&items.del>0,'2b 每个历史行右侧都有垃圾桶删除键');
  ok(items.align==='left','2c 历史行标题文字左对齐（配合右侧删除键）');

  /* 3. 点遮罩右侧空白区关闭（抽屉占左侧约78%，遮罩可点区在右侧） */
  await page.mouse.click(360,420);
  await page.waitForTimeout(400);
  ok(await page.evaluate(()=>!document.querySelector('#chatDrawer').classList.contains('open')),
     '3 点击旁边空白遮罩可关闭（返回）');

  /* 4. 系统返回键：__dismissOverlay 关闭抽屉 */
  await page.click('#chatMenu');
  await page.waitForSelector('#chatDrawer.open');await page.waitForTimeout(300);
  const dismissed=await page.evaluate(()=>window.__dismissOverlay());
  await page.waitForTimeout(300);
  ok(dismissed===true && await page.evaluate(()=>!document.querySelector('#chatDrawer').classList.contains('open')),
     '4 系统返回键可关闭历史抽屉');

  /* 5. 编辑器返回键离左边缘远一点 */
  await page.evaluate(()=>location.hash='#/home');await page.waitForTimeout(300);
  await page.click('#fab');await page.waitForSelector('#scr-edit.active');await page.waitForTimeout(300);
  const back=await page.evaluate(()=>{
    const b=document.querySelector('#editBack');
    const r=b.getBoundingClientRect();
    return {left:Math.round(r.left),etPad:parseInt(getComputedStyle(document.querySelector('.et-left')).paddingLeft)};
  });
  ok(back.etPad===10,'5a 编辑器左侧组内边距 10px');
  ok(back.left>=30,'5b 返回键离屏幕左边缘较远（left='+back.left+'）');

  ok(logs.length===0,'6 全程无报错: '+(logs.length?logs:'无'));
  console.log('\n历史抽屉/返回键 '+pass+'/'+(pass+fail));
  await browser.close();
  process.exit(fail?1:0);
})();
