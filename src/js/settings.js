/* ============ 设置页 ============ */
function sRow(ico,title,sub,right,red,id){
  const tag=id?'button':'div';
  const tail=right===undefined?'<span class="chev">'+I.chev+'</span>':right;
  const icoHtml=red
    ?'<span class="s-ico" style="background:#F7E2E0">'+ico.replace('<svg','<svg style="color:var(--danger)"')+'</span>'
    :'<span class="s-ico">'+ico+'</span>';
  return '<'+tag+' class="set-row"'+(id?' id="'+id+'"':'')+'>'+icoHtml
    +'<span class="s-txt"><b>'+esc(title)+'</b>'+(sub?'<small>'+esc(sub)+'</small>':'')+'</span>'+tail+'</'+tag+'>';
}
function segBtn(t,ico,label){
  return '<button data-t="'+t+'" class="'+(prefs.theme===t?'on':'')+'">'+ico+label+'</button>';
}
let _settingsSig='';
/* #15 把每个「分组标题 + 卡片」包成可折叠组，标题可点（chevron 旋转、卡片网格行收起），
   折叠状态记在 prefs.setCollapsed，重建设置页时恢复。 */
function setupSettingsAccordion(){
  const body=$('#settingsBody');if(!body)return;
  const collapsed=new Set(prefs.setCollapsed||[]);
  const children=Array.from(body.children);
  children.forEach(h=>{
    if(!h.classList||!h.classList.contains('set-card-h'))return;
    const card=h.nextElementSibling;
    if(!card||!card.classList.contains('set-card')||h.closest('.set-group'))return;
    const name=h.textContent.trim();
    const g=document.createElement('div');g.className='set-group';g.dataset.name=name;
    const grid=document.createElement('div');grid.className='set-group-card';
    const inner=document.createElement('div');inner.className='set-card-inner';
    body.insertBefore(g,card);
    g.appendChild(h);g.appendChild(grid);grid.appendChild(inner);inner.appendChild(card);
    h.insertAdjacentHTML('beforeend','<span class="set-chev">'+I.chev+'</span>');
    if(collapsed.has(name))g.classList.add('collapsed');
    h.onclick=()=>{
      const isCollapsed=g.classList.toggle('collapsed');
      haptic(6);
      const set=new Set(prefs.setCollapsed||[]);
      if(isCollapsed)set.add(name);else set.delete(name);
      prefs.setCollapsed=Array.from(set);
      persistPrefs();
    };
  });
}
function settingsSig(){
  const trashCount=notes.filter(n=>n.trashed).length,liveCount=notes.filter(n=>!n.trashed).length;
  return JSON.stringify([trashCount,liveCount,prefs.theme,prefs.view,
    curFontName(),prefs.fontScale,panState(),prefs.pan&&prefs.pan.baiduName,
    prefs.lastPanSync,prefs.libName,prefs.ais&&prefs.ais.cur,APP_VERSION]);
}
/* 主题切换专用：只原地更新分段按钮选中态，不重建 settings DOM ——
   避免在触点还按下时移除按钮导致部分 WebView 把焦点/按下态迁移到返回键 */
function patchSettingsTheme(t){
  const seg=$('#themeSeg');
  if(seg)seg.querySelectorAll('button').forEach(b=>b.classList.toggle('on',b.dataset.t===t));
  _settingsSig=settingsSig();
}
function renderSettings(){
  const trashCount=notes.filter(n=>n.trashed).length,liveCount=notes.filter(n=>!n.trashed).length;
  /* 状态签名：覆盖设置页所有动态显示值；未变则保留现有 DOM 与绑定，省重复重建 */
  const sig=settingsSig();
  if(sig===_settingsSig)return;_settingsSig=sig;
  let html='<div class="set-card-h">外观</div><div class="set-card appearance"><div class="seg" id="themeSeg">'
    +segBtn('light',I.sun,'浅色')+segBtn('dark',I.moon,'深色')+segBtn('auto',I.auto,'跟随系统')
    +'</div><div class="seg" id="viewSeg">'
    +'<button data-t="grid" class="'+(prefs.view==='grid'?'on':'')+'">'+I.grid+'网格</button>'
    +'<button data-t="list" class="'+(prefs.view==='list'?'on':'')+'">'+I.list+'列表</button>'
    +'</div>'
    +'<button class="set-row" id="fontRow" style="width:100%"><span class="s-ico">'+I.font+
      '</span><span class="s-txt"><b>显示字体</b><small>'+esc(curFontName())+'</small></span><span class="chev">'+I.chev+'</span></button>'
    +'<button class="set-row" id="fontSizeRow" style="width:100%"><span class="s-ico">'+I.font+
      '</span><span class="s-txt"><b>字体大小</b><small>'+Math.round((prefs.fontScale||1)*100)+'%</small></span><span class="chev">'+I.chev+'</span></button>'
    +'</div>'
    +'<div class="set-card-h">云与目录</div><div class="set-card">'
    +sRow(I.cloud,'百度网盘',panState()===2?(prefs.pan.baiduName||'已连接'):'未连接',undefined,panState()===2,'panEntry')
    +sRow(I.auto,'立即同步（上传）',prefs.lastPanSync?('上次 '+fmtDate(prefs.lastPanSync)):'上传本机变更到网盘',undefined,false,'cloudSyncRow')
    +sRow(I.cloud,'从云端恢复','用网盘备份覆盖本机内容',undefined,false,'cloudPullRow')
    +sRow(I.folder,'绑定资料库目录',prefs.libName?('当前：'+prefs.libName):'选择文件夹实时保存、可整体迁移',undefined,false,'bindRow')
    +sRow(I.auto,'同步到目录','把当前数据写入已绑定文件夹',undefined,false,'syncRow')
    +sRow(I.folder,'从资料库文件夹恢复','选择其他设备的资料库文件夹导入',undefined,false,'openRow')
    +'</div>'
    +'<div class="set-card-h">数据导入 / 导出</div><div class="set-card">'
    +sRow(I.up,'导入数据','自动识别 知识库包 / 备份 zip / JSON / 切片 JSONL',undefined,false,'importUnifiedRow')
    +sRow(I.down,'导出完整备份包','原文+附件+切片，跨设备完整还原',undefined,false,'kbExportRow')
    +sRow(I.note,'导出知识切片 JSONL','按段落切片+溯源，喂向量库',undefined,false,'ragJsonlRow')
    +sRow(I.note,'导出知识库 Markdown','整库成文，可直接喂 AI',undefined,false,'ragMdRow')
    +sRow(I.down,'导出 JSON','仅文字结构，不含附件',undefined,false,'exportRow')
    +sRow(I.trash,'回收站',trashCount?trashCount+' 张待清理':'空',undefined,false,'trashEntry')
    +'</div>'
    +'<div class="set-card-h">AI 知识库</div><div class="set-card">'
    +sRow(I.cloud,'AI 服务与模型配置','OpenAI 兼容，多套可切换、可测连通',undefined,!!(prefs.ais&&prefs.ais.cur),'aiCfgRow')
    +sRow(I.note,'构建 / 更新知识切片','未变化自动跳过；可切后台续切',undefined,false,'kbBuildRow')
    +'</div>'
    +'<div class="set-card-h">应用</div><div class="set-card">'
    +sRow(I.install,'安装到主屏','像原生应用一样全屏启动',undefined,false,'installRow')
    +sRow('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 13h2M8 17h6"/></svg>','运行日志','操作记录与异常排查',undefined,false,'logEntry')
    +sRow(I.trash,'清空所有便签','共 '+liveCount+' 张，删除后无法恢复',undefined,true,'clearRow')
    +sRow(I.info,'关于纸片','版本 '+APP_VERSION+' · 数据说明',undefined,false,'aboutRow')
    +'</div>'
    +'<p class="about-txt">纸片是纯本地便签：文字、图片与附件都只保存在当前浏览器，不会上传。清理浏览器数据前请先导出备份。</p>';
  $('#settingsBody').innerHTML=html;
  setupSettingsAccordion();

  $('#themeSeg').querySelectorAll('button').forEach(b=>b.onclick=ev=>{
    const rc=b.getBoundingClientRect();
    themeSwitchTo(b.dataset.t,
      ev.clientX||rc.left+rc.width/2,
      ev.clientY||rc.top+rc.height/2);
  });
  $('#viewSeg').querySelectorAll('button').forEach(b=>b.onclick=()=>{
    prefs.view=b.dataset.t;persistPrefs();_renderLimit=RENDER_BATCH;renderSettings();renderNotes();});

  $('#fontRow').onclick=openFontPicker;
  $('#fontSizeRow').onclick=openFontSizeSheet;
  $('#cloudSyncRow').onclick=()=>doCloudSync(true);
  $('#cloudPullRow').onclick=()=>doCloudSync(false);
  $('#panEntry').onclick=()=>go('pan');
  $('#bindRow').onclick=bindFolder;
  $('#openRow').onclick=openFolder;
  $('#syncRow').onclick=syncFolder;
  $('#importUnifiedRow').onclick=unifiedImportEntry;
  $('#kbExportRow').onclick=exportKbPackage;
  $('#ragJsonlRow').onclick=exportRAGJsonl;
  $('#ragMdRow').onclick=exportRAGMarkdown;
  $('#exportRow').onclick=exportData;
  $('#aiCfgRow').onclick=openAiCfg;
  $('#kbBuildRow').onclick=askBuildKnowledge;
  $('#trashEntry').onclick=()=>go('trash');
  $('#installRow').onclick=installApp;
  $('#logEntry').onclick=()=>location.hash='#/log';
  $('#clearRow').onclick=()=>{
    if(!liveCount){toast('已经没有便签了');return;}
    openModal('<h3>清空所有便签？</h3><p>将全部 '+liveCount+' 张便签移入回收站，<b>可在回收站还原或等待 7 天后清除</b>。</p>'
      +'<div class="modal-actions"><button class="btn-ghost" data-close>取消</button><button class="btn-danger" id="ao2">全部移入回收站</button></div>');
    $('#ao2').onclick=()=>{
      const ids=notes.filter(n=>!n.trashed).map(n=>n.id);
      closeModal();renderSettings();
      moveToTrash(ids);
    };
  };
  $('#aboutRow').onclick=()=>openModal(
    '<h3>关于纸片</h3><p><b>纸片 · 便签 3.0</b><br>文字笔记与待办、笔记本分类、富文本、图片与百 MB 附件、内联搜索、回收站、资料库目录与 zip 迁移，并可接入百度网盘。</p><p>所有数据仅存于本机，不经过任何服务器。</p>'
    +'<div class="modal-actions"><button class="btn-primary" data-close>知道了</button></div>');
}
/* ============ 新建 ============ */
function createNote(type){
  const n={id:uid(),type,pinned:false,trashed:false,trashedAt:null,files:[],
    title:'',content:'',
    todos:type==='todo'?[{id:uid(),text:'',done:false,priority:'normal'}]:[],
    color:type==='todo'?'green':'yellow',createdAt:Date.now(),updatedAt:Date.now()};
  n._pristine=true;
  notes.push(n);
  if(IS_DESKTOP){persist();deskOpenNote(n.id);}
  else go('edit','id='+n.id);
}

/* ============ PWA 安装 ============ */
let deferredPrompt=null;
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;});
window.addEventListener('appinstalled',()=>{deferredPrompt=null;toast('已安装，感谢使用纸片');});
function roundRect(ctx,x,y,w,h,r){
  ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);
  ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();}
function makeIconPNG(){
  return new Promise(res=>{
    const cv=document.createElement('canvas');cv.width=cv.height=512,ctx=cv.getContext('2d');
    ctx.fillStyle='#D29E14';ctx.fillRect(0,0,512,512);
    ctx.fillStyle='#FFE27A';roundRect(ctx,118,86,276,340,30);ctx.fill();
    ctx.strokeStyle='#232824';ctx.lineWidth=15;ctx.lineCap='round';
    ctx.beginPath();ctx.moveTo(170,184).lineTo(342,184);
    ctx.moveTo(170,256).lineTo(342,256);ctx.moveTo(170,328).lineTo(282,328);ctx.stroke();
    cv.toBlob(b=>res(URL.createObjectURL(b)),'image/png');
  });
}
async function setupManifest(){
  try{
    const icon=await makeIconPNG();
    const m={name:'纸片 · 便签',short_name:'纸片',description:'安静的本地便签应用',
      start_url:'.',scope:'.',display:'standalone',orientation:'portrait',
      background_color:'#ECEAE2',theme_color:'#D29E14',
      icons:[{src:icon,sizes:'512x512',type:'image/png',purpose:'any maskable'}]};
    const url=URL.createObjectURL(new Blob([JSON.stringify(m)],{type:'application/manifest+json'}));
    const link=document.createElement('link');link.rel='manifest';link.href=url;
    document.head.appendChild(link);
  }catch(e){}
}
function isStandalone(){
  return (window.matchMedia&&window.matchMedia('(display-mode: standalone)').matches)||window.navigator.standalone;
}
function installApp(){
  if(isStandalone()){toast('已经在独立窗口中运行');return;}
  if(deferredPrompt){deferredPrompt.prompt();
    deferredPrompt.userChoice.finally(()=>{deferredPrompt=null;});return;}
  const isIOS=/iphone|ipad|ipod/i.test(navigator.userAgent);
  let p;
  if(location.protocol==='file:')
    p='当前是本地文件打开；安装功能需要把应用发布为 https 网页链接后访问使用。';
  else if(isIOS)
    p='请用 Safari 打开本页，点击底部「分享」，选择「添加到主屏幕」。';
  else
    p='点击地址栏右侧的安装图标，或在浏览器菜单中选择「安装应用 / 添加到主屏幕」，Chrome、Edge 效果最佳。';
  openModal('<h3>安装纸片</h3><p>'+p+'</p><p>安装后可全屏、离线启动，与原生应用一致。</p>'
    +'<div class="modal-actions"><button class="btn-primary" data-close>知道了</button></div>');
}
