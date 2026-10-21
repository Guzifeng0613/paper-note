from playwright.sync_api import sync_playwright
from http.server import BaseHTTPRequestHandler, HTTPServer
import threading, json, time

CHROME='/opt/vm/preinstall/ms-playwright/chromium-1169/chrome-linux/chrome'
URL='file:///home/user/Doubao/chats/38443854002369026/notes-app/index.html'
R=[]
def check(n,c,d=''):R.append((n,'PASS' if c else 'FAIL',str(d)))

class H(BaseHTTPRequestHandler):
    def log_message(self,*a):pass
    def cors(self):
        self.send_header('Access-Control-Allow-Origin','*')
        self.send_header('Access-Control-Allow-Methods','GET,POST,OPTIONS')
        self.send_header('Access-Control-Allow-Headers','*')
    def do_OPTIONS(self):self.send_response(204);self.cors();self.end_headers()
    def do_POST(self):
        cl=int(self.headers.get('Content-Length',0));self.rfile.read(cl)
        body=json.dumps({'choices':[{'message':{'role':'assistant',
            'content':'这是根据知识库生成的回答，光合作用X 是植物利用光能的过程。[1]'}}]}).encode()
        self.send_response(200);self.send_header('Content-Type','application/json');self.cors()
        self.send_header('Content-Length',str(len(body)));self.end_headers();self.wfile.write(body)
srv=HTTPServer(('127.0.0.1',8795),H)
threading.Thread(target=srv.serve_forever,daemon=True).start()

with sync_playwright() as p:
    b=p.chromium.launch(executable_path=CHROME,
        args=['--allow-file-access-from-files','--disable-web-security'])
    ctx=b.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
    pg=ctx.new_page()
    errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto(URL);pg.wait_for_function("window.__app&&window.__app.notes",timeout=9000)
    time.sleep(0.4)

    # 首页：小气泡已移除；设置入口仍在
    check('首页小气泡已移除',pg.query_selector('#openAsk') is None)
    check('首页设置入口仍在',pg.query_selector('#openSettings') is not None)

    # 构造含独特词的便签并切片
    pg.evaluate("""()=>{
      var paras='';
      for(var i=0;i<10;i++)paras+='<p>光合作用X是植物、藻类利用光能把二氧化碳和水转化为有机物并释放氧气的过程，第'+i+'次记录其反应条件与产物。</p>';
      window.__app.notes.push({id:'n_sr',title:'光合笔记',type:'note',
        notebook:'知识库',tags:['研究'],pinned:false,trashed:false,color:'yellow',
        content:paras,todos:[],files:[]});
    }""")
    pg.evaluate("async()=>await window.__app.chunkNote(window.__app.notes.find(x=>x.id==='n_sr'))")
    time.sleep(0.3)

    # 进入统一搜索页
    pg.evaluate("()=>{location.hash='#/search';}");time.sleep(0.6)
    check('进入统一搜索页',pg.evaluate("()=>location.hash==='#/search'"))
    check('默认是搜索模式且有三个分段',
      pg.evaluate("()=>document.querySelector('#srSeg [data-m=search]').classList.contains('on')")
      and len(pg.query_selector_all('#srSeg button'))==3)

    # 正常搜索（实时）
    pg.fill('#srInput','光合作用X');time.sleep(0.5)
    check('搜索模式实时出结果并高亮',
      len(pg.query_selector_all('.sr-item'))>=1
      and len(pg.query_selector_all('.sr-item mark'))>=1)

    # 回车产生历史
    pg.evaluate("()=>{document.getElementById('srInput').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));}")
    time.sleep(0.3)
    check('回车确认写入历史',pg.evaluate("()=>window.__app.prefs.recents.includes('光合作用X')"))

    # RAG 模式
    pg.evaluate("()=>document.querySelector('#srSeg [data-m=rag]').click()");time.sleep(0.3)
    check('切到 RAG 模式',pg.evaluate("()=>window.__app.srMode==='rag'"))
    pg.evaluate("()=>{document.getElementById('srInput').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));}")
    pg.wait_for_selector('.ask-card',timeout=9000);time.sleep(0.3)
    ragok=pg.evaluate("""()=>{
      var cards=document.querySelectorAll('.ask-card');
      return {n:cards.length,hit:[...cards].some(c=>c.textContent.indexOf('光合作用X')>=0)};
    }""")
    check('RAG 回车检索出完整段落卡片',ragok['n']>=1 and ragok['hit'],ragok)

    # AI 模式：先配置指向假服务器
    pg.evaluate("""()=>{
      var c=window.__app.AIs.add({name:'本地假',baseUrl:'http://127.0.0.1:8795/v1',key:'k',model:'m'});
      window.__app.AIs.setCur(c.id);
    }""")
    pg.evaluate("()=>document.querySelector('#srSeg [data-m=ai]').click()");time.sleep(0.3)
    pg.evaluate("()=>{document.getElementById('srInput').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));}")
    pg.wait_for_selector('.ai-thread',timeout=12000);time.sleep(0.3)
    aiok=pg.evaluate("""()=>{
      var a=document.querySelector('.ai-thread');
      return {txt:a.querySelector('.aia-txt').textContent,
        refs:a.querySelectorAll('.aia-ref').length};
    }""")
    check('AI 回车生成回答',len(aiok['txt'])>0 and '光合作用X' in aiok['txt'],aiok)
    check('AI 回答带参考来源（可点击溯源）',aiok['refs']>=1,aiok)

    # 历史：清空输入 → 历史列表；单删；清空
    pg.evaluate("()=>document.querySelector('#srSeg [data-m=search]').click()");time.sleep(0.2)
    for kw in ['关键词甲','关键词乙']:
        pg.fill('#srInput',kw)
        pg.evaluate("()=>document.getElementById('srInput').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));")
        time.sleep(0.2)
    pg.fill('#srInput','');time.sleep(0.4)
    check('空查询显示历史列表行',len(pg.query_selector_all('.hist-row'))>=2)
    nbefore=pg.evaluate("()=>window.__app.prefs.recents.length")
    pg.evaluate("()=>document.querySelector('.hist-row .hr-del').click()");time.sleep(0.3)
    nafter=pg.evaluate("()=>window.__app.prefs.recents.length")
    check('历史可单条删除',nafter==nbefore-1,(nbefore,nafter))
    pg.evaluate("()=>document.getElementById('rhClear').click()");time.sleep(0.3)
    check('历史可一键清空',pg.evaluate("()=>window.__app.prefs.recents.length===0"))

    check('全程无 pageerror',len(errs)==0,errs)
    print('\n'+'='*60);fails=0
    for n,st,det in R:
        print(f'[{st}] {n}'+(('  -> '+det) if st=='FAIL' else ''))
        if st=='FAIL':fails+=1
    print('='*60)
    print(f'TOTAL {len(R)}  PASS {len(R)-fails}  FAIL {fails}')
