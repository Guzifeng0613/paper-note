/* ============================================================
   vault-fs.js —— 纸片 v16 VaultFS（M2）
   全局名 VaultFS。低层文件系统抽象：仅做目录/文件操作，不做业务索引。
   三后端：native（AndroidBridge vault* 方法）/ opfs（OPFS）/ idb（IndexedDB 虚拟 FS）。
   路径一律 vault 相对 POSIX 路径（'/' 分隔），根目录用 ''（空串）表示。
   契约：docs/VAULT-INTERFACE.md 第 1 节。方法签名/返回结构不得变更。
   ============================================================ */
(function(){
'use strict';

/* ---------- 纯函数：POSIX 路径规范化（全部后端共用，node 可直接测） ---------- */
const util = {
  /* 规范化：去前后斜杠、压缩重复斜杠、解析 . 与 ..；根目录返回 '' */
  norm(p){
    if(!p) return '';
    p = String(p).replace(/\\/g,'/').trim();
    if(!p || p==='/' ) return '';
    const out=[];
    for(const seg of p.split('/')){
      if(!seg || seg==='.') continue;
      if(seg==='..'){ out.pop(); continue; }
      out.push(seg);
    }
    return out.join('/');
  },
  join(...parts){ return util.norm(parts.filter(x=>x!=null&&x!=='').map(String).join('/')); },
  base(p){ p=util.norm(p); if(!p) return ''; const i=p.lastIndexOf('/'); return i<0?p:p.slice(i+1); },
  dirOf(p){ p=util.norm(p); if(!p) return ''; const i=p.lastIndexOf('/'); return i<0?'':p.slice(0,i); },
  stripExt(p){ const b=util.base(p); const i=b.lastIndexOf('.'); return i<=0?b:b.slice(0,i); },
  /* 重名加序号：周会纪要.md → 周会纪要 2.md（existing 为目标目录已有文件名集合） */
  dedupeName(existing, name){
    existing = new Set(existing||[]);
    if(!existing.has(name)) return name;
    const i=name.lastIndexOf('.');
    const base = i>0 ? name.slice(0,i) : name;
    const ext  = i>0 ? name.slice(i) : '';
    let n=2; while(existing.has(base+' '+n+ext)) n++;
    return base+' '+n+ext;
  },
  /* 回收站映射：工作/周会纪要.md → .trash/工作/周会纪要.md */
  trashOf(p){ return util.join('.trash', p); },
  /* 回收路径还原：.trash/工作/周会纪要.md → 工作/周会纪要.md */
  restoreOf(trashP){ const n=util.norm(trashP); return n.indexOf('.trash/')===0 ? n.slice(7) : n; },
  /* 附件落目录：attachments/<笔记名>/（笔记路径传 '工作/周会纪要.md' → attachments/周会纪要/） */
  attachDir(notePath){ notePath=util.norm(notePath||''); return util.join('attachments', notePath?util.stripExt(notePath):'未命名'); },
  /* 原子写临时名：工作/周会纪要.md → 工作/.周会纪要.md.tmp（同父目录隐藏文件，写完 rename） */
  tmpPath(p){ p=util.norm(p); const d=util.dirOf(p), b=util.base(p); return util.join(d, '.'+b+'.tmp'); }
};

/* ---------- 浏览器字节工具（node 单测不会触达） ---------- */
function b64ToBlob(b64, type){
  const bin=atob(b64); const arr=new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++) arr[i]=bin.charCodeAt(i);
  return new Blob([arr],{type:type||'application/octet-stream'});
}
function blobToB64(blob){
  return new Promise((res,rej)=>{
    const fr=new FileReader();
    fr.onload=()=>res(String(fr.result).split(',')[1]||'');
    fr.onerror=()=>rej(new Error('二进制读取失败'));
    fr.readAsDataURL(blob);
  });
}
function envNative(){ return !!(typeof window!=='undefined' && window.AndroidBridge && window.AndroidBridge.post); }
function envOpfs(){ return !!(typeof navigator!=='undefined' && navigator.storage && navigator.storage.getDirectory); }
function err(msg){ return new Error(msg); }

/* ============================================================
   后端 A：native（经 Native.call 调原生 vault* 方法）
   ============================================================ */
const nativeBE = {
  _call(method, payload){
    if(typeof Native==='undefined' || !Native.call) return Promise.reject(err('原生桥不可用'));
    return Native.call(method, payload==null?{}:payload);
  },
  root(){ return this._call('vaultRoot'); },
  list(rel){ return this._call('vaultList',{path:rel||''}); },
  read(rel){ return this._call('vaultRead',{path:rel}); },
  async write(rel, text){ await this._call('vaultWrite',{path:rel, text:String(text==null?'':text)}); return rel; },
  async mkdir(rel){ await this._call('vaultMkdir',{path:rel}); return rel; },
  async rename(rel, newRel){ await this._call('vaultRename',{path:rel, newPath:newRel}); return newRel; },
  /* 移动到文件夹：原生自行拼接目标并返回新路径 */
  async move(rel, dirRel){ return this._call('vaultMove',{path:rel, dirPath:dirRel}); },
  async trash(rel){ const r=await this._call('vaultTrash',{path:rel}); return r.trashPath; },
  async restore(rel){ const r=await this._call('vaultRestore',{path:rel}); return r.path; },
  listTrash(){ return this._call('vaultListTrash'); },
  async delete(rel){ await this._call('vaultDelete',{path:rel}); },
  async readBlob(rel){
    const r=await this._call('vaultReadBlob',{path:rel});
    return b64ToBlob(r.b64||'', r.type||'application/octet-stream');
  },
  async writeAttachment(name, blob, notePath){
    const b64=await blobToB64(blob);
    return this._call('vaultWriteAttachment',{notePath:notePath||'', name:name||'附件', b64});
  },
  importFile(uri, dirRel){ return this._call('vaultImportFile',{uri:uri, dirPath:dirRel||''}); },
  bindFolder(){ return this._call('vaultBindFolder'); },
  exportZip(){ return this._call('vaultExport',{}); }
};

/* ============================================================
   后端 B：opfs（navigator.storage.getDirectory）—— 浏览器预览/验收用
   ============================================================ */
const opfsBE = {
  async _root(){ return navigator.storage.getDirectory(); },
  async _resolve(rel, create){
    let d=await this._root();
    if(!rel) return d;
    for(const part of rel.split('/')){
      if(!part) continue;
      d=await d.getDirectoryHandle(part, {create:!!create});
    }
    return d;
  },
  async _parentOf(rel, create){
    return this._resolve(util.dirOf(rel), create);
  },
  root(){ return this._root().then(()=>({type:'opfs', path:'opfs://vault'})); },
  async list(rel){
    const d=await this._resolve(rel);
    const out=[];
    for await (const [name, handle] of d.entries()){
      if(!rel && name==='.trash') continue;
      const isDir=handle.kind==='directory';
      let size=0, mtime=0;
      if(!isDir){ const f=await handle.getFile(); size=f.size; mtime=f.lastModified; }
      out.push({name, type:isDir?'folder':'file', size, mtime});
    }
    return out;
  },
  async read(rel){
    const d=await this._parentOf(rel);
    const h=await d.getFileHandle(util.base(rel));
    return (await h.getFile()).text();
  },
  async _writeBytes(rel, bytes){
    const parent=await this._parentOf(rel, true);
    const name=util.base(rel);
    /* 原子写：先写 .name.tmp，再 move 覆盖目标 */
    const tmp=await parent.getFileHandle('.'+name+'.tmp',{create:true});
    const tw=await tmp.createWritable(); await tw.write(bytes); await tw.close();
    try{ await parent.removeEntry(name); }catch(e){}
    try{ await tmp.move(parent, name); }
    catch(e){
      const f=await tmp.getFile();
      const h=await parent.getFileHandle(name,{create:true});
      const w=await h.createWritable(); await w.write(await f.arrayBuffer()); await w.close();
      await parent.removeEntry('.'+name+'.tmp');
    }
  },
  async write(rel, text){ await this._writeBytes(rel, new TextEncoder().encode(String(text==null?'':text))); return rel; },
  async mkdir(rel){ await this._resolve(rel, true); return rel; },
  async moveRaw(srcRel, dstRel){
    const sParent=await this._parentOf(srcRel);
    const dParent=await this._parentOf(dstRel, true);
    const sName=util.base(srcRel), dName=util.base(dstRel);
    let handle;
    try{ handle=await sParent.getDirectoryHandle(sName); }
    catch(e){ handle=await sParent.getFileHandle(sName); }
    try{ await handle.move(dParent, dName); return; }
    catch(e){ /* 兜底：拷贝 + 删除（目录递归） */ }
    await this._copyTree(handle, dParent, dName);
    await sParent.removeEntry(sName, {recursive:true});
  },
  async _copyTree(srcHandle, dstParent, dstName){
    if(srcHandle.kind==='file'){
      const h=await dstParent.getFileHandle(dstName,{create:true});
      const w=await h.createWritable(); await w.write(await srcHandle.getFile()); await w.close();
      return;
    }
    const nd=await dstParent.getDirectoryHandle(dstName,{create:true});
    for await (const [name, child] of srcHandle.entries()) await this._copyTree(child, nd, name);
  },
  async rename(rel, newRel){ await this.moveRaw(rel, newRel); return newRel; },
  async delete(rel){
    const parent=await this._parentOf(rel);
    await parent.removeEntry(util.base(rel), {recursive:true});
  },
  async readBlob(rel){
    const d=await this._parentOf(rel);
    const h=await d.getFileHandle(util.base(rel));
    return h.getFile();
  },
  async writeBlob(rel, blob){ await this._writeBytes(rel, await blob.arrayBuffer()); return rel; },
  importFile(){ return Promise.reject(err('浏览器预览端不支持外部 uri 导入')); },
  bindFolder(){ return Promise.reject(err('浏览器预览端不支持绑定 SAF 目录')); },
  exportZip(){ return Promise.reject(err('浏览器预览端不支持整库导出（请用原生端）')); }
};

/* ============================================================
   后端 C：idb（IndexedDB 虚拟 FS）—— 兜底
   ============================================================ */
const idbBE = {
  db:null, NAME:'zhipian-vaultfs',
  async init(){
    this.db=await new Promise((res,rej)=>{
      const rq=indexedDB.open(this.NAME,1);
      rq.onupgradeneeded=e=>{ const db=e.target.result;
        if(!db.objectStoreNames.contains('files')) db.createObjectStore('files'); };
      rq.onsuccess=e=>res(e.target.result);
      rq.onerror=()=>rej(rq.error);
    });
    return this.db;
  },
  _store(mode){ return this.db.transaction('files',mode).objectStore('files'); },
  _op(mode, fn){
    return new Promise((res,rej)=>{
      const st=this._store(mode); const r=fn(st);
      r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error);
    });
  },
  _get(k){ return this._op('readonly',s=>s.get(k)); },
  _put(k,v){ return this._op('readwrite',s=>s.put(v,k)); },
  _del(k){ return this._op('readwrite',s=>s.delete(k)); },
  _keys(){ return this._op('readonly',s=>s.getAllKeys()); },
  root(){ return Promise.resolve({type:'idb', path:'idb://'+this.NAME}); },
  async list(rel){
    const keys=await this._keys();
    const prefix=rel?rel+'/':'';
    const out=[];
    for(const k of keys){
      if(!k.startsWith(prefix)) continue;
      const rest=k.slice(prefix.length);
      if(!rest || rest.indexOf('/')>=0) continue;
      if(!rel && rest==='.trash') continue;
      const e=await this._get(k);
      out.push({name:rest, type:e.kind, size:e.blob?e.blob.size:0, mtime:e.mtime||0});
    }
    return out;
  },
  async read(rel){
    const e=await this._get(rel);
    if(!e) throw err('文件不存在：'+rel);
    return e.blob.text();
  },
  async write(rel, text){
    await this._put(rel, {kind:'file', blob:new Blob([String(text==null?'':text)],{type:'text/plain'}), mtime:Date.now()});
    return rel;
  },
  async mkdir(rel){
    if(!rel) return rel;
    const segs=rel.split('/'); let acc='';
    for(const s of segs){ acc=acc?acc+'/'+s:s; await this._put(acc,{kind:'folder', mtime:Date.now()}); }
    return rel;
  },
  async moveRaw(srcRel, dstRel){
    const keys=await this._keys();
    const moved=[];
    for(const k of keys){
      if(k===srcRel || k.indexOf(srcRel+'/')===0){
        const nk=util.join(dstRel, k.slice(srcRel.length));
        const e=await this._get(k);
        moved.push([k,nk,e]);
      }
    }
    if(!moved.length) throw err('移动源不存在：'+srcRel);
    for(const [k,nk,e] of moved){ await this._put(nk,e); await this._del(k); }
  },
  async rename(rel,newRel){ await this.moveRaw(rel,newRel); return newRel; },
  async delete(rel){
    const keys=await this._keys();
    for(const k of keys) if(k===rel || k.indexOf(rel+'/')===0) await this._del(k);
  },
  async readBlob(rel){
    const e=await this._get(rel);
    if(!e) throw err('文件不存在：'+rel);
    return e.blob;
  },
  async writeBlob(rel,blob){
    await this._put(rel,{kind:'file', blob, mtime:Date.now()});
    return rel;
  },
  importFile(){ return Promise.reject(err('浏览器预览端不支持外部 uri 导入')); },
  bindFolder(){ return Promise.reject(err('浏览器预览端不支持绑定 SAF 目录')); },
  exportZip(){ return Promise.reject(err('浏览器预览端不支持整库导出（请用原生端）')); }
};

/* ---------- 回收站/恢复/附件 的通用算法（opfs/idb 后端用；native 由原生实现） ---------- */
async function genericTrash(be, rel){
  await be.mkdir(util.dirOf(util.trashOf(rel)));
  const parent=util.dirOf(util.trashOf(rel));
  const names=(await be.list(parent)).map(e=>e.name);
  const target=util.join(parent, util.dedupeName(names, util.base(util.trashOf(rel))));
  await be.moveRaw(rel, target);
  return target;
}
async function genericRestore(be, trashRel){
  if(!util.restoreOf(trashRel)) throw err('不是回收站路径：'+trashRel);
  const orig=util.restoreOf(trashRel);
  const parent=util.dirOf(orig);
  if(parent) await be.mkdir(parent);
  const names=(await be.list(parent)).map(e=>e.name);
  const target=util.join(parent, util.dedupeName(names, util.base(orig)));
  await be.moveRaw(trashRel, target);
  return target;
}
async function genericListTrash(be){
  const out=[];
  async function walk(rel){
    let entries=[];
    try{ entries=await be.list(rel); }catch(e){ return; }
    for(const e of entries){
      const full=util.join(rel, e.name);
      if(e.type==='folder') await walk(full);
      out.push({name:e.name, type:e.type, size:e.size, mtime:e.mtime,
                originalPath:util.restoreOf(full)});
    }
  }
  await walk('.trash');
  return out;
}
async function genericWriteAttachment(be, name, blob, notePath){
  const dir=util.attachDir(notePath);
  await be.mkdir(dir);
  const names=(await be.list(dir)).map(e=>e.name);
  const finalName=util.dedupeName(names, name||'附件');
  await be.writeBlob(util.join(dir, finalName), blob);
  return util.join(dir, finalName);
}

/* ============================================================
   VaultFS 对外门面
   ============================================================ */
const VaultFS = {
  _be:null, _name:null,
  /* 后端自动选择：native > opfs > idb；force 仅供测试/开发强制指定 */
  async init(force){
    this._name = force || (envNative()?'native':(envOpfs()?'opfs':'idb'));
    if(this._name==='native') this._be=nativeBE;
    else if(this._name==='opfs') this._be=opfsBE;
    else { this._be=idbBE; await idbBE.init(); }
    return this._name;
  },
  backend(){ return this._name || (envNative()?'native':(envOpfs()?'opfs':'idb')); },
  root(){ return this._be.root(); },
  list(path){ return this._be.list(util.norm(path)); },
  read(path){ return this._be.read(util.norm(path)); },
  write(path, text){ return this._be.write(util.norm(path), text); },
  mkdir(path){ return this._be.mkdir(util.norm(path)); },
  rename(path, newPath){ return this._be.rename(util.norm(path), util.norm(newPath)); },
  async move(path, dirPath){
    path=util.norm(path); dirPath=util.norm(dirPath);
    if(this._be.move) return this._be.move(path, dirPath);
    const newPath=util.join(dirPath, util.base(path));
    await this._be.rename(path, newPath);
    return newPath;
  },
  trash(path){
    path=util.norm(path);
    if(this._name==='native') return this._be.trash(path);
    return genericTrash(this._be, path);
  },
  restore(trashPath){
    trashPath=util.norm(trashPath);
    if(this._name==='native') return this._be.restore(trashPath);
    return genericRestore(this._be, trashPath);
  },
  listTrash(){
    if(this._name==='native') return this._be.listTrash();
    return genericListTrash(this._be);
  },
  delete(path){ return this._be.delete(util.norm(path)); },
  readBlob(path){ return this._be.readBlob(util.norm(path)); },
  writeAttachment(name, blob, notePath){
    notePath=util.norm(notePath||'');
    if(this._name==='native') return this._be.writeAttachment(name, blob, notePath);
    return genericWriteAttachment(this._be, name, blob, notePath);
  },
  importFile(uri, dirPath){ return this._be.importFile(uri, util.norm(dirPath||'')); },
  bindFolder(){ return this._be.bindFolder(); },
  exportZip(uri){ return this._be.exportZip(uri||''); },
  /* 暴露纯函数工具，供 node 单测与 Vault 业务层复用 */
  util
};

/* 浏览器内挂全局；node 测试环境导出（浏览器内不报错） */
if(typeof window!=='undefined') window.VaultFS=VaultFS;
if(typeof module!=='undefined' && module.exports) module.exports=VaultFS;
})();
