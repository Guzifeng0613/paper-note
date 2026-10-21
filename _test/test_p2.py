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
    pg.goto(URL);pg.wait_for_function("window.__app&&window.__app.notes",timeout=9000)
    time.sleep(0.5)

    # 构造：多段长正文 + 独特词 + Markdown 表格
    pg.evaluate("""()=>{
      var f='我们在山里观察松茸的生长，记录湿度与光照，反复比对不同海拔的样本，整理成观察笔记。';
      var paras='';
      for(var i=0;i<18;i++)paras+='<p>'+f+'第'+i+'次记录松茸的采摘与保存细节。</p>';
      var q='<p>量子隧穿效应是微观粒子以一定概率穿越经典势垒的现象。</p>';
      var t='<pre>| 品种 | 产地 | 上市季节 |\\n|---|---|---|\\n'
        +'| 松茸 | 云南香格里拉 | 七到九月 |\\n'
        +'| 黑松露 | 意大利 | 十一月到次年三月 |\\n'
        +'| 羊肚菌 | 四川 | 春季 |</pre>';
      window.__app.notes.push({id:'n_p2_long',title:'山珍与物理笔记',type:'note',
        notebook:'知识库',tags:['知识库','研究'],pinned:false,trashed:false,color:'yellow',
        content:paras+q+t,todos:[],files:[]});
    }""")
    br=pg.evaluate("""async ()=>{
      var n=window.__app.notes.find(x=>x.id==='n_p2_long');
      return await window.__app.chunkNote(n);
    }""")
    print('BUILD',br)

    st=pg.evaluate("""async ()=>{
      var all=(await window.__app.KB.allChunks()).filter(c=>c.noteId==='n_p2_long');
      var parents=all.filter(c=>c.level==='parent');
      var children=all.filter(c=>c.level==='child');
      return {
        pc:parents.length,cc:children.length,
        linked:children.every(c=>c.parentId&&parents.some(p=>p.id===c.parentId)),
        maxChild:Math.max.apply(null,children.map(c=>c.text.length)),
        bigParent:parents.some(p=>p.text.length>320),
        tableWhole:parents.some(p=>p.text.indexOf('| 品种 | 产地 | 上市季节 |')>=0
          &&p.text.indexOf('羊肚菌')>=0&&p.text.indexOf('黑松露')>=0),
        crumbs:children.every(c=>c.crumbs.indexOf('山珍与物理笔记')>=0),
        tags:children.every(c=>c.tags.indexOf('知识库')>=0)
      };
    }""")
    print('STRUCT',st)
    check('产生多个父块与更多子块',st['pc']>=2 and st['cc']>=st['pc'],st)
    check('每个子块都挂到父块',st['linked'])
    check('父块比子块语义更完整',st['bigParent'])
    check('子块尺寸受控（≤301）',st['maxChild']<=301,st['maxChild'])
    check('表格整块不切断（含全部行）',st['tableWhole'])
    check('子块带面包屑溯源',st['crumbs'])
    check('子块继承标签',st['tags'])

    # overlap：某个多子块父块，相邻子块存在≥10字公共串
    ov=pg.evaluate("""async ()=>{
      var all=(await window.__app.KB.allChunks()).filter(c=>c.noteId==='n_p2_long');
      var byP={};
      all.filter(c=>c.level==='child').forEach(c=>{(byP[c.parentId]=byP[c.parentId]||[]).push(c);});
      for(var pid in byP){var cs=byP[pid];
        if(cs.length>=2){var a=cs[0].text,b=cs[1].text;
          for(var L=12;L>=10;L--)for(var i=0;i+L<=a.length;i++)
            if(b.indexOf(a.substr(i,L))>=0)return true;
          return false;}}
      return null;
    }""")
    check('相邻子块带重叠(overlap 10–15%)',ov is True,ov)

    # 检索：独特词（正文）
    r1=pg.evaluate("""async ()=>{
      var rs=await window.__app.knowledgeSearch('量子隧穿',{limit:10});
      if(!rs.length)return null;
      var r=rs[0];
      return {noteId:r.parent.noteId,isParent:r.parent.level==='parent',
        isChild:r.hit.level==='child',
        contains:r.parent.text.indexOf('量子隧穿效应')>=0,
        crumbs:r.parent.crumbs.indexOf('山珍与物理笔记')>=0};
    }""")
    check('检索命中独特词且返回父块(Small-to-Big)',
      r1 and r1['noteId']=='n_p2_long' and r1['isParent'] and r1['isChild']
      and r1['contains'] and r1['crumbs'],r1)

    # 检索：表格内容（noSplit 整块可被检索）
    r2=pg.evaluate("""async ()=>{
      var rs=await window.__app.knowledgeSearch('黑松露',{limit:10});
      return rs.some(r=>r.parent.noteId==='n_p2_long'
        &&r.parent.text.indexOf('意大利')>=0);
    }""")
    check('表格整块可检索并保留同行信息',r2)

    # 高亮函数
    hl=pg.evaluate("()=>window.__app.highlightText('松茸生长在高山','松茸')")
    check('检索词可高亮为 mark','<mark>松茸</mark>' in hl,hl)

    # AI 配置（多配置 UI 走一遍）
    pg.evaluate("()=>{location.hash='#/settings';}");time.sleep(0.6)
    pg.evaluate("()=>document.getElementById('aiCfgRow').click()");time.sleep(0.5)
    check('进入 API 配置列表页',pg.evaluate("()=>location.hash==='#/ai'"))
    pg.evaluate("()=>document.getElementById('aiAdd').click()");time.sleep(0.4)
    pg.fill('#cfName','测试号');pg.fill('#cfBase','https://api.example.com/v1')
    pg.fill('#cfKey','sk-test-123');pg.fill('#cfModel','gpt-test')
    pg.evaluate("()=>document.getElementById('cfSave').click()");time.sleep(0.4)
    ai=pg.evaluate("""()=>{var c=window.__app.AIs.current();
      return c?{name:c.name,base:c.baseUrl,key:c.key,model:c.model}:null;}""")
    check('新增配置保存并成为当前配置',
      ai and ai['name']=='测试号' and ai['base']=='https://api.example.com/v1'
      and ai['key']=='sk-test-123' and ai['model']=='gpt-test',ai)
    pg.evaluate("()=>{var b=document.querySelector('[data-close]');if(b)b.click();}")

    check('全程无 pageerror',len(errs)==0,errs)
    print('\n'+'='*60);fails=0
    for n,st,det in R:
        print(f'[{st}] {n}'+(('  -> '+det) if st=='FAIL' else ''))
        if st=='FAIL':fails+=1
    print('='*60)
    print(f'TOTAL {len(R)}  PASS {len(R)-fails}  FAIL {fails}')
