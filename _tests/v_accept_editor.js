const {chromium}=require('playwright');
const EXE='/opt/vm/preinstall/ms-playwright/chromium_headless_shell-1169/chrome-linux/headless_shell';
const URL0='file:///home/user/Doubao/chats/38443854002369026/notes-app/index.html';
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:EXE});
  const page=await browser.newPage({viewport:{width:390,height:844}});
  const errs=[];page.on('console',m=>{if(m.type()==='error')errs.push(m.text());});
  await page.goto(URL0);
  await page.waitForFunction(()=>window.__app,{timeout:8000});
  const R=[];
  const ok=(n,c)=>R.push([n,!!c]);

  /* 新建便签并进入编辑 */
  async function makeNote(extra){
    return await page.evaluate(e=>{
      const A=window.__app,id=A.uid();
      A.notes.push(Object.assign({id,type:'note',title:'T',content:'<p>这是一段用于测试高亮功能的文字内容abcdefg</p>',
        todos:[],files:[],tags:[],pinned:false,trashed:false,createdAt:Date.now(),updatedAt:Date.now()},e));
      A.persist();return id;
    },extra||{});
  }
  async function openEdit(id){
    await page.evaluate(i=>{location.hash='#/edit?id='+i;},id);
    await page.waitForTimeout(450);
  }
  const selectAllBody=()=>page.evaluate(()=>{
    const b=document.querySelector('#paperBody'),r=document.createRange();
    r.selectNodeContents(b);const s=getSelection();s.removeAllRanges();s.addRange(r);
  });

  /* ---- D1/D2 高亮：加 / 取消 ---- */
  let id=await makeNote({title:'高亮测试'});
  await openEdit(id);
  await selectAllBody();
  let on=await page.evaluate(()=>{window.__app.toggleHighlight();return window.__app.selectionHiliteOn();});
  ok('D1 选中后加上高亮',on===true);
  let html=await page.$eval('#paperBody',e=>e.innerHTML);
  ok('D1 正文出现高亮标记',/FFE27A|255,\s*226,\s*122|class="hl"|<mark/i.test(html));
  await selectAllBody();
  let off=await page.evaluate(()=>{window.__app.toggleHighlight();return window.__app.selectionHiliteOn();});
  ok('D2 再次点击取消高亮',off===false);
  let html2=await page.$eval('#paperBody',e=>e.innerHTML);
  ok('D2 正文高亮背景已清除',!/FFE27A|255,\s*226,\s*122|class="hl"|<mark/i.test(html2));

  /* ---- D2 旧版"其他颜色"高亮也能识别并取消 ---- */
  let id2=await makeNote({title:'旧高亮',
    content:'<p>前文<span style="background-color:rgb(80,200,120)">绿色高亮文字内容</span>后文</p>'});
  await openEdit(id2);
  let greenOn=await page.evaluate(()=>{
    const span=document.querySelector('#paperBody span'),r=document.createRange();
    r.selectNodeContents(span);const s=getSelection();s.removeAllRanges();s.addRange(r);
    return window.__app.selectionHiliteOn();
  });
  ok('D2 非黄色旧高亮可被识别',greenOn===true);
  await page.evaluate(()=>window.__app.toggleHighlight());
  let greenCleared=await page.evaluate(()=>{
    const span=document.querySelector('#paperBody span');
    return !span || !/background/i.test(span.getAttribute('style')||'');
  });
  ok('D2 非黄色旧高亮可取消',greenCleared);

  /* ---- D2 更早版本的 span.hl / mark 标签也能识别并取消 ---- */
  let idh=await makeNote({title:'遗留标签',
    content:'<p>前<span class="hl">甲高亮文字</span>中<mark>乙高亮文字</mark>后</p>'});
  await openEdit(idh);
  await selectAllBody();
  ok('D2 遗留 span.hl/mark 被识别',await page.evaluate(()=>window.__app.selectionHiliteOn())===true);
  await page.evaluate(()=>window.__app.toggleHighlight());
  let lhHtml=await page.$eval('#paperBody',e=>e.innerHTML);
  ok('D2 遗留标签取消后无残留',!/<mark|class="hl"|background/i.test(lhHtml));

  /* ---- D3/D4/D5/D6 待办 ---- */
  let id3=await makeNote({title:'待办测试'});
  await openEdit(id3);
  await page.click('#dockTodo');                 // 真实按钮：addPaperTodo
  await page.waitForTimeout(300);
  ok('D3 点待办后出现一行',(await page.$$('#paperTodo .pt-row')).length===1);
  await page.fill('#paperTodo .pt-row .pt-text','第一条待办事项内容');
  await page.waitForTimeout(150);
  await page.evaluate(()=>{
    const t=document.querySelectorAll('#paperTodo .pt-row')[0].querySelector('.pt-text');
    t.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));
  });
  ok('D3 回车新增下一条',(await page.$$('#paperTodo .pt-row')).length===2);
  /* 第二行是空行，聚焦后按退格应删除该行 */
  await page.evaluate(()=>{
    const rows=document.querySelectorAll('#paperTodo .pt-row .pt-text');rows[1].focus();
    rows[1].dispatchEvent(new KeyboardEvent('keydown',{key:'Backspace',bubbles:true,cancelable:true}));
  });
  await page.waitForTimeout(200);
  ok('D4 空行退格删除该行',(await page.$$('#paperTodo .pt-row')).length===1);
  /* 自动换行：长文本应撑高 textarea */
  let longT='这是一段非常非常长的待办事项内容'.repeat(12);
  let h1=await page.$eval('#paperTodo .pt-text',e=>e.getBoundingClientRect().height);
  await page.fill('#paperTodo .pt-text',longT);
  await page.waitForTimeout(200);
  let h2=await page.$eval('#paperTodo .pt-text',e=>e.getBoundingClientRect().height);
  ok('D5 长文本自动换行增高',h2>h1+10);
  /* 勾选 */
  await page.fill('#paperTodo .pt-text','需要勾选的事项');
  await page.click('#paperTodo .pt-row .tc');
  await page.waitForTimeout(200);
  ok('D6 勾选后划线完成',await page.$eval('#paperTodo .pt-row .tc',e=>e.classList.contains('done')));

  /* ---- D7/D8/D9 附件 ---- */
  let id4=await makeNote({title:'附件测试'});
  await openEdit(id4);
  async function addFile(name,mime){
    const cp=page.waitForEvent('filechooser');
    await page.evaluate(()=>window.__app.pickPaperFile());
    const ch=await cp;
    await ch.setFiles({name,mimeType:mime,buffer:Buffer.from('FAKEFILECONTENT-'+name)});
    await page.waitForTimeout(500);
  }
  await addFile('需求文档.docx','application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  ok('D7 Word 可插入',await page.$eval('#paperAttach',e=>/需求文档/.test(e.innerHTML)));
  await addFile('数据表格.xlsx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  ok('D7 Excel 可插入',(await page.$$('#paperAttach .pa-card')).length>=2);
  await addFile('说明.pdf','application/pdf');
  ok('D7 PDF 可插入',(await page.$$('#paperAttach .pa-card')).length>=3);
  let idxAndRef=await page.evaluate(()=>{
    const n=window.__app.cur();
    const visible=n.files.filter(f=>!f.hidden&&f.kind!=='image');
    const hasIdx=visible.every(f=>f.idx>0);
    const refs=[...document.querySelectorAll('#paperBody .attref')].map(s=>s.getAttribute('data-fid'));
    const allLinked=visible.every(f=>refs.includes(f.id));
    return hasIdx&&allLinked;
  });
  ok('D8 附件有序号且正文有位置索引',idxAndRef);
  /* 删除最后一个附件，应级联移除正文标记 */
  const beforeDel=await page.$$('#paperAttach .pa-card');
  await page.click('#paperAttach .pa-card:last-child .pa-del');
  await page.waitForTimeout(300);
  const afterDel=await page.$$('#paperAttach .pa-card');
  ok('D9 删除附件后卡片减少',afterDel.length===beforeDel.length-1);
  let dangling=await page.evaluate(()=>{
    const n=window.__app.cur();
    const ids=new Set(n.files.map(f=>f.id));
    return [...document.querySelectorAll('#paperBody .attref')].some(s=>!ids.has(s.getAttribute('data-fid')));
  });
  ok('D9 无悬空附件标记',!dangling);

  /* ---- D10 撤销 / 重做 ---- */
  let id5=await makeNote({title:'撤销测试'});
  await openEdit(id5);
  ok('D10 工具条提供撤销钮',await page.$('#prUndo')!==null);
  ok('D10 工具条提供重做钮',await page.$('#prRedo')!==null);
  let d10=await page.evaluate(()=>{
    const b=document.querySelector('#paperBody');
    const r=document.createRange();r.selectNodeContents(b);
    const s=getSelection();s.removeAllRanges();s.addRange(r);
    const P=window.__app;
    P.prExec('bold');
    const afterBold=/<b>|<strong>|font-weight:\s*bold/.test(b.innerHTML);
    const boldHtml=b.innerHTML.slice(0,140);
    P.prExec('undo');
    const afterUndo=/<b>|<strong>|font-weight:\s*bold/.test(b.innerHTML);
    P.prExec('redo');
    const afterRedo=/<b>|<strong>|font-weight:\s*bold/.test(b.innerHTML);
    return {afterBold,afterUndo,afterRedo,boldHtml,redoHtml:b.innerHTML.slice(0,140)};
  });
  console.log('D10DBG',JSON.stringify(d10));
  ok('D10 加粗→撤销→重做正确',d10.afterBold&&!d10.afterUndo&&d10.afterRedo);

  /* ---- D11 撤销原地进行、不跳到底部 ---- */
  let id6=await makeNote({title:'撤销滚动',
    content:Array.from({length:40},(_,i)=>'<p>第'+i+'段，这是用于撑高页面的文字内容内容内容</p>').join('')});
  await openEdit(id6);
  const scrollInfo=await page.evaluate(()=>{
    const b=document.querySelector('#paperBody'),sb=document.querySelector('#paperScroll');
    const max=sb.scrollHeight-sb.clientHeight;
    sb.scrollTop=Math.floor(max/2);const mid=sb.scrollTop;
    const ps=b.querySelectorAll('p'),target=ps[Math.floor(ps.length*0.5)];
    const r=document.createRange();r.selectNodeContents(target);
    const s=getSelection();s.removeAllRanges();s.addRange(r);
    window.__app.prExec('bold');
    window.__app.undo();
    return {mid,afterUndo:sb.scrollTop,max};
  });
  ok('D11 撤销后保持原地（不跳到底部）',
    Math.abs(scrollInfo.afterUndo-scrollInfo.mid)<80&&scrollInfo.afterUndo<scrollInfo.max-80);

  let pass=0;R.forEach(([n,c])=>{console.log((c?'PASS':'FAIL')+' | '+n);if(c)pass++;});
  console.log('\n编辑器验收 '+pass+'/'+R.length);
  console.log('console错误:',errs.length?errs:'无');
  await browser.close();
  process.exit(pass===R.length?0:1);
})();
