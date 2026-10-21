from playwright.sync_api import sync_playwright
import base64,time
CHROME='/opt/vm/preinstall/ms-playwright/chromium-1169/chrome-linux/chrome'
URL='file:///home/user/Doubao/chats/38443854002369026/notes-app/index.html'
FX='/home/user/Doubao/chats/38443854002369026/notes-app/_test/fix/'
R=[]
def check(n,c,d=''):R.append((n,'PASS' if c else 'FAIL',str(d)))
def b64file(nm):
    with open(FX+nm,'rb') as f:return base64.b64encode(f.read()).decode()

NOTE_TPL="""(function(longtext){return {id:'n_test_1',title:'RAG切片测试',type:'todo',
  notebook:'工作',tags:['工作','想法'],pinned:false,trashed:false,priority:'normal',color:'',
  content:'<p>开头引言。</p><p>'+longtext+'</p>',
  todos:[{id:'td1',text:'验证待办切片',done:false,priority:'normal'}],
  files:[{id:'t_pdf',name:'report.pdf',idx:1,size:10}]};})(longtext)"""

with sync_playwright() as p:
    b=p.chromium.launch(executable_path=CHROME,args=['--allow-file-access-from-files'])
    ctx=b.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
    pg=ctx.new_page()
    errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto(URL)
    pg.wait_for_function("window.__app&&window.__app.notes.length>0",timeout=9000)
    time.sleep(0.6)

    # 素材 → idb
    for nm,id in [('report.pdf','t_pdf'),('doc.docx','t_doc'),
                  ('sheet.xlsx','t_xls'),('report.pdf','t_pdf2')]:
        pg.evaluate("""([id,b64])=>{
          var bin=atob(b64),arr=new Uint8Array(bin.length);
          for(var i=0;i<bin.length;i++)arr[i]=bin.charCodeAt(i);
          return window.__app.idbPutBlob(id,new Blob([arr]));
        }""",[id,b64file(nm)])

    # ---- A. 附件正文提取 ----
    k=pg.evaluate("""async ()=>{
      var pdf=await window.__app.fileTextFor({id:'t_pdf',name:'report.pdf',idx:1,size:10});
      var doc=await window.__app.fileTextFor({id:'t_doc',name:'doc.docx',idx:2,size:10});
      var xls=await window.__app.fileTextFor({id:'t_xls',name:'sheet.xlsx',idx:3,size:10});
      return {
        pdf:pdf.data.kind==='pdf'&&pdf.data.pages.some(p=>p.text.indexOf('项目季度报告')>=0),
        doc:doc.data.kind==='docx'&&doc.data.text.indexOf('语义切片')>=0,
        xls:xls.data.kind==='sheet'&&xls.data.sheets.some(s=>s.sheet==='预算表')};
    }""")
    check('PDF 正文+页码提取',k['pdf'])
    check('Word 正文提取',k['doc'])
    check('Excel 多 sheet 提取',k['xls'])

    # ---- B. 语义切片 ----
    longtext='知识'*200
    info=pg.evaluate("""async (longtext)=>{
      var n=(%s)
      var r=await window.__app.chunkNote(n);
      var all=(await window.__app.KB.allChunks()).filter(c=>c.noteId==='n_test_1');
      var parents=all.filter(c=>c.level==='parent');
      var children=all.filter(c=>c.level==='child');
      var isContig=arr=>{var s=arr.map(c=>c.seq).sort((a,b)=>a-b);
        return s.join(',')===s.map((_,i)=>i).join(',');};
      return {
        ckinds:[...new Set(children.map(c=>c.kind))].sort().join(','),
        hasParent:parents.length>=1,
        childLinked:children.every(c=>c.parentId&&parents.some(p=>p.id===c.parentId)),
        childContig:isContig(children),parentContig:isContig(parents),
        unique:new Set(all.map(c=>c.id)).size===all.length,
        crumbs:all.every(c=>c.crumbs.indexOf('RAG切片测试')>=0),
        filemeta:children.filter(c=>c.kind==='file').every(c=>c.fileId==='t_pdf'&&c.fileName==='report.pdf'&&!!c.loc),
        todo:children.some(c=>c.kind==='todo'&&c.text.indexOf('验证待办切片')>=0),
        textn:children.filter(c=>c.kind==='text').length,count:r.count};
    }"""%NOTE_TPL,longtext)
    check('子块覆盖 text/todo/file',info['ckinds']=='file,text,todo',info['ckinds'])
    check('父块存在且子块挂到父块',info['hasParent'] and info['childLinked'])
    check('子块 seq 从0连续',info['childContig'])
    check('父块 seq 从0连续',info['parentContig'])
    check('chunk id 唯一',info['unique'])
    check('面包屑含标题',info['crumbs'])
    check('附件片带文件元数据与位置',info['filemeta'])
    check('待办成片',info['todo'])
    check('长文切多片',info['textn']>=2,info['textn'])

    # 未变化跳过
    skipped=pg.evaluate("""async (longtext)=>{
      var n=(%s)
      return (await window.__app.chunkNote(n)).skipped===true;
    }"""%NOTE_TPL,longtext)
    check('未变化再切→跳过',skipped)
    # 同内容重切 id 稳定
    idstable=pg.evaluate("""async (longtext)=>{
      var before=(await window.__app.KB.allChunks()).filter(c=>c.noteId==='n_test_1').map(c=>c.id).sort();
      await window.__app.KB.delChunksOfNote('n_test_1');
      await window.__app.KB.delJob('n_test_1');
      var n=(%s)
      await window.__app.chunkNote(n);
      var after=(await window.__app.KB.allChunks()).filter(c=>c.noteId==='n_test_1').map(c=>c.id).sort();
      return before.join('|')===after.join('|');
    }"""%NOTE_TPL,longtext)
    check('同内容重切 id 稳定',idstable)

    # ---- C. 断点续切 ----
    res=pg.evaluate("""async ()=>{
      var n={id:'n_resume',title:'断点测试',type:'todo',notebook:'',tags:[],
        content:'<p>正文内容第一段。</p><p>正文内容第二段。</p>',todos:[],
        files:[{id:'t_pdf',name:'report.pdf',idx:1,size:10},
               {id:'t_pdf2',name:'report2.pdf',idx:2,size:10}]};
      var call=0;
      try{await window.__app.chunkNote(n,{shouldStop:()=>{call++;return call>1;}});}
      catch(e){}
      var job=await window.__app.KB.getJob('n_resume');
      var abortedNotDone=!job||job.status!=='done';
      await window.__app.chunkNote(n);
      var job2=await window.__app.KB.getJob('n_resume');
      var all=(await window.__app.KB.allChunks()).filter(c=>c.noteId==='n_resume');
      return {abortedNotDone:abortedNotDone,done:job2.status==='done',
        textN:all.filter(c=>c.kind==='text').length,total:all.length};
    }""")
    check('中断时篇级原子（未标记完成）',res['abortedNotDone'])
    check('重切后任务完成',res['done'])
    check('重切后 text 片正确（仅1）',res['textN']==1,res['textN'])

    # ---- D. 增量更新 ----
    inc=pg.evaluate("""async ()=>{
      var n={id:'n_incr',title:'增量测试',type:'note',notebook:'',tags:[],
        content:'<p>旧的正文内容AAA。</p>',todos:[],files:[]};
      await window.__app.chunkNote(n);
      var hasOld=(await window.__app.KB.allChunks()).filter(c=>c.noteId==='n_incr')
        .some(c=>c.text.indexOf('旧的正文内容AAA')>=0);
      n.content='<p>新的正文内容BBB。</p>';
      await window.__app.chunkNote(n);
      var after=(await window.__app.KB.allChunks()).filter(c=>c.noteId==='n_incr');
      return {hasOld:hasOld,
        hasNew:after.some(c=>c.text.indexOf('新的正文内容BBB')>=0),
        oldGone:!after.some(c=>c.text.indexOf('旧的正文内容AAA')>=0)};
    }""")
    check('更新后切片重建（新在/旧删）',inc['hasOld'] and inc['hasNew'] and inc['oldGone'],inc)

    # ---- E. 知识库包迁移（端到端，blob 不出页） ----
    # 构造含附件的便签
    pg.evaluate("""async ()=>{
      var n={id:'n_migrate_xx',type:'note',pinned:false,trashed:false,trashedAt:null,
        files:[{id:'t_pdf',name:'report.pdf',idx:1,size:10}],
        title:'迁移测试便签',content:'<p>这是用于迁移验证的正文，含关键词迁移锚点。</p>',
        todos:[],tags:['工作'],color:'yellow',createdAt:Date.now(),updatedAt:Date.now()};
      window.__app.notes.push(n);
      await window.__app.chunkNote(n);
      await window.__app.persist();
    }""");time.sleep(0.4)
    pg.evaluate("async ()=>{await window.__app.buildKnowledgeIndex(false);return 'built';}")
    time.sleep(0.4)
    # 导出并在页内取回 zip 字节
    pg.evaluate("()=>window.__app.exportKbPackage()")
    try:
      pg.wait_for_function("window.__lastExport&&!!window.__lastExport.url",timeout=20000)
    except Exception:
      print('STUCK ESTEP=',pg.evaluate("()=>window.__estep"));raise
    exp=pg.evaluate("""async ()=>{
      var blob=await (await fetch(window.__lastExport.url)).blob();
      var bytes=new Uint8Array(await blob.arrayBuffer()),bin='';
      for(var i=0;i<bytes.length;i++)bin+=String.fromCharCode(bytes[i]);
      return {name:window.__lastExport.name,b64:btoa(bin)};
    }""")
    pkgName=exp['name'];zb64=exp['b64']
    import zipfile,io
    names=zipfile.ZipFile(io.BytesIO(base64.b64decode(zb64))).namelist()
    check('导出知识库包（.zip）',pkgName.endswith('.zip'),pkgName)
    check('包含 manifest/library/chunks',
        all(x in names for x in ['manifest.json','library.json','chunks.jsonl']),names)
    # 清空：便签/切片/附件
    pg.evaluate("""async ()=>{
      await window.__app.KB.delChunksOfNote('n_migrate_xx');
      await window.__app.KB.delJob('n_migrate_xx');
      var idx=window.__app.notes.findIndex(x=>x.id==='n_migrate_xx');
      if(idx>=0)window.__app.notes.splice(idx,1);
      await window.__app.idbDelBlob('t_pdf');
      await window.__app.persist();
    }""");time.sleep(0.4)
    gone=pg.evaluate("""async ()=>{
      var n=window.__app.notes.find(x=>x.id==='n_migrate_xx');
      var b=await window.__app.idbGetBlob('t_pdf').catch(()=>null);
      return !n&&!b;
    }""")
    check('清空前确认已移除',gone)
    # 从真实导出文件还原
    pg.evaluate("""async (b64)=>{
      var bin=atob(b64),arr=new Uint8Array(bin.length);
      for(var i=0;i<bin.length;i++)arr[i]=bin.charCodeAt(i);
      await window.__app.importZipBlob(
        new File([arr],'kb.zip',{type:'application/zip'}));
    }""",zb64)
    time.sleep(0.8)
    pg.evaluate("()=>document.getElementById('uimo').click()")
    time.sleep(1.2)
    mig=pg.evaluate("""async ()=>{
      var n=window.__app.notes.find(x=>x.title==='迁移测试便签');
      var allc=await window.__app.KB.allChunks();
      var ch=allc.some(c=>(c.text||'').indexOf('迁移锚点')>=0);
      var b=await window.__app.idbGetBlob('t_pdf').catch(()=>null);
      return {note:!!n,chunks:ch,blob:!!b};
    }""")
    check('迁移后便签还原',mig['note'])
    check('迁移后切片还原',mig['chunks'])
    check('迁移后附件 blob 还原',mig['blob'])

    check('全程无 pageerror',len(errs)==0,errs)
    print('\n'+'='*60);fails=0
    for n,st,det in R:
        print(f'[{st}] {n}'+(('  -> '+det) if st=='FAIL' else ''))
        if st=='FAIL':fails+=1
    print('='*60)
    print(f'TOTAL {len(R)}  PASS {len(R)-fails}  FAIL {fails}')
