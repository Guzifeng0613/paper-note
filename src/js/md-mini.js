/* ============================================================
   md-mini.js —— 纸片 v16 最小 Markdown 引擎（M1 内置版）
   全局名 MD。M3 将被完整 markdown.js 替换，方法签名遵循 docs/VAULT-INTERFACE.md 第3节。
   方言 = Obsidian 兼容子集：##标题 / **粗** / *斜* / ==高亮== / <u>下划</u> /
   ~~删除~~ / `行内码` / ```代码块``` / >引用 / - / 1. / --- /
   - [ ] / - [x]（优先级 #p/high #p/low） / ![[图]] / ![](图) / [名](文件) / [[双链]] / #标签
   ============================================================ */
(function(){
'use strict';

/* ---------- frontmatter ---------- */
function parseFrontmatter(text){
  if(!text) return { fm:null, body:'' };
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if(!m) return { fm:null, body:text };
  const raw = m[1];
  const body = text.slice(m[0].length);
  const fm = {};
  raw.split(/\r?\n/).forEach(line=>{
    const mm = line.match(/^\s*([\w.-]+)\s*:\s*(.*)$/);
    if(!mm) return;
    let key = mm[1], val = mm[2].trim();
    if(val.startsWith('[') && val.endsWith(']')){
      val = val.slice(1,-1).split(',').map(s=>s.trim().replace(/^["']|["']$/g,'')).filter(Boolean);
    } else {
      val = val.replace(/^["']|["']$/g,'');
      if(val==='true') val=true;
      else if(val==='false') val=false;
      else if(val!=='' && !isNaN(Number(val))) val=Number(val);
    }
    fm[key]=val;
  });
  return { fm, body };
}
function stringifyFrontmatter(fm){
  const keys = Object.keys(fm||{});
  if(!keys.length) return '';
  const lines = keys.map(k=>{
    let v = fm[k];
    if(Array.isArray(v)) v = '[' + v.join(', ') + ']';
    else if(typeof v === 'string') v = v;
    else v = String(v);
    return k+': '+v;
  });
  return '---\n'+lines.join('\n')+'\n---\n';
}

/* ---------- 行内渲染 ---------- */
function inline(t){
  let s = esc(t);
  /* 图片 ![[alt]] 与 ![](url) —— 先抓，避免内部被当文本 */
  s = s.replace(/!\[\[([^\]]*)\]\]/g, (_,alt)=>'<img class="md-img" src="attachments/'+encodeURIComponent(alt)+'" alt="'+esc(alt)+'">');
  s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_,alt,url)=>'<img class="md-img" src="'+url+'" alt="'+esc(alt)+'">');
  /* 附件链接 [名](path) */
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_,txt,url)=>'<a class="md-link" href="'+url+'">'+txt+'</a>');
  /* 双链 [[名]] */
  s = s.replace(/\[\[([^\]]+)\]\]/g, '<span class="md-wiki">[[ $1 ]]</span>');
  /* 下划线 <u>..</u>（HTML 已被 esc 转义，需还原） */
  s = s.replace(/&lt;u&gt;([\s\S]*?)&lt;\/u&gt;/g, '<u>$1</u>');
  /* 代码块在行内场景不处理；行内码 `x` */
  s = s.replace(/`([^`]+)`/g, '<code class="md-code">$1</code>');
  /* 高亮 ==x== */
  s = s.replace(/==([^=]+)==/g, '<mark class="md-hl">$1</mark>');
  /* 删除线 ~~x~~ */
  s = s.replace(/~~([^~]+)~~/g, '<del>$1</del>');
  /* 加粗 **x** */
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  /* 斜体 *x* */
  s = s.replace(/(^|\W)\*([^*\n]+)\*(\W|$)/g, '$1<em>$2</em>$3');
  /* 标签 #标签（汉字/字母/数字） */
  s = s.replace(/(^|\s)#([\u4e00-\u9fa5\w-]+)/g, '$1<span class="md-tag">#$2</span>');
  return s;
}

/* ---------- 块级渲染 ---------- */
function toHTML(md){
  const { fm, body } = parseFrontmatter(md||'');
  const lines = body.split(/\r?\n/);
  let html = '', i = 0;
  const flushList = (buf, ordered) => {
    if(!buf.length) return;
    html += (ordered?'<ol>':'<ul>') + buf.map(li=>'<li>'+li+'</li>').join('') + (ordered?'</ol>':'</ul>');
    buf.length = 0;
  };
  let ulBuf = [], olBuf = [];
  while(i < lines.length){
    let line = lines[i];
    /* 代码块 ``` */
    const fence = line.match(/^```(\w*)\s*$/);
    if(fence){
      const code = []; i++;
      while(i < lines.length && !/^```\s*$/.test(lines[i])){ code.push(lines[i]); i++; }
      i++;
      html += '<pre class="md-pre"><code>'+esc(code.join('\n'))+'</code></pre>';
      continue;
    }
    /* 分割线 ---（需独立成行且非 frontmatter） */
    if(/^---\s*$/.test(line)){ flushList(ulBuf); flushList(olBuf,true); html+='<hr class="md-hr">'; i++; continue; }
    /* 引用 > */
    if(/^>\s?/.test(line)){
      flushList(ulBuf); flushList(olBuf,true);
      const q = [];
      while(i < lines.length && /^>\s?/.test(lines[i])){ q.push(lines[i].replace(/^>\s?/,'')); i++; }
      html += '<blockquote class="md-quote">'+q.map(l=>'<p>'+inline(l)+'</p>').join('')+'</blockquote>';
      continue;
    }
    /* 标题 ##~###### */
    const h = line.match(/^(#{2,6})\s+(.*)$/);
    if(h){ flushList(ulBuf); flushList(olBuf,true);
      const lv = h[1].length; html += '<h'+lv+' class="md-h">'+inline(h[2])+'</h'+lv+'>'; i++; continue; }
    /* 待办 */
    const todo = line.match(/^(\s*)- \[([ xX])\]\s+(.*)$/);
    if(todo){
      flushList(ulBuf); flushList(olBuf,true);
      const indent = todo[1].length, done = todo[2].toLowerCase()==='x';
      html += todoRowHTML(line, indent, done, todo[3]);
      i++; continue;
    }
    /* 无序列表 */
    const ul = line.match(/^(\s*)-\s+(.*)$/);
    if(ul){ olBuf.length && flushList(olBuf,true); ulBuf.push(inline(ul[2])); i++; continue; }
    /* 有序列表 */
    const ol = line.match(/^(\s*)\d+\.\s+(.*)$/);
    if(ol){ ulBuf.length && flushList(ulBuf); olBuf.push(inline(ol[2])); i++; continue; }
    /* 空行 */
    if(!line.trim()){ flushList(ulBuf); flushList(olBuf,true); i++; continue; }
    /* 普通段落 */
    flushList(ulBuf); flushList(olBuf,true);
    html += '<p class="md-p">'+inline(line)+'</p>';
    i++;
  }
  flushList(ulBuf); flushList(olBuf,true);
  return html || '<p class="md-p md-empty">（空笔记）</p>';
}

/* 待办行 HTML（M1 只读展示用；可勾选在 VUI 层处理） */
function todoRowHTML(orig, indent, done, text){
  const pr = (text.match(/#p\/(high|low)/)||[])[1] || '';
  const clean = text.replace(/#p\/(high|low)/g,'').trim();
  return '<div class="md-todo'+(done?' done':'')+(pr?' p-'+pr:'')+'" data-done="'+(done?1:0)+'">'
    +'<span class="md-todo-box">'+(done?'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>':'')+'</span>'
    +'<span class="md-todo-text">'+inline(clean)+'</span></div>';
}

/* ---------- 待办行抽取 / 回写 ---------- */
function todoLines(md){
  const { body } = parseFrontmatter(md||'');
  const out = [];
  body.split(/\r?\n/).forEach((line, idx)=>{
    const m = line.match(/^(\s*)- \[([ xX])\]\s+(.*)$/);
    if(!m) return;
    const pr = (m[3].match(/#p\/(high|low)/)||[])[1] || 'normal';
    out.push({ key:String(idx), indent:m[1].length, done:m[2].toLowerCase()==='x',
      priority:pr, text:m[3], start:0, end:line.length });
  });
  return out;
}
function setTodoLine(md, key, patch){
  const { fm, body } = parseFrontmatter(md||'');
  const lines = body.split(/\r?\n/);
  const idx = Number(key);
  const m = lines[idx] && lines[idx].match(/^(\s*)- \[[ xX]\]\s+(.*)$/);
  if(!m) return md;
  const done = (patch && patch.done!=null) ? patch.done : (m[2].toLowerCase()==='x');
  lines[idx] = m[1]+'- ['+(done?'x':' ')+'] '+m[3];
  return stringifyFrontmatter(fm) + lines.join('\n');
}

/* ---------- 索引辅助 ---------- */
function extractTags(md){
  const { body } = parseFrontmatter(md||'');
  const set = new Set();
  const fm = parseFrontmatter(md).fm;
  if(fm && Array.isArray(fm.tags)) fm.tags.forEach(t=>set.add(t));
  (body.match(/#([\u4e00-\u9fa5\w-]+)/g)||[]).forEach(t=>set.add(t.slice(1)));
  return Array.from(set);
}
function extractSummary(md){
  const { body } = parseFrontmatter(md||'');
  const text = body
    .replace(/```[\s\S]*?```/g,' ')
    .replace(/^#{1,6}\s+/gm,'')
    .replace(/[*_`>#=-]/g,' ')
    .replace(/!\[\[[^\]]*\]\]/g,'[图]')
    .replace(/!\[[^\]]*\]\([^)]*\)/g,'[图]')
    .replace(/\s+/g,' ').trim();
  return text.slice(0,120);
}

window.MD = {
  parseFrontmatter, stringifyFrontmatter, toHTML,
  todoLines, setTodoLine, extractTags, extractSummary,
  extractAttachRefs(md){
    const { body } = parseFrontmatter(md||'');
    const refs = [];
    (body.match(/!\[\[([^\]]*)\]\]/g)||[]).forEach(s=>{ const a=s.slice(3,-2); refs.push({alt:a,link:a,embed:true}); });
    (body.match(/!\[([^\]]*)\]\(([^)\s]+)\)/g)||[]).forEach(s=>{
      const m=s.match(/!\[([^\]]*)\]\(([^)\s]+)\)/); refs.push({alt:m[1],link:m[2],embed:true}); });
    (body.match(/\[([^\]]+)\]\(([^)\s]+)\)/g)||[]).forEach(s=>{
      const m=s.match(/\[([^\]]+)\]\(([^)\s]+)\)/);
      if(m && !s.startsWith('!')) refs.push({alt:m[1],link:m[2],embed:false}); });
    return refs;
  }
};
})();
