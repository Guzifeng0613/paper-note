const {chromium}=require('playwright');
(async()=>{
  const browser=await chromium.launch({headless:true,
    executablePath:'/opt/vm/preinstall/ms-playwright/chromium_headless_shell-1169/chrome-linux/headless_shell'});
  const page=await browser.newPage({viewport:{width:390,height:844}});
  const errs=[];page.on('console',m=>{if(m.type()==='error')errs.push(m.text());});
  await page.goto('file:///home/user/Doubao/chats/38443854002369026/notes-app/index.html');
  await page.waitForFunction(()=>window.__app&&window.__app.KB,{timeout:8000});
  await page.evaluate(()=>{
    window.__app.AIs.add({name:'测试',baseUrl:'https://api.test.com/v1',key:'k',model:'m'});
    localStorage.removeItem('zhipian.chats.v1');
  });
  let captured=null;
  await page.route('**/chat/completions',route=>{
    captured=route.request().postData();
    const md='# 回答标题\n**要点**：\n- 第一\n- 第二';let sse='';
    for(const c of md)sse+='data: '+JSON.stringify({choices:[{delta:{content:c}}]})+'\n\n';
    route.fulfill({status:200,contentType:'text/event-stream',body:sse+'data: [DONE]\n\n'});
  });
  const r=[];
  await page.evaluate(async()=>{
    const A=window.__app;const id=A.uid();
    A.notes.push({id,title:'沟通技巧笔记',
      content:'<p>说服型沟通的四个步骤是顺、探、利、收，要先共情再抓痛点。</p>',
      todos:[],files:[],tags:[],createdAt:Date.now(),updatedAt:Date.now()});
    await A.chunkNote(A.notes[A.notes.length-1]);
  });
  await page.evaluate(()=>{location.hash='#/chat';});
  await page.waitForTimeout(150);
  r.push(['空态显示欢迎',await page.$('#chatBody .chat-empty')!==null]);
  r.push(['搜索页无问AI tab',await page.evaluate(()=>![...document.querySelectorAll('#srSeg button')].some(b=>b.dataset.m==='ai'))]);
  r.push(['主页有AI圆形入口',await page.$('#openChat')!==null]);
  await page.evaluate(()=>window.__app.startNewChat());
  r.push(['新建对话且curChatId有效',(await page.evaluate(()=>window.__app.curChatId))!==null]);
  await page.fill('#chatInput','怎么沟通');
  await page.click('#chatSend');
  await page.waitForFunction(()=>{
    const c=window.__app.ChatStore.all()[0];return c&&c.messages.some(m=>m.role==='assistant');},{timeout:8000});
  await page.waitForTimeout(200);
  const c0=await page.evaluate(()=>window.__app.ChatStore.all()[0]);
  r.push(['含user与assistant两条',c0.messages.length===2]);
  r.push(['标题更新为用户首句',c0.title==='怎么沟通']);
  r.push(['AI气泡渲染了标题h1',await page.$('#chatBody .msg.ai h1')!==null]);
  r.push(['AI气泡渲染了列表',(await page.$$('#chatBody .msg.ai ul li')).length===2]);
  r.push(['用户气泡琥珀金靠右',await page.$('#chatBody .msg.user')!==null]);
  const body=JSON.parse(captured);
  r.push(['请求首条是system',body.messages[0].role==='system']);
  r.push(['system含知识库沟通内容',body.messages[0].content.includes('沟通')]);
  r.push(['assistant消息携带refs',Array.isArray(c0.messages[1].refs)&&c0.messages[1].refs.length>0]);
  r.push(['气泡下显示参考来源',await page.$('#chatBody .chat-refs .cr-ref')!==null]);
  r.push(['范围条显示全部',(await page.textContent('#chatScopeBar')).includes('全部')]);
  await page.evaluate(()=>{
    const C=window.__app.ChatStore;const day=864e5;
    const mk=(t,title)=>{const c=C.create();const all=C.all();const x=all.find(z=>z.id===c.id);
      x.title=title;x.updatedAt=t;x.createdAt=t;C.save(all);};
    mk(Date.now()-3*day,'7天内对话');mk(Date.now()-15*day,'30天内对话');mk(Date.now()-60*day,'更早对话');
  });
  await page.evaluate(()=>window.__app.openChatDrawer());
  await page.waitForTimeout(400);
  const gl=await page.$$eval('#cdList .cd-gl',els=>els.map(e=>e.textContent));
  r.push(['抽屉含四组',['今天','7 天内','30 天内','更早'].every(g=>gl.includes(g))]);
  const closed=await page.evaluate(()=>window.__dismissOverlay());
  r.push(['返回键先关抽屉',closed===true]);
  await page.evaluate(()=>{const id=window.__app.ChatStore.all().find(c=>c.title==='更早对话').id;window.__app.ChatStore.remove(id);});
  r.push(['删除对话-1',(await page.evaluate(()=>window.__app.ChatStore.all().length))===3]);
  await page.evaluate(()=>{
    const A=window.__app;A.prefs.nbFilter='工作笔记本';
    const n=A.notes.find(x=>x.title==='沟通技巧笔记');n.notebook='工作笔记本';
    const id=A.uid();
    A.notes.push({id,title:'私人笔记',content:'<p>秘密花园私人内容与工作无关</p>',
      todos:[],files:[],tags:[],notebook:'私人本',createdAt:Date.now(),updatedAt:Date.now()});
  });
  await page.evaluate(async()=>{const A=window.__app;await A.chunkNote(A.notes.find(x=>x.title==='私人笔记'));});
  await page.evaluate(()=>window.__app.startNewChat());
  await page.fill('#chatInput','工作沟通');captured=null;
  await page.click('#chatSend');
  await page.waitForFunction(()=>{const c=window.__app.ChatStore.get(window.__app.curChatId);
    return c&&c.messages.some(m=>m.role==='assistant');},{timeout:8000});
  await page.waitForTimeout(150);
  const b2=JSON.parse(captured);
  r.push(['笔记本system含范围',b2.messages[0].content.includes('工作笔记本')]);
  r.push(['笔记本范围不含私人内容',!b2.messages[0].content.includes('秘密花园')]);
  r.push(['范围条显示笔记本',(await page.textContent('#chatScopeBar')).includes('工作笔记本')]);
  await page.evaluate(()=>{window.__app.prefs.nbFilter=null;});

  /* ---- 来源去重：同便签多个父块命中也只显示一次 ---- */
  const did=await page.evaluate(async()=>{
    const A=window.__app;const id=A.uid();
    A.notes.push({id,title:'多父块测试',content:
      '<p>'+'沟通说服要先共情对方倾听需求建立信任关系，这是测试关键词，情绪价值很重要。'.repeat(15)+'</p>'
      +'<p>'+'编程算法要看复杂度数据结构递归迭代，这是测试关键词，时间空间要权衡。'.repeat(15)+'</p>',
      todos:[],files:[],tags:[],createdAt:Date.now(),updatedAt:Date.now()});
    await A.chunkNote(A.notes[A.notes.length-1]);return id;
  });
  const pc=await page.evaluate(async id=>
    (await window.__app.KB.allChunks()).filter(c=>c.level==='parent'&&String(c.noteId)===String(id)).length,did);
  const dedup=await page.evaluate(async()=>{
    const res=await window.__app.knowledgeSearch('测试',{limit:8});
    return {n:res.length,uniq:new Set(res.map(r=>String(r.parent.noteId))).size};
  });
  r.push(['该便签产生多个父块（测试前提）',pc>=2]);
  r.push(['同便签多父块只保留一个来源',dedup.n===dedup.uniq&&dedup.n===1]);

  /* ---- 联网放行规则 ---- */
  const waitAns=()=>page.waitForFunction(()=>{const c=window.__app.ChatStore.get(window.__app.curChatId);
    return c&&c.messages.some(m=>m.role==='assistant');},{timeout:8000});
  const askOnce=async question=>{
    await page.evaluate(()=>window.__app.startNewChat());captured=null;
    await page.fill('#chatInput',question);
    await page.click('#chatSend');await waitAns();await page.waitForTimeout(80);
    return JSON.parse(captured);
  };
  const useModel=async model=>page.evaluate(m=>{
    const A=window.__app;const c=A.AIs.add({name:m,baseUrl:'https://api.test.com/v1',key:'k',model:m});
    A.prefs.ais.cur=c.id;},model);
  /* 咒语 + 未知模型：system 放行，但不硬塞可能报错的厂商参数 */
  const b3=await askOnce('请联网搜索今天的新闻');
  r.push(['咒语放行 system（不局限知识库）',b3.messages[0].content.includes('联网')&&!b3.messages[0].content.includes('只能依据')]);
  r.push(['未知模型不硬塞联网参数',b3.enable_search===undefined&&!Array.isArray(b3.tools)]);
  /* 千问/智谱：模型名命中即默认联网，无需咒语 */
  await useModel('qwen-max');
  const bq=await askOnce('今天天气');
  r.push(['千问模型默认 enable_search',bq.enable_search===true]);
  r.push(['千问默认放行 system',bq.messages[0].content.includes('联网')]);
  await useModel('glm-4');
  const bg=await askOnce('今天天气');
  r.push(['智谱模型默认 web_search 工具',Array.isArray(bg.tools)&&bg.tools.some(t=>t.type==='web_search')]);
  /* 普通模型 + 无咒语：限定知识库、无联网参数 */
  await useModel('some-other-model');
  const b4=await askOnce('怎么沟通');
  r.push(['其他模型默认不塞联网参数',b4.enable_search===undefined&&!Array.isArray(b4.tools)]);
  r.push(['默认 system 限定知识库',b4.messages[0].content.includes('只能依据')]);

  let pass=0;r.forEach(([n,ok])=>{console.log((ok?'PASS':'FAIL')+' | '+n);if(ok)pass++;});
  console.log('\n'+pass+'/'+r.length);console.log('console错误:',errs.length?errs:'无');
  await browser.close();
})();
