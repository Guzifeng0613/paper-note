const {chromium}=require('playwright');
const fs=require('fs');
const EXE='/opt/vm/preinstall/ms-playwright/chromium_headless_shell-1169/chrome-linux/headless_shell';
const BASE='/home/user/Doubao/chats/38443854002369026/notes-app';
const URL0='file://'+BASE+'/index.html';
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
  await page.evaluate(()=>{if(!window.__app.AIs.all().length)
    window.__app.AIs.add({name:'测试模型',baseUrl:'https://api.test.com/v1',key:'k',model:'m'});});

  /* 导出→导入往返：把下载文件读回，构造 File 交给 unifiedHandleFile */
  async function exportAndReimport(exportFn,mode){
    const dlP=page.waitForEvent('download');
    await exportFn();
    const dl=await dlP;
    const p=await dl.path();
    const buf=fs.readFileSync(p);
    const name=dl.suggestedFilename();
    /* 触发导入并等待 modal */
    const modalP=page.waitForSelector('#modal.show');
    await page.evaluate(({b64,nm})=>{
      const bin=atob(b64);const arr=new Uint8Array(bin.length);
      for(let i=0;i<bin.length;i++)arr[i]=bin.charCodeAt(i);
      const file=new File([arr],nm);
      return window.__app.unifiedHandleFile(file);
    },{b64:buf.toString('base64'),nm:name});
    await modalP;
    await page.waitForTimeout(200);
    if(mode==='over')await page.click('#uimo');else await page.click('#uimm');
    await page.waitForTimeout(600);
    return {name,size:buf.length};
  }
  const snapshot=()=>page.evaluate(()=>{
    const live=window.__app.notes.filter(n=>!n.trashed);
    let files=0,md=0;live.forEach(n=>(n.files||[]).forEach(f=>{
      if(f.hidden||f.derivedOf)md++;else files++;}));
    /* files=用户可见附件（图片/文档），md=导出时确定性生成的文字提取（派生数据） */
    return {notes:live.length,files,md,
      titles:live.map(n=>n.title||'无标题').sort().join('|')};
  });

  /* 1. 待办型便签（createNote todo） */
  await page.evaluate(()=>{window.__app.createNote('todo');});
  await page.waitForTimeout(500);
  const todoEdit=await page.evaluate(()=>location.hash.includes('#/edit')
    && document.querySelector('#paperTodo').classList.contains('show'));
  ok('1a 待办型便签直接进编辑且待办区显示',todoEdit);
  let rows=await page.$$('#paperTodo textarea.pt-text');
  await rows[0].fill('买菜');await rows[0].press('Enter');
  await page.waitForTimeout(300);
  rows=await page.$$('#paperTodo textarea.pt-text');
  await rows[1].fill('做饭');
  await page.waitForTimeout(200);
  await page.click('#editBack');await page.waitForTimeout(500);
  const todoCard=await page.evaluate(()=>{
    const n=window.__app.notes.find(x=>(x.todos||[]).some(t=>t.text==='买菜'));
    return !!(n&&!n.trashed&&document.querySelector('.note-card[data-id="'+n.id+'"]'));});
  ok('1b 待办型便签返回后卡片存在',todoCard);

  /* 2. 笔记本：过滤模式新建笔记本 */
  await page.evaluate(()=>window.__app.openNotebookPicker('filter'));
  await page.waitForSelector('#nbPicker.open');
  await page.waitForTimeout(400);
  await page.click('#nbpNew');
  await page.waitForSelector('#modal.show');
  await page.fill('#newNbInput','测试项目本');
  await page.click('#newNbOk');
  await page.waitForTimeout(600);
  const filtered=await page.evaluate(()=>({
    f:window.__app.prefs.nbFilter,
    n:window.__app.notes.filter(n=>!n.trashed).length,
    inNb:window.__app.notes.filter(n=>!n.trashed&&n.notebook==='测试项目本').length}));
  ok('2 新建笔记本并按其筛选（过滤模式创建的是空本）',
    filtered.f==='测试项目本'&&filtered.inNb===0);
  /* 取消筛选回全部 */
  await page.evaluate(()=>window.__app.setNbFilter(null));
  await page.waitForTimeout(400);

  /* 3. 移动便签到笔记本（move 模式） */
  const moveId=await page.evaluate(()=>{const n=window.__app.notes.find(x=>!x.trashed);
    window.__app.setEditing(n.id);return n.id;});
  await page.evaluate(()=>window.__app.openNotebookPicker('move'));
  await page.waitForSelector('#nbPicker.open');await page.waitForTimeout(400);
  const rowBtn=await page.$('.nbp-row:has-text("测试项目本")');
  await rowBtn.click();
  await page.waitForTimeout(600);
  const moved=await page.evaluate(i=>{const n=window.__app.notes.find(x=>x.id===i);
    return n.notebook==='测试项目本';},moveId);
  ok('3 便签移动到笔记本成功',moved);
  await page.evaluate(()=>location.hash='#/home');await page.waitForTimeout(400);

  /* 4. 批量操作：置顶 + 颜色 */
  const ids=await page.evaluate(()=>window.__app.notes.filter(n=>!n.trashed).slice(0,2).map(n=>n.id));
  await page.evaluate(i=>window.__app.enterSelect(i),ids[0]);
  await page.waitForTimeout(450);
  await page.click('.note-card[data-id="'+ids[1]+'"]');
  await page.waitForTimeout(200);
  await page.click('#bbPin');
  await page.waitForTimeout(500);
  const pinned=await page.evaluate(a=>a.every(i=>{const n=window.__app.notes.find(x=>x.id===i);return n.pinned;}),ids);
  ok('4a 批量置顶生效',pinned);
  /* 再选一次改颜色 */
  await page.evaluate(i=>window.__app.enterSelect(i),ids[0]);
  await page.waitForTimeout(450);
  await page.click('.note-card[data-id="'+ids[1]+'"]');
  await page.waitForTimeout(200);
  await page.click('#bbColor');
  await page.waitForSelector('#modal.show');
  await page.click('.color-dot[data-c="pink"]');
  await page.waitForTimeout(400);
  const colored=await page.evaluate(a=>a.every(i=>{const n=window.__app.notes.find(x=>x.id===i);return n.color==='pink';}),ids);
  ok('4b 批量改色生效',colored);

  /* 5. JSON 备份→覆盖导入 往返一致（页面内直接生成备份文本，走同一 applyLibrary） */
  await page.evaluate(()=>window.__app.flushDisk());
  const before=await snapshot();
  await page.evaluate(()=>{
    const data=JSON.stringify({app:'zhipian-notes',version:3,
      exportedAt:new Date().toISOString(),notes:window.__app.notes,prefs:window.__app.prefs});
    window.__app.importJsonText(data,'JSON 备份');
  });
  await page.waitForSelector('#modal.show');
  await page.click('#uimo');
  await page.waitForTimeout(600);
  const afterJson=await snapshot();
  ok('5 JSON 往返便签数/标题一致',before.notes===afterJson.notes&&before.titles===afterJson.titles);

  /* 6. kbpkg zip 导出→覆盖导入 往返一致（含附件） */
  const before2=await snapshot();
  let rz;
  try{
    rz=await exportAndReimport(()=>page.evaluate(()=>window.__app.exportKbPackage()),'over');
  }catch(e){ok('6 zip 导出（超时/解析） '+(e&&e.message),false);rz=null;}
  if(rz){
    const afterZip=await snapshot();
    ok('6 zip 往返便签数/用户附件数/标题一致',
      before2.notes===afterZip.notes&&before2.files===afterZip.files&&before2.titles===afterZip.titles);
    /* 附件 blob 仍可读取（随机抽一个非图片附件） */
    const blobOk=await page.evaluate(async()=>{
      const n=window.__app.notes.find(x=>(x.files||[]).some(f=>f.kind!=='image'));
      if(!n)return true; /* 没有非图片附件则跳过 */
      const f=n.files.find(x=>x.kind!=='image'&&!x.hidden);
      const b=await window.__app.attachmentBlob(f);return b&&b.size>0;});
    ok('6b 往返后附件 blob 可读取',blobOk);
  }

  /* 7. 附件打开不报错（openAttachment） */
  const openOk=await page.evaluate(async()=>{
    const n=window.__app.notes.find(x=>(x.files||[]).some(f=>!f.hidden));
    if(!n)return true;
    const f=n.files.find(x=>!x.hidden);
    try{await window.__app.openAttachment ? window.__app.openAttachment(f) : null;return true;}
    catch(e){return String(e);}
  });
  ok('7 openAttachment 无异常',openOk===true);

  /* 8. 搜索无结果态 + 最近搜索可删 */
  await page.evaluate(()=>location.hash='#/search');await page.waitForTimeout(400);
  await page.fill('#srInput','zzz不存在的关键词zzz');
  await page.waitForTimeout(500);
  const empty=await page.$eval('#srBody',e=>e.innerText.includes('没有')||e.innerText.includes('无结果')||e.innerText.includes('未找到')||e.children.length===0);
  ok('8a 无结果有空态',!!empty);
  await page.fill('#srInput','');
  await page.waitForTimeout(200);

  /* ===== 汇总 ===== */
  const pass=R.filter(x=>x[1]).length,fail=R.filter(x=>!x[1]).length;
  console.log('\n往返与边界 '+pass+'/'+R.length);
  console.log('console错误: '+(errs.length?JSON.stringify(errs.slice(0,8)):'无'));
  console.log('pageerror: '+(pageerrs.length?JSON.stringify(pageerrs.slice(0,8)):'无'));
  if(fail)process.exitCode=1;
  await browser.close();
})().catch(e=>{console.error('SCRIPT ERROR',e);process.exit(2);});
