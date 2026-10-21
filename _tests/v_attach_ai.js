const {chromium}=require('playwright');
const fs=require('fs');
const EXE='/opt/vm/preinstall/ms-playwright/chromium_headless_shell-1169/chrome-linux/headless_shell';
const BASE='/home/user/Doubao/chats/38443854002369026/notes-app/';
const URL0='file://'+BASE+'index.html';
let pass=0,fail=0;const logs=[];
const ok=(c,m)=>{c?pass++:fail++;console.log((c?'PASS | ':'FAIL | ')+m);};
const PNG='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const sseOk=()=>{let s='';for(const c of '已收到，开始回答。')
  s+='data: '+JSON.stringify({choices:[{delta:{content:c}}]})+'\n\n';
  return {status:200,contentType:'text/event-stream',body:s+'data: [DONE]\n\n'};};
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:EXE});
  const page=await browser.newPage({viewport:{width:390,height:844}});
  page.on('pageerror',e=>logs.push(e.message));
  page.on('console',m=>{if(m.type()==='error')logs.push(m.text());});
  await page.goto(URL0);await page.waitForFunction(()=>window.__app);await page.waitForTimeout(400);

  /* ===== 一、真实文档样本解析（PDF / Word / Excel） ===== */
  const docs=[
    {name:'report.pdf',path:'_test/fix/report.pdf',kw:'季度报告'},
    {name:'doc.docx',path:'_test/fix/doc.docx',kw:'Word'},
    {name:'sheet.xlsx',path:'_test/fix/sheet.xlsx',kw:'服务器'},
  ];
  for(const d of docs){
    const b64=fs.readFileSync(BASE+d.path).toString('base64');
    const r=await page.evaluate(async a=>{
      const A=window.__app;const bin=atob(a.b64),bytes=new Uint8Array(bin.length);
      for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);
      const blob=new Blob([bytes]);const id=A.uid();await A.idbPutBlob(id,blob);
      const rec=await A.fileTextFor({id,name:a.name,size:blob.size,idx:0});
      let txt='';const dd=rec.data;
      if(dd.kind==='pdf')txt=dd.pages.map(p=>p.text).join('\n');
      else if(dd.kind==='docx')txt=dd.text;
      else if(dd.kind==='sheet')txt=dd.sheets.map(s=>s.text).join('\n');
      return {kind:dd.kind,txt};
    },{name:d.name,b64});
    ok(r.kind!=='error'&&r.kind!=='unsupported','1['+d.name+'] 解析成功（kind='+r.kind+'）');
    ok(r.txt.includes(d.kw),'  正文含关键内容「'+d.kw+'」');
  }

  /* ===== 二、图片附件 + 视觉能力 ===== */
  const setup=await page.evaluate(async pngB64=>{
    const A=window.__app;
    const textCfg=A.AIs.add({name:'文本',baseUrl:'https://api.t.com/v1',key:'k',model:'deepseek-v4-flash'});
    const visCfg=A.AIs.add({name:'视觉',baseUrl:'https://api.t.com/v1',key:'k',model:'doubao-vision-pro'});
    /* 图片 blob + 便签 */
    const bin=atob(pngB64),bytes=new Uint8Array(bin.length);
    for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);
    const blob=new Blob([bytes],{type:'image/png'});
    const f={id:A.uid(),name:'照片.png',size:blob.size,type:'image/png',kind:'image',idx:0};
    await A.idbPutBlob(f.id,blob);
    const n={id:A.uid(),type:'note',title:'带图笔记',content:'<p>这是正文</p>',
      files:[f],tags:[],todos:[],pinned:false,trashed:false,createdAt:Date.now(),updatedAt:Date.now()};
    A.notes.push(n);A.persist();
    return {textCfg:textCfg.id,visCfg:visCfg.id,noteId:n.id};
  },PNG);

  /* mock /chat/completions：记录是否含图；degrade 模式对首次含图请求回 400 */
  const S={mode:'ok',imgReqs:[]};let img400done=false;
  await page.route('**/chat/completions',route=>{
    const post=route.request().postData()||'';
    const hasImg=post.includes('image_url');
    S.imgReqs.push(hasImg);
    if(S.mode==='degrade'&&hasImg&&!img400done){img400done=true;
      return route.fulfill({status:400,contentType:'application/json',
        body:JSON.stringify({error:{message:'Model does not support image input'}})});}
    return route.fulfill(sseOk());
  });

  const ask=async q=>{
    await page.fill('#naiInput',q);
    await page.click('#naiSend');
    await page.waitForFunction(()=>{
      const bs=document.querySelectorAll('#naiBody .msg.ai .m-bubble');
      const last=bs[bs.length-1];return last&&!last.querySelector('.typing');
    },{timeout:10000});
    await page.waitForTimeout(150);
    return await page.textContent('#toast');
  };
  const openPanel=async cfgId=>{
    if(await page.evaluate(()=>window.__dismissOverlay()))await page.waitForTimeout(300);
    await page.evaluate(id=>window.__app.AIs.setCur(id),cfgId);
    await page.evaluate(id=>{location.hash='#/edit?id='+id;},setup.noteId);
    await page.waitForTimeout(300);
    S.imgReqs=[];
    await page.click('#editNoteAI');
    await page.waitForSelector('#noteAiPanel.open');await page.waitForTimeout(300);
  };

  /* 场景A：纯文本模型 → 不发图，只提示 */
  await openPanel(setup.textCfg);
  let toast=await ask('看看图片里有什么');
  ok(!S.imgReqs.includes(true),'2A 纯文本模型：请求中不发送图片（无 image_url）');
  ok(/不支持图片|仅发送文字/.test(toast||''),'  有友好提示「当前模型不支持图片，仅发送文字」');

  /* 场景B：视觉模型 → 正常发图 */
  await openPanel(setup.visCfg);
  toast=await ask('看看图片里有什么');
  ok(S.imgReqs.includes(true),'2B 视觉模型：请求中携带图片（含 image_url）');

  /* 场景C：视觉模型但接口拒绝图片 → 自动去图降级、给提示 */
  S.mode='degrade';img400done=false;
  await openPanel(setup.visCfg);
  toast=await ask('看看图片里有什么');
  const finalReq=S.imgReqs[S.imgReqs.length-1];
  ok(S.imgReqs.includes(true)&&finalReq===false,'2C 首次带图被拒后，自动去图重试成功');
  ok(/仅发送文字|不支持图片/.test(toast||''),'  降级后有提示，不生硬报错');

  const realErrors=logs.filter(l=>!/400 \(Bad Request\)/.test(l)); /* 场景C刻意的400 */
  ok(realErrors.length===0,'3 全程无报错（除场景C刻意的400）: '+(realErrors[0]||'无'));
  console.log('\n附件/视觉 '+(pass)+'/'+(pass+fail));
  await browser.close();process.exit(fail?1:0);
})();
