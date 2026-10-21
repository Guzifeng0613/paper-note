import os,time,base64
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright
WEB=os.path.abspath(os.path.join(os.path.dirname(__file__),'..','android','app','src','main','assets','web'))
CHROME='/opt/vm/preinstall/ms-playwright/chromium-1169/chrome-linux/chrome'
T=os.path.dirname(__file__)
def mt(p):
  if p.endswith('.js'):return 'text/javascript'
  if p.endswith('.bcmap'):return 'application/octet-stream'
  return 'application/octet-stream'
def b64(name):
  with open(os.path.join(T,name),'rb') as f:return base64.b64encode(f.read()).decode()
with sync_playwright() as p:
    b=p.chromium.launch(executable_path=CHROME)
    pg=b.new_page()
    def on_route(route):
      u=urlparse(route.request.url);pth=u.path
      if pth=='/'or pth=='/index.html':fp,ct=os.path.join(WEB,'index.html'),'text/html'
      elif pth.startswith('/vendor/'):fp,ct=os.path.join(WEB,pth[1:]),mt(pth)
      else:return route.fulfill(status=404)
      if not os.path.isfile(fp):return route.fulfill(status=404)
      with open(fp,'rb') as f:data=f.read()
      route.fulfill(status=200,content_type=ct,headers={'Cache-Control':'no-cache'},body=data)
    pg.route('https://zhipian.local/**',on_route)
    errs=[];pg.on('pageerror',lambda e:errs.append(str(e)[:160]))
    pg.goto('https://zhipian.local/');time.sleep(1)
    payload={'pdf':b64('test_mixed.pdf'),'docx':b64('sample.docx'),'xlsx':b64('sample.xlsx')}
    r=pg.evaluate("""async(b)=>{
      function buf(s){const x=atob(s),u=new Uint8Array(x.length);
        for(let i=0;i<x.length;i++)u[i]=x.charCodeAt(i);return u.buffer;}
      const out={};
      const W=__app.ParseW;
      const pdf=await __app.parsePdfMain(buf(b.pdf));
      out.pages=pdf.pages.length;
      out.textPages=pdf.pages.filter(p=>!p.noText).length;
      out.noTextPages=pdf.pages.filter(p=>p.noText).length;
      const dx=await W.parseDocx(buf(b.docx));
      out.docx=dx.text||'';
      const xl=await W.parseSheet(buf(b.xlsx));
      out.xlsx=(xl.sheets[0]&&xl.sheets[0].text)||'';
      const n={files:[{id:'x',kind:'image',name:'a.png',hidden:false}]};
      out.imageSkip=(await __app.ensureAttachmentMd(n,n.files[0]))===null;
      return out;}""",payload)
    passed=0;total=6
    def chk(cond,name):
      global passed
      print(('PASS ' if cond else 'FAIL ')+name);passed+=1 if cond else 0
    chk(r['pages']==3,'PDF共3页')
    chk(r['textPages']==2,'PDF文本页=2（确定性提取）')
    chk(r['noTextPages']==1,'PDF无文本层页=1（安全跳过、不OCR）')
    chk('这是测试文档内容' in r['docx'],'Word(docx)提取正文')
    chk(('张三' in r['xlsx'])and('95' in r['xlsx']),'Excel(xlsx)提取单元格')
    chk(r['imageSkip'],'图片不提取文字（返回null）')
    chk2=not errs
    print(('PASS ' if chk2 else 'FAIL ')+('无页面报错' if chk2 else '页面报错:'+errs[0]))
    print('==> %d/%d'%(passed+(1 if chk2 else 0),total+1))
    b.close()
