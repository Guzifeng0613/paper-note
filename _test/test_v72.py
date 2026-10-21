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

    # ---- 待办：回车新增、自动换行 ----
    pg.evaluate("()=>window.__app.createNote('todo')");time.sleep(0.6)
    n0=len(pg.query_selector_all('#paperTodo textarea.pt-text'))
    tb=pg.query_selector('#paperTodo .pt-row:nth-child(2) textarea.pt-text')
    tb.focus();tb.press('Enter');time.sleep(0.4)
    n1=len(pg.query_selector_all('#paperTodo textarea.pt-text'))
    check('回车新增下一条待办',n1==n0+1,f'{n0}->{n1}')
    longtext='这是一段很长很长的待办事项内容用来验证自动换行是否正常工作哦'*4
    pg.fill('#paperTodo .pt-row:nth-child(2) textarea.pt-text',longtext);time.sleep(0.4)
    h=pg.evaluate("()=>document.querySelector('#paperTodo .pt-row:nth-child(2) textarea.pt-text').offsetHeight")
    check('长待办自动换行增高',h>40,h)
    wh=pg.evaluate("()=>getComputedStyle(document.querySelector('#paperTodo textarea.pt-text')).whiteSpace")
    check('允许换行(pre-wrap)',wh=='pre-wrap',wh)

    # ---- 图片：data-id、content 无 src、idx ----
    pg.evaluate("()=>window.__app.createNote('note')");time.sleep(0.6)
    with pg.expect_file_chooser() as fc:
        pg.evaluate("()=>window.__app.pickPaperImage()")
    fc.value.set_files(FIX+'photo.png');time.sleep(1.0)
    imginfo=pg.evaluate("""()=>{
      var n=window.__app.cur();
      var d=document.createElement('div');d.innerHTML=n.content;
      var im=d.querySelector('img.note-img');
      return {hasId:!!(im&&im.getAttribute('data-id')),
              noSrc:!!(im&&!im.getAttribute('src')),
              fileIdx:n.files[0]&&n.files[0].idx,
              kind:n.files[0]&&n.files[0].kind};
    }""")
    check('图片以data-id记录位置',imginfo['hasId'],imginfo)
    check('保存内容不含图片src(Blob独立)',imginfo['noSrc'],imginfo)
    check('图片带idx序号',imginfo['fileIdx']==1,imginfo)
    imgcards=pg.evaluate("()=>document.querySelectorAll('#paperAttach .pa-card').length")
    check('图片不在附件卡片重复',imgcards==0,imgcards)

    # ---- 附件 idx 递增 + 卡片序号 ----
    for f in ['report.pdf','doc.docx','sheet.xlsx']:
        with pg.expect_file_chooser() as fc:
            pg.evaluate("()=>window.__app.pickPaperFile()")
        fc.value.set_files(FIX+f);time.sleep(0.8)
    idxs=pg.evaluate("()=>window.__app.cur().files.map(f=>f.idx)")
    check('附件idx连续递增',idxs==[1,2,3,4],idxs)
    cardidx=pg.evaluate("()=>[...document.querySelectorAll('#paperAttach .pa-idx')].map(e=>e.textContent)")
    check('卡片显示序号02/03/04',cardidx==['02','03','04'],cardidx)
    cardcount=pg.evaluate("()=>document.querySelectorAll('#paperAttach .pa-card').length")
    check('附件卡片只列3个非图片',cardcount==3,cardcount)

    check('全程无pageerror',len(pageerrs)==0,pageerrs)

    print('\n'+'='*60)
    fails=0
    for name,st,det in R:
        print(f'[{st}] {name}'+(('  -> '+det) if st=='FAIL' else ''))
        if st=='FAIL':fails+=1
    print('='*60)
    print(f'TOTAL {len(R)}  PASS {len(R)-fails}  FAIL {fails}')
