/* ============================================================
   vault-ui.js —— 纸片 v16 新 UI（M1 高保真走查）
   全局 VUI。独立构建 #v16root，承载首页 / 文件树抽屉 / 编辑器 /
   源码模式 / 待办勾选 / 设置 / 搜索 / 回收站 / FAB / 底部 sheet /
   大图查看器 / 主题圆形扩散。数据来自 MockVault（M2 换 RealVault）。
   ============================================================ */
(function(){
'use strict';

/* ---------- 图标 ---------- */
const I = {
  menu:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18M3 12h18M3 18h18"/></svg>',
  back:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>',
  search:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>',
  more:'<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.9"/><circle cx="12" cy="12" r="1.9"/><circle cx="12" cy="19" r="1.9"/></svg>',
  home:'<svg class="home-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/></svg>',
  chev:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>',
  pin:'<svg class="pin" viewBox="0 0 24 24" fill="currentColor"><path d="M9 3h6l-1 7 3 3H7l3-3z"/><path d="M12 13v8"/></svg>',
  grid:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/></svg>',
  list:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/></svg>',
  plus:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  folder:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.7-.9L9.3 3.6A2 2 0 0 0 7.6 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2z"/></svg>',
  file:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3v4a1 1 0 0 0 1 1h4"/><path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z"/></svg>',
  close:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
  upDown:'<svg class="stw" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>',
  trash:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>',
  move:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5m0 0-6 6m6-6 6 6"/></svg>',
  theme:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 0 0 18z" fill="currentColor" stroke="none"/></svg>',
  sun:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
  moon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z"/></svg>',
  auto:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 0 0 18z" fill="currentColor" stroke="none"/></svg>',
  upload:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V4m0 0-4 4m4-4 4 4"/><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/></svg>',
  image:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="10" r="1.5"/><path d="m21 15-5-5-9 9"/></svg>',
  link:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/></svg>',
  code:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m8 6-6 6 6 6M16 6l6 6-6 6"/></svg>',
  quote:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 7h4v6a4 4 0 0 1-4 4H6v-2h1a2 2 0 0 0 2-2H7zm8 0h4v6a4 4 0 0 1-4 4h-1v-2h1a2 2 0 0 0 2-2h-2z"/></svg>',
  todo:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="m8 12 2.6 2.6L16 9"/></svg>',
  listbar:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M8 6h13M8 12h13M8 18h13"/></svg>',
  bold:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M7 5h6a3.5 3.5 0 0 1 0 7H7zm0 7h7a3.5 3.5 0 0 1 0 7H7z"/></svg>',
  italic:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M19 5h-9M14 19H5M15 5 9 19"/></svg>',
  underline:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M7 4v6a5 5 0 0 0 10 0V4M5 20h14"/></svg>',
  strike:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M5 12h14M7 6c0-1.5 2-2.5 5-2.5S17 4.5 17 6M7 18c0 1.5 2 2.5 5 2.5s5-1 5-2.5"/></svg>',
  hl:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 11-6 6v3h3l6-6"/><path d="m14 6 4 4-7 7-4-4z"/></svg>',
  head:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 4v16M18 4v16M6 10h8M14 4v16"/></svg>',
  export:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5M12 15V3"/></svg>',
  settings:'<svg class="stic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
  book:'<svg class="stic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V4H6.5A2.5 2.5 0 0 0 4 6.5z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/></svg>',
  edit:'<svg class="stic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
  export:'<svg class="stic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5M12 15V3"/></svg>',
  eye:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>',
  sparkle:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.6l1.9 5.1 5.1 1.9-5.1 1.9L12 16.6l-1.9-5.1L5 9.6l5.1-1.9z"/><path d="M18.6 15l.85 2.35L21.8 18.2l-2.35.85L18.6 21.4l-.85-2.35L15.4 18.2l2.35-.85z" opacity=".65"/></svg>',
  closeViewer:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>'
};

/* ---------- 状态 ---------- */
const S = {
  curFolder:'', viewMode:'grid',
  selecting:false, selected:new Set(),
  curNote:null, sourceMode:false,
  theme:'light', drawerOpen:false, fabOpen:false,
  treeOpen:new Set(['工作'])
};

let root = null;
const APP_VERSION = '16.0.14';
/* 数据层：真实 Markdown 资料库（VaultFS 三后端） */
const Vault = window.Vault;

/* ---------- 工具 ---------- */
const fmtDate = (ts)=>{ const d=new Date(ts); const p=n=>String(n).padStart(2,'0');
  return (d.getMonth()+1)+'月'+d.getDate()+'日'; };
/* v16 toast；第二参数可选 action {label,fn}，用于删除后撤销 */
function toast(msg, action){
  const t = root.querySelector('.v16-toast');
  t.innerHTML = '<span class="v16-toast-msg">'+esc(msg)+'</span>'
    +(action?'<button class="v16-toast-act" id="v16ToastAct">'+esc(action.label)+'</button>':'');
  t.classList.add('show');
  if(action){
    const btn=t.querySelector('#v16ToastAct');
    btn.onclick=()=>{ clearTimeout(t._h); t.classList.remove('show'); try{action.fn();}catch(e){} };
  }
  clearTimeout(t._h); t._h = setTimeout(()=>t.classList.remove('show'), action?4500:1800);
}
/* 让大 IIFE 内所有 legacy 代码（ai.js/main.js 等）的 toast 统一走 v16 浮层 */
window.__v16Toast = toast;

/* ---------- 删除前先播放飞行删除动画（v16-anim 监听并回调 done；含降级） ----------
   增强层在飞至回收站 + 收拢动画后回调；若增强层未加载，超时兜底直接执行。 */
function beforeDelete(paths, doThen){
  let settled=false;
  const done=async()=>{ if(settled)return; settled=true; clearTimeout(fb); try{ await doThen(); }catch(e){} };
  const fb=setTimeout(()=>done(), 1300);
  try{
    window.dispatchEvent(new CustomEvent('v16:before-delete',{detail:{paths,done}}));
  }catch(e){ done(); }
}

/* ---------- 应用内确认/输入弹窗（替代 confirm()/prompt()）。
   本 App WebView 未设 WebChromeClient，原生 confirm/prompt 在真机上不弹出对话框
   （confirm 恒 false、prompt 恒 null），故所有这类交互一律走应用内弹窗。 ---------- */
function appConfirm(o){
  o = o||{};
  return new Promise(resolve=>{
    const finish=v=>{ closeModal(); resolve(v); };
    const hasCancel = o.cancelText !== null;
    openModal('<h3>'+esc(o.title||'请确认')+'</h3>'+(o.desc?'<p>'+esc(o.desc)+'</p>':'')
      +'<div class="modal-actions'+(hasCancel?'':' one')+'">'
      +(hasCancel?'<button class="btn-ghost" id="appCancel">'+esc(o.cancelText||'取消')+'</button>':'')
      +'<button class="'+(o.danger===false?'btn-primary':'btn-danger')+'" id="appOk">'+esc(o.okText||'确定')+'</button>'
      +'</div>');
    const ok=$('#appOk'), cancel=$('#appCancel');
    ok.onclick=()=>finish(true); if(cancel) cancel.onclick=()=>finish(false);
  });
}
function appPrompt(o){
  o = o||{};
  return new Promise(resolve=>{
    const finish=v=>{ closeModal(); resolve(v); };
    openModal('<h3>'+esc(o.title||'请输入')+'</h3>'
      +'<input class="modal-input" id="appInput" type="text" value="'+esc(o.initial||'')+'" placeholder="'+esc(o.placeholder||'')+'">'
      +'<div class="modal-actions">'
      +'<button class="btn-ghost" id="appCancel">'+esc(o.cancelText||'取消')+'</button>'
      +'<button class="btn-primary" id="appOk">'+esc(o.okText||'确定')+'</button>'
      +'</div>');
    const inp=$('#appInput');
    inp.focus(); inp.select();
    inp.onkeydown=e=>{ if(e.key==='Enter'||e.keyCode===13){ finish(inp.value); } };
    $('#appCancel').onclick=()=>finish(null);
    $('#appOk').onclick=()=>finish(inp.value);
  });
}

/* 空笔记占位段落：开始插入任何内容前，先把它还原成干净空段落，
   避免链接/文字插进带"（空笔记）"的占位段、或占位文字被当成正文保存。 */
function clearEmptyPlaceholder(){
  const ed = document.getElementById('v16EdBody');
  if(!ed) return;
  ed.querySelectorAll('.md-empty').forEach(p=>{
    p.classList.remove('md-empty');
    if(!p.querySelector('img,a,input,ul,ol,blockquote,pre')) p.innerHTML='<br>';
  });
  /* 兜底：只含占位文字"（空笔记）"的段落（md-empty 类可能已被移除） */
  ed.querySelectorAll('p').forEach(p=>{
    if(p.textContent.trim()==='（空笔记）' && !p.querySelector('img,a,input,ul,ol,blockquote,pre')) p.innerHTML='<br>';
  });
}

/* ---------- 选区保存/恢复（弹窗会移动焦点，execCommand 需恢复选区） ---------- */
function saveSelection(){
  const sel = window.getSelection();
  if(!sel || sel.rangeCount===0) return null;
  const r = sel.getRangeAt(0);
  return { startContainer:r.startContainer, startOffset:r.startOffset,
           endContainer:r.endContainer, endOffset:r.endOffset };
}
function restoreSelection(s){
  if(!s) return false;
  const sel = window.getSelection();
  const r = document.createRange();
  try{
    r.setStart(s.startContainer, s.startOffset);
    r.setEnd(s.endContainer, s.endOffset);
    sel.removeAllRanges(); sel.addRange(r);
    return true;
  }catch(e){ return false; }
}

/* ---------- 骨架 ---------- */
function buildRoot(){
  root = document.createElement('div');
  root.id = 'v16root';
  /* 关键布局内联兜底（样式表里该规则偶发未进 cssOM，内联保证生效） */
  root.style.cssText = 'position:fixed;left:0;right:0;top:0;bottom:0;width:100%;height:100%;z-index:60;display:flex;flex-direction:column;overflow:hidden;background:#ECEAE2;font-family:var(--font-base);';
  root.innerHTML = `
    <section class="v16-scr v16-home on" data-scr="home">
      <header class="v16-topbar">
        <button class="v16-ic" id="v16Menu" aria-label="菜单">${I.menu}</button>
        <div class="v16-crumbs" id="v16Crumbs"></div>
        <button class="v16-ic v16-ai-entry" id="v16HomeAi" aria-label="AI 对话">${I.sparkle}</button>
        <button class="v16-ic" id="v16SearchBtn" aria-label="搜索">${I.search}</button>
        <button class="v16-ic" id="v16More" aria-label="更多">${I.more}</button>
      </header>
      <div class="v16-viewbar">
        <span class="v16-vb-label" id="v16Count"></span>
        <div class="v16-seg" id="v16ViewSeg">
          <button data-v="grid" class="on" aria-label="网格">${I.grid}</button>
          <button data-v="list" aria-label="列表">${I.list}</button>
        </div>
      </div>
      <div class="v16-body" id="v16Body"></div>
      <div class="v16-selbar" id="v16Selbar">
        <button data-a="move">${I.move}<span>移动</span></button>
        <button data-a="pin">${I.pin}<span>置顶</span></button>
        <button data-a="color">${I.hl}<span>颜色</span></button>
        <button data-a="del">${I.trash}<span>删除</span></button>
      </div>
      <button class="v16-fab" id="v16Fab" aria-label="新建">${I.plus}</button>
      <div class="v16-fab-menu" id="v16FabMenu">
        <div class="v16-fab-item" data-f="note">${I.file}新建笔记</div>
        <div class="v16-fab-item" data-f="folder">${I.folder}新建文件夹</div>
        <div class="v16-fab-item" data-f="import">${I.upload}导入文件</div>
      </div>
    </section>

    <section class="v16-scr v16-editor" data-scr="editor">
      <header class="v16-topbar">
        <button class="v16-ic" id="v16EdBack" aria-label="返回">${I.back}</button>
        <div class="v16-crumbs" id="v16EdCrumb"></div>
        <button class="v16-ic v16-ai-entry" id="v16EdAi" aria-label="本页问答">${I.sparkle}</button>
        <button class="v16-ic" id="v16EdSource" aria-label="源码模式">${I.code}</button>
        <button class="v16-ic" id="v16EdMore" aria-label="更多">${I.more}</button>
      </header>
      <div class="v16-ed-scroll" id="v16EdScroll"></div>
      <div class="v16-dock" id="v16Dock">
        <button data-t="head">${I.head}</button>
        <button data-t="bold">${I.bold}</button>
        <button data-t="italic">${I.italic}</button>
        <button data-t="hl">${I.hl}</button>
        <button data-t="underline">${I.underline}</button>
        <button data-t="strike">${I.strike}</button>
        <button data-t="list">${I.listbar}</button>
        <button data-t="todo">${I.todo}</button>
        <button data-t="quote">${I.quote}</button>
        <button data-t="code">${I.code}</button>
        <button data-t="link">${I.link}</button>
        <button data-t="image">${I.image}</button>
      </div>
    </section>

    <section class="v16-scr v16-settings" data-scr="settings">
      <header class="v16-topbar">
        <button class="v16-ic" id="v16SetBack" aria-label="返回">${I.back}</button>
        <div class="v16-crumbs"><span class="cr cur">设置</span></div>
        <span style="width:38px"></span><span style="width:38px"></span>
      </header>
      <div class="v16-settings-scroll" id="v16SettingsBody"></div>
    </section>

    <section class="v16-scr v16-search" data-scr="search">
      <header class="v16-topbar">
        <button class="v16-ic" id="v16SrBack" aria-label="返回">${I.back}</button>
        <div class="v16-crumbs"><span class="cr cur">搜索</span></div>
        <span style="width:38px"></span><span style="width:38px"></span>
      </header>
      <div class="v16-search-field">${I.search}<input id="v16SrInput" placeholder="搜索标题、正文、标签" autocomplete="off"></div>
      <div class="v16-search-scroll" id="v16SrBody"></div>
    </section>

    <section class="v16-scr v16-trash" data-scr="trash">
      <header class="v16-topbar">
        <button class="v16-ic" id="v16TrashBack" aria-label="返回">${I.back}</button>
        <div class="v16-crumbs"><span class="cr cur">回收站</span></div>
        <button class="v16-ic" id="v16TrashEmpty" aria-label="清空">${I.trash}</button>
      </header>
      <div class="v16-trash-scroll" id="v16TrashBody"></div>
    </section>

    <div class="v16-drawer-mask" id="v16DrawerMask"></div>
    <aside class="v16-drawer" id="v16Drawer">
      <div class="v16-dr-head">
        <span class="dt">资料库</span>
        <button class="v16-ic" id="v16DrawerClose">${I.close}</button>
      </div>
      <div class="v16-dr-scroll" id="v16Tree"></div>
      <div class="v16-dr-foot"><button id="v16DrawerNew">${I.plus} 新建文件夹</button></div>
    </aside>

    <div class="v16-sheet-mask" id="v16SheetMask"></div>
    <div class="v16-sheet" id="v16Sheet">
      <div class="v16-sheet-grip"></div>
      <div class="v16-sheet-title" id="v16SheetTitle"></div>
      <div id="v16SheetOpts"></div>
      <div class="v16-sheet-cancel" id="v16SheetCancel">取消</div>
    </div>

    <div class="v16-toast"></div>
    <div class="v16-imgviewer" id="v16ImgViewer">
      <button class="close" id="v16ImgClose">${I.closeViewer}</button>
      <img id="v16Img" alt="">
    </div>
  `;
  document.body.appendChild(root);
}

/* ---------- 路由 ---------- */
function show(name){
  $$('#v16root .v16-scr').forEach(s=>{
    s.classList.toggle('on', s.dataset.scr===name);
    s.classList.toggle('behind', s.dataset.scr==='home' && name!=='home');
  });
}

/* ---------- 面包屑 ---------- */
function renderCrumbs(){
  const c = Vault.crumbs(S.curFolder);
  $('#v16Crumbs').innerHTML =
    c.map((seg,i)=>`<span class="cr ${i===c.length-1?'cur':''}" data-path="${esc(seg.path)}">${i===0?I.home:esc(seg.name)}</span>${i<c.length-1?'<span class="sep">/</span>':''}`).join('');
  $('#v16Crumbs').querySelectorAll('.cr').forEach(el=>{
    el.onclick = ()=>{ S.curFolder = el.dataset.path; renderHome(); };
  });
}

/* ---------- 首页 ---------- */
async function renderHome(){
  renderCrumbs();
  const { folders, notes } = await Vault.entries(S.curFolder);
  $('#v16Count').textContent = (S.curFolder? Vault.crumbs(S.curFolder).slice(-1)[0].name : '资料库') + ' · ' + notes.length + ' 篇';
  const body = $('#v16Body');
  const home = root.querySelector('.v16-home');
  home.classList.toggle('selecting', S.selecting);

  let html = '';
  if(folders.length){
    html += '<div class="v16-folders">' + folders.map(f=>`
      <div class="v16-folder-card" data-folder="${esc(f.path)}">
        <span class="fic">${I.folder}</span>
        <span><span class="fname">${esc(f.title)}</span><div class="fcnt">${f.count} 篇</div></span>
      </div>`).join('') + '</div>';
  }
  if(!notes.length && !folders.length){
    html = `<div class="v16-empty">${I.folder}<p>空目录<br>点击右下 + 新建第一篇笔记</p></div>`;
  } else if(notes.length){
    html += `<div class="${S.viewMode==='grid'?'v16-grid':'v16-list'}">` + notes.map(n=>`
      <div class="v16-note-card c-${n.color||'cream'}" data-path="${esc(n.path)}">
        ${n.pinned?I.pin:''}
        <div class="nt">${n.pinned?I.pin:''}${esc(n.title)}</div>
        <div class="ns">${esc(n.summary)}</div>
        <div class="nfoot">
          ${(n.tags||[]).slice(0,2).map(t=>`<span class="ntag">#${esc(t)}</span>`).join('')}
          <span class="dot">${fmtDate(n.updated)}</span>
        </div>
        <span class="selmark"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></span>
      </div>`).join('') + '</div>';
  }
  body.innerHTML = html;

  /* 文件夹点击 */
  body.querySelectorAll('.v16-folder-card').forEach(card=>{
    const fpath = card.dataset.folder;
    card.onclick = ()=>{ S.curFolder = fpath; renderHome(); };
    bindLongPress(card, ()=>{ openSheet('文件夹操作（'+fpath+'）', [
      {icon:I.move, label:'重命名', fn:async()=>{
        const curName = fpath.split('/').pop();
        const nn = await appPrompt({title:'重命名文件夹', initial:curName, okText:'重命名'});
        if(nn && nn.trim() && nn.trim()!==curName){
          const newPath = fpath.split('/').slice(0,-1).concat(nn.trim()).join('/');
          Vault.renameFolder(fpath, newPath).then(()=>{ toast('已重命名'); renderHome(); }).catch(e=>toast('重命名失败'));
        }
      }},
      {icon:I.trash, label:'删除', fn:async()=>{
        const ok = await appConfirm({title:'删除文件夹「'+fpath+'」？', desc:'文件夹内的笔记将移入回收站，可在回收站恢复。', okText:'删除文件夹'});
        if(ok){ Vault.removeFolder(fpath).then(()=>{ toast('已删除'); renderHome(); }).catch(e=>toast('删除失败')); }
      }}
    ]); });
  });
  /* 笔记卡片 */
  body.querySelectorAll('.v16-note-card').forEach(card=>{
    const path = card.dataset.path;
    card.onclick = ()=>{ if(S.selecting){ toggleSelect(path); } else openNote(path); };
    bindLongPress(card, ()=>{ if(!S.selecting){ S.selecting=true; S.selected=new Set(); } toggleSelect(path); });
  });
  const selbar = $('#v16Selbar');
  selbar.classList.toggle('open', S.selecting);
}
function toggleSelect(path){
  if(S.selected.has(path)) S.selected.delete(path); else S.selected.add(path);
  root.querySelector(`.v16-note-card[data-path="${cssesc(path)}"]`).classList.toggle('sel', S.selected.has(path));
  if(!S.selected.size){ S.selecting=false; }
  renderCrumbs(); // keep
  const home = root.querySelector('.v16-home');
  home.classList.toggle('selecting', S.selecting);
  /* 长按进入多选时 renderHome 未重跑，这里显式同步 selbar 的 open 态 */
  $('#v16Selbar').classList.toggle('open', S.selecting);
}
function cssesc(s){ return s.replace(/"/g,'\\"'); }

/* 长按：用 pointer 事件统一鼠标/触摸。旧版 touchmove 一有微小抖动就清计时器，
   真机上手指几乎总会轻微移动，导致长按失效。改为移动超过阈值(10px)才取消。 */
function bindLongPress(el, fn){
  let t=null, pid=null, sx=0, sy=0, fired=false;
  el.addEventListener('pointerdown', (e)=>{
    if(e.pointerType==='mouse' && e.button!==0) return;
    pid=e.pointerId; sx=e.clientX; sy=e.clientY; fired=false;
    clearTimeout(t);
    t=setTimeout(()=>{
      fired=true; t=null; fn();
      /* 长按触发后，同一次按压抬手会产生一个 click，必须吞掉，
         否则卡片 onclick 会把刚选中的项又切换掉（多选被立即取消） */
      const suppress=(ev)=>{
        if(ev.target===el || el.contains(ev.target)){ ev.stopPropagation(); ev.preventDefault(); }
        window.removeEventListener('click', suppress, true);
      };
      window.addEventListener('click', suppress, true);
    }, 480);
  });
  el.addEventListener('pointermove', (e)=>{
    if(e.pointerId!==pid || fired) return;
    if(Math.hypot(e.clientX-sx, e.clientY-sy) > 10){ clearTimeout(t); }
  });
  const cancel=(e)=>{ if(e && e.pointerId!==pid && e.pointerId!==undefined) return; clearTimeout(t); };
  el.addEventListener('pointerup', cancel);
  el.addEventListener('pointercancel', cancel);
  el.addEventListener('pointerleave', cancel);
}

/* ---------- 文件树抽屉 ---------- */
function buildTree(node, depth){
  let html = `<div class="v16-tree-node">`;
  const open = (node.path==='') || S.treeOpen.has(node.path);  /* 根节点默认展开 */
  html += `<div class="v16-tree-row ${open?'openfolder':''} ${S.curFolder===node.path?'on':''}" data-path="${esc(node.path)}">
    ${node.children.length?`<span class="tw">${I.chev}</span>`:'<span class="tw"></span>'}
    <span class="ticon">${I.folder}</span>
    <span class="tname">${esc(node.name)}</span>
    <span class="tcnt">${node.count}</span></div>`;
  if(node.children.length){
    html += `<div class="v16-children ${open?'open':''}">`;
    html += node.children.map(ch=>buildTree(ch, depth+1)).join('');
    html += `</div>`;
  }
  html += `</div>`;
  return html;
}
function renderDrawer(){
  const tree = Vault.tree();
  $('#v16Tree').innerHTML = buildTree(tree, 0);
  $('#v16Tree').querySelectorAll('.v16-tree-row').forEach(row=>{
    row.onclick = (e)=>{
      const p = row.dataset.path;
      const tw = row.querySelector('.tw');
      /* 点箭头（且有子节点）：仅展开/折叠，保持抽屉 */
      if(tw && tw.querySelector('svg') && e.target.closest('.tw')){
        if(S.treeOpen.has(p)) S.treeOpen.delete(p); else S.treeOpen.add(p);
        renderDrawer();
        return;
      }
      /* 点行体：进入该目录并关抽屉 */
      S.curFolder = p; renderHome(); closeDrawer();
    };
  });
}
function openDrawer(){ $('#v16Drawer').classList.add('open'); $('#v16DrawerMask').classList.add('open'); renderDrawer(); }
function closeDrawer(){ $('#v16Drawer').classList.remove('open'); $('#v16DrawerMask').classList.remove('open'); }

/* ---------- WYSIWYG 辅助 ---------- */
/* MD.toHTML 输出 → 可编辑 HTML：把 <div class="md-todo"> 转成 <ul><li><input checkbox>文本</li></ul>，
   htmlToMD 序列化时自动转回 "- [ ]"/"- [x]" 行 */
function mdToEditableHTML(md){
  const html = MD.toHTML(md||'');
  const div = document.createElement('div');
  div.innerHTML = html;
  const todoDivs = Array.from(div.querySelectorAll('.md-todo'));
  if(todoDivs.length){
    const rows = MD.todoLines(md);
    const ul = buildTodoUL(rows, todoDivs);
    todoDivs[0].parentNode.insertBefore(ul, todoDivs[0]);
    todoDivs.forEach(t=>t.remove());
  }
  return div.innerHTML;
}
/* 受控待办：按 MD.todoLines 构建嵌套 ul；checkbox 带 data-key 与 checked 属性，
   勾选只经 change 委托调 Vault.toggleTodo（不依赖自由序列化）；优先级以徽章渲染，
   序列化时由 MD.htmlToMD 还原为 #p/high|#p/low。保证勾选态与优先级永不丢失。 */
function buildTodoUL(rows, todoDivs){
  const rootUl = document.createElement('ul');
  rootUl.className = 'v16-ed-todoul';
  const ulStack = [rootUl];
  let curIndent = 0;
  rows.forEach((r,i)=>{
    const t = r.indent;
    if(t > curIndent){
      for(let k=curIndent;k<t;k++){
        const sub = document.createElement('ul');
        sub.className = 'v16-ed-todoul';
        const lastLi = ulStack[ulStack.length-1].lastElementChild;
        if(lastLi) lastLi.appendChild(sub);
        ulStack.push(sub);
      }
    } else if(t < curIndent){
      for(let k=curIndent;k>t;k--) ulStack.pop();
    }
    curIndent = t;
    const ul = ulStack[ulStack.length-1];
    const li = document.createElement('li');
    li.className = 'v16-todo-li';
    const cb = document.createElement('input');
    cb.type='checkbox'; cb.className='v16-ed-todoinput'; cb.dataset.key=r.key;
    if(r.done) cb.setAttribute('checked','checked');
    li.appendChild(cb);
    const span = document.createElement('span');
    span.className='md-todo-text';
    const td = todoDivs[i];
    span.innerHTML = td ? td.querySelector('.md-todo-text').innerHTML : (r.text||'');
    li.appendChild(span);
    if(r.priority==='high'||r.priority==='low'){
      const pg = document.createElement('span');
      pg.className='md-prio-tag p-'+r.priority; pg.dataset.p=r.priority;
      pg.textContent = r.priority==='high'?'高':'低';
      li.appendChild(pg);
    }
    ul.appendChild(li);
  });
  return rootUl;
}
/* 插入一条新待办：先落盘当前正文，再在 MD 末尾追加 - [ ] 行并受控重渲染。
   相比直接插裸 checkbox，能正确处理空占位、取得 data-key，新行立即可勾选。 */
async function insertTodoLine(){
  const path = S._cur.entry.path;
  await flushWYSIWYG();
  S._cur = await Vault.get(path);
  const parsed = MD.parseFrontmatter(S._cur.md);
  let body = (parsed.body||'').replace(/（空笔记）/g,'').replace(/[ \t]*\n+[ \t]*$/,'');
  /* 块级元素之间需空行（与 htmlToMD 序列化结果一致），否则新待办的行号 key
     会与自动保存重序列化后的行号错位，导致勾选失效 */
  body = body ? body + '\n\n- [ ] ' : '- [ ] ';
  const fm = parsed.fm || {};
  if(!fm.type) fm.type='todo';
  const newMd = MD.stringifyFrontmatter(fm) + body;
  await Vault.save(path, newMd);
  S._cur = await Vault.get(path);
  const ed = document.getElementById('v16EdBody');
  if(ed) ed.innerHTML = mdToEditableHTML(S._cur.md);
  const cbs = Array.from(document.querySelectorAll('#v16EdBody .v16-ed-todoinput'));
  const last = cbs[cbs.length-1];
  if(last){
    const span = last.closest('li') && last.closest('li').querySelector('.md-todo-text');
    if(span) span.focus();
  }
}
/* 序列化当前 contenteditable → md 字符串（保留 frontmatter） */
function serializeWYSIWIG(){
  const ed = document.getElementById('v16EdBody');
  if(!ed || !S._cur) return null;
  /* 把临时 objectURL/显示 href 替换为相对路径，便于 htmlToMD 序列化（图片 + 附件链接） */
  const restore = [];
  ed.querySelectorAll('img').forEach(im=>{
    const rel = im.dataset.relpath;
    if(rel){ restore.push([im,'src',im.src]); im.src = rel; }
  });
  ed.querySelectorAll('a[data-relpath]').forEach(a=>{
    const rel = a.dataset.relpath;
    if(rel){ restore.push([a,'href',a.getAttribute('href')]); a.setAttribute('href', rel); }
  });
  const bodyMD = MD.htmlToMD(ed.innerHTML);
  restore.forEach(([el,attr,val])=> el.setAttribute(attr, val));
  const parsed = MD.parseFrontmatter(S._cur.md);
  const fm = parsed.fm || {};
  if(!fm.type) fm.type = e_type(S._cur);
  const clean = {};
  Object.keys(fm).forEach(k=>{ if(fm[k]!=null && fm[k]!=='') clean[k]=fm[k]; });
  return MD.stringifyFrontmatter(clean) + bodyMD;
}
/* 选图 → VaultFS.writeAttachment 落盘 → 插入 contenteditable */
async function pickWYSIWYGImage(){
  /* 原生：拍照 */
  if(typeof Native!=='undefined' && Native && Native.call){
    try{
      const relPath = await Native.call('vaultTakePhoto', {notePath: S._cur.entry.path});
      if(relPath){
        const ed = $('#v16EdBody'); ed.focus();
        document.execCommand('insertHTML', false,
          '<img src="'+relPath+'" data-relpath="'+relPath+'" style="max-width:100%;border-radius:12px;margin:8px 0;display:block">');
        scheduleWYSIWIGSave();
        toast('照片已插入');
        return;
      }
    }catch(e){ console.warn('takePhoto fallback', e); }
  }
  /* 浏览器降级：file input */
  const inp = document.createElement('input');
  inp.type='file'; inp.accept='image/*';
  inp.style.display='none'; document.body.appendChild(inp);
  inp.onchange = async ()=>{
    inp.remove();
    const file = inp.files && inp.files[0]; if(!file) return;
    try{
      const relPath = await VaultFS.writeAttachment(file.name, file, S._cur.entry.path);
      const url = URL.createObjectURL(file);
      const ed = $('#v16EdBody'); ed.focus();
      document.execCommand('insertHTML', false,
        '<img src="'+url+'" data-relpath="'+relPath+'" style="max-width:100%;border-radius:12px;margin:8px 0;display:block">');
      scheduleWYSIWIGSave();
      toast('图片已插入');
    }catch(e){ console.warn(e); toast('图片插入失败'); }
  };
  inp.click();
}
/* 选非图片文件（Word/Excel/PDF…）→ attachments 落盘 → 正文插入 MD 链接。
   原生：vaultPickImport（系统选择器，返回 rel 路径）；浏览器：file input。 */
async function pickWYSIWYGFile(){
  if(typeof Native!=='undefined' && Native && Native.call){
    try{
      const relPath = await Native.call('vaultPickImport', {notePath: S._cur.entry.path});
      if(relPath){
        const fname = relPath.split('/').pop();
        const ed = $('#v16EdBody'); ed.focus();
        document.execCommand('insertHTML', false,
          '<p><a class="md-link" href="'+relPath+'" data-relpath="'+relPath+'">'+fname+'</a></p>');
        scheduleWYSIWIGSave();
        toast('文件已添加');
        return;
      }
    }catch(e){ console.warn('pickImport fallback', e); }
  }
  const inp = document.createElement('input');
  inp.type='file';
  inp.style.display='none'; document.body.appendChild(inp);
  inp.onchange = async ()=>{
    inp.remove();
    const file = inp.files && inp.files[0]; if(!file) return;
    try{
      const relPath = await VaultFS.writeAttachment(file.name, file, S._cur.entry.path);
      const ed = $('#v16EdBody'); ed.focus();
      document.execCommand('insertHTML', false,
        '<p><a class="md-link" href="'+relPath+'" data-relpath="'+relPath+'">'+file.name+'</a></p>');
      scheduleWYSIWIGSave();
      toast('文件已添加');
    }catch(e){ console.warn(e); toast('文件添加失败'); }
  };
  inp.click();
}
function e_type(data){
  const ed = document.getElementById('v16EdBody');
  if(ed && ed.querySelector('input[type="checkbox"]')) return 'todo';
  return (data.entry && data.entry.type) || 'note';
}

/* ================= 导出：长截图 PNG / PDF（v16 专用，基于当前 vault 笔记） ================= */
function v16ExportName(){
  const t = S._cur ? S._cur.entry.title : '便签';
  return (t||'便签').replace(/[\\/:*?"<>|]/g,'_').slice(0,30)||'便签';
}
/* 从当前 vault 笔记构建离屏导出节点（浏览器 html2canvas 路径） */
async function buildV16ExportNode(){
  const cur = S._cur;
  const node=document.createElement('div');
  node.style.cssText='position:fixed;left:-10000px;top:0;width:700px;background:#fff;'
    +'padding:46px 44px;font-family:"Noto Sans SC",sans-serif;color:#1d201c;box-sizing:border-box';
  let inner='<div style="font-size:32px;font-weight:900;line-height:1.3;margin-bottom:18px;color:#161815">'
    +esc(cur.entry.title||'无标题')+'</div>';
  if(cur.entry.type==='todo'){
    const rows=MD.todoLines(cur.md);
    inner+='<div style="margin-top:6px">'+rows.filter(t=>t.text.trim()).map(t=>
      '<div style="display:flex;align-items:center;gap:12px;padding:9px 0;font-size:16.5px">'
      +'<span style="width:22px;height:22px;border-radius:50%;border:2px '
      +(t.done?'solid #2f6b4f;background:#2f6b4f':'solid #b9bdb4')+';flex-shrink:0"></span>'
      +'<span style="'+(t.done?'text-decoration:line-through;color:#a9ada5':'')+'">'+esc(t.text)+'</span></div>').join('')+'</div>';
  } else {
    inner+='<div style="font-size:17px;line-height:1.85;word-break:break-word">'+(cur.html||'')+'</div>';
  }
  node.innerHTML=inner;
  document.body.appendChild(node);
  const imgs=Array.from(node.querySelectorAll('img'));
  await Promise.all(imgs.map(im=>im.complete?null:new Promise(r=>{im.onload=r;im.onerror=r;})));
  return node;
}
function v16PdfFromCanvas(cv, name){
  const {jsPDF}=window.jspdf;
  const pdf=new jsPDF('p','mm','a4');
  const pw=210,pxPerMm=cv.width/pw,pageHpx=Math.floor(297*pxPerMm);
  let y=0;
  while(y<cv.height){
    const h=Math.min(pageHpx,cv.height-y);
    const c=document.createElement('canvas');
    c.width=cv.width;c.height=h;
    const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);
    x.drawImage(cv,0,y,cv.width,h,0,0,cv.width,h);
    if(y>0)pdf.addPage();
    pdf.addImage(c.toDataURL('image/jpeg',0.92),'JPEG',0,0,pw,h/pxPerMm);
    y+=h;
  }
  pdf.save(name+'.pdf');
}
async function v16Export(kind){
  const name=v16ExportName();
  /* 原生：先落盘再请原生捕获当前屏幕（v16 编辑器可见） */
  if(typeof Native!=='undefined' && Native && Native.call){
    try{
      await flushWYSIWYG();
      document.body.classList.add('capturing');
      await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
      const cr=await Native.call('captureExport',{kind,name});
      document.body.classList.remove('capturing');
      toast(cr&&cr.path?('已保存到 '+cr.path):(kind==='png'?'长截图已保存':'PDF 已保存'));
    }catch(e){ document.body.classList.remove('capturing'); toast((e&&e.message)||'导出失败'); }
    return;
  }
  /* 浏览器：html2canvas 离屏渲染 */
  try{
    toast(kind==='png'?'正在生成长截图…':'正在生成 PDF…');
    await ensureExportLibs();
    const node=await buildV16ExportNode();
    const cv=await html2canvas(node,{scale:2,backgroundColor:'#ffffff'});
    node.remove();
    if(kind==='png'){ downloadURL(cv.toDataURL('image/png'),name+'.png'); toast('长截图已导出'); }
    else { v16PdfFromCanvas(cv,name); toast('PDF 已导出'); }
  }catch(e){ toast(e.message||'导出失败'); }
}
/* ===== 编辑器写操作串行队列（核心：所有 save/rename 排队，杜绝竞态）=====
   问题场景：正文防抖(500)、标题改名(600)、退出 flush 三者并发，会出现
   旧文件先改名、正文写回旧路径，或退出时 renderHome 早于改名。
   方案：所有这类操作 enqueue 到同一条链，按调用顺序逐个执行；
   每个 save 执行时读取的是"当时最新"的 contenteditable 与路径。 */
let _opChain = Promise.resolve();
function enqueue(fn){
  const p = _opChain.then(()=>fn()).catch(e=>{ if(e) console.warn('op failed', e); });
  _opChain = p;
  return p;
}
/* 测试/排障：等待所有排队的写操作完成；并暴露运行态 S（只读用途） */
if(typeof window!=='undefined'){ window.__opIdle=()=>_opChain; window.__S=()=>S; }
let _wysiwygTimer=null;
/* 把当前 contenteditable 序列化并落盘（入队，自动等待前一个操作） */
function flushWYSIWYG(){
  clearTimeout(_wysiwygTimer);
  return enqueue(async ()=>{
    const newMd = serializeWYSIWIG();
    if(!newMd || !S._cur) return;
    /* 用最新路径（重命名可能已发生），避免写回旧路径 */
    const path = S._cur.entry.path;
    await Vault.save(path, newMd);
    S._cur.md = newMd;
    S._cur.html = MD.toHTML(newMd);
    S._cur.entry = (await Vault.get(path)).entry;
  });
}
function scheduleWYSIWIGSave(){
  clearTimeout(_wysiwygTimer);
  _wysiwygTimer = setTimeout(flushWYSIWYG, 500);
}

/* ---------- 编辑器 ---------- */
async function openNote(path){
  S.curNote = path; S.sourceMode = false;
  const data = await Vault.get(path);
  S._cur = data;
  renderEditor(); show('editor');
}
function renderEditor(){
  const data = S._cur; if(!data) return;
  const e = data.entry;
  /* 面包屑 */
  const cr = Vault.crumbs(e.path);
  $('#v16EdCrumb').innerHTML =
    cr.map((s,i)=>`<span class="cr ${i===cr.length-1?'cur':''}">${i===0?I.home:esc(s.name)}</span>${i<cr.length-1?'<span class="sep">/</span>':''}`).join('')
    + `<span class="mv" id="v16EdMove">移动到…</span>`;
  $('#v16EdMove').onclick = ()=>openSheet('移动到…', [
    {icon:I.folder,label:'工作',fn:async()=>{await Vault.move(e.path,'工作'); afterMove();}},
    {icon:I.folder,label:'生活',fn:async()=>{await Vault.move(e.path,'生活'); afterMove();}},
    {icon:I.folder,label:'根目录',fn:async()=>{await Vault.move(e.path,''); afterMove();}}
  ]);
  const attachments = Vault.attachments(e.path);

  let body = `
    <input class="v16-ed-title" id="v16EdTitle" value="${esc(e.title)}" placeholder="标题">
    <div class="v16-ed-meta">更新于 ${fmtDate(e.updated)} · ${esc(e.path)}</div>`;

  if(S.sourceMode){
    body += `<textarea class="v16-source" id="v16SourceTa" spellcheck="false">${esc(data.md)}</textarea>`;
  } else {
    /* WYSIWYG 正文：contenteditable，初始 HTML 由 MD.toHTML 后处理（todo 行转 checkbox li） */
    body += `<div class="v16-ed-body" id="v16EdBody" contenteditable="true" data-ph="点这里开始书写…">${mdToEditableHTML(data.md)}</div>`;
  }
  if(attachments.length){
    body += `<div class="v16-attach-sec"><div class="ast">附件（${attachments.length}）</div><div class="v16-attach-row">`
      + attachments.map((a,i)=> a.kind==='image'
        ? `<div class="v16-att" data-img="${i}"><img src="${a.url}" alt="${esc(a.name)}"><div class="an">${esc(a.name)}</div></div>`
        : `<div class="v16-att"><span class="fileico">${I.file}</span><div class="an">${esc(a.name)}</div></div>`
      ).join('') + `</div></div>`;
  }
  $('#v16EdScroll').innerHTML = body;

  /* WYSIWYG：输入防抖保存 500ms（htmlToMD 序列化） */
  if(!S.sourceMode){
    const ed = $('#v16EdBody');
    /* 勾选 checkbox 触发的 input 事件不调度自由序列化（受控勾选由 change 委托处理），
       避免 htmlToMD 与 toggleTodo 竞争；只有正文文本编辑才走防抖保存 */
    ed.oninput = (ev)=>{
      if(ev && ev.target && ev.target.classList && ev.target.classList.contains('v16-ed-todoinput')) return;
      scheduleWYSIWIGSave();
    };
    /* 勾选 input：同步 checked attribute（htmlToMD 读 attribute） */
    ed.onclick = (ev)=>{
      /* 点击图片：打开大图查看器（受控待办勾选由 change 委托处理，不在此处理） */
      if(ev.target && ev.target.tagName==='IMG'){
        const src = ev.target.getAttribute('data-relpath') || ev.target.getAttribute('src')||'';
        if(src){ $('#v16Img').src = src; $('#v16ImgViewer').classList.add('open'); }
      }
      /* 点击 wiki 双链：跳转对应笔记（Vault.search 只接受一个参数，返回 entry 数组） */
      if(ev.target && ev.target.classList && ev.target.classList.contains('md-wiki')){
        const target = ev.target.dataset.target || ev.target.textContent;
        Vault.search(target).then(res=>{
          const arr = Array.isArray(res)?res:[];
          const hit = arr.find(e=>e.title===target) || arr[0];
          if(hit) openNote(hit.path);
          else toast('未找到「'+target+'」');
        }).catch(()=>toast('未找到「'+target+'」'));
      }
    };
  }

  /* 标题联动文件名（防抖 600ms）。把"正文落盘 + 改名 + 重渲染"作为一个
     原子操作 enqueue，保证退出 flush 等操作不会插在中间。 */
  let titleTimer=null;
  $('#v16EdTitle').oninput = (ev)=>{
    clearTimeout(titleTimer);
    const newTitle = ev.target.value.trim() || '未命名';
    titleTimer = setTimeout(()=>{
      enqueue(async ()=>{
        if(newTitle === S._cur.entry.title) return;
        /* 1. 正文最新内容落盘（在同一队列内，直接序列化保存） */
        const newMd = serializeWYSIWIG();
        if(newMd){
          const beforePath = S._cur.entry.path;
          await Vault.save(beforePath, newMd);
          S._cur.md = newMd;
          /* 2. 取最新路径改名 */
          const newPath = await Vault.rename(S._cur.entry.path, newTitle);
          if(newPath !== beforePath){
            S.curNote = newPath;
            S._cur = await Vault.get(newPath);
            /* 3. 重渲染编辑器（标题/meta/路径一致） */
            renderEditor();
            haptic(6);
            toast('已重命名为「'+newTitle+'」');
          }
        }
      });
    }, 600);
  };

  /* 源码模式：textarea 可编辑，防抖 500ms 保存；切回渲染时刷新 html */
  if(S.sourceMode){
    const ta = $('#v16SourceTa');
    let srcTimer=null;
    ta.oninput = ()=>{
      clearTimeout(srcTimer);
      srcTimer = setTimeout(async ()=>{
        const newMd = ta.value;
        try{ await Vault.save(e.path, newMd); }catch(err){ console.warn('save failed', err); }
        S._cur.md = newMd;
        S._cur.html = MD.toHTML(newMd);
        /* 同步更新 entry 的 summary/todo 计数 */
        S._cur.entry = (await Vault.get(e.path)).entry;
      }, 500);
    };
  }
  /* 待办勾选 */
  $('#v16EdScroll').querySelectorAll('.v16-todo').forEach(row=>{
    row.onclick = async ()=>{
      const res = await Vault.toggleTodo(e.path, row.dataset.key);
      if(res){ row.classList.toggle('done', res.done); toast('已保存'); }
    };
  });
  /* 图片点击查看 */
  $('#v16EdScroll').querySelectorAll('.v16-att[data-img]').forEach(el=>{
    el.onclick = ()=>{
      const a = attachments[Number(el.dataset.img)];
      $('#v16Img').src = a.url; $('#v16ImgViewer').classList.add('open');
    };
  });
}
function afterMove(){ toast('已移动'); closeSheet(); show('home'); S.curFolder=''; renderHome(); }

/* ---------- 迁移完整流程 ---------- */
async function startMigrateFlow(){
  if(typeof Migrate==='undefined' || !Migrate || !Migrate.run){ toast('迁移模块未加载'); return; }
  try{
    const det = await Migrate.detect();
    if(!det || !det.notes){ toast('未检测到旧库'); return; }
    /* 1) 确认 */
    const cont = await appConfirm({title:'检测到旧库 '+det.notes+' 篇笔记',
      desc:'将先备份旧库，再迁移为 Markdown 资料库。', okText:'开始迁移', danger:false});
    if(!cont) return;
    /* 2) 备份（失败中止） */
    toast('正在备份旧库…');
    const backup = await Migrate.backup();
    if(!backup){ toast('备份失败，已中止迁移'); return; }
    /* 3) 迁移（进度条） */
    openSheet('迁移旧库', [
      {html:'<div class="v16-progress"><i id="v16MigProg" style="width:0%"></i></div><div id="v16MigMsg" style="font-size:13px;color:var(--vp-ink-2)">准备中…</div>', noClose:true}
    ]);
    const res = await Migrate.run({onProgress:(p)=>{
      const bar = document.getElementById('v16MigProg');
      const msg = document.getElementById('v16MigMsg');
      if(bar) bar.style.width = Math.min(100, Math.round(p*100))+'%';
      if(msg) msg.textContent = '迁移中… '+Math.round(p*100)+'%';
    }});
    /* 4) 校验 */
    const verify = await Migrate.verify().catch(()=>null);
    closeSheet();
    /* 5) 报告（应用内弹窗，替代原生 alert——真机无 WebChromeClient 不弹） */
    const ok = res && res.converted!=null ? res.converted : (res||{});
    await appConfirm({
      title:'迁移完成',
      desc:'成功 '+(ok.converted||0)+' 篇 · 跳过 '+(ok.skipped||0)+' 篇 · 失败 '+(ok.failed||0)+' 篇'
           +(verify?'\n校验通过':'')+'\n旧库已保留，14 天后自动清理。',
      okText:'好的', cancelText:null, danger:false
    });
    renderHome();
  }catch(e){ console.warn(e); closeSheet(); toast('迁移失败'); }
}

/* ---------- 设置 ---------- */
async function renderSettings(){
  const st = await Vault.stats();
  const sz = st.bytes>1024 ? (st.bytes/1024).toFixed(1)+' KB' : st.bytes+' B';
  const g = (id,title,icon,rows)=>`
    <div class="v16-set-group ${id==='g-vault'?'open':''}" data-group="${id}">
      <div class="v16-set-head">${icon}<span class="st">${title}</span>${I.upDown}</div>
      <div class="v16-set-body">${rows}</div>
    </div>`;
  const row=(l,r,action,hl)=>`<div class="v16-row ${hl?'hl':''}" data-row="${action||''}"><span class="rl">${l}</span><span class="rv">${esc(r||'')}</span>${action?I.export.replace('stic','rgo'):''}</div>`;

  $('#v16SettingsBody').innerHTML =
    g('g-vault','资料库',I.book, `
      <div class="v16-row"><span class="rl">当前资料库</span><span class="rv">私有目录 files/vault</span></div>
      <div class="v16-row"><span class="rl">笔记数</span><span class="rv">${st.notes} 篇</span></div>
      <div class="v16-row"><span class="rl">文件夹</span><span class="rv">${st.folders} 个</span></div>
      <div class="v16-row"><span class="rl">附件</span><span class="rv">${st.attachments} 个</span></div>
      <div class="v16-row"><span class="rl">容量</span><span class="rv">${sz}</span></div>
      <div class="v16-row" data-row="bind"><span class="rl">绑定外部文件夹（SAF）</span>${I.export.replace('stic','rgo')}</div>
      <div class="v16-row" data-row="safpush"><span class="rl">同步到绑定目录</span>${I.export.replace('stic','rgo')}</div>
      <div class="v16-row" data-row="safpull"><span class="rl">从绑定目录恢复</span>${I.export.replace('stic','rgo')}</div>
      <div class="v16-row" data-row="newvault"><span class="rl">新建 / 切换资料库</span>${I.export.replace('stic','rgo')}</div>
      <div class="v16-row" data-row="import"><span class="rl">导入数据（zip/JSON/JSONL）</span>${I.export.replace('stic','rgo')}</div>
      <div class="v16-row" data-row="export"><span class="rl">导出资料库（zip）</span>${I.export.replace('stic','rgo')}</div>
      <div class="v16-row" data-row="exportbak"><span class="rl">完整备份包（zip）</span>${I.export.replace('stic','rgo')}</div>
      <div class="v16-row" data-row="exportjsonl"><span class="rl">知识库切片（JSONL）</span>${I.export.replace('stic','rgo')}</div>
      <div class="v16-row" data-row="exportkbmd"><span class="rl">知识库（Markdown）</span>${I.export.replace('stic','rgo')}</div>
      <div class="v16-row" data-row="exportjson"><span class="rl">JSON 导出</span>${I.export.replace('stic','rgo')}</div>
      <div class="v16-row" data-row="kbbuild"><span class="rl">构建 / 更新知识切片</span><span class="rv">按段落切片+溯源</span>${I.export.replace('stic','rgo')}</div>
      <div class="v16-row hl" data-row="migrate"><span class="rl">检测到旧库 library.json</span><span class="rv" style="color:#A04438;font-weight:700">迁移旧库 →</span></div>
    `)
    + g('g-edit','编辑',I.edit, `
      <div class="v16-row" style="cursor:default;opacity:.85"><span class="rl">默认附件位置</span><span class="rv">attachments/</span></div>
      <div class="v16-row" data-row="newloc"><span class="rl">新建文件默认位置</span><span class="rv">${prefs.newFileLoc==='root'?'资料库根':'当前目录'}</span></div>
      <div class="v16-row" data-row="hlsyn"><span class="rl">==高亮== 语法</span><span class="v16-switch ${prefs.hlSyntax?'on':''}" data-sw></span></div>
      <div class="v16-row" data-row="wiki"><span class="rl">[[wiki]] 双链</span><span class="v16-switch ${prefs.wikiSyntax?'on':''}" data-sw></span></div>
      <div class="v16-row" data-row="newtype"><span class="rl">默认新建类型</span><span class="rv">${prefs.defaultType==='todo'?'待办':'笔记'}</span></div>
    `)
    + g('g-app','显示与主题',I.export.replace('stic','stic'), `
      <div class="v16-row" data-row="font"><span class="rl">显示字体</span><span class="rv">默认</span></div>
      <div class="v16-row" data-row="fontscale"><span class="rl">字号刻度尺</span><span class="rv">标准</span></div>
      <div class="v16-row" data-row="theme"><span class="rl">主题</span><span class="rv">${{light:'浅色',dark:'深色',auto:'跟随系统'}[prefs.theme]||'跟随系统'}</span></div>
    `)
    + g('g-more','更多',I.settings, `
      <div class="v16-row" data-row="ai"><span class="rl">AI 服务与模型</span><span class="rv">OpenAI 兼容</span></div>
      <div class="v16-row" data-row="log"><span class="rl">运行日志</span>${I.export.replace('stic','rgo')}</div>
      <div class="v16-row" data-row="pan"><span class="rl">百度网盘</span><span class="rv" style="color:var(--vp-ink-3)">即将上线</span></div>
      ${Store.env==='native'?'':`<div class="v16-row" data-row="install"><span class="rl">安装到主屏</span><span class="rv">像原生应用</span></div>`}
      <div class="v16-row" data-row="about"><span class="rl">关于</span><span class="rv">v${APP_VERSION}</span></div>
      <div class="v16-row" data-row="privacy"><span class="rl">纯本地隐私</span><span class="rv">数据不出设备</span></div>
    `);

  /* 手风琴 */
  root.querySelectorAll('.v16-set-head').forEach(h=>{
    h.onclick = ()=>h.parentElement.classList.toggle('open');
  });
  /* 开关 */
  root.querySelectorAll('.v16-switch').forEach(sw=>{ sw.onclick = ()=>sw.classList.toggle('on'); });
  /* 行动作 */
  root.querySelectorAll('.v16-row[data-row]').forEach(r=>{
    r.onclick = ()=>{
      const a = r.dataset.row;
      if(a==='theme'){ openThemePicker(); }
      else if(a==='migrate'){ startMigrateFlow(); }
      else if(a==='ai'){ openLegacy('ai','settings'); }
      else if(a==='log'){ openLegacy('log','settings'); }
      else if(a==='pan'){ toast('百度网盘即将上线，敬请期待'); }
      else if(a==='about'){
        openModal('<h3>关于纸片</h3><p><b>纸片 · 便签 v'+APP_VERSION+'</b><br>Markdown 单文件资料库（类 Obsidian）：文字笔记与待办、文件夹分类、富文本、图片与附件、内联搜索、回收站、目录绑定与 zip 迁移，并可接入 OpenAI 兼容 AI 与百度网盘。</p><p>所有数据仅存于本机，不经过任何服务器。</p>');
      }
      else if(a==='privacy'){
        openModal('<h3>纯本地隐私说明</h3><p>纸片不设账号、不收集任何数据。所有笔记、图片、附件与 AI 配置均只保存在本设备；AI 问答仅在你主动触发时，把当前页内容发送到你自己配置的模型服务。</p><p>清理应用数据前请先导出备份。</p>');
      }
      else if(a==='fontscale'){
        /* 字号刻度尺：三档 0.9 / 1.0 / 1.15。v16 样式全部用固定 px，改 root.fontSize 不生效；
           复用 v15 验证过的 applyFontScale()（设置 <html> zoom，整页含 v16root 一起缩放），
           并写入 prefs.fontScale 持久化、重启保留。 */
        const cur = prefs.fontScale || 1;
        const next = cur >= 1.15 ? 0.9 : (cur <= 0.9 ? 1.0 : 1.15);
        prefs.fontScale = next;
        if(typeof applyFontScale==='function') applyFontScale();
        persistPrefs();
        const rv = r.querySelector('.rv');
        if(rv) rv.textContent = next===1 ? '标准' : (next>1 ? '较大' : '较小');
        toast('字号：'+Math.round(next*100)+'%');
      }
      else if(a==='font'){ openFontPicker(); }
      else if(a==='install'){ installApp(); }
      else if(a==='bind'){
        VaultFS.bindFolder().then(r=>toast('已绑定：'+(r||'外部文件夹'))).catch(e=>toast('绑定失败（需真机）'));
      }
      else if(a==='safpush'){
        (async()=>{ toast('正在同步…'); try{ await VaultSync.syncVaultToStore(); if(typeof syncFolder==='function') await syncFolder(true); toast('已同步到目录'); }catch(e){ console.warn(e); toast('同步失败（需真机）'); } })();
      }
      else if(a==='safpull'){
        (async()=>{ toast('正在恢复…'); try{ if(typeof openFolder==='function') await openFolder(); await VaultSync.restoreFromStore(); renderHome(); toast('已从目录恢复'); }catch(e){ console.warn(e); toast('恢复失败（需真机）'); } })();
      }
      else if(a==='export'){
        VaultFS.exportZip().then(r=>toast('已导出资料库 zip')).catch(e=>toast('导出失败（需真机）'));
      }
      else if(a==='exportbak'){
        (async()=>{ toast('正在备份…'); try{ await VaultSync.syncVaultToStore(); if(typeof exportData==='function') await exportData(); toast('备份包已导出'); }catch(e){ console.warn(e); toast('备份失败'); } })();
      }
      else if(a==='exportjsonl'){
        (async()=>{ toast('正在导出…'); try{ await VaultSync.syncVaultToStore(); if(typeof exportRAGJsonl==='function') await exportRAGJsonl(); toast('JSONL 已导出'); }catch(e){ console.warn(e); toast('导出失败'); } })();
      }
      else if(a==='exportkbmd'){
        (async()=>{ toast('正在导出…'); try{ await VaultSync.syncVaultToStore(); if(typeof exportRAGMarkdown==='function') await exportRAGMarkdown(); toast('知识库 MD 已导出'); }catch(e){ console.warn(e); toast('导出失败'); } })();
      }
      else if(a==='exportjson'){
        (async()=>{ toast('正在导出…'); try{
          await VaultSync.syncVaultToStore();
          const data = Store.payload();
          /* 统一走 exportArtifact：原生端写入导出目录并返回路径，浏览器端下载；
             不再用 Blob + a.click()（Android WebView 中不触发系统保存） */
          const p = await exportArtifact('JSON','zhipian-library.json','application/json', data);
          toast('已导出：'+(p||'zhipian-library.json'));
        }catch(e){ console.warn(e); toast('导出失败'); } })();
      }
      else if(a==='import'){
        (async()=>{
          try{
            toast('正在准备…');
            await VaultSync.syncVaultToStore();
            if(typeof unifiedImportEntry==='function'){ unifiedImportEntry(); haptic(8); }
            else toast('导入功能暂不可用');
          }catch(e){ console.warn(e); toast('导入失败'); }
        })();
      }
      else if(a==='kbbuild'){
        /* 用 v16 底部 sheet 包装（v15 openActionSheet 层级在 v16 之下不可见）。
           buildKnowledgeIndex 遍历全局 notes，必须先 syncVaultToStore 把 vault .md 投影进来，
           否则切片的是空数据。 */
        openSheet('构建知识切片', [
          {icon:I.file, label:'前台构建（显示进度）', fn:async()=>{
            try{ toast('正在同步…'); await VaultSync.syncVaultToStore(); buildKnowledgeIndex(false); }
            catch(e){ console.warn(e); toast('构建失败'); } }},
          {icon:I.file, label:'后台保活构建', fn:async()=>{
            try{ toast('正在同步…'); await VaultSync.syncVaultToStore(); buildKnowledgeIndex(true); }
            catch(e){ console.warn(e); toast('构建失败'); } }}
        ]);
      }
      else if(a==='hlsyn'){
        prefs.hlSyntax=!prefs.hlSyntax; persistPrefs();
        r.querySelector('.v16-switch').classList.toggle('on',prefs.hlSyntax);
        toast(prefs.hlSyntax?'已启用 ==高亮==':'已关闭 ==高亮==');
      }
      else if(a==='wiki'){
        prefs.wikiSyntax=!prefs.wikiSyntax; persistPrefs();
        r.querySelector('.v16-switch').classList.toggle('on',prefs.wikiSyntax);
        toast(prefs.wikiSyntax?'已启用 [[wiki]]':'已关闭 [[wiki]]');
      }
      else if(a==='newtype'){
        prefs.defaultType=prefs.defaultType==='todo'?'note':'todo'; persistPrefs();
        r.querySelector('.rv').textContent=prefs.defaultType==='todo'?'待办':'笔记';
        toast('默认新建：'+(prefs.defaultType==='todo'?'待办':'笔记'));
      }
      else if(a==='newloc'){
        prefs.newFileLoc=prefs.newFileLoc==='root'?'current':'root'; persistPrefs();
        r.querySelector('.rv').textContent=prefs.newFileLoc==='root'?'资料库根':'当前目录';
      }
      else if(a==='newvault'){
        /* 新建资料库：确认后清空当前库（含回收站），重新落 seed 或空白 */
        (async()=>{
          const ok = await appConfirm({title:'新建资料库？', desc:'当前所有笔记（含回收站）将被清空，建议先导出备份。', okText:'清空并新建'});
          if(ok){ try{ await Vault.clear(); await Vault.init(); renderHome(); toast('已新建资料库'); }catch(e){ toast('新建失败'); } }
        })();
      }
      else { toast(r.querySelector('.rl').textContent + ' · v16 后续里程碑接入'); }
    };
  });
}

/* ---------- 搜索 ---------- */
async function doSearch(){
  const q = $('#v16SrInput').value;
  const hits = await Vault.search(q);
  $('#v16SrBody').innerHTML = hits.length ? hits.map(h=>`
    <div class="v16-sr-hit" data-path="${esc(h.path)}">
      <div class="ht">${esc(h.title)}</div>
      <div class="hs">${esc(h.folder||'根目录')} · ${esc(h.summary)}</div>
    </div>`).join('')
    : '<div class="v16-empty">'+I.search+'<p>无匹配结果</p></div>';
  $('#v16SrBody').querySelectorAll('.v16-sr-hit').forEach(el=>{
    el.onclick = ()=>openNote(el.dataset.path);
  });
}

/* ---------- 回收站 ---------- */
async function renderTrash(){
  const list = await Vault.trashList();
  $('#v16TrashBody').innerHTML = list.length ? list.map(item=>`
    <div class="v16-trash-item">
      <div class="ti"><div class="tn">${esc(item.entry.title)}</div>
      <div class="tp">删除于 ${fmtDate(item.entry.updated)} · 原路径 ${esc(item.originalPath)}</div></div>
      <button class="b-restore" data-action="restore" data-path="${esc(item.entry.path)}">恢复</button>
      <button class="b-del" data-action="del" data-path="${esc(item.entry.path)}">彻底删除</button>
    </div>`).join('')
    : '<div class="v16-empty">'+I.trash+'<p>回收站为空</p></div>';
  $('#v16TrashBody').querySelectorAll('button').forEach(b=>{
    b.onclick = async ()=>{
      if(b.dataset.action==='restore'){ await Vault.restore(b.dataset.path); haptic(6); toast('已恢复'); await renderTrash(); }
      else {
        const p = b.dataset.path;
        openModal('<h3>彻底删除？</h3><p>此操作不可恢复，笔记将被永久删除。</p>'
          +'<div class="modal-actions"><button class="btn-ghost" data-close>取消</button><button class="btn-danger" id="delForeverConf">彻底删除</button></div>');
        $('#delForeverConf').onclick=async()=>{ closeModal(); await Vault.deleteForever(p); haptic(10); toast('已彻底删除'); await renderTrash(); };
      }
    };
  });
}

/* ---------- 文件夹选择面板（移动/批量移动） ---------- */
/* mode: 'stay' = 从编辑器调用，移动后留在编辑器并刷新；否则移动后回首页 */
async function pickFolderAndMove(notePath, mode){
  try{
    const root = await Vault.tree();   /* 根节点对象 {name,path:'',children:[...]} */
    const folders = [{path:'',name:'根目录',depth:0}];
    (function walk(node, depth){
      (node.children||[]).forEach(c=>{
        folders.push({path:c.path, name:c.name, depth});
        walk(c, depth+1);
      });
    })(root, 0);
    const opts = folders.map(f=>({
      icon: I.folder,
      label: '　'.repeat(f.depth) + (f.name||'根目录'),
      fn: ()=>{
        /* 移动 + 刷新作为一个原子操作入队，idle 能等到，避免竞态 */
        enqueue(async ()=>{
          const newPath = await Vault.move(notePath, f.path);
          haptic(6);
          if(mode==='stay'){
            S.curNote = newPath;
            S._cur = await Vault.get(newPath);
            renderEditor();
            toast('已移动到「'+(f.name||'根目录')+'」');
          } else {
            toast('已移动到「'+(f.name||'根目录')+'」');
            show('home'); renderHome();
          }
        });
      }
    }));
    openSheet('移动到…', opts);
  }catch(e){ console.warn(e); toast('移动失败'); }
}

/* ---------- 底部 sheet ---------- */
function openSheet(title, opts){
  $('#v16SheetTitle').textContent = title;
  $('#v16SheetOpts').innerHTML = opts.map((o,i)=>{
    if(o.html) return `<div class="v16-sheet-opt v16-sheet-html" data-i="${i}">${o.html}</div>`;
    return `<div class="v16-sheet-opt" data-i="${i}">${o.icon||''}${esc(o.label||'')}</div>`;
  }).join('');
  $('#v16SheetOpts').querySelectorAll('.v16-sheet-opt').forEach(el=>{
    const o = opts[Number(el.dataset.i)];
    if(o.html) return;
    el.onclick = ()=>{ if(!o.noClose) closeSheet(); o.fn&&o.fn(); };
  });
  $('#v16SheetMask').classList.add('open'); $('#v16Sheet').classList.add('open');
  /* 点击遮罩关闭（每次打开重绑，避免重复绑定）；进度类 noClose 表也允许遮罩关闭 */
  $('#v16SheetMask').onclick = ()=>closeSheet();
}
function closeSheet(){ $('#v16SheetMask').classList.remove('open'); $('#v16Sheet').classList.remove('open'); }

/* ---------- 颜色选择器（7 色，单篇/批量共用） ---------- */
const V16_COLORS = ['cream','yellow','orange','pink','green','blue','purple'];
const COLOR_LABEL = {cream:'米白',yellow:'明黄',orange:'暖橙',pink:'樱粉',green:'草绿',blue:'青蓝',purple:'浅紫'};
function openColorPicker(current, onPick){
  const html = '<div class="v16-colorpal">'+V16_COLORS.map(c=>
    `<button class="v16cdot ${c===current?'sel':''}" data-c="${c}" style="background:var(--vp-c-${c})" aria-label="${COLOR_LABEL[c]}"></button>`
  ).join('')+'</div>';
  openSheet('选择颜色',[{html, noClose:true}]);
  $('#v16SheetOpts').querySelectorAll('.v16cdot').forEach(d=>{
    d.onclick = async()=>{ const c=d.dataset.c; await onPick(c); closeSheet(); };
  });
}

/* ---------- 旧屏桥接（沿用 v15 功能屏：AI/网盘/日志/API/搜索等） ----------
   不改变 hash、不进 navStack：直接把旧 v15 屏提升到 v16 之上显示；
   其返回按钮经捕获式拦截回到 v16。这样旧屏的成熟逻辑原样保留，不重写。 */
let _legacyReturn = null;
let _legacyNotesSig = null;
/* notes 内容指纹：仅用于判断旧屏是否改动了 notes（标题/时间/正文长度），避免回写风暴 */
function notesSignature(){
  try{
    return notes.length + '|' + notes.map(n=>n.id+'@'+(n.updatedAt||0)+':'+(n.content||'').length).join('~');
  }catch(e){ return ''; }
}
async function openLegacy(name, returnScr){
  const el = document.getElementById('scr-'+name);
  if(!el){ toast('该功能暂不可用'); return; }
  /* 旧屏 RAG / 导入导出基于全局 notes：先把 vault 最新 .md 投影进旧数据模型，
     否则 AI 问答知识库为空、导入导出看到空数据。完成后再显示旧屏。 */
  if(typeof VaultSync!=='undefined' && VaultSync && VaultSync.syncVaultToStore){
    toast('正在加载…');
    try{ await VaultSync.syncVaultToStore(); }
    catch(e){ console.warn('syncVaultToStore failed', e); }
  }
  /* 记录进入旧屏时的 notes 指纹，关闭时比对是否需要回写 vault */
  _legacyNotesSig = notesSignature();
  el.classList.add('active','legacy-top');
  _legacyReturn = returnScr || 'settings';
  /* 旧屏内容原本由 hash 路由 route() 触发 render；桥接不走 hash，这里手动补一次初始化，
     否则 chat/ai/log/pan 屏会是空壳（#chatBody / #aiList 无内容）。 */
  if(name==='chat' && typeof openChatScreen==='function') openChatScreen();
  else if(name==='ai' && typeof renderAiList==='function') renderAiList();
  else if(name==='log' && typeof renderLog==='function') renderLog();
  else if(name==='pan' && typeof renderPan==='function') renderPan();
}
async function closeLegacy(){
  const el = document.querySelector('.screen.legacy-top');
  if(el) el.classList.remove('active','legacy-top');
  const r = _legacyReturn || 'settings';
  _legacyReturn = null;
  /* 先立即回到 v16 对应屏，避免后续写回阻塞返回操作 */
  if(r==='home'){ show('home'); renderHome(); }
  else if(r==='editor'){ show('editor'); }
  else show(r);
  /* 旧屏可能新增了笔记（无 __vp 来源标记者）：指纹变了就在后台追加回 vault，完成后再刷新首页 */
  try{
    const changed = _legacyNotesSig && (notesSignature() !== _legacyNotesSig);
    _legacyNotesSig = null;
    if(changed && typeof VaultSync!=='undefined' && VaultSync && VaultSync.appendNotesToVault){
      toast('正在保存资料库…');
      await VaultSync.appendNotesToVault(null);
      if(window.VUI && VUI.renderHome) VUI.renderHome();
    }
  }catch(e){ console.warn('closeLegacy writeback failed', e); }
}
/* 捕获式拦截：旧屏内返回按钮（id 含 Back）点击 → 回 v16，阻止其原有 hash 导航 */
document.addEventListener('click', (e)=>{
  const legacy = document.querySelector('.screen.legacy-top');
  if(!legacy) return;
  const btn = e.target && e.target.closest && e.target.closest('button');
  if(!btn || !legacy.contains(btn)) return;
  if(/back/i.test(btn.id)){
    e.stopPropagation(); e.preventDefault();
    closeLegacy();
  }
}, true);

/* ---------- 旧 modal 提升：让 v15 的 openModal（字体/关于/隐私）在 v16 之上显示 ---------- */
(function patchLegacyModal(){
  if(typeof openModal!=='function' || typeof closeModal!=='function') return;
  const _OM = openModal, _CM = closeModal;
  openModal = function(html){
    _OM(html);
    const m = document.getElementById('modal');
    if(m) m.classList.add('v16-lift');
  };
  closeModal = function(){
    const m = document.getElementById('modal');
    if(m) m.classList.remove('v16-lift');
    _CM();
  };
})();

/* ---------- 安卓返回键：旧屏(legacy-top)优先关闭 ----------
   closeLegacy 在本 IIFE 内，main.js 的 __dismissOverlay 访问不到。
   这里包装一层：有旧屏先 closeLegacy，否则交还原实现。 */
(function patchDismissOverlay(){
  const _orig = window.__dismissOverlay;
  window.__dismissOverlay = function(){
    const legacy = document.querySelector('.screen.legacy-top');
    if(legacy){ closeLegacy(); return true; }
    return _orig ? _orig() : false;
  };
})();

/* ---------- 本页问答：把当前 vault 笔记合成 v15 笔记，复用 openNoteAi 全套逻辑 ---------- */
let _naiSynth = null;
async function openVaultNoteAi(){
  if(!S._cur){ toast('请先打开笔记'); return; }
  const data=S._cur, e=data.entry;
  const fm = MD.parseFrontmatter(data.md).fm||{};
  const todoRows = MD.todoLines(data.md);
  const atts = await Vault.attachments(e.path);
  const synth = {
    id: fm.id || ('vault-'+e.path),
    title: e.title,
    content: data.html,                 /* 渲染 HTML，noteContextText 内部转 md */
    todos: todoRows.map(t=>({done:t.done,text:t.text})),
    files: atts.map(a=>({name:a.name,size:a.size||0})),
    color: fm.color, type: fm.type||'note',
    _vaultSynth:true
  };
  const prevEditing = editingId;
  if(!notes.find(n=>n.id===synth.id)) notes.push(synth);
  editingId = synth.id;
  _naiSynth = { synth, prevEditing };
  await openNoteAi();
  /* 未配置 AI 等导致面板未打开：回滚注入 */
  if(!$('#noteAiPanel').classList.contains('open')){
    notes = notes.filter(n=>n.id!==synth.id);
    editingId = prevEditing;
    _naiSynth = null;
  }
}
/* 关闭本页问答时，移除合成笔记并还原 v15 编辑上下文 */
const _origCloseNoteAi = closeNoteAi;
closeNoteAi = function(){
  _origCloseNoteAi();
  if(_naiSynth){
    notes = notes.filter(n=>n.id!==_naiSynth.synth.id);
    editingId = _naiSynth.prevEditing;
    _naiSynth = null;
  }
};

/* ---------- 主题圆形扩散（双图层） ---------- */
function applyTheme(t){
  S.theme = t;
  document.documentElement.dataset.theme = t;
  if(root) root.style.background = (t==='dark') ? '#18191C' : '#ECEAE2';
}
function toggleTheme(target, animate){
  const next = target || (S.theme==='dark' ? 'light' : 'dark');
  haptic(10);
  if(!animate || reduceMotion()){ applyTheme(next); return; }
  /* 双图层揭示：圆形遮罩从右上扩散 */
  const circle = document.createElement('div');
  circle.className = 'v16-reveal';
  const r = Math.max(window.innerWidth, window.innerHeight) * 1.2;
  circle.style.background = next==='dark' ? '#18191C' : '#ECEAE2';
  circle.style.width = circle.style.height = r+'px';
  circle.style.left = (window.innerWidth - r/2)+'px';
  circle.style.top = '0px';
  document.body.appendChild(circle);
  requestAnimationFrame(()=>{
    circle.style.transition = 'transform .55s cubic-bezier(.22,1,.36,1), opacity .55s';
    circle.style.transform = 'scale(1)'; circle.style.opacity = '1';
  });
  /* 先切主题，再让圆形遮住切换瞬间 */
  setTimeout(()=>applyTheme(next), 120);
  setTimeout(()=>{ circle.style.opacity='0'; setTimeout(()=>circle.remove(), 500); }, 620);
}

/* 主题三选：浅色 / 深色 / 跟随系统（保留 v15 三档，含圆形扩散动画） */
function openThemePicker(){
  const cur = (typeof prefs!=='undefined' && prefs.theme) || 'auto';
  const name={light:'浅色',dark:'深色',auto:'跟随系统'};
  const icon={light:I.sun,dark:I.moon,auto:I.auto};
  openSheet('主题', ['light','dark','auto'].map(k=>({
    icon: icon[k],
    label: name[k] + (cur===k?'　✓':''),
    fn:()=>{
      prefs.theme = k; persistPrefs();
      const t = k==='auto'
        ? (window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light')
        : k;
      if(t!==S.theme) toggleTheme(t,true);
      else applyTheme(t);
    }
  })));
}

/* ---------- 事件绑定 ---------- */
function bind(){
  $('#v16Menu').onclick = openDrawer;
  $('#v16HomeAi').onclick = ()=>openLegacy('chat','home');
  $('#v16EdAi').onclick = ()=>openVaultNoteAi();
  $('#v16DrawerMask').onclick = closeDrawer;
  $('#v16DrawerClose').onclick = closeDrawer;
  $('#v16SearchBtn').onclick = ()=>{ show('search'); setTimeout(()=>$('#v16SrInput').focus(), 300); };
  $('#v16More').onclick = ()=>openSheet('更多', [
    {icon:I.upload, label:'导入文件', fn:async()=>{
      try{ toast('正在准备…'); await VaultSync.syncVaultToStore();
        if(typeof unifiedImportEntry==='function'){ unifiedImportEntry(); haptic(8); }
        else toast('导入功能暂不可用');
      }catch(e){ console.warn(e); toast('导入失败'); } }},
    {icon:I.trash, label:'回收站', fn:()=>{show('trash'); renderTrash();}},
    {icon:I.settings, label:'设置', fn:()=>{show('settings'); renderSettings();}},
    {icon:I.theme, label:'切换深色/浅色', fn:()=>toggleTheme(true)}
  ]);
  $('#v16ViewSeg').querySelectorAll('button').forEach(b=>{
    b.onclick = ()=>{
      S.viewMode = b.dataset.v;
      $('#v16ViewSeg').querySelectorAll('button').forEach(x=>x.classList.toggle('on', x===b));
      renderHome();
    };
  });
  /* FAB：长按展开菜单；菜单内真实新建 */
  const fab = $('#v16Fab'), menu = $('#v16FabMenu');
  /* 短按 FAB 直接展开新建菜单（之前短按无反应、只能长按 520ms，真机上像空壳）；
     再点一次收起。长按同样展开。 */
  const fabOpen=()=>{ S.fabOpen=true; menu.classList.add('open'); fab.classList.add('open'); };
  const fabClose=()=>{ S.fabOpen=false; menu.classList.remove('open'); fab.classList.remove('open'); };
  fab.onclick = ()=>{ if(S.fabOpen) fabClose(); else fabOpen(); };
  bindLongPress(fab, fabOpen);
  menu.querySelectorAll('.v16-fab-item').forEach(it=>{
    it.onclick = async ()=>{
      menu.classList.remove('open'); fab.classList.remove('open'); S.fabOpen=false;
      try{
        if(it.dataset.f==='note'){
          /* 尊重设置：默认新建位置（资料库根/当前目录）与默认类型（笔记/待办） */
          const folder = (prefs.newFileLoc==='root') ? '' : S.curFolder;
          const type = prefs.defaultType==='todo' ? 'todo' : 'note';
          const path = await Vault.create({ title:'未命名', folder, type });
          haptic(8);
          await renderHome();
          await openNote(path);
        } else if(it.dataset.f==='folder'){
          const nm = '新文件夹';
          const path = await Vault.createFolder ? await Vault.createFolder(S.curFolder, nm) : null;
          haptic(8);
          toast('已新建文件夹'); renderHome();
        } else if(it.dataset.f==='import'){
          /* 统一导入 zip / JSON / JSONL 备份包：先把 vault 投影进旧 Store，再交 unifiedImportEntry 解析；
             用户在合并/覆盖确认后由 applyLibrary 回写 vault 并刷新首页。 */
          toast('正在准备…');
          await VaultSync.syncVaultToStore();
          if(typeof unifiedImportEntry==='function'){ unifiedImportEntry(); haptic(8); }
          else toast('导入功能暂不可用');
        }
      }catch(e){ console.warn('create failed', e); toast('新建失败'); }
    };
  });
  /* 编辑器 */
  $('#v16EdBack').onclick = async ()=>{
    /* 退出前：若源码模式 textarea 有未保存内容，立即落盘 */
    if(S.sourceMode && S._cur){
      const ta = $('#v16SourceTa');
      if(ta && ta.value !== S._cur.md){
        try{ await Vault.save(S._cur.entry.path, ta.value); }catch(e){}
      }
    } else if(S._cur){
      /* WYSIWYG：退出前立即落盘，避免刚输入（500ms 防抖未到）就返回导致丢内容 */
      try{ await flushWYSIWYG(); }catch(e){}
    }
    show('home'); renderHome();
  };
  $('#v16EdSource').onclick = async ()=>{
    /* 从源码切回渲染：先保存 textarea 最新内容，再用最新 md 重新渲染 */
    if(S.sourceMode && S._cur){
      const ta = $('#v16SourceTa');
      if(ta){
        try{ await Vault.save(S._cur.entry.path, ta.value); }catch(e){}
        S._cur = await Vault.get(S._cur.entry.path);
      }
    }
    S.sourceMode = !S.sourceMode;
    renderEditor();
  };
  $('#v16EdMore').onclick = ()=>openSheet('笔记操作', [
    {icon:I.hl, label:'颜色', fn:()=>{ if(S._cur){ openColorPicker(S._cur.entry.color, (c)=>{
      /* 入队，保证与正文保存互斥、且 idle 能等到 */
      enqueue(async ()=>{
        const path = S._cur.entry.path;
        await Vault.setColor(path, c);
        /* 刷新编辑器缓存，避免下次 WYSIWYG 保存用旧 frontmatter 覆盖新颜色 */
        const fresh = await Vault.get(S._cur.entry.path);
        S._cur.md=fresh.md; S._cur.entry=fresh.entry; S._cur.frontmatter=fresh.frontmatter;
        haptic(6); toast('颜色已更换');
      }); }); } }},
    {icon:I.move, label:'移动到…', fn:()=>{
      const path = S._cur.entry.path;
      pickFolderAndMove(path, 'stay');
    }},
    {icon:I.trash, label:'删除（回收站）', fn:async()=>{ if(S._cur){ const path=S._cur.entry.path;
      openModal('<h3>删除这篇笔记？</h3><p>将移入回收站，可在回收站恢复。</p>'
        +'<div class="modal-actions"><button class="btn-ghost" data-close>取消</button><button class="btn-danger" id="delConf">移入回收站</button></div>');
      $('#delConf').onclick=()=>{ closeModal(); beforeDelete([path], async()=>{
        const trashPath = await Vault.remove(path);
        show('home'); renderHome();
        toast('已移入回收站', {label:'撤销', fn:async()=>{
          try{ await Vault.restore(trashPath); renderHome(); toast('已恢复'); }catch(e){ toast('恢复失败'); }
        }});
      }); };
    } }},
    {icon:I.pin, label:'置顶/取消', fn:()=>{ if(S._cur){
      const newPin = !S._cur.entry.pinned;
      enqueue(async ()=>{
        const path = S._cur.entry.path;
        await Vault.setPin(path, newPin);
        const fresh = await Vault.get(path);
        S._cur.md=fresh.md; S._cur.entry=fresh.entry; S._cur.frontmatter=fresh.frontmatter;
        haptic(6); toast(newPin?'已置顶':'已取消置顶');
      });
    } }},
    {icon:I.clip, label:'添加文件（Word/Excel/PDF…）', fn:()=>pickWYSIWYGFile()},
    {icon:I.image, label:'导出整页长截图（PNG）', fn:()=>v16Export('png')},
    {icon:I.down, label:'导出 PDF 版', fn:()=>v16Export('pdf')}
  ]);
  /* 底部工具栏：WYSIWYG 格式化 */
  $('#v16Dock').querySelectorAll('button').forEach(b=>{
    b.onclick = async ()=>{
      const ed = $('#v16EdBody');
      if(!ed){ toast('请先打开笔记'); return; }
      ed.focus();
      clearEmptyPlaceholder();
      const t = b.dataset.t;
      try{
        if(t==='bold') document.execCommand('bold');
        else if(t==='italic') document.execCommand('italic');
        else if(t==='underline') document.execCommand('underline');
        else if(t==='strike') document.execCommand('strikeThrough');
        else if(t==='head') document.execCommand('formatBlock', false, 'h2');
        else if(t==='list') document.execCommand('insertUnorderedList');
        else if(t==='quote') document.execCommand('formatBlock', false, 'blockquote');
        else if(t==='code') document.execCommand('formatBlock', false, 'pre');
        else if(t==='hl'){
          try{ document.execCommand('styleWithCSS', false, true); }catch(e){}
          document.execCommand('hiliteColor', false, '#FFE27A');
        }
        else if(t==='link'){
          /* 先等挂起的改名（其 renderEditor 会重建正文）完成，避免选区失效/链接被重渲染覆盖；
             弹窗会把焦点移到输入框，再保存正文选区，关闭后恢复并 createLink */
          await _opChain;
          const saved = saveSelection();
          const url = await appPrompt({title:'插入链接', placeholder:'https://…', okText:'插入'});
          if(url && url.trim()){
            const u = url.trim();
            const edBody = document.getElementById('v16EdBody');
            edBody.focus();
            const restored = restoreSelection(saved);
            const sel = window.getSelection();
            /* 选区有效且非折叠：createLink 包裹选中文字；否则（折叠/空笔记/弹窗后焦点丢失）
               直接在正文末尾追加链接段落，不依赖 execCommand 的选区 */
            if(restored && sel && !sel.isCollapsed){
              document.execCommand('createLink', false, u);
            } else {
              clearEmptyPlaceholder();
              const p = document.createElement('p');
              p.className='md-p';
              p.innerHTML = '<a href="'+esc(u)+'">'+esc(u)+'</a>';
              edBody.appendChild(p);
            }
          }
        }
        else if(t==='todo'){
          /* 先等挂起的改名完成，再追加受控待办行（正确处理空占位与 data-key） */
          await _opChain;
          await insertTodoLine();
        }
        else if(t==='image'){
          await pickWYSIWYGImage();
        }
        scheduleWYSIWIGSave();
      }catch(e){ console.warn('toolbar exec', e); }
    };
  });
  /* 受控待办勾选：change 委托（renderEditor 重渲染 innerHTML 后仍生效）。
     勾选只调 Vault.toggleTodo，状态与 #p 优先级由数据层保证，不丢。 */
  root.addEventListener('change', async (ev)=>{
    if(!(ev.target && ev.target.classList && ev.target.classList.contains('v16-ed-todoinput'))) return;
    if(!S._cur) return;
    clearTimeout(_wysiwygTimer);   /* 取消挂起的自由序列化，受控勾选为唯一写入源 */
    const path = S._cur.entry.path;
    const key = ev.target.dataset.key;
    try{
      const res = await Vault.toggleTodo(path, key);
      if(res){
        S._cur = await Vault.get(path);
        const ed = document.getElementById('v16EdBody');
        if(ed) ed.innerHTML = mdToEditableHTML(S._cur.md);
      }
    }catch(e){ console.warn('toggle todo failed', e); }
  });
  /* 搜索 */
  $('#v16SrBack').onclick = ()=>{ show('home'); renderHome(); };
  $('#v16SrInput').addEventListener('input', doSearch);
  /* 回收站 */
  $('#v16TrashBack').onclick = ()=>{ show('home'); renderHome(); };
  $('#v16TrashEmpty').onclick = async ()=>{
    const ok = await appConfirm({title:'清空回收站？', desc:'回收站中的笔记将被永久删除，此操作不可恢复。', okText:'清空回收站'});
    if(ok){ await Vault.emptyTrash(); toast('回收站已清空'); renderTrash(); }
  };
  /* 设置 */
  $('#v16SetBack').onclick = ()=>{ show('home'); renderHome(); };
  /* sheet */
  $('#v16SheetMask').onclick = closeSheet;
  $('#v16SheetCancel').onclick = closeSheet;
  /* 图片查看器 */
  $('#v16ImgClose').onclick = ()=>$('#v16ImgViewer').classList.remove('open');
  $('#v16ImgViewer').onclick = (e)=>{ if(e.target.id==='v16ImgViewer') e.currentTarget.classList.remove('open'); };
  /* 抽屉新建文件夹 */
  $('#v16DrawerNew').onclick = async ()=>{
    try{ await Vault.createFolder(S.curFolder, '新文件夹'); haptic(8); toast('已新建文件夹'); renderDrawer(); renderHome(); }
    catch(e){ console.warn(e); toast('新建文件夹失败'); }
  };
  /* 多选操作条：批量删除真实，其余单篇操作已在编辑器更多里支持 */
  $('#v16Selbar').querySelectorAll('button').forEach(b=>{
    b.onclick = async ()=>{
      const action = b.dataset.a;
      const paths = Array.from(S.selected);
      if(action==='del'){
        const cnt = paths.length;
        openModal('<h3>删除选中的 '+cnt+' 篇笔记？</h3><p>将移入回收站，可在回收站恢复。</p>'
          +'<div class="modal-actions"><button class="btn-ghost" data-close>取消</button><button class="btn-danger" id="delBatchConf">移入回收站</button></div>');
        $('#delBatchConf').onclick=()=>{ closeModal(); beforeDelete(paths, async()=>{
          const trashPaths=[];
          for(const p of paths){ try{ trashPaths.push(await Vault.remove(p)); }catch(e){} }
          S.selecting=false; S.selected=new Set(); renderHome();
          toast('已移入回收站', {label:'撤销', fn:async()=>{
            for(const tp of trashPaths){ try{ await Vault.restore(tp); }catch(e){} }
            renderHome(); toast('已恢复');
          }});
        }); };
        return;
      } else if(action==='pin'){
        for(const p of paths){ try{ await Vault.setPin(p, true); }catch(e){} }
        haptic(6);
        toast('已置顶');
      } else if(action==='color'){
        openColorPicker(null, async(c)=>{
          for(const p of paths){ try{ await Vault.setColor(p, c); }catch(e){} }
          haptic(6);
          toast('颜色已批量更换');
        });
        return; /* 颜色选择后由 picker 内部关闭并刷新 */
      } else if(action==='move'){
        /* 批量移动：选文件夹后逐个 Vault.move */
        const root = await Vault.tree();
        const folders = [{path:'',name:'根目录',depth:0}];
        (function walk(node, depth){
          (node.children||[]).forEach(c=>{
            folders.push({path:c.path,name:c.name,depth});
            walk(c,depth+1);
          });
        })(root, 0);
        openSheet('移动 '+paths.length+' 篇到…', folders.map(f=>({
          icon: I.folder,
          label: '　'.repeat(f.depth)+(f.name||'根目录'),
          fn: async ()=>{
            for(const p of paths){ try{ await Vault.move(p, f.path); }catch(e){} }
            haptic(6);
            toast('已移动 '+paths.length+' 篇');
            S.selecting=false; S.selected=new Set(); renderHome();
          }
        })));
        return;
      }
      S.selecting=false; S.selected=new Set(); renderHome();
    };
  });

  /* ---- v16 左缘跟手返回手势（复用 route.js 逻辑，作用于 .v16-scr） ---- */
  const EDGE = 22;
  let g = null;
  window.addEventListener('pointerdown', (e)=>{
    if(IS_DESKTOP) return;
    const top = root.querySelector('.v16-scr.on');
    if(!top || top.dataset.scr==='home') return;
    if(e.clientX > EDGE) return;
    /* 弹层（抽屉/底部 sheet/对话框）打开时不接管 */
    if(document.querySelector('.v16-drawer.open, .v16-sheet.open, .v16-mask.open, .v16-modal.open, .screen.legacy-top')) return;
    /* 起手点控件守卫；顶栏/工具栏整体视为控制区（含其左侧 padding，防止顶栏误触） */
    if(e.target && e.target.closest && e.target.closest('button,a,input,textarea,select,.seg,.switch,.v16-dock,.v16-topbar')) return;
    g = { id:e.pointerId, el:top, startX:e.clientX, startY:e.clientY, locked:false, dx:0 };
  }, {passive:true});
  window.addEventListener('pointermove', (e)=>{
    if(!g || e.pointerId!==g.id) return;
    const dx = e.clientX - g.startX, dy = e.clientY - g.startY;
    if(!g.locked){
      if(Math.abs(dx)<12 && Math.abs(dy)<12) return;
      if(Math.abs(dy)*1.6 > Math.abs(dx) || Math.abs(dx)<12){ g=null; return; }
      g.locked = true; g.dx = 0;
      g.el.style.transition='none';
      haptic(6);
    }
    g.dx = Math.max(0, Math.min(window.innerWidth, dx));
    g.el.style.transform = 'translateX('+g.dx+'px)';
  }, {passive:true});
  window.addEventListener('pointerup', (e)=>{
    if(!g) return;
    const s = g; g = null;
    if(!s.locked){ s.el.style.transform=''; return; }
    /* 抬手时指尖落在控件上：让控件点击生效，不触发返回 */
    let overCtrl=false;
    try{ const el=document.elementFromPoint(e.clientX,e.clientY);
      overCtrl = !!(el&&el.closest&&el.closest('button,a,input,textarea,select,.seg,.switch,.v16-topbar')); }catch(_){}
    s.el.style.transition='transform .3s cubic-bezier(.22,1,.36,1)';
    if(s.dx > window.innerWidth*0.25 && !overCtrl){
      s.el.style.transform='translateX('+window.innerWidth+'px)';
      setTimeout(()=>{ show('home'); renderHome(); }, 250);
    } else {
      s.el.style.transform='translateX(0)';
    }
  });
}

/* ---------- 启动 ---------- */
async function boot(){
  buildRoot();
  /* 从 prefs 读主题（而非从 DOM dataset 读），保证重启后主题持久化 */
  const savedTheme = (typeof prefs!=='undefined' && prefs.theme) ? prefs.theme : 'auto';
  const effTheme = savedTheme==='auto'
    ? (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : savedTheme;
  applyTheme(effTheme);
  /* 跟随系统时监听系统主题变化（v16 applyTheme 在 IIFE 内，全局访问不到，此处自注册） */
  if(window.matchMedia){
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', ()=>{
      if((typeof prefs!=='undefined' && prefs.theme)==='auto'){
        applyTheme(window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
      }
    });
  }
  await Vault.init();
  /* 云端/目录整库恢复后的待同步：把已恢复的 Store 落进 vault（先清空避免重复） */
  if(typeof VaultSync!=='undefined' && VaultSync.consumePending && VaultSync.consumePending()){
    toast('正在把恢复的资料写入资料库…');
    try{ await VaultSync.restoreFromStore(); }catch(e){ console.warn('restore sync failed', e); }
  }
  bind();
  renderHome();
}

window.VUI = { boot, show, renderHome, openNote, renderSettings, renderTrash, doSearch,
  applyTheme, toggleTheme, openSheet, toast, get state(){return S;} };
})();
