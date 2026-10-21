from playwright.sync_api import sync_playwright
import time
CHROME='/opt/vm/preinstall/ms-playwright/chromium-1169/chrome-linux/chrome'
URL='file:///home/user/Doubao/chats/38443854002369026/notes-app/index.html'
R=[]
def check(n,c,d=''):R.append((n,'PASS' if c else 'FAIL',str(d)))

DOCS=[
 '今天在洱海骑行，洱海骑行很开心。大理古城很美，住了古城民宿。晚上整理民宿照片，民宿很温馨。',
 '准备去大理，预订洱海附近民宿。大理古城的民宿很有特色，计划环洱海骑行，骑行路线看洱海。',
 '昆明到大理，洱海骑行路线推荐。古城民宿和大理美食都不错，洱海日落好看，民宿老板推荐古城。',
]

with sync_playwright() as p:
    b=p.chromium.launch(executable_path=CHROME,args=['--allow-file-access-from-files'])
    ctx=b.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
    pg=ctx.new_page()
    errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto(URL);pg.wait_for_function("window.__app&&window.__app.notes.length",timeout=9000)
    time.sleep(.4)

    # 1) 用自定义语料分析（生产环境无参=真实笔记）
    n=pg.evaluate("async(d)=>{await window.__app.TagMiner.analyze(d);return window.__app.prefs.tagSug.length;}",DOCS)
    check('分析产出候选标签',n>0,n)

    # 2) 期望的真标签被挖出
    hit=pg.evaluate("""()=>{var ws=window.__app.prefs.tagSug.map(o=>o.w);
      return ['洱海','大理','民宿','古城','骑行'].filter(w=>ws.includes(w)).length;}""")
    check('挖出高频主题词(洱海/大理/民宿/古城/骑行)',hit>=4,hit)

    # 3) 每个候选都合格
    ok=pg.evaluate("""()=>{var T=window.__app.TagMiner;
      return window.__app.prefs.tagSug.every(o=>T.good(o.w)&&o.w.length>=2&&!/^\\d+$/.test(o.w));}""")
    check('候选无停用词/虚字/单字/纯数字',ok)

    # 4) 时间/方位/代词停用词不出现
    no=pg.evaluate("""()=>{var ws=window.__app.prefs.tagSug.map(o=>o.w);
      return ['今天','晚上','准备','附近','我们','可以','什么'].every(w=>!ws.includes(w));}""")
    check('时间/方位/代词被自动过滤',no)

    # 5) 自动清洗：extraTags 放停用词，再分析后自动移出
    pg.evaluate("()=>window.__app.prefs.extraTags.push('我们')")
    pg.evaluate("async(d)=>await window.__app.TagMiner.analyze(d)",DOCS)
    check('正式库停用词被自动移出',
      not pg.evaluate("()=>window.__app.prefs.extraTags.includes('我们')"))

    # 6) 设置页：点候选主体 → 加入
    pg.evaluate("()=>location.hash='#/settings'");time.sleep(.7)
    check('设置页有高频词区',pg.query_selector('#tagMineBox .tm-chip') is not None)
    first=pg.query_selector('#tagMineBox .tm-chip');w=first.get_attribute('data-w')
    first.click();time.sleep(.4)
    check('点候选加入标签库',pg.evaluate("(w)=>window.__app.prefs.extraTags.includes(w)",w),w)

    # 7) 点 × 忽略 → 黑名单 + 消失
    time.sleep(.3)
    c2=pg.query_selector('#tagMineBox .tm-chip');w2=c2.get_attribute('data-w')
    c2.query_selector('.tm-x').click();time.sleep(.4)
    blocked=pg.evaluate("(w)=>window.__app.prefs.tagBlock.includes(w)",w2)
    gone=pg.evaluate("(w)=>![...document.querySelectorAll('#tagMineBox .tm-chip')].some(c=>c.dataset.w===w)",w2)
    check('点 × 忽略并进黑名单',blocked and gone,w2)

    # 8) 全部加入：黑名单外无遗漏
    pg.query_selector('#tmAddAll').click();time.sleep(.5)
    remain=pg.evaluate("""()=>{var t=window.__app,p=t.prefs;
      var lib=new Set(p.extraTags);
      t.notes.forEach(n=>n.tags.forEach(x=>lib.add(x)));
      return p.tagSug.filter(o=>!lib.has(o.w)&&!p.tagBlock.includes(o.w)).length;}""")
    check('全部加入后无遗漏(黑名单除外)',remain==0,remain)

    # 9) 黑名单恢复
    pg.query_selector('#tmBlockView').click();time.sleep(.3)
    rb=pg.query_selector('#tmBlockList [data-unblock]')
    if rb:
        bw=rb.get_attribute('data-unblock');rb.click();time.sleep(.4)
        check('黑名单可恢复',not pg.evaluate("(w)=>window.__app.prefs.tagBlock.includes(w)",bw),bw)
    else:
        check('黑名单可恢复(无项跳过)',True)

    check('全程无 pageerror',len(errs)==0,errs)
    print('\n'+'='*60);fails=0
    for n,st,det in R:
        print(f'[{st}] {n}'+(('  -> '+det) if st=='FAIL' else ''))
        if st=='FAIL':fails+=1
    print('='*60)
    print(f'TOTAL {len(R)}  PASS {len(R)-fails}  FAIL {fails}')
    b.close()
