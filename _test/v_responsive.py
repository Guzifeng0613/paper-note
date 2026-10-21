# -*- coding: utf-8 -*-
# 验证 PDF 后台解析（pdf.js 独立 worker）期间主线程不卡：rAF 帧间隔
from playwright.sync_api import sync_playwright
from urllib.parse import urlparse
import os,time,base64
CHROME='/opt/vm/preinstall/ms-playwright/chromium-1169/chrome-linux/chrome'
WEB='/home/user/Doubao/chats/38443854002369026/notes-app/android/app/src/main/assets/web'
PDF=os.path.join(os.path.dirname(__file__),'test_mixed.pdf')
def mt(rel):
  return 'text/javascript' if rel.lower().endswith('.js') else 'application/octet-stream'
b64=base64.b64encode(open(PDF,'rb').read()).decode()
with sync_playwright() as p:
    b=p.chromium.launch(executable_path=CHROME)
    pg=b.new_page()
    def on_route(route):
      pth=urlparse(route.request.url).path
      if pth=='/'or pth=='/index.html':fp,ct=os.path.join(WEB,'index.html'),'text/html'
      elif pth.startswith('/vendor/'):fp,ct=os.path.join(WEB,pth[1:]),mt(pth)
      else:return route.fulfill(status=404)
      if not os.path.isfile(fp):return route.fulfill(status=404)
      route.fulfill(status=200,content_type=ct,body=open(fp,'rb').read())
    pg.route('https://zhipian.local/**',on_route)
    pg.goto('https://zhipian.local/');time.sleep(1)
    res=pg.evaluate("""async(b64)=>{
      const x=atob(b64),buf=new Uint8Array(x.length);
      for(let i=0;i<x.length;i++)buf[i]=x.charCodeAt(i);
      const gaps=[];let last=performance.now(),running=true;
      function tick(now){gaps.push(now-last);last=now;if(running)requestAnimationFrame(tick);}
      requestAnimationFrame(tick);
      const t0=performance.now();
      const r=await __app.parsePdfMain(buf.buffer);
      const cost=performance.now()-t0;running=false;
      gaps.sort((a,z)=>a-z);
      return {cost,max:Math.round(gaps[gaps.length-1]),
        p95:Math.round(gaps[Math.floor(gaps.length*.95)]),frames:gaps.length,
        hit:(r.pages[0].text||'').includes('第一个文本页')};}""",b64)
    print('解析耗时(ms):',res['cost'])
    print('主线程最大帧间隔(ms):',res['max'],' p95:',res['p95'],' 采样帧数:',res['frames'])
    print('解析命中:',res['hit'])
    print('结论:', 'PASS 主线程流畅(最大间隔<120ms)' if res['max']<120 and res['hit']
      else 'FAIL 主线程卡顿')
    b.close()
