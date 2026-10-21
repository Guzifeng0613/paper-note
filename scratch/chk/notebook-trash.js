(function(){
/* ============ 移动到笔记本 ============ */
const NB_COLORS=['#8c8f88','#5b93e8','#e0833a','#5cb87a','#a07cd8','#e0b03a','#e87a8a','#5bb8c4'];
const FOLDER_SVG='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.7-.9L9.3 3.6A2 2 0 0 0 7.6 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2z"/></svg>';
function nbCounts(){
  const m={};
  notes.forEach(n=>{if(!n.trashed&&n.notebook)m[n.notebook]=(m[n.notebook]||0)+1;});
  return m;
}
/* 笔记本颜色按名称稳定（排序变化也不变色） */
function nbColor(nm){let h=0;const s=String(nm);
  for(let i=0;i<s.length;i++)h=(h*31+s.charCodeAt(i))>>>0;
  return NB_COLORS[h%NB_COLORS.length];}
let nbPickerMode='move';
function openNotebookPicker(mode){
  nbPickerMode=(mode==='filter')?'filter':(mode==='batch'?'batch':'move');
  if(nbPickerMode==='move'&&!cur())return;
  $('#nbpTitle').textContent=nbPickerMode==='filter'?'选择笔记本':'移动到笔记本';
  const p=$('#nbPicker');
  renderNotebookList();
  p.classList.add('open');                 // display:flex，transform 仍在 100%
  void p.offsetWidth;                     // 强制 reflow，确立起始态
  requestAnimationFrame(()=>requestAnimationFrame(()=>p.classList.add('show'))); // 下一帧滑入
}
function closeNotebookPicker(){
  const p=$('#nbPicker');
  p.classList.remove('show');             // 滑出
  clearTimeout(p._nbT);p._nbT=setTimeout(()=>p.classList.remove('open'),290); // 动画结束后 display:none
}
function renderNotebookList(){
  const n=cur();
  const counts=nbCounts();
  $('#nbpAllCount').textContent=notes.filter(x=>!x.trashed).length;
  /* 笔记本名：独立列表（含空笔记本）+ 实际有笔记的 */
  let names=[];
  (prefs.notebooks||[]).forEach(x=>{if(!names.includes(x))names.push(x);});
  Object.keys(counts).forEach(x=>{if(!names.includes(x))names.push(x);});
  if(prefs.nbSort==='name')names.sort((a,b)=>a.localeCompare(b,'zh'));
  else names.sort((a,b)=>(counts[b]||0)-(counts[a]||0)||a.localeCompare(b,'zh'));
  const curNB=nbPickerMode==='filter'?prefs.nbFilter
    :(nbPickerMode==='batch'?null:(n?n.notebook:null));
  const list=$('#nbpList');
  if(!names.length){list.innerHTML='<div class="nbp-empty">还没有笔记本，点上方「新建」创建一个。</div>';}
  else{
    list.innerHTML=names.map(nm=>{
      const col=nbColor(nm);
      return '<button class="nbp-row'+(curNB===nm?' iscur':'')+'">'
        +'<span class="nbp-folder" style="color:'+col+'">'+FOLDER_SVG+'</span>'
        +'<span class="nbp-name">'+esc(nm)+'</span>'
        +'<span class="nbp-cur">'+I.check+'</span>'
        +'<span class="nbp-count">'+(counts[nm]||0)+'</span>'
        +'<span class="nbp-manage" role="button" aria-label="管理笔记本">'+I.more+'</span></button>';
    }).join('');
    list.querySelectorAll('.nbp-row').forEach((r,i)=>{
      r.onclick=()=>onNbPick(names[i]);
      const mg=r.querySelector('.nbp-manage');
      mg.onclick=e=>{e.stopPropagation();openNbManage(names[i]);};
    });
  }
  $('#nbpAll').classList.toggle('iscur',!curNB);
}
function onNbPick(nm){
  if(nbPickerMode==='filter')setNbFilter(nm);
  else if(nbPickerMode==='batch')batchMoveToNotebook(nm);
  else moveToNotebook(nm);
}
function setNbFilter(nm){
  const was=prefs.nbFilter||null;
  prefs.nbFilter=nm||null;persistPrefs();_renderLimit=RENDER_BATCH;
  closeNotebookPicker();renderChips();
  if(was!==(nm||null))popSelectedChip();
  renderNotes();
  if(IS_DESKTOP)refreshDeskSidebar();
  toast(nm?'已筛选笔记本「'+nm+'」':'显示全部笔记');
}
async function moveToNotebook(nm){
  const n=cur();if(!n)return;
  n.notebook=nm||null;
  if(nm&&!(prefs.notebooks||[]).includes(nm))
    prefs.notebooks=(prefs.notebooks||[]).concat(nm);
  n.updatedAt=Date.now();
  closeNotebookPicker();
  toast(nm?'已移动到「'+nm+'」':'已移出笔记本');
  await flushDisk();  /* 立即保存并刷新绑定目录镜像（便签/<笔记本>/…），让移动即时可见 */
}
/* 批量移动：多选界面把选中便签统一移动到某笔记本 */
async function batchMoveToNotebook(nm){
  const list=selNotes(),cnt=list.length;
  list.forEach(x=>{x.notebook=nm||null;x.updatedAt=Date.now();});
  if(nm&&!(prefs.notebooks||[]).includes(nm))
    prefs.notebooks=(prefs.notebooks||[]).concat(nm);
  closeNotebookPicker();exitSelect();
  toast(nm?('已移动 '+cnt+' 张到「'+nm+'」'):('已将 '+cnt+' 张移出笔记本'));
  await flushDisk();  /* 批量移动后立即刷新绑定目录镜像 */
}
function createNotebook(){
  openModal('<h3>新建笔记本</h3>'
    +'<p>'+(nbPickerMode==='filter'?'输入名称，创建后按该笔记本筛选。'
      :(nbPickerMode==='batch'?'输入名称，选中的便签会立即移动进去。':'输入名称，当前便签会立即移动进去。'))+'</p>'
    +'<input class="modal-input" id="newNbInput" placeholder="如：旅行、项目A" maxlength="14">'
    +'<div class="modal-actions"><button class="btn-ghost" data-close>取消</button>'
    +'<button class="btn-primary" id="newNbOk">创建并'+(nbPickerMode==='filter'?'筛选':'移动')+'</button></div>');
  const doOk=()=>{
    const v=$('#newNbInput').value.trim().replace(/^#+/,'');
    if(!v){toast('请输入名称');return;}
    closeModal();createAndUseNb(v);
  };
  $('#newNbOk').onclick=doOk;
  $('#newNbInput').addEventListener('keydown',e=>{if(e.key==='Enter')doOk();});
  setTimeout(()=>$('#newNbInput').focus(),120);
}
function createAndUseNb(v){
  if(!(prefs.notebooks||[]).includes(v))
    prefs.notebooks=(prefs.notebooks||[]).concat(v);
  persistPrefs();
  if(nbPickerMode==='filter'){setNbFilter(v);return;}
  if(nbPickerMode==='batch'){batchMoveToNotebook(v);return;}
  const n=cur();
  if(n){n.notebook=v;touch();closeNotebookPicker();
    toast('已移动到「'+v+'」');}
}

/* ============ 笔记本管理：重命名 / 删除 ============ */
function openNbManage(name){
  const cnt=notes.filter(n=>!n.trashed&&n.notebook===name).length;
  openActionSheet([
    {icon:I.edit,label:'重命名',fn:()=>renameNotebook(name)},
    {icon:I.trash,danger:true,
      label:'删除笔记本'+(cnt?' · '+cnt+' 张便签移到「全部」':''),
      fn:()=>askDeleteNotebook(name)}
  ],'管理「'+name+'」');
}
function renameNotebook(oldName){
  openModal('<h3>重命名笔记本</h3>'
    +'<input class="modal-input" id="rnInput" maxlength="14"> '
    +'<div class="modal-actions"><button class="btn-ghost" data-close>取消</button>'
    +'<button class="btn-primary" id="rnOk">保存</button></div>');
  const inp=$('#rnInput');inp.value=oldName;
  const doSave=()=>{
    const v=inp.value.trim().replace(/^#+/,'');
    if(!v){toast('请输入名称');return;}
    if(v===oldName){closeModal();return;}
    if((prefs.notebooks||[]).includes(v)){toast('已存在同名笔记本');return;}
    prefs.notebooks=(prefs.notebooks||[]).map(x=>x===oldName?v:x);
    let moved=0;
    notes.forEach(n=>{if(n.notebook===oldName){n.notebook=v;n.updatedAt=Date.now();moved++;}});
    if(prefs.nbFilter===oldName)prefs.nbFilter=v;
    persistPrefs();persist();closeModal();
    renderNotebookList();renderChips();renderNotes();
    flushDisk();
    toast('已重命名'+(moved?'，'+moved+' 张便签已迁移':''));
    Logs.info('笔记本','重命名 '+oldName+' → '+v);
  };
  $('#rnOk').onclick=doSave;
  inp.addEventListener('keydown',e=>{if(e.key==='Enter')doSave();});
  setTimeout(()=>{inp.focus();inp.setSelectionRange(inp.value.length,inp.value.length);},120);
}
function askDeleteNotebook(name){
  const cnt=notes.filter(n=>n.notebook===name).length;   /* 含回收站，全部会移到「全部」 */
  openModal('<h3>删除笔记本「'+esc(name)+'」</h3>'
    +'<p>'+(cnt?('该笔记本下有 <b>'+cnt+'</b> 张便签。删除笔记本后，它们会移到「全部」，<b>便签本身不会被删除</b>。')
      :'该笔记本是空的，可直接删除。')+'</p>'
    +'<div class="modal-actions"><button class="btn-ghost" data-close>取消</button>'
    +'<button class="btn-danger" id="dnOk">删除</button></div>');
  $('#dnOk').onclick=()=>{
    prefs.notebooks=(prefs.notebooks||[]).filter(x=>x!==name);
    let moved=0;
    notes.forEach(n=>{if(n.notebook===name){n.notebook=null;n.updatedAt=Date.now();moved++;}});
    if(prefs.nbFilter===name)prefs.nbFilter=null;
    persistPrefs();persist();closeModal();
    renderNotebookList();renderChips();renderNotes();
    flushDisk();
    toast('笔记本已删除'+(moved?'，'+moved+' 张便签移到「全部」':''));
    Logs.info('笔记本','删除 '+name+'，便签 '+moved+' 张移到全部');
  };
}

/* ============ 回收站 ============ */
function renderTrash(){
  const list=$('#trashList');
  const tnotes=notes.filter(n=>n.trashed).sort((a,b)=>b.trashedAt-a.trashedAt);
  if(!tnotes.length){
    list.innerHTML=emptyHTML('回收站是空的','删除的便签会在这里保留 7 天，之后自动彻底删除。',true);
    return;
  }
  list.innerHTML=tnotes.map(n=>{
    const days=Math.max(0,7-Math.ceil((Date.now()-n.trashedAt)/864e5));
    return '<div class="trash-row" data-id="'+n.id+'">'
      +'<span class="t-main"><b>'+esc(n.title||'无标题')+'</b><small>'
      +(n.type==='todo'?'待办清单':'文字笔记')+' · 还剩 '+days+' 天自动删除</small></span>'
      +'<button class="trash-restore" aria-label="还原">'+I.restore+'</button>'
      +'<button class="trash-forever" aria-label="彻底删除">'+I.trash+'</button></div>';
  }).join('');
  list.querySelectorAll('.trash-row').forEach(row=>{
    const n=notes.find(x=>x.id===row.dataset.id);
    row.querySelector('.trash-restore').onclick=()=>{
      n.trashed=false;n.trashedAt=null;persist();renderTrash();toast('已还原到便签墙');
    };
    row.querySelector('.trash-forever').onclick=()=>{
      openModal('<h3>彻底删除？</h3><p>“'+esc(n.title||'无标题')+'”将无法再恢复。</p>'
        +'<div class="modal-actions"><button class="btn-ghost" data-close>取消</button><button class="btn-danger" id="tfOk">彻底删除</button></div>');
      $('#tfOk').onclick=async()=>{
        await Promise.all((n.files||[]).map(f=>Store.removeBlob(f).catch(()=>{})));
        markCloudDeleted([n.id]);
        notes=notes.filter(x=>x.id!==n.id);closeModal();
        await flushDisk();renderTrash();toast('已彻底删除');
      };
    };
  });
}
$('#trashBack').onclick=()=>go('home');
$('#trashEmpty').onclick=()=>{
  const tnotes=notes.filter(n=>n.trashed);
  if(!tnotes.length){toast('回收站是空的');return;}
  openModal('<h3>清空回收站？</h3><p>将永久删除 '+tnotes.length+' 张便签，无法恢复。</p>'
    +'<div class="modal-actions"><button class="btn-ghost" data-close>取消</button><button class="btn-danger" id="teOk">清空</button></div>');
  $('#teOk').onclick=async()=>{
    await Promise.all(tnotes.flatMap(x=>(x.files||[]).map(f=>Store.removeBlob(f).catch(()=>{}))));
    markCloudDeleted(tnotes.map(x=>x.id));
    notes=notes.filter(n=>!n.trashed);closeModal();
    await flushDisk();renderTrash();toast('回收站已清空');
  };
};
})();
