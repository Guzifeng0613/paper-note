/* ============================================================
   vault-sync.js：库同步桥
   syncVaultToStore()  vault → 旧 v15 Store（网盘上传/备份导出前）
   syncStoreToVault() 旧 Store → vault（网盘恢复/导入后）
   作用域内可直接用 Vault / VaultFS / MD / Store / Migrate / notes / prefs / flushDisk
   ============================================================ */
(function(){

/* 递归收集 vault 内全部 .md 路径（跳过 .trash / attachments / 隐藏） */
async function collectAllMd(dir){
  dir = dir || '';
  let entries = [];
  try{ entries = await VaultFS.list(dir); }catch(e){ return []; }
  const out = [];
  for(const e of entries){
    const rel = dir ? dir+'/'+e.name : e.name;
    if(e.type==='folder'){
      const base = (e.name||'');
      if(base.startsWith('.') || base==='attachments') continue;
      out.push(...await collectAllMd(rel));
    }else{
      if(!e.name || !e.name.endsWith('.md')) continue;
      if((e.name||'').startsWith('.')) continue;
      out.push(rel);
    }
  }
  return out;
}

/* 稳定短哈希（同一附件每次同步得到相同 id，保证幂等） */
function simpleHash(s){
  let h=0;
  for(let i=0;i<s.length;i++){ h=(h*31+s.charCodeAt(i))|0; }
  return Math.abs(h).toString(36);
}
function mimeFromName(name){
  const e=(name.split('.').pop()||'').toLowerCase();
  const m={jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',gif:'image/gif',webp:'image/webp',
    pdf:'application/pdf',txt:'text/plain',md:'text/markdown',
    doc:'application/msword',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls:'application/vnd.ms-excel',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ppt:'application/vnd.ms-powerpoint',pptx:'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    zip:'application/zip',mp3:'audio/mpeg',mp4:'video/mp4',m4a:'audio/mp4'};
  return m[e]||'application/octet-stream';
}
function blobToDataURL(blob){
  return new Promise((res,rej)=>{
    const fr=new FileReader();
    fr.onload=()=>res(fr.result); fr.onerror=rej;
    fr.readAsDataURL(blob);
  });
}
function baseName(p){ return String(p).split('/').pop(); }

/* 把 vault 一篇转成 v15 笔记结构（不含附件，附件由 fillAttachments 处理） */
function toLegacyNote(path, g){
  const fm = g.frontmatter || {};
  const entry = g.entry || {};
  const id = fm.id || (entry.path ? String(entry.path).replace(/[^\w]/g,'') : 'id'+Date.now());
  const type = (fm.type==='todo') ? 'todo' : 'note';
  const title = fm.title || entry.title || path.replace(/\.md$/,'').split('/').pop();
  const createdAt = fm.created ? Date.parse(fm.created) : Date.now();
  const updatedAt = fm.updated ? Date.parse(fm.updated) : createdAt;
  const note = {
    id: id,
    type: type,
    title: title,
    content: type==='note' ? (g.html || '') : '',
    color: fm.color || (type==='todo'?'green':'yellow'),
    pinned: !!fm.pinned,
    trashed: false,
    trashedAt: null,
    notebook: entry.folder || '',
    createdAt: isNaN(createdAt)?Date.now():createdAt,
    updatedAt: isNaN(updatedAt)?Date.now():updatedAt,
    todos: [],
    files: [],
    /* 来源标记：该笔记由 vault 哪个 .md 投影而来（回写时据此跳过，避免 Migrate 按文件名去重产生“标题 2.md”副本） */
    __vp: path
  };
  if(type==='todo'){
    const rows = (typeof MD!=='undefined' && MD.todoLines) ? MD.todoLines(g.md) : [];
    note.todos = rows.map(r=>({
      id: id+'_t'+(r.key!=null?r.key:Math.random().toString(36).slice(2,7)),
      text: r.text || '',
      done: !!r.done,
      priority: (r.priority==='high'||r.priority==='low') ? r.priority : 'normal'
    }));
  }
  return note;
}

/* 处理附件：构建 files[]、物理复制字节到旧 blob 库、重写正文图片标记 */
async function fillAttachments(note, g){
  const refs = (typeof MD!=='undefined' && MD.extractAttachRefs) ? MD.extractAttachRefs(g.md) : [];
  const linkToId = {};
  for(const r of refs){
    const id = 'att_'+simpleHash(r.link);
    const name = baseName(r.link);
    let blob=null;
    try{ blob = await VaultFS.readBlob(r.link); }catch(e){ blob=null; }
    const isImg = /\.(jpe?g|png|gif|webp)$/i.test(name);
    const size = blob ? blob.size : 0;
    const type = (blob && blob.type) ? blob.type : mimeFromName(name);
    const kind = (r.embed && isImg) ? 'image' : 'file';
    note.files.push({ id, name, size, type, kind });
    linkToId[r.link] = id;
    /* 物理复制字节到旧 blob 库（网盘/备份需要真实字节） */
    if(blob){
      try{
        if(Store.env==='native'){
          const dataUrl = await blobToDataURL(blob);
          await Native.call('putBlobFromDataUrl', JSON.stringify({ id, dataUrl, name, type }));
        }else if(Store.env==='idb' && typeof idbPutBlob==='function'){
          await idbPutBlob(id, blob);
        }
      }catch(e){ /* 浏览器降级环境无 blob 桥时跳过 */ }
    }
  }
  /* 重写正文：md-img 占位 → v15 note-img[data-id] */
  if(note.type==='note' && note.content){
    note.content = note.content.replace(/<img class="md-img"[^>]*>/g, (m)=>{
      const altM=/alt="([^"]*)"/.exec(m);
      const alt = altM?altM[1]:'';
      const id = linkToId[alt];
      if(id) return '<img class="note-img" data-id="'+id+'">';
      return m;
    });
  }
  return note;
}

const VaultSync = {

  /* vault → 旧 Store：替换全局 notes、复制附件字节并 flushDisk */
  async syncVaultToStore(){
    const paths = await collectAllMd('');
    const converted = [];
    for(const p of paths){
      try{
        const g = await Vault.get(p);
        const note = toLegacyNote(p, g);
        await fillAttachments(note, g);
        converted.push(note);
      }catch(e){ console.warn('sync read skip', p, e); }
    }
    /* 替换全局 notes（作用域内 notes 由 store.js 声明） */
    if(typeof notes!=='undefined'){
      notes.length = 0;
      converted.forEach(n=>notes.push(n));
    }
    await flushDisk();
    return {count: converted.length, paths};
  },

  /* 旧 Store → vault：把当前 Store 数据注入 Migrate 并落 vault（合并到现有 vault） */
  async syncStoreToVault(onProgress){
    Migrate.configure({ FS: VaultFS, MD: MD, loadLib: ()=>{
      try{ return JSON.parse(Store.payload()); }catch(e){ return {notes:[]}; }
    }});
    Migrate._cachedDetect = null;
    const res = await Migrate.run({ onProgress: onProgress || (()=>{}) });
    await Vault.init();
    return res;
  },

  /* 整库恢复（云端/目录 pull 后）：先清空 vault 再迁移，避免重复，返回迁移报告 */
  async restoreFromStore(onProgress){
    await Vault.clear();
    Migrate.configure({ FS: VaultFS, MD: MD, loadLib: ()=>{
      try{ return JSON.parse(Store.payload()); }catch(e){ return {notes:[]}; }
    }});
    Migrate._cachedDetect = null;
    const res = await Migrate.run({ onProgress: onProgress || (()=>{}) });
    await Vault.init();
    return res;
  },

  /* 收集 vault 内现有笔记的 frontmatter id 集合（追加写回时据此跳过已有笔记，避免副本） */
  async vaultIdSet(){
    const paths = await collectAllMd('');
    const ids = new Set();
    for(const p of paths){
      try{
        const md = await VaultFS.read(p);
        const fm = (typeof MD!=='undefined' && MD.parseFrontmatter) ? (MD.parseFrontmatter(md||'').fm||{}) : {};
        if(fm.id) ids.add(String(fm.id));
      }catch(e){ /* 单个读失败跳过 */ }
    }
    return ids;
  },

  /* 追加写回：只把 vault 里还没有的笔记（按 id）写成新 .md，已有笔记不动。
     用于“合并导入”/旧屏新增笔记后回写，绝不重写已有文件（Migrate 按文件名去重会产生副本）。
     notesToAppend 不传则用全局 notes 中无 __vp 标记的新笔记。 */
  async appendNotesToVault(notesToAppend, onProgress){
    const exist = await this.vaultIdSet();
    const list = (Array.isArray(notesToAppend) ? notesToAppend : notes.filter(n=>n && !n.__vp))
      .filter(n=>n && n.id && !exist.has(String(n.id)) && !n.trashed);
    if(!list.length){ await Vault.init(); return {added:0, report:null}; }
    Migrate.configure({ FS: VaultFS, MD: MD, loadLib: ()=>({notes:list, prefs:{}}) });
    Migrate._cachedDetect = null;
    const res = await Migrate.run({ onProgress: onProgress || (()=>{}) });
    await Vault.init();
    return {added: list.length, report: res};
  },

  /* 待同步标记：整库恢复（云端/目录）在 reload 前置位，启动时由 VUI 消费 */
  markPending(){ try{ localStorage.setItem('zhipian.v16.storeSync','1'); }catch(e){} },
  consumePending(){
    try{
      const v = localStorage.getItem('zhipian.v16.storeSync');
      if(v){ localStorage.removeItem('zhipian.v16.storeSync'); return true; }
    }catch(e){}
    return false;
  }
};

if(typeof window!=='undefined') window.VaultSync = VaultSync;
if(typeof module!=='undefined' && module.exports) module.exports = VaultSync;
})();
