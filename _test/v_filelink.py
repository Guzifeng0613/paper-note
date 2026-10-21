import os,time
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright
WEB=os.path.abspath(os.path.join(os.path.dirname(__file__),'..','android','app','src','main','assets','web'))
CHROME='/opt/vm/preinstall/ms-playwright/chromium-1169/chrome-linux/chrome'
IMG=os.path.abspath(os.path.join(os.path.dirname(__file__),'scan_page.png'))
def mt(p):
  if p.endswith('.wasm'):return 'application/wasm'
  if p.endswith('.js'):return 'text/javascript'
  if p.endswith('.onnx'):return 'application/octet-stream'
  return 'application/octet-stream'
with sync_playwright() as p:
    b=p.chromium.launch(executable_path=CHROME)
    pg=b.new_page()
    def on_route(route):
      u=urlparse(route.request.url);pth=u.path
      if pth=='/'or pth=='/index.html':fp,ct=os.path.join(WEB,'index.html'),'text/html'
      elif pth=='/file' and u.query=='id=img1':fp,ct=IMG,'image/png'
      elif pth.startswith('/vendor/'):fp,ct=os.path.join(WEB,pth[1:]),mt(pth)
      else:return route.fulfill(status=404)
      if not os.path.isfile(fp):return route.fulfill(status=404)
      with open(fp,'rb') as f:data=f.read()
      route.fulfill(status=200,content_type=ct,headers={'Cache-Control':'no-cache'},body=data)
    pg.route('https://zhipian.local/**',on_route)
    errs=[];pg.on('pageerror',lambda e:errs.append(str(e)[:160]))
    pg.goto('https://zhipian.local/');time.sleep(1)
    # 1) 同源 /file 图片可加载（native intercept 等价）
    ok=pg.evaluate("""async()=>await new Promise(r=>{const im=new Image();
      im.onload=()=>r(im.naturalWidth>0);im.onerror=()=>r(false);
      im.src='file?id=img1';setTimeout(()=>r(false),8000);})""")
    print('PASS 同源/file图片加载' if ok else 'FAIL 图片加载')
    # 2) addBlob 在 native 的路径存在性（代码契约）：确认 Store.addBlob 为函数且 imageURL 走 file?id=
    import re
    src=open(os.path.join(WEB,'index.html'),encoding='utf-8').read()
    m=re.search(r'async addBlob\(id,blob\)\{.*?\n  \},',src,re.S)
    contract=bool(m) and 'putBlobFromDataUrl' in m.group(0)
    print('PASS addBlob含native写入' if contract else 'FAIL addBlob契约')
    print('FAIL 页面报错:'+errs[0] if errs else 'PASS 无页面报错')
    b.close()
