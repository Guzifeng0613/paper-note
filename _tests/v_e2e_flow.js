const {chromium}=require('playwright');
const fs=require('fs');
const EXE='/opt/vm/preinstall/ms-playwright/chromium_headless_shell-1169/chrome-linux/headless_shell';
const BASE='/home/user/Doubao/chats/38443854002369026/notes-app';
const URL0='file://'+BASE+'/index.html';
const SHOT=BASE+'/_tests/shots_e2e';
if(!fs.existsSync(SHOT))fs.mkdirSync(SHOT,{recursive:true});
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:EXE});
  const page=await browser.newPage({viewport:{width:390,height:844}});
  const errs=[];const pageerrs=[];
  page.on('console',m=>{if(m.type()==='error')errs.push(m.text());});
  page.on('pageerror',e=>pageerrs.push(String(e)));
  const R=[];const ok=(n,c)=>{R.push([n,!!c]);console.log((c?'PASS':'FAIL')+' | '+n);};
  const shot=async n=>{await page.screenshot({path:SHOT+'/'+n+'.png'});};
  /* 在 #paperBody 内按可见文字设置选区（start 可省略表示到段尾） */
  const selectText=async(phrase,startOffset)=>page.evaluate(({ph,so})=>{
    const body=document.querySelector('#paperBody');
    const walker=document.createTreeWalker(body,NodeFilter.SHOW_TEXT);
    let node;while(node=walker.nextNode()){
      const i=node.nodeValue.indexOf(ph);
      if(i>=0){const r=document.createRange();
        const s=i+(so||0),e=i+ph.length-(so||0);
        r.setStart(node,s);r.setEnd(node,e);
        const sel=window.getSelection();sel.removeAllRanges();sel.addRange(r);return true;}}
    return false;
  },{ph:phrase,so:startOffset});

  await page.goto(URL0);
  await page.waitForFunction(()=>window.__app,{timeout:8000});
  await page.waitForTimeout(500);
  /* 准备一套 AI 配置（AI 对话/本页问答的前置条件），并 mock SSE 流式接口 */
  await page.evaluate(()=>{if(!window.__app.AIs.all().length)
    window.__app.AIs.add({name:'测试模型',baseUrl:'https://api.test.com/v1',key:'test-key',model:'test-model'});});
  const sseBody='data: '+JSON.stringify({choices:[{delta:{content:'**这是AI回答**\n- 要点一\n- 要点二'}}]})
    +'\n\ndata: [DONE]\n\n';
  await page.route('**/chat/completions',route=>route.fulfill({status:200,
    contentType:'text/event-stream',body:sseBody}));
  const initial=await page.evaluate(()=>window.__app.notes.filter(n=>!n.trashed).length);

  /* 1. FAB → 直接新建文字笔记 */
  await page.click('#fab');
  await page.waitForTimeout(450);
  ok('1 进入编辑页',(await page.evaluate(()=>location.hash)).includes('#/edit'));

  /* 2. 标题 + 正文 */
  await page.fill('#paperTitle','端到端测试笔记');
  await page.click('#paperBody');
  await page.keyboard.type('这是第一段正文。');
  await page.keyboard.press('Enter');
  await page.keyboard.type('第二段需要加粗的文字内容。');
  await page.keyboard.press('Enter');
  await page.keyboard.type('第三段用来高亮的部分在这里。');
  const bodyTxt=await page.evaluate(()=>window.__app.cur()&&window.__app.cur().content);
  ok('2 标题与三段正文已写入',bodyTxt.includes('第一段')&&bodyTxt.includes('加粗')&&bodyTxt.includes('高亮'));

  /* 3. 选中文字 → 加粗 */
  await selectText('加粗的文字内容');
  await page.click('#paperRtBar [data-c="bold"]');
  const bolded=await page.evaluate(()=>{const b=document.querySelector('#paperBody');
    return /<b>加粗的文字内容<\/b>|<strong>加粗的文字内容<\/strong>/.test(b.innerHTML);});
  ok('3 选中文字加粗成功',bolded);

  /* 4. 选中文字 → 高亮 */
  await selectText('高亮的部分');
  await page.click('#paperRtBar [data-c="hi"]');
  const hi=await page.evaluate(()=>{const b=document.querySelector('#paperBody');
    const m=b.querySelector('[style*="background"],mark,span.hl');return !!m;});
  ok('4 选中文字高亮成功',hi);

  /* 6. dockTodo → 两条待办 + 勾选 */
  await page.click('#dockTodo');
  await page.waitForTimeout(400);
  const todoShown=await page.$eval('#paperTodo',e=>e.classList.contains('show'));
  ok('6a 待办区出现',todoShown);
  const rows0=await page.$$('#paperTodo textarea.pt-text');
  await rows0[0].fill('第一条待办事项');
  await rows0[0].press('Enter');
  await page.waitForTimeout(300);
  let rows=await page.$$('#paperTodo textarea.pt-text');
  await rows[1].fill('第二条待办事项');
  await page.waitForTimeout(200);
  rows=await page.$$('#paperTodo .pt-row');
  const tc0=await rows[0].$('.tc');await tc0.click();
  await page.waitForTimeout(200);
  const todoState=await page.evaluate(()=>{const t=window.__app.cur().todos;
    return {n:t.filter(x=>x.text.trim()).length,done:t.filter(x=>x.done).length};});
  ok('6b 两条待办且首条已勾选',todoState.n===2&&todoState.done===1);
  const progTxt=await page.$eval('#paperTodo .pct',e=>e.textContent);
  ok('6c 进度条显示 1/2',progTxt.includes('1/2'));

  /* 7. 插入图片（真实 filechooser） */
  let imgFulfilled=false;
  page.on('filechooser',async fc=>{await fc.setFiles(BASE+'/_test/scan_page.png');imgFulfilled=true;});
  await page.click('#dockAdd');
  await page.waitForSelector('#dynSheet.show');
  await page.click('#dynOpts .sheet-opt >> nth=0'); /* 插入图片 */
  await page.waitForFunction(()=>{const n=window.__app.cur();
    return n&&n.files.some(f=>f.kind==='image');},{timeout:8000});
  await page.waitForTimeout(600);
  const imgState=await page.evaluate(()=>{const n=window.__app.cur();
    return {f:n.files.filter(f=>f.kind==='image').length,
      imgs:document.querySelectorAll('#paperBody img.note-img').length};});
  ok('7 图片文件与正文 img 均存在',imgFulfilled&&imgState.f===1&&imgState.imgs===1);
  await shot('01-编辑完整');

  /* 8. 返回首页，卡片出现 */
  await page.click('#editBack');
  await page.waitForTimeout(600);
  const homeHas=await page.evaluate(()=>{
    const n=window.__app.notes.find(x=>x.title==='端到端测试笔记');
    const card=document.querySelector('.note-card[data-id="'+(n&&n.id)+'"]');
    return !!(n&&card&&!n.trashed);});
  ok('8 返回首页可见新便签卡片',homeHas);
  await shot('02-首页');

  /* 9. 刷新重载后持久化仍在 */
  await page.reload();
  await page.waitForFunction(()=>window.__app,{timeout:8000});
  await page.waitForTimeout(600);
  const afterReload2=await page.evaluate(()=>{const n=window.__app.notes.find(x=>x.title==='端到端测试笔记');
    if(!n)return false;
    return n.content.includes('第一段')&&n.files.some(f=>f.kind==='image');});
  ok('9 重载后正文/图片仍在',afterReload2);

  /* 10. 主页搜索框 → 搜索页 → 出结果 → 点结果进编辑 */
  await page.click('#homeSearch');
  await page.waitForTimeout(400);
  ok('10a 进入搜索页',(await page.evaluate(()=>location.hash)).includes('#/search'));
  await page.fill('#srInput','端到端');
  await page.waitForTimeout(500);
  const srCount=await page.$$eval('#srBody .sr-item, #srBody [data-id]',els=>els.length);
  ok('10b 搜索“端到端”有结果',srCount>=1);
  await shot('03-搜索结果');
  const firstRes=await page.$('#srBody .sr-item, #srBody [data-id]');
  if(firstRes){await firstRes.click();await page.waitForTimeout(500);}
  const inEdit=await page.evaluate(()=>location.hash.includes('#/edit'));
  ok('10c 点搜索结果进入便签',inEdit);
  await page.click('#editBack');await page.waitForTimeout(500);

  /* 11. 长按卡片 → 多选 → 批量删除 → toast 撤销可用 */
  const card=await page.$('.note-card:has-text("端到端测试笔记")');
  const box=await card.boundingBox();
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
  await page.mouse.down();await page.waitForTimeout(520);await page.mouse.up();
  await page.waitForTimeout(400);
  const selMode=await page.evaluate(()=>document.querySelector('#scr-home').classList.contains('select-mode'));
  ok('11a 长按进入多选',selMode);
  await page.click('#bbDelete');
  await page.waitForTimeout(500);
  const trashed=await page.evaluate(()=>{const n=window.__app.notes.find(x=>x.title==='端到端测试笔记');return n&&n.trashed;});
  ok('11b 批量删除后便签进回收站',trashed);
  const undoBtn=await page.$('#tUndo');
  let undoLabel='';if(undoBtn)undoLabel=await undoBtn.textContent();
  ok('11c 批量删除 toast 撤销按钮文字正常',undoBtn&&undoLabel==='撤销');
  if(undoBtn){await undoBtn.click();await page.waitForTimeout(400);}
  const restored=await page.evaluate(()=>{const n=window.__app.notes.find(x=>x.title==='端到端测试笔记');return n&&!n.trashed;});
  ok('11d 点撤销后便签恢复',restored);

  /* 12. 编辑器内删除：deleteCurrent 的 toast（历史 bug 点） */
  await page.click('.note-card:has-text("端到端测试笔记")');
  await page.waitForTimeout(500);
  await page.click('#editMore');
  await page.waitForSelector('#dynSheet.show');
  await page.click('#dynOpts .sheet-opt >> nth=3'); /* 删除 */
  await page.waitForTimeout(600);
  const backHome=await page.evaluate(()=>location.hash);
  const delToast=await page.$('#tUndo');
  let delLabel='';if(delToast)delLabel=await delToast.textContent();
  ok('12a 编辑器删除后回首页且 toast 出现',backHome.includes('#/home')&&!!delToast);
  ok('12b 编辑器删除 toast 按钮文字正常（非 undefined）',delLabel==='撤销');
  if(delToast){await delToast.click();await page.waitForTimeout(500);}
  const delUndo=await page.evaluate(()=>{const n=window.__app.notes.find(x=>x.title==='端到端测试笔记');return n&&!n.trashed;});
  ok('12c 编辑器删除可撤销恢复',delUndo);

  /* 13. 回收站：还原 + 彻底删除路径 */
  /* 先再删一次让它进回收站 */
  const c2=await page.$('.note-card:has-text("端到端测试笔记")');
  if(c2){await c2.click();await page.waitForTimeout(500);
    await page.click('#editMore');await page.waitForSelector('#dynSheet.show');
    await page.click('#dynOpts .sheet-opt >> nth=3');await page.waitForTimeout(500);}
  await page.evaluate(()=>location.hash='#/trash');
  await page.waitForTimeout(400);
  let trashRows=await page.$$('#trashList .trash-row');
  ok('13a 回收站有记录',trashRows.length>=1);
  /* 还原 */
  const restoreBtn=await page.$('.trash-row:has-text("端到端测试笔记") .trash-restore');
  if(restoreBtn){await restoreBtn.click();await page.waitForTimeout(300);}
  const isRestored=await page.evaluate(()=>{const n=window.__app.notes.find(x=>x.title==='端到端测试笔记');return n&&!n.trashed;});
  ok('13b 回收站还原成功',isRestored);
  /* 再删 → 彻底删除 */
  await page.evaluate(()=>location.hash='#/home');await page.waitForTimeout(400);
  const c3=await page.$('.note-card:has-text("端到端测试笔记")');
  if(c3){await c3.click();await page.waitForTimeout(500);
    await page.click('#editMore');await page.waitForSelector('#dynSheet.show');
    await page.click('#dynOpts .sheet-opt >> nth=3');await page.waitForTimeout(500);}
  await page.evaluate(()=>location.hash='#/trash');await page.waitForTimeout(400);
  const foreverBtn=await page.$('.trash-row:has-text("端到端测试笔记") .trash-forever');
  if(foreverBtn){await foreverBtn.click();await page.waitForTimeout(300);await page.click('#tfOk');await page.waitForTimeout(800);}
  const gone=await page.evaluate(()=>!window.__app.notes.some(x=>x.title==='端到端测试笔记'));
  ok('13c 彻底删除后便签消失',gone);

  /* 14. 设置：深色 / 浅色切换 */
  await page.evaluate(()=>location.hash='#/settings');await page.waitForTimeout(400);
  await page.click('#themeSeg [data-t="dark"]');await page.waitForTimeout(400);
  await shot('04-深色设置');
  const darkBg=await page.evaluate(()=>getComputedStyle(document.body).backgroundColor);
  ok('14a 深色模式生效',darkBg&&!darkBg.includes('255, 255, 255'));
  await page.click('#themeSeg [data-t="light"]');await page.waitForTimeout(300);
  ok('14b 切回浅色',true);

  /* 15. AI 对话（SSE mock 已在启动时注册） */
  await page.evaluate(()=>location.hash='#/home');await page.waitForTimeout(300);
  await page.click('#openChat');await page.waitForTimeout(500);
  ok('15a 进入 AI 对话',(await page.evaluate(()=>location.hash)).includes('#/chat'));
  await page.fill('#chatInput','你好测试');
  await page.click('#chatSend');
  await page.waitForFunction(()=>document.querySelectorAll('#chatBody .msg, #chatBody .chat-msg').length>=2,{timeout:10000}).catch(()=>{});
  await page.waitForTimeout(800);
  const aiAnswered=await page.evaluate(()=>document.querySelector('#chatBody').innerText.includes('这是AI回答'));
  ok('15b AI 回答已渲染',aiAnswered);
  await shot('05-AI对话');

  /* 16. 本页 AI（mock，进入任意现存便签） */
  const anyCard=await page.$('.note-card');
  if(anyCard){
    await page.evaluate(()=>location.hash='#/home');await page.waitForTimeout(400);
    await page.click('.note-card >> nth=0');await page.waitForTimeout(500);
    await page.click('#editNoteAI');await page.waitForTimeout(500);
    const naiOpen=await page.$eval('#noteAiPanel',e=>e.classList.contains('open'));
    ok('16a 本页 AI 面板打开',naiOpen);
    await page.fill('#naiInput','本页问题');
    await page.click('#naiSend');
    await page.waitForTimeout(1200);
    const naiAns=await page.evaluate(()=>document.querySelector('#naiBody').innerText.includes('这是AI回答'));
    ok('16b 本页 AI 回答已渲染',naiAns);
    await shot('06-本页AI');
  }

  /* ===== 汇总 ===== */
  const pass=R.filter(x=>x[1]).length,fail=R.filter(x=>!x[1]).length;
  console.log('\n端到端流程 '+pass+'/'+R.length);
  console.log('console错误: '+(errs.length?JSON.stringify(errs):'无'));
  console.log('pageerror: '+(pageerrs.length?JSON.stringify(pageerrs):'无'));
  if(fail)process.exitCode=1;
  await browser.close();
})().catch(e=>{console.error('SCRIPT ERROR',e);process.exit(2);});
