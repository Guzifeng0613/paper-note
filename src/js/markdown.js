/* ============================================================
   markdown.js —— 纸片 v16 完整 Markdown 引擎（M3）
   全局名 MD。方法签名严格遵循 docs/VAULT-INTERFACE.md 第 3 节。
   方言 = Obsidian 兼容子集：
     标题 ##~######（# 不用于正文标题） / **粗** / *斜* / ==高亮== /
     <u>下划</u> / ~~删除~~ / `行内码` / ```代码块``` / >引用 /
     - 无序列表 / 1. 有序列表 / ---分割线（frontmatter 之外） /
     - [ ] / - [x] 待办（#p/high #p/low 优先级，缩进子任务） /
     图片 ![](path) 与 ![[path]] / 其他附件 [名](path) /
     双链 [[名]]（支持 [[名|显示]]） / 行内标签 #标签。
   浏览器经典脚本挂载 window.MD；node 下 module.exports=MD 便于单测。
   ============================================================ */
(function(){
'use strict';

/* ---------------- 工具 ---------------- */
function esc(s){
  return String(s==null?'':s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function escAttr(s){
  return esc(s).replace(/"/g,'&quot;');
}
function decodeEntities(s){
  return String(s==null?'':s)
    .replace(/&nbsp;/g,' ')
    .replace(/&quot;/g,'"')
    .replace(/&#39;/g,"'")
    .replace(/&lt;/g,'<')
    .replace(/&gt;/g,'>')
    .replace(/&amp;/g,'&');
}

/* ================= frontmatter =================
   parseFrontmatter(text) → {fm:Object|null, body:string}
   无 frontmatter 时 fm=null，body 原样返回。 */
function parseFrontmatter(text){
  if(!text) return { fm:null, body:'' };
  const m = text.match(/^---[ \t]*\r?\n([\s\S]*?)\r?\n?---[ \t]*\r?\n?/);
  if(!m) return { fm:null, body:text };
  const raw = m[1];
  const body = text.slice(m[0].length);
  const fm = {};
  raw.split(/\r?\n/).forEach(line=>{
    if(!line.trim()) return;
    const mm = line.match(/^\s*([A-Za-z_][\w.-]*)\s*:\s*(.*)$/);
    if(!mm) return;
    const key = mm[1];
    let val = mm[2].trim();
    if(val === ''){ fm[key] = ''; return; }
    if(val.startsWith('[') && val.endsWith(']')){
      val = val.slice(1,-1);
      fm[key] = val ? val.split(',').map(s=>unquote(s.trim())).filter(s=>s!=='') : [];
    } else {
      fm[key] = parseScalar(val);
    }
  });
  return { fm, body, _headerStr: m[0] };
}
function unquote(s){ return s.replace(/^["']|["']$/g,''); }
function parseScalar(val){
  const v = unquote(val);
  if(val.startsWith('"') || val.startsWith("'")) return v; // 显式引号一律按字符串
  if(v === 'true') return true;
  if(v === 'false') return false;
  if(v === 'null' || v === '~') return null;
  if(v !== '' && !isNaN(Number(v))) return Number(v);
  return v;
}

/* stringifyFrontmatter(fm) → YAML 头部（含首尾 ---）；空 fm 返回 '' */
const FM_ORDER = ['id','created','updated','color','pinned','tags','type'];
function stringifyFrontmatter(fm){
  const keys = Object.keys(fm||{});
  if(!keys.length) return '';
  const ordered = keys.slice().sort((a,b)=>{
    const ia = FM_ORDER.indexOf(a), ib = FM_ORDER.indexOf(b);
    return (ia<0?99:ia) - (ib<0?99:ib);
  });
  const lines = ordered.map(k=>{
    let v = fm[k];
    if(v == null) v = '';
    if(Array.isArray(v)){
      v = '[' + v.map(x=>yamlScalar(x)).join(', ') + ']';
    } else {
      v = yamlScalar(v);
    }
    return k + ': ' + v;
  });
  return '---\n' + lines.join('\n') + '\n---\n';
}
function yamlScalar(v){
  if(typeof v === 'boolean') return v ? 'true' : 'false';
  if(typeof v === 'number') return String(v);
  const s = String(v);
  // 含冒号/井号/以特殊符起头/留空含义的值需要引号
  if(s === '' || /[:#\[\]{}&*!|>'"%@`,]/.test(s) || /^(true|false|null|~)$/i.test(s) || /^\s|\s$/.test(s)){
    return '"' + s.replace(/"/g,'\\"') + '"';
  }
  return s;
}

/* ================= 行内渲染（MD→HTML） ================= */
function inline(t){
  const stash = [];
  const put = html => { stash.push(html); return '\u0001' + (stash.length-1) + '\u0002'; };

  // 1) 行内码 `x`（先抽，内部不再解析任何标记）
  t = t.replace(/`([^`]*)`/g, (m,c)=> put('<code class="md-code">'+esc(c)+'</code>'));
  // 2) 原始 HTML 下划线 <u>x</u>
  t = t.replace(/<u>([\s\S]*?)<\/u>/gi, (m,c)=> put('<u>'+esc(c)+'</u>'));
  // 3) Obsidian 内嵌图片 ![[path]]
  t = t.replace(/!\[\[([^\]]*)\]\]/g, (m,a)=>
    put('<img class="md-img" src="attachments/'+encodeURI(a)+'" alt="'+escAttr(a)+'">'));
  // 4) 标准图片 ![alt](url)
  t = t.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (m,a,url)=>
    put('<img class="md-img" src="'+escAttr(url)+'" alt="'+escAttr(a)+'">'));
  // 5) 链接 [文字](url)（文字允许嵌套行内标记，递归解析）
  t = t.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m,txt,url)=>
    put('<a class="md-link" href="'+escAttr(url)+'">'+inline(txt)+'</a>'));
  // 6) 双链 [[名]] / [[名|显示]]（可在设置中关闭；关闭时 [[ ]] 原样保留）
  if(typeof prefs==='undefined' || prefs.wikiSyntax){
    t = t.replace(/\[\[([^\]|]+)(?:\|([^\]]*))?\]\]/g, (m,name,disp)=>
      put('<span class="md-wiki" data-target="'+escAttr(name)+'">'+esc(disp||name)+'</span>'));
  }

  // 7) 其余文本转义
  t = esc(t);
  // 8) 高亮 ==x==（可在设置中关闭；关闭时 == == 原样保留）
  if(typeof prefs==='undefined' || prefs.hlSyntax){
    t = t.replace(/==([^=\s][^=]*)==/g, '<mark class="md-hl">$1</mark>');
  }
  // 9) 删除线 ~~x~~
  t = t.replace(/~~([\s\S]+?)~~/g, '<del>$1</del>');
  // 10) 加粗 **x**（先于斜体，避免吃掉星号）
  t = t.replace(/\*\*([\s\S]+?)\*\*/g, '<strong>$1</strong>');
  // 11) 斜体 *x*（紧贴非单词边界）
  t = t.replace(/(^|[^\w*])\*([^*\s][^*]*?)\*(?=[^\w*]|$)/g, '$1<em>$2</em>');
  // 12) 行内标签 #标签（跳过优先级 #p/high #p/low 与 URL 残留）
  t = t.replace(/(^|\s)#([\u4e00-\u9fa5A-Za-z][\u4e00-\u9fa5A-Za-z0-9_/-]*)/g, (m,pre,tag)=>{
    if(/^(p\/high|p\/low)$/.test(tag)) return m;
    return pre + '<span class="md-tag">#' + tag + '</span>';
  });

  // 13) 还原占位
  t = t.replace(/\u0001(\d+)\u0002/g, (m,i)=>stash[+i]);
  return t;
}

/* 待办行展示 HTML（剥离优先级标签后渲染文本） */
function todoRowHTML(indent, done, text){
  const pr = (text.match(/#p\/(high|low)/)||[])[1] || '';
  const clean = text.replace(/#p\/(high|low)/g,'').trim();
  return '<div class="md-todo'+(done?' done':'')+(pr?' p-'+pr:'')+'" data-done="'+(done?1:0)+'" style="margin-left:'+(indent*2)+'em">'
    +'<span class="md-todo-box">'+(done
        ?'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>'
        :'')+'</span>'
    +'<span class="md-todo-text">'+inline(clean)+'</span></div>';
}

/* ================= 块级：parse(md) → {fm, blocks} ================= */
function parse(md){
  const { fm, body } = parseFrontmatter(md||'');
  const lines = body.split(/\r?\n/);
  const blocks = [];
  let i = 0;
  while(i < lines.length){
    let line = lines[i];

    // 代码块 ```lang
    const fence = line.match(/^```([\w+-]*)\s*$/);
    if(fence){
      const code = []; i++;
      while(i < lines.length && !/^```\s*$/.test(lines[i])){ code.push(lines[i]); i++; }
      i++; // 跳过收尾 ```
      blocks.push({ type:'code', lang:fence[1]||'', text:code.join('\n') });
      continue;
    }
    // 分割线 ---（frontmatter 已剥离，此处一定是 hr）
    if(/^\s{0,3}---\s*$/.test(line)){ blocks.push({ type:'hr' }); i++; continue; }
    // 引用 >
    if(/^>\s?/.test(line)){
      const items = [];
      while(i < lines.length && /^>\s?/.test(lines[i])){ items.push(lines[i].replace(/^>\s?/,'')); i++; }
      blocks.push({ type:'quote', items });
      continue;
    }
    // 标题 ##~######
    const h = line.match(/^(#{2,6})\s+(.*)$/);
    if(h){ blocks.push({ type:'heading', level:h[1].length, text:h[2].trim() }); i++; continue; }
    // 待办 - [ ] / - [x]
    const td = line.match(/^(\s*)- \[([ xX])\]\s+(.*)$/);
    if(td){
      const priority = /#p\/high/.test(td[3]) ? 'high' : /#p\/low/.test(td[3]) ? 'low' : 'normal';
      blocks.push({ type:'todo', indent:td[1].length, done:td[2].toLowerCase()==='x', priority, text:td[3] });
      i++; continue;
    }
    // 无序列表（非待办的 - ）
    const ul = line.match(/^(\s*)-\s+(.*)$/);
    if(ul){
      const items = [{ indent:ul[1].length, text:ul[2] }]; i++;
      while(i < lines.length){
        const m2 = lines[i].match(/^(\s*)-\s+(.*)$/);
        if(!m2) break;
        items.push({ indent:m2[1].length, text:m2[2] }); i++;
      }
      blocks.push({ type:'ul', items });
      continue;
    }
    // 有序列表 1.
    const ol = line.match(/^(\s*)(\d+)\.\s+(.*)$/);
    if(ol){
      const items = [{ indent:ol[1].length, num:Number(ol[2]), text:ol[3] }]; i++;
      while(i < lines.length){
        const m2 = lines[i].match(/^(\s*)(\d+)\.\s+(.*)$/);
        if(!m2) break;
        items.push({ indent:m2[1].length, num:Number(m2[2]), text:m2[3] }); i++;
      }
      blocks.push({ type:'ol', items });
      continue;
    }
    // 空行
    if(!line.trim()){ i++; continue; }
    // 独立成行的附件/图片 → attach 块
    if(/^\s*!?\[\[?[^\]]*\]\(?[^)\s]*\)?\s*$/.test(line) && /(!?\[[^\]]*\]\(|<img|!\[\[)/.test(line)){
      blocks.push({ type:'attach', refs:extractAttachRefs(line) });
      i++; continue;
    }
    // 普通段落
    blocks.push({ type:'para', text:line });
    i++;
  }
  return { fm, blocks };
}

/* ================= MD → HTML ================= */
function toHTML(md){
  const { fm, body } = parseFrontmatter(md||'');
  const lines = body.split(/\r?\n/);
  let html = '';
  let i = 0;
  const flushList = (buf, ordered) => {
    if(!buf.length) return;
    html += (ordered?'<ol>':'<ul>') + buf.map(li=>'<li>'+li+'</li>').join('') + (ordered?'</ol>':'</ul>');
    buf.length = 0;
  };
  let ulBuf = [], olBuf = [];
  while(i < lines.length){
    const line = lines[i];
    const fence = line.match(/^```([\w+-]*)\s*$/);
    if(fence){
      flushList(ulBuf); flushList(olBuf,true);
      const code = []; i++;
      while(i < lines.length && !/^```\s*$/.test(lines[i])){ code.push(lines[i]); i++; }
      i++;
      html += '<pre class="md-pre"'+(fence[1]?' data-lang="'+escAttr(fence[1])+'"':'')+'><code>'+esc(code.join('\n'))+'</code></pre>';
      continue;
    }
    if(/^\s{0,3}---\s*$/.test(line)){ flushList(ulBuf); flushList(olBuf,true); html+='<hr class="md-hr">'; i++; continue; }
    if(/^>\s?/.test(line)){
      flushList(ulBuf); flushList(olBuf,true);
      const q = [];
      while(i < lines.length && /^>\s?/.test(lines[i])){ q.push(lines[i].replace(/^>\s?/,'')); i++; }
      html += '<blockquote class="md-quote">'+q.map(l=>'<p>'+inline(l)+'</p>').join('')+'</blockquote>';
      continue;
    }
    const h = line.match(/^(#{2,6})\s+(.*)$/);
    if(h){ flushList(ulBuf); flushList(olBuf,true);
      const lv = h[1].length; html += '<h'+lv+' class="md-h">'+inline(h[2])+'</h'+lv+'>'; i++; continue; }
    const td = line.match(/^(\s*)- \[([ xX])\]\s+(.*)$/);
    if(td){
      flushList(ulBuf); flushList(olBuf,true);
      html += todoRowHTML(td[1].length, td[2].toLowerCase()==='x', td[3]);
      i++; continue;
    }
    const ul = line.match(/^(\s*)-\s+(.*)$/);
    if(ul){ olBuf.length && flushList(olBuf,true); ulBuf.push(inline(ul[2])); i++; continue; }
    const ol = line.match(/^(\s*)\d+\.\s+(.*)$/);
    if(ol){ ulBuf.length && flushList(ulBuf); olBuf.push(inline(ol[2])); i++; continue; }
    if(!line.trim()){ flushList(ulBuf); flushList(olBuf,true); i++; continue; }
    flushList(ulBuf); flushList(olBuf,true);
    html += '<p class="md-p">'+inline(line)+'</p>';
    i++;
  }
  flushList(ulBuf); flushList(olBuf,true);
  return html || '<p class="md-p md-empty">（空笔记）</p>';
}

/* ================= 编辑器 HTML → MD =================
   覆盖富文本工具栏全元素：h1~h6 / p / strong|b / em|i / u /
   del|s|strike / mark / 行内码 / pre 代码块 / blockquote / ul|ol+li /
   li 内 checkbox（待办） / hr / img / a / span.md-wiki / <br> */
function htmlToMD(html){
  if(!html) return '';
  let s = String(html);
  s = s.replace(/<!--[\s\S]*?-->/g,'');
  s = s.replace(/<br\s*\/?>/gi,'\n');

  /* 受控待办的优先级徽章（编辑器渲染）→ #p/high|#p/low，保证序列化不丢 */
  s = s.replace(/<span class="md-prio-tag[^"]*" data-p="(high|low)"[^>]*>[\s\S]*?<\/span>/gi,
    (m,p)=>' #p/'+p);
  /* 受控待办的正文包裹层解开，使 ul/li/input 逻辑按普通待办行处理（含嵌套/勾选） */
  s = s.replace(/<span class="md-todo-text">([\s\S]*?)<\/span>/gi, '$1');

  /* styleWithCSS / execCommand 产出的样式 span → 标准行内标签 */
  const convStack = [];
  s = s.replace(/<span[^>]*style="([^"]*)"[^>]*>/gi, (m, style)=>{
    if(/font-weight\s*:\s*(bold|[6-9]00)/i.test(style)){ convStack.push('b'); return '<b>'; }
    if(/font-style\s*:\s*italic/i.test(style)){ convStack.push('i'); return '<i>'; }
    if(/text-decoration\s*:\s*underline/i.test(style)){ convStack.push('u'); return '<u>'; }
    if(/background(-color)?\s*:/i.test(style)){ convStack.push('mark'); return '<mark>'; }
    return m; // 字号等复杂内联样式：原样保留（见 span/font 分支）
  });
  /* 已转换 span 的闭合标签 → 对应标签闭合 */
  s = s.replace(/<\/span>/gi, ()=> convStack.length ? '</'+convStack.pop()+'>' : '</span>');

  let out = '';
  const stack = [];                 // 块级上下文栈：'ul'|'ol'|'quote'|'wiki'|'hl'
  const linkStack = [];            // {href, buf}
  let pendingLi = null;             // {type, indent, isTodo, checked}
  let preActive = false, preLang = '', preBuf = [];
  let rawInlineDepth = 0;          // 原样保留的内联 HTML（字号 span/font）深度

  /* 输出目标：若在链接内则写入链接缓冲，否则写入主输出 */
  const emit = txt => {
    if(!txt) return;
    if(linkStack.length){ linkStack[linkStack.length-1].buf += txt; return; }
    out += txt;
  };
  /* 单换行（引用块内换行后补 '> '） */
  const nl = () => emit(stack.includes('quote') ? '\n> ' : '\n');
  /* 块间标准空行：保证相邻块之间恰好一个空行 */
  const blk = () => {
    if(!out) return;
    if(out.endsWith('\n\n')) return;
    if(out.endsWith('\n')) nl();
    else { nl(); nl(); }
  };
  const pushText = txt => {
    if(!txt) return;
    if(preActive){ preBuf.push(decodeEntities(txt)); return; }
    let t = decodeEntities(txt);
    if(stack.includes('quote')) t = t.replace(/\n/g,'\n> ');
    // 列表项首次有内容时，补出 - / 1. / - [ ] 前缀
    if(pendingLi){
      const indent = '  '.repeat(pendingLi.indent);
      const sep = out.endsWith('\n') ? '' : '\n';
      emit(sep + indent +
        (pendingLi.isTodo
          ? '- ['+(pendingLi.checked?'x':' ')+'] '
          : (pendingLi.type==='ol' ? '1. ' : '- ')));
      pendingLi = null;
    }
    emit(t);
  };

  const tagRe = /<\/?([a-zA-Z][a-zA-Z0-9-]*)((?:[^<>]*?))\s*(\/?)>/g;
  let lastIdx = 0, m;
  while((m = tagRe.exec(s))){
    pushText(s.slice(lastIdx, m.index));
    lastIdx = tagRe.lastIndex;
    const isClose = m[0][1] === '/';
    const tag = m[1].toLowerCase();
    const attrs = m[2]||'';
    const getAttr = name => {
      const a = attrs.match(new RegExp(name+'\\s*=\\s*"([^"]*)"','i')) || attrs.match(new RegExp(name+"\\s*=\\s*'([^']*)'",'i'));
      return a ? a[1] : null;
    };

    if(preActive){
      if(tag === 'pre' && isClose){
        preActive = false;
        const inner = preBuf.join('').replace(/<\/?code[^>]*>/gi,'');
        // 语言：<pre class="language-x"> 或内部 <code class="language-x">
        if(!preLang){
          const lm = preBuf.join('').match(/language-([\w+-]+)/);
          if(lm) preLang = lm[1];
        }
        blk();
        out += '```'+preLang+'\n'+inner.replace(/\n+$/,'')+'\n```';
        nl();
      } else {
        preBuf.push(m[0]); // pre 内部标签原样保留
      }
      continue;
    }

    switch(tag){
      case 'p': case 'div':
        if(isClose) blk();
        break;
      case 'h1': case 'h2': case 'h3': case 'h4': case 'h5': case 'h6': {
        let lv = Number(tag[1]);
        lv = Math.max(2, Math.min(6, lv)); // 方言：# 不用于正文标题，h1→##
        if(!isClose){ blk(); emit('#'.repeat(lv)+' '); }
        else blk();
        break;
      }
      case 'ul': case 'ol':
        if(!isClose) stack.push(tag);
        else { const k=stack.lastIndexOf(tag); if(k>=0)stack.splice(k,1); blk(); }
        break;
      case 'li': {
        if(!isClose){
          const depth = stack.filter(x=>x==='ul'||x==='ol').length;
          const type = stack[stack.length-1]==='ol' ? 'ol' : 'ul';
          pendingLi = { type, indent: Math.max(0, depth-1), isTodo:false, checked:false };
        } else {
          if(pendingLi){ // 空 li
            const indent = '  '.repeat(pendingLi.indent);
            emit('\n' + indent +
              (pendingLi.isTodo ? '- ['+(pendingLi.checked?'x':' ')+'] '
                                : (pendingLi.type==='ol' ? '1. ' : '- ')));
            pendingLi = null;
          }
          nl();
        }
        break;
      }
      case 'input': {
        if(pendingLi && (getAttr('type')||'checkbox').toLowerCase() === 'checkbox'){
          pendingLi.isTodo = true;
          pendingLi.checked = /checked/i.test(attrs);
        }
        break;
      }
      case 'blockquote':
        if(!isClose){ blk(); stack.push('quote'); emit('\n> '); }
        else { const k=stack.lastIndexOf('quote'); if(k>=0)stack.splice(k,1); blk(); }
        break;
      case 'pre':
        if(!isClose){
          preActive = true; preBuf = [];
          preLang = getAttr('data-lang')||'';
          const lm = attrs.match(/language-([\w+-]+)/); if(lm) preLang = lm[1];
        }
        break;
      case 'code':
        emit(isClose ? '`' : '`'); break;
      case 'strong': case 'b':           emit('**'); break;
      case 'em': case 'i':               emit('*');  break;
      case 'u':                          emit(isClose ? '</u>' : '<u>'); break;
      case 'del': case 's': case 'strike': emit('~~'); break;
      case 'mark': case 'highlight':      emit('==');  break;
      case 'hr': blk(); emit('---'); nl(); break;
      case 'img': {
        const src = getAttr('src')||'', alt = getAttr('alt')||'';
        if(pendingLi){ pendingLi = null; } // 图片直接成项
        emit('!['+alt+']('+src+')');
        break;
      }
      case 'a':
        if(!isClose){ linkStack.push({ href:getAttr('href')||'', buf:'' }); }
        else {
          const lk = linkStack.pop();
          if(lk) emit('['+lk.buf+']('+lk.href+')');
        }
        break;
      case 'span':
        if(!isClose && /md-wiki/.test(attrs)){ stack.push('wiki'); emit('[['); }
        else if(isClose && stack[stack.length-1]==='wiki'){ stack.pop(); emit(']]'); }
        else if(!isClose && /background(-color)?:/.test(attrs)){ stack.push('hl'); emit('=='); }
        else if(isClose && stack[stack.length-1]==='hl'){ stack.pop(); emit('=='); }
        /* 其余 span（字号等复杂内联）：原样保留内联 HTML */
        else if(!isClose){ emit(m[0]); rawInlineDepth++; }
        else if(rawInlineDepth>0){ emit('</span>'); rawInlineDepth--; }
        break;
      case 'font':
        if(!isClose){ emit(m[0]); rawInlineDepth++; }
        else if(rawInlineDepth>0){ emit('</font>'); rawInlineDepth--; }
        break;
      default: break;
    }
  }
  pushText(s.slice(lastIdx));

  // 归一化：去掉空的引用行、压缩空行
  out = out
    .split('\n')
    .filter(l => l.trim() !== '>' && l.trim() !== '> ')
    .join('\n')
    .replace(/\n{3,}/g,'\n\n')
    .replace(/[ \t]+\n/g,'\n')
    .trim();
  return out ? out + '\n' : '';
}

/* ================= AST → MD ================= */
function serialize(blocks, fm){
  // 每个块渲染成一段文本，块间空行分隔
  const seg = [];
  (blocks||[]).forEach(b=>{
    let s2 = '';
    switch(b.type){
      case 'heading': s2 = '#'.repeat(b.level) + ' ' + b.text; break;
      case 'para': s2 = b.text; break;
      case 'ul':
        s2 = b.items.map(it=>'  '.repeat(it.indent||0)+'- '+it.text).join('\n');
        break;
      case 'ol':
        s2 = b.items.map(it=>'  '.repeat(it.indent||0)+(it.num||1)+'. '+it.text).join('\n');
        break;
      case 'todo':
        s2 = '  '.repeat(b.indent||0)+'- ['+(b.done?'x':' ')+'] '+b.text;
        break;
      case 'quote':
        s2 = b.items.map(l=>'> '+(l||'')).join('\n');
        break;
      case 'code':
        s2 = '```'+(b.lang||'')+'\n'+b.text+'\n```';
        break;
      case 'hr': s2 = '---'; break;
      case 'attach':
        s2 = (b.refs||[]).map(r=>r.embed
          ? (r.link.startsWith('attachments/') ? '!['+r.alt+']('+r.link+')' : '![['+r.link+']]')
          : '['+r.alt+']('+r.link+')').join('\n');
        break;
    }
    if(s2) seg.push(s2);
  });
  const body = seg.join('\n\n') + (seg.length ? '\n' : '');
  return (fm && Object.keys(fm).length ? stringifyFrontmatter(fm) : '') + body;
}

/* ================= 待办行抽取 / 回写 ================= */
function todoLines(md){
  md = md||'';
  const parsed = parseFrontmatter(md);
  const { body } = parsed;
  const bodyStart = md.length - body.length;
  const out = [];
  let offset = 0;
  body.split(/\r?\n/).forEach((line, idx)=>{
    const m = line.match(/^(\s*)- \[([ xX])\]\s*(.*)$/);
    if(m){
      const priority = /#p\/high/.test(m[3]) ? 'high' : /#p\/low/.test(m[3]) ? 'low' : 'normal';
      out.push({
        key: String(idx),
        indent: m[1].length,
        done: m[2].toLowerCase()==='x',
        priority,
        text: m[3],
        start: bodyStart + offset,
        end: bodyStart + offset + line.length
      });
    }
    offset += line.length + 1;
  });
  return out;
}
function setTodoLine(md, key, patch){
  md = md||'';
  const parsed = parseFrontmatter(md);
  const lines = parsed.body.split(/\r?\n/);
  const idx = Number(key);
  const m = lines[idx] && lines[idx].match(/^(\s*)- \[([ xX])\]\s*(.*)$/);
  if(!m) return md;
  const done = (patch && patch.done!=null) ? !!patch.done : (m[2].toLowerCase()==='x');
  lines[idx] = m[1]+'- ['+(done?'x':' ')+'] '+m[3];
  // 保留原头部（含原始格式），仅拼接新正文
  const headerStr = parsed._headerStr || '';
  return headerStr + lines.join('\n');
}

/* ================= 索引辅助 ================= */
function extractTags(md){
  const { fm, body } = parseFrontmatter(md||'');
  const set = new Set();
  if(fm && Array.isArray(fm.tags)) fm.tags.forEach(t=>set.add(t));
  (body.match(/(^|\s)#([\u4e00-\u9fa5A-Za-z][\u4e00-\u9fa5A-Za-z0-9_/-]*)/g)||[])
    .forEach(tok=>{
      const t = tok.trim();
      const tag = t.slice(1);
      if(/^(p\/high|p\/low)$/.test(tag)) return;   // 优先级不是标签
      set.add(tag);
    });
  return Array.from(set);
}
function extractSummary(md){
  const { body } = parseFrontmatter(md||'');
  const text = body
    .replace(/```[\s\S]*?```/g,' ')
    .replace(/!\[\[[^\]]*\]\]/g,'[图]')
    .replace(/!\[[^\]]*\]\([^)]*\)/g,'[图]')
    .replace(/\[[^\]]*\]\(([^)]*)\)/g,'$1')
    .replace(/\[\[([^\]|]*)(?:\|([^\]]*))?\]\]/g, (m,n,d)=> d||n)
    .replace(/^#{1,6}\s+/gm,'')
    .replace(/^>\s?/gm,'')
    .replace(/^- \[[ xX]\]\s?/gm,'')
    .replace(/#p\/(high|low)/g,'')
    .replace(/^[-*+]\s?/gm,'')
    .replace(/^\d+\.\s?/gm,'')
    .replace(/[*_`~=]/g,'')
    .replace(/\s+/g,' ')
    .trim();
  return text.slice(0,120);
}
function extractAttachRefs(md){
  const { body } = parseFrontmatter(md||'');
  const found = [];
  let lm;
  const reEmbed = /!\[\[([^\]]*)\]\]|!\[([^\]]*)\]\(([^)\s]+)\)/g;
  while((lm = reEmbed.exec(body))){
    if(lm[1] != null) found.push({ pos:lm.index, alt:lm[1], link:lm[1], embed:true });
    else found.push({ pos:lm.index, alt:lm[2], link:lm[3], embed:true });
  }
  const reLink = /\[([^\]]*)\]\(([^)\s]+)\)/g;
  while((lm = reLink.exec(body))){
    if(body[lm.index-1] === '!') continue;
    found.push({ pos:lm.index, alt:lm[1], link:lm[2], embed:false });
  }
  found.sort((a,b)=>a.pos-b.pos);
  return found.map(({pos, ...r})=>r);
}

/* ================= 导出 ================= */
const MD = {
  parseFrontmatter, stringifyFrontmatter,
  parse, toHTML, htmlToMD, serialize,
  todoLines, setTodoLine,
  extractTags, extractSummary, extractAttachRefs
};
if(typeof window!=='undefined') window.MD = MD;
if(typeof module!=='undefined' && module.exports) module.exports = MD;
})();
