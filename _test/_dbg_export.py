from playwright.sync_api import sync_playwright
import base64,time
CHROME='/opt/vm/preinstall/ms-playwright/chromium-1169/chrome-linux/chrome'
URL='file:///home/user/Doubao/chats/38443854002369026/notes-app/index.html'
with open('/home/user/Doubao/chats/38443854002369026/notes-app/_test/fix/report.pdf','rb') as f:
    b64=base64.b64encode(f.read()).decode()
with sync_playwright() as p:
    b=p.chromium.launch(executable_path=CHROME,args=['--allow-file-access-from-files'])
    pg=b.new_context(viewport={'width':390,'height':844}).new_page()
    msgs=[];pg.on('console',lambda m:msgs.append(m.type+':'+m.text[:120]))
    pg.goto(URL)
    pg.wait_for_function("window.__app&&window.__app.notes.length>0",timeout=9000)
    time.sleep(0.5)
    r=pg.evaluate("""async (b64)=>{
      var bin=atob(b64),arr=new Uint8Array(bin.length);
      for(var i=0;i<bin.length;i++)arr[i]=bin.charCodeAt(i);
      await window.__app.idbPutBlob('t_pdf',new Blob([arr]));
      var n={id:'n_migrate_xx',type:'note',pinned:false,trashed:false,trashedAt:null,
        files:[{id:'t_pdf',name:'report.pdf',idx:1,size:10}],
        title:'迁移测试便签',content:'<p>迁移锚点正文。</p>',
        todos:[],tags:['工作'],color:'yellow',createdAt:Date.now(),updatedAt:Date.now()};
      window.__app.notes.push(n);
      await window.__app.chunkNote(n);
      window.__called=false;window.__err=null;window.__pkg=null;window.__fetchErr=null;
      window.downloadURL=function(url,name){window.__called=true;window.__dn=name;
        fetch(url).then(r=>r.blob()).then(b=>{window.__pkg=b;})
          .catch(e=>{window.__fetchErr=String(e);});};
      try{
        await window.__app.buildKnowledgeIndex(false);
        await window.__app.exportKbPackage();
      }catch(e){window.__err=String(e);}
      await new Promise(r=>setTimeout(r,1500));
      return {called:window.__called,step:window.__step,pkgErr:window.__pkgErr,err:window.__err,fetchErr:window.__fetchErr,
        isBlob:window.__pkg instanceof Blob,dn:window.__dn,
        nchunks:(await window.__app.KB.allChunks()).length};
    }""",b64)
    print(r)
    for m in msgs[-12:]:print(m)
