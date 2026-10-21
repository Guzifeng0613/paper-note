from playwright.sync_api import sync_playwright
from http.server import BaseHTTPRequestHandler, HTTPServer
import threading, json, time

CHROME='/opt/vm/preinstall/ms-playwright/chromium-1169/chrome-linux/chrome'
URL='file:///home/user/Doubao/chats/38443854002369026/notes-app/index.html'
R=[]
def check(n,c,d=''):R.append((n,'PASS' if c else 'FAIL',str(d)))

# ---- 假 OpenAI 服务器：200 ----
class Ok200(BaseHTTPRequestHandler):
    def log_message(self,*a):pass
    def _cors(self):
        self.send_header('Access-Control-Allow-Origin','*')
        self.send_header('Access-Control-Allow-Methods','GET,POST,OPTIONS')
        self.send_header('Access-Control-Allow-Headers','*')
    def do_OPTIONS(self):
        self.send_response(204);self._cors();self.end_headers()
    def do_POST(self):
        cl=int(self.headers.get('Content-Length',0));self.rfile.read(cl)
        body=json.dumps({'id':'x','choices':[{'index':0,'message':{'role':'assistant','content':'.'},
            'finish_reason':'stop'}]}).encode()
        self.send_response(200)
        self.send_header('Content-Type','application/json');self._cors()
        self.send_header('Content-Length',str(len(body)));self.end_headers();self.wfile.write(body)
# ---- 401 服务器 ----
class Unauth401(Ok200):
    def do_POST(self):
        cl=int(self.headers.get('Content-Length',0));self.rfile.read(cl)
        self.send_response(401);self._cors()
        self.send_header('Content-Length','0');self.end_headers()
srv1=HTTPServer(('127.0.0.1',8791),Ok200)
srv2=HTTPServer(('127.0.0.1',8792),Unauth401)
threading.Thread(target=srv1.serve_forever,daemon=True).start()
threading.Thread(target=srv2.serve_forever,daemon=True).start()

with sync_playwright() as p:
    b=p.chromium.launch(executable_path=CHROME,
        args=['--allow-file-access-from-files','--disable-web-security'])
    ctx=b.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
    pg=ctx.new_page()
    errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto(URL);pg.wait_for_function("window.__app&&window.__app.notes",timeout=9000)
    time.sleep(0.4)

    # ===== 迁移：旧单套 prefs.ai → ais.list =====
    pg.evaluate("""async ()=>{
      var P=window.__app.prefs;
      delete P.ais;
      P.ai={baseUrl:'https://old.example/v1',key:'oldkey',
        model:'oldmodel',embeddingModel:'oldemb'};
      await window.__app.flushDisk();
    }""")
    pg.reload();pg.wait_for_function("window.__app&&window.__app.notes",timeout=9000)
    time.sleep(0.4)
    mig=pg.evaluate("""()=>{
      var l=window.__app.AIs.all(),c=window.__app.AIs.current();
      var P=window.__app.prefs;
      return {n:l.length,ai:l[0]||null,curId:(P.ais||{}).cur,
        oldDeleted:(P.ai===undefined)};
    }""")
    ai0=mig['ai'] or {}
    check('旧单套配置迁移为列表一项',mig['n']==1 and mig['oldDeleted'],mig)
    check('迁移字段完整（含 Embedding）',
      ai0.get('baseUrl')=='https://old.example/v1' and ai0.get('key')=='oldkey'
      and ai0.get('model')=='oldmodel' and ai0.get('embModel')=='oldemb',ai0)
    check('迁移后自动成为当前配置',ai0.get('id')==mig['curId'],mig)

    # ===== 多配置：新增 / 切换 / 编辑 / 删除 / 持久化 =====
    c2=pg.evaluate("""()=>window.__app.AIs.add(
      {name:'第二套',baseUrl:'https://b.example/v1',key:'key2',model:'m2'}).id""")
    c3=pg.evaluate("""()=>window.__app.AIs.add(
      {name:'第三套',baseUrl:'https://c.example/v1',key:'key3',model:'m3'}).id""")
    pg.evaluate("id=>window.__app.AIs.setCur(id)",c2)
    pg.evaluate("id=>window.__app.AIs.update(id,{name:'第二套改名'})",c2)
    pg.evaluate("id=>window.__app.AIs.remove(id)",c3)
    mc=pg.evaluate("""()=>({n:window.__app.AIs.all().length,
      cur:(window.__app.AIs.current()||{}).name})""")
    check('多套配置增改删正确（剩2套、当前为改名后第二套）',
      mc['n']==2 and mc['cur']=='第二套改名',mc)
    pg.reload();pg.wait_for_function("window.__app&&window.__app.notes",timeout=9000)
    time.sleep(0.3)
    mp=pg.evaluate("""()=>({n:window.__app.AIs.all().length,
      cur:(window.__app.AIs.current()||{}).name})""")
    check('多配置与当前选择持久化（reload 后保持）',
      mp['n']==2 and mp['cur']=='第二套改名',mp)

    # ===== 连通性测试 =====
    t_empty=pg.evaluate("""async()=>await window.__app.testAiConn({})""")
    check('空地址给出明确提示',not t_empty['ok'] and '地址' in t_empty['msg'],t_empty)
    t_scheme=pg.evaluate("""async()=>await window.__app.testAiConn({baseUrl:'ftp://x.com'})""")
    check('非 http(s) 地址被拦截',not t_scheme['ok'] and 'http' in t_scheme['msg'],t_scheme)
    t_ok=pg.evaluate("""async()=>await window.__app.testAiConn(
      {baseUrl:'http://127.0.0.1:8791/v1',key:'k',model:'m'})""")
    check('真实 200 端点连通成功并报延迟',t_ok['ok'] and t_ok.get('ms',0)>=0,t_ok)
    t_401=pg.evaluate("""async()=>await window.__app.testAiConn(
      {baseUrl:'http://127.0.0.1:8792/v1',key:'bad',model:'m'})""")
    check('401 端点提示检查 API Key',not t_401['ok'] and 'Key' in t_401['msg'],t_401)

    # ===== 日志：产生 / 筛选 / 展开 / 清空 =====
    hasBoot=pg.evaluate("""()=>window.__app.Logs.list.some(e=>e.cat==='启动')""")
    check('启动时写入启动日志',hasBoot)
    pg.evaluate("()=>window.__app.createNote('note')");time.sleep(0.3)
    hasCreate=pg.evaluate("""()=>window.__app.Logs.list.some(
      e=>e.cat==='便签'&&e.msg.indexOf('新建')>=0)""")
    check('新建便签写入日志',hasCreate)
    pg.evaluate("()=>window.__app.Logs.error('测试类','测试错误X','详情内容Y')")
    # 进入日志页，筛选错误
    pg.evaluate("()=>{location.hash='#/log';}");time.sleep(0.5)
    pg.evaluate("()=>document.querySelector('#logFilter [data-lv=error]').click()");time.sleep(0.4)
    filt=pg.evaluate("""()=>{
      var rows=[...document.querySelectorAll('#logList .log-row')];
      return {n:rows.length,allErr:rows.every(r=>r.querySelector('.lr-lv.error')),
        hasMsg:rows.some(r=>r.querySelector('.lr-msg').textContent.indexOf('测试错误X')>=0)};
    }""")
    check('日志可按错误等级筛选',filt['n']>=1 and filt['allErr'] and filt['hasMsg'],filt)
    # 展开详情
    pg.evaluate("""()=>{
      var rows=[...document.querySelectorAll('#logList .log-row')];
      var r=rows.find(x=>x.querySelector('.lr-msg').textContent.indexOf('测试错误X')>=0);
      if(r)r.click();
    }""");time.sleep(0.2)
    detail=pg.evaluate("""()=>{
      var r=[...document.querySelectorAll('#logList .log-row')].find(
        x=>x.classList.contains('open'));
      return r?r.querySelector('.lr-detail').textContent:null;
    }""")
    check('点日志行可展开异常详情',detail=='详情内容Y',detail)
    # 清空
    pg.evaluate("()=>document.getElementById('logClear').click()");time.sleep(0.3)
    pg.evaluate("()=>document.getElementById('lcOk').click()");time.sleep(0.3)
    check('日志可清空',pg.evaluate("()=>window.__app.Logs.list.length===0"))

    check('全程无 pageerror',len(errs)==0,errs)
    print('\n'+'='*60);fails=0
    for n,st,det in R:
        print(f'[{st}] {n}'+(('  -> '+det) if st=='FAIL' else ''))
        if st=='FAIL':fails+=1
    print('='*60)
    print(f'TOTAL {len(R)}  PASS {len(R)-fails}  FAIL {fails}')
