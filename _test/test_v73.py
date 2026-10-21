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

    # ---- A. 旧 class="hl" 高亮可检测、可取消 ----
    pg.evaluate("()=>window.__app.createNote('note')");time.sleep(0.6)
    pg.evaluate("""()=>{
      var b=document.querySelector('#paperBody');
      b.innerHTML='开头文字<span class="hl">旧高亮内容</span>结尾文字';
      b.oninput();
    }""");time.sleep(0.3)
    pg.evaluate("""()=>{
      var b=document.querySelector('#paperBody');
      var span=b.querySelector('span.hl');
      var r=document.createRange();r.selectNode(span);
      var s=getSelection();s.removeAllRanges();s.addRange(r);
    }""");time.sleep(0.4)
    check('旧class高亮被检测到',pg.evaluate("()=>window.__app.selectionHiliteOn()"))
    hion=pg.evaluate("()=>document.querySelector('#paperRtBar [data-c=hi]').classList.contains('on')")
    check('浮层高亮按钮呈on态',hion)
    pg.dispatch_event('#paperRtBar [data-c="hi"]','pointerdown');time.sleep(0.4)
    after=pg.evaluate("()=>document.querySelector('#paperBody').innerHTML")
    check('旧高亮已取消(无hl)','hl' not in after,after)
    txt=pg.evaluate("()=>document.querySelector('#paperBody').textContent")
    check('取消后文字完整保留',all(w in txt for w in['旧高亮内容','开头文字','结尾文字']),txt)

    # ---- B. 顶部撤销/重做按钮（全新便签，初始无历史）----
    pg.evaluate("()=>window.__app.createNote('note')");time.sleep(0.6)
    iu=pg.evaluate("()=>document.querySelector('#editUndo').classList.contains('disabled')")
    ir=pg.evaluate("()=>document.querySelector('#editRedo').classList.contains('disabled')")
    check('初始撤销/重做均禁用',iu and ir)
    pg.click('#paperBody');time.sleep(0.2)
    pg.keyboard.type('第一句话',delay=20);time.sleep(0.3)
    canUndo=pg.evaluate("()=>!document.querySelector('#editUndo').classList.contains('disabled')")
    noRedo=pg.evaluate("()=>document.querySelector('#editRedo').classList.contains('disabled')")
    check('输入后可撤销、重做仍禁用',canUndo and noRedo)
    pg.click('#editUndo');time.sleep(0.4)
    empty=pg.evaluate("()=>document.querySelector('#paperBody').textContent")
    check('点顶部撤销回到空',empty.replace('​','').strip()=='',repr(empty))
    canRedo=pg.evaluate("()=>!document.querySelector('#editRedo').classList.contains('disabled')")
    check('撤销后可重做',canRedo)
    pg.click('#editRedo');time.sleep(0.4)
    back=pg.evaluate("()=>document.querySelector('#paperBody').textContent")
    check('点顶部重做恢复文字','第一句话' in back,back)

    check('全程无pageerror',len(pageerrs)==0,pageerrs)

    print('\n'+'='*60)
    fails=0
    for name,st,det in R:
        print(f'[{st}] {name}'+(('  -> '+det) if st=='FAIL' else ''))
        if st=='FAIL':fails+=1
    print('='*60)
    print(f'TOTAL {len(R)}  PASS {len(R)-fails}  FAIL {fails}')
