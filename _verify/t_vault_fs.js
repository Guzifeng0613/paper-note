/* t_vault_fs.js —— VaultFS node 层单测
   覆盖：路径规范化/拼接/重名序号/回收站映射/附件目录/原子写临时名；
   mock Native 校验 native 后端调用序列与 payload 形状。
   运行：node _verify/t_vault_fs.js */
'use strict';
const path=require('path');
const VaultFS=require(path.join(__dirname,'..','src','js','vault-fs.js'));
const U=VaultFS.util;

let pass=0, fail=0;
const assert=(c,m)=>{ if(c){pass++;console.log('PASS:',m);} else {fail++;console.log('FAIL:',m);} };

/* ---------- 1. 路径规范化 ---------- */
assert(U.norm('')==='','norm 根目录为空串');
assert(U.norm('/')==='','norm 斜杠归一为空');
assert(U.norm('工作/周会纪要.md')==='工作/周会纪要.md','norm 原样保留');
assert(U.norm('//工作//周会纪要.md')==='工作/周会纪要.md','norm 压缩重复斜杠');
assert(U.norm('工作/./周会纪要.md')==='工作/周会纪要.md','norm 解析 .');
assert(U.norm('工作/生活/../周会纪要.md')==='工作/周会纪要.md','norm 解析 ..');
assert(U.norm('工作\\周会纪要.md')==='工作/周会纪要.md','norm 反斜杠转正');
assert(U.norm(' /工作/ ')==='工作','norm 去前后空白斜杠');

/* ---------- 2. join/base/dirOf ---------- */
assert(U.join('工作','周会纪要.md')==='工作/周会纪要.md','join 拼接');
assert(U.join('','周会纪要.md')==='周会纪要.md','join 根目录部件');
assert(U.join('工作','子','a.md')==='工作/子/a.md','join 多级');
assert(U.base('工作/周会纪要.md')==='周会纪要.md','base 取末段');
assert(U.base('周会纪要.md')==='周会纪要.md','base 根级文件');
assert(U.base('')==='','base 根目录空串');
assert(U.dirOf('工作/子/a.md')==='工作/子','dirOf 取目录');
assert(U.dirOf('a.md')==='','dirOf 根级文件为空');
assert(U.stripExt('周会纪要.md')==='周会纪要','stripExt 去后缀');
assert(U.stripExt('无后缀')==='无后缀','stripExt 无后缀原样');

/* ---------- 3. 重名序号 ---------- */
assert(U.dedupeName([],'周会纪要.md')==='周会纪要.md','dedupe 不冲突原名');
assert(U.dedupeName(['周会纪要.md'],'周会纪要.md')==='周会纪要 2.md','dedupe 首个冲突加 2');
assert(U.dedupeName(['周会纪要.md','周会纪要 2.md'],'周会纪要.md')==='周会纪要 3.md','dedupe 连续占用加 3');
assert(U.dedupeName(['a.md','a 5.md'],'a.md')==='a 2.md','dedupe 跳号从最小可用');
assert(U.dedupeName(['README'],'README')==='README 2','dedupe 无扩展名也加序号');

/* ---------- 4. 回收站映射 ---------- */
assert(U.trashOf('工作/周会纪要.md')==='.trash/工作/周会纪要.md','trashOf 保留相对结构');
assert(U.trashOf('周会纪要.md')==='.trash/周会纪要.md','trashOf 根级文件');
assert(U.restoreOf('.trash/工作/周会纪要.md')==='工作/周会纪要.md','restoreOf 还原相对结构');
assert(U.restoreOf('.trash/周会纪要.md')==='周会纪要.md','restoreOf 根级');
assert(U.restoreOf('工作/周会纪要.md')==='工作/周会纪要.md','restoreOf 非回收路径原样');

/* ---------- 5. 附件目录 / 原子写临时名 ---------- */
assert(U.attachDir('工作/周会纪要.md')==='attachments/周会纪要','attachDir 由笔记路径推导');
assert(U.attachDir('')==='attachments/未命名','attachDir 空路径兜底未命名');
assert(U.attachDir('attachments/周会纪要')==='attachments/周会纪要','attachDir 非 .md 路径按末段名去重目录');
assert(U.tmpPath('工作/周会纪要.md')==='工作/.周会纪要.md.tmp','tmpPath 同父目录隐藏临时文件');
assert(U.tmpPath('a.md')==='.a.md.tmp','tmpPath 根级文件');

/* ---------- 6. mock Native：native 后端调用序列 ---------- */
/* node 无 FileReader：模拟二进制读（浏览器内原生可用） */
global.FileReader=class{ readAsDataURL(){ setTimeout(()=>{ this.result='data:application/octet-stream,QUJD'; this.onload&&this.onload(); },0); } };
const calls=[];
global.Native={ async call(method,payload){ calls.push({method,payload}); return mockImpl(method,payload); } };
function mockImpl(method,payload){
  switch(method){
    case 'vaultRoot': return {type:'private', path:'/data/data/com.zhipian.notes/files/vault'};
    case 'vaultList': return [{name:'a.md',type:'file',size:1, mtime:1}];
    case 'vaultRead': return '# 正文';
    case 'vaultWrite': case 'vaultMkdir': case 'vaultRename':
      return {path:payload.path, newPath:payload.newPath};
    case 'vaultMove': return payload.dirPath+'/'+payload.path.split('/').pop();
    case 'vaultTrash': return {trashPath:'.trash/'+payload.path};
    case 'vaultRestore': return {path:payload.path.replace(/^\.trash\//,'')};
    case 'vaultListTrash': return [];
    case 'vaultDelete': return {};
    case 'vaultReadBlob': return {b64:'aGVsbG8=', type:'text/plain'};
    case 'vaultWriteAttachment': return {path:'attachments/'+(payload.notePath?'x':'未命名')+'/'+payload.name};
    case 'vaultImportFile': return {path:'in/f.pdf', name:'f.pdf', size:10, type:'application/pdf'};
    case 'vaultBindFolder': return {type:'saf', path:'x'};
    case 'vaultExport': return {ok:true, bytes:123};
  }
}
(async()=>{
  const name=await VaultFS.init('native');
  assert(name==='native' && VaultFS.backend()==='native','init 强制 native 后端');
  calls.length=0;

  const root=await VaultFS.root();
  assert(calls[0].method==='vaultRoot' && root.type==='private','root → vaultRoot');

  const list=await VaultFS.list('工作');
  assert(calls[1].method==='vaultList' && calls[1].payload.path==='工作','list → vaultList 传 path');

  const text=await VaultFS.read('工作/a.md');
  assert(calls[2].method==='vaultRead' && text==='# 正文','read → vaultRead 返回文本');

  await VaultFS.write('工作/b.md','正文内容');
  const w=calls[3];
  assert(w.method==='vaultWrite' && w.payload.path==='工作/b.md' && w.payload.text==='正文内容','write → vaultWrite 原子写文本');

  await VaultFS.mkdir('工作/子目录');
  assert(calls[4].method==='vaultMkdir' && calls[4].payload.path==='工作/子目录','mkdir → vaultMkdir 递归建');

  await VaultFS.rename('工作/b.md','工作/c.md');
  assert(calls[5].method==='vaultRename' && calls[5].payload.path==='工作/b.md' && calls[5].payload.newPath==='工作/c.md','rename → vaultRename');

  const moved=await VaultFS.move('工作/c.md','生活');
  const mv=calls[6];
  assert(moved==='生活/c.md' && mv.method==='vaultMove' && mv.payload.path==='工作/c.md' && mv.payload.dirPath==='生活','move → 拼接目标后 vaultMove');

  const trashP=await VaultFS.trash('生活/c.md');
  assert(trashP==='.trash/生活/c.md','trash → 返回回收路径字符串');

  const orig=await VaultFS.restore('.trash/生活/c.md');
  assert(orig==='生活/c.md','restore → 返回原路径字符串');

  await VaultFS.listTrash(); assert(calls.filter(c=>c.method==='vaultListTrash').length===1,'listTrash → vaultListTrash');
  await VaultFS.delete('生活/c.md'); assert(calls[calls.length-1].method==='vaultDelete','delete → vaultDelete');

  const blob=await VaultFS.readBlob('attachments/x.jpg');
  assert(calls[calls.length-1].method==='vaultReadBlob' && blob.size===5 && blob.type==='text/plain','readBlob → base64 解码为 Blob');

  const rel=await VaultFS.writeAttachment('照片.jpg', {size:3}, '工作/周会纪要.md');
  const wa=calls[calls.length-1];
  assert(wa.method==='vaultWriteAttachment' && wa.payload.name==='照片.jpg' && wa.payload.notePath==='工作/周会纪要.md','writeAttachment → 原生落 attachments');

  const imp=await VaultFS.importFile('content://x', '导入');
  assert(imp.name==='f.pdf' && imp.size===10,'importFile → vaultImportFile 返回 {path,name,size,type}');

  await VaultFS.bindFolder(); assert(calls[calls.length-1].method==='vaultBindFolder','bindFolder → vaultBindFolder');
  const exp=await VaultFS.exportZip(); assert(exp.ok===true && exp.bytes===123,'exportZip → vaultExport 返回 {ok,bytes}');

  /* ---------- 7. 路径防逃逸：归一化层拒绝 .. 上跳语义（vault 内允许相对，禁止逃逸根） ---------- */
  assert(!U.norm('../etc/passwd').startsWith('..') && U.norm('../etc/passwd')==='etc/passwd','norm 消费起始 .. 防逃逸');
  assert(U.norm('a/../../b')==='b','norm 多层 .. 收敛');

  console.log('\n==== 结果：PASS '+pass+' / FAIL '+fail+' ====');
  process.exit(fail?1:0);
})().catch(e=>{ console.error('FATAL', e); process.exit(1); });
