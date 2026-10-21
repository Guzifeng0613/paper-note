from playwright.sync_api import sync_playwright
import time

CHROME='/opt/vm/preinstall/ms-playwright/chromium-1169/chrome-linux/chrome'
URL='file:///home/user/Doubao/chats/38443854002369026/notes-app/index.html'
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

    # ---- A. 待办在正文上方 ----
    pg.evaluate("()=>window.__app.createNote('todo')");time.sleep(0.6)
    order=pg.evaluate("""()=>{
      var t=document.querySelector('#paperTodo'),b=document.querySelector('#paperBody');
      return t.compareDocumentPosition(b);
    }""")
    check('待办区在正文上方',order==4,order)

    # ---- B. 进度条开关 ----
    check('默认显示进度条',pg.evaluate("()=>document.querySelectorAll('#paperTodo .pt-progress').length")==1)
    pg.click('#ptProgToggle');time.sleep(0.4)
    check('点眼睛隐藏进度条',pg.evaluate("()=>document.querySelectorAll('#paperTodo .pt-progress').length")==0)
    check('隐藏后开关仍在',pg.evaluate("()=>!!document.querySelector('#ptProgToggle')"))
    pg.click('#ptProgToggle');time.sleep(0.4)
    check('再点恢复进度条',pg.evaluate("()=>document.querySelectorAll('#paperTodo .pt-progress').length")==1)

    # ---- C. 笔记本面板 ----
    pg.evaluate("()=>window.__app.openNotebookPicker()");time.sleep(0.5)
    check('笔记本面板打开',pg.evaluate("()=>document.querySelector('#nbPicker').classList.contains('show')"))
    allcount=int(pg.evaluate("()=>document.querySelector('#nbpAllCount').textContent"))
    check('全部笔记数量>0',allcount>0,allcount)
    rows=pg.evaluate("()=>[...document.querySelectorAll('.nbp-row .nbp-name')].map(e=>e.textContent)")
    check('列出已有笔记本',len(rows)>=4,rows)
    lifeCount=pg.evaluate("""()=>{
      var r=[...document.querySelectorAll('.nbp-row')].find(
        x=>x.querySelector('.nbp-name').textContent==='生活');
      return r?r.querySelector('.nbp-count').textContent:null;
    }""")
    check('笔记本数量显示',lifeCount is not None and int(lifeCount)>=1,lifeCount)
    pg.evaluate("""()=>{
      [...document.querySelectorAll('.nbp-row')].find(
        x=>x.querySelector('.nbp-name').textContent==='生活').click();
    }""");time.sleep(0.5)
    closed=pg.evaluate("()=>!document.querySelector('#nbPicker').classList.contains('show')")
    moved=pg.evaluate("()=>{var n=window.__app.cur();return n.notebook==='生活'&&n.tags.join(',')==='生活';}")
    check('点击笔记本完成移动',closed and moved)
    pg.evaluate("()=>window.__app.openNotebookPicker()");time.sleep(0.5)
    iscur=pg.evaluate("""()=>{
      var r=[...document.querySelectorAll('.nbp-row')].find(
        x=>x.querySelector('.nbp-name').textContent==='生活');
      return r&&r.classList.contains('iscur');
    }""")
    check('当前笔记本显示对勾',iscur)
    pg.click('#nbpAll');time.sleep(0.5)
    removed=pg.evaluate("()=>{var n=window.__app.cur();return !n.notebook&&n.tags.length===0;}")
    check('点全部笔记移出分类',removed)
    pg.evaluate("()=>window.__app.openNotebookPicker()");time.sleep(0.5)
    pg.click('#nbpNew');time.sleep(0.5)
    pg.fill('#newNbInput','旅行');time.sleep(0.2)
    pg.click('#newNbOk');time.sleep(0.5)
    created=pg.evaluate("()=>{var n=window.__app.cur();return n.notebook==='旅行';}")
    check('新建笔记本并移动',created)

    check('全程无pageerror',len(pageerrs)==0,pageerrs)

    print('\n'+'='*60)
    fails=0
    for name,st,det in R:
        print(f'[{st}] {name}'+(('  -> '+det) if st=='FAIL' else ''))
        if st=='FAIL':fails+=1
    print('='*60)
    print(f'TOTAL {len(R)}  PASS {len(R)-fails}  FAIL {fails}')
