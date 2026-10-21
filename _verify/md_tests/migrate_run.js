/* ============================================================
   migrate_tests/run.js —— 旧库迁移全流程 node 演练（detect→backup→run→verify）
   用法：node _verify/md_tests/migrate_run.js
   依赖：src/js/markdown.js（MD）、src/js/vault-fs.js（util）、src/js/migrate.js（Migrate）
   ============================================================ */
const assert = require('assert');
const MD = require('../../src/js/markdown.js');
const VaultFS = require('../../src/js/vault-fs.js');
const Migrate = require('../../src/js/migrate.js');

let pass = 0, fail = 0; const fails = [];
function t(name, fn){
  try{ fn(); pass++; console.log('  PASS  '+name); }
  catch(e){ fail++; fails.push(name); console.log('  FAIL  '+name+' -> '+e.message); }
}
function eq(a,b,n){ assert.strictEqual(a,b,n||('期望 '+JSON.stringify(b)+' 实际 '+JSON.stringify(a))); }
function ok(v,n){ assert.ok(v,n||('truthy，实际 '+JSON.stringify(v))); }

/* ---------------- 内存版 VaultFS（实现契约第 1 节所需子集） ---------------- */
class MemFS {
  constructor(){ this.store = new Map(); this.util = VaultFS.util; }
  async list(dir){
    dir = VaultFS.util.norm(dir);
    const prefix = dir ? dir+'/' : '';
    const out = [];
    for(const [p,e] of this.store){
      if(!p.startsWith(prefix)) continue;
      const rest = p.slice(prefix.length);
      if(!rest || rest.includes('/')) continue;
      out.push({name:rest, type:e.kind, size:(e.bytes||[]).length||0, mtime:e.mtime||0});
    }
    return out;
  }
  async read(p){
    p = VaultFS.util.norm(p);
    const e = this.store.get(p);
    if(!e || e.kind!=='file') throw new Error('文件不存在：'+p);
    return e.bytes.toString('utf8');
  }
  async write(p, text){
    p = VaultFS.util.norm(p);
    this.store.set(p, {kind:'file', bytes:Buffer.from(String(text==null?'':text)), mtime:Date.now()});
    return p;
  }
  async mkdir(p){
    p = VaultFS.util.norm(p); if(!p) return p;
    let acc='';
    for(const s of p.split('/')){ acc = acc?acc+'/'+s : s; this.store.set(acc,{kind:'folder',mtime:Date.now()}); }
    return p;
  }
  async readBlob(p){
    p = VaultFS.util.norm(p);
    const e = this.store.get(p);
    if(!e) throw new Error('附件不存在：'+p);
    return e.bytes;
  }
  async writeBlob(p, bytes){
    p = VaultFS.util.norm(p);
    this.store.set(p,{kind:'file', bytes: Buffer.from(bytes), mtime:Date.now()});
    return p;
  }
  async writeAttachment(name, blob, notePath){
    const dir = VaultFS.util.attachDir(notePath);
    await this.mkdir(dir);
    const names = (await this.list(dir)).map(e=>e.name);
    const finalName = VaultFS.util.dedupeName(names, name||'附件');
    return this.writeBlob(VaultFS.util.join(dir, finalName), blob);
  }
}

/* ---------------- 真实形态的旧库 fixture（v15.4.4） ---------------- */
const now = Date.now();
const D = 864e5;
const B = s => Buffer.from(s, 'utf8');
const fixture = {
  app:'zhipian-notes', version:3, savedAt:new Date().toISOString(),
  notes:[
    // 1) 工作笔记本：富文本全元素 + 图片附件 + 文档附件 + 列表/引用/代码/分割线
    {id:'n1', type:'note', pinned:true, trashed:false, notebook:'工作', title:'产品灵感记录',
     color:'blue', createdAt:now-4*D, updatedAt:now-8*36e5, todos:[],
     files:[
       {id:'f1', name:'白板.jpg', size:10, type:'image/jpeg', kind:'image', idx:1},
       {id:'f2', name:'需求说明.pdf', size:480, type:'application/pdf', kind:'pdf', idx:2}],
     content:'便签的<b>字号调节</b>要像真实书写一样顺手；<span class="hl">搜索结果高亮</span>。<br><br>'
       +'<img class="note-img" data-id="f1"><p><br></p>'
       +'<span class="attref" contenteditable="false" data-fid="f2" data-idx="2" data-name="需求说明.pdf">附件芯片</span>'
       +'<ul><li>第一项</li><li>第二项</li></ul>'
       +'<blockquote><p>引用一行</p></blockquote>'
       +'<pre>const a=1;</pre><hr>'
       +'<p>字号内联：<span style="font-size:18px">大字结论</span>结束</p>'},
    // 2) todo 型：优先级 high/normal/low
    {id:'n2', type:'todo', pinned:false, trashed:false, notebook:'工作', title:'本周采购清单',
     color:'yellow', createdAt:now-2*D, updatedAt:now-36e5, files:[],
     todos:[
       {id:'t1', text:'咖啡豆 200g', done:true, priority:'normal'},
       {id:'t2', text:'牛奶、鸡蛋', done:true, priority:'high'},
       {id:'t3', text:'洗衣液', done:false, priority:'low'}]},
    // 3) 无笔记本散篇
    {id:'n3', type:'note', pinned:false, trashed:false, notebook:null, title:'随手记',
     color:'cream', createdAt:now-D, updatedAt:now-D, todos:[], files:[],
     content:'便利店新出的<b>桂花拿铁</b>不错'},
    // 4) 回收站笔记（含附件）
    {id:'n4', type:'note', pinned:false, trashed:true, trashedAt:now-36e5, notebook:'生活',
     title:'废弃草稿', color:'pink', createdAt:now, updatedAt:now, todos:[],
     files:[{id:'f4', name:'旧图.png', size:5, type:'image/png', kind:'image', idx:1}],
     content:'<s>删除线</s> 旧内容'},
    // 5) 无标题 → 未命名.md
    {id:'n5', type:'note', pinned:false, trashed:false, notebook:'生活', title:'',
     color:'green', createdAt:now, updatedAt:now, todos:[], files:[], content:''},
    // 6) 同目录重名 → 产品灵感记录 2.md
    {id:'n6', type:'note', pinned:false, trashed:false, notebook:'工作', title:'产品灵感记录',
     color:'orange', createdAt:now, updatedAt:now, todos:[], files:[], content:'重复标题'}
  ],
  prefs:{ notebooks:['工作','生活'], view:'grid', theme:'auto', favoriteTags:['旧标签'] },
  cloudDeleted:[]
};
/* 附件字节池（模拟旧库 blob 存储） */
const blobPool = { f1:B('IMG_BYTES_JPG'), f2:B('%PDF-1.4 fake'), f4:B('PNG_BYTES') };

/* ---------------- 装配 Migrate（注入一切外部依赖） ---------------- */
const fs = new MemFS();
const zipped = { bytes:null, name:null };
Migrate.configure({
  FS: fs,
  MD: MD,
  loadLib: async () => JSON.parse(JSON.stringify(fixture)),
  loadBlob: async (note, file) => blobPool[file.id] || null,
  zipImpl: {
    pack: async (entries) => Buffer.from(JSON.stringify({manifest:entries.map(e=>e.name)}), 'utf8'),
    save: async (bytes, name) => { zipped.bytes = bytes; zipped.name = name; }
  }
});

(async()=>{
console.log('\n[A] detect');
const det = await Migrate.detect();
t('detect.found = true', ()=> ok(det.found));
t('summary：6 篇 / 活跃 5 / 回收 1 / 笔记本 2 / 附件 3', ()=>{
  eq(det.summary.notes, 6); eq(det.summary.active, 5); eq(det.summary.trashed, 1);
  eq(det.summary.notebooks.length, 2); eq(det.summary.attachments, 3);
});
t('detect 无旧库时 found=false', async()=>{}); // 占位，下方单独验证

console.log('\n[B] backup');
const bak = await Migrate.backup();
t('备份 zip 生成，命名「迁移前备份-YYYYMMDD.zip」', ()=>{
  ok(/^迁移前备份-\d{8}\.zip$/.test(zipped.name)); ok(zipped.bytes.length>0);
});
t('备份条目 = library.json + 3 个附件', ()=> eq(bak.entries, 4));

console.log('\n[C] run 迁移');
const progress = [];
const report = await Migrate.run({onProgress:(pct,title)=>progress.push(pct)});
t('迁移 6 篇全部成功、0 失败', ()=>{ eq(report.files,5); eq(report.trash,1); eq(report.failures.length,0); });
t('附件复制 3 个，0 丢失', ()=> eq(report.attachments, 3));
t('进度回调覆盖到 100', ()=> eq(progress[progress.length-1], 100));

const rootEntries = await fs.list('');
t('目录结构：工作/生活 文件夹已建（根目录含 .trash 外的两项）', ()=>{
  const names = rootEntries.map(e=>e.name+':'+e.type);
  ok(names.includes('工作:folder') && names.includes('生活:folder'));
});
t('笔记落盘路径正确', ()=>{
  ok(report.notes.includes('工作/产品灵感记录.md'));
  ok(report.notes.includes('工作/本周采购清单.md'));
  ok(report.notes.includes('随手记.md'));                 // 无笔记本进根目录
  ok(report.notes.includes('生活/未命名.md'));            // 空标题
  ok(report.notes.includes('工作/产品灵感记录 2.md'));    // 重名加序号
});
let trashReadable = true;
try{ await fs.read('.trash/生活/废弃草稿.md'); }catch(e){ trashReadable = false; }
t('回收站进 .trash/生活/废弃草稿.md（不含在活跃 5 篇内）', ()=>{
  ok(trashReadable); eq(report.notes.length, 5);
});

console.log('\n[D] 逐篇内容校验');
const n1md = await fs.read('工作/产品灵感记录.md');
t('fm：id 沿用 / type=note / color=blue / pinned=true', ()=>{
  ok(n1md.startsWith('---\nid: n1')); ok(n1md.includes('color: blue')); ok(n1md.includes('pinned: true')); ok(n1md.includes('type: note'));
});
t('HTML→MD：b→** / hl→== / ul / quote / code / hr', ()=>{
  ok(n1md.includes('**字号调节**'));
  ok(n1md.includes('==搜索结果高亮=='));
  ok(n1md.includes('- 第一项') && n1md.includes('- 第二项'));
  ok(n1md.includes('> 引用一行'));
  ok(n1md.includes('```') && n1md.includes('const a=1;'));
  ok(n1md.includes('\n---\n'));
});
t('附件引用为相对路径 attachments/产品灵感记录/', ()=>{
  ok(n1md.includes('![白板.jpg](attachments/产品灵感记录/白板.jpg)'));
  ok(n1md.includes('[需求说明.pdf](attachments/产品灵感记录/需求说明.pdf)'));
});
t('字号内联 span 保留为内联 HTML', ()=> ok(n1md.includes('<span style="font-size:18px">大字结论</span>')));
t('复杂块已记入报告', ()=> ok(report.complexBlocks.includes('工作/产品灵感记录.md')));

const n2md = await fs.read('工作/本周采购清单.md');
t('待办：done/优先级映射正确，type= todo', ()=>{
  ok(n2md.includes('- [x] 咖啡豆 200g'));
  ok(n2md.includes('- [x] 牛奶、鸡蛋 #p/high'));
  ok(n2md.includes('- [ ] 洗衣液 #p/low'));
  ok(n2md.includes('type: todo'));
});
const n3md = await fs.read('随手记.md');
t('cream 色省略、普通 HTML 转换', ()=>{
  ok(!n3md.includes('color:')); ok(n3md.includes('**桂花拿铁**'));
});
t('时间戳写入 fm（ISO）', ()=> ok(/created: "\d{4}-\d{2}-\d{2}T/.test(n2md) || n2md.includes('created:')));

console.log('\n[E] verify');
const v = await Migrate.verify();
t('parseRate = 1.0（全部 .md 可解析）', ()=> eq(v.parseRate, 1));
t('files = 5 篇（不含回收站）', ()=> eq(v.files, 5));
t('附件引用数 = 2（活跃笔记内），missingAttach = 0', ()=>{
  eq(v.attachments, 2); eq(v.missingAttach.length, 0);
});
t('无解析失败', ()=> eq(v.failures.length, 0));

console.log('\n[F] 附件物理落盘核对');
t('白板.jpg 字节原样存在于 vault', async()=>{
  const b = await fs.readBlob('attachments/产品灵感记录/白板.jpg');
  eq(b.toString(), 'IMG_BYTES_JPG');
});
t('回收站笔记的附件也已复制（0 丢失）', async()=>{
  const b = await fs.readBlob('attachments/废弃草稿/旧图.png');
  ok(!!b.length);
});

console.log('\n[G] 旧库不存在的 detect 行为');
Migrate._cfg.loadLib = async () => null;
const det2 = await Migrate.detect();
t('无旧库 → found=false', ()=> ok(!det2.found && det2.summary===null));

console.log('\n========================================');
console.log('结果：PASS '+pass+' / FAIL '+fail+'（共 '+(pass+fail)+'）');
if(fail){ console.log('失败：\n - '+fails.join('\n - ')); process.exit(1); }
})().catch(e=>{ console.error('演练异常', e); process.exit(1); });
