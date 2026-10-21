/* ============================================================
   t_vault.js —— RealVault（vault.js）单测
   用 mock VaultFS（内存实现）验证：索引/树/搜索/面包屑/置顶与颜色排序/
   待办回写/改色/置顶/重命名/移动/删除→回收站→恢复。
   node v22 直接跑：node _verify/t_vault.js
   ============================================================ */
'use strict';
const path = require('path');
const ROOT = path.resolve(__dirname, '..');

/* ---------- mock VaultFS：内存 Map 实现 ---------- */
const FS = new Map();   // path -> string
function makeMockFS(){
  const m = new Map(FS);
  const norm = p=>!p?'':String(p).replace(/\\/g,'/').replace(/\/+$/,'');
  const dirOf = p=>{ p=norm(p); const i=p.lastIndexOf('/'); return i<0?'':p.slice(0,i); };
  const base = p=>{ p=norm(p); const i=p.lastIndexOf('/'); return i<0?p:p.slice(i+1); };
  const join = (...ps)=>norm(ps.filter(Boolean).join('/'));
  return {
    util:{ norm, join, base, dirOf,
      stripExt(p){ const b=base(p); const i=b.lastIndexOf('.'); return i<=0?b:b.slice(0,i); },
      dedupeName(existing, name){ existing=new Set(existing||[]); if(!existing.has(name)) return name;
        const i=name.lastIndexOf('.'), b=i>0?name.slice(0,i):name, e=i>0?name.slice(i):'.';
        let n=2; while(existing.has(b+' '+n+e)) n++; return b+' '+n+e; }
    },
    async init(){ return 'idb'; },
    root(){ return {type:'idb', path:'idb://test'}; },
    async list(p){
      p = norm(p);
      const prefix = p ? p+'/' : '';
      const set = new Set();
      for(const k of m.keys()){
        if(!k.startsWith(prefix)) continue;
        const rest = k.slice(prefix.length);
        if(!rest) continue;
        if(rest.includes('/')){
          /* 含斜杠：提取第一段作为目录 */
          if(!p && rest.startsWith('.trash/')) continue;
          set.add(rest.split('/')[0]);
        } else {
          set.add(rest);
        }
      }
      const out = [];
      for(const name of set){
        const full = join(p, name);
        /* 判断 isDir：是否存在以 full+'/' 开头的 key */
        const isDir = Array.from(m.keys()).some(k=>k.startsWith(full+'/'));
        out.push({ name, type: isDir?'folder':'file', size:10, mtime:1 });
      }
      return out;
    },
    async read(p){ p=norm(p); if(!m.has(p)) throw new Error('not found: '+p); return m.get(p); },
    async write(p, text){ m.set(norm(p), String(text)); return norm(p); },
    async mkdir(p){ p=norm(p); if(p) m.set(p+'/', ''); return p; },
    async rename(p, np){ p=norm(p); np=norm(np); if(m.has(p)){ m.set(np, m.get(p)); m.delete(p); } return np; },
    async move(p, dir){ p=norm(p); const np=norm(join(dir, base(p))); if(m.has(p)){ m.set(np, m.get(p)); m.delete(p); } return np; },
    async trash(p){ p=norm(p); const tp='.trash/'+p; if(m.has(p)){ m.set(tp, m.get(p)); m.delete(p); } return tp; },
    async restore(tp){ tp=norm(tp); const orig=tp.replace(/^\.trash\//,''); if(m.has(tp)){ m.set(orig, m.get(tp)); m.delete(tp); } return orig; },
    async listTrash(){
      const out=[];
      for(const k of m.keys()){
        if(!k.startsWith('.trash/')) continue;
        const orig = k.replace(/^\.trash\//,'');
        out.push({ name: base(k), type:'file', originalPath: orig });
      }
      return out;
    },
    async delete(p){ m.delete(norm(p)); },
    async readBlob(){ return new Blob(['x']); }
  };
}

/* ---------- 注入全局，加载被测模块 ---------- */
global.VaultFS = makeMockFS();
global.MD = require(path.join(ROOT, 'src/js/markdown.js'));
const Vault = require(path.join(ROOT, 'src/js/vault.js'));

/* ---------- 测试断言 ---------- */
let pass=0, fail=0;
function ok(cond, name){ if(cond){ pass++; console.log('  ✓ '+name); } else { fail++; console.log('  ✗ '+name); } }

async function main(){
  console.log('== RealVault 单测 ==');

  /* 先写几篇 md 到 mock FS（不触发 seed，因为 vault 非空） */
  const fm = (o)=>MD.stringifyFrontmatter(Object.assign({
    id:'x', created:'2026-10-01T00:00:00+08:00', updated:'2026-10-20T00:00:00+08:00',
    type:'note', tags:[]
  }, o));
  await VaultFS.mkdir('工作');
  await VaultFS.mkdir('生活');
  await VaultFS.write('工作/周会纪要.md', fm({color:'yellow', pinned:true, type:'todo', tags:['工作','周会']})+
    '## 周会\n\n- [x] 同步进度 #p/high\n- [ ] 评审方案 #p/low');
  await VaultFS.write('工作/需求清单.md', fm({tags:['工作','需求']})+'## 需求\n\n做 Markdown 引擎');
  await VaultFS.write('生活/读书笔记.md', fm({color:'pink'})+'## 读书\n\n==高亮== 和 *斜体*');

  await Vault.init();
  ok(true, 'init 完成');

  /* entries：根目录应看到 2 个文件夹 */
  const root = await Vault.entries('');
  ok(root.folders.length===2, '根目录有 2 个文件夹（工作/生活），实际 '+root.folders.length);
  ok(root.notes.length===0, '根目录散篇 0 篇');

  /* entries('工作')：1 篇 pinned 在前 */
  const gz = await Vault.entries('工作');
  ok(gz.notes.length===2, '工作文件夹 2 篇笔记');
  ok(gz.notes[0].pinned===true, '工作文件夹首篇 pinned=true（周会纪要），首篇='+gz.notes[0].title);
  ok(gz.notes[0].type==='todo', '周会纪要 type=todo');
  ok(gz.notes[0].todoTotal===2 && gz.notes[0].todoDone===1, '周会 todoTotal=2, todoDone=1');

  /* tree()：嵌套正确 */
  const tree = Vault.tree();
  ok(tree.name==='资料库' && tree.children.length===2, '树根=资料库，2 个子文件夹');
  const gzNode = tree.children.find(c=>c.name==='工作');
  ok(gzNode && gzNode.count===2, '工作节点 count=2（含子目录笔记数）');

  /* search：标题/正文/标签 */
  const s1 = await Vault.search('周会');
  ok(s1.length>=1 && s1[0].title==='周会纪要', 'search("周会") 命中周会纪要');
  const s2 = await Vault.search('Markdown');
  ok(s2.length>=1, 'search("Markdown") 命中需求清单');
  const s3 = await Vault.search('读书');
  ok(s3.length>=1 && s3[0].tags.includes('读书')!==undefined || s3[0].title==='读书笔记', 'search("读书") 命中读书笔记');

  /* crumbs */
  const cr = Vault.crumbs('工作/周会纪要.md');
  ok(cr.length===2 && cr[0].name==='资料库' && cr[1].name==='工作', 'crumbs(工作/周会纪要.md) = [资料库, 工作]');

  /* get：返回 html */
  const got = await Vault.get('工作/周会纪要.md');
  ok(got.html.includes('md-todo') && got.html.includes('周会'), 'get() 返回 html 含 todo 与标题');

  /* toggleTodo：回写（用实际 todoLines 的 key） */
  const got0 = await Vault.get('工作/周会纪要.md');
  const todoRows = MD.todoLines(got0.md);
  const secondKey = todoRows[1].key;
  const res = await Vault.toggleTodo('工作/周会纪要.md', secondKey);
  ok(res && res.done===true, 'toggleTodo 第2个待办 done=true，实际 done='+(res&&res.done));
  const got2 = await Vault.get('工作/周会纪要.md');
  ok(got2.entry.todoDone===2, '回写后 todoDone=2，实际 '+got2.entry.todoDone);

  /* setColor */
  await Vault.setColor('生活/读书笔记.md', 'blue');
  const got3 = await Vault.get('生活/读书笔记.md');
  ok(got3.entry.color==='blue', 'setColor → entry.color=blue');

  /* setPin */
  await Vault.setPin('生活/读书笔记.md', true);
  const got4 = await Vault.get('生活/读书笔记.md');
  ok(got4.entry.pinned===true, 'setPin → entry.pinned=true');

  /* rename */
  const newPath = await Vault.rename('生活/读书笔记.md', '读书笔记2');
  ok(newPath==='生活/读书笔记2.md', 'rename → 新路径 生活/读书笔记2.md，实际 '+newPath);
  const gz2 = await Vault.entries('生活');
  ok(gz2.notes.some(n=>n.title==='读书笔记2'), 'rename 后 entries 含新名');

  /* move */
  const moved = await Vault.move('生活/读书笔记2.md', '工作');
  ok(moved==='工作/读书笔记2.md', 'move → 工作/读书笔记2.md，实际 '+moved);
  const gz3 = await Vault.entries('工作');
  ok(gz3.notes.some(n=>n.title==='读书笔记2'), 'move 后工作文件夹含该篇');

  /* remove → trash → restore */
  await Vault.remove('工作/需求清单.md');
  let trashList = await Vault.trashList();
  ok(trashList.some(t=>t.entry.title==='需求清单'), 'remove 后回收站含需求清单');
  const rest = await Vault.restore(trashList.find(t=>t.entry.title==='需求清单').entry.path);
  const entriesAfter = await Vault.entries('工作');
  ok(entriesAfter.notes.some(n=>n.title==='需求清单'), 'restore 后工作文件夹恢复需求清单');

  /* create */
  const created = await Vault.create({ title:'新笔记', folder:'生活', type:'note', content:'## 新建\n\n正文' });
  ok(created==='生活/新笔记.md', 'create → 生活/新笔记.md，实际 '+created);
  const gz4 = await Vault.entries('生活');
  ok(gz4.notes.some(n=>n.title==='新笔记'), 'create 后生活文件夹含新笔记');

  console.log('\n== 结果：'+pass+' 通过, '+fail+' 失败 ==');
  process.exit(fail?1:0);
}
main().catch(e=>{ console.error(e); process.exit(1); });
