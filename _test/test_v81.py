from playwright.sync_api import sync_playwright
import time
CHROME='/opt/vm/preinstall/ms-playwright/chromium-1169/chrome-linux/chrome'
URL='file:///home/user/Doubao/chats/38443854002369026/notes-app/index.html'
R=[]
def check(n,c,d=''):R.append((n,'PASS' if c else 'FAIL',str(d)))

with sync_playwright() as p:
    b=p.chromium.launch(executable_path=CHROME,args=['--allow-file-access-from-files'])
    ctx=b.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
    pg=ctx.new_page()
    errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto(URL);pg.wait_for_function("window.__app&&window.__app.notes.length",timeout=9000)
    time.sleep(.5)

    # 1) 白框回归：冷白蓝面板(nb) display:none、无横向偏移、非活动屏不绘制
    check('笔记本面板默认隐藏(白框回归)',
      pg.evaluate("()=>getComputedStyle(document.getElementById('nbPicker')).display==='none'")
      and pg.evaluate("()=>document.getElementById('app').scrollLeft===0")
      and pg.evaluate("()=>getComputedStyle(document.querySelector('.screen:not(.active)')).visibility==='hidden'"))

    # 2) 长按卡片 → 直接进入编辑
    card=pg.query_selector('.note-card');cid=card.get_attribute('data-id')
    card.dispatch_event('pointerdown',{'pointerId':1,'clientX':120,'clientY':220,'bubbles':True})
    time.sleep(.55)
    check('长按直接进入编辑',('#/edit?id='+cid) in pg.evaluate("()=>location.hash"),pg.evaluate("()=>location.hash"))
    pg.evaluate("()=>location.hash='#/home'");time.sleep(.5)

    # 3) 管理按钮进入多选；点卡片选中；再点取消到0仍不退出
    check('管理按钮存在',pg.query_selector('#manageBtn') is not None)
    pg.query_selector('#manageBtn').click();time.sleep(.4)
    inSel=pg.evaluate("()=>document.getElementById('contextBar').classList.contains('show')")
    check('管理按钮进入多选',inSel)
    c2=pg.query_selector('.note-card');id2=c2.get_attribute('data-id')
    c2.click();time.sleep(.3)
    nsel=pg.evaluate("()=>document.querySelectorAll('#scr-home .sel-circle.on').length")
    check('多选下点卡片选中',nsel==1,nsel)
    pg.query_selector('.note-card').click();time.sleep(.3)
    still=pg.evaluate("()=>document.getElementById('contextBar').classList.contains('show')")
    check('取消到0仍留在多选(不误退)',still)
    pg.query_selector('#exitSelect').click();time.sleep(.4)
    check('点 X 退出多选',
      not pg.evaluate("()=>document.getElementById('contextBar').classList.contains('show')"))

    # 4) 标签：打开一张带标签便签；未选 chip 点击添加；新建出现输入框
    nid=pg.evaluate("()=>window.__app.notes[0].id")
    pg.evaluate("(id)=>location.hash='#/edit?id='+id",nid);time.sleep(.6)
    before=pg.evaluate("()=>document.querySelectorAll('#paperTags .qtag.on').length")
    off=pg.query_selector('#paperTags .qtag:not(.on)')
    if off:
        off.click();time.sleep(.3)
        after=pg.evaluate("()=>document.querySelectorAll('#paperTags .qtag.on').length")
        check('点未选标签即添加',after==before+1,(before,after))
    else:
        check('点未选标签即添加(无未选项，跳过)',True)
    pg.query_selector('#qtagAdd').click();time.sleep(.3)
    check('点新建出现就地输入框',pg.query_selector('#qtagInput') is not None)

    check('全程无 pageerror',len(errs)==0,errs)
    print('\n'+'='*60);fails=0
    for n,st,det in R:
        print(f'[{st}] {n}'+(('  -> '+det) if st=='FAIL' else ''))
        if st=='FAIL':fails+=1
    print('='*60)
    print(f'TOTAL {len(R)}  PASS {len(R)-fails}  FAIL {fails}')
    b.close()
