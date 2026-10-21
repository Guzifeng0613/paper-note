(function(){
/* ============ 搜索工具 ============ */
function hl(text,q){
  text=esc(text);if(!q)return text;
  const qq=esc(q).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  try{return text.replace(new RegExp('('+qq+')','gi'),'<mark>$1</mark>');}catch(e){return text;}
}
function addRecent(q){
  prefs.recents=[q].concat(prefs.recents.filter(x=>x!==q)).slice(0,8);persistPrefs();
}
const scheduleRecents=debounce(addRecent,1200);
function searchHits(q){
  const ql=q.toLowerCase();
  return notes.filter(n=>{
    if(n.trashed)return false;
    return n.title.toLowerCase().includes(ql)
      ||n.files.some(f=>f.name.toLowerCase().includes(ql))
      ||(n.type==='note'
        ?stripHtml(n.content).toLowerCase().includes(ql)
        :n.todos.some(t=>t.text.toLowerCase().includes(ql)));
  }).sort((a,b)=>a.pinned===b.pinned?(b.updatedAt-a.updatedAt):(a.pinned?-1:1));
}

/* ============ 首页：筛选行 ============ */
function renderChips(opts){
  /* 首页这一行平铺笔记本列表，点击即切换 */
  const row=$('#chipsRow');if(!row)return;
  const bumpCounts=opts&&opts.bump;
  const prev=new Map();
  Array.from(row.querySelectorAll('.chip')).forEach(b=>{
    const r=b.getBoundingClientRect();
    const ne=b.querySelector('.n');
    prev.set(b.dataset.k,{left:r.left,count:ne?parseInt(ne.textContent)||0:null});
  });
  row.innerHTML='';
  const counts=nbCounts();
  const total=notes.filter(n=>!n.trashed).length;
  const names=[];
  (prefs.notebooks||[]).forEach(x=>{if(!names.includes(x))names.push(x);});
  Object.keys(counts).forEach(x=>{if(!names.includes(x))names.push(x);});
  names.sort((a,b)=>(counts[b]||0)-(counts[a]||0)||a.localeCompare(b,'zh'));
  const mk=(key,label,count)=>{
    const b=document.createElement('button');
    b.className='chip'+(((prefs.nbFilter||null)===(key||null))?' on':'');
    b.dataset.k=key||'';
    b.innerHTML='<span class="chip-ck">'+I.check+'</span>'+esc(label)+' <span class="n">'+count+'</span>';
    b.onclick=()=>setNbFilter(key);
    return b;
  };
  row.appendChild(mk(null,'全部',total));
  names.forEach(nm=>row.appendChild(mk(nm,nm,counts[nm]||0)));
  const add=document.createElement('button');
  add.className='nb-add';add.setAttribute('aria-label','新建笔记本');
  add.innerHTML=I.plus;
  add.onclick=()=>{nbPickerMode='filter';createNotebook();};
  row.appendChild(add);
  const on=row.querySelector('.chip.on');
  if(on){const r=on.getBoundingClientRect(),rr=row.getBoundingClientRect();
    if(r.left<rr.left||r.right>rr.right)on.scrollIntoView({block:'nearest',inline:'center'});}
  /* 重排 FLIP：笔记本增删/排序变化后，相邻 chip 平滑让位 */
  if(!reduceMotion())requestAnimationFrame(()=>{
    row.querySelectorAll('.chip').forEach(b=>{
      const p=prev.get(b.dataset.k);
      if(p){
        const a=b.getBoundingClientRect();const dx=p.left-a.left;
        if(Math.abs(dx)>1){
          b.style.transition='none';b.style.transform='translateX('+dx+'px)';void b.offsetWidth;
          b.style.transition='transform .26s var(--ease-spring-soft)';
          requestAnimationFrame(()=>b.style.transform='');
          setTimeout(()=>{b.style.transition='';b.style.transform='';},300);
        }
        if(bumpCounts&&p.count!==null&&p.count!==(parseInt(b.querySelector('.n').textContent)||0)){
          const ne=b.querySelector('.n');ne.classList.remove('n-bump');void ne.offsetWidth;ne.classList.add('n-bump');
        }
      }
    });
  });
}
/* 选中 chip 回弹（筛选切换时调用） */
function popSelectedChip(){
  if(reduceMotion())return;
  const on=$('#chipsRow .chip.on');if(!on)return;
  on.classList.remove('chip-pop');void on.offsetWidth;on.classList.add('chip-pop');
}

/* ============ 首页：便签墙 ============ */
const PRI_RANK={high:0,normal:1,low:2};
function visibleNotes(){
  let list=notes.filter(n=>!n.trashed);
  if(prefs.nbFilter)list=list.filter(n=>n.notebook===prefs.nbFilter);
  if(IS_DESKTOP&&_deskQuery){const ql=_deskQuery.toLowerCase();
    list=list.filter(n=>(n.title||'').toLowerCase().includes(ql)
      ||stripHtml(n.content).toLowerCase().includes(ql)
      ||(n.todos||[]).some(t=>(t.text||'').toLowerCase().includes(ql))
      ||(n.files||[]).some(f=>(f.name||'').toLowerCase().includes(ql)));}
  return list.sort((a,b)=>a.pinned===b.pinned?(b.updatedAt-a.updatedAt):(a.pinned?-1:1));
}
const RENDER_BATCH=240;
let _homeRendered=0,_renderLimit=RENDER_BATCH,_readyT=null,_homeDirty=null;
function renderNotes(noStagger){
  const wrap=$('#notesWrap');
  const all=visibleNotes();
  if(!all.length){
    wrap.className='notes-wrap';
    wrap.innerHTML=emptyHTML(
      prefs.nbFilter?'该笔记本还没有便签':'还没有便签',
      prefs.nbFilter?'换个笔记本看看，或新建便签。':'点右下角加号，写下第一张便签。',
      !prefs.nbFilter);
    return;
  }
  wrap.className='notes-wrap '+(IS_DESKTOP?'list':(prefs.view==='grid'?'grid':'list'));
  /* 渐进渲染：首屏只建前 _renderLimit 张，滚到底自动追加，避免上千卡一次性重建 */
  const list=all.slice(0,_renderLimit);
  let h=list.map(cardHTML).join('');
  if(all.length>list.length)h+='<div id="notesMore" class="notes-more">正在加载更多…</div>';
  wrap.innerHTML=h;
  /* 入场 stagger 仅在首次冷启动进主页保留；返回主页/筛选切换即时显示，消除“慢半拍” */
  const stagger=!noStagger&&!_homeRendered;_homeRendered=1;
  wrap.querySelectorAll('.note-card').forEach((el,i)=>{
    if(stagger)el.style.animationDelay=Math.min(i*22,200)+'ms';
    if(selectMode&&selected.has(el.dataset.id)){
      el.querySelector('.sel-circle').classList.add('on');
      el.classList.add('picked');
    }
  });
  /* 首次冷启动保留 stagger 入场，动画播完后置 ready；返回/筛选等非首次渲染直接 ready（不重放动画） */
  if(stagger){clearTimeout(_readyT);_readyT=setTimeout(()=>wrap.classList.add('ready'),650);}
  else wrap.classList.add('ready');
  if(all.length>list.length)_notesIO.observe($('#notesMore'));
  if(IS_DESKTOP&&editingId)deskMarkCurrent(editingId);
}
/* 编辑返回主页的轻量更新：只重建/移动被编辑那一张卡，避免全量 innerHTML 重建 N 张。
   仅处理“筛选/视图未变、卡片集合相同、仅内容或排序位置变化”的常见路径；任何更复杂情况返回 false，交 renderNotes 全量兜底。 */
function reconcileHomeCard(id){
  const wrap=$('#notesWrap');
  if(!_homeRendered)return false;
  if(wrap.querySelector('.empty'))return false;
  const all=visibleNotes();
  const viewCls='notes-wrap '+(IS_DESKTOP?'list':(prefs.view==='grid'?'grid':'list'));
  const domCards=Array.from(wrap.querySelectorAll('.note-card'));
  const domIds=domCards.map(c=>c.dataset.id);
  const n=all.find(x=>x.id===id);
  if(!n)return false;                                  /* 卡被删/为空被移除：全量（会正确处理 empty） */
  /* 期望已渲染集合：保持现有已渲染数量，取排序后的前 domCards.length 张 */
  const expectIds=all.slice(0,domCards.length).map(x=>x.id);
  if(expectIds.length!==domIds.length)return false;
  const sameSet=expectIds.every(x=>domIds.includes(x));
  if(!sameSet)return false;                            /* 集合变化（换笔记本/有新增补位等）：全量 */
  if(wrap.className!==viewCls)wrap.className=viewCls;
  /* 重建该卡（关闭其入场动画），从旧位置移除，按新排序插入正确位置 */
  const tmp=document.createElement('div');tmp.innerHTML=cardHTML(n);
  const newEl=tmp.firstElementChild;newEl.style.animation='none';
  const newIndex=expectIds.indexOf(id);
  const oldEl=wrap.querySelector('.note-card[data-id="'+id+'"]');
  if(oldEl)oldEl.remove();
  let ref=null;
  for(let i=newIndex+1;i<expectIds.length;i++){
    const f=wrap.querySelector('.note-card[data-id="'+expectIds[i]+'"]');
    if(f){ref=f;break;}
  }
  wrap.insertBefore(newEl,ref||$('#notesMore')||null);
  return true;
}
/* 返回主页时消费编辑脏标记；返回 true 表示已就地更新、跳过全量 renderNotes */
function patchHomeAfterEdit(){
  if(!_homeDirty)return false;
  const id=_homeDirty;_homeDirty=null;
  try{return reconcileHomeCard(id);}catch(e){console.warn('reconcile failed',e);return false;}
}
/* 哨兵进入视口前 600px 即追加下一批；纯文档流追加，滚动位置不跳、点击不错位 */
const _notesIO=new IntersectionObserver(es=>{
  if(!es.some(e=>e.isIntersecting))return;
  _renderLimit+=RENDER_BATCH;renderNotes(true);
},{root:null,rootMargin:'600px'});
function cardHTML(n){
  let preview,foot;
  if(n.type==='todo'){
    const done=n.todos.filter(t=>t.done).length,total=n.todos.length,pct=total?Math.round(done/total*100):0;
    const bodyText=stripHtml(n.content);
    if(bodyText){
      preview=esc(bodyText);
    }else{
      const undone=n.todos.filter(t=>!t.done).sort((a,b)=>(PRI_RANK[a.priority]??1)-(PRI_RANK[b.priority]??1));
      preview=total?(undone[0]?esc(undone[0].text):'全部事项已完成'):'暂无条目，点击添加';
    }
    foot='<span class="type-ico">'+I.todo+'待办'+attachMini(n)+'</span>'
      +'<span class="todo-progress"><span class="todo-bar"><i style="width:'+pct+'%"></i></span>'+done+'/'+total+'</span>';
  }else{
    let text=stripHtml(n.content);
    if(!text){
      if(/<img/.test(n.content))text=n.files.length?'[图片与附件]':'[图片]';
      else if(n.files.length)text=n.files.map(f=>f.name).join(' · ');
      else text='暂无内容';
    }
    preview=esc(text);
    foot='<span class="type-ico">'+(n.files.length?attachMini(n).trim():'')+'</span><span>'+fmtDate(n.updatedAt)+'</span>';
  }
  const _bg=IS_DESKTOP?'':' style="background:'+cardColor(n)+'"';
  return '<div class="note-card" data-id="'+n.id+'"'+_bg+'>'
    +'<span class="sel-circle">'+I.check+'</span>'
    +(n.pinned?'<span class="nc-pin">'+pinSvg()+'</span>':'')
    +'<div class="nc-title">'+esc(n.title||'无标题')+'</div>'
    +'<div class="nc-preview">'+preview+'</div>'
    +'<div class="nc-foot">'+foot+'</div></div>';
}
function pinSvg(){return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3h6l-1 7 3 3H7l3-3z"/><path d="M12 13v8"/></svg>';}
function attachMini(n){
  return n.files.length?' <span class="nc-attach">'+I.clip+n.files.length+'</span>':'';
}
function emptyHTML(title,txt,big){
  return '<div class="empty">'+(big?'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/></svg>':'')
    +'<h3>'+esc(title)+'</h3><p>'+esc(txt)+'</p></div>';
}
/* ============ 卡片点击 / 长按多选 ============ */
let selectMode=false,selected=new Set(),_justEnteredSel=0,_longPressEnterId=null;
const selNotes=()=>notes.filter(n=>selected.has(n.id));
/* 卡片交互统一委托：#notesWrap 上只绑一组监听，靠 data-id + 冒泡定位卡片，
   消除逐卡片 6 个监听器（N 卡从 6N 降到 6），渲染更快、内存更省。 */
function applyCardTilt(card,e){
  if(!card||reduceMotion())return;
  const r=card.getBoundingClientRect();
  const px=(e.clientX-r.left)/r.width,py=(e.clientY-r.top)/r.height;
  card.style.setProperty('--px',(px*100).toFixed(1)+'%');
  card.style.setProperty('--py',(py*100).toFixed(1)+'%');
  card.style.setProperty('--ry',((px-.5)*11).toFixed(2)+'deg');  /* 左右倾 ±5.5° */
  card.style.setProperty('--rx',((.5-py)*9).toFixed(2)+'deg');   /* 上下倾 ±4.5° */
  card.classList.add('pressing');
}
function clearCardTilt(card){
  if(!card)return;
  card.classList.remove('pressing');
  card.style.setProperty('--rx','0deg');card.style.setProperty('--ry','0deg');
}
function setupNotesDelegation(){
  const wrap=$('#notesWrap');let press=null;
  const cardFrom=el=>(el&&el.closest)?el.closest('.note-card'):null;
  wrap.addEventListener('pointerdown',e=>{
    const card=cardFrom(e.target);if(!card)return;
    if(selectMode)return;
    applyCardTilt(card,e);
    press={id:card.dataset.id,card:card,x:e.clientX,y:e.clientY,long:false,timer:null};
    press.timer=setTimeout(()=>{press.long=true;
      clearCardTilt(card);
      if(navigator.vibrate)navigator.vibrate(8);enterSelect(press.id);},450);
  });
  wrap.addEventListener('pointermove',e=>{
    if(press&&press.timer&&(Math.abs(e.clientX-press.x)>10||Math.abs(e.clientY-press.y)>10)){
      clearTimeout(press.timer);press.timer=null;clearCardTilt(press.card);}
  });
  const end=()=>{
    if(press){
      if(press.timer){clearTimeout(press.timer);press.timer=null;}
      clearCardTilt(press.card);
    }
  };
  wrap.addEventListener('pointerup',end);
  wrap.addEventListener('pointercancel',end);
  wrap.addEventListener('contextmenu',e=>{if(cardFrom(e.target))e.preventDefault();});
  wrap.addEventListener('click',e=>{
    const card=cardFrom(e.target);if(!card)return;
    const id=card.dataset.id;
    /* 长按抬手合成的 click 忽略 */
    if(press&&press.long){press.long=false;return;}
    if(selectMode){
      /* 仅一次性忽略“长按进入多选时落在触发卡上的合成 click”；其他卡立即响应，可快速连续加选 */
      if(_longPressEnterId&&id===_longPressEnterId&&Date.now()-_justEnteredSel<350){_longPressEnterId=null;return;}
      toggleSelect(id);
    }
    else {if(IS_DESKTOP)deskOpenNote(id);else go('edit','id='+id);}
  });
}
function enterSelect(id){
  selectMode=true;selected=new Set(id?[id]:[]);
  _longPressEnterId=id?(''+id):null;
  $('#homeTopbar').style.display='none';
  $('#contextBar').classList.add('show');
  $('#chipsRow').style.display='none';
  $('#fab').style.display='none';
  $('#scr-home').classList.add('select-mode');
  $('#batchBar').classList.add('show');
  _justEnteredSel=Date.now();
  renderNotes(true);updateSelCount();
  setNativeMenuSuppressed(true);
  if(hasNative())Native.call('setUiMode',{select:true}).catch(()=>{});
}
function exitSelect(skipRender){
  selectMode=false;selected.clear();
  $('#homeTopbar').style.display='';
  $('#contextBar').classList.remove('show');
  $('#chipsRow').style.display='';
  $('#scr-home').classList.remove('head-collapsed');
  $('#fab').style.display='';
  $('#scr-home').classList.remove('select-mode');
  $('#batchBar').classList.remove('show');
  if(!skipRender)renderNotes(true);
  setNativeMenuSuppressed(false);
  if(hasNative())Native.call('setUiMode',{select:false}).catch(()=>{});
}
/* 系统返回键在多选上下文中：先关弹层，再退出多选 */
window.__backInSelect=function(){
  if($('#modal').classList.contains('show')){closeModal();return;}
  var p=$('#nbPicker');if(p&&p.classList.contains('open')){closeNotebookPicker();return;}
  exitSelect();
};
function toggleSelect(id){
  if(selected.has(id))selected.delete(id);else selected.add(id);
  const card=$('.note-card[data-id="'+id+'"]');
  if(card){card.querySelector('.sel-circle').classList.toggle('on',selected.has(id));
    card.classList.toggle('picked',selected.has(id));
    if(navigator.vibrate)navigator.vibrate(6);}
  updateSelCount();
}
function updateSelCount(){$('#selCount').textContent='已选 '+selected.size+' 项';
  const vis=visibleNotes();
  $('#selectAll').classList.toggle('on',vis.length>0&&vis.every(n=>selected.has(n.id)));}
$('#exitSelect').onclick=()=>exitSelect();
$('#selectAll').onclick=()=>{
  const vis=visibleNotes();
  const all=vis.length>0&&vis.every(n=>selected.has(n.id));
  const cards=Array.from($$('#notesWrap .note-card'));
  const rm=reduceMotion();
  if(all){
    selected.clear();
    cards.forEach((el,i)=>{
      const circle=el.querySelector('.sel-circle');if(!circle)return;
      setTimeout(()=>{
        circle.classList.remove('on');circle.classList.add('stagger-off');
        el.classList.remove('picked');
        setTimeout(()=>circle.classList.remove('stagger-off'),200);
      },rm?0:i*15);
    });
    haptic(8);
  }else{
    vis.forEach(n=>selected.add(n.id));
    haptic(12);
    cards.forEach((el,i)=>{
      const circle=el.querySelector('.sel-circle');if(!circle)return;
      circle.classList.remove('stagger-off');
      setTimeout(()=>{
        circle.classList.add('on');el.classList.add('picked');
        el.classList.remove('pick-stagger');void el.offsetWidth;el.classList.add('pick-stagger');
        setTimeout(()=>el.classList.remove('pick-stagger'),320);
      },rm?0:i*26);
    });
  }
  updateSelCount();
};

/* ============ 飞行删除 / FLIP 补位 ============ */
/* 卡片贝塞尔曲线飞向目标按钮（WAAPI 多段关键帧，多卡错峰），结束后回调 */
function flyToTrash(cards,targetEl,cb){
  if(reduceMotion()||!targetEl||!Element.prototype.animate){cb&&cb();return;}
  const tr=targetEl.getBoundingClientRect();
  const tx=tr.left+tr.width/2,ty=tr.top+tr.height/2;
  let done=0;const total=cards.length;
  const finish=()=>{
    targetEl.classList.add('target-hit');haptic(18);
    setTimeout(()=>targetEl.classList.remove('target-hit'),420);
    cb&&cb();
  };
  cards.forEach((c,i)=>{
    const r=c.getBoundingClientRect();
    const cl=c.cloneNode(true);
    c.classList.add('flight-out');   /* 真卡先隐藏，克隆体接管视觉 */
    cl.classList.remove('flight-out');
    cl.style.cssText+='position:fixed;left:'+r.left+'px;top:'+r.top+'px;width:'+r.width+'px;height:'+r.height+'px;margin:0;z-index:300;pointer-events:none;box-shadow:var(--shadow-lg);will-change:transform,opacity;animation:none';
    document.body.appendChild(cl);
    const dx=tx-(r.left+r.width/2),dy=ty-(r.top+r.height/2);
    const delay=Math.min(i*26,180);
    const anim=cl.animate([
      {transform:'translate(0,0) scale(1) rotate(0)',opacity:1,easing:'cubic-bezier(.45,.1,.7,.4)'},
      {transform:'translate('+(dx*.55)+'px,'+(dy*.35-46)+'px) scale(.6) rotate(10deg)',opacity:.95,easing:'cubic-bezier(.5,.05,.8,.3)'},
      {transform:'translate('+dx+'px,'+dy+'px) scale(.08) rotate(24deg)',opacity:.08}
    ],{duration:480,delay:delay,fill:'forwards'});
    anim.onfinish=()=>{cl.remove();if(++done===total)finish();};
    anim.oncancel=()=>{cl.remove();if(++done===total)finish();};
  });
  if(!total)cb&&cb();
}
/* 带 FLIP 补位的首页重渲染：先记录卡片位置，重渲染后让其余卡片从旧位置平滑落位 */
function renderNotesWithFlip(){
  const wrap=$('#notesWrap');
  const snap=new Map();
  if(!reduceMotion()){
    wrap.querySelectorAll('.note-card').forEach(c=>{
      const r=c.getBoundingClientRect();snap.set(c.dataset.id,{left:r.left,top:r.top});
    });
  }
  renderNotes(true);
  if(reduceMotion())return;
  requestAnimationFrame(()=>{
    wrap.querySelectorAll('.note-card').forEach(c=>{
      const b=snap.get(c.dataset.id);if(!b)return;
      const a=c.getBoundingClientRect();
      const dx=b.left-a.left,dy=b.top-a.top;
      if(!dx&&!dy)return;
      const st=c.style;
      st.transition='none';st.transform='translate('+dx+'px,'+dy+'px)';void c.offsetWidth;
      st.transition='transform .34s var(--ease-spring-soft)';
      requestAnimationFrame(()=>st.transform='');
      setTimeout(()=>{st.transition='';st.transform='';},380);
    });
  });
}

/* ============ 批量操作 ============ */
function moveToTrash(ids){
  notes.forEach(n=>{if(ids.includes(n.id)){n.trashed=true;n.trashedAt=Date.now();}});
  persist();Logs.info('便签','批量移入回收站 '+ids.length+' 张',ids.join(','));
  toast('已放入回收站，保留 7 天',{label:'撤销',fn:()=>{
    notes.forEach(n=>{if(ids.includes(n.id)){n.trashed=false;n.trashedAt=null;}});
    persist();renderNotes();
  }});
}
$('#bbMove').onclick=()=>{if(!selected.size)return;openNotebookPicker('batch');};
$('#bbPin').onclick=()=>{
  const list=selNotes(),every=list.every(n=>n.pinned);
  list.forEach(n=>n.pinned=!every);
  persist();exitSelect();toast(every?'已取消置顶':'已置顶');
};
$('#bbDelete').onclick=()=>{
  const ids=Array.from(selected);if(!ids.length)return;
  const cards=ids.map(id=>$('#notesWrap .note-card[data-id="'+id+'"]')).filter(Boolean);
  const target=$('#bbDelete');
  const apply=()=>{moveToTrash(ids);exitSelect(true);renderNotesWithFlip();};
  if(!reduceMotion()&&cards.length)flyToTrash(cards,target,apply);
  else apply();
};
$('#bbColor').onclick=openBatchColor;
function openBatchColor(){
  openModal('<h3>设置便签颜色</h3><p>将 '+selected.size+' 张便签统一为所选颜色。</p>'
    +'<div class="color-row" style="justify-content:center;margin-bottom:16px">'
    +COLORS.map(c=>'<button class="color-dot" data-c="'+c+'" style="background:'+COLOR_CSS[c]+'"></button>').join('')
    +'</div><div class="modal-actions"><button class="btn-ghost" data-close>取消</button></div>');
  $('#modalBox').querySelectorAll('.color-dot').forEach(d=>d.onclick=()=>{
    selNotes().forEach(n=>n.color=d.dataset.c);
    persist();closeModal();renderNotes(true);toast('已更换颜色，可继续批量操作');
  });
}
/* ============ 首页搜索入口 → 统一搜索页 ============ */
document.querySelector('.search-entry').addEventListener('click',()=>{
  if(selectMode)return;
  if(IS_DESKTOP){const i=$('#homeSearch');if(document.activeElement!==i)i.focus();return;}
  location.hash='#/search';
});
$('#openChat').onclick=()=>{location.hash='#/chat';};
$('#chatNewTop').onclick=()=>startNewChat();
$('#cdSearch').addEventListener('input',()=>renderChatDrawer());
$('#chatMenu').onclick=()=>openChatDrawer();
$('#chatDeskBack').onclick=()=>go('home');
$('#cdClose').onclick=()=>closeChatDrawer();
$('#chatDrawerMask').onclick=()=>closeChatDrawer();
$('#chatInput').addEventListener('input',e=>autoGrowChat(e.target));
$('#chatInput').addEventListener('keydown',e=>{
  if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();sendChat();}
});
$('#chatSend').onclick=()=>sendChat();
$('#editNoteAI').onclick=()=>openNoteAi();
$('#naiBack').onclick=()=>closeNoteAi();
$('#noteAiMask').onclick=()=>closeNoteAi();
$('#naiSend').onclick=()=>sendNoteAi();
$('#naiInput').addEventListener('input',e=>autoGrowChat(e.target));
$('#naiInput').addEventListener('keydown',e=>{
  if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();sendNoteAi();}
});
/* ============ 统一搜索页事件 ============ */
$('#srBack').onclick=()=>location.hash='#/home';
$('#srClear').onclick=()=>{
  const i=$('#srInput');i.value='';$('#srClear').hidden=true;renderSearch();
  try{i.focus({preventScroll:true});}catch(e){i.focus();}$('#app').scrollLeft=0;};
$('#srInput').addEventListener('input',()=>{
  const q=$('#srInput').value;$('#srClear').hidden=!q;
  if(srMode==='search')renderSearch();
  else if(q.trim())srBody().innerHTML='<div class="sr-loading">按键盘“回车”检索知识库</div>';
  else renderSearch();
});
$('#srInput').addEventListener('keydown',e=>{
  if(e.key==='Enter'){e.preventDefault();runSrSubmit();}
});
$('#srSeg').querySelectorAll('button').forEach(b=>b.onclick=()=>{
  srMode=b.dataset.m;
  $('#srSeg').querySelectorAll('button').forEach(x=>x.classList.toggle('on',x===b));
  const q=srQ();
  if(srMode==='search'||!q)renderSearch();
  else srBody().innerHTML='<div class="sr-loading">按键盘“回车”检索知识库</div>';
});
$('#aiListBack').onclick=()=>location.hash='#/settings';
$('#aiAdd').onclick=()=>editAiCfg(null);
$('#logBack').onclick=()=>location.hash='#/settings';
$('#logExport').onclick=exportLogs;
$('#logFilter').querySelectorAll('button[data-lv]').forEach(b=>b.onclick=()=>{
  logLv=b.dataset.lv;
  $('#logFilter').querySelectorAll('button[data-lv]')
    .forEach(x=>x.classList.toggle('on',x===b));
  renderLog();
});
$('#logClear').onclick=()=>{
  openModal('<h3>清空日志？</h3><p>将清除全部运行日志，不影响便签数据。</p>'+
    '<div class="modal-actions"><button class="btn-ghost" data-close>取消</button>'+
    '<button class="btn-primary" id="lcOk">清空</button></div>');
  $('#lcOk').onclick=()=>{Logs.clear();closeModal();renderLog();toast('日志已清空');};
};
function srItem(n,q){
  let preview;
  if(n.type==='todo')preview=n.todos.map(t=>t.text).filter(Boolean).join(' · ')||'暂无条目';
  else{
    let text=stripHtml(n.content);
    if(!text){
      if(/<img/.test(n.content))text='[图片]';
      else if(n.files.length)text=n.files.map(f=>f.name).join(' · ');
      else text='暂无内容';
    }
    preview=text;
  }
  const isTodo=n.type==='todo';
  const icoBg=isTodo?'rgba(212,160,74,.15)':'rgba(47,107,79,.13)';
  const icoCol=isTodo?'#B07A2E':'var(--pine)';
  const meta=fmtDate(n.updatedAt);
  return '<button class="sr-item" data-id="'+n.id+'">'
    +'<div class="sri-ico" style="background:'+icoBg+';color:'+icoCol+'">'+(isTodo?I.todo:I.note)+'</div>'
    +'<div class="sri-main"><div class="sr-title">'+hl(n.title||'无标题',q)+'</div>'
    +'<div class="sr-preview">'+hl(preview,q)+'</div>'
    +'<div class="sr-meta">'+hl(meta,q)+'</div></div>'
    +'<span class="sri-go"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg></span></button>';
}
})();
