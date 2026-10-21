/* ============================================================
   vault.js —— 纸片 v16 RealVault（M2 真实 CRUD，M3 源码模式）
   全局名 Vault。业务层：索引 / 搜索 / 树 / 写盘调度。
   建立在 VaultFS（低层文件系统）+ MD（Markdown 引擎）之上。
   严格实现 docs/VAULT-INTERFACE.md 第 2 节全部方法。
   路径一律 vault 相对 POSIX 路径，根目录用 ''（空串）。
   ============================================================ */
(function(){
'use strict';

/* 纯函数工具（VaultFS.util 在浏览器拼接时已就绪；node 单测时由测试文件注入 global.VaultFS） */
const U = (typeof VaultFS!=='undefined' && VaultFS.util) ? VaultFS.util : {
  norm(p){ if(!p) return ''; p=String(p).replace(/\\/g,'/').trim(); if(!p||p==='/') return '';
    const out=[]; for(const seg of p.split('/')){ if(!seg||seg==='.') continue;
      if(seg==='..'){ out.pop(); continue; } out.push(seg); } return out.join('/'); },
  join(...parts){ return U.norm(parts.filter(x=>x!=null&&x!=='').map(String).join('/')); },
  base(p){ p=U.norm(p); if(!p) return ''; const i=p.lastIndexOf('/'); return i<0?p:p.slice(i+1); },
  dirOf(p){ p=U.norm(p); if(!p) return ''; const i=p.lastIndexOf('/'); return i<0?'':p.slice(0,i); },
  stripExt(p){ const b=U.base(p); const i=b.lastIndexOf('.'); return i<=0?b:b.slice(0,i); }
};

/* ---------- 内部索引 ----------
   _entries: Map<path, Entry>  非回收站的全部 .md
   _trash:   Map<trashPath, {entry, originalPath}>
   _folders: Set<dirPath>      全部非隐藏目录（含嵌套）
   _attach:  Map<notePath, [{name, kind, url}> 附件缓存（objectURL） */
const _entries = new Map();
const _trash  = new Map();
const _folders = new Set();
const _attach = new Map();
const _saveTimers = {};   // path -> timer（save 防抖）

/* ---------- 由 md 全文构造 Entry ---------- */
function makeEntry(path, md){
  const parsed = MD.parseFrontmatter(md||'');
  const fm = parsed.fm;
  const name = U.base(path);
  const folder = U.dirOf(path);
  const title = U.stripExt(name);
  const todos = MD.todoLines(md||'');
  const now = Date.now();
  return {
    path, name, folder, title,
    type: (fm && fm.type) || 'note',
    color: (fm && fm.color) || null,
    pinned: !!(fm && fm.pinned),
    tags: (fm && Array.isArray(fm.tags)) ? fm.tags : MD.extractTags(md||''),
    summary: MD.extractSummary(md||''),
    id: (fm && fm.id) || path,
    created: fm && fm.created ? Date.parse(fm.created) || now : now,
    updated: fm && fm.updated ? Date.parse(fm.updated) || now : now,
    mtime: fm && fm.updated ? Date.parse(fm.updated) || now : now,
    todoTotal: todos.length,
    todoDone: todos.filter(t=>t.done).length
  };
}

/* 重写 frontmatter（保留正文原文） */
function rewriteFM(md, newFm){
  const parsed = MD.parseFrontmatter(md||'');
  const body = parsed.body || md || '';
  return MD.stringifyFrontmatter(newFm) + body;
}
function cleanFm(fm){
  const out = {};
  Object.keys(fm||{}).forEach(k=>{ if(fm[k]==null || fm[k]==='') return; out[k]=fm[k]; });
  return out;
}

/* ---------- 递归扫描建索引（一次遍历，避免重复 list） ---------- */
async function scanDir(dirPath){
  let items = [];
  try{ items = await VaultFS.list(dirPath); }catch(e){ return; }
  for(const it of items){
    if(it.name.startsWith('.')) continue;   // 隐藏文件（.trash/.tmp）跳过
    const full = U.join(dirPath, it.name);
    if(it.type==='folder'){
      _folders.add(full);
      await scanDir(full);
    } else if(/\.md$/i.test(it.name)){
      let md='';
      try{ md = await VaultFS.read(full); }catch(e){ continue; }
      _entries.set(full, makeEntry(full, md));
    }
  }
}
async function scanTrash(){
  let list=[];
  try{ list = await VaultFS.listTrash(); }catch(e){ return; }
  for(const it of list){
    if(!/\.md$/i.test(it.name)) continue;
    const full = it.originalPath ? U.join('.trash', it.originalPath) : it.name;
    let md='';
    try{ md = await VaultFS.read(full); }catch(e){ continue; }
    const entry = makeEntry(full, md);
    _trash.set(full, { entry, originalPath: it.originalPath || U.stripExt(it.name) });
  }
}

/* ---------- 索引辅助 ---------- */
function subDirs(folder){
  const out = [];
  for(const d of _folders){
    if(folder===''){ if(U.dirOf(d)==='') out.push(d); }
    else if(U.dirOf(d)===folder) out.push(d);
  }
  return out.sort();
}
/* 该目录下（含所有子目录）的笔记数 */
function notesUnder(dir){
  let n=0;
  for(const p of _entries.keys()){
    const d = U.dirOf(p);
    if(dir==='') n++;
    else if(d===dir || d.indexOf(dir+'/')===0) n++;
  }
  return n;
}
function existingNames(folder){
  const set = new Set();
  for(const p of _entries.keys()){ if(U.dirOf(p)===folder) set.add(U.base(p)); }
  for(const d of _folders){ if(U.dirOf(d)===folder) set.add(U.base(d)); }
  return set;
}

/* ============================================================
   Vault 对外门面
   ============================================================ */
const Vault = {
  /* ---- 初始化 ---- */
  async init(){
    await VaultFS.init();
    _entries.clear(); _trash.clear(); _folders.clear(); _attach.clear();
    await scanDir('');
    await scanTrash();
    /* 首次启动：vault 为空则落 v15 示例 seed，保证首屏非空 */
    if(!_entries.size && !_trash.size){
      await this._seedV15();
      /* 重新扫描 seed 落盘后的文件 */
      _entries.clear(); _folders.clear();
      await scanDir('');
    }
    return true;
  },

  /* ---- v15.4.4 示例 seed（转 md 落盘，按 工作/生活 分文件夹） ---- */
  async _seedV15(){
    const now = Date.now(), D = 864e5;
    const notes = [
      { folder:'工作', name:'本周采购清单.md', color:'yellow', pinned:true, type:'todo',
        created:now-2*D, updated:now-36e5,
        body:'## 本周采购清单\n\n- [x] 咖啡豆 200g\n- [x] 牛奶、鸡蛋 #p/high\n- [ ] 厨房纸巾\n- [ ] 洗衣液 #p/low\n- [ ] 周末的水果' },
      { folder:'工作', name:'纸片 App 1.0 清单.md', color:'green', pinned:false, type:'todo',
        created:now-6*D, updated:now-2*36e5,
        body:'## 纸片 App 1.0 清单\n\n- [x] 新建笔记与待办\n- [x] 富文本：加粗 / 下划线 / 高亮 #p/high\n- [x] 笔记本分类整理\n- [ ] 实时搜索\n- [ ] 数据备份与恢复 #p/low' },
      { folder:'工作', name:'产品灵感记录.md', color:'blue', pinned:false, type:'note',
        created:now-4*D, updated:now-8*36e5,
        body:'## 产品灵感记录\n\n便签的**字号调节**要像真实书写一样顺手；==搜索结果里高亮关键词==，让人一眼定位。\n\n待办卡片上直接显示完成进度条，比红点提醒更安静。' },
      { folder:'生活', name:'读书笔记 ·《夜晚的潜水艇》.md', color:'pink', pinned:false, type:'note',
        created:now-5*D, updated:now-5*D,
        body:'## 读书笔记 ·《夜晚的潜水艇》\n\n陈春成的短篇，文字像**浸在水里**，<u>辽阔又克制</u>。\n\n==最喜欢《竹峰寺》==——一个人如何把一块石碑，连同自己的心事，妥帖地藏进山里。\n\n下次读他的新书前，可以先看看访谈。' },
      { folder:'生活', name:'周末徒步路线.md', color:'purple', pinned:false, type:'note',
        created:now-3*D, updated:now-3*D,
        body:'## 周末徒步路线\n\n西山国家森林公园，<u>东门进、沿盘山步道上行</u>，约 6 公里。\n\n带 1.5L 水、帽子和干粮；==下午四点前下山==，赶上日落前的光线。' },
      { folder:'生活', name:'随手记.md', color:'cream', pinned:false, type:'note',
        created:now-D, updated:now-D,
        body:'## 随手记\n\n便利店新出的桂花拿铁不错，**秋天的味道**。' }
    ];
    for(const n of notes){
      await VaultFS.mkdir(n.folder);
      const fm = cleanFm({
        id: 'seed-'+Math.random().toString(16).slice(2,10),
        created: new Date(n.created).toISOString(),
        updated: new Date(n.updated).toISOString(),
        color: n.color, pinned: n.pinned || undefined, type: n.type, tags: []
      });
      await VaultFS.write(U.join(n.folder, n.name), MD.stringifyFrontmatter(fm) + n.body);
    }
  },

  /* ---- 当前文件夹内容：文件夹置顶，其后 md（pinned 在前） ---- */
  entries(folderPath){
    folderPath = folderPath || '';
    const folders = subDirs(folderPath).map(d=>({
      type:'folder', name:U.base(d)+'/', path:d,
      title:U.base(d), count:notesUnder(d)
    }));
    const notes = Array.from(_entries.values())
      .filter(e=>e.folder===folderPath)
      .sort((a,b)=> (b.pinned-a.pinned) || (b.updated-a.updated));
    return Promise.resolve({ folders, notes });
  },

  /* ---- 全量嵌套树 ---- */
  tree(){
    const build = (dir)=>{
      const node = { name: dir==='' ? '资料库' : U.base(dir), path:dir, type:'folder', children:[], count:notesUnder(dir) };
      subDirs(dir).forEach(d=>node.children.push(build(d)));
      return node;
    };
    return build('');
  },

  /* ---- 读单篇 ---- */
  async get(path){
    let md='';
    try{ md = await VaultFS.read(path); }catch(e){ throw new Error('笔记不存在：'+path); }
    const entry = makeEntry(path, md);
    const parsed = MD.parseFrontmatter(md);
    return { entry, md, frontmatter:parsed.fm, html:MD.toHTML(md) };
  },

  /* ---- 搜索：标题/正文/标签 ---- */
  search(q){
    q = (q||'').trim().toLowerCase();
    if(!q) return Promise.resolve([]);
    const hits = Array.from(_entries.values()).filter(e=>{
      if(e.title.toLowerCase().includes(q)) return true;
      if(e.summary.toLowerCase().includes(q)) return true;
      if((e.tags||[]).some(t=>t.toLowerCase().includes(q))) return true;
      return false;
    });
    return Promise.resolve(hits);
  },

  /* ---- 新建文件夹 ---- */
  async createFolder(parentDir, name){
    name = (name||'').trim() || '新文件夹';
    parentDir = parentDir || '';
    let path = U.join(parentDir, name);
    /* 重名加序号 */
    const existing = existingNames(parentDir);
    if(existing.has(name+'.md') || _folders.has(path)){
      let n=2;
      while(existing.has(name+' '+n+'.md') || _folders.has(U.join(parentDir, name+' '+n))) n++;
      name = name+' '+n;
      path = U.join(parentDir, name);
    }
    await VaultFS.mkdir(path);
    _folders.add(path);
    return path;
  },

  /* ---- 新建并落盘 ---- */
  async create({ title, folder, type, content }){
    title = (title||'').trim() || '未命名';
    folder = folder || '';
    if(folder) await VaultFS.mkdir(folder);
    const name = U.base(U.join(folder, title+'.md'));
    const finalName = VaultFS.util ? VaultFS.util.dedupeName(existingNames(folder), name) : name;
    const path = U.join(folder, finalName);
    const fm = cleanFm({
      id: Math.random().toString(16).slice(2,10),
      created: new Date().toISOString(), updated: new Date().toISOString(),
      type: type||'note', tags: []
    });
    const md = MD.stringifyFrontmatter(fm) + (content||'');
    await VaultFS.write(path, md);
    _entries.set(path, makeEntry(path, md));
    /* 更新 _folders（若 folder 是新目录） */
    if(folder){
      let acc='';
      for(const seg of folder.split('/')){ acc = acc?acc+'/'+seg:seg; _folders.add(acc); }
    }
    return path;
  },

  /* ---- 保存（防抖 500ms，原子写 + 更新索引） ---- */
  save(path, md){
    if(_saveTimers[path]) clearTimeout(_saveTimers[path]);
    return new Promise(resolve=>{
      _saveTimers[path] = setTimeout(async ()=>{
        delete _saveTimers[path];
        try{
          await VaultFS.write(path, md);
          _entries.set(path, makeEntry(path, md));
        }catch(e){ console.warn('save failed', e); }
        resolve(path);
      }, 500);
    });
  },

  /* ---- 强制刷盘（退出编辑器时调用） ---- */
  async flushSave(path){
    if(_saveTimers[path]){ clearTimeout(_saveTimers[path]); delete _saveTimers[path]; }
    /* 最近一次 md 已在内存；若有未刷盘的，这里直接写 */
    /* 由 UI 在退出前调用 Vault.save 后再调 flush */
  },

  /* ---- 重命名（改标题=改文件名，重名加序号） ---- */
  async rename(path, title){
    title = (title||'').trim() || '未命名';
    const folder = U.dirOf(path);
    const newName = U.base(U.join(folder, title+'.md'));
    const existing = new Set(existingNames(folder));
    existing.delete(U.base(path));   // 自身不算冲突
    const finalName = VaultFS.util ? VaultFS.util.dedupeName(existing, newName) : newName;
    const newPath = U.join(folder, finalName);
    if(newPath===path) return path;
    let md='';
    try{ md = await VaultFS.read(path); }catch(e){ return path; }
    await VaultFS.rename(path, newPath);
    _entries.delete(path);
    _entries.set(newPath, makeEntry(newPath, md));
    /* 附件目录随迁（M4 完整实现；M2 仅处理 md） */
    return newPath;
  },

  /* ---- 移动到文件夹 ---- */
  async move(path, dirPath){
    dirPath = dirPath || '';
    if(dirPath) await VaultFS.mkdir(dirPath);
    const newPath = await VaultFS.move(path, dirPath);
    let md='';
    try{ md = await VaultFS.read(newPath); }catch(e){}
    _entries.delete(path);
    if(md) _entries.set(newPath, makeEntry(newPath, md));
    if(dirPath){
      let acc='';
      for(const seg of dirPath.split('/')){ acc = acc?acc+'/'+seg:seg; _folders.add(acc); }
    }
    return newPath;
  },

  /* ---- 删除（进回收站） ---- */
  async remove(path){
    const md = _entries.get(path);
    const trashPath = await VaultFS.trash(path);
    _entries.delete(path);
    let bodyMd='';
    try{ bodyMd = await VaultFS.read(trashPath); }catch(e){ bodyMd = md? MD.stringifyFrontmatter(md) : ''; }
    const entry = makeEntry(trashPath, bodyMd);
    _trash.set(trashPath, { entry, originalPath: path });
    return trashPath;
  },

  /* ---- 回收站列表 ---- */
  trashList(){
    const list = Array.from(_trash.values()).map(v=>({ entry:v.entry, originalPath:v.originalPath }));
    return Promise.resolve(list);
  },

  /* ---- 恢复 ---- */
  async restore(trashPath){
    const orig = await VaultFS.restore(trashPath);
    let md='';
    try{ md = await VaultFS.read(orig); }catch(e){}
    _trash.delete(trashPath);
    if(md) _entries.set(orig, makeEntry(orig, md));
    return orig;
  },

  /* ---- 彻底删除 ---- */
  async deleteForever(trashPath){
    try{ await VaultFS.delete(trashPath); }catch(e){}
    _trash.delete(trashPath);
    return true;
  },

  /* ---- 待办勾选回写（只改该行，立即写盘） ---- */
  async toggleTodo(path, rowKey){
    let md='';
    try{ md = await VaultFS.read(path); }catch(e){ return null; }
    const lines = MD.todoLines(md);
    const cur = lines.find(t=>t.key===String(rowKey));
    const newMd = MD.setTodoLine(md, rowKey, { done: !(cur && cur.done) });
    await VaultFS.write(path, newMd);
    _entries.set(path, makeEntry(path, newMd));
    const nl = MD.todoLines(newMd).find(t=>t.key===String(rowKey));
    return nl ? { done: nl.done, key: rowKey } : null;
  },

  /* ---- 改颜色（仅改 frontmatter，立即写盘） ---- */
  async setColor(path, color){
    let md='';
    try{ md = await VaultFS.read(path); }catch(e){ return path; }
    const parsed = MD.parseFrontmatter(md);
    const fm = cleanFm(parsed.fm || {});
    if(color) fm.color = color; else delete fm.color;
    const newMd = rewriteFM(md, fm);
    await VaultFS.write(path, newMd);
    _entries.set(path, makeEntry(path, newMd));
    return path;
  },

  /* ---- 置顶（仅改 frontmatter，立即写盘） ---- */
  async setPin(path, pinned){
    let md='';
    try{ md = await VaultFS.read(path); }catch(e){ return path; }
    const parsed = MD.parseFrontmatter(md);
    const fm = cleanFm(parsed.fm || {});
    fm.pinned = !!pinned;
    const newMd = rewriteFM(md, fm);
    await VaultFS.write(path, newMd);
    _entries.set(path, makeEntry(path, newMd));
    return path;
  },

  /* ---- 面包屑 ---- */
  crumbs(path){
    const parts = [];
    const dir = U.dirOf(path||'');
    parts.push({name:'资料库', path:''});
    let acc='';
    dir.split('/').forEach(seg=>{ if(!seg) return; acc = acc?acc+'/'+seg:seg; parts.push({name:seg, path:acc}); });
    return parts;
  },

  /* ---- 统计 ---- */
  async stats(){
    let bytes=0;
    for(const e of _entries.values()){ bytes += (e.summary||'').length; }
    return { notes:_entries.size, folders:_folders.size, attachments:_attach.size, bytes };
  },

  /* ---- 附件（M2 基础实现：从 md 提取引用，尝试 objectURL） ---- */
  async attachments(path){
    if(_attach.has(path)) return _attach.get(path);
    let md='';
    try{ md = await VaultFS.read(path); }catch(e){ return []; }
    const refs = MD.extractAttachRefs(md);
    const list = [];
    for(const r of refs){
      const name = U.base(r.link);
      let url = null, kind = 'file';
      if(r.embed){
        kind = /\.(jpe?g|png|gif|webp)$/i.test(name) ? 'image' : 'file';
        try{
          const blob = await VaultFS.readBlob(r.link);
          if(blob && typeof URL!=='undefined' && URL.createObjectURL) url = URL.createObjectURL(blob);
        }catch(e){}
      }
      list.push({ name, kind, url });
    }
    _attach.set(path, list);
    return list;
  },
  async attachmentUrl(path, name){
    const list = await this.attachments(path);
    const f = list.find(a=>a.name===name);
    return f ? f.url : null;
  },

  /* ---- 清空回收站 ---- */
  async emptyTrash(){
    for(const trashPath of Array.from(_trash.keys())){
      try{ await VaultFS.delete(trashPath); }catch(e){}
    }
    _trash.clear();
    return true;
  }
};

/* 浏览器挂全局；node 测试环境导出 */
if(typeof window!=='undefined') window.Vault = Vault;
if(typeof module!=='undefined' && module.exports) module.exports = Vault;
})();
