# -*- coding: utf-8 -*-
from playwright.sync_api import sync_playwright
import time
CHROME='/opt/vm/preinstall/ms-playwright/chromium-1169/chrome-linux/chrome'
URL='file:///home/user/Doubao/chats/38443854002369026/notes-app/android/app/src/main/assets/web/index.html'
TXT='会议纪要\n人力偏紧，需要尽快招聘两名工程师。'
cks=[]
def ck(n,c):cks.append(c);print(('PASS ' if c else 'FAIL ')+n)
with sync_playwright() as p:
    b=p.chromium.launch(executable_path=CHROME,args=['--allow-file-access-from-files'])
    pg=b.new_page();pg.goto(URL);time.sleep(1)
    pg.on('pageerror',lambda e:print('[pageerror]',str(e)[:200]))
    pg.evaluate("()=>localStorage.clear()")
    pg.evaluate("""async()=>{for(const n of ['zhipian-db-v3','zhipian-db-v3-kb'])
       await new Promise(r=>{const q=indexedDB.deleteDatabase(n);q.onsuccess=r;q.onerror=r;q.onblocked=r;});}""")
    pg.reload();time.sleep(1)
    pg.evaluate("()=>__app.createNote()")
    nid=pg.evaluate("()=>__app.notes[__app.notes.length-1].id")
    durl=pg.evaluate("""()=>{const c=document.createElement('canvas');c.width=64;c.height=64;
      const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,64,64);
      x.fillStyle='#111';x.fillRect(5,5,20,20);return c.toDataURL('image/png');}""")
    pg.evaluate("""async([nid,durl])=>{const n=__app.notes.find(x=>x.id===nid);
      const blob=await fetch(durl).then(r=>r.blob());
      await __app.Store.addBlob('img1',blob);
      n.files.push({id:'img1',name:'test.png',size:blob.size,type:'image/png',kind:'image',idx:0});
    }""",[nid,durl]);time.sleep(.2)
    ck('插入图片后不生成md',not pg.evaluate(
      "()=>__app.notes.find(x=>x.id===%r).files.some(f=>f.kind==='md')"%nid))
    pg.evaluate("""async([nid,t])=>{const n=__app.notes.find(x=>x.id===nid);
      await __app.Store.addBlob('txt1',new Blob([t],{type:'text/plain'}));
      n.files.push({id:'txt1',name:'会议纪要.txt',size:t.length,type:'text/plain',kind:'text',idx:1});
    }""",[nid,TXT]);time.sleep(.2)
    cnt=pg.evaluate("""async(nid)=>{await __app.ensureAllExportMd();
      return __app.notes.find(x=>x.id===nid).files.filter(f=>f.kind==='md').length;}""",nid)
    ck('导出补齐：txt生成md、图片不生成(共1)',cnt==1)
    b.close()
print('==> %d/%d'%(sum(cks),len(cks)))
