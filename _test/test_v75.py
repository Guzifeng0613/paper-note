from playwright.sync_api import sync_playwright
import time
CHROME='/opt/vm/preinstall/ms-playwright/chromium-1169/chrome-linux/chrome'
URL='file:///home/user/Doubao/chats/38443854002369026/notes-app/index.html'
R=[]
def check(n,c,d=''):R.append((n,'PASS' if c else 'FAIL',str(d)))

with sync_playwright() as p:
    b=p.chromium.launch(executable_path=CHROME,args=['--allow-file-access-from-files'])
    ctx=b.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
    pg=ctx.new_page()
    errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto(URL)
    pg.wait_for_function("window.__app&&window.__app.notes.length>0",timeout=9000)
    time.sleep(0.6)

    # ---- A. 唯一空行退格 → 删除并退出待办 ----
    pg.evaluate("()=>window.__app.createNote('todo')");time.sleep(0.6)
    pg.click('#paperTodo textarea.pt-text');time.sleep(0.2)
    pg.keyboard.press('Backspace');time.sleep(0.4)
    a=pg.evaluate("()=>{var n=window.__app.cur();return n.type==='note'&&!document.querySelector('#paperTodo').classList.contains('show');}")
    check('唯一空行退格→退出待办',a)

    # ---- B. 多行：第二空行退格只删空行 ----
    pg.evaluate("()=>window.__app.createNote('todo')");time.sleep(0.6)
    ta='#paperTodo textarea.pt-text'
    pg.click(ta);time.sleep(0.2)
    pg.fill(ta,'第一项任务');time.sleep(0.2)
    pg.keyboard.press('Enter');time.sleep(0.5)
    check('回车新增到2行',pg.evaluate("()=>window.__app.cur().todos.length")==2)
    pg.keyboard.press('Backspace');time.sleep(0.4)
    one=pg.evaluate("()=>{var n=window.__app.cur();return n.todos.length===1&&n.todos[0].text==='第一项任务';}")
    check('空行退格只删空行、保留上一条',one)

    # ---- C. RAG 切片 ----
    longtext='知识'*200
    info=pg.evaluate("""(longtext)=>{
      window.__app.createNote('note');
      var n=window.__app.cur();
      n.title='RAG测试';n.tags=['工作','想法'];n.notebook='工作';
      n.content='<p>开头引言段落。</p><p>'+longtext+'</p>';
      n.todos=[{id:'t1',text:'待验证',done:false,priority:'normal'}];
      var ch=window.__app.noteToChunks(n);
      return {
        n:ch.length,
        keys:ch.every(c=>c.note_id&&c.title&&Array.isArray(c.tags)&&
          typeof c.chunk_index==='number'&&c.text&&c.created_at&&c.updated_at),
        seq:ch.map(c=>c.chunk_index).join(','),
        todo:ch.some(c=>c.kind==='todo'&&c.text.indexOf('待验证')>=0),
        textn:ch.filter(c=>c.kind==='text').length,
        src:ch.every(c=>c.note_id===n.id)
      };
    }""",longtext)
    check('切片含完整元数据',info['keys'])
    check('切片溯源到原便签',info['src'])
    check('chunk_index 从0连续',info['seq']==','.join(str(i) for i in range(info['n'])),info['seq'])
    check('待办生成切片',info['todo'])
    check('段落分开且长文切多片',info['textn']>=3,info['textn'])

    # ---- D. 标签实心醒目 ----
    tag=pg.evaluate("""()=>{
      var n=window.__app.notes.find(x=>x.tags&&x.tags.length&&!x.trashed);
      window.__app.setEditing(n.id);window.__app.renderEditor();
      var el=document.querySelector('#paperTags .qtag.on');
      if(!el)return false;
      var pine=getComputedStyle(document.documentElement).getPropertyValue('--pine').trim();
      var d=document.createElement('div');d.style.color=pine;document.body.appendChild(d);
      var rgb=getComputedStyle(d).color;d.remove();
      return getComputedStyle(el).backgroundColor===rgb;
    }""")
    check('标签为实心主色（更醒目）',tag)

    check('全程无pageerror',len(errs)==0,errs)
    print('\n'+'='*60)
    fails=0
    for n,st,det in R:
        print(f'[{st}] {n}'+(('  -> '+det) if st=='FAIL' else ''))
        if st=='FAIL':fails+=1
    print('='*60)
    print(f'TOTAL {len(R)}  PASS {len(R)-fails}  FAIL {fails}')
