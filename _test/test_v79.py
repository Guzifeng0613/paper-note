from playwright.sync_api import sync_playwright
import time

CHROME='/opt/vm/preinstall/ms-playwright/chromium-1169/chrome-linux/chrome'
URL='file:///home/user/Doubao/chats/38443854002369026/notes-app/index.html'
R=[]
def check(n,c,d=''):R.append((n,'PASS' if c else 'FAIL',str(d)))

NOTE_JS="""(id,title)=>({id:id,title:title,body:title+'正文',type:'note',
  tags:[],todos:[],files:[],createdAt:Date.now(),updatedAt:Date.now()})"""

with sync_playwright() as p:
    b=p.chromium.launch(executable_path=CHROME,
        args=['--allow-file-access-from-files','--disable-web-security'])
    ctx=b.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
    pg=ctx.new_page()
    errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto(URL);pg.wait_for_function("window.__app&&window.__app.notes",timeout=9000)
    time.sleep(0.4)

    def modal_show():return pg.evaluate("()=>document.getElementById('modal').classList.contains('show')")
    def modal_txt():return pg.evaluate("()=>document.getElementById('modal').innerText")
    def close_modal():pg.evaluate("()=>window.__app.toast?0:0");pg.evaluate("()=>document.querySelector('#modal [data-close]')&&document.querySelector('#modal [data-close]').click()")

    # ---- 设置页：导入合并、导出分散、相似项简化 ----
    pg.evaluate("()=>document.getElementById('openSettings').click()");time.sleep(0.5)
    def has(id):return pg.query_selector('#'+id) is not None
    check('统一导入行存在',has('importUnifiedRow'))
    check('旧导入 zip 行已删',not has('importZipRow'))
    check('旧导入知识库包行已删',not has('kbImportRow'))
    check('旧导入 JSON 行已删',not has('importRow'))
    check('切片构建只留一行',has('kbBuildRow') and not has('kbBuildBgRow'))
    check('资料库冗余信息行已删',not has('libInfo'))
    check('云端恢复行存在',has('cloudPullRow'))
    check('导出：知识库包行在',has('kbExportRow'))
    check('导出：zip 行在',has('exportZipRow'))
    check('导出：切片 JSONL 行在',has('ragJsonlRow'))
    check('导出：Markdown 行在',has('ragMdRow'))
    check('导出：JSON 行在',has('exportRow'))
    pg.evaluate("()=>document.getElementById('settingsBack').click()");time.sleep(0.3)

    # ---- .json：识别为备份，覆盖 ----
    pg.evaluate("""async ()=>{
      var note=("""+NOTE_JS+""")('imp_a','导入甲');
      var f=new File([JSON.stringify({app:'zhipian-notes',notes:[note]})],'b.json',{type:'application/json'});
      await window.__app.unifiedHandleFile(f);
    }""");time.sleep(0.5)
    check('.json 弹出导入确认',modal_show())
    check('.json 来源标注 JSON',('JSON' in modal_txt()))
    pg.evaluate("()=>document.getElementById('uimo').click()");time.sleep(0.5)
    check('覆盖后只剩导入的 1 张',pg.evaluate("()=>window.__app.notes.length===1&&window.__app.notes[0].id==='imp_a'"))

    # ---- .json：合并 ----
    pg.evaluate("""async ()=>{
      var mk="""+NOTE_JS+""";
      var f=new File([JSON.stringify({app:'zhipian-notes',notes:[mk('imp_b','导入乙'),mk('imp_c','导入丙')]})],'b2.json',{type:'application/json'});
      await window.__app.unifiedHandleFile(f);
    }""");time.sleep(0.5)
    pg.evaluate("()=>document.getElementById('uimm').click()");time.sleep(0.5)
    check('合并后共 3 张',pg.evaluate("()=>{var ids=window.__app.notes.map(n=>n.id).sort().join(',');return window.__app.notes.length===3&&ids==='imp_a,imp_b,imp_c';}"))

    # ---- .jsonl：识别为切片，直接入库不弹确认 ----
    pg.evaluate("""async ()=>{
      var lines=[JSON.stringify({id:'jl1',noteId:'imp_a',text:'切片锚点XYZ 第一块'}),
                 JSON.stringify({id:'jl2',noteId:'imp_b',text:'切片锚点XYZ 第二块'})].join('\\n');
      var f=new File([lines],'chunks.jsonl',{type:'application/x-ndjson'});
      await window.__app.unifiedHandleFile(f);
    }""");time.sleep(0.8)
    check('.jsonl 不弹导入确认',not modal_show())
    check('.jsonl 切片已入库',pg.evaluate("""async ()=>{
      var all=await window.__app.KB.allChunks();
      return all.filter(c=>(c.text||'').indexOf('切片锚点XYZ')>=0).length===2;
    }"""))

    # ---- .zip：无 manifest → 备份 zip ----
    pg.evaluate("""async ()=>{
      var note=("""+NOTE_JS+""")('zip_a','压缩包甲');
      var z=new JSZip();z.file('library.json',JSON.stringify({notes:[note]}));
      var b=await z.generateAsync({type:'blob'});
      await window.__app.unifiedHandleFile(new File([b],'backup.zip'));
    }""");time.sleep(0.8)
    check('备份 zip 弹确认',modal_show())
    check('识别为备份 zip',('备份 zip' in modal_txt()))
    close_modal();time.sleep(0.3)

    # ---- .zip：有 manifest → 知识库包 ----
    pg.evaluate("""async ()=>{
      var note=("""+NOTE_JS+""")('kb_a','知识库包甲');
      var z=new JSZip();
      z.file('manifest.json',JSON.stringify({app:'zhipian-kb',kind:'knowledge-base',version:1,createdAt:new Date().toISOString()}));
      z.file('library.json',JSON.stringify({notes:[note]}));
      z.file('chunks.jsonl',JSON.stringify({id:'kbc1',noteId:'kb_a',text:'知识库包切片'})+'\\n');
      var b=await z.generateAsync({type:'blob'});
      await window.__app.unifiedHandleFile(new File([b],'export.kbpkg'));
    }""");time.sleep(0.8)
    check('知识库包弹确认',modal_show())
    check('识别为知识库包',('知识库包' in modal_txt()))
    close_modal();time.sleep(0.3)

    # ---- 不支持的后缀 ----
    pg.evaluate("""async ()=>{
      var f=new File(['hello'],'note.txt',{type:'text/plain'});
      await window.__app.unifiedHandleFile(f);
    }""");time.sleep(0.4)
    check('不支持后缀不弹确认',not modal_show())

    check('全程无 pageerror',len(errs)==0,errs)
    print('\n'+'='*60);fails=0
    for n,st,det in R:
        print(f'[{st}] {n}'+(('  -> '+det) if st=='FAIL' else ''))
        if st=='FAIL':fails+=1
    print('='*60);print(f'TOTAL {len(R)}  PASS {len(R)-fails}  FAIL {fails}')
    raise SystemExit(1 if fails else 0)
