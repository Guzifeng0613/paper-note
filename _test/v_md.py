# -*- coding: utf-8 -*-
from playwright.sync_api import sync_playwright
import time
CHROME='/opt/vm/preinstall/ms-playwright/chromium-1169/chrome-linux/chrome'
URL='file:///home/user/Doubao/chats/38443854002369026/notes-app/index.html'
TXT='会议结论：项目按计划推进。\n\n风险：当前人力偏紧，下月需要增援。'
CSV='姓名,销售额\n张三,120\n李四,90\n王五,150'
lib={'notes':[{'id':'n1','type':'note','title':'项目A周报','content':'<p>本周完成评审，见附件。</p>','tags':['工作'],'todos':[],
 'files':[{'id':'a1','name':'会议纪要.txt','size':len(TXT),'type':'text/plain','kind':'text','idx':1},
          {'id':'a2','name':'销售明细.csv','size':len(CSV),'type':'text/csv','kind':'sheet','idx':2}],
 'color':'yellow','pinned':False,'trashed':False,'createdAt':1000,'updatedAt':1000,'notebook':None}],'prefs':{}}
P=[]
def ck(n,c):P.append((n,bool(c)))
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
    # 生成派生 md
    pg.evaluate("()=>__app.ensureAttachmentMd(__app.notes[0],__app.notes[0].files.find(f=>f.id==='a1'))");time.sleep(.2)
    pg.evaluate("()=>__app.ensureAttachmentMd(__app.notes[0],__app.notes[0].files.find(f=>f.id==='a2'))");time.sleep(.2)
    st=pg.evaluate("""async()=>{
      const n=__app.notes[0];
      const mds=n.files.filter(f=>f.kind==='md');
      const t1=await(await __app.attachmentBlob(mds.find(m=>m.derivedOf==='a1'))).text();
      const t2=await(await __app.attachmentBlob(mds.find(m=>m.derivedOf==='a2'))).text();
      return {mdCount:mds.length,allHidden:mds.every(m=>m.hidden),
        t1:t1,t1head:t1.startsWith('# 会议纪要'),t1body:t1.includes('人力偏紧'),
        t2table:t2.includes('|')&&t2.includes('王五')&&t2.includes('---'),t2sheet:t2.includes('## CSV')};}""")
    ck('生成2个派生md',st['mdCount']==2)
    ck('md均hidden前台不显示',st['allHidden'])
    ck('txt md标题+正文',st['t1head'] and st['t1body'])
    ck('csv md转表格',st['t2table'] and st['t2sheet'])
    # 切片不切 md 派生
    pg.evaluate("()=>__app.chunkNote(__app.notes[0])");time.sleep(.3)
    ch=pg.evaluate("""async()=>{const all=await __app.KB.allChunks();
      return {fileOrig:all.filter(c=>c.fileId).map(c=>c.fileId).sort(),
        noMdChunk:!all.some(c=>c.fileId&&__app.notes[0].files.some(f=>f.id===c.fileId&&f.kind==='md'))};}""")
    ck('切片只含原文档(a1a2)不含md',sorted(set(ch['fileOrig']))==['a1','a2'] and ch['noMdChunk'])
    # 导出 zip（含 md blob）
    b64=pg.evaluate("""async()=>{await __app.ensureExportLibs();
      const zip=new window.JSZip();zip.file('library.json',__app.Store.payload());
      const fd=zip.folder('files');
      for(const n of __app.notes)for(const f of(n.files||[])){const b=await __app.idbGetBlob(f.id);if(b)fd.file(f.id+'/'+f.name,b);}
      return await zip.generateAsync({type:'base64'});}""")
    # 换机
    pg.evaluate("()=>localStorage.clear()")
    pg.evaluate("""async()=>{for(const n of ['zhipian-db-v3','zhipian-db-v3-kb'])
       await new Promise(r=>{const q=indexedDB.deleteDatabase(n);q.onsuccess=r;q.onerror=r;q.onblocked=r;});}""")
    pg.reload();time.sleep(1)
    pg.evaluate("""async(b)=>{const bl=await fetch('data:application/zip;base64,'+b).then(r=>r.blob());
       await __app.importZipBlob(bl);}""",b64);time.sleep(.3);pg.click('#uimo');time.sleep(.3)
    rs=pg.evaluate("""async()=>{const n=__app.notes[0];
      const mds=n.files.filter(f=>f.kind==='md');
      const t2=await(await __app.attachmentBlob(mds.find(m=>m.derivedOf==='a2'))).text();
      return {mdCount:mds.length,linked:mds.every(m=>m.derivedOf),table:t2.includes('王五')};}""")
    ck('还原md条目并保留关联',rs['mdCount']==2 and rs['linked'] and rs['table'])
    # 删除 a1 级联其 md
    pg.evaluate("""()=>{const n=__app.notes[0];
      for(let i=n.files.length-1;i>=0;i--){const f=n.files[i];
        if(f.id==='a1'||f.derivedOf==='a1'){n.files.splice(i,1);__app.Store.removeBlob(f);}}
      __app.applyLibrary({notes:n?[n]:[]},'删');}""");time.sleep(.2);pg.click('#uimo');time.sleep(.3)
    dl=pg.evaluate("""async()=>{const g=id=>__app.idbGetBlob(id).then(b=>b).catch(()=>null);
      return {a1:await g('a1'),m1:await g(__app.notes[0].files.find(f=>f.derivedOf==='a1')?__app.notes[0].files.find(f=>f.derivedOf==='a1').id:'x'),
        a2:await g('a2'),m2:!!__app.notes[0].files.find(f=>f.derivedOf==='a2')};}""")
    ck('删原附件连带md删除',dl['a1'] is None and dl['m1'] is None)
    ck('a2及其md保留',dl['a2'] is not None and dl['m2'])
    # PDF 扫描页 md 占位（模拟 ft）
    pm=pg.evaluate("""()=>{const md=__app.fileTextToMarkdown({name:'混排.pdf',data:{kind:'pdf',
      pages:[{page:1,text:'电子文本页内容',valid:80,noText:false},
             {page:2,text:'',valid:2,noText:true}]}});
      return md.includes('无文本层')&&md.includes('电子文本页');}""")
    ck('PDF无文本层页md标注',pm)
    b.close()
for n,ok in P:print(('PASS' if ok else 'FAIL'),n)
print('==> %d/%d'%(sum(ok for _,ok in P),len(P)))
