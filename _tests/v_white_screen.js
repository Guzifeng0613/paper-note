const {chromium}=require('playwright');
const EXE='/opt/vm/preinstall/ms-playwright/chromium_headless_shell-1169/chrome-linux/headless_shell';
const URL0='file:///home/user/Doubao/chats/38443854002369026/notes-app/index.html';
let pass=0,fail=0;const logs=[];
function ok(c,m){if(c){pass++;console.log('PASS |',m);}else{fail++;console.log('FAIL |',m);}}
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:EXE});
  const page=await browser.newPage({viewport:{width:390,height:844}});
  page.on('console',m=>logs.push(m.text()));
  page.on('pageerror',e=>logs.push('PAGEERROR:'+e.message));
  await page.goto(URL0);
  await page.waitForFunction(()=>window.__app);
  await page.waitForTimeout(500);

  /* 准备：真实流程新建 2 张便签 */
  for(let i=0;i<2;i++){
    await page.click('#fab');
    await page.waitForSelector('#scr-edit.active');
    await page.waitForTimeout(200);
    await page.fill('#paperTitle','白屏测试'+i);
    await page.click('#paperBody');
    await page.keyboard.type('这是用于白屏自愈测试的正文内容。');
    await page.click('#editBack');
    await page.waitForSelector('#scr-home.active');
    await page.waitForTimeout(300);
  }
  const cardCount=await page.$$eval('.note-card',els=>els.length);
  ok(cardCount>=2,'0 准备：主页至少 2 张便签（实际 '+cardCount+'）');

  ok(await page.evaluate(()=>typeof window.__forceRepaint)==='function',
     '1 存在 window.__forceRepaint 自愈函数');

  /* 主页调用 */
  const before=await page.evaluate(()=>{
    const a=document.querySelector('.screen.active');
    return {id:a?a.id:null,
      cards:document.querySelectorAll('#notesWrap .note-card').length,
      inline:a?a.style.transform:null};
  });
  await page.evaluate(()=>window.__forceRepaint());
  await page.waitForTimeout(150);
  const after=await page.evaluate(()=>{
    const a=document.querySelector('.screen.active');
    return {id:a?a.id:null,
      cards:document.querySelectorAll('#notesWrap .note-card').length,
      inline:a?a.style.transform:null,
      visible:a?getComputedStyle(a).visibility:null};
  });
  ok(after.id==='scr-home','2 重绘后主页仍为激活页（未白屏）');
  ok(after.cards===before.cards&&after.cards>=2,'3 重绘后便签卡片数量不变: '+after.cards);
  ok(after.inline===before.inline,'4 重绘后内联 transform 已恢复');
  ok(after.visible==='visible','5 重绘后激活页 visibility 正常');

  /* 编辑页调用 */
  await page.click('.note-card >> nth=0');
  await page.waitForSelector('#scr-edit.active');
  await page.waitForTimeout(200);
  await page.evaluate(()=>window.__forceRepaint());
  await page.waitForTimeout(150);
  const ed=await page.evaluate(()=>{
    const a=document.querySelector('.screen.active');
    return {id:a?a.id:null,inline:a?a.style.transform:null,
      title:document.querySelector('#paperTitle')?'存在':'缺失'};
  });
  ok(ed.id==='scr-edit','6 编辑页重绘后仍为激活页');
  ok(ed.inline==='','7 编辑页重绘后内联 transform 恢复为空');
  ok(ed.title==='存在','8 编辑页标题输入框仍在');
  await page.click('#editBack');
  await page.waitForSelector('#scr-home.active');

  /* 手动派发 pageshow / visibilitychange，不应报错且页面正常 */
  await page.evaluate(()=>{
    window.dispatchEvent(new Event('pageshow'));
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForTimeout(150);
  ok(await page.evaluate(()=>!!document.querySelector('.screen.active')),
     '9 pageshow/visibilitychange 触发重绘后仍有激活页');

  const err=logs.filter(l=>/PAGEERROR|error/i.test(l));
  ok(err.length===0,'10 全程无报错: '+(err.length?err.slice(0,2).join(';'):'无'));
  console.log('\n白屏自愈 '+pass+'/'+(pass+fail));
  console.log('console错误:',logs.filter(l=>/error/i.test(l)).length?logs:'无');
  await browser.close();
  process.exit(fail?1:0);
})();
