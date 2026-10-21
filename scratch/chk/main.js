(function(){
/* ============ 导入 / 导出 ============ */
async function exportData(){
  const data=JSON.stringify({app:'zhipian-notes',version:3,
    exportedAt:new Date().toISOString(),notes,prefs},null,2);
  const d=new Date(),p=n=>String(n).padStart(2,'0');
  const name='纸片便签-'+d.getFullYear()+p(d.getMonth()+1)+p(d.getDate())+'.json';
  try{const pt=await exportArtifact('JSON',name,'application/json',data);
    exportToast(pt,name);
  }catch(e){toast((e&&e.message)||'导出失败');}
}
/* ============ 全局事件 ============ */
$('#openSettings').onclick=()=>go('settings');
$('#fab').onclick=()=>createNote('note');
$('#mask').onclick=()=>{closeActionSheet();};
$('#dynCancel').onclick=closeActionSheet;
/* 统一浮层关闭（供 Android 返回键调用）：有浮层则关闭并返回 true，否则 false */
window.__dismissOverlay=function(){
  /* #11 大图查看器层级最高，系统返回优先关闭它 */
  if(document.querySelector('.img-viewer.show')){closeImgViewer();return true;}
  if($('#noteAiPanel').classList.contains('open')){closeNoteAi();return true;}
  if($('#chatDrawer').classList.contains('open')){closeChatDrawer();return true;}
  if($('#nbPicker').classList.contains('open')){closeNotebookPicker();return true;}
  /* #10 笔记本联想浮层 */
  if(nbSugVisible()){closeNbSuggest();return true;}
  /* #11 图片工具条 */
  if($('#imgBar')&&$('#imgBar').style.display==='flex'){hideImgBar();return true;}
  if($('#mask').classList.contains('show')){closeActionSheet();return true;}
  if($('#modal').classList.contains('show')){closeModal();return true;}
  return false;
};
$('#settingsBack').onclick=()=>go('home');
$('#panBack').onclick=()=>go('settings');
bindEditChrome();
document.addEventListener('selectionchange',()=>{
  if(!$('#scr-edit').classList.contains('active'))return;
  syncPrState();
});
/* 仅在正文 contenteditable 内屏蔽系统选择菜单；输入框保留长按粘贴 */
function setNativeMenuSuppressed(on){
  if(hasNative())Native.call('setMenuSuppressed',on?'1':'0').catch(()=>{});
}
(function(){
  const pb=$('#paperBody');
  pb.addEventListener('focus',()=>setNativeMenuSuppressed(true));
  pb.addEventListener('blur',()=>setNativeMenuSuppressed(false));
})();
if(window.visualViewport){
  const reposition=()=>{if($('#paperRtBar').classList.contains('show'))syncPrState();};
  window.visualViewport.addEventListener('resize',reposition);
  window.visualViewport.addEventListener('scroll',reposition);
}
window.addEventListener('scroll',()=>{
  if($('#scr-edit').classList.contains('active')&&$('#paperRtBar').classList.contains('show'))syncPrState();
  if(nbSugVisible()){
    /* 正文滚动时浮层跟随光标重定位；读不到触发位置就收起 */
    try{positionNbSuggest();}catch(_){closeNbSuggest();}
  }
},{passive:true});
$('#modal').addEventListener('click',e=>{if(e.target.id==='modal')closeModal();});

/* 切后台 / 关闭页面 / 退出应用时立即保存 */
document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState==='hidden')flushDisk();
});
window.addEventListener('pagehide',()=>flushDisk());
window.addEventListener('beforeunload',()=>flushDisk());
/* 硬件键盘撤销 / 重做 */
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){
    if($('#nbPicker').classList.contains('open')){closeNotebookPicker();return;}
    if($('#mask').classList.contains('show')){closeActionSheet();return;}}
  if(!(e.ctrlKey||e.metaKey))return;
  const k=e.key.toLowerCase();
  if(k==='z'){e.preventDefault();if(e.shiftKey)redo();else undo();}
  else if(k==='y'){e.preventDefault();redo();}
});

/* 首页头部：下滑收起、回滑展开 */
function setupHomeCollapse(){
  const home=$('#scr-home');const sc=home.querySelector('.screen-body');
  if(!sc||sc.__hc)return;sc.__hc=true;let last=0;
  sc.addEventListener('scroll',()=>{
    const st=sc.scrollTop,d=st-last;
    if(st<=4)home.classList.remove('head-collapsed');
    else if(!selectMode&&d>6&&st>34)home.classList.add('head-collapsed');
    else if(d<-8)home.classList.remove('head-collapsed');
    last=st;
  },{passive:true});
}

/* ============ 启动 ============ */
/* ============================================================
   桌面端（Electron）三栏交互（仅 IS_DESKTOP 启用）
   ============================================================ */
let _deskQuery='';
const _D_ICON={
  logo:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3v4a1 1 0 0 0 1 1h4"/><path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2Z"/></svg>',
  plus:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  note:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2"/><path d="M4 7v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7"/><path d="M8 11h8M8 15h5"/></svg>',
  chat:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3l1.7 4.6L18 9.3l-4.3 1.7L12 15.6l-1.7-4.6L6 9.3l4.3-1.7z"/></svg>',
  trash:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>',
  set:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82 2 2 0 1 1-2.83 2.83 1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33 2 2 0 1 1-2.83-2.83 1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82 2 2 0 1 1 2.83-2.83 1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33 2 2 0 1 1 2.83 2.83 1.65 1.65 0 0 0-.33 1.82 1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
  folder:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.7-.9L9.3 3.6A2 2 0 0 0 7.6 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2z"/></svg>'
};
function refreshDeskSidebar(){
  const aside=$('#deskSidebar');if(!aside)return;
  const counts=nbCounts();
  const names=[];
  (prefs.notebooks||[]).forEach(x=>{if(x&&!names.includes(x))names.push(x);});
  Object.keys(counts).forEach(x=>{if(!names.includes(x))names.push(x);});
  const cur=prefs.nbFilter||null;
  const navItem=(act,svg,label,n,on)=>
    '<button class="desk-item '+(on?'on':'')+'" data-act="'+act+'">'+svg
    +'<span>'+esc(label)+'</span>'+(n!=null?'<span class="n">'+n+'</span>':'')+'</button>';
  const nbItem=nm=>
    '<button class="desk-item '+(cur===nm?'on':'')+'" data-nb="'+esc(nm)+'">'+_D_ICON.folder
    +'<span>'+esc(nm)+'</span><span class="n">'+(counts[nm]||0)+'</span></button>';
  aside.innerHTML=
    '<div class="desk-logo"><span class="dl-ico">'+_D_ICON.logo+'</span><b>纸片</b></div>'
   +'<button class="desk-new" id="deskNewTop">'+_D_ICON.plus+'新建便签</button>'
   +'<div class="desk-group-t">导航</div><div class="desk-nav">'
   + navItem('home',_D_ICON.note,'便签',notes.filter(n=>!n.trashed).length,cur===null)
   + navItem('chat',_D_ICON.chat,'AI 对话',null,false)
   + navItem('trash',_D_ICON.trash,'回收站',notes.filter(n=>n.trashed).length,false)
   + navItem('settings',_D_ICON.set,'设置',null,false)
   +'</div><div class="desk-group-t">笔记本</div>'
   +'<div class="desk-scroll"><div class="desk-nav">'
   + names.map(nbItem).join('')
   + '<button class="desk-item" data-act="addnb">'+_D_ICON.plus+'<span>新建笔记本</span></button>'
   +'</div></div>';
  $('#deskNewTop').onclick=()=>deskNewNote();
  aside.querySelectorAll('[data-act]').forEach(b=>b.onclick=()=>{
    switch(b.dataset.act){
      case 'home':deskGoHome();break; case 'chat':go('chat');break;
      case 'trash':go('trash');break; case 'settings':go('settings');break;
      case 'addnb':createNotebook();break;
    }});
  aside.querySelectorAll('[data-nb]').forEach(b=>b.onclick=()=>setNbFilter(b.dataset.nb));
}
function buildDeskSidebar(){
  if($('#deskSidebar'))return;
  const a=document.createElement('aside');a.id='deskSidebar';
  $('#app').insertBefore(a,$('#app').firstChild);
  refreshDeskSidebar();
}
function deskGoHome(){
  if(prefs.nbFilter)setNbFilter(null);
  if(location.hash==='#/home')deskShowScreen('home');
  else location.hash='#/home';
}
function deskMarkCurrent(id){
  document.querySelectorAll('#notesWrap .note-card').forEach(c=>
    c.classList.toggle('current',c.dataset.id===id));
}
function deskUpdateCard(id){
  const n=notes.find(x=>x.id===id);
  const old=document.querySelector('#notesWrap .note-card[data-id="'+id+'"]');
  if(!n||!old)return;
  const tmp=document.createElement('div');tmp.innerHTML=cardHTML(n);
  const ne=tmp.firstElementChild;ne.style.animation='none';old.replaceWith(ne);
}
function deskOpenNote(id){
  if(editingId&&editingId!==id){try{commitEditor();}catch(e){}deskUpdateCard(editingId);}
  editingId=id;
  $('#app').classList.remove('desk-empty');
  const e=$('#scr-edit');e.classList.remove('hide-instant');e.classList.add('active');
  $('#scr-home').classList.add('active');
  renderEditor();deskMarkCurrent(id);
}
function deskNewNote(type){
  const t=type||'note';
  const n={id:uid(),type:t,pinned:false,trashed:false,trashedAt:null,files:[],
    title:'',content:'',
    todos:t==='todo'?[{id:uid(),text:'',done:false,priority:'normal'}]:[],
    color:t==='todo'?'green':'yellow',createdAt:Date.now(),updatedAt:Date.now()};
  n._pristine=true;
  notes.push(n);persist();deskOpenNote(n.id);
  setTimeout(()=>{const tt=$('#paperTitle');if(tt)tt.focus();},120);
}
function deskBindSearch(){
  const inp=$('#homeSearch');inp.removeAttribute('readonly');
  inp.addEventListener('input',()=>{
    _deskQuery=inp.value.trim();
    $('#miniClear').hidden=!_deskQuery;renderNotes(true);});
  $('#miniClear').addEventListener('click',()=>{
    inp.value='';_deskQuery='';$('#miniClear').hidden=true;renderNotes(true);inp.focus();});
}
function deskBindKeys(){
  window.addEventListener('keydown',e=>{
    const mod=e.ctrlKey||e.metaKey,k=e.key.toLowerCase();
    if(mod&&k==='n'){e.preventDefault();deskNewNote();}
    else if(mod&&k==='f'){e.preventDefault();
      const i=$('#homeSearch');i.focus();i.select();}
    else if(mod&&k==='s'){e.preventDefault();flushDisk();}
    else if(mod&&['b','i','u'].includes(k)){
      const ae=document.activeElement;
      if(ae&&ae.id==='paperBody'){e.preventDefault();
        document.execCommand({b:'bold',i:'italic',u:'underline'}[k]);}}
  });
}
function deskBindEmpty(){
  $('#app').classList.add('desk-empty');
  $('#deskEmptyNew').onclick=()=>deskNewNote();
}
function deskShowScreen(name){
  if(name==='home'||name==='edit'){
    $$('.screen').forEach(s=>{
      if(s.id==='scr-home'||s.id==='scr-edit')s.classList.add('active');
      else s.classList.remove('active');});
  }else{
    $$('.screen').forEach(s=>s.classList.remove('active'));
    const t=$('#scr-'+name);if(t)t.classList.add('active');
  }
  $('#fab').style.visibility='hidden';
  if(editingId)deskMarkCurrent(editingId);
}
function deskInit(){
  buildDeskSidebar();deskBindSearch();deskBindKeys();deskBindEmpty();
  $$('.screen').forEach(s=>{
    if(s.id==='scr-home'||s.id==='scr-edit')s.classList.add('active');});
}

async function boot(){
  await Store.init();
  Logs.load();
  migrateAiConfig();
  Logs.info('启动','应用启动，存储环境：'+Store.env);
  await KB.init().catch(()=>{});
  if(Store.env==='idb')dirHandle=await idbGet('dirHandle').catch(()=>null);
  if(Store.env==='native'){
    try{
      const pa=await Native.call('takePendingAuth');
      if(pa&&(pa.access_token||pa.token))panApplyToken(pa);
    }catch(e){}
    try{
      const pe=await Native.call('takePendingAuthError');
      if(pe)toast(pe);
    }catch(e){}
  }
  await runImageMigration().catch(()=>{});
  /* 附件位置索引一致性自愈（换机/恢复后补标记、清孤儿） */
  let afAdd=0,afRm=0;
  notes.forEach(n=>{const r=fixAttachRefs(n);afAdd+=r.added;afRm+=r.removed;});
  if(afAdd||afRm){flushDisk();Logs.info('存储','附件位置索引自愈 补'+afAdd+' 清'+afRm);}
  if(Store.env==='native'){
    try{const g=await Native.call('gcFiles');if(g&&g.removed>0)Logs.info('存储','启动清理孤儿附件 '+g.removed+' 个');}catch(e){}
  }
  applyTheme();applyFont(prefs.font);applyFontScale();setupManifest();initImgBar();
  setupHomeCollapse();setupNotesDelegation();initEdgeBack();setupRubber();
  if(IS_DESKTOP)deskInit();
  if(!location.hash)location.hash='#/home';else route();
}
window.__app={get notes(){return notes;},get prefs(){return prefs;},cur:cur,
 Store:Store,uid:uid,fileKind:fileKind,touch:touch,
 renderPaperAttach:renderPaperAttach,
 setEditing:function(id){editingId=id;},
  renderNotes:renderNotes,renderChips:renderChips,renderSettings:renderSettings,
  renderEditor:renderEditor,showScreen:showScreen,syncPrState:syncPrState,
  enterSelect:enterSelect,exitSelect:exitSelect,
  mergeLibIntoMemory:mergeLibIntoMemory,quietMergeFromNative:quietMergeFromNative,
  commitEditor:commitEditor,
 batchMoveToNotebook:batchMoveToNotebook,
 openShareSheet:openShareSheet,openDockAdd:openDockAdd,toast:toast,
  createNote:createNote,pickPaperFile:pickPaperFile,pickPaperImage:pickPaperImage,
  persist:persist,buildExportNode:buildExportNode,
  ensureExportLibs:ensureExportLibs,exportLongImage:exportLongImage,exportPDF:exportPDF,
  applyTheme:applyTheme,
  openFontSizeSheet:openFontSizeSheet,
  addPaperTodo:addPaperTodo,flushDisk:flushDisk,syncProgress:syncProgress,
  finishSyncTopBar:finishSyncTopBar,showSyncOverlay:showSyncOverlay,
  selectionHiliteOn:selectionHiliteOn,toggleHighlight:toggleHighlight,
  prExec:prExec,undo:undo,redo:redo,
  openNotebookPicker:openNotebookPicker,moveToNotebook:moveToNotebook,
  setNbFilter:setNbFilter,visibleNotes:visibleNotes,
  moveToTrash:moveToTrash,renderTrash:renderTrash,go:go,persistPrefs:persistPrefs,
  createNotebook:createNotebook,noteToChunks:noteToChunks,htmlToText:htmlToText,crumbsFor:crumbsFor,liveCrumb:liveCrumb,
  KB:KB,chunkNote:chunkNote,bodyRaw:bodyRaw,buildKnowledgeIndex:buildKnowledgeIndex,
  exportKbPackage:exportKbPackage,
   ensureAllExportMd:ensureAllExportMd,
  TaskUI:TaskUI,attachmentBlob:attachmentBlob,
  initImgBar:initImgBar,
  applyLibrary:applyLibrary,importZipBlob:importZipBlob,
  importJsonText:importJsonText,importJsonlText:importJsonlText,
  unifiedHandleFile:unifiedHandleFile,unifiedImportEntry:unifiedImportEntry,
  knowledgeSearch:knowledgeSearch,runAsk:runAsk,highlightText:highlightText,
  openAiCfg:openAiCfg,
  AIs:AIs,Logs:Logs,testAiConn:testAiConn,renderAiList:renderAiList,
  editAiCfg:editAiCfg,renderLog:renderLog,exportLogs:exportLogs,
  renderSearch:renderSearch,runRag:runRag,runAi:runAi,runSrSubmit:runSrSubmit,
  AIs:AIs,ChatStore:ChatStore,openChatScreen:openChatScreen,renderChatView:renderChatView,
  sendChat:sendChat,openChatDrawer:openChatDrawer,renderChatDrawer:renderChatDrawer,
  startNewChat:startNewChat,get curChatId(){return curChatId;},setCurChatId:function(id){curChatId=id;},
  openNoteAi:openNoteAi,closeNoteAi:closeNoteAi,sendNoteAi:sendNoteAi,noteContextText:noteContextText,
  get srMode(){return srMode;},setSrMode:function(m){srMode=m;},
  removeRecent:removeRecent,clearRecents:clearRecents,renderNormal:renderNormal,
  fileTextFor:fileTextFor,attachmentBlob:attachmentBlob,
  noteVisionImages:noteVisionImages,modelSupportsVision:modelSupportsVision,
  buildAttachmentContext:buildAttachmentContext,
  ParseW:ParseW,parsePdfMain:parsePdfMain,
  ensureAttachmentMd:ensureAttachmentMd,exportAttachmentMd:exportAttachmentMd,
  fileTextToMarkdown:fileTextToMarkdown,
  noteSourceHash:noteSourceHash,importChunksJsonl:importChunksJsonl,
  idbPutBlob:idbPutBlob,idbGetBlob:idbGetBlob,idbDelBlob:idbDelBlob,
  desktopMergeSync:desktopMergeSync,mimeForName:mimeForName,
  bodySegments:bodySegments,fixAttachRefs:fixAttachRefs,
  buildParentChildren:buildParentChildren};

/* ============ 白屏自愈：转场/切后台后强制重建合成层 ============
   部分 Android WebView 在转场或切后台再回来后，硬件加速层纹理丢失，
   DOM/JS 正常但画面空白（露出原生底色）。通过对当前激活页做一次
   无视觉变化的合成层切换，强制 GPU 重新提交纹理。 */
window.__forceRepaint=function(){
  try{
    const el=document.querySelector('.screen.active')||document.querySelector('#app');
    if(!el)return;
    const prev=el.style.transform;
    el.style.transform='translate3d(0,0,0)';   /* 与激活态视觉一致，无位移、无闪烁 */
    void el.offsetHeight;                      /* 强制 reflow，重建该层纹理 */
    requestAnimationFrame(()=>{el.style.transform=prev;});
  }catch(e){}
};
document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState==='visible')window.__forceRepaint();
});
window.addEventListener('pageshow',()=>window.__forceRepaint());

boot().catch(e=>console.warn('boot failed',e));
})();
