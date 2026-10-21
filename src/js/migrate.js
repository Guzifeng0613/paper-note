/* ============================================================
   migrate.js —— 旧库迁移（M4）：v15.4.4 JSON 库 → v16 Markdown vault
   全局名 Migrate。严格按 docs/VAULT-INTERFACE.md 第 4 节：
     detect() / async backup() / async run({onProgress}) / verify()
   笔记本→同名文件夹；HTML→MD（复用 MD 引擎方言）；待办→checkbox+优先级；
   附件→attachments/<笔记名>/ 并重写引用；回收站→.trash；全部经 VaultFS 原子写。
   依赖可注入（node 单测）：configure({loadLib, loadBlob, FS, zipImpl, MD})。
   ============================================================ */
(function(){
'use strict';

/* ---------------- 工具 ---------------- */
function escAttr(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;'); }
function decodeEntities(s){
  return String(s==null?'':s)
    .replace(/&nbsp;/g,' ').replace(/&quot;/g,'"').replace(/&#39;/g,"'")
    .replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
}
function dataURLtoBytes(dataurl){
  const m=/^data:(.*?);base64,(.*)$/.exec(dataurl||''); if(!m) return null;
  const bin=Buffer ? Buffer.from(m[2],'base64') : atob(m[2]);
  return bin;
}
function sanitizeName(s){
  const t = String(s==null?'':s).replace(/[\/\\]/g,'／').trim();
  return t || '未命名';
}
function tsISO(ms){ return ms ? new Date(Number(ms)).toISOString() : null; }

/* ============================================================
   旧库 → Markdown 正文转换器
   旧 HTML 形态（v15.4.4）：b/strong、i/em、u、s/strike/del、span.hl、
   mark、span style=background、span style=font-size（保留内联 HTML）、
   br、p/div、ul/ol/li、blockquote、pre、hr、
   img.note-img[data-id]（图片附件）、span.attref[data-fid]（文档附件）、a。
   ============================================================ */
function legacyHTMLtoMD(html, fileByFid){
  let s = String(html||'');
  // 1) 图片附件 → 占位 token（data-id 指向旧 files[]）
  s = s.replace(/<img[^>]*class="[^"]*note-img[^"]*"[^>]*data-id="([^"]*)"[^>]*>/gi, '@@IMG:$1@@');
  s = s.replace(/<img[^>]*data-id="([^"]*)"[^>]*class="[^"]*note-img[^"]*"[^>]*>/gi, '@@IMG:$1@@');
  // 2) 文档附件芯片（整块，含内部 svg/文字）→ 占位 token
  s = s.replace(/<span[^>]*class="[^"]*attref[^"]*"[^>]*data-fid="([^"]*)"[^>]*>[\s\S]*?<\/span>/gi, '@@FILE:$1@@');
  s = s.replace(/<span[^>]*data-fid="([^"]*)"[^>]*class="[^"]*attref[^"]*"[^>]*>[\s\S]*?<\/span>/gi, '@@FILE:$1@@');
  // 3) 高亮 span.hl / 背景色 span（整块）→ mark（转 ==）
  s = s.replace(/<span[^>]*class="[^"]*\bhl\b[^"]*"[^>]*>([\s\S]*?)<\/span>/gi, '<mark>$1</mark>');
  s = s.replace(/<span[^>]*style="[^"]*background[^"]*"[^>]*>([\s\S]*?)<\/span>/gi, '<mark>$1</mark>');

  let out = '';
  const stack = [];               // ul|ol|quote
  const linkStack = [];
  let pendingLi = null;
  let preActive = false, preLang = '', preBuf = [];

  const emit = txt => {
    if(!txt) return;
    if(linkStack.length){ linkStack[linkStack.length-1].buf += txt; return; }
    out += txt;
  };
  const br = () => emit(stack.includes('quote') ? '\n> ' : '\n');
  const pushText = txt => {
    if(!txt) return;
    if(preActive){ preBuf.push(decodeEntities(txt)); return; }
    let t = decodeEntities(txt);
    if(stack.includes('quote')) t = t.replace(/\n/g,'\n> ');
    if(pendingLi){
      const indent = '  '.repeat(pendingLi.indent);
      const sep = out.endsWith('\n') ? '' : '\n';
      emit(sep + indent + (pendingLi.type==='ol' ? '1. ' : '- '));
      pendingLi = null;
    }
    emit(t);
  };

  const tagRe = /<\/?([a-zA-Z][a-zA-Z0-9-]*)((?:[^<>]*?))(\/?)>/g;
  let lastIdx = 0, m;
  while((m = tagRe.exec(s))){
    pushText(s.slice(lastIdx, m.index));
    lastIdx = tagRe.lastIndex;
    const isClose = m[0][1] === '/';
    const tag = m[1].toLowerCase();
    const attrs = m[2]||'';
    const rawOpen = m[0]; // 完整开标签（span 原样保留用）

    if(preActive){
      if(tag==='pre' && isClose){
        preActive = false;
        const inner = preBuf.join('').replace(/<\/?code[^>]*>/gi,'');
        out += '\n```'+preLang+'\n'+inner.replace(/\n+$/,'')+'\n```\n';
      } else preBuf.push(rawOpen);
      continue;
    }

    switch(tag){
      case 'br': emit('\n'); break;
      case 'p': case 'div': if(isClose) br(); break;
      case 'h1': case 'h2': case 'h3': case 'h4': case 'h5': case 'h6': {
        let lv = Math.max(2, Math.min(6, Number(tag[1])));
        if(!isClose){ if(out && !out.endsWith('\n')) br(); emit('#'.repeat(lv)+' '); }
        else br();
        break;
      }
      case 'ul': case 'ol':
        if(!isClose) stack.push(tag);
        else { const k=stack.lastIndexOf(tag); if(k>=0)stack.splice(k,1); br(); }
        break;
      case 'li':
        if(!isClose){
          const depth = stack.filter(x=>x==='ul'||x==='ol').length;
          pendingLi = { type: stack[stack.length-1]==='ol'?'ol':'ul', indent: Math.max(0,depth-1) };
        } else {
          if(pendingLi){
            emit('\n'+'  '.repeat(pendingLi.indent)+(pendingLi.type==='ol'?'1. ':'- '));
            pendingLi = null;
          }
          br();
        }
        break;
      case 'blockquote':
        if(!isClose){ stack.push('quote'); emit('\n> '); }
        else { const k=stack.lastIndexOf('quote'); if(k>=0)stack.splice(k,1); emit('\n'); }
        break;
      case 'pre':
        if(!isClose){ preActive=true; preBuf=[]; preLang=''; }
        break;
      case 'code': emit('`'); break;
      case 'strong': case 'b': emit('**'); break;
      case 'em': case 'i': emit('*'); break;
      case 'u': emit(isClose?'</u>':'<u>'); break;
      case 'del': case 's': case 'strike': emit('~~'); break;
      case 'mark': emit('=='); break;
      case 'hr': emit('\n---\n'); break;
      case 'img': break; // 旧图已转为 token
      case 'a':
        if(!isClose) linkStack.push({ href:(attrs.match(/href="([^"]*)"/)||[])[1]||'', buf:'' });
        else { const lk=linkStack.pop(); if(lk) emit('['+lk.buf+']('+lk.href+')'); }
        break;
      case 'font': case 'span':
        // 字号等复杂内联样式：原样保留内联 HTML（报告标注；Obsidian 可渲染）
        if(!isClose) emit(rawOpen); else emit('</'+tag+'>');
        break;
      default: break;
    }
  }
  pushText(s.slice(lastIdx));

  // 解析附件 token → 相对路径链接
  out = out
    .replace(/@@IMG:([^@]+)@@/g, (_,fid)=>{
      const r = fileByFid[fid];
      return r ? '!['+(r.name||'')+']('+r.path+')' : '';
    })
    .replace(/@@FILE:([^@]+)@@/g, (_,fid)=>{
      const r = fileByFid[fid];
      return r ? '['+(r.name||'')+']('+r.path+')' : '';
    });

  return out
    .split('\n').filter(l=>l.trim()!=='>' && l.trim()!=='> ')
    .join('\n').replace(/\n{3,}/g,'\n\n').replace(/[ \t]+\n/g,'\n').trim();
}

/* ---------------- 待办 → MD ---------------- */
function todosToMD(todos){
  return (todos||[]).map(t=>{
    const pr = t.priority==='high' ? ' #p/high' : t.priority==='low' ? ' #p/low' : '';
    return '- ['+(t.done?'x':' ')+'] '+(t.text||'')+pr;
  }).join('\n');
}

/* ============================================================
   Migrate 门面
   ============================================================ */
const Migrate = {
  _cfg: null,
  configure(opts){ this._cfg = Object.assign(this._cfg||{}, opts||{}); return this; },

  /* ---- 旧库读取（浏览器默认实现；node 测试注入） ---- */
  async _loadLib(){
    if(this._cfg && this._cfg.loadLib) return this._cfg.loadLib();
    if(typeof Native!=='undefined' && Native.call){
      const r = await Native.call('loadMeta');
      return (typeof r==='string') ? JSON.parse(r) : r;
    }
    if(typeof indexedDB!=='undefined'){
      // 旧库 IDB：zhipian-db-v3 / kv / 'library'
      return await new Promise((res,rej)=>{
        const rq = indexedDB.open('zhipian-db-v3',1);
        rq.onupgradeneeded=e=>{const db=e.target.result;
          if(!db.objectStoreNames.contains('kv'))db.createObjectStore('kv');};
        rq.onsuccess=e=>{
          const db=e.target.result;
          const g=db.transaction('kv','readonly').objectStore('kv').get('library');
          g.onsuccess=()=>{ let v=g.result; if(typeof v==='string'){try{v=JSON.parse(v);}catch(e){}} res(v); };
          g.onerror=()=>rej(g.error);
        };
        rq.onerror=()=>rej(rq.error);
      });
    }
    if(typeof localStorage!=='undefined'){
      const raw = localStorage.getItem('zhipian.library.v3')
        || localStorage.getItem('zhipian.notes.v2') || localStorage.getItem('zhipian.notes.v1');
      return raw ? JSON.parse(raw) : null;
    }
    return null;
  },
  /* 读旧附件字节：优先级
     1) file.data（导入时内嵌 dataURL，v1/v2 旧库形态）
     2) 注入 loadBlob（node 测试 / idb 后端）
     3) native：Native.call('loadBlobBytes',{id}) → {b64,name,type}（原生 agent 同步添加）
     4) 浏览器 idb 兜底：zhipian-db-v3 / blobs / <id>
     全部失败 → 返回 null（run 会记 failures，不丢其他附件） */
  async _loadBlobBytes(note, file){
    if(file && file.data) return dataURLtoBytes(file.data);
    if(this._cfg && this._cfg.loadBlob) return await this._cfg.loadBlob(note, file);
    if(typeof Native!=='undefined' && Native.call){
      try{
        const r = await Native.call('loadBlobBytes', JSON.stringify({id:file.id}));
        if(r && r.b64){
          const bin = dataURLtoBytes('data:application/octet-stream;base64,'+r.b64);
          return bin;
        }
      }catch(e){ /* 桥未就绪，走兜底 */ }
    }
    if(typeof indexedDB!=='undefined'){
      try{
        const blob = await new Promise((res,rej)=>{
          const rq = indexedDB.open('zhipian-db-v3',1);
          rq.onupgradeneeded=e=>{const db=e.target.result;
            if(!db.objectStoreNames.contains('blobs'))db.createObjectStore('blobs');};
          rq.onsuccess=e=>{
            const g=e.target.result.transaction('blobs','readonly').objectStore('blobs').get(file.id);
            g.onsuccess=()=>res(g.result); g.onerror=()=>rej(g.error);
          };
          rq.onerror=()=>rej(rq.error);
        });
        if(blob) return blob;
      }catch(e){ /* idb 也没有 */ }
    }
    return null;
  },

  /* ---- detect：是否存在可迁移旧库 ---- */
  async detect(){
    let lib=null;
    try{ lib = await this._loadLib(); }catch(e){ lib=null; }
    if(!lib || !Array.isArray(lib.notes)) return {found:false, summary:null};
    const notes = lib.notes;
    const active = notes.filter(n=>!n.trashed);
    const trashed = notes.filter(n=>n.trashed);
    const notebooks = Array.isArray(lib.prefs&&lib.prefs.notebooks) ? lib.prefs.notebooks : [];
    const attachments = notes.reduce((s,n)=>s+((n.files||[]).filter(f=>!f.hidden&&!f.derivedOf).length),0);
    const summary = {
      notes: notes.length, active: active.length, trashed: trashed.length,
      notebooks: notebooks.slice(), attachments,
      version: lib.version||1, app: lib.app||'zhipian-notes'
    };
    return {found:true, summary, lib};
  },

  /* ---- backup：迁移前完整备份 zip（失败必须中止） ---- */
  async backup(){
    const det = this._cachedDetect || await this.detect();
    if(!det.found) throw new Error('未检测到旧库，无需备份');
    const lib = det.lib;
    const date = new Date();
    const name = '迁移前备份-'+date.getFullYear()
      +String(date.getMonth()+1).padStart(2,'0')+String(date.getDate()).padStart(2,'0')+'.zip';

    // 收集附件字节（按 id 去重）
    const blobs = new Map();
    for(const n of lib.notes){
      for(const f of (n.files||[])){
        if(blobs.has(f.id)) continue;
        const bytes = await this._loadBlobBytes(n, f);
        if(bytes) blobs.set(f.id, bytes);
      }
    }
    const entries = [
      {name:'library.json', data: JSON.stringify(lib,null,2)},
      ...Array.from(blobs.entries()).map(([id,bytes])=>({name:'files/'+id, data:bytes}))
    ];
    // zip 实现：浏览器默认 JSZip；测试注入
    let bytes;
    if(this._cfg && this._cfg.zipImpl){
      bytes = await this._cfg.zipImpl.pack(entries);
      await this._cfg.zipImpl.save(bytes, name);
    } else if(typeof JSZip!=='undefined'){
      const zip = new JSZip();
      entries.forEach(e=>zip.file(e.name, e.data));
      const blob = await zip.generateAsync({type:'blob', compression:'DEFLATE'});
      if(typeof Native!=='undefined' && Native.call){
        const u8 = new Uint8Array(await blob.arrayBuffer());
        let bin=''; for(let i=0;i<u8.length;i+=8192) bin+=String.fromCharCode.apply(null,u8.subarray(i,i+8192));
        await Native.call('exportToFolder', JSON.stringify(
          {cat:'备份', name, mime:'application/zip', data:btoa(bin)}));
      } else {
        const url=URL.createObjectURL(blob);
        const a=document.createElement('a'); a.href=url; a.download=name; a.click();
        setTimeout(()=>URL.revokeObjectURL(url),4000);
      }
    } else {
      throw new Error('无可用的 zip 实现（JSZip 未加载且未注入），备份中止');
    }
    return {ok:true, name, entries:entries.length, bytes: bytes ? bytes.length : null};
  },

  /* ---- run：执行迁移 ---- */
  async run(opts){
    opts = opts||{};
    const onProgress = opts.onProgress || (()=>{});
    const FS = this._cfg && this._cfg.FS;
    const MDX = (this._cfg && this._cfg.MD) || (typeof MD!=='undefined' ? MD : null);
    if(!FS || !MDX) throw new Error('migrate 未配置 FS / MD（configure({FS,MD})）');

    const det = this._cachedDetect || await this.detect();
    if(!det.found) return {ok:false, reason:'旧库不存在'};
    this._cachedDetect = det;
    const lib = det.lib;
    const notes = lib.notes.filter(n=>n && n.id);

    const report = {files:0, attachments:0, failures:[], skipped:[], notes:[], trash:0};
    const complexBlocks = [];   // 保留内联 HTML 的篇目标注

    // 收集所有笔记本文件夹（含空笔记本也建目录）
    const nbSet = new Set((lib.prefs && lib.prefs.notebooks)||[]);

    let done = 0, total = notes.length;
    for(const n of notes){
      done++;
      try{
        const folder = n.notebook ? sanitizeName(n.notebook) : '';
        if(folder && !this._mkdirDone.has(folder)){ await FS.mkdir(folder); this._mkdirDone.add(folder); }

        // 文件名（同目录重名加序号）
        const existing = (await FS.list(folder)).map(e=>e.name);
        const base = sanitizeName(n.title||'');
        const fname = FS.util.dedupeName(existing, base+'.md');
        const notePath = folder ? folder+'/'+fname : fname;

        // 附件物理复制 → attachments/<标题>/
        const fileByFid = {};
        for(const f of (n.files||[])){
          if(f.hidden || f.derivedOf) continue;
          let bytes = await this._loadBlobBytes(n, f);
          if(!bytes){ report.failures.push({id:n.id, title:n.title, err:'附件读取失败：'+f.id}); continue; }
          const blob = this._toBlob(bytes, f.type||'application/octet-stream');
          const rel = await FS.writeAttachment(f.name||'附件', blob, notePath);
          fileByFid[f.id] = {path:rel, name:f.name};
          report.attachments++;
        }

        // frontmatter
        const fm = {id:n.id, created:tsISO(n.createdAt), updated:tsISO(n.updatedAt)};
        if(n.color && n.color!=='cream') fm.color = n.color;
        if(n.pinned) fm.pinned = true;
        fm.type = n.type==='todo' ? 'todo' : 'note';

        // 正文：待办块 + HTML 转 MD
        let body = '';
        if(n.type==='todo' && (n.todos||[]).length) body += todosToMD(n.todos)+'\n\n';
        const mdBody = legacyHTMLtoMD(n.content||'', fileByFid);
        if(mdBody) body += mdBody;
        // 未在正文出现的附件：文末补引用
        const referenced = new Set(Object.keys(fileByFid));
        for(const fid of Object.keys(fileByFid)){
          if(!body.includes(fileByFid[fid].path)){
            body += (body?'\n':'')+'['+fileByFid[fid].name+']('+fileByFid[fid].path+')';
          }
        }
        if(/<span[^>]*style=|<font/i.test(n.content||'')) complexBlocks.push(notePath);

        const md = MDX.serialize(MDX.parse(MDX.stringifyFrontmatter(fm)+'\n'+body).blocks, fm);

        if(n.trashed){
          // 旧回收站 → .trash/<原结构>/<文件>
          const trashPath = '.trash/'+notePath;
          const trashDir = '.trash/'+folder;
          if(!this._mkdirDone.has(trashDir)){ await FS.mkdir(trashDir); this._mkdirDone.add(trashDir); }
          await FS.write(trashPath, md);
          report.trash++;
        } else {
          await FS.write(notePath, md);
          report.files++;
          report.notes.push(notePath);
        }
      }catch(e){
        report.failures.push({id:n.id, title:n.title, err:(e&&e.message)||String(e)});
      }
      onProgress(Math.round(done/total*100), n.title||'未命名');
    }
    report.complexBlocks = complexBlocks;
    report.ok = report.failures.length===0;
    return report;
  },

  _mkdirDone: new Set(),
  _toBlob(bytes, type){
    // 浏览器包成 Blob；node 环境（无 window）直接透传 Buffer/Uint8Array（注入 FS 自行消费）
    if(typeof window!=='undefined' && typeof Blob!=='undefined' && bytes instanceof Uint8Array) return new Blob([bytes],{type});
    return bytes;
  },

  /* ---- verify：迁移后校验 ---- */
  async verify(){
    const FS = this._cfg && this._cfg.FS;
    const MDX = (this._cfg && this._cfg.MD) || (typeof MD!=='undefined' ? MD : null);
    if(!FS || !MDX) throw new Error('migrate 未配置 FS / MD');

    // 递归收集 vault 内 .md（排除 .trash）
    const allMd = [];
    const walk = async(dir)=>{
      let entries=[];
      try{ entries = await FS.list(dir); }catch(e){ return; }
      for(const e of entries){
        const full = dir ? dir+'/'+e.name : e.name;
        if(e.type==='folder'){
          if(!dir && e.name==='.trash') continue;
          await walk(full);
        } else if(/\.md$/.test(e.name)) allMd.push(full);
      }
    };
    await walk('');

    let ok=0, attachments=0, missingAttach=[];
    const failures = [];
    for(const p of allMd){
      let text='';
      try{ text = await FS.read(p); }catch(e){ failures.push({path:p, err:'读不出'}); continue; }
      try{
        const parsed = MDX.parse(text);
        if(!parsed || !Array.isArray(parsed.blocks)) throw new Error('blocks 非数组');
        ok++;
        // 附件存在性
        for(const r of MDX.extractAttachRefs(text)){
          attachments++;
          try{ await FS.readBlob(r.link); }catch(e){ missingAttach.push({path:p, ref:r.link}); }
        }
      }catch(e){
        failures.push({path:p, err:(e&&e.message)||String(e)});
      }
    }
    return {
      files: allMd.length,
      attachments,
      parseRate: allMd.length ? ok/allMd.length : 1,
      missingAttach,
      failures,
      skipped: [],
      notes: allMd
    };
  }
};

if(typeof window!=='undefined') window.Migrate = Migrate;
if(typeof module!=='undefined' && module.exports) module.exports = Migrate;
})();
