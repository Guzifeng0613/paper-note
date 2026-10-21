const {chromium}=require('playwright');
(async()=>{
  const browser=await chromium.launch({headless:true,
    executablePath:'/opt/vm/preinstall/ms-playwright/chromium_headless_shell-1169/chrome-linux/headless_shell'});
  const page=await browser.newPage({viewport:{width:390,height:844}});
  const errs=[];page.on('console',m=>{if(m.type()==='error')errs.push(m.text());});
  await page.goto('file:///home/user/Doubao/chats/38443854002369026/notes-app/index.html');
  await page.waitForFunction(()=>window.__app,{timeout:8000});
  await page.evaluate(()=>{
    window.__app.AIs.add({name:'t',baseUrl:'https://api.test.com/v1',key:'k',model:'m'});});
  await page.route('**/chat/completions',route=>{
    const md='**结论**：\n- 要点一\n- 要点二';let sse='';
    for(const c of md)sse+='data: '+JSON.stringify({choices:[{delta:{content:c}}]})+'\n\n';
    route.fulfill({status:200,contentType:'text/event-stream',body:sse+'data: [DONE]\n\n'});});
  const r=[];
  const nid=await page.evaluate(()=>{
    const A=window.__app;const id=A.uid();
    A.notes.push({id,title:'沟通技巧',content:'<p>说服的四个步骤：顺探利收。</p>',
      todos:[{text:'练习倾听',done:false}],files:[],createdAt:Date.now(),updatedAt:Date.now()});
    A.persist();return id;});
  await page.evaluate(id=>{location.hash='#/edit?id='+id;},nid);
  await page.waitForTimeout(400);
  r.push(['编辑页有圆形AI按钮',await page.$('#editNoteAI')!==null]);
  const ctx=await page.evaluate(()=>window.__app.noteContextText(window.__app.cur()));
  r.push(['上下文含标题',ctx.includes('沟通技巧')]);
  r.push(['上下文含正文',ctx.includes('顺探利收')]);
  r.push(['上下文含待办',ctx.includes('练习倾听')]);
  r.push(['上下文不含标签字段',!ctx.includes('标签：')]);
  await page.click('#editNoteAI');
  await page.waitForTimeout(300);
  r.push(['本页问答面板打开',await page.$eval('#noteAiPanel',e=>e.classList.contains('open'))]);
  r.push(['显示欢迎与建议',await page.$('#naiBody .chat-empty')!==null]);
  r.push(['范围条显示本页',(await page.textContent('#naiScopeBar')).includes('本页')]);
  await page.fill('#naiInput','总结一下');
  await page.click('#naiSend');
  await page.waitForFunction(()=>{
    const b=document.querySelectorAll('#naiBody .msg.ai .m-bubble');
    return b.length&&!b[b.length-1].querySelector('.typing');},{timeout:8000});
  await page.waitForTimeout(200);
  r.push(['AI回答渲染加粗',await page.$('#naiBody .msg.ai strong')!==null]);
  r.push(['AI回答渲染列表2项',(await page.$$('#naiBody .msg.ai ul li')).length===2]);
  r.push(['用户问题气泡存在',await page.$('#naiBody .msg.user')!==null]);
  const closed=await page.evaluate(()=>window.__dismissOverlay());
  r.push(['返回键先关面板',closed===true]);
  r.push(['面板已关闭',!(await page.$eval('#noteAiPanel',e=>e.classList.contains('open')))]);
  let pass=0;r.forEach(([n,ok])=>{console.log((ok?'PASS':'FAIL')+' | '+n);if(ok)pass++;});
  console.log('\n'+pass+'/'+r.length);console.log('console错误:',errs.length?errs:'无');
  await browser.close();
})();
