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
const APP_VERSION = '16.0.0-beta.2';
/* M2 起默认用真实 Vault（window.Vault）；USE_MOCK=true 时回退 mock 走查 */
const USE_MOCK = false;
const Vault = USE_MOCK ? MockVault : window.Vault;

/* ---------- 工具 ---------- */
const fmtDate = (ts)=>{ const d=new Date(ts); const p=n=>String(n).padStart(2,'0');
  return (d.getMonth()+1)+'月'+d.getDate()+'日'; };
function toast(msg){
  const t = root.querySelector('.v16-toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(t._h); t._h = setTimeout(()=>t.classList.remove('show'), 1800);
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
    card.onclick = ()=>{ S.curFolder = card.dataset.folder; renderHome(); };
    bindLongPress(card, ()=>{ openSheet('文件夹操作', [
      {icon:I.move, label:'重命名', fn:()=>toast('重命名 · v16 后续里程碑接入')},
      {icon:I.trash, label:'删除', fn:()=>toast('删除 · v16 后续里程碑接入')}
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
  if(!S.selecting) $('#v16Selbar').classList.remove('open');
}
function cssesc(s){ return s.replace(/"/g,'\\"'); }

function bindLongPress(el, fn){
  let t=null;
  el.addEventListener('touchstart', ()=>{ t=setTimeout(fn, 520); }, {passive:true});
  ['touchend','touchmove'].forEach(ev=>el.addEventListener(ev, ()=>clearTimeout(t), {passive:true}));
  el.addEventListener('mousedown', ()=>{ t=setTimeout(fn, 520); });
  el.addEventListener('mouseup', ()=>clearTimeout(t));
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
  const todos = div.querySelectorAll('.md-todo');
  if(todos.length){
    const ul = document.createElement('ul');
    ul.className = 'v16-ed-todoul';
    todos.forEach(t=>{
      const li = document.createElement('li');
      const input = document.createElement('input');
      input.type='checkbox';
      if(t.dataset.done==='1') input.checked=true;
      input.className='v16-ed-todoinput';
      const txt = t.querySelector('.md-todo-text');
      li.appendChild(input);
      li.appendChild(document.createTextNode(' '));
      if(txt) li.appendChild(txt);
      ul.appendChild(li);
    });
    todos[0].parentNode.insertBefore(ul, todos[0]);
    todos.forEach(t=>t.remove());
  }
  return div.innerHTML;
}
/* 序列化当前 contenteditable → md 字符串（保留 frontmatter） */
function serializeWYSIWIG(){
  const ed = document.getElementById('v16EdBody');
  if(!ed || !S._cur) return null;
  /* 把临时 objectURL 替换为相对路径，便于 htmlToMD 序列化 */
  const imgs = ed.querySelectorAll('img');
  const restore = [];
  imgs.forEach(im=>{
    const rel = im.dataset.relpath;
    if(rel){ restore.push([im, im.src]); im.src = rel; }
  });
  const bodyMD = MD.htmlToMD(ed.innerHTML);
  restore.forEach(([im, src])=> im.src = src);
  const parsed = MD.parseFrontmatter(S._cur.md);
  const fm = parsed.fm || {};
  if(!fm.type) fm.type = e_type(S._cur);
  const clean = {};
  Object.keys(fm).forEach(k=>{ if(fm[k]!=null && fm[k]!=='') clean[k]=fm[k]; });
  return MD.stringifyFrontmatter(clean) + bodyMD;
}
/* 选图 → VaultFS.writeAttachment 落盘 → 插入 contenteditable */
async function pickWYSIWYGImage(){
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
function e_type(data){
  const ed = document.getElementById('v16EdBody');
  if(ed && ed.querySelector('input[type="checkbox"]')) return 'todo';
  return (data.entry && data.entry.type) || 'note';
}
let _wysiwygTimer=null;
function scheduleWYSIWIGSave(){
  clearTimeout(_wysiwygTimer);
  _wysiwygTimer = setTimeout(async ()=>{
    const newMd = serializeWYSIWIG();
    if(!newMd || !S._cur) return;
    try{
      await Vault.save(S._cur.entry.path, newMd);
      S._cur.md = newMd;
      S._cur.html = MD.toHTML(newMd);
      S._cur.entry = (await Vault.get(S._cur.entry.path)).entry;
    }catch(e){ console.warn('wysiwyg save failed', e); }
  }, 500);
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
    ed.oninput = ()=> scheduleWYSIWIGSave();
    /* 勾选 input：同步 checked attribute（htmlToMD 读 attribute） */
    ed.onclick = (ev)=>{
      if(ev.target && ev.target.classList && ev.target.classList.contains('v16-ed-todoinput')){
        if(ev.target.checked) ev.target.setAttribute('checked','checked');
        else ev.target.removeAttribute('checked');
      }
      /* 点击图片：打开大图查看器 */
      if(ev.target && ev.target.tagName==='IMG'){
        const src = ev.target.getAttribute('data-relpath') || ev.target.getAttribute('src')||'';
        if(src){ $('#v16Img').src = src; $('#v16ImgViewer').classList.add('open'); }
      }
    };
  }

  /* 标题联动文件名（防抖 600ms 调 Vault.rename） */
  let titleTimer=null;
  $('#v16EdTitle').oninput = (ev)=>{
    clearTimeout(titleTimer);
    const newTitle = ev.target.value.trim() || '未命名';
    titleTimer = setTimeout(async ()=>{
      if(newTitle === e.title) return;
      try{
        const newPath = await Vault.rename(e.path, newTitle);
        if(newPath !== e.path){
          S.curNote = newPath; e.path = newPath; e.title = newTitle;
          S._cur = await Vault.get(newPath);
          renderCrumbs();
          toast('已重命名为「'+newTitle+'」');
        }
      }catch(err){ console.warn('rename failed', err); }
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
      <div class="v16-row" data-row="newvault"><span class="rl">新建 / 切换资料库</span>${I.export.replace('stic','rgo')}</div>
      <div class="v16-row" data-row="export"><span class="rl">导出资料库（zip）</span>${I.export.replace('stic','rgo')}</div>
      <div class="v16-row hl" data-row="migrate"><span class="rl">检测到旧库 library.json</span><span class="rv" style="color:#A04438;font-weight:700">迁移旧库 →</span></div>
    `)
    + g('g-edit','编辑',I.edit, `
      <div class="v16-row" data-row="attachloc"><span class="rl">默认附件位置</span><span class="rv">attachments/</span></div>
      <div class="v16-row" data-row="newloc"><span class="rl">新建文件默认位置</span><span class="rv">当前目录</span></div>
      <div class="v16-row" data-row="hlsyn"><span class="rl">==高亮== 语法</span><span class="v16-switch on" data-sw></span></div>
      <div class="v16-row" data-row="wiki"><span class="rl">[[wiki]] 双链</span><span class="v16-switch on" data-sw></span></div>
      <div class="v16-row" data-row="newtype"><span class="rl">默认新建类型</span><span class="rv">笔记</span></div>
    `)
    + g('g-app','显示与主题',I.export.replace('stic','stic'), `
      <div class="v16-row" data-row="font"><span class="rl">显示字体</span><span class="rv">默认</span></div>
      <div class="v16-row" data-row="fontscale"><span class="rl">字号刻度尺</span><span class="rv">标准</span></div>
      <div class="v16-row" data-row="theme"><span class="rl">主题（${S.theme==='dark'?'深色':'浅色'}）</span><span class="rv">点击切换</span></div>
    `)
    + g('g-more','更多',I.settings, `
      <div class="v16-row" data-row="ai"><span class="rl">AI 服务与模型</span><span class="rv">OpenAI 兼容</span></div>
      <div class="v16-row" data-row="log"><span class="rl">运行日志</span>${I.export.replace('stic','rgo')}</div>
      <div class="v16-row" data-row="about"><span class="rl">关于</span><span class="rv">v${APP_VERSION}</span></div>
      <div class="v16-row"><span class="rl">纯本地隐私</span><span class="rv">数据不出设备</span></div>
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
      if(a==='theme'){ toggleTheme(true); }
      else if(a==='migrate'){
        if(typeof Migrate!=='undefined' && Migrate && Migrate.run){
          Migrate.run({onProgress:m=>toast(String(m))}).then(()=>toast('迁移完成')).catch(e=>toast('迁移失败'));
        } else toast('迁移旧库 · M4 接入');
      }
      else if(a==='about'){ toast('纸片 v'+APP_VERSION); }
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
      if(b.dataset.action==='restore'){ await Vault.restore(b.dataset.path); toast('已恢复'); }
      else { await Vault.deleteForever(b.dataset.path); toast('已彻底删除'); }
      renderTrash();
    };
  });
}

/* ---------- 底部 sheet ---------- */
function openSheet(title, opts){
  $('#v16SheetTitle').textContent = title;
  $('#v16SheetOpts').innerHTML = opts.map((o,i)=>`<div class="v16-sheet-opt" data-i="${i}">${o.icon}${esc(o.label)}</div>`).join('');
  $('#v16SheetOpts').querySelectorAll('.v16-sheet-opt').forEach(el=>{
    el.onclick = ()=>{ closeSheet(); opts[Number(el.dataset.i)].fn(); };
  });
  $('#v16SheetMask').classList.add('open'); $('#v16Sheet').classList.add('open');
}
function closeSheet(){ $('#v16SheetMask').classList.remove('open'); $('#v16Sheet').classList.remove('open'); }

/* ---------- 主题圆形扩散（双图层） ---------- */
function applyTheme(t){
  S.theme = t;
  document.documentElement.dataset.theme = t;
  if(root) root.style.background = (t==='dark') ? '#18191C' : '#ECEAE2';
}
function toggleTheme(animate){
  const next = S.theme==='dark' ? 'light' : 'dark';
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

/* ---------- 事件绑定 ---------- */
function bind(){
  $('#v16Menu').onclick = openDrawer;
  $('#v16DrawerMask').onclick = closeDrawer;
  $('#v16DrawerClose').onclick = closeDrawer;
  $('#v16SearchBtn').onclick = ()=>{ show('search'); setTimeout(()=>$('#v16SrInput').focus(), 300); };
  $('#v16More').onclick = ()=>openSheet('更多', [
    {icon:I.export, label:'导入文件', fn:()=>toast('导入文件 · M4 接入')},
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
  fab.onclick = ()=>{ if(S.fabOpen){ menu.classList.remove('open'); fab.classList.remove('open'); S.fabOpen=false; } };
  bindLongPress(fab, ()=>{ S.fabOpen=true; menu.classList.add('open'); fab.classList.add('open'); });
  menu.querySelectorAll('.v16-fab-item').forEach(it=>{
    it.onclick = async ()=>{
      menu.classList.remove('open'); fab.classList.remove('open'); S.fabOpen=false;
      try{
        if(it.dataset.f==='note'){
          const path = await Vault.create({ title:'未命名', folder:S.curFolder, type:'note' });
          await renderHome();
          await openNote(path);
        } else if(it.dataset.f==='folder'){
          /* 新建文件夹：先在当前目录建一个"新文件夹" */
          const nm = '新文件夹';
          const path = await Vault.createFolder ? await Vault.createFolder(S.curFolder, nm) : null;
          toast('已新建文件夹'); renderHome();
        } else toast('导入文件 · M4 接入');
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
    {icon:I.move, label:'移动到…', fn:()=>toast('移动到… · M2 接入')},
    {icon:I.trash, label:'删除（回收站）', fn:async()=>{ if(S._cur){ await Vault.remove(S._cur.entry.path); toast('已移入回收站'); show('home'); renderHome(); } }},
    {icon:I.pin, label:'置顶/取消', fn:async()=>{ if(S._cur){ await Vault.setPin(S._cur.entry.path, !S._cur.entry.pinned); toast('已更新'); } }}
  ]);
  /* 底部工具栏：WYSIWYG 格式化 */
  $('#v16Dock').querySelectorAll('button').forEach(b=>{
    b.onclick = async ()=>{
      const ed = $('#v16EdBody');
      if(!ed){ toast('请先打开笔记'); return; }
      ed.focus();
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
          const url = prompt('链接地址（https://…）');
          if(url) document.execCommand('createLink', false, url);
        }
        else if(t==='todo'){
          /* 插入一个可勾选 li */
          document.execCommand('insertHTML', false,
            '<ul><li><input type="checkbox" class="v16-ed-todoinput"> </li></ul><p><br></p>');
        }
        else if(t==='image'){
          await pickWYSIWYGImage();
        }
        scheduleWYSIWIGSave();
      }catch(e){ console.warn('toolbar exec', e); }
    };
  });
  /* 搜索 */
  $('#v16SrBack').onclick = ()=>show('home');
  $('#v16SrInput').addEventListener('input', doSearch);
  /* 回收站 */
  $('#v16TrashBack').onclick = ()=>show('home');
  $('#v16TrashEmpty').onclick = ()=>toast('清空回收站 · 后续接入');
  /* 设置 */
  $('#v16SetBack').onclick = ()=>show('home');
  /* sheet */
  $('#v16SheetMask').onclick = closeSheet;
  $('#v16SheetCancel').onclick = closeSheet;
  /* 图片查看器 */
  $('#v16ImgClose').onclick = ()=>$('#v16ImgViewer').classList.remove('open');
  $('#v16ImgViewer').onclick = (e)=>{ if(e.target.id==='v16ImgViewer') e.currentTarget.classList.remove('open'); };
  /* 抽屉新建文件夹 */
  $('#v16DrawerNew').onclick = async ()=>{
    try{ await Vault.createFolder(S.curFolder, '新文件夹'); toast('已新建文件夹'); renderDrawer(); renderHome(); }
    catch(e){ console.warn(e); toast('新建文件夹失败'); }
  };
  /* 多选操作条：批量删除真实，其余单篇操作已在编辑器更多里支持 */
  $('#v16Selbar').querySelectorAll('button').forEach(b=>{
    b.onclick = async ()=>{
      const action = b.dataset.a;
      const paths = Array.from(S.selected);
      if(action==='del'){
        for(const p of paths){ try{ await Vault.remove(p); }catch(e){} }
        toast('已移入回收站');
      } else if(action==='pin'){
        for(const p of paths){ try{ await Vault.setPin(p, true); }catch(e){} }
        toast('已置顶');
      } else if(action==='color'){
        toast('批量颜色 · 单篇可在编辑器里设置');
      } else if(action==='move'){
        toast('批量移动 · 单篇可在编辑器"移动到…"');
      }
      S.selecting=false; S.selected=new Set(); renderHome();
    };
  });
}

/* ---------- 启动 ---------- */
async function boot(){
  buildRoot();
  applyTheme(document.documentElement.dataset.theme==='dark' ? 'dark' : 'light');
  await Vault.init();
  bind();
  renderHome();
}

window.VUI = { boot, show, renderHome, openNote, renderSettings, renderTrash, doSearch,
  applyTheme, toggleTheme, openSheet, toast, get state(){return S;} };
})();
