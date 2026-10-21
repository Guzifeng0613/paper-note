const {chromium}=require('playwright');
const EXE='/opt/vm/preinstall/ms-playwright/chromium_headless_shell-1169/chrome-linux/headless_shell';
const URL0='file:///home/user/Doubao/chats/38443854002369026/notes-app/index.html';
let pass=0,fail=0;const issues=[];
function ok(c,m){if(c){pass++;console.log('PASS |',m);}else{fail++;console.log('FAIL |',m);issues.push(m);}}
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:EXE});
  const page=await browser.newPage({viewport:{width:390,height:844}});
  page.on('pageerror',e=>issues.push('PAGEERROR:'+e.message));
  await page.goto(URL0);
  await page.waitForFunction(()=>window.__app);
  await page.waitForTimeout(600);
  const A=()=>window.__app;
  const firstId=await page.evaluate(()=>window.__app.notes.find(n=>!n.trashed).id);

  /* 1. 置顶（先确保目标未置顶，避免初始状态干扰） */
  await page.evaluate(id=>{const n=window.__app.notes.find(x=>x.id===id);n.pinned=false;window.__app.persist();},firstId);
  await page.evaluate(id=>window.__app.enterSelect(id),firstId);
  await page.waitForSelector('#contextBar.show');
  await page.click('#bbPin');await page.waitForTimeout(300);
  ok(await page.evaluate(id=>window.__app.notes.find(n=>n.id===id).pinned===true,firstId),
     '1a 置顶后 pinned=true');
  /* 取消置顶 */
  await page.evaluate(id=>window.__app.enterSelect(id),firstId);
  await page.waitForSelector('#contextBar.show');
  await page.click('#bbPin');await page.waitForTimeout(300);
  ok(await page.evaluate(id=>!window.__app.notes.find(n=>n.id===id).pinned,firstId),
     '1b 再次操作取消置顶');

  /* 2. 批量颜色：选两张（第二张走 UI 选择圈） */
  const twoIds=await page.evaluate(()=>window.__app.notes.filter(n=>!n.trashed).slice(0,2).map(n=>n.id));
  await page.evaluate(ids=>window.__app.enterSelect(ids[0]),twoIds);
  await page.waitForSelector('#contextBar.show');
  await page.click('.note-card[data-id="'+twoIds[1]+'"] .sel-circle');
  await page.waitForTimeout(200);
  await page.click('#bbColor');
  await page.waitForSelector('#modal.show');
  const colorVal=await page.$eval('.color-dot',d=>d.dataset.c);
  await page.click('.color-dot >> nth=0');await page.waitForTimeout(300);
  ok(await page.evaluate(arg=>{const A=window.__app;
    return arg.ids.every(id=>A.notes.find(n=>n.id===id).color===arg.colorVal);},{ids:twoIds,colorVal}),
     '2 批量改色后两张颜色一致 ('+colorVal+')');
  await page.evaluate(()=>location.hash='#/home');await page.waitForTimeout(300);

  /* 3. 回收站：还原 */
  const restId=await page.evaluate(()=>window.__app.notes.find(n=>!n.trashed).id);
  await page.evaluate(id=>window.__app.moveToTrash([id]),restId);
  await page.evaluate(()=>location.hash='#/trash');
  await page.waitForSelector('#scr-trash.active');await page.waitForTimeout(400);
  await page.click('.trash-row[data-id="'+restId+'"] .trash-restore');
  await page.waitForTimeout(300);
  ok(await page.evaluate(id=>window.__app.notes.find(n=>n.id===id).trashed===false,restId),
     '3 回收站还原成功');

  /* 4. 回收站：彻底删除 */
  const delId=await page.evaluate(()=>window.__app.notes.find(n=>!n.trashed).id);
  await page.evaluate(id=>window.__app.moveToTrash([id]),delId);
  await page.waitForTimeout(200);
  await page.evaluate(()=>window.__app.renderTrash());
  await page.waitForTimeout(300);
  await page.click('.trash-row[data-id="'+delId+'"] .trash-forever');
  await page.waitForSelector('#modal.show');
  await page.click('#tfOk');await page.waitForTimeout(500);
  ok(await page.evaluate(id=>!window.__app.notes.find(n=>n.id===id),delId),
     '4 彻底删除后便签不存在');

  /* 5. 搜索：取一个确定存在的标题关键词 */
  const kw=await page.evaluate(()=>{const n=window.__app.notes.find(x=>!x.trashed&&x.title);
    return n?n.title.slice(0,2):null;});
  await page.evaluate(()=>location.hash='#/home');await page.waitForTimeout(300);
  await page.evaluate(()=>location.hash='#/search');
  await page.waitForSelector('#scr-search.active');await page.waitForTimeout(300);
  await page.fill('#srInput',kw);await page.waitForTimeout(500);
  const res=await page.$$eval('#srBody [data-id], #srBody .sr-item, #srBody >*',e=>e.length);
  ok(res>0,'5 搜索「'+kw+'」有结果 ('+res+')');

  /* 6. 笔记本筛选 */
  await page.evaluate(()=>location.hash='#/home');await page.waitForTimeout(300);
  await page.evaluate(()=>{const A=window.__app;
    if(!(A.prefs.notebooks||[]).includes('筛选测试本'))A.prefs.notebooks=(A.prefs.notebooks||[]).concat('筛选测试本');
    const n=A.notes.find(x=>!x.trashed);n.notebook='筛选测试本';
    A.persist();A.persistPrefs();A.renderChips();});
  await page.evaluate(()=>window.__app.setNbFilter('筛选测试本'));
  await page.waitForTimeout(400);
  const vis=await page.evaluate(()=>window.__app.visibleNotes());
  ok(vis.length>=1&&vis.every(n=>n.notebook==='筛选测试本'),'6 笔记本筛选只显示该本便签');
  await page.evaluate(()=>window.__app.setNbFilter(null));await page.waitForTimeout(300);

  /* 7. 视图持久化 */
  await page.evaluate(()=>location.hash='#/settings');
  await page.waitForSelector('#scr-settings.active');await page.waitForTimeout(300);
  await page.click('[data-t="list"]');await page.waitForTimeout(300);
  ok(await page.evaluate(()=>window.__app.prefs.view==='list'),'7a 切换到列表视图');
  await page.goto(URL0);await page.waitForFunction(()=>window.__app);await page.waitForTimeout(500);
  ok(await page.evaluate(()=>window.__app.prefs.view==='list'),'7b 重载后仍为列表视图');
  await page.evaluate(()=>location.hash='#/settings');
  await page.waitForSelector('#scr-settings.active');await page.waitForTimeout(300);
  await page.click('[data-t="grid"]');await page.waitForTimeout(300);

  /* 8. 空标题便签 */
  await page.evaluate(()=>location.hash='#/home');await page.waitForTimeout(300);
  await page.click('#fab');await page.waitForSelector('#scr-edit.active');await page.waitForTimeout(300);
  await page.click('#paperBody');await page.keyboard.type('只有正文没有标题的便签');
  await page.click('#editBack');await page.waitForSelector('#scr-home.active');await page.waitForTimeout(400);
  const untitled=await page.evaluate(()=>{const n=window.__app.notes.find(x=>!x.trashed&&/只有正文没有标题/.test(x.content||''));
    if(!n)return null;const card=document.querySelector('.note-card[data-id="'+n.id+'"]');
    return card?card.innerText.slice(0,20):null;});
  ok(untitled!==null,'8 无标题便签仍出现在列表: '+(untitled||''));

  /* 9. 待办进度（点"添加一项"插入空行，在 textarea.pt-text 输入） */
  await page.click('#fab');await page.waitForSelector('#scr-edit.active');await page.waitForTimeout(300);
  await page.fill('#paperTitle','待办进度测试');
  await page.click('#dockTodo');await page.waitForTimeout(300);   /* 第一空行聚焦 */
  await page.keyboard.type('第一项任务');
  await page.click('.pt-addrow');await page.waitForTimeout(300);  /* 第二空行聚焦 */
  await page.keyboard.type('第二项任务');
  await page.click('.pt-row[data-i="0"] .tc');                    /* 勾选第一条 */
  await page.waitForTimeout(300);
  const todo=await page.evaluate(()=>{const n=window.__app.notes.find(x=>x.title==='待办进度测试');
    const done=(n.todos||[]).filter(t=>t.done).length;return {total:(n.todos||[]).length,done};});
  ok(todo.total>=2&&todo.done===1,'9 待办进度正确 '+todo.done+'/'+todo.total);

  console.log('\n边界探测 '+pass+'/'+(pass+fail));
  console.log('问题:',issues.length?issues:'无');
  await browser.close();
  process.exit(fail?1:0);
})();
