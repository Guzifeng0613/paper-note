from playwright.sync_api import sync_playwright
import base64,time
CHROME='/opt/vm/preinstall/ms-playwright/chromium-1169/chrome-linux/chrome'
URL='file:///home/user/Doubao/chats/38443854002369026/notes-app/index.html'
FX='/home/user/Doubao/chats/38443854002369026/notes-app/_test/fix/'
files=[]
for nm,id in [('report.pdf','fp_pdf'),('doc.docx','fp_doc'),('sheet.xlsx','fp_xls')]:
    with open(FX+nm,'rb') as f:b=base64.b64encode(f.read()).decode()
    files.append({'id':id,'name':nm,'b64':b})
with sync_playwright() as p:
    b=p.chromium.launch(executable_path=CHROME,args=['--allow-file-access-from-files'])
    ctx=b.new_context(viewport={'width':390,'height':844})
    pg=ctx.new_page()
    pg.goto(URL)
    pg.wait_for_function("window.__app&&window.__app.notes.length>0",timeout=9000)
    time.sleep(0.5)
    res=pg.evaluate("""async (files)=>{
      var out={};
      for(const f of files){
        var bin=atob(f.b64),arr=new Uint8Array(bin.length);
        for(var i=0;i<bin.length;i++)arr[i]=bin.charCodeAt(i);
        await window.__app.idbPutBlob(f.id,new Blob([arr]));
        var ft=await window.__app.fileTextFor({id:f.id,name:f.name,idx:1,size:arr.length});
        var d=ft.data,summary='';
        if(d.kind==='pdf')summary='PDF pages='+d.pages.length+' text='+
          d.pages.map(x=>x.text).join('|').slice(0,120);
        else if(d.kind==='docx')summary='DOCX text='+d.text.slice(0,120);
        else if(d.kind==='sheet')summary='SHEET '+d.sheets.map(s=>s.sheet+':'+s.text.slice(0,80)).join(' | ');
        out[f.name]=summary;
      }
      return out;
    }""",files)
    for k,v in res.items():print(k,'->',v)
