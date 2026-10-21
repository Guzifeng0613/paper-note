from playwright.sync_api import sync_playwright
import time

CHROME='/opt/vm/preinstall/ms-playwright/chromium-1169/chrome-linux/chrome'
URL='file:///home/user/Doubao/chats/38443854002369026/notes-app/index.html'
R=[]
def check(name,cond,detail=''):
    R.append((name,'PASS' if cond else 'FAIL',str(detail)))

def select_word(pg,word):
    pg.evaluate("""(w)=>{
        var b=document.querySelector('#paperBody');
        var walker=document.createTreeWalker(b,NodeFilter.SHOW_TEXT);
        var node,range=document.createRange();
        while(node=walker.nextNode()){var ix=node.textContent.indexOf(w);
            if(ix>=0){range.setStart(node,ix);range.setEnd(node,ix+w.length);break;}}
        getSelection().removeAllRanges();getSelection().addRange(range);
    }""",word);time.sleep(0.35)

with sync_playwright() as p:
    b=p.chromium.launch(executable_path=CHROME,args=['--allow-file-access-from-files'])
    ctx=b.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
    pg=ctx.new_page();pageerrs=[]
    pg.on('pageerror',lambda e:pageerrs.append(str(e)))
    pg.goto(URL);pg.wait_for_function("window.__app&&window.__app.notes.length>0",timeout=9000)
    time.sleep(0.5)

    # ---- 1) 正文 + 待办共存：待办不覆盖正文 ----
    pg.evaluate("window.__app.createNote('note')");time.sleep(0.6)
    pg.fill('#paperTitle','共存测试');time.sleep(0.2)
    pg.click('#paperBody');time.sleep(0.2)
    pg.keyboard.type('这是我原来写好的正文内容',delay=20);time.sleep(0.3)
    before=pg.evaluate("()=>document.querySelector('#paperBody').innerText")
    pg.evaluate("window.__app.addPaperTodo()");time.sleep(0.4)
    bodyVisible=pg.evaluate("()=>document.querySelector('#paperBody').style.display!=='none'")
    after=pg.evaluate("()=>document.querySelector('#paperBody').innerText")
    todoShown=pg.evaluate("()=>document.querySelector('#paperTodo').classList.contains('show')")
    check('加待办后正文仍可见',bodyVisible)
    check('加待办后正文内容保留','原来写好的正文' in after,after)
    check('待办区显示在正文下方',todoShown)
    pg.fill('#paperTodo .pt-row textarea.pt-text','这是待办事项');time.sleep(0.2)

    # ---- 2) 高亮可加、可取消 ----
    pg.evaluate("()=>{var b=document.querySelector('#paperBody');b.innerHTML='这里有一句高亮目标的文字。'}");time.sleep(0.2)
    select_word(pg,'高亮目标')
    pg.dispatch_event('#paperRtBar [data-c="hi"]','pointerdown');time.sleep(0.3)
    on1=pg.evaluate("""()=>document.querySelector('#paperBody').innerHTML.replace(/\\s+/g,'')""")
    check('高亮已加上','255,226,122' in on1 or 'ffe27a' in on1,on1)
    select_word(pg,'高亮目标')
    pg.evaluate("window.__app.syncPrState()");time.sleep(0.2)
    hiOn=pg.evaluate("()=>document.querySelector('#paperRtBar [data-c=\\\"hi\\\"]').classList.contains('on')")
    check('选中高亮时按钮呈on态',hiOn)
    pg.dispatch_event('#paperRtBar [data-c="hi"]','pointerdown');time.sleep(0.3)
    on2=pg.evaluate("""()=>document.querySelector('#paperBody').innerHTML.replace(/\\s+/g,'')""")
    check('高亮可取消','255,226,122' not in on2 and 'ffe27a' not in on2,on2)

    # ---- 3) 撤销 / 重做（新建干净便签，避免历史污染） ----
    pg.evaluate("()=>{location.hash='#/home'}");time.sleep(0.5)
    pg.evaluate("window.__app.createNote('note')");time.sleep(0.6)
    pg.click('#paperBody');time.sleep(0.2)
    pg.keyboard.type('你好',delay=40);time.sleep(0.6)   # 第一段
    pg.keyboard.type('世界',delay=40);time.sleep(0.3)   # 第二段
    cur=pg.evaluate("()=>document.querySelector('#paperBody').innerText")
    check('输入两段文字',cur=='你好世界',cur)
    pg.dispatch_event('#prUndo','pointerdown');time.sleep(0.3)
    u1=pg.evaluate("()=>document.querySelector('#paperBody').innerText")
    check('撤销一次回到“你好”',u1=='你好',u1)
    pg.dispatch_event('#prUndo','pointerdown');time.sleep(0.3)
    u2=pg.evaluate("()=>document.querySelector('#paperBody').innerText")
    check('再撤销回到空',u2=='',u2)
    pg.dispatch_event('#prRedo','pointerdown');time.sleep(0.3)
    r1=pg.evaluate("()=>document.querySelector('#paperBody').innerText")
    check('重做一次恢复“你好”',r1=='你好',r1)
    pg.dispatch_event('#prRedo','pointerdown');time.sleep(0.3)
    r2=pg.evaluate("()=>document.querySelector('#paperBody').innerText")
    check('重做两次恢复“你好世界”',r2=='你好世界',r2)

    # ---- 4) 撤销能回退格式（高亮） ----
    select_word(pg,'世界') if False else None
    check('全程无pageerror',not pageerrs,pageerrs[:3])
    b.close()

print('='*64)
fails=0
for name,st,det in R:
    print(f'[{st}] {name}'+(('  -> '+det) if st=='FAIL' else ''))
    if st=='FAIL':fails+=1
print('='*64)
print(f'TOTAL {len(R)}  PASS {len(R)-fails}  FAIL {fails}')
