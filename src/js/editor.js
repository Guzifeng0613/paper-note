/* ============ 编辑页 v4 ============ */
const cur=()=>notes.find(n=>n.id===editingId);
const scheduleSave=debounce(()=>{persist();},300);
function touch(){const n=cur();if(n){
  if(n._pristine){delete n._pristine;Logs.info('便签','开始记录（已入库）',n.id);}
  n.updatedAt=Date.now();scheduleSave();}}
function isEmptyNote(n){
  if(n.title.trim()||n.files.length)return false;
  if(stripHtml(n.content)||/<img/.test(n.content))return false;
  if((n.todos||[]).some(t=>t.text.trim()))return false;
  return true;
}
function renderEditor(){
  const n=cur();if(!n){go('home');return;}
  try{
    $('#paperTitle').value=n.title||'';
    $('#paperTitle').oninput=e=>{n.title=e.target.value;touch();renderMeta();};
    renderMeta();if(!_rtbarBuilt){renderRtBar();_rtbarBuilt=true;}renderWorkArea();
    updateDockState();
    scheduleEditorDeferred();
  }catch(e){
    console.warn('renderEditor error',e);
    migrate();
    try{renderMeta();renderWorkArea();const nn=cur();if(nn)applyTodoArea(nn);renderPaperAttach();}catch(e2){}
    toast('该便签部分内容异常，已尝试修复');
  }
}
let __metaRAF=0,_rtbarBuilt=false;
/* 输入时字数/时间统计不必每次按键同步写 DOM：合并到下一帧，降低输入关键路径开销 */
function scheduleMeta(){if(__metaRAF)return;
  __metaRAF=requestAnimationFrame(()=>{__metaRAF=0;renderMeta();});}
function renderMeta(){
  const n=cur();if(!n)return;
  const d=new Date(n.updatedAt),p=x=>String(x).padStart(2,'0');
  const ds=d.getFullYear()+'/'+(d.getMonth()+1)+'/'+d.getDate()+' '+p(d.getHours())+':'+p(d.getMinutes());
  const chars=stripHtml(n.content).length;
  const td=(n.todos||[]).filter(t=>t.text.trim()).length;
  let wc=(chars?chars+' 字':'')+(td?(chars?' · ':'')+td+' 项待办':'')||'空白';
  $('#paperMeta').textContent=ds+'  ·  '+wc+'  ·  '+(n.notebook||'全部');
}
function hiSvg(){
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 11-6 6v3h3l6-6"/><path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"/></svg>';
}
function renderRtBar(){
  $('#paperRtBar').innerHTML=
    '<button class="pr-btn" data-c="bold" aria-label="加粗" style="font-size:16px;font-weight:800">B</button>'
    +'<button class="pr-btn" data-c="underline" aria-label="下划线" style="font-size:15px;font-weight:800;text-decoration:underline">U</button>'
    +'<button class="pr-btn" data-c="hi" aria-label="高亮">'+hiSvg()+'</button>'
    +'<div class="pr-sep"></div>'
    +'<button class="pr-btn" id="prUndo" data-c="undo" aria-label="撤销"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-2"/></svg></button>'
    +'<button class="pr-btn" id="prRedo" data-c="redo" aria-label="重做"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="m15 14 5-5-5-5"/><path d="M20 9H9a5 5 0 0 0 0 10h2"/></svg></button>'
    +'<div class="pr-sep"></div>'
    +'<button class="pr-btn" data-c="dec" aria-label="缩小字号" style="font-size:11px;font-weight:800">A</button>'
    +'<span class="pr-size" id="prSize">3</span>'
    +'<button class="pr-btn" data-c="inc" aria-label="放大字号" style="font-size:16px;font-weight:800">A</button>';
  $$('#paperRtBar .pr-btn').forEach(b=>{
    b.addEventListener('pointerdown',e=>{e.preventDefault();prExec(b.dataset.c);});
  });
}
function nextFileIdx(n){
  let mx=0;(n.files||[]).forEach(f=>{mx=Math.max(mx,parseInt(f.idx,10)||0);});
  return mx+1;
}
async function imageURL(fid){
  if(Store.env==='native'){
    if(location.protocol==='https:'||location.protocol==='http:')
      return 'file?id='+encodeURIComponent(fid); /* 同源 https 由 intercept 直读私有文件，最可靠 */
    const r=await Native.call('fileUri',fid);return r.uri;
  }
  return await Store.blobURL({id:fid});
}
async function hydrateImages(){
  const body=$('#paperBody');
  for(const im of body.querySelectorAll('img.note-img[data-id]')){
    if(im.getAttribute('src'))continue;
    try{im.src=await imageURL(im.dataset.id);}catch(e){}
  }
}
function cleanBodyHTML(){
  const cl=$('#paperBody').cloneNode(true);
  cl.querySelectorAll('img.note-img').forEach(im=>im.removeAttribute('src'));
  return cl.innerHTML;
}
function renderWorkArea(){
  const n=cur(),body=$('#paperBody');
  body.style.display='';
  body.setAttribute('data-ph','点这里开始书写；点底部加号可插图、加附件…');
  body.innerHTML=n.content||'';
  body.oninput=e=>{
    const raw=body.innerHTML;                         /* 每次按键只序列化一次 */
    n.content=body.querySelector('img.note-img')?cleanBodyHTML():raw; /* 有图才克隆去 src */
    reconcileImages(n);onEditorInput(e,raw);touch();scheduleMeta();
    updateNbSuggest();                               /* #10 笔记本内联联想 */};
  body.onkeydown=e=>{if(nbSuggestKey(e))return;};
  body.onkeyup=e=>{
    if(e.key==='ArrowLeft'||e.key==='ArrowRight'||e.key==='ArrowUp'||e.key==='ArrowDown')
      updateNbSuggest();
  };
  body.onblur=()=>{setTimeout(()=>{
    const a=document.activeElement;
    if(!a||!a.closest('#nbSuggest'))closeNbSuggest();
  },160);};
  hydrateImages();
  histReset(n.content||'');
}
/* 待办区显隐 + 重建（非首屏关键部分，可延迟到正文首帧之后，避免进入编辑同帧任务过重、真机短暂锁定滑动） */
function applyTodoArea(n){
  const todo=$('#paperTodo');
  if(n.type==='todo'||(Array.isArray(n.todos)&&n.todos.length)){
    if(!Array.isArray(n.todos))n.todos=[];
    if(!todo.classList.contains('show'))todo.classList.add('show');
    renderPaperTodo();
  }
  else todo.classList.remove('show');
}
let _edDefer=0;
/* 正文先显示、屏幕先可滑动；待办/附件在首帧后补上（始终排在正文同步任务之后，不抢占首帧） */
function scheduleEditorDeferred(){
  if(_edDefer)clearTimeout(_edDefer);
  _edDefer=setTimeout(()=>{_edDefer=0;
    const n=cur();if(!n)return;
    applyTodoArea(n);renderPaperAttach();},60);
}
/* ============ 编辑历史（撤销 / 重做） ============ */
let histUndo=[],histRedo=[],histLastSnap='',histLastType='',histLastT=0;
const HIST_MAX=120;
function histReset(snap){
  histUndo=[];histRedo=[];histLastSnap=snap;histLastType='';histLastT=0;
  updateHistBtns();
}
/* 正文图片对账：正文里已删除的图片，对应文件一并清理，避免孤儿 */
function reconcileImages(n){
  const body=$('#paperBody');
  const used=new Set([...body.querySelectorAll('img.note-img[data-id]')].map(im=>im.dataset.id));
  const dead=n.files.filter(f=>f.kind==='image'&&!used.has(f.id));
  if(!dead.length)return;
  dead.forEach(f=>Store.removeBlob(f).catch(()=>{}));
  n.files=n.files.filter(f=>!dead.includes(f));
}
function onEditorInput(e,cur){
  const now=Date.now();
  const t=(e&&e.inputType)||'',data=(e&&e.data)||'';
  const cont=['insertText','insertCompositionText','deleteContentBackward','deleteContentForward'];
  let startNew=true;
  if(cont.includes(t)){
    const isBreak=/[\s，。、；：,.!?！？；]/.test(data);
    startNew=(histLastType!==t||now-histLastT>=400)||isBreak;
  }
  if(startNew){
    histUndo.push(Object.assign({h:histLastSnap},getCaretOffsets()));
    if(histUndo.length>HIST_MAX)histUndo.shift();
    histRedo=[];
  }
  histLastSnap=cur;histLastType=t;histLastT=now;
  updateHistBtns();
}
function histBeforeFormat(){
  histUndo.push(makeSnap());
  if(histUndo.length>HIST_MAX)histUndo.shift();
  histRedo=[];histLastSnap=$('#paperBody').innerHTML;histLastT=Date.now();
  updateHistBtns();
}
/* 选区在正文内的绝对字符偏移（起/止），随快照保存 */
function absOffset(root,node,offset){
  try{const r=document.createRange();r.selectNodeContents(root);r.setEnd(node,offset);
    return r.toString().length;}catch(e){return -1;}
}
function getCaretOffsets(){
  const body=$('#paperBody'),sel=getSelection();
  if(!sel.rangeCount||!body.contains(sel.anchorNode))return {a:-1,b:-1};
  const r=sel.getRangeAt(0);
  return {a:absOffset(body,r.startContainer,r.startOffset),
          b:absOffset(body,r.endContainer,r.endOffset)};
}
function makeSnap(){const body=$('#paperBody');return Object.assign({h:body.innerHTML},getCaretOffsets());}
function locateOffset(root,target){
  const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,null);let t,acc=0;
  while((t=w.nextNode())){const len=t.nodeValue.length;
    if(target<=acc+len)return [t,target-acc];acc+=len;}
  return null;
}
function setAbsOffsets(body,start,end){
  const s=locateOffset(body,start),e=locateOffset(body,end==null?start:end);
  if(!s)return false;
  const r=document.createRange();r.setStart(s[0],s[1]);
  if(e)r.setEnd(e[0],e[1]);else r.collapse(true);
  const sel=getSelection();sel.removeAllRanges();sel.addRange(r);
  return true;
}
function restoreSnap(snap){
  const body=$('#paperBody'),n=cur();
  const sb=document.querySelector('#paperScroll');const keepScroll=sb?sb.scrollTop:0;
  body.innerHTML=snap.h;hydrateImages();
  if(n)n.content=cleanBodyHTML();
  histLastSnap=body.innerHTML;
  /* 光标还原到编辑处（不再强制文末），并保持原地滚动，撤销不跳位 */
  if(snap.a>=0)setAbsOffsets(body,snap.a,snap.b);
  if(sb)sb.scrollTop=keepScroll;
}
function undo(){
  if(!histUndo.length)return;
  const body=$('#paperBody');
  histRedo.push(makeSnap());
  restoreSnap(histUndo.pop());
  updateHistBtns();touch();
}
function redo(){
  if(!histRedo.length)return;
  const body=$('#paperBody');
  histUndo.push(makeSnap());
  restoreSnap(histRedo.pop());
  updateHistBtns();touch();
}
function updateHistBtns(){
  const u=$('#prUndo'),r=$('#prRedo');
  if(u)u.classList.toggle('disabled',!histUndo.length);
  if(r)r.classList.toggle('disabled',!histRedo.length);
  const eu=$('#editUndo'),er=$('#editRedo');
  if(eu)eu.classList.toggle('disabled',!histUndo.length);
  if(er)er.classList.toggle('disabled',!histRedo.length);
}
/* 富文本执行（按下即执行，选区已保留） */
function prExec(c){
  const ed=$('#paperBody'),bar=$('#paperRtBar');
  if(c==='undo'){undo();syncPrState();return;}
  if(c==='redo'){redo();syncPrState();return;}
  ed.focus();
  histBeforeFormat();
  if(c==='bold')document.execCommand('bold');
  else if(c==='underline')document.execCommand('underline');
  else if(c==='hi')toggleHighlight(bar);
  else if(c==='inc'||c==='dec'){
    let s=parseInt(document.queryCommandValue('fontSize')||'3',10);if(isNaN(s))s=3;
    s=c==='inc'?Math.min(7,s+1):Math.max(1,s-1);
    document.execCommand('fontSize',false,String(s));
  }
  const n=cur();n.content=cleanBodyHTML();histLastSnap=ed.innerHTML;
  touch();syncPrState();renderMeta();hydrateImages();
}
/* ============ 高亮（可加、可取消） ============ */
/* 判断颜色是否为黄色系高亮（兼容各版本遗留的不同黄：命名 yellow、#hex、rgb） */
function colorYellowish(s){
  if(!s)return false;s=String(s).trim().toLowerCase();
  let r,g,b;
  const m=s.match(/rgba?\((\d+)[,\s]+(\d+)[,\s]+(\d+)/);
  const h6=s.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/);
  const h3=s.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/);
  if(m){r=+m[1];g=+m[2];b=+m[3];}
  else if(h6){r=parseInt(h6[1],16);g=parseInt(h6[2],16);b=parseInt(h6[3],16);}
  else if(h3){r=parseInt(h3[1]+h3[1],16);g=parseInt(h3[2]+h3[2],16);b=parseInt(h3[3]+h3[3],16);}
  else return s.indexOf('yellow')>=0;
  return r>=220&&g>=200&&b<=190&&r>=b+40&&g>=b+20;
}
/* 是否高亮元素：mark、旧版 class="hl"、任何黄色系内联背景 */
function isHiliteEl(el){
  if(!el||el.nodeType!==1)return false;
  if(el.tagName==='MARK')return true;
  if(el.classList&&el.classList.contains('hl'))return true;
  const st=el.style;if(!st)return false;
  const bg=String(st.backgroundColor||st.background||'').trim();
  if(!bg)return false;
  if(/transparent|rgba\([^)]*,\s*0(?:\.\d+)?\s*\)/.test(bg.toLowerCase()))return false;
  /* App 中行内背景的唯一来源就是高亮：任何非透明行内背景都按高亮处理，
     使不同颜色、不同版本遗留的高亮都能被识别并一键取消 */
  return true;
}
function unwrapNode(x){
  const p=x.parentNode;if(!p)return;
  while(x.firstChild)p.insertBefore(x.firstChild,x);
  p.removeChild(x);
}
function selectionHiliteOn(){
  try{
    const v=(document.queryCommandValue('hiliteColor')
      ||document.queryCommandValue('backColor')||'');
    if(colorYellowish(v))return true;
  }catch(e){}
  const sel=getSelection();
  if(sel.rangeCount){
    const range=sel.getRangeAt(0),body=$('#paperBody');
    const walker=document.createTreeWalker(body,NodeFilter.SHOW_ELEMENT);let el;
    while((el=walker.nextNode())){
      if(range.intersectsNode(el)&&isHiliteEl(el))return true;
    }
  }
  return false;
}
function toggleHighlight(bar){
  const turnOn=!selectionHiliteOn();
  try{document.execCommand('styleWithCSS',false,true);}catch(e){}
  if(turnOn){
    const ok=document.execCommand('hiliteColor',false,'#FFE27A');
    if(!ok){try{document.execCommand('backColor',false,'#FFE27A');}catch(e){}}
  }else{
    let ok=document.execCommand('hiliteColor',false,'transparent');
    if(!ok){try{document.execCommand('backColor',false,'transparent');}catch(e){}}
    clearHiliteInSelection();
  }
}
function clearHiliteInSelection(){
  const sel=getSelection();
  if(!sel.rangeCount)return;
  const range=sel.getRangeAt(0),body=$('#paperBody');
  const hits=[];
  const walker=document.createTreeWalker(body,NodeFilter.SHOW_ELEMENT);
  let el;
  while((el=walker.nextNode())){
    if(range.intersectsNode(el)&&isHiliteEl(el))hits.push(el);
  }
  hits.forEach(x=>{
    if(x.tagName==='MARK'){unwrapNode(x);return;}
    if(x.classList&&x.classList.contains('hl'))x.classList.remove('hl');
    if(x.style){x.style.backgroundColor='';x.style.background='';}
    const cls=x.getAttribute('class'),sty=x.getAttribute('style');
    if((x.tagName==='SPAN'||x.tagName==='FONT')
       &&(!cls||cls.trim()==='')&&(!sty||sty.trim()===''))unwrapNode(x);
  });
  /* execCommand transparent 会把选区压进一个 transparent 空 span：清样式并解包 */
  body.querySelectorAll('span,font').forEach(x=>{
    const s=x.style;if(!s)return;
    const bg=String(s.backgroundColor||s.background||'').toLowerCase();
    if(bg.indexOf('transparent')>=0){
      s.backgroundColor='';s.background='';
      const cls=x.getAttribute('class'),sty=x.getAttribute('style');
      if((x.tagName==='SPAN'||x.tagName==='FONT')
        &&(!cls||!cls.trim())&&(!sty||!sty.trim()))unwrapNode(x);
    }
  });
}
let rtManual=false,prHideTimer=null;
function isEditingNote(){const n=cur();return !!(n&&$('#paperBody').isContentEditable);}
function noteSelectionRect(){
  const sel=getSelection();
  if(!sel.rangeCount||sel.isCollapsed)return null;
  const r=sel.getRangeAt(0);
  if(!$('#paperBody').contains(r.commonAncestorContainer))return null;
  let rect=r.getBoundingClientRect();
  if(rect.width===0&&rect.height===0){const rs=r.getClientRects();if(rs.length)rect=rs[0];else return null;}
  return rect;
}
function updateBarButtons(){
  const bar=$('#paperRtBar');
  try{
    bar.querySelector('[data-c="bold"]').classList.toggle('on',document.queryCommandState('bold'));
    bar.querySelector('[data-c="underline"]').classList.toggle('on',document.queryCommandState('underline'));
    bar.querySelector('[data-c="hi"]').classList.toggle('on',selectionHiliteOn());
    let s=parseInt(document.queryCommandValue('fontSize')||'3',10);
    $('#prSize').textContent=isNaN(s)?'3':String(s);
  }catch(e){}
}
function placeBarAt(rect){
  const bar=$('#paperRtBar');bar.classList.add('show');
  const bw=bar.offsetWidth||232,bh=bar.offsetHeight||46;
  const vv=window.visualViewport;
  const vw=vv?vv.width:window.innerWidth,vh=vv?vv.height:window.innerHeight;
  const vx=vv?vv.offsetLeft:0,vy=vv?vv.offsetTop:0;
  let x=rect.left+rect.width/2-bw/2;
  x=Math.max(vx+8,Math.min(x,vx+vw-bw-8));
  const gap=8;let y=rect.top-bh-gap,below=false;
  if(y<vy+8){y=rect.bottom+gap;below=true;}
  if(y+bh>vy+vh-8)y=vy+vh-bh-8;
  bar.style.left=x+'px';bar.style.top=y+'px';
  bar.style.transformOrigin=below?'center top':'center bottom';
}
function positionManual(){
  const bar=$('#paperRtBar');bar.classList.add('show');
  const vv=window.visualViewport;
  const vw=vv?vv.width:window.innerWidth,vh=vv?vv.height:window.innerHeight;
  const vx=vv?vv.offsetLeft:0,vy=vv?vv.offsetTop:0;
  const bw=bar.offsetWidth||232,bh=bar.offsetHeight||46;
  const dockH=($('#dock')&&$('#dock').offsetHeight)||64;
  bar.style.left=(vx+(vw-bw)/2)+'px';
  bar.style.top=(vy+vh-bh-dockH-6)+'px';
  bar.style.transformOrigin='center top';
  updateBarButtons();
}
function hideBar(){$('#paperRtBar').classList.remove('show');}
function syncPrState(){
  if(!isEditingNote()){hideBar();return;}
  updateBarButtons();
  const rect=noteSelectionRect();
  clearTimeout(prHideTimer);
  if(rect)placeBarAt(rect);
  else if(rtManual)positionManual();
  else prHideTimer=setTimeout(hideBar,160);
}
/* 待办（编辑页） */
function eyeSvg(off){
  if(off)return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3l18 18"/><path d="M10.6 5.1A9.7 9.7 0 0 1 12 5c5 0 9 4.7 10 7a10.4 10.4 0 0 1-2.2 3.2M6.2 6.2A10.3 10.3 0 0 0 2 12c1 2.3 5 7 10 7a9.7 9.7 0 0 0 3.4-.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>';
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>';
}
function renderPaperTodo(){
  const n=cur();
  const done=n.todos.filter(t=>t.done).length,total=n.todos.length;
  const pct=total?Math.round(done/total*100):0;
  const show=n.showProgress!==false;
  let html='';
  if(show){
    html+='<div class="pt-progress"><div class="bar"><i style="width:'+pct+'%"></i></div>'
      +'<span class="pct"><span class="pt-od pt-od-done">'+done+'</span>/<span class="pt-od pt-od-total">'+total+'</span> · <span class="pt-od pt-od-pct">'+pct+'</span>%</span></div>';
  }
  n.todos.forEach((t,i)=>html+=paperTodoRowHTML(t,i));
  const pos=n.todoPosition==='top'?'top':'bottom';
  html+='<div class="pt-foot">'
    +'<button class="pt-addrow">'+I.plus+' 添加一项</button>'
    +'<div class="pt-foot-actions">'
    +'<button class="pt-posttoggle" id="ptPosToggle" title="'+(pos==='top'?'待办移到正文最下面':'待办移到正文最上面')+'">'+todoPosIcon(pos)+'</button>'
    +'<button class="pt-progtoggle" id="ptProgToggle" aria-label="进度显示开关">'+eyeSvg(show)+'</button>'
    +'</div></div>';
  const wrap=$('#paperTodo');wrap.innerHTML=html;
  wrap.querySelector('.pt-addrow').onclick=addPaperTodo;
  wrap.querySelector('#ptPosToggle').onclick=()=>{
    n.todoPosition=n.todoPosition==='top'?'bottom':'top';
    touch();applyTodoPosition();renderPaperTodo();
  };
  wrap.querySelector('#ptProgToggle').onclick=()=>{
    n.showProgress=!show;touch();renderPaperTodo();
  };
  wrap.querySelectorAll('.pt-row').forEach(r=>setupPaperTodoRow(r));
  wrap.querySelectorAll('textarea.pt-text').forEach(autosizeTodo);
  applyTodoPosition();
}
function todoPosIcon(pos){
  /* 当前置底→显示向上箭头（可置顶）；当前置顶→显示向下箭头（可置底） */
  return pos==='top'
    ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"/><path d="M19 12l-7 7-7-7"/></svg>'
    : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5"/><path d="M5 12l7-7 7 7"/></svg>';
}
/* 按 n.todoPosition 把待办容器移动到正文前（置顶）或正文后、附件前（置底，默认） */
function applyTodoPosition(){
  const n=cur(),todo=$('#paperTodo'),body=$('#paperBody'),attach=$('#paperAttach');
  if(!todo||!body)return;
  if(n.todoPosition==='top'){
    body.parentNode.insertBefore(todo,body);
  }else{
    if(attach)body.parentNode.insertBefore(todo,attach);
    else body.after(todo);
  }
}
function paperTodoRowHTML(t,i){
  return '<div class="pt-row" data-i="'+i+'">'
    +'<button class="tc'+(t.done?' done':'')+'">'+I.check+'</button>'
    +'<textarea class="pt-text '+(t.done?'done':'')+'" rows="1" placeholder="待办事项…">'
    +esc(t.text)+'</textarea>'
    +'<button class="pri">'+priSvg(t.priority)+'</button>'
    +'<button class="rd">'+I.x+'</button></div>';
}
function autosizeTodo(t){t.style.height='auto';t.style.height=t.scrollHeight+'px';}
function priSvg(p){
  /* 普通优先级安静占位（淡灰），仅高/低明确着色，避免满屏橙旗误判“重要” */
  const c=p==='high'?'#e0524f':p==='low'?'#9fb0c8':'#dfe3db';
  return '<svg viewBox="0 0 24 24" fill="none" stroke="'+c+'" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><path d="M4 22v-7"/></svg>';
}
function addPaperTodo(){
  const n=cur();
  if(!n){toast('请先新建便签');return;}
  if(!Array.isArray(n.todos))n.todos=[];
  insertTodoAt(n.todos.length-1);
}
/* 进度条 HTML（数字拆成独立 span，便于滚动） */
function progressHTML(done,total,pct){
  return '<div class="pt-progress"><div class="bar"><i style="width:'+pct+'%"></i></div>'
    +'<span class="pct"><span class="pt-od pt-od-done">'+done+'</span>/<span class="pt-od pt-od-total">'+total+'</span> · <span class="pt-od pt-od-pct">'+pct+'</span>%</span></div>';
}
/* 只更新进度条，不重建行（勾选/插入/删除时调用，避免键盘闪烁）
   up=true 勾选：进度条超调收尾 + 数字滚动；up=false 取消勾选：正常回弹 */
function updateTodoProgress(up){
  const n=cur(),wrap=$('#paperTodo');if(!n)return;
  const done=n.todos.filter(t=>t.done).length,total=n.todos.length;
  const pct=total?Math.round(done/total*100):0;
  let bar=wrap.querySelector('.pt-progress');
  if(n.showProgress===false){if(bar)bar.remove();return;}
  if(!bar){wrap.insertAdjacentHTML('afterbegin',progressHTML(done,total,pct));return;}
  const fill=bar.querySelector('.bar i');
  const oldPct=parseFloat(fill.style.width)||0;
  const rm=reduceMotion();
  fill.style.transition='none';
  fill.style.width=pct+'%';
  if(!rm&&Element.prototype.animate&&pct!==oldPct){
    if(pct>0){
      const s0=Math.max(0,oldPct/pct);
      if(up){
        /* 超调：冲到 1.06 再弹回（弹簧） */
        fill.animate([{transform:'scaleX('+s0+')'},{transform:'scaleX(1.06)',offset:.65},{transform:'scaleX(1)'}],
          {duration:460,easing:'cubic-bezier(.34,1.3,.64,1)'});
      }else{
        fill.animate([{transform:'scaleX('+s0+')'},{transform:'scaleX(1)'}],
          {duration:320,easing:'cubic-bezier(.2,.8,.2,1)'});
      }
    }
  }
  /* 数字滚动（完成数 / 百分比），总数变化直接更新 */
  const od=bar.querySelector('.pt-od-done'),op=bar.querySelector('.pt-od-pct'),ot=bar.querySelector('.pt-od-total');
  if(ot&&ot.textContent!==String(total))ot.textContent=total;
  if(od&&od.textContent!==String(done)){
    if(rm)od.textContent=done;else animateNumber(od,done,{duration:300});
  }
  if(op&&op.textContent!==String(pct)){
    if(rm)op.textContent=pct;else animateNumber(op,pct,{duration:300});
  }
}
function insertTodoAt(index){
  const n=cur();
  if(!Array.isArray(n.todos))n.todos=[];
  n.todos.splice(index+1,0,{id:uid(),text:'',done:false,priority:'normal'});
  n.type='todo';
  const wrap=$('#paperTodo');wrap.classList.add('show');
  /* 待办区还没骨架（首次）：全量渲染一次建立结构，再聚焦新行 */
  if(!wrap.querySelector('.pt-foot')){
    renderPaperTodo();
    const rs=wrap.querySelectorAll('textarea.pt-text');
    if(rs[index+1])rs[index+1].focus();
    touch();renderMeta();
    return;
  }
  /* 已有骨架：只插入新行，不整块重建，键盘不收起、不重弹 */
  const holder=document.createElement('div');
  holder.innerHTML=paperTodoRowHTML(n.todos[index+1],index+1).trim();
  const newRow=holder.firstChild;
  const rows=wrap.querySelectorAll('.pt-row');
  const foot=wrap.querySelector('.pt-foot');
  if(rows[index])rows[index].after(newRow);
  else if(foot)foot.before(newRow);
  else wrap.appendChild(newRow);
  setupPaperTodoRow(newRow);
  wrap.querySelectorAll('.pt-row').forEach((r,k)=>r.dataset.i=k);
  updateTodoProgress();
  const ta=newRow.querySelector('textarea.pt-text');
  autosizeTodo(ta);ta.focus();
  touch();renderMeta();
}
/* 删除第 i 条待办（只移除该 DOM 行，不整块重建）；退格删空行时光标移到上一条 */
function removeTodoRow(i,focusPrev){
  const n=cur(),wrap=$('#paperTodo');
  const rows=wrap.querySelectorAll('.pt-row');
  n.todos.splice(i,1);
  if(rows[i])rows[i].remove();
  if(!n.todos.length){
    n.type='note';wrap.classList.remove('show');
    touch();renderMeta();return;
  }
  wrap.querySelectorAll('.pt-row').forEach((r,k)=>r.dataset.i=k);
  updateTodoProgress();
  if(focusPrev){
    const fi=Math.max(0,i-1);
    const rs=wrap.querySelectorAll('textarea.pt-text');
    if(rs[fi]){const t=rs[fi];t.focus();
      const L=t.value.length;t.setSelectionRange(L,L);}
  }
  touch();renderMeta();
}
function setupPaperTodoRow(r){
  const n=cur(),gi=()=>+r.dataset.i;
  const tc=r.querySelector('.tc'),ta=r.querySelector('textarea.pt-text'),
        pri=r.querySelector('.pri'),rd=r.querySelector('.rd');
  tc.onclick=()=>{
    const i=gi();n.todos[i].done=!n.todos[i].done;
    const now=!!n.todos[i].done;
    tc.classList.toggle('done',now);
    ta.classList.toggle('done',now);
    /* 勾选三连之一：圆圈弹（圈本身放大回弹），勾选/取消用不同节奏 */
    tc.classList.remove('tc-pop','tc-unpop');void tc.offsetWidth;
    tc.classList.add(now?'tc-pop':'tc-unpop');
    haptic(now?12:8);
    touch();updateTodoProgress(now);renderMeta();
  };
  ta.addEventListener('input',()=>{autosizeTodo(ta);n.todos[gi()].text=ta.value;touch();scheduleMeta();});
  ta.addEventListener('keydown',e=>{
    const i=gi();
    if(e.key==='Enter'&&!e.shiftKey&&!e.altKey){
      e.preventDefault();
      n.todos[i].text=ta.value;touch();
      if(ta.value.trim()===''){
        const all=r.parentNode.querySelectorAll('textarea.pt-text');
        if(all[i+1])all[i+1].focus();   /* 空行不堆叠，跳到下一行 */
        return;
      }
      insertTodoAt(i);
      return;
    }
    /* 空行按退格：直接删除这一行，光标回到上一条 */
    if(e.key==='Backspace'&&ta.value===''&&ta.selectionStart===0){
      e.preventDefault();removeTodoRow(i,true);
    }
  });
  pri.onclick=()=>{const i=gi();
    const order=['normal','high','low'],p=n.todos[i].priority||'normal';
    let k=order.indexOf(p);if(k<0)k=0;
    n.todos[i].priority=order[(k+1)%order.length];
    pri.innerHTML=priSvg(n.todos[i].priority);
    touch();};
  rd.onclick=()=>collapseTodoRow(gi());
  startPaperDrag(r);
}
/* #12 待办删除收拢：先缩小淡出、高度平滑收回，其余行顺势补位，再落数据 */
function collapseTodoRow(i){
  const wrap=$('#paperTodo');const rows=wrap?wrap.querySelectorAll('.pt-row'):[];
  const row=rows[i];
  if(!row||reduceMotion()){removeTodoRow(i,false);return;}
  haptic(8);
  const h=row.offsetHeight;
  row.style.height=h+'px';
  row.style.overflow='hidden';
  void row.offsetWidth;
  row.classList.add('row-collapse');
  setTimeout(()=>removeTodoRow(i,false),240);
}
/* 待办弹簧拖拽（#7）：固定提升行 1:1 跟手；落点槽（金色指示线）随手指移动，
   其余行 FLIP 弹簧让位；松手时提升行弹回落点，再提交数据，中途可反复上下接管。 */
let pdrag=null;
function startPaperDrag(r){
  r.addEventListener('pointerdown',e=>{
    if(e.target.closest('.tc,.pri,.rd,input,textarea'))return;
    pdrag={r,startY:e.clientY,startX:e.clientX,moved:false,n:cur()};
  });
}
function _flipRowsTo(rows,slot,before){
  const snap=new Map(rows.map(x=>[x,x.getBoundingClientRect()]));
  slot.parentNode.insertBefore(slot,before);
  rows.forEach(x=>{
    const a=snap.get(x);
    if(!a)return;
    const b=x.getBoundingClientRect();
    const dx=a.left-b.left,dy=a.top-b.top;
    if(!dx&&!dy)return;
    const st=x.style;
    st.transition='none';st.transform='translate('+dx+'px,'+dy+'px)';void x.offsetWidth;
    st.transition='transform .24s var(--ease-spring-soft)';
    requestAnimationFrame(()=>st.transform='');
    setTimeout(()=>{st.transition='';st.transform='';},280);
  });
}
window.addEventListener('pointermove',e=>{
  if(!pdrag)return;const d=pdrag;
  if(!d.moved){
    if(Math.abs(e.clientY-d.startY)<8||Math.abs(e.clientX-d.startX)>Math.abs(e.clientY-d.startY))return;
    d.moved=true;
    const rect=d.r.getBoundingClientRect();
    d.w=rect.width;d.h=rect.height;d.offX=e.clientX-rect.left;d.offY=e.clientY-rect.top;
    haptic(12);
    d.r.classList.add('lift','dragging');
    d.r.style.width=d.w+'px';
    /* 落点槽：插入在提升行原位，先 0 高度再张开，等高时完全无跳动 */
    d.slot=document.createElement('div');d.slot.className='pt-slot';d.slot.innerHTML='<i></i>';
    d.r.parentNode.insertBefore(d.slot,d.r);
    requestAnimationFrame(()=>{d.slot.style.height=d.h+'px';d.slot.classList.add('open');});
    d.rows=Array.from(d.r.parentNode.querySelectorAll('.pt-row'));
  }
  d.r.style.left=(e.clientX-d.offX)+'px';
  d.r.style.top=(e.clientY-d.offY)+'px';
  /* 落点 = 手指越过中点的那一行（before/after），中途可反复重排 */
  const rows=Array.from(d.r.parentNode.querySelectorAll('.pt-row'));
  const others=rows.filter(x=>x!==d.r);
  let before=null;
  for(const x of others){
    const rc=x.getBoundingClientRect();
    if(e.clientY<rc.top+rc.height/2){before=x;break;}
  }
  const curBefore=d.slot.nextElementSibling;
  if(before!==curBefore){
    if(!before){
      const foot=d.r.parentNode.querySelector('.pt-foot');
      if(foot!==curBefore)before=foot;
    }
    if(before!==curBefore){
      haptic(8);
      _flipRowsTo(others,d.slot,before);
    }
  }
});
window.addEventListener('pointerup',()=>{
  if(!pdrag)return;const d=pdrag;pdrag=null;
  if(!d.moved)return;
  const rm=reduceMotion();
  const commit=()=>{
    /* slot 占据的位置即提升行落点；提升行是 fixed 不参与布局，按 DOM 顺序还原 */
    const finalOrder=[];
    Array.from(d.r.parentNode.children).forEach(x=>{
      if(x===d.slot)finalOrder.push(+d.r.dataset.i);
      else if(x.classList.contains('pt-row')&&x!==d.r)finalOrder.push(+x.dataset.i);
    });
    if(d.slot&&d.slot.parentNode)d.slot.remove();
    d.n.todos=finalOrder.map(i=>d.n.todos[i]);
    touch();renderPaperTodo();
  };
  if(rm){commit();return;}
  /* 弹回落点：提升行飞到槽位，槽位闭合，再重建 */
  const sr=d.slot.getBoundingClientRect();
  const r0=d.r.getBoundingClientRect();
  d.r.style.transition='left .26s var(--ease-spring),top .26s var(--ease-spring),transform .26s var(--ease-spring),width .26s';
  d.r.style.left=sr.left+'px';d.r.style.top=sr.top+'px';
  d.r.style.width=sr.width+'px';d.r.style.transform='scale(1)';
  d.slot.style.transition='height .22s var(--ease-spring-soft)';
  d.slot.style.height=d.h+'px';d.slot.classList.remove('open');
  setTimeout(()=>{
    /* 提交前把槽位收起（高度归零，提升行正好占住该位置） */
    d.slot.style.height='0px';
  },120);
  setTimeout(commit,270);
});
/* 图片 */
/* ============ 图片 / 附件（Store Blob 架构） ============ */
function readAsDataURL(file){
  return new Promise((res,rej)=>{const r=new FileReader();
    r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(file);});
}
function compressImage(file){
  return new Promise((resolve,reject)=>{
    const url=URL.createObjectURL(file),img=new Image();
    img.onload=()=>{
      let w=img.width,h=img.height;const max=1280;
      if(w>max||h>max){if(w>h)h=h*max/w,w=max;else w=w*max/h,h=max;}
      const cv=document.createElement('canvas');cv.width=w;cv.height=h;
      cv.getContext('2d').drawImage(img,0,0,w,h);
      URL.revokeObjectURL(url);resolve(cv.toDataURL('image/jpeg',0.8));
    };
    img.onerror=()=>{URL.revokeObjectURL(url);readAsDataURL(file).then(resolve,reject);};
    img.src=url;
  });
}
/* 选图片 */
async function pickPaperImage(){
  const n=cur();
  if(hasNative())return nativePickImage(n);
  const inp=document.createElement('input');inp.type='file';inp.accept='image/*';
  inp.onchange=async()=>{
    const file=inp.files[0];if(!file)return;
    if(file.size>MAX_FILE){toast('图片不能超过 '+formatSize(MAX_FILE));return;}
    toast('正在插入图片…');
    let data;try{data=await compressImage(file);}catch(e){data=await readAsDataURL(file);}
    await placeImage(n,file,data);
  };
  inp.click();
}
async function nativePickImage(n){
  try{
    const r=await Native.call('pickImageCompressed',JSON.stringify({maxEdge:1280,quality:80}));
    if(!r||!r.dataUrl)return;
    await placeImage(n,{name:r.name||'图片.jpg'},r.dataUrl);
  }catch(e){if(e)toast(e.message||e);}
}
async function placeImage(n,file,data){
  const f={id:uid(),name:file.name||'图片.jpg',
    size:file.size||Math.max(1,Math.round(data.length*0.7)),
    type:file.type||'image/jpeg',kind:'image',idx:nextFileIdx(n)};
  if(hasNative())
    await Native.call('putBlobFromDataUrl',JSON.stringify(
      {id:f.id,dataUrl:data,name:f.name,type:f.type}));
  else await Store.addBlob(f.id,dataURLtoBlob(data));
  n.files.push(f);
  const body=$('#paperBody');body.focus();
  document.execCommand('insertHTML',false,
    '<img class="note-img" data-id="'+f.id+'"><p><br></p>');
  n.content=cleanBodyHTML();
  try{
    const im=body.querySelector('img.note-img[data-id="'+f.id+'"]');
    if(im)im.src=await imageURL(f.id);
  }catch(e){}
  touch();renderMeta();renderPaperAttach();toast('图片已插入');
}
/* 非图片附件在正文光标处的内联位置标记（原子、不可编辑）：
   记录"附件在这段文字后"，供 RAG 切片关联与换机还原 */
function attachRefHTML(f){
  return '<span class="attref" contenteditable="false" data-fid="'+f.id
    +'" data-idx="'+(f.idx||'')+'" data-name="'+esc(f.name)+'">'
    +'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>'
    +'<span class="ar-name">'+esc(f.name)+'</span>'
    +'<span class="ar-idx">'+(f.idx||'')+'</span></span>';
}
function insertAttachRef(f){
  const body=$('#paperBody');body.focus();
  document.execCommand('insertHTML',false,attachRefHTML(f));
}
/* 关联一致性自愈：清理孤儿附件标记、为未内联的文档附件补位置标记（追加文末），
   保证换机/恢复后每个文档附件都有位置索引、无悬空引用 */
function fixAttachRefs(note){
  if(!note)return{added:0,removed:0};
  const d=document.createElement('div');d.innerHTML=note.content||'';
  const ids=new Set((note.files||[]).map(f=>f.id));
  let removed=0;
  d.querySelectorAll('.attref').forEach(s=>{
    if(!ids.has(s.getAttribute('data-fid'))){s.remove();removed++;}});
  const linked=new Set([...d.querySelectorAll('.attref')].map(s=>s.getAttribute('data-fid')));
  let added=0;
  (note.files||[]).forEach(f=>{
    if(f.hidden||f.kind==='image'||f.derivedOf)return;
    if(!linked.has(f.id)){
      const wrap=document.createElement('p');wrap.innerHTML=attachRefHTML(f);
      d.appendChild(wrap);added++;}
  });
  if(added||removed)note.content=d.innerHTML;
  return{added,removed};
}
/* 把旧版内嵌 base64 图片迁移为 Blob + data-id */
async function normalizeEmbeddedImages(n){
  if(!n.content||n.content.indexOf('src="data:')<0)return false;
  const d=document.createElement('div');d.innerHTML=n.content;
  let changed=false;
  for(const im of Array.from(d.querySelectorAll('img'))){
    const src=im.getAttribute('src')||'';
    if(src.indexOf('data:')===0){
      const fid=uid();
      const typ=(/data:(.*?);base64/.exec(src)||[])[1]||'image/jpeg';
      const f={id:fid,name:'图片.jpg',
        size:Math.max(1,Math.round(src.length*0.7)),
        type:typ,kind:'image',idx:nextFileIdx(n)};
      if(hasNative())
        await Native.call('putBlobFromDataUrl',JSON.stringify(
          {id:fid,dataUrl:src,name:f.name,type:typ}));
      else await Store.addBlob(fid,dataURLtoBlob(src));
      n.files.push(f);
      im.classList.add('note-img');
      im.setAttribute('data-id',fid);im.removeAttribute('src');
      changed=true;
    }
  }
  if(changed)n.content=d.innerHTML;
  return changed;
}
async function runImageMigration(){
  let any=false;
  for(const n of notes){if(await normalizeEmbeddedImages(n))any=true;}
  if(any)flushDisk();
}
/* 选文件附件 */
async function pickPaperFile(){
  const n=cur();
  if(hasNative())return nativePickFiles(n);
  const inp=document.createElement('input');inp.type='file';
  inp.style.display='none';document.body.appendChild(inp); /* 挂到 DOM，兼容部分机型 detached input 不弹窗 */
  inp.onchange=async()=>{
    const file=inp.files[0];inp.remove();
    if(!file)return;
    if(file.size>MAX_FILE){toast('文件不能超过 '+formatSize(MAX_FILE));return;}
    const f={id:uid(),name:file.name,size:file.size,
      type:file.type||'application/octet-stream',kind:fileKind(file.name),
      idx:nextFileIdx(n)};
    toast('正在添加文件…');
    await Store.addBlob(f.id,file);
    n.files.push(f);
    insertAttachRef(f);n.content=cleanBodyHTML();
    touch();renderPaperAttach();renderMeta();toast('文件已添加');
    scheduleDeriveMd(n,f);
  };
  inp.click();
}
async function nativePickFiles(n){
  try{
    const list=await Native.call('pickFiles',JSON.stringify({multiple:true}));
    if(!Array.isArray(list)||!list.length)return;
    let base=0;n.files.forEach(f=>{base=Math.max(base,parseInt(f.idx,10)||0);});
    list.forEach((f,k)=>{if(f.idx==null)f.idx=base+k+1;});
    n.files=n.files.concat(list);
    const body=$('#paperBody');body.focus();
    list.forEach(f=>document.execCommand('insertHTML',false,attachRefHTML(f)+' '));
    n.content=cleanBodyHTML();
    persist();renderPaperAttach();renderMeta();
    toast('已添加 '+list.length+' 个附件');
    list.forEach(f=>scheduleDeriveMd(n,f));
  }catch(e){if(e)toast(e.message||e);}
}
/* 附件大卡片 */
function attIcon(kind){
  const lab={pdf:'PDF',word:'DOC',excel:'XLS',audio:'MP3',video:'MP4',zip:'ZIP',file:'FILE'}[kind]||'FILE';
  return '<svg viewBox="0 0 48 48"><path d="M30 5H14a4 4 0 0 0-4 4v30a4 4 0 0 0 4 4h20a4 4 0 0 0 4-4V13z" fill="none" stroke="#fff" stroke-width="2.4" stroke-linejoin="round"/><path d="M30 5v8h8" fill="none" stroke="#fff" stroke-width="2.4" stroke-linejoin="round"/><text x="24" y="35" text-anchor="middle" font-size="9" font-weight="800" fill="#fff" font-family="Manrope,sans-serif">'+lab+'</text></svg>';
}
function renderPaperAttach(){
  const n=cur();const w=$('#paperAttach');
  /* hidden 的 Markdown 派生条目前台不展示，仅后台存取 */
  const list=n.files.filter(f=>f.kind!=='image'&&!f.hidden);
  if(!list.length){w.innerHTML='';return;}
  w.innerHTML=list.map((f,i)=>{
    return '<div class="pa-card">'
      +'<span class="pa-idx">'+String(i+1).padStart(2,'0')+'</span>'
      +'<div class="pa-txt" data-open="'+f.id+'"><b>'+esc(f.name)+'</b>'
      +'<small>'+formatSize(f.size)+'</small></div>'
      +'<button class="pa-md" data-md="'+f.id+'" aria-label="导出 Markdown">MD</button>'
      +'<div class="pa-ico" data-open="'+f.id+'" style="background:'+kindColor(f.kind)+'">'
      +attIcon(f.kind)+'</div>'
      +'<button class="pa-del" data-del="'+f.id+'">'+I.x+'</button></div>';}).join('');
  w.querySelectorAll('[data-open]').forEach(el=>{
    const f=n.files.find(x=>x.id===el.dataset.open);
    el.onclick=()=>f&&openAttachment(f);
  });
  w.querySelectorAll('[data-md]').forEach(b=>b.onclick=()=>{
    const f=n.files.find(x=>x.id===b.dataset.md);if(f)exportAttachmentMd(n,f);});
  w.querySelectorAll('[data-del]').forEach(b=>b.onclick=e=>{
    e.stopPropagation();
    const k=n.files.findIndex(x=>x.id===b.dataset.del);
    if(k<0)return;const f=n.files[k];
    n.files.splice(k,1);Store.removeBlob(f).catch(()=>{});
    /* 级联删除该附件派生的 Markdown */
    for(let i=n.files.length-1;i>=0;i--){const m=n.files[i];
      if(m.derivedOf===f.id){n.files.splice(i,1);Store.removeBlob(m).catch(()=>{});}}
    /* 级联移除正文里的位置标记 */
    $('#paperBody').querySelectorAll('.attref[data-fid="'+f.id+'"]').forEach(s=>s.remove());
    n.content=cleanBodyHTML();
    touch();renderPaperAttach();renderMeta();
  });
}
/* 正文图片浮动工具条（删除） */
let imgBarEl=null,imgBarTarget=null;
function ensureImgBar(){
  if(imgBarEl)return imgBarEl;
  imgBarEl=document.createElement('div');imgBarEl.id='imgBar';
  imgBarEl.innerHTML='<button type="button" id="imgBarView">查看</button>'
    +'<button type="button" id="imgBarDel">删除</button>';
  document.body.appendChild(imgBarEl);
  $('#imgBarDel').onclick=onImgBarDel;
  $('#imgBarView').onclick=onImgBarView;
  return imgBarEl;
}
function showImgBar(img){
  ensureImgBar();imgBarTarget=img;
  const r=img.getBoundingClientRect();
  imgBarEl.style.visibility='hidden';imgBarEl.style.display='flex';
  const bw=imgBarEl.offsetWidth;
  let left=Math.max(8,Math.min(innerWidth-bw-8,r.left+r.width/2-bw/2));
  let top=r.top-imgBarEl.offsetHeight-8;if(top<8)top=r.bottom+8;
  imgBarEl.style.left=left+'px';imgBarEl.style.top=top+'px';
  imgBarEl.style.visibility='visible';
}
function hideImgBar(){if(imgBarEl)imgBarEl.style.display='none';imgBarTarget=null;}
function onImgBarDel(){
  const img=imgBarTarget;if(!img)return;const n=cur();const fid=img.dataset.id;
  if(img.parentNode)img.parentNode.removeChild(img);
  for(let i=n.files.length-1;i>=0;i--){const x=n.files[i];
    if(x.id===fid||x.derivedOf===fid){n.files.splice(i,1);Store.removeBlob(x).catch(()=>{});}}
  hideImgBar();touch();renderPaperAttach();renderMeta();toast('图片已删除');
}
function onImgBarView(){
  const img=imgBarTarget;if(!img)return;
  hideImgBar();
  openImgViewer(img.dataset.id);
}
function initImgBar(){
  ensureImgBar();hideImgBar();const body=$('#paperBody');
  body.addEventListener('click',e=>{
    if(e.target&&e.target.tagName==='IMG'&&e.target.classList.contains('note-img')){
      e.preventDefault();showImgBar(e.target);}
    else hideImgBar();
    if(nbSugVisible())closeNbSuggest();});
}

/* ============ #11 正文图片大图查看器 ============
   双指缩放（以手指中点为锚）/ 单指平移（缩放后，边界回弹）/
   多图左右滑（方向锁定，弹簧切页）/ 下拉关闭（背景随下拉淡出）/ 双击放大复位。 */
let ivEl=null,ivState=null;
function ensureImgViewer(){
  if(ivEl)return ivEl;
  ivEl=document.createElement('div');ivEl.className='img-viewer';ivEl.id='imgViewer';
  ivEl.innerHTML='<div class="iv-bar"><button type="button" id="ivClose" aria-label="关闭">'
    +'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>'
    +'</button><span class="iv-idx" id="ivIdx"></span><span style="width:40px"></span></div>'
    +'<div class="iv-stage" id="ivStage"><div class="iv-strip" id="ivStrip"></div></div>'
    +'<div class="iv-hint">双指缩放 · 左右切换 · 下拉关闭</div>';
  document.body.appendChild(ivEl);
  $('#ivClose').onclick=closeImgViewer;
  bindImgViewer();
  return ivEl;
}
function openImgViewer(startId){
  const n=cur();if(!n)return;
  const ids=[...document.querySelectorAll('#paperBody img.note-img[data-id]')]
    .map(im=>im.dataset.id);
  if(!ids.length)return;
  let index=Math.max(0,ids.indexOf(startId));
  const el=ensureImgViewer();
  const strip=$('#ivStrip');
  strip.innerHTML=ids.map(id=>'<div class="iv-slide"><img alt="" data-id="'+id+'"></div>').join('');
  ids.forEach((id,k)=>{
    const slide=strip.children[k];
    const im=slide.querySelector('img');
    const failMsg=()=>{
      if(!im.getAttribute('src')){
        im.style.display='none';
        const p=document.createElement('div');
        p.style.cssText='color:#B8BEC8;font-size:14px;letter-spacing:.5px';
        p.textContent='图片加载失败';
        slide.appendChild(p);
      }
    };
    im.addEventListener('error',failMsg);
    imageURL(id).then(u=>{
      im.src=u;
      if(!u)failMsg();
    }).catch(failMsg);
  });
  ivState={ids,index,scale:1,tx:0,ty:0,dx:0,dy:0,
    pointers:new Map(),mode:null,startDist:0,startScale:1,startMid:null,
    lastT:0,velX:0,velY:0,lastX:0,lastY:0};
  applyIv(false);
  el.classList.add('show');
  hideImgBar();
  haptic(8);
  return false;
}
function closeImgViewer(){
  const el=ivEl||document.querySelector('.img-viewer');
  if(!el)return;
  el.classList.remove('show');
  ivState=null;
}
function curIvImg(){
  if(!ivState)return null;
  const slide=$('#ivStrip').children[ivState.index];
  return slide?slide.querySelector('img'):null;
}
function applyIv(animate){
  const st=ivState;if(!st)return;
  const strip=$('#ivStrip');
  if(!strip)return;
  const ease=reduceMotion()?'none':'transform .3s var(--ease-spring-soft)';
  strip.style.transition=animate?ease:'none';
  strip.style.transform='translateX(calc('+(-st.index*100)+'% + '+st.dx+'px))';
  const img=curIvImg();
  if(img){
    img.style.transition=animate?ease:'none';
    img.style.transform='translate('+st.tx+'px,'+st.ty+'px) scale('+st.scale+')';
  }
  ivEl.style.background='rgba(13,15,13,'+Math.max(0,1-(Math.abs(st.dy)||0)/innerHeight*1.4)+')';
  const idx=$('#ivIdx');
  if(idx)idx.textContent=st.ids.length>1?(st.index+1)+' / '+st.ids.length:'';
  const hint=ivEl.querySelector('.iv-hint');
  if(hint)hint.style.opacity=st.scale===1?'1':'0';
}
function resetIvZoom(animate){
  const st=ivState;if(!st)return;
  st.scale=1;st.tx=0;st.ty=0;
  applyIv(animate);
}
function bindImgViewer(){
  const stage=$('#ivStage');
  function dist(a,b){return Math.hypot(a.x-b.x,a.y-b.y);}
  function mid(a,b){return{x:(a.x+b.x)/2,y:(a.y+b.y)/2};}
  stage.addEventListener('pointerdown',e=>{
    const st=ivState;if(!st)return;
    try{stage.setPointerCapture(e.pointerId);}catch(_){}
    st.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    st.lastT=performance.now();st.velX=0;st.velY=0;st.lastX=e.clientX;st.lastY=e.clientY;
    if(st.pointers.size===2){
      /* 双指：进入缩放模式，记录初始距离与中点 */
      const pts=[...st.pointers.values()];
      st.mode='pinch';
      st.startDist=Math.max(1,dist(pts[0],pts[1]));
      st.startScale=st.scale;
      st.startMid=mid(pts[0],pts[1]);
      st.baseTx=st.tx;st.baseTy=st.ty;
      st.dx=0;st.dy=0;
    }else if(st.pointers.size===1){
      st.mode=st.scale>1?'pan':'locked';
      st.startX=e.clientX;st.startY=e.clientY;
      st.panMoved=false;
      st.lastTap=st.lastTap||0;
    }
  });
  stage.addEventListener('pointermove',e=>{
    const st=ivState;if(!st||!st.pointers.has(e.pointerId))return;
    const prev=st.pointers.get(e.pointerId);
    st.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    const now=performance.now(),dt=Math.max(1,now-st.lastT);
    st.velX=st.velX*.6+((e.clientX-st.lastX)/dt)*.4;
    st.velY=st.velY*.6+((e.clientY-st.lastY)/dt)*.4;
    st.lastX=e.clientX;st.lastY=e.clientY;st.lastT=now;
    if(st.mode==='pinch'&&st.pointers.size>=2){
      const pts=[...st.pointers.values()];
      const d=dist(pts[0],pts[1]);
      const m=mid(pts[0],pts[1]);
      const ns=Math.min(4,Math.max(0.8,st.startScale*d/st.startDist));
      /* 以中点为锚：缩放后中点保持在手指下 */
      const k=ns/st.scale;
      const cx=st.startMid.x-innerWidth/2,cy=st.startMid.y-innerHeight/2;
      st.tx=st.baseTx+(m.x-st.startMid.x)+(cx-(cx)*k);
      st.ty=st.baseTy+(m.y-st.startMid.y)+(cy-(cy)*k);
      st.scale=ns;
      applyIv(false);
    }else if(st.mode==='pan'){
      if(Math.abs(e.clientX-prev.x)>0.5||Math.abs(e.clientY-prev.y)>0.5)st.panMoved=true;
      st.tx+=e.clientX-prev.x;
      st.ty+=e.clientY-prev.y;
      clampPan(st,false);
      applyIv(false);
    }else if(st.mode==='locked'){
      const dx=e.clientX-st.startX,dy=e.clientY-st.startY;
      if(Math.abs(dx)>8||Math.abs(dy)>8){
        if(Math.abs(dx)>Math.abs(dy))st.mode='swipe';
        else st.mode='pull';
      }
      if(st.mode==='swipe'){
        /* 边界页横向阻尼（首页不允许继续右滑、末页不允许左滑） */
        st.dx=boundSwipe(dx,st.index,st.ids.length);
        applyIv(false);
      }else if(st.mode==='pull'){
        st.dy=Math.max(0,dy);st.dx=dx*.35;
        applyIv(false);
      }
    }
  });
  function endPointer(e){
    const st=ivState;if(!st)return;
    if(st.pointers.has(e.pointerId))st.pointers.delete(e.pointerId);
    if(st.mode==='pinch'&&st.pointers.size<2){
      if(st.scale<1){st.scale=1;st.tx=0;st.ty=0;applyIv(true);}
      else clampPan(st,true);
      st.mode=st.pointers.size===1?'pan':'locked';
      if(st.pointers.size===1)st.panMoved=false;
      if(st.pointers.size===0)return;
      return;
    }
    if(st.pointers.size>=1){st.mode='pan';return;}
    /* 平移态但完全没有移动：视为点按（双击缩放/单击工具栏） */
    if(st.mode==='pan'&&!st.panMoved)st.mode='locked';
    const vx=st.velX*1000,vy=st.velY*1000;
    if(st.mode==='swipe'){
      const W=innerWidth;
      if(st.dx<-W*.22||vx<-500){st.index=Math.min(st.ids.length-1,st.index+1);haptic(8);}
      else if(st.dx>W*.22||vx>500){st.index=Math.max(0,st.index-1);haptic(8);}
      resetIvZoom(false);
      st.dx=0;st.dy=0;
      applyIv(true);st.mode='locked';
    }else if(st.mode==='pull'){
      if(st.dy>innerHeight*.2||vy>500){closeImgViewer();return;}
      st.dy=0;st.dx=0;applyIv(true);st.mode='locked';
    }else if(st.mode==='locked'){
      /* 双击：以触点为锚放大/复位；单击：工具栏显隐 */
      const t=performance.now();
      if(st._lastTap&&t-st._lastTap<300){
        clearTimeout(st._tapTimer);st._lastTap=0;
        if(st.scale>1){st.scale=1;st.tx=0;st.ty=0;}
        else{
          const k=2.4;
          st.scale=k;
          const px=st.lastX-innerWidth/2,py=st.lastY-innerHeight/2;
          st.tx=-px*(k-1);st.ty=-py*(k-1);
        }
        haptic(10);
        applyIv(true);
      }else{
        st._lastTap=t;
        clearTimeout(st._tapTimer);
        st._tapTimer=setTimeout(()=>{
          if(ivEl)ivEl.classList.toggle('bar-hide');
        },230);
      }
    }
  }
  stage.addEventListener('pointerup',endPointer);
  stage.addEventListener('pointercancel',endPointer);
  /* 缩放后单指平移边界：不允许露出黑边，带回弹 */
  function clampPan(st,animate){
    const img=curIvImg();if(!img)return;
    const ar=img.getBoundingClientRect(); /* getBoundingClientRect 已含当前 scale */
    const iw=ar.width/2,ih=ar.height/2;
    const maxX=Math.max(0,iw-innerWidth/2),maxY=Math.max(0,ih-innerHeight/2);
    const cx=st.tx,cy=st.ty;
    st.tx=Math.max(-maxX,Math.min(maxX,cx));
    st.ty=Math.max(-maxY,Math.min(maxY,cy));
    if(animate&&(st.tx!==cx||st.ty!==cy))applyIv(true);
  }
  function boundSwipe(dx,index,count){
    if(index===0&&dx>0)return dx*.35;
    if(index===count-1&&dx<0)return dx*.35;
    return dx;
  }
}

/* ============ #10 正文 #笔记本 内联联想（光标旁浮层，选中后变标签、光标留后） ============ */
let nbSugEl=null,nbSugState=null;
function ensureNbSuggest(){
  if(nbSugEl)return nbSugEl;
  nbSugEl=document.createElement('div');nbSugEl.className='nb-suggest';
  nbSugEl.id='nbSuggest';
  document.body.appendChild(nbSugEl);
  return nbSugEl;
}
function nbSugVisible(){return !!nbSugEl&&nbSugEl.classList.contains('show');}
function closeNbSuggest(){
  if(nbSugEl)nbSugEl.classList.remove('show');
  nbSugState=null;
}
/* 读光标前的 #触发文本；返回 {node,hashStart,caret,query} 或 null */
function readNbTrigger(){
  const body=$('#paperBody');
  const sel=getSelection();
  if(!sel.rangeCount||!body.contains(sel.anchorNode))return null;
  const node=sel.anchorNode;
  if(node.nodeType!==3)return null;
  if(node.parentElement&&node.parentElement.closest('.nb-tag'))return null;
  const caret=sel.anchorOffset;
  const text=node.nodeValue.slice(0,caret);
  const m=text.match(/(^|[\s\n，。、,.；;：:（）()『』「」])#([^\s#，。、,.；;：:（）()]{0,12})$/);
  if(!m)return null;
  const hashStart=caret-(m[0].length-m[1].length);
  return {node,hashStart,caret,query:m[2]};
}
function nbCandidateList(){
  const names=[];
  (prefs.notebooks||[]).forEach(x=>{if(x&&!names.includes(x))names.push(x);});
  Object.keys(nbCounts()).forEach(x=>{if(x&&!names.includes(x))names.push(x);});
  return names;
}
function updateNbSuggest(){
  const ctx=readNbTrigger();
  if(!ctx){closeNbSuggest();return;}
  const q=ctx.query.trim();
  const all=nbCandidateList();
  let items=all.filter(n=>n.toLowerCase().includes(q.toLowerCase()));
  items.sort((a,b)=>{
    const sa=a.startsWith(q)?0:1,sb=b.startsWith(q)?0:1;
    return sa-sb||a.localeCompare(b,'zh');
  });
  if(q&&!all.some(n=>n===q))items.push('__new__');
  if(!items.length){closeNbSuggest();return;}
  nbSugState=Object.assign({},ctx,{items,index:0});
  renderNbSuggest();
  positionNbSuggest();
}
function renderNbSuggest(){
  const el=ensureNbSuggest(),st=nbSugState;
  const counts=nbCounts();
  el.innerHTML=st.items.map((it,i)=>{
    if(it==='__new__'){
      return '<button class="ns-item ns-new'+(i===st.index?' on':'')+'" data-i="'+i+'">'
        +'<span class="opt-ico" style="background:var(--pine-soft)">'+I.folder+'</span>'
        +'新建笔记本「'+esc(st.query)+'」</button>';
    }
    return '<button class="ns-item'+(i===st.index?' on':'')+'" data-i="'+i+'">'
      +'<span class="opt-ico" style="background:var(--pine-soft)">'+I.folder+'</span>'
      +'<span style="overflow:hidden;text-overflow:ellipsis">'+esc('#'+it)+'</span>'
      +'<span class="ns-cnt">'+(counts[it]||0)+'</span></button>';
  }).join('');
  el.querySelectorAll('.ns-item').forEach(b=>{
    b.onmousedown=e=>{e.preventDefault();chooseNbSuggest(+b.dataset.i);};
  });
  el.classList.add('show');
}
function positionNbSuggest(){
  const el=ensureNbSuggest(),st=nbSugState;if(!st)return;
  const r=document.createRange();
  r.setStart(st.node,st.hashStart);
  r.setEnd(st.node,st.caret);
  const rc=r.getBoundingClientRect();
  const maxW=Math.min(innerWidth-32,300);
  el.style.maxWidth=maxW+'px';
  el.classList.add('show');
  void el.offsetWidth;
  const w=el.offsetWidth,h=el.offsetHeight;
  let left=Math.max(12,Math.min(rc.left,innerWidth-w-12));
  let top=rc.bottom+8;
  if(top+h>innerHeight-8)top=Math.max(12,rc.top-h-8);
  el.style.left=left+'px';el.style.top=top+'px';
}
function chooseNbSuggest(i){
  const st=nbSugState;if(!st)return;
  let name=st.items[i];
  if(!name)return;
  if(name==='__new__'){
    name=st.query.trim();
    if(!name)return;
    if(!(prefs.notebooks||[]).includes(name)){
      prefs.notebooks=(prefs.notebooks||[]).concat(name);
      persistPrefs();
    }
  }
  /* 替换触发文本为标签 chip，光标落在标签后的空格之后 */
  const rng=document.createRange();
  rng.setStart(st.node,st.hashStart);rng.setEnd(st.node,st.caret);
  rng.deleteContents();
  const tag=document.createElement('span');
  tag.className='nb-tag';tag.contentEditable='false';tag.textContent='#'+name;
  const space=document.createTextNode('\u00A0');
  rng.insertNode(tag);
  tag.parentNode.insertBefore(space,tag.nextSibling);
  const nr=document.createRange();
  nr.setStart(space,1);nr.collapse(true);
  const sel=getSelection();sel.removeAllRanges();sel.addRange(nr);
  closeNbSuggest();
  const n=cur();if(n){n.content=$('#paperBody').innerHTML;touch();}
  haptic(12);
}
function nbSuggestKey(e){
  if(!nbSugVisible())return false;
  const st=nbSugState;
  if(e.key==='ArrowDown'){e.preventDefault();
    st.index=(st.index+1)%st.items.length;renderNbSuggest();return true;}
  if(e.key==='ArrowUp'){e.preventDefault();
    st.index=(st.index-1+st.items.length)%st.items.length;renderNbSuggest();return true;}
  if(e.key==='Enter'||e.key==='Tab'){e.preventDefault();chooseNbSuggest(st.index);return true;}
  if(e.key==='Escape'){e.preventDefault();closeNbSuggest();return true;}
  return false;
}
/* 导出某附件的 Markdown：原生写入「导出/Markdown」，网页侧直接下载 */
async function exportAttachmentMd(note,f){
  try{
    const md=await ensureAttachmentMd(note,f);
    if(!md){toast('该文件暂不支持文字提取');return;}
    const text=await (await attachmentBlob(md)).text();
    if(hasNative()){
      const r=await Native.call('exportMd',JSON.stringify({name:md.name,text}));
      toast('已导出到 '+(prefs.libName?'【'+prefs.libName+'】/':'')+(r.path||md.name));
    }else{
      const blob=new Blob([text],{type:'text/markdown'});
      const a=document.createElement('a');a.href=URL.createObjectURL(blob);
      a.download=md.name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),4000);
      toast('已导出 Markdown');
    }
    Logs.info('导出','附件 Markdown：'+md.name);
  }catch(e){toast('导出失败');Logs.error('导出','附件 Markdown 失败',(e&&e.message)||String(e));}
}
async function openAttachment(f){
  if(hasNative()){
    try{await Native.call('openFile',JSON.stringify({id:f.id}));}
    catch(e){toast(e.message||'无法打开文件');}
    return;
  }
  let url;
  try{url=await Store.blobURL(f);}catch(e){toast('文件读取失败');return;}
  if(f.kind==='pdf'||f.kind==='image'){
    const w=window.open('about:blank','_blank');
    if(w)w.location.href=url;else downloadURL(url,f.name);
  }else{downloadURL(url,f.name);toast('文件已下载，用对应应用打开');}
  setTimeout(()=>URL.revokeObjectURL(url),60000);
}
/* dock 与顶栏交互 */
function updateDockState(){
  const n=cur();if(!n)return;
  $('#dockTodo').classList.toggle('on',Array.isArray(n.todos)&&n.todos.length>0);
  $('#dockAI').classList.toggle('on',rtManual);
}
function bindEditChrome(){
  $('#editBack').onclick=leaveEditor;
  $('#editMore').onclick=openEditMore;
  $('#editShare').onclick=openShareSheet;
  $('#editUndo').onclick=()=>undo();
  $('#editRedo').onclick=()=>redo();
  $('#nbpClose').onclick=closeNotebookPicker;
  $('#nbpAll').onclick=()=>onNbPick(null);
  $('#nbpNew').onclick=createNotebook;
  $('#nbpSort').onclick=()=>{prefs.nbSort=prefs.nbSort==='name'?'count':'name';
    persistPrefs();renderNotebookList();};
  $('#dockAdd').onclick=openDockAdd;
  $('#dockTodo').onclick=()=>{closeActionSheet();addPaperTodo();};
  $('#dockAI').onclick=()=>{closeActionSheet();toggleRtManual();};
}
function toggleRtManual(){
  const n=cur();
  if(!n){toast('请先新建便签');return;}
  rtManual=!rtManual;updateDockState();
  document.body.classList.toggle('rt-manual',rtManual);
  if(rtManual){$('#paperBody').focus();positionManual();}
  else syncPrState();
}
const COLOR_LABEL={cream:'默认米白',yellow:'鹅黄',orange:'暖橙',pink:'樱粉',green:'青草',blue:'天青',purple:'藤紫'};
function openDockAdd(){
  openActionSheet([
    {icon:I.image,label:'插入图片',fn:pickPaperImage},
    {icon:I.clip,label:'添加文件（Word / Excel / PDF…）',fn:pickPaperFile},
    {icon:I.flag,label:'更换便签颜色',fn:openColorSheet},
  ],'插入与设置');
}
function openColorSheet(){
  const n=cur();
  openActionSheet(COLORS.map(c=>({dot:'var(--c-'+c+')',
    label:(COLOR_LABEL[c]||c)+(n.color===c?'（当前）':''),
    fn:()=>{n.color=c;touch();toast('颜色已更换');}})),'选择便签颜色');
}
function openEditMore(){
  const n=cur();
  const shareSvg='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/></svg>';
  openActionSheet([
    {icon:shareSvg,label:'分享 / 导出（长截图、PDF）',fn:openShareSheet},
    {icon:I.flag,label:n.pinned?'取消置顶':'置顶',
      fn:()=>{n.pinned=!n.pinned;touch();toast(n.pinned?'已置顶':'已取消置顶');}},
    {icon:I.folder,label:'移动到笔记本',fn:openNotebookPicker},
    {icon:I.trash,label:'删除',danger:true,fn:deleteCurrent},
  ],'更多操作');
}
function deleteCurrent(){
  const i=notes.findIndex(x=>x.id===editingId);if(i<0)return;
  const [removed]=notes.splice(i,1);
  removed.trashed=true;removed.trashedAt=Date.now();notes.push(removed);
  persist();go('home');
  Logs.info('便签','移入回收站',removed.title||removed.id);
  toast('已移入回收站',{label:'撤销',fn:()=>{
    const j=notes.findIndex(x=>x.id===removed.id);
    if(j>=0){const [r]=notes.splice(j,1);r.trashed=false;delete r.trashedAt;
      notes.splice(i,0,r);persist();renderHome();Logs.info('便签','撤销删除',r.title||r.id);}
  }});
}
/* 统一的“离开编辑”提交：空便签移除、有改动落盘；幂等，editingId 清空后直接返回 */
function commitEditor(){
  if(!editingId)return;
  _homeDirty=editingId;
  const n=notes.find(x=>x.id===editingId);
  if(n&&isEmptyNote(n))notes=notes.filter(x=>x.id!==n.id);
  editingId=null;
  if(_edDefer){clearTimeout(_edDefer);_edDefer=0;}
  /* 不再 hide-instant：交给导航转场（nav-leave 滑出），由 showScreen 在转场结束后隐藏 */
  rtManual=false;hideBar();document.body.classList.remove('rt-manual');
  $('#dockAI').classList.remove('on');$('#dockTodo').classList.remove('on');
  /* 离开编辑器时收走编辑器浮层（图片工具条/大图查看器/笔记本联想），避免残留盖在首页 */
  try{hideImgBar();}catch(_){}
  try{closeImgViewer();}catch(_){}
  try{closeNbSuggest();}catch(_){}
  /* 快速切换时合并落盘（防抖），避免每次往返都整库序列化+镜像；切后台/关闭由 visibilitychange/pagehide 强制 flush 兜底，数据不丢 */
  scheduleDisk();
}
function leaveEditor(){
  const target=editReturnHash;editReturnHash='';
  commitEditor();
  /* replace：历史栈不残留编辑页，主页再按返回即退出 App */
  location.replace(target||'#/home');
}
function openShareSheet(){
  openActionSheet([
    {icon:I.image,label:'导出整页长截图（PNG）',fn:exportLongImage},
    {icon:I.down,label:'导出 PDF 版',fn:exportPDF},
  ],'分享这页便签');
}
/* ============ 分享：长截图 / PDF ============ */
let _libsPromise=null;
function loadScript(src){
  return new Promise((res,rej)=>{const s=document.createElement('script');
    const to=setTimeout(()=>{s.remove();rej(new Error('加载超时'));},15000);
    s.src=src;s.onload=()=>{clearTimeout(to);res();};
    s.onerror=()=>{clearTimeout(to);rej(new Error('加载失败'));};
    document.head.appendChild(s);});
}
/* 依次尝试多个 CDN，任一成功即可 */
function loadFirst(srcs){
  return new Promise((res,rej)=>{let i=0;
    const next=()=>{if(i>=srcs.length){rej(new Error('组件加载失败，请检查网络后重试'));return;}
      loadScript(srcs[i++]).then(res).catch(next);};
    next();});
}
function ensureExportLibs(){
  if(_libsPromise)return _libsPromise;
  _libsPromise=loadFirst([
    'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
    'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js'])
  .then(()=>loadFirst([
    'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
    'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js']));
  return _libsPromise;
}
function safeExportName(){
  const n=cur();
  return (n.title||'便签').replace(/[\\/:*?"<>|]/g,'_').slice(0,30)||'便签';
}
function exportFileRow(f,src){
  if(f.kind==='image'&&src)
    return '<div style="margin:12px 0"><img src="'+src+'" style="max-width:100%;border-radius:12px;display:block"></div>';
  const lab={pdf:'PDF',word:'DOC',excel:'XLS',audio:'MP3',video:'MP4',zip:'ZIP',file:'FILE'}[f.kind]||'FILE';
  return '<div style="display:flex;align-items:center;gap:14px;background:#f3f5f1;border-radius:16px;padding:14px 16px;margin:9px 0">'
    +'<span style="width:48px;height:48px;border-radius:12px;background:'+kindColor(f.kind)
    +';color:#fff;font-size:9px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0">'+lab+'</span>'
    +'<span style="flex:1;min-width:0"><b style="display:block;font-size:16px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'
    +esc(f.name)+'</b><small style="display:block;color:#9aa096;font-size:12px;margin-top:3px">'
    +formatSize(f.size)+'</small></span></div>';
}
async function buildExportNode(){
  const n=cur();
  const node=document.createElement('div');
  node.style.cssText='position:fixed;left:-10000px;top:0;width:700px;background:#fff;'
    +'padding:46px 44px;font-family:"Noto Sans SC",sans-serif;color:#1d201c;box-sizing:border-box';
  let inner='<div style="font-size:13px;color:#9aa096;margin-bottom:20px">'+esc($('#paperMeta').textContent)+'</div>';
  inner+='<div style="font-size:32px;font-weight:900;line-height:1.3;margin-bottom:18px;color:#161815">'
    +esc(n.title||'无标题')+'</div>';
  if(n.type==='note')
    inner+='<div style="font-size:17px;line-height:1.85;word-break:break-word">'+(n.content||'')+'</div>';
  else
    inner+='<div style="margin-top:6px">'+n.todos.filter(t=>t.text.trim()).map(t=>
      '<div style="display:flex;align-items:center;gap:12px;padding:9px 0;font-size:16.5px">'
      +'<span style="width:22px;height:22px;border-radius:50%;border:2px '+(t.done?'solid #2f6b4f;background:#2f6b4f':'solid #b9bdb4')+';flex-shrink:0"></span>'
      +'<span style="'+(t.done?'text-decoration:line-through;color:#a9ada5':'')+'">'+esc(t.text)+'</span></div>').join('')+'</div>';
  if(n.files.length){
    let rows='';
    for(const f of n.files){
      let src=null;
      if(f.kind==='image'){try{src=await Store.blobURL(f);}catch(e){src=null;}}
      rows+=exportFileRow(f,src);
    }
    inner+='<div style="margin-top:22px">'+rows+'</div>';
  }
  node.innerHTML=inner;
  document.body.appendChild(node);
  const imgs=Array.from(node.querySelectorAll('img'));
  await Promise.all(imgs.map(im=>im.complete?null:new Promise(r=>{im.onload=r;im.onerror=r;})));
  return node;
}
async function nativeCapture(kind){
  await flushDisk(); // 导出前确保全部内容已落库（含镜像）
  if(!prefs.libName)toast('未绑定资料库，建议先在设置绑定以统一管理');
  document.body.classList.add('capturing');
  await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
  try{const cr=await Native.call('captureExport',{kind,name:safeExportName()});
    const root=prefs.libName?('【'+prefs.libName+'】/'):'';
    toast(cr&&cr.path?('已保存到 '+root+cr.path)
      :(kind==='png'?'长截图已保存':'PDF 已保存，可在所选位置查看'));}
  catch(e){toast((e&&e.message)||'导出失败');}
  document.body.classList.remove('capturing');
}
async function exportLongImage(){
  if(hasNative())return nativeCapture('png');
  toast('正在生成长截图…');
  try{
    await ensureExportLibs();
    const node=await buildExportNode();
    const cv=await html2canvas(node,{scale:2,backgroundColor:'#ffffff'});
    node.remove();
    downloadURL(cv.toDataURL('image/png'),safeExportName()+'.png');
    toast('长截图已导出');
  }catch(e){toast(e.message||'导出失败');}
}
function buildPdfFromCanvas(cv){
  const {jsPDF}=window.jspdf;
  const pdf=new jsPDF('p','mm','a4');
  const pw=210,pxPerMm=cv.width/pw,pageHpx=Math.floor(297*pxPerMm);
  let y=0,page=0;
  while(y<cv.height){
    const h=Math.min(pageHpx,cv.height-y);
    const c=document.createElement('canvas');
    c.width=cv.width;c.height=h;
    const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);
    x.drawImage(cv,0,y,cv.width,h,0,0,cv.width,h);
    if(page>0)pdf.addPage();
    pdf.addImage(c.toDataURL('image/jpeg',0.92),'JPEG',0,0,pw,h/pxPerMm);
    y+=h;page++;
  }
  pdf.save(safeExportName()+'.pdf');
  toast('PDF 已导出');
}
async function exportPDF(){
  if(hasNative())return nativeCapture('pdf');
  toast('正在生成 PDF…');
  try{
    await ensureExportLibs();
    const node=await buildExportNode();
    const cv=await html2canvas(node,{scale:2,backgroundColor:'#ffffff'});
    node.remove();
    buildPdfFromCanvas(cv);
  }catch(e){toast(e.message||'导出失败');}
}