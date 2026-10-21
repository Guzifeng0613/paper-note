# -*- coding: utf-8 -*-
from playwright.sync_api import sync_playwright
import time,os
CHROME='/opt/vm/preinstall/ms-playwright/chromium-1169/chrome-linux/chrome'
URL='file:///home/user/Doubao/chats/38443854002369026/notes-app/index.html'
OUT='/home/user/Doubao/chats/38443854002369026/notes-app/_test/ux'
content=('<p>今天完成了<b>需求评审</b>，整体进度符合预期。</p>'
 '<p>重点关注 <u>接口联调时间</u>，<span class="hl">周五前必须提测</span>。</p>'
 '<p>现场白板照片：</p><img class="note-img" data-id="img1" style="width:100%;border-radius:10px">'
 '<p>下周补充测试用例并完成回归。</p>')
lib={'notes':[{'id':'n1','type':'note','title':'周计划与会议记录','content':content,
 'tags':['工作','会议'],'todos':[{'id':'t1','text':'整理会议纪要','done':False,'priority':'normal'},
   {'id':'t2','text':'同步给相关同事','done':True,'priority':'high'}],
 'files':[{'id':'f2','name':'需求文档.docx','size':24000,'type':'','kind':'doc','idx':1},
          {'id':'f3','name':'评审清单.pdf','size':18000,'type':'','kind':'pdf','idx':2}],
 'color':'yellow','pinned':True,'trashed':False,'createdAt':1000,'updatedAt':1000,'notebook':None}],
 'prefs':{}}
def shot(pg,n):pg.screenshot(path=os.path.join(OUT,n+'.png'))
with sync_playwright() as p:
    b=p.chromium.launch(executable_path=CHROME,args=['--allow-file-access-from-files'])
    ctx=b.new_context(viewport={'width':390,'height':844},has_touch=True,is_mobile=True)
    pg=ctx.new_page()
    cdp=ctx.new_cdp_session(pg)
    pg.goto(URL);time.sleep(.6)
    pg.evaluate("()=>localStorage.clear()")
    pg.evaluate("""async()=>{for(const n of ['zhipian-db-v3','zhipian-db-v3-kb'])
       await new Promise(r=>{const q=indexedDB.deleteDatabase(n);q.onsuccess=r;q.onerror=r;q.onblocked=r;});}""")
    pg.reload();time.sleep(1)
    pg.evaluate("(l)=>__app.applyLibrary(l,'测试')",lib);time.sleep(.2);pg.click('#uimo');time.sleep(.2)
    pg.evaluate("""async()=>{
      const c=document.createElement('canvas');c.width=600;c.height=320;const x=c.getContext('2d');
      const g=x.createLinearGradient(0,0,600,320);g.addColorStop(0,'#3a4a5a');g.addColorStop(1,'#c9a24b');
      x.fillStyle=g;x.fillRect(0,0,600,320);x.fillStyle='#fff';x.font='28px sans-serif';
      x.fillText('白板照片 / 需求评审',40,160);
      const bb=await new Promise(r=>c.toBlob(r,'image/png'));
      await __app.Store.addBlob('img1',bb);
    }""");time.sleep(.2)
    shot(pg,'01_home')
    pg.click('.note-card');time.sleep(.7);shot(pg,'02_edit')
    pg.click('#dockAI');time.sleep(.4);shot(pg,'03_rtbar');pg.click('#dockAI');time.sleep(.2)
    pg.evaluate("()=>document.getElementById('paperAttach').scrollIntoView()");time.sleep(.3);shot(pg,'04_attach')
    pg.evaluate("()=>document.getElementById('paperTitle').scrollIntoView()");time.sleep(.2)
    pg.click('#dockTag');time.sleep(.5);shot(pg,'05_tag');pg.keyboard.press('Escape');time.sleep(.4)
    pg.click('#editMore');time.sleep(.5);shot(pg,'06_more');pg.keyboard.press('Escape');time.sleep(.4)
    pg.click('#editShare');time.sleep(.5);shot(pg,'07_share');pg.keyboard.press('Escape');time.sleep(.4)
    pg.evaluate("()=>__app.openNotebookPicker()");time.sleep(.5);shot(pg,'08_notebook');pg.keyboard.press('Escape');time.sleep(.4)
    pg.click('#editBack');time.sleep(.5)
    box=pg.locator('.note-card').first.bounding_box()
    cx,cy=box['x']+box['width']/2,box['y']+box['height']/2
    cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':cx,'y':cy}]})
    time.sleep(.7);cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});time.sleep(.5)
    shot(pg,'09_select')
    pg.click('#exitSelect');time.sleep(.2)
    pg.evaluate("()=>location.hash='#settings'");time.sleep(.3)
    pg.evaluate("()=>{const t=document.getElementById('tagMineBox');if(t)t.scrollIntoView({block:'center'});}")
    time.sleep(.4);shot(pg,'10_tagmine')
    print(sorted(os.listdir(OUT)))
    b.close()
