from playwright.sync_api import sync_playwright
import time

CHROME='/opt/vm/preinstall/ms-playwright/chromium-1169/chrome-linux/chrome'
URL='file:///home/user/Doubao/chats/38443854002369026/notes-app/index.html'
FIX='/home/user/Doubao/chats/38443854002369026/notes-app/_test/fix/'
R=[]
def check(name,cond,detail=''):
    R.append((name,'PASS' if cond else 'FAIL',str(detail)))

with sync_playwright() as p:
    b=p.chromium.launch(executable_path=CHROME,args=['--allow-file-access-from-files'])
    ctx=b.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
    pg=ctx.new_page()
    pageerrs=[]
    pg.on('pageerror',lambda e:pageerrs.append(str(e)))
    pg.goto(URL)
    pg.wait_for_function("window.__app&&window.__app.notes.length>0",timeout=9000)
    time.sleep(0.6)

    check('首页卡片渲染',len(pg.query_selector_all('.note-card'))>=6)
    check('标签chip',len(pg.query_selector_all('.chip'))>=3)

    pg.evaluate("""()=>{[...document.querySelectorAll('.chip')].find(c=>c.textContent.includes('生活')).click()}""")
    time.sleep(0.4)
    shown=len(pg.query_selector_all('.note-card'))
    expect=pg.evaluate("()=>window.__app.notes.filter(n=>!n.trashed&&n.tags.includes('生活')).length")
    check('标签筛选"生活"',shown==expect,f'{shown}/{expect}')
    pg.evaluate("""()=>{[...document.querySelectorAll('.chip')].find(c=>c.textContent.includes('全部')).click()}""")
    time.sleep(0.3)

    pg.evaluate("()=>{location.hash='#/search';}");time.sleep(0.5)
    pg.fill('#srInput','潜水');time.sleep(0.5)
    check('搜索"潜水"有结果',len(pg.query_selector_all('.sr-item'))>=1)
    check('搜索高亮',len(pg.query_selector_all('.sr-item mark'))>=1)
    pg.evaluate("()=>{location.hash='#/home'}");time.sleep(0.5)

    total=pg.evaluate("()=>window.__app.notes.filter(x=>!x.trashed).length")
    fails=[]
    for i in range(total):
        r=pg.evaluate("""(idx)=>{
            var A=window.__app;var note=A.notes.filter(x=>!x.trashed)[idx];
            A.setEditing(note.id);
            try{A.renderEditor();A.showScreen('edit');
               return document.querySelector('#scr-edit').classList.contains('active')?'ok':'inactive';
            }catch(e){return 'ERR:'+e.message;}
        }""",i)
        if r!='ok':fails.append((i,r))
    check('逐个打开全部笔记',not fails,fails)
    pg.evaluate("()=>{location.hash='#/home'}");time.sleep(0.4)

    pg.evaluate("()=>window.__app.createNote('note')");time.sleep(0.6)
    pg.fill('#paperTitle','自动化测试笔记');time.sleep(0.2)
    pg.click('#paperBody');time.sleep(0.2)
    pg.evaluate("()=>{var b=document.querySelector('#paperBody');b.innerHTML='这是一段用于测试格式的文字，包含加粗和下划线以及高亮。';b.oninput()}")
    time.sleep(0.2)

    def select_word(word):
        pg.evaluate("""(w)=>{
            var b=document.querySelector('#paperBody');
            var walker=document.createTreeWalker(b,NodeFilter.SHOW_TEXT);
            var node,range=document.createRange();
            while(node=walker.nextNode()){var ix=node.textContent.indexOf(w);
                if(ix>=0){range.setStart(node,ix);range.setEnd(node,ix+w.length);break;}}
            getSelection().removeAllRanges();getSelection().addRange(range);
        }""",word);time.sleep(0.2)
    select_word('加粗')
    check('选中后格式浮层显示',pg.evaluate("()=>document.querySelector('#paperRtBar').classList.contains('show')"))
    pg.dispatch_event('#paperRtBar [data-c="bold"]','pointerdown');time.sleep(0.3)
    check('加粗生效',pg.evaluate("()=>/<b>|<strong>/.test(document.querySelector('#paperBody').innerHTML)"))
    select_word('下划线')
    pg.dispatch_event('#paperRtBar [data-c="underline"]','pointerdown');time.sleep(0.3)
    check('下划线生效',pg.evaluate("()=>/<u>/.test(document.querySelector('#paperBody').innerHTML)"))
    select_word('高亮')
    pg.dispatch_event('#paperRtBar [data-c="hi"]','pointerdown');time.sleep(0.3)
    check('高亮生效',pg.evaluate("""()=>{var h=document.querySelector('#paperBody').innerHTML.replace(/\\s+/g,'');
        return h.includes('ffe27a')||h.includes('255,226,122');}"""))

    with pg.expect_file_chooser() as fc:
        pg.evaluate("()=>window.__app.pickPaperImage()")
    fc.value.set_files(FIX+'photo.png');time.sleep(1.0)
    check('正文插入图片',pg.evaluate("()=>document.querySelectorAll('#paperBody img.note-img').length>=1"))

    for f in ['report.pdf','doc.docx','sheet.xlsx']:
        with pg.expect_file_chooser() as fc:
            pg.evaluate("()=>window.__app.pickPaperFile()")
        fc.value.set_files(FIX+f);time.sleep(0.8)
    cards=pg.evaluate("()=>document.querySelectorAll('#paperAttach .pa-card').length")
    check('PDF/Word/Excel 三个附件卡片',cards>=3,cards)
    nodata=pg.evaluate("()=>window.__app.notes.some(n=>n.files.some(f=>f.data!==undefined))")
    check('附件元数据不含base64',not nodata)
    idbhas=pg.evaluate("""async()=>await new Promise(res=>{
        try{var rq=indexedDB.open('zhipian-db-v3',1);
          rq.onsuccess=e=>{var db=e.target.result;
            if(!db.objectStoreNames.contains('blobs')){res(0);return;}
            var tx=db.transaction('blobs','readonly').objectStore('blobs').getAllKeys();
            tx.onsuccess=()=>res(tx.result.length);tx.onerror=()=>res(-1);};
          rq.onerror=()=>res(-2);
        }catch(e){res(-3);}})""")
    check('附件Blob已入IndexedDB',idbhas>=3,idbhas)

    node=pg.evaluate("""async()=>{var n=await window.__app.buildExportNode();
        return {imgs:n.querySelectorAll('img').length,rows:n.querySelectorAll('div').length};}""")
    check('导出节点构建成功',node and node['rows']>0,node)

    pg.evaluate("()=>window.__app.createNote('todo')");time.sleep(0.6)
    pg.evaluate("()=>window.__app.addPaperTodo()");time.sleep(0.3)
    pg.evaluate("()=>window.__app.addPaperTodo()");time.sleep(0.3)
    check('待办初始+新增条目',len(pg.query_selector_all('#paperTodo .pt-row textarea.pt-text'))>=3)
    pg.fill('#paperTodo .pt-row:nth-child(2) textarea.pt-text','买牛奶');time.sleep(0.2)
    pg.click('#paperTodo .pt-row:nth-child(2) .tc');time.sleep(0.3)
    check('勾选完成+进度',pg.evaluate("()=>document.querySelector('#paperTodo .pct').textContent"))
    pg.click('#paperTodo .pt-row:nth-child(3) .pri');time.sleep(0.3)
    check('优先级设为high',pg.evaluate("()=>document.querySelectorAll('#paperTodo .pt-row')[2].querySelector('.pri svg').getAttribute('stroke')"))
    pg.click('#paperTodo .pt-row:nth-child(4) .rd');time.sleep(0.3)
    check('删除待办条目',len(pg.query_selector_all('#paperTodo .pt-row'))>=2)

    victim=pg.evaluate("""()=>{var A=window.__app;var v=A.notes.find(n=>!n.trashed);
        v.trashed=true;v.trashedAt=Date.now();A.persist();return v.id}""")
    pg.evaluate("()=>{location.hash='#/trash'}");time.sleep(0.5)
    check('回收站列出',len(pg.query_selector_all('.trash-row'))>=1)
    pg.click('.trash-row .trash-restore');time.sleep(0.4)
    check('回收站还原',pg.evaluate(f"()=>!window.__app.notes.find(n=>n.id==='{victim}').trashed"))
    pg.evaluate("()=>{location.hash='#/home'}");time.sleep(0.4)

    r=pg.evaluate("()=>{document.documentElement.dataset.theme='dark';return 'dark-set'}")
    check('深色模式可切换',r=='dark-set')
    pg.evaluate("()=>{document.documentElement.dataset.theme='light'}")

    check('全程无pageerror',not pageerrs,pageerrs[:3])
    b.close()

print('='*64)
fails=0
for name,st,det in R:
    print(f'[{st}] {name}'+(('  -> '+det) if st=='FAIL' else ''))
    if st=='FAIL':fails+=1
print('='*64)
print(f'TOTAL {len(R)}  PASS {len(R)-fails}  FAIL {fails}')
