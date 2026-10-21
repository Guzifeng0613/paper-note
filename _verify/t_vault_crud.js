/* t_vault_crud.js —— VaultFS 浏览器层 CRUD 验收（opfs + idb 双后端）
   在 headless chromium 内加载 src/js/vault-fs.js，对真实后端做完整 CRUD：
   建目录/写读/覆盖写/重命名/移动/回收站/恢复/重名序号/附件/删除，无 pageerror。
   运行：node _verify/t_vault_crud.js */
'use strict';
const {chromium}=require('playwright');
const fs=require('fs');
const path=require('path');
const http=require('http');
const EXE='/opt/vm/preinstall/ms-playwright/chromium_headless_shell-1169/chrome-linux/headless_shell';

/* file:// 下 OPFS 被判非安全上下文；起 localhost 静态服务（Chromium 视 localhost 为可信） */
const ROOT=path.resolve(__dirname,'..');
const MIME={'.html':'text/html','.js':'text/javascript'};
const server=http.createServer((req,res)=>{
  const f=path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  fs.readFile(f,(e,d)=>{ if(e){res.writeCode=404;res.end('nf');return;}
    res.setHeader('Content-Type', MIME[path.extname(f)]||'application/octet-stream'); res.end(d); });
});
const listen=()=>new Promise(r=>server.listen(0,'127.0.0.1',()=>r(server.address().port)));

const SRC=fs.readFileSync(path.join(__dirname,'..','src','js','vault-fs.js'),'utf8');

/* 在页面内执行的完整 CRUD 流程；返回 {backend, steps:{...}, errors:[]} */
const PAGE_PROBE = `async ({src, force}) => {
  const out={backend:null, steps:{}, errors:[]};
  const rec=(k,v)=>{ out.steps[k]=v; };
  try{
    const s=document.createElement('script'); s.textContent=src; document.head.appendChild(s);
    const V=window.VaultFS; if(!V) throw new Error('VaultFS 未挂全局');
    out.backend=await V.init(force||undefined);
    /* 全新浏览器上下文，idb 库为空白，无需删库（避免与已开连接竞态） */
    const names=async(p)=>(await V.list(p)).map(e=>e.name).sort();
    const has=async(p,n)=>(await names(p)).includes(n);

    /* 建目录 */
    await V.mkdir('工作'); await V.mkdir('生活');
    rec('listRootAfterMkdir', await names(''));          // 应为 [工作,生活]（隐藏 .trash）

    /* 写 + 读 + 覆盖写（原子写） */
    await V.write('工作/周会纪要.md', '## 周会\\n- [ ] 事项\\n');
    rec('readWork', await V.read('工作/周会纪要.md'));
    await V.write('工作/周会纪要.md', '## 周会 v2\\n');
    rec('readOverwrite', await V.read('工作/周会纪要.md'));
    rec('noTmpVisible', await has('','.周会纪要.md.tmp')); // 原子写临时文件不得残留

    rec('listWork', await names('工作'));

    /* 重命名 */
    await V.rename('工作/周会纪要.md','工作/周会记录.md');
    rec('afterRename', await names('工作'));

    /* 移动到文件夹 */
    const moved=await V.move('工作/周会记录.md','生活');
    rec('movedPath', moved);
    rec('workEmpty', await names('工作'));
    rec('lifeHas', await names('生活'));

    /* 回收站三连 + listTrash */
    await V.write('a.md','1');
    const t1=await V.trash('a.md');
    await V.write('a.md','2');
    const t2=await V.trash('a.md');
    await V.write('a.md','3');
    const t3=await V.trash('a.md');
    rec('trashPaths',[t1,t2,t3]);                        // .trash/a.md / .trash/a 2.md / .trash/a 3.md
    const lt=await V.listTrash();
    rec('listTrashCount', lt.length);
    rec('listTrashOrigins', lt.map(e=>e.originalPath).sort());
    rec('rootNoTrashDir', await has('','.trash'));       // 根目录不显示 .trash

    /* 恢复：先在根目录占位一个 a.md，恢复遇占用 → 自动加序号 */
    await V.write('a.md','OCCUPY');
    const r1=await V.restore(t1);
    rec('restoreDeduped', r1);                           // 应恢复为 a 2.md
    rec('afterRestoreRoot', await names(''));

    /* 附件：落 attachments/<笔记名>/ + 二进制回读 */
    const att=await V.writeAttachment('白板.jpg', new Blob(['JPG-DATA'],{type:'image/jpeg'}), '生活/周会记录.md');
    rec('attachmentPath', att);
    const blob=await V.readBlob(att);
    rec('attachmentBytes', blob.size);

    /* 彻底删除：回收站剩 t2/t3；根目录占着 a.md，恢复出 a 2.md */
    await V.delete(t2); await V.delete(t3);
    rec('trashAfterDelete', (await V.listTrash()).length);
    await V.delete('a.md'); await V.delete('a 2.md');
    await V.delete('生活');
    await V.delete('工作');
    await V.delete('attachments');
    rec('finalRoot', await names(''));
  }catch(e){ out.errors.push(e.message); }
  return out;
}`;

(async()=>{
  const probeFn=new Function('return ('+PAGE_PROBE+')')();
  const port=await listen();
  const b=await chromium.launch({headless:true,executablePath:EXE});
  const ctx=await b.newContext({viewport:{width:360,height:792},isMobile:true,hasTouch:true,reducedMotion:'no-preference',deviceScaleFactor:4});
  const page=await ctx.newPage();
  let errors=0; page.on('pageerror',e=>{errors++;console.log('[pageerror]',e.message);});
  const assert=(c,m)=>{ if(c)console.log('PASS:',m); else {console.log('FAIL:',m);process.exitCode=1;} };

  await page.goto('http://127.0.0.1:'+port+'/scratch/vault-crud.html');

  for(const force of ['opfs','idb']){
    const r=await page.evaluate(probeFn, {src:SRC, force:force});
    console.log('--- 后端:', r.backend, '---');
    assert(r.errors.length===0, `[${r.backend}] CRUD 流程无异常（${r.errors.join('；')||'干净'}）`);
    const s=r.steps;
    assert(JSON.stringify(s.listRootAfterMkdir)===JSON.stringify(['工作','生活']), `[${r.backend}] 建目录后根列表=[工作,生活] 且隐藏 .trash（实际 ${JSON.stringify(s.listRootAfterMkdir)}）`);
    assert(s.readWork==='## 周会\n- [ ] 事项\n', `[${r.backend}] 写入后读回一致`);
    assert(s.readOverwrite==='## 周会 v2\n', `[${r.backend}] 覆盖写后读回为最新（原子写生效）`);
    assert(s.noTmpVisible===false, `[${r.backend}] 原子写临时文件不残留`);
    assert(JSON.stringify(s.listWork)===JSON.stringify(['周会纪要.md']), `[${r.backend}] list 工作目录含 md`);
    assert(JSON.stringify(s.afterRename)===JSON.stringify(['周会记录.md']), `[${r.backend}] 重命名生效`);
    assert(s.movedPath==='生活/周会记录.md', `[${r.backend}] move 返回新路径`);
    assert(JSON.stringify(s.workEmpty)===JSON.stringify([]), `[${r.backend}] 移出后原目录空`);
    assert(JSON.stringify(s.lifeHas)===JSON.stringify(['周会记录.md']), `[${r.backend}] 目标目录含移动文件`);
    assert(JSON.stringify(s.trashPaths)===JSON.stringify(['.trash/a.md','.trash/a 2.md','.trash/a 3.md']), `[${r.backend}] 回收站保留相对结构+重名序号（${JSON.stringify(s.trashPaths)}）`);
    assert(s.listTrashCount===3, `[${r.backend}] listTrash 3 条`);
    assert(JSON.stringify(s.listTrashOrigins)===JSON.stringify(['a 2.md','a 3.md','a.md']), `[${r.backend}] listTrash 附 originalPath（剥 .trash/ 前缀，含重名序号）：${JSON.stringify(s.listTrashOrigins)}`);
    assert(s.rootNoTrashDir===false, `[${r.backend}] 根目录不暴露 .trash`);
    assert(s.restoreDeduped==='a 2.md', `[${r.backend}] 恢复遇占用自动加序号 → a 2.md（实际 ${s.restoreDeduped}）`);
    assert(s.attachmentPath==='attachments/周会记录/白板.jpg', `[${r.backend}] 附件落 attachments/<笔记名>/（实际 ${s.attachmentPath}）`);
    assert(s.attachmentBytes===8, `[${r.backend}] 附件二进制回读字节数一致（实际 ${s.attachmentBytes}）`);
    assert(s.trashAfterDelete===0, `[${r.backend}] 恢复 1 条后再彻底删除 2 条，回收站清空（实际 ${s.trashAfterDelete}）`);
    assert(JSON.stringify(s.finalRoot)===JSON.stringify([]), `[${r.backend}] 清理后根目录为空`);
  }

  assert(errors===0, `全程无 pageerror（共 ${errors}）`);
  await b.close(); server.close();
  console.log('\n==== 浏览器 CRUD 验收结束 ====');
})().catch(e=>{ console.error('FATAL', e); process.exit(1); });
