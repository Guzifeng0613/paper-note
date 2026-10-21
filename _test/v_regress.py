# -*- coding: utf-8 -*-
from playwright.sync_api import sync_playwright
import time
CHROME='/opt/vm/preinstall/ms-playwright/chromium-1169/chrome-linux/chrome'
URL='file:///home/user/Doubao/chats/38443854002369026/notes-app/index.html'
TXT='会议结论：项目按计划推进。\n\n风险：当前人力偏紧，下月需要增援。'
CSV='姓名,销售额\n张三,120\n李四,90\n王五,150'
lib={'notes':[
 {'id':'n1','type':'note','title':'项目A周报','content':'<p>本周完成需求评审，关键结论见附件。</p>','tags':['工作'],'todos':[],
  'files':[{'id':'a1','name':'会议纪要.txt','size':len(TXT),'type':'text/plain','kind':'text','idx':1}],
  'color':'yellow','pinned':False,'trashed':False,'createdAt':1000,'updatedAt':1000,'notebook':None},
 {'id':'n2','type':'note','title':'销售统计','content':'<p>本季度销售数据。</p>','tags':['数据'],'todos':[],
  'files':[{'id':'a2','name':'销售明细.csv','size':len(CSV),'type':'text/csv','kind':'sheet','idx':1}],
  'color':'green','pinned':False,'trashed':False,'createdAt':1001,'updatedAt':1001,'notebook':None}],'prefs':{}}
P=[]
def ck(name,cond):P.append((name,bool(cond)))
with sync_playwright() as p:
    b=p.chromium.launch(executable_path=CHROME,args=['--allow-file-access-from-files'])
    ctx=b.new_context(viewport={'width':390,'height':844},has_touch=True,is_mobile=True)
    pg=ctx.new_page();pg.goto(URL);time.sleep(.6)
    pg.evaluate("()=>localStorage.clear()")
    pg.evaluate("""async()=>{for(const n of ['zhipian-db-v3','zhipian-db-v3-kb'])
       await new Promise(r=>{const q=indexedDB.deleteDatabase(n);q.onsuccess=r;q.onerror=r;q.onblocked=r;});}""")
    pg.reload();time.sleep(1)
    pg.evaluate("(l)=>__app.applyLibrary(l,'测试')",lib);time.sleep(.2);pg.click('#uimo');time.sleep(.2)
    pg.evaluate("""([t,c])=>__app.Store.addBlob('a1',new Blob([t],{type:'text/plain'}))
       .then(()=>__app.Store.addBlob('a2',new Blob([c],{type:'text/csv'})))""",[TXT,CSV]);time.sleep(.3)
    pg.evaluate("()=>__app.chunkNote(__app.notes.find(n=>n.id==='n1'))");time.sleep(.2)
    pg.evaluate("()=>__app.chunkNote(__app.notes.find(n=>n.id==='n2'))");time.sleep(.2)
    r=pg.evaluate("""async()=>{const all=await __app.KB.allChunks();
      const fc=all.filter(c=>c.fileId),bc=all.filter(c=>!c.fileId&&c.attachments);
      const t=fc.map(c=>c.text).join('|');
      return {total:all.length,fc:fc.length,txt:t.includes('人力偏紧'),csv:t.includes('王五'),
        bc:bc.length,ids:bc[0]?bc[0].attachments.map(x=>x.id):[]};}""")
    ck('附件切片数量',r['fc']>=2);ck('txt正文入切片',r['txt']);ck('csv正文入切片',r['csv'])
    ck('正文切片带附件索引',r['bc']>=1 and 'a1' in r['ids'])
    rac=pg.evaluate("""async()=>{const all=await __app.KB.allChunks();
      const b=all.find(c=>!c.fileId&&c.attachments&&c.noteId==='n1');
      return await __app.buildAttachmentContext([{parent:b}]);}""")
    ck('附件随上下文发模型','人力偏紧' in rac)
    # 导出 zip
    b64=pg.evaluate("""async()=>{await __app.ensureExportLibs();
      const zip=new window.JSZip();zip.file('library.json',__app.Store.payload());
      const fd=zip.folder('files');
      for(const n of __app.notes)for(const f of(n.files||[])){const b=await __app.idbGetBlob(f.id);if(b)fd.file(f.id+'/'+f.name,b);}
      return await zip.generateAsync({type:'base64'});}""")
    # 模拟新设备
    pg.evaluate("()=>localStorage.clear()")
    pg.evaluate("""async()=>{for(const n of ['zhipian-db-v3','zhipian-db-v3-kb'])
       await new Promise(r=>{const q=indexedDB.deleteDatabase(n);q.onsuccess=r;q.onerror=r;q.onblocked=r;});}""")
    pg.reload();time.sleep(1)
    pg.evaluate("""async(b)=>{const bl=await fetch('data:application/zip;base64,'+b).then(r=>r.blob());
       await __app.importZipBlob(bl);}""",b64);time.sleep(.3);pg.click('#uimo');time.sleep(.3)
    rest=pg.evaluate("""async()=>{const ids=__app.notes.map(n=>n.id);
      const t1=await(await __app.attachmentBlob({id:'a1'})).text();
      const t2=await(await __app.attachmentBlob({id:'a2'})).text();
      return {ids,a1:t1.includes('人力偏紧'),a2:t2.includes('王五')};}""")
    ck('导入还原笔记',set(rest['ids'])=={'n1','n2'})
    ck('附件a1还原',rest['a1']);ck('附件a2还原',rest['a2'])
    # 删除级联
    pg.evaluate("""()=>{const n=__app.notes.find(x=>x.id==='n1');
      n.files.forEach(f=>__app.Store.removeBlob(f));
      __app.applyLibrary({notes:__app.notes.filter(x=>x.id!=='n1')},'删');}""");time.sleep(.2);pg.click('#uimo');time.sleep(.3)
    dl=pg.evaluate("""async()=>{const a1=await __app.idbGetBlob('a1').catch(()=>null);
      const a2=await __app.idbGetBlob('a2').catch(()=>null);return {a1:a1==null,a2:a2!=null};}""")
    ck('删除便签附件级联',dl['a1']);ck('他篇附件保留',dl['a2'])
    # 长按进入多选自动选中（验证 click 取消修复）
    box=pg.locator('.note-card').first.bounding_box()
    cdp=ctx.new_cdp_session(pg)
    cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':box['x']+30,'y':box['y']+30}]})
    time.sleep(.7);cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});time.sleep(.4)
    cnt=pg.evaluate("()=>document.getElementById('selCount').textContent")
    ck('长按进入多选并自动选中','1' in cnt)
    b.close()
fails=[n for n,ok in P if not ok]
for n,ok in P:print(('PASS' if ok else 'FAIL'),n)
print('==> %d/%d 通过'%(len(P)-len(fails),len(P)))
