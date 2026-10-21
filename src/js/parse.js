/* ============================================================
   P1：可迁移知识库 + 语义切片地基
   ============================================================ */
const KB_VERSION=1, CHUNK_VERSION=2;
/* 父子切片（Small-to-Big）：子块小而精用于检索，父块语义完整用于喂模型/展示；
   overlap 约 13%（CSV：10–15%），表格/代码整块不切断 */
const PARENT_SIZE=860, CHILD_SIZE=300, CHILD_OVERLAP=40;
const CHUNK_SIZE=CHILD_SIZE, CHUNK_OVERLAP=CHILD_OVERLAP; /* 兼容旧引用 */
/* ---- 读取附件为 Blob（idb / native 统一入口） ---- */
async function attachmentBlob(f){
  if(Store.env==='idb'){const b=await idbGetBlob(f.id);if(!b)throw new Error('附件缺失');return b;}
  if(Store.env==='native'){
    const r=await fetch('file?id='+encodeURIComponent(f.id));
    if(!r.ok)throw new Error('读取附件失败');
    return await r.blob();
  }
  throw new Error('当前环境不支持读取附件');
}
/* ---- 对话内联附件：≤10MB 直接进上下文 ---- */
const ATTACH_INLINE_LIMIT=10*1024*1024;
function isImageFile(f){return /\.(png|jpe?g|gif|webp|bmp|heic|heif)$/i.test(f.name||'')||(f.kind||'').indexOf('image/')===0;}
/* 当前模型是否支持图片（视觉）。显式勾选优先；否则按已知视觉模型名判断；
   无法确定时保守返回 false（不发图、只提示），避免向纯文本模型发图报 400。 */
function modelSupportsVision(ai){
  if(!ai)return false;
  if(ai.vision===true)return true;
  if(ai.vision===false)return false;
  return /(gpt-4o|gpt-4[-.]?vision|gpt-5|o3|o4|qwen[0-9.]*-?vl|glm-4v|vision|visual|[-/]vl\b|vl[-/]|doubao[^ ]*vision|doubao[0-9.-]*vl|seed[0-9.]*vl|claude-?[345]|gemini|multimodal)/i.test(ai.model||'');
}
function blobAsDataURL(blob){return new Promise((res,rej)=>{
  const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(blob);});}
async function noteVisionImages(n){
  const out=[];
  for(const f of (n.files||[])){
    if(isImageFile(f)&&(f.size||0)<=ATTACH_INLINE_LIMIT){
      try{out.push({name:f.name,dataUrl:await blobAsDataURL(await attachmentBlob(f))});}catch(e){}
    }
  }
  return out;
}
async function noteDocTexts(n){
  const blocks=[];
  for(const f of (n.files||[])){
    if(isImageFile(f)||(f.size||0)>ATTACH_INLINE_LIMIT)continue;
    let rec=await KB.getFileText(f.id).catch(()=>null);
    if(!rec||!rec.data||rec.data.kind==='unsupported'||rec.data.kind==='error'){
      try{rec=await fileTextFor(f);}catch(e){rec=null;}
    }
    const txt=attachmentRecToText(rec,60000);
    if(txt)blocks.push('〖附件全文：'+f.name+'〗\n'+txt);
  }
  return blocks;
}
/* 图片附件对应的知识切片（图片出现处的上下文文字），随图一并提供 */
async function noteImageSliceText(n){
  const imgs=(n.files||[]).filter(f=>isImageFile(f)&&(f.size||0)<=ATTACH_INLINE_LIMIT);
  if(!imgs.length)return '';
  const all=await KB.allChunks();const blocks=[];
  for(const im of imgs){
    const rel=all.filter(c=>c.noteId===n.id&&Array.isArray(c.attachments)&&
      c.attachments.some(a=>a&&a.id===im.id));
    const txt=rel.map(c=>(c.text||'').replace(/〖附件\d*〗/g,'').trim()).filter(Boolean).join('\n');
    blocks.push('〖图片「'+im.name+'」的知识切片〗\n'+(txt||'（图片附近无额外文字，请以随附图片为准）'));
  }
  return blocks.join('\n\n');
}
/* ---- 哈希（变更检测 / 稳定 id） ---- */
function djb2(str){let h=5381;for(let i=0;i<str.length;i++)h=((h<<5)+h+str.charCodeAt(i))>>>0;return h;}
function djbShort(str){return djb2(str).toString(36);}
async function hashText(str){
  try{
    const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(str));
    return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('');
  }catch(e){return 'djb'+djb2(str).toString(36);}
}

/* ---- KB：切片 / 任务进度 / 附件正文缓存（独立 IndexedDB，端内持久） ---- */
const KB={db:null,available:false,
 async init(){
   if(!window.indexedDB)return;
   try{
     this.db=await new Promise((res,rej)=>{
       const rq=indexedDB.open(DB_NAME+'-kb',1);
       rq.onupgradeneeded=e=>{const d=e.target.result;
         if(!d.objectStoreNames.contains('chunks'))d.createObjectStore('chunks',{keyPath:'id'});
         if(!d.objectStoreNames.contains('jobs'))d.createObjectStore('jobs',{keyPath:'noteId'});
         if(!d.objectStoreNames.contains('filetext'))d.createObjectStore('filetext',{keyPath:'key'});
         if(!d.objectStoreNames.contains('meta'))d.createObjectStore('meta');};
       rq.onsuccess=e=>res(e.target.result);rq.onerror=()=>rej(rq.error);
     });
     this.available=true;
   }catch(e){this.db=null;}
 },
 st(s,m){return this.db.transaction(s,m).objectStore(s);},
 aw(rq){return new Promise((res,rej)=>{rq.onsuccess=()=>res(rq.result);
   rq.onerror=()=>rej(rq.error);});},
 async putChunk(c){if(!this.available)return;await this.aw(this.st('chunks','readwrite').put(c));},
 async allChunks(){if(!this.available)return [];return await this.aw(this.st('chunks','readonly').getAll());},
 /* 批量：跨 store 单事务 put，大幅减少事务往返（千篇场景关键优化） */
 async batch(items){
   if(!this.available||!items||!items.length)return;
   await new Promise((res,rej)=>{
     const tx=this.db.transaction(['chunks','jobs','filetext','meta'],'readwrite');
     tx.oncomplete=res;tx.onerror=()=>rej(tx.error);tx.onabort=()=>rej(tx.error);
     for(const it of items)tx.objectStore(it.store).put(it.obj);
   });
 },
 async delChunksOfNote(noteId){
   if(!this.available)return;
   const all=await this.allChunks();
   const t=this.st('chunks','readwrite');
   all.filter(c=>c.noteId===noteId).forEach(c=>t.delete(c.id));
   await new Promise((res,rej)=>{t.transaction.oncomplete=res;
     t.transaction.onerror=()=>rej(t.transaction.error);});
 },
 async putJob(j){if(!this.available)return;await this.aw(this.st('jobs','readwrite').put(j));},
 async getJob(noteId){if(!this.available)return null;
   return await this.aw(this.st('jobs','readonly').get(noteId));},
 async allJobs(){if(!this.available)return [];return await this.aw(this.st('jobs','readonly').getAll());},
 async delJob(noteId){if(!this.available)return;
   await this.aw(this.st('jobs','readwrite').delete(noteId));},
 async putFileText(ft){if(!this.available)return;
   await this.aw(this.st('filetext','readwrite').put(ft));},
 async getFileText(key){if(!this.available)return null;
   return await this.aw(this.st('filetext','readonly').get(key));},
 async setMeta(k,v){if(!this.available)return;
   await this.aw(this.st('meta','readwrite').put(v,k));},
 async getMeta(k){if(!this.available)return null;
   return await this.aw(this.st('meta','readonly').get(k));}
};

/* ============ 文档识别结果 → 带格式 Markdown ============ */
function tableToMdFromRows(rows){
  if(!rows.length)return '';
  const n=Math.max(...rows.map(r=>r.length));
  rows.forEach(r=>{while(r.length<n)r.push('');});
  const head=rows[0];
  return ['| '+head.join(' | ')+' |','| '+head.map(()=>'---').join(' | ')+' |']
    .concat(rows.slice(1).map(r=>'| '+r.join(' | ')+' |')).join('\n');
}
function splitCsvLine(l){
  const out=[];let cur='',q=false;
  for(let i=0;i<l.length;i++){const ch=l[i];
    if(ch==='"'){if(q&&l[i+1]==='"'){cur+='"';i++;}else q=!q;}
    else if(ch===','&&!q){out.push(cur.trim());cur='';}
    else cur+=ch;}
  out.push(cur.trim());return out;
}
function csvToMd(csv){
  const rows=csv.split(/\r?\n/).filter(l=>l.trim()!=='').map(splitCsvLine);
  if(rows.length<1)return csv;
  return tableToMdFromRows(rows);
}
function htmlToMarkdown(html){
  const root=document.createElement('div');root.innerHTML=html||'';
  const out=[];
  function inline(node){
    let s='';
    node.childNodes.forEach(c=>{
      if(c.nodeType===3){s+=c.textContent;return;}
      if(c.nodeType!==1)return;
      const t=c.tagName.toLowerCase(),inner=inline(c);
      if(t==='strong'||t==='b')s+='**'+inner+'**';
      else if(t==='em'||t==='i')s+='*'+inner+'*';
      else if(t==='br')s+='\n';
      else if(t==='a')s+='['+inner+']('+(c.getAttribute('href')||'')+')';
      else if(t==='img')s+='![图片]('+(c.getAttribute('src')||'')+')';
      else if(t==='code')s+='`'+inner+'`';
      else s+=inner;
    });
    return s;
  }
  function block(node){
    node.childNodes.forEach(c=>{
      if(c.nodeType!==1){if(c.textContent.trim())out.push(c.textContent.trim()+'\n');return;}
      const t=c.tagName.toLowerCase();
      if(/^h[1-6]$/.test(t))out.push('\n'+'#'.repeat(+t[1])+' '+inline(c).trim()+'\n');
      else if(t==='p'){const x=inline(c).trim();if(x)out.push(x+'\n');}
      else if(t==='div')block(c);
      else if(t==='ul'){Array.from(c.children).forEach(li=>out.push('- '+inline(li).trim()));out.push('');}
      else if(t==='ol'){let i=1;Array.from(c.children).forEach(li=>out.push((i++)+'. '+inline(li).trim()));out.push('');}
      else if(t==='blockquote')out.push('> '+inline(c).trim()+'\n');
      else if(t==='table')out.push(tableNodeToMd(c)+'\n');
      else if(t==='img')out.push('![图片]('+(c.getAttribute('src')||'')+')\n');
      else if(t==='hr')out.push('---\n');
      else{const x=inline(c).trim();if(x)out.push(x+'\n');}
    });
  }
  function tableNodeToMd(tbl){
    const rows=Array.from(tbl.rows).map(r=>Array.from(r.cells)
      .map(c=>c.textContent.trim().replace(/\|/g,'\\|').replace(/\n/g,' ')));
    return tableToMdFromRows(rows);
  }
  block(root);
  return out.join('\n').replace(/\n{3,}/g,'\n\n').trim();
}
/* ---- 附件正文提取 ---- */
function isTextDoc(name){
  const n=(name||'').toLowerCase();
  return n.endsWith('.pdf')||n.endsWith('.docx')||
    n.endsWith('.xlsx')||n.endsWith('.xls')||
    /\.(txt|md|markdown|csv|json|log|text)$/.test(n);
}
/* 提取附件正文并缓存：附件内容 hash 未变则复用，避免重复解析大文件 */
async function fileTextFor(f){
  const blob=await attachmentBlob(f);
  const fh=await hashText(f.id+':'+(f.size||blob.size));
  const cached=await KB.getFileText(f.id);
  if(cached&&cached.hash===fh)return cached;
  const n=(f.name||'').toLowerCase();let data;
  const ab=await blob.arrayBuffer();
  try{
    if(n.endsWith('.pdf'))data=await parsePdfMain(ab);
    else if(n.endsWith('.docx'))data=await ParseW.parseDocx(ab);
    else if(n.endsWith('.xlsx')||n.endsWith('.xls'))data=await ParseW.parseSheet(ab);
    else if(n.endsWith('.csv'))data={kind:'sheet',sheets:[{sheet:'CSV',text:new TextDecoder().decode(ab).trim()}]};
    else if(/\.(txt|md|markdown|json|log|text)$/.test(n))data={kind:'text',text:new TextDecoder().decode(ab)};
    else data={kind:'unsupported'};
  }catch(ex){data={kind:'error',error:ex&&ex.message?ex.message:'无法解析该文件'};}
  const rec={key:f.id,name:f.name,idx:f.idx||0,hash:fh,data};
  await KB.putFileText(rec);
  return rec;
}
/* 把结构化识别结果转成带格式 Markdown */
function fileTextToMarkdown(ft){
  const d=ft.data;const base=(ft.name||'文档').replace(/\.[^.]+$/,'');
  /* docx 自带标题时让其自身标题打头，不重复加文件名 H1；其余类型用文件名 H1 */
  let md=(d.kind==='docx'&&d.html&&/<h[1-6]/i.test(d.html))?'':'# '+base+'\n\n';
  if(d.kind==='pdf'){
    d.pages.forEach(p=>{md+='## 第'+p.page+'页\n\n';
      md+=p.noText?'> 本页无文本层（可能为扫描图片页）\n\n':(p.text||'')+'\n\n';});
  }else if(d.kind==='docx'){
    md+=(d.html?htmlToMarkdown(d.html):d.text)+'\n\n';
  }else if(d.kind==='sheet'){
    d.sheets.forEach(sh=>{md+='## '+sh.sheet+'\n\n'+csvToMd(sh.text)+'\n\n';});
  }else if(d.kind==='text'){md+=d.text+'\n\n';}
  else md+='> 该文件类型暂不支持文字提取。\n\n';
  md+='---\n> 由「纸片」文档解析生成 · 来源文件：'+ft.name+'\n';
  return md;
}
/* 生成/更新附件的 Markdown 派生条目（hidden，derivedOf 指回原附件），随库存取/备份/迁移 */
async function ensureAttachmentMd(note,f){
  if(!isTextDoc(f.name)||f.kind==='image'||f.hidden)return null;
  const ft=await fileTextFor(f);
  const k=ft.data&&ft.data.kind;
  /* 解析失败 / 不支持的类型不产生空 md，避免无意义派生条目 */
  if(k==='error'||k==='unsupported')
    throw new Error((ft.data&&ft.data.error)||'该文件暂不支持提取文本');
  const mdText=fileTextToMarkdown(ft);
  return await saveDerivedMd(note,f,mdText,'文档解析');
}
/* 附件添加后后台生成 md（不阻塞），完成即落盘 */
function scheduleDeriveMd(note,f){
  if(!isTextDoc(f.name)||f.kind==='image'||f.hidden)return;
  ensureAttachmentMd(note,f).then(()=>persist())
    .catch(e=>Logs.warn('附件','生成 Markdown 失败',(e&&e.message)||String(e)));
}
/* ============ 轻量文档解析 Worker（确定性、无模型、后台不卡 UI） ============
   仅提取 Word / Excel 文本；PDF 由主线程 pdf.js 标准 worker 处理；图片不识别（无 OCR）。 */
function parseWorkerMain(){
  let mammoth=null,XLSX=null;
  function ensureMammoth(base){if(mammoth)return mammoth;
    importScripts(base+'vendor/mammoth.browser.min.js');mammoth=globalThis.mammoth;return mammoth;}
  function ensureXlsx(base){if(XLSX)return XLSX;
    importScripts(base+'vendor/xlsx.full.min.js');XLSX=globalThis.XLSX;return XLSX;}
  async function parseDocx(base,buf){
    const mm=ensureMammoth(base);
    const h=await mm.convertToHtml({arrayBuffer:buf});
    const html=h.value||'';
    const text=html.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
    return {kind:'docx',html,text};
  }
  async function parseSheet(base,buf){
    const X=ensureXlsx(base);
    const wb=X.read(buf,{type:'array'});
    return {kind:'sheet',sheets:wb.SheetNames.map(nm=>({sheet:nm,
      text:X.utils.sheet_to_csv(wb.Sheets[nm]).trim()}))};
  }
  onmessage=async function(ev){
    const m=ev.data;
    function ok(data){postMessage({id:m.id,ok:true,data});}
    function fail(msg){postMessage({id:m.id,ok:false,error:msg});}
    try{
      if(m.cmd==='docx')ok(await parseDocx(m.base,m.buf));
      else if(m.cmd==='xlsx')ok(await parseSheet(m.base,m.buf));
      else fail('unknown');
    }catch(e){fail((e&&e.message)||String(e));}
  };
}

/* ---- 解析 Worker 客户端 ---- */
const ParseW={
  seq:0,calls:{},_w:null,
  base(){return (location.protocol==='https:'||location.protocol==='http:')
    ?location.origin+'/':'./';},
  worker(){if(this._w)return this._w;
    const url=URL.createObjectURL(new Blob(['('+parseWorkerMain.toString()+')();'],
      {type:'text/javascript'}));
    this._w=new Worker(url);
    this._w.onmessage=e=>{const m=e.data,c=this.calls[m.id];if(!c)return;
      if(m.progress){if(c.pg)c.pg(m.progress);return;}
      delete this.calls[m.id];m.ok?c.res(m.data):c.rej(new Error(m.error||'解析失败'));};
    return this._w;},
  call(cmd,buf,onProgress){
    const id=++this.seq;
    return new Promise((res,rej)=>{this.calls[id]={res,rej,pg:onProgress||null};
      this.worker().postMessage({cmd,id,base:this.base(),buf},[buf]);});
  },
  parseDocx(buf){return this.inline?parseDocxMain(buf):this.call('docx',buf);},
  parseSheet(buf){return this.inline?parseSheetMain(buf):this.call('xlsx',buf);}
};
/* file:// 等无法在 blob Worker 内 importScripts 相对路径的环境：主线程解析；
   真机 https://zhipian.local 仍走后台 Worker（不卡 UI）。 */
ParseW.inline=location.protocol!=='https:'&&location.protocol!=='http:';
let _mammoth=null,_XLSX=null;
async function parseDocxMain(buf){
  if(!_mammoth){await loadScript(ParseW.base()+'vendor/mammoth.browser.min.js');_mammoth=window.mammoth;}
  const h=await _mammoth.convertToHtml({arrayBuffer:buf});
  const html=h.value||'';
  const text=html.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
  return {kind:'docx',html,text};
}
async function parseSheetMain(buf){
  if(!_XLSX){await loadScript(ParseW.base()+'vendor/xlsx.full.min.js');_XLSX=window.XLSX;}
  const wb=_XLSX.read(buf,{type:'array'});
  return {kind:'sheet',sheets:wb.SheetNames.map(nm=>({sheet:nm,
    text:_XLSX.utils.sheet_to_csv(wb.Sheets[nm]).trim()}))};
}

/* ---- PDF 主线程解析（pdf.js 标准 Web Worker，独立后台线程、不卡 UI） ----
   Blob worker 内 pdf.js 的 fake/nested worker 在部分环境取 cmap 异常，
   故 PDF 统一用 pdf.js 官方 web worker（同源 vendor），真机与测试行为一致。 */
let mainPdfjs=null;
async function ensureMainPdf(){
  if(mainPdfjs)return mainPdfjs;
  await loadScript(ParseW.base()+'vendor/pdf.min.js');
  mainPdfjs=window.pdfjsLib;
  mainPdfjs.GlobalWorkerOptions.workerSrc=ParseW.base()+'vendor/pdf.worker.min.js';
  return mainPdfjs;
}
async function parsePdfMain(buf,onProgress){
  const pdfjs=await ensureMainPdf();const base=ParseW.base();
  const pdf=await pdfjs.getDocument({data:buf,cMapUrl:base+'vendor/cmaps/',
    cMapPacked:true,useSystemFonts:true,enableXfa:false}).promise;
  const pages=[];
  for(let p=1;p<=pdf.numPages;p++){
    const page=await pdf.getPage(p);
    const tc=await page.getTextContent();
    const text=tc.items.map(it=>it.str).join('\n').replace(/\n{3,}/g,'\n\n').trim();
    const valid=(text.match(/[一-鿿A-Za-z0-9]/g)||[]).length;
    pages.push({page:p,text,valid,noText:valid<10});
    if(onProgress)onProgress({i:p,total:pdf.numPages});
  }
  return {kind:'pdf',pages};
}

/* 派生 Markdown：确定性解析结果存为 hidden md（derivedOf 指回原附件） */
async function saveDerivedMd(note,f,mdText,label){
  const base=f.name.replace(/\.[^.]+$/,'');
  const body='# '+base+'\n\n'+mdText.trim()
    +'\n\n---\n> 由「纸片」'+(label||'文档解析')+'生成 · 来源文件：'+f.name+'\n';
  let md=(note.files||[]).find(x=>x.kind==='md'&&x.derivedOf===f.id);
  if(md){
    await Store.addBlob(md.id,new Blob([body],{type:'text/markdown'}));
    md.name=base+'.md';md.size=body.length;
  }else{
    const id=uid();
    await Store.addBlob(id,new Blob([body],{type:'text/markdown'}));
    md={id,name:base+'.md',size:body.length,type:'text/markdown',kind:'md',
      derivedOf:f.id,idx:f.idx,hidden:true};
    note.files.push(md);
  }
  return md;
}
/* 导出前按需补齐 Markdown：确定性文档（docx/sheet/text/文本pdf）自动解析；
   图片/扫描pdf 不自动 OCR，仅保留已识别的 md。返回处理的附件数 */
async function ensureAllExportMd(onProgress){
  const jobs=[];
  notes.forEach(n=>(n.files||[]).forEach(f=>{
    if(!f.hidden&&f.kind!=='md')jobs.push({n,f});}));
  let done=0;
  for(const {n,f} of jobs){
    const hasMd=(n.files||[]).some(x=>x.kind==='md'&&x.derivedOf===f.id);
    if(f.kind==='image'){ /* 图片不提取文字 */ }
    else if(!hasMd){ /* pdf/docx/xlsx/text 经解析 Worker 现场提取（后台、不卡） */
      try{await ensureAttachmentMd(n,f);}
      catch(e){Logs.warn('导出','附件解析失败 '+f.name,(e&&e.message)||String(e));}
    }
    done++;if(onProgress)onProgress({i:done,total:jobs.length});
  }
  await persist();
  return jobs.length;
}
/* 提取结果展开为带位置的文本段 [{text,loc}] */
function fileTextSegments(ft){
  const d=ft.data;const segs=[];
  if(d.kind==='pdf')d.pages.forEach(p=>{if(p.text)segs.push({text:p.text,loc:'第'+p.page+'页'});});
  else if(d.kind==='docx')d.text.split(/\n{2,}/).forEach(s=>{s=s.trim();if(s)segs.push({text:s,loc:''});});
  else if(d.kind==='sheet')d.sheets.forEach(sh=>{
    sh.text.split(/\n{2,}/).forEach(s=>{s=s.trim();if(s)segs.push({text:s,loc:sh.sheet});});});
  else if(d.kind==='text')d.text.split(/\n{2,}/).forEach(s=>{s=s.trim();if(s)segs.push({text:s,loc:''});});
  return segs;
}

/* ---- 语义切片 ---- */
/* 正文段（保留附件位置）：按块级元素分段，遇到内联附件标记即在该段
   记录 attachments，供切片关联；图片用 data-id、文档用 .attref */
function bodySegments(html){
  const d=document.createElement('div');d.innerHTML=html||'';
  const segs=[];let buf='';const atts=[];
  const pushAtt=el=>{
    const fid=el.getAttribute('data-fid')||el.getAttribute('data-id');if(!fid)return;
    atts.push({id:fid,idx:Number(el.getAttribute('data-idx'))||0,
      name:el.getAttribute('data-name')||'附件'});
    buf+='〖附件'+(el.getAttribute('data-idx')||'')+'〗';
  };
  const flush=()=>{
    const t=buf.trim();
    if(t||atts.length){
      const seg={text:t||'〖附件〗'};
      if(atts.length)seg.attachments=atts.slice();
      segs.push(seg);}
    buf='';atts.length=0;
  };
  const walk=node=>{
    node.childNodes.forEach(ch=>{
      if(ch.nodeType===3){buf+=ch.textContent;return;}
      if(ch.nodeType!==1)return;
      const tag=ch.tagName;
      if(tag==='IMG'){
        if(ch.hasAttribute('data-id'))pushAtt(ch);else buf+='[图片]';return;}
      if(ch.classList&&ch.classList.contains('attref')){pushAtt(ch);return;}
      if(tag==='BR')return;
      if(['P','DIV','LI','H1','H2','H3','H4','TR','BLOCKQUOTE','PRE','UL','OL'].includes(tag)){
        flush();if(tag==='LI')buf+='• ';walk(ch);flush();
      }else walk(ch);
    });
  };
  walk(d);flush();
  return segs.filter(s=>(s.text||'').trim()||(s.attachments&&s.attachments.length));
}
/* 长文本滑窗（带重叠，避免在句中硬切丢失上下文） */
function windowSplit(text,size,overlap){
  const out=[];
  if(text.length<=size)return [text];
  const step=Math.max(1,size-overlap);
  for(let k=0;k<text.length;k+=step){
    out.push(text.slice(k,k+size));
    if(k+size>=text.length)break;
  }
  return out;
}
/* 面包屑：笔记本 / 标题 / 位置 */
function crumbsFor(note,loc){
  const title=note.title||'未命名';
  const c=[note.notebook||'全部',title];
  if(loc)c.push(loc);
  return c.filter(Boolean).join(' / ');
}
/* 检索结果实时面包屑：按当前笔记的笔记本归属生成（移动后也正确，不依赖切片缓存） */
function liveCrumb(r){
  const cn=notes.find(x=>String(x.id)===String(r.parent.noteId));
  return cn?crumbsFor(cn):(r.parent.crumbs||'原便签');
}
/* 父块：语义完整大段（喂模型 / 展示完整上下文） */
function makeParent(note,seq,text,extra){
  const id=String(note.id||'n').slice(-10)+'_p_'+seq+'_'+djbShort(text+text.length);
  const p={id,noteId:note.id,seq,level:'parent',kind:'parent',text,
    crumbs:crumbsFor(note,extra&&extra.loc),
    notebook:note.notebook||'',
    hash:djbShort(text),updatedAt:Date.now()};
  if(extra)for(const k in extra){if(k!=='segs'&&k!=='childTexts')p[k]=extra[k];}
  return p;
}
/* 子块：小而精的检索单元，命中后凭 parentId 回到父块（Small-to-Big） */
function makeChild(note,seq,kind,text,parentId,extra){
  const id=String(note.id||'n').slice(-10)+'_'+kind[0]+'_'+seq+'_'+djbShort(text+text.length);
  const c={id,noteId:note.id,seq,level:'child',kind,text,parentId,
    crumbs:crumbsFor(note,extra&&extra.loc),
    notebook:note.notebook||'',
    hash:djbShort(text),updatedAt:Date.now()};
  if(extra)for(const k in extra){if(k!=='segs'&&k!=='childTexts')c[k]=extra[k];}
  return c;
}
/* 识别"不可切断"单元：Markdown 表格（连续 | 行）/ 代码块，整块保留 */
function markNoSplitParas(paras){
  return paras.map(p=>{
    const o=(typeof p==='string')?{text:p}:p;
    const lines=o.text.split('\n');
    const barLines=lines.filter(l=>l.includes('|')).length;
    const code=/^(```|~~~)/.test(o.text.trim())||
      (lines.length>1&&lines.every(l=>/^(\t| {4})\S/.test(l)));
    o.noSplit=barLines>=2||code;return o;
  });
}
/* 语义段 -> 父块（含其下子块文本）；seg 可带 loc/fileId/fileIdx/fileName/done/noSplit */
function buildParentChildren(paras){
  const segs=paras.map(p=>(typeof p==='string'?{text:p}:p))
    .filter(s=>(s.text||'').trim());
  const parents=[];let buf=[];
  const btext=()=>buf.map(s=>s.text).join('\n');
  const flush=()=>{if(buf.length){parents.push({text:btext(),segs:buf.slice()});buf=[];}};
  segs.forEach(s=>{
    if(s.noSplit){flush();parents.push({text:s.text,segs:[s]});return;}
    if(s.text.length>PARENT_SIZE){flush();
      windowSplit(s.text,PARENT_SIZE,Math.round(PARENT_SIZE*0.1))
        .forEach(t=>parents.push({text:t,segs:[{text:t,loc:s.loc}]}));return;}
    if(buf.length&&btext().length+1+s.text.length>PARENT_SIZE)flush();
    buf.push(s);
  });
  flush();
  parents.forEach(p=>{
    const noSplit=p.segs.length===1&&p.segs[0].noSplit;
    p.childTexts=noSplit?[p.text]:windowSplit(p.text,CHILD_SIZE,CHILD_OVERLAP);
    const atts=[];
    p.segs.forEach(s=>{
      if(Array.isArray(s.attachments))s.attachments.forEach(a=>{
        if(!atts.some(x=>x.id===a.id))atts.push(a);});
      for(const k in s){
        if(k==='text'||k==='noSplit'||k==='attachments')continue;
        if(s[k]!=null&&p[k]==null)p[k]=s[k];}});
    if(atts.length)p.attachments=atts;
  });
  return parents;
}
function bodyRaw(note){
  return buildParentChildren(markNoSplitParas(bodySegments(note.content)));
}
function todoRaw(note){
  const paras=(note.todos||[]).filter(t=>(t.text||'').trim())
    .map(t=>({text:(t.done?'[已完成] ':'[待办] ')+t.text,done:!!t.done}));
  return buildParentChildren(paras);
}
async function fileRaw(note,fileId){
  const f=(note.files||[]).find(x=>x.id===fileId);if(!f)return [];
  let ft;try{ft=await fileTextFor(f);}catch(e){return [];}
  const paras=[];
  fileTextSegments(ft).forEach(seg=>paras.push({text:seg.text,loc:seg.loc,
    noSplit:ft.kind==='xlsx',fileId:f.id,fileIdx:f.idx||0,fileName:f.name}));
  return buildParentChildren(paras);
}

/* 便签内容指纹：标题/笔记本/正文/待办/附件元数据，任一变化即触发重建 */
async function noteSourceHash(note){
  const todos=(note.todos||[]).map(t=>(t.text||'')+':'+(t.done?1:0)).join('|');
  const files=(note.files||[]).map(f=>f.id+':'+(f.size||0)+':'+(f.name||'')).join('|');
  return hashText([CHUNK_VERSION,note.title||'',note.notebook||'',
    note.content||'',todos,files].join(''));
}
function planSteps(note){
  const steps=[{type:'body',done:false,count:0}];
  if(note.todos&&note.todos.some(t=>(t.text||'').trim()))
    steps.push({type:'todos',done:false,count:0});
  /* Markdown 派生条目（hidden）不重复切片，只切原始文档 */
  (note.files||[]).forEach(f=>{if(!f.hidden&&f.kind!=='md'&&isTextDoc(f.name))
    steps.push({type:'file',fileId:f.id,done:false,count:0});});
  return steps;
}
/* 对单条便签切片：收集本篇 job+父/子块，单篇一次批量事务；
   sink 模式由上层跨篇攒批提交。hash 未变跳过，变了增量重建；filetext 缓存复用 */
async function chunkNote(note,hooks,sink){
  if(!KB.available)throw new Error('当前环境不支持构建知识索引');
  const nhash=await noteSourceHash(note);
  let job=await KB.getJob(note.id);
  if(job&&job.hash===nhash&&job.status==='done')
    return {skipped:true,count:(job.steps||[]).reduce((a,s)=>a+(s.count||0),0)};
  if(job)await KB.delChunksOfNote(note.id);   /* 增量重建（少见），filetext 保留 */
  job={noteId:note.id,hash:nhash,status:'done',
    steps:planSteps(note),updatedAt:Date.now()};
  let parentSeq=0,childSeq=0,total=0;const items=[];
  for(let k=0;k<job.steps.length;k++){
    const step=job.steps[k];
    if(hooks&&hooks.shouldStop&&hooks.shouldStop())throw new Error('abort');
    let parents=[];
    try{
      if(step.type==='body')parents=bodyRaw(note);
      else if(step.type==='todos')parents=todoRaw(note);
      else if(step.type==='file')parents=await fileRaw(note,step.fileId);
    }catch(stepErr){step.error=String((stepErr&&stepErr.message)||stepErr);parents=[];}
    const baseKind=step.type==='body'?'text':step.type==='todos'?'todo':'file';
    step.pcount=parents.length;step.count=0;
    for(const p of parents){
      const pmeta=Object.assign({},p);
      delete pmeta.text;delete pmeta.childTexts;delete pmeta.segs;
      /* 正文/待办切片携带本便签附件索引：命中后可把相关附件一起取回交给模型 */
      if(step.type!=='file')pmeta.attachments=(note.files||[])
        .filter(f=>!f.hidden&&f.kind!=='md').map(f=>(
        {id:f.id,idx:f.idx||0,name:f.name,kind:f.kind}));
      const parent=makeParent(note,parentSeq++,p.text,pmeta);
      items.push({store:'chunks',obj:parent});
      for(const ct of p.childTexts){
        const child=makeChild(note,childSeq++,baseKind,ct,parent.id,pmeta);
        items.push({store:'chunks',obj:child});
        step.count++;total++;
      }
    }
    step.done=true;
    if(hooks&&hooks.onStep)hooks.onStep(k,job.steps.length,total);
  }
  items.push({store:'jobs',obj:job});
  if(sink)sink.items.push(...items);
  else await KB.batch(items);
  return {skipped:false,count:total};
}

/* ---- 构建 / 更新知识切片 ---- */
function showChunkOverlay(){
  $('#syncTitle').textContent='正在构建知识库';
  setChunkOverlay(0,'准备中…');
  $('#syncOverlay').classList.add('show');
}
function setChunkOverlay(pct,msg){
  $('#syncPct').textContent=pct+'%';
  if(msg)$('#syncMsg').textContent=msg;
}
function hideChunkOverlay(){$('#syncOverlay').classList.remove('show');}
async function notesNeedingChunking(){
  const need=[];
  for(const n of notes.filter(x=>!x.trashed)){
    const h=await noteSourceHash(n);
    const job=await KB.getJob(n.id);
    if(!job||job.hash!==h||job.status!=='done')need.push(n);
  }
  return need;
}
async function runChunkTargets(targets,hooks){
  let done=0,totalChunks=0;const N=targets.length,B=100;
  let sink={items:[]};
  const flush=async()=>{if(sink.items.length){await KB.batch(sink.items);sink={items:[]};}};
  for(let i=0;i<N;i++){
    if(hooks&&hooks.shouldStop&&hooks.shouldStop()){await flush();break;}
    const r=await chunkNote(targets[i],{
      shouldStop:hooks&&hooks.shouldStop,
      onStep:(k,sc)=>{
        if(hooks&&hooks.progress)
          hooks.progress(Math.round(((i+(k+1)/sc)/N)*100),
            (targets[i].title||'未命名')+'（'+(k+1)+'/'+sc+'）');
      }},sink);
    totalChunks+=r.count||0;done++;
    if(hooks&&hooks.progress)
      hooks.progress(Math.round(((i+1)/N)*100),'已完成 '+done+'/'+N);
    if((i+1)%B===0)await flush();
  }
  await flush();
  return {done,totalChunks};
}
/* background=true：启动前台服务保活，切后台/锁屏继续切片 */
async function buildKnowledgeIndex(background){
  if(!KB.available){toast('当前环境不支持知识索引');return;}
  const targets=await notesNeedingChunking();
  if(!targets.length){toast('知识库已是最新');return;}
  toast('开始处理 '+targets.length+' 张便签…');
  Logs.info('知识库','开始切片，待处理 '+targets.length+' 张');
  try{
    if(background&&hasNative()){
      await Native.call('startChunkService');
      let stopped=false;
      const stopS=async()=>{if(stopped)return;stopped=true;
        await Native.call('stopChunkService').catch(()=>{});};
      const r=await runChunkTargets(targets,{
        progress:async(pct,msg)=>{
          await Native.call('chunkProgress',
            JSON.stringify({pct,msg})).catch(()=>{});}});
      await stopS();
      toast('知识切片完成，共 '+r.totalChunks+' 片');
      Logs.info('知识库','切片完成（后台），共 '+r.totalChunks+' 片');
    }else{
      showChunkOverlay();
      const r=await runChunkTargets(targets,{
        progress:(pct,msg)=>setChunkOverlay(pct,msg)});
      hideChunkOverlay();
      toast('知识切片完成，共 '+r.totalChunks+' 片');
      Logs.info('知识库','切片完成，共 '+r.totalChunks+' 片');
    }
  }catch(e){
    if(background&&hasNative())await Native.call('stopChunkService').catch(()=>{});
    hideChunkOverlay();
    if(e&&e.message==='abort'){toast('已停止，进度已保存可续切');Logs.warn('知识库','切片手动停止，可续切');}
    else{toast(e&&e.message?e.message:'切片中断，可续切');
      Logs.error('知识库','切片中断',(e&&e.stack)?e.stack:String(e));}
  }
}
