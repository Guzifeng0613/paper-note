/* ============ 路由 ============ */
let editingId=null;let editReturnHash='';
function parseHash(){
  const h=(location.hash||'').replace(/^#\/?/,'');
  const [name,qs]=h.split('?');
  const p={};(qs||'').split('&').filter(Boolean).forEach(kv=>{const[k,v]=kv.split('=');p[k]=decodeURIComponent(v||'');});
  return {name:name||'home',params:p};
}
function go(name,query){location.hash='#/'+name+(query?('?'+query):'');}
/* ============ 导航栈 / 转场（push/pop，仅手机端） ============ */
let navStack=[];
let navGesture=false;     /* 本次 pop 由边缘跟手手势接管，转场由手势驱动 */
function showScreen(name){
  if(IS_DESKTOP)return deskShowScreen(name);
  name=name||'home';
  if(!$('#scr-'+name)){   /* 未知路由：回退到首页，避免 null.classList 报错 */
    if(name!=='home')location.replace('#/home');
    return;
  }
  const prev=navStack[navStack.length-1];
  const oldEl=prev?$('#scr-'+prev):null;
  const newEl=$('#scr-'+name);
  $('#fab').style.visibility=(name==='home')?'visible':'hidden';
  $('#scr-home').classList.toggle('behind',name!=='home');
  if(prev===name){newEl.classList.add('active');$('#app').scrollLeft=0;return;}
  let dir;
  const i=navStack.indexOf(name);
  if(i>=0){navStack=navStack.slice(0,i+1);dir=-1;}
  else{navStack.push(name);dir=1;}
  const rm=reduceMotion();
  $$('.screen').forEach(s=>s.classList.remove('nav-enter','nav-leave'));
  if(!oldEl){
    $$('.screen').forEach(s=>s.classList.remove('active','nav-under'));
    newEl.classList.add('active');
  } else if(dir>0){
    /* push：新屏从右滑入，旧屏原位可见（不位移） */
    oldEl.classList.add('nav-under');oldEl.classList.remove('active');
    newEl.classList.add('active');
    if(rm){oldEl.classList.remove('nav-under');}
    else{
      newEl.classList.add('nav-enter');void newEl.offsetWidth;
      requestAnimationFrame(()=>requestAnimationFrame(()=>newEl.classList.remove('nav-enter')));
      setTimeout(()=>{oldEl.classList.remove('nav-under');},420);
    }
    const body=newEl.querySelector('.screen-body');
    if(body){body.scrollTop=0;body.scrollLeft=0;}
  } else {
    /* pop：当前屏向右滑出，目标屏在原位 */
    newEl.classList.add('active');newEl.classList.remove('nav-under');
    if(!navGesture){
      if(rm)oldEl.classList.remove('active');
      else{
        oldEl.classList.remove('active');oldEl.classList.add('nav-leave');
        setTimeout(()=>oldEl.classList.remove('nav-leave'),420);
      }
    }
    /* navGesture=true：旧屏由手势自己的内联 transform 收尾，不碰它 */
    navGesture=false;
  }
  $('#app').scrollLeft=0;
}
/* ============ 左边缘跟手返回（手指 1:1 拖动；位移+速度+方向，可中途反向） ============ */
function initEdgeBack(){
  if(IS_DESKTOP)return;
  const EDGE=22, TH=0.25;
  let st=null;
  let edgeLockT=0; /* 最近一次左缘返回手势锁定的时间，用于抑制误触 click */
  const app=$('#app');
  let hint=document.createElement('div');hint.className='nav-edge-hint';app.appendChild(hint);
  /* 手势一旦锁定并拖动过，指尖在返回按钮附近抬手可能合成 click 导致"被点了一下"：
     锁定后 400ms 内捕获阶段吞掉落在屏幕内的合成点击（水平滑动非点击意图） */
  window.addEventListener('click',e=>{
    if(edgeLockT&&performance.now()-edgeLockT<150){
      e.stopPropagation();e.preventDefault();
    }
  },true);
  /* 150ms 后自然失效（只吞手势抬手合成的那一击，不影响后续正常点击） */
  const _abort=()=>{
    if(st&&st.locked){
      st.el.classList.remove('nav-dragging');
      if(st.under)st.under.classList.remove('nav-under');
      hint.classList.remove('show');
      st.el.style.transition='transform var(--dur-3) var(--ease-spring-soft)';
      st.el.style.transform='';
      setTimeout(()=>{st.el.style.transition='';st.el.style.zIndex='';},320);
    }
    st=null;
  };
  function anyOverlay(){
    return $('#noteAiPanel').classList.contains('open')
      || $('#chatDrawer').classList.contains('open')
      || $('#nbPicker').classList.contains('open')
      || $('#mask').classList.contains('show')
      || $('#modal').classList.contains('show')
      || document.querySelector('.img-viewer.show'); /* #11 大图查看器优先接管手势 */
  }
  function topEl(){const t=navStack[navStack.length-1];return t?$('#scr-'+t):null;}
  function underEl(){const u=navStack[navStack.length-2];return u?$('#scr-'+u):null;}
  window.addEventListener('pointerdown',e=>{
    if(navStack.length<1)return;
    const top=topEl();
    if(!top||top.id==='scr-home'||anyOverlay())return;
    if(e.clientX>EDGE)return;
    if(!underEl())return;
    if(e.pointerType==='mouse'&&e.button!==0)return;
    /* 起手点落在按钮/输入控件上（如返回键、主题分段按钮、列表行按钮）：
       不接管为返回手势，交给控件自身的点击处理 */
    if(e.target&&e.target.closest&&e.target.closest('button,a,input,textarea,select,.seg,.switch'))return;
    /* 多指时只认第一根；忽略非主键触摸（手掌/第二指） */
    if(st&&st.id!=null)return;
    st={id:e.pointerId,el:top,startX:e.clientX,startY:e.clientY,locked:false,
      dx:0,lastX:e.clientX,lastY:e.clientY,lastT:performance.now(),vel:0};
  },{passive:true});
  /* 抬手时指尖是否落在交互控件上（控件自己的点击应生效，不能触发返回） */
  function endOverControl(x,y){
    let el=null;
    try{el=document.elementFromPoint(x,y);}catch(_){return false;}
    return !!(el&&el.closest&&el.closest('button,a,input,textarea,select,.seg,.switch'));
  }
  window.addEventListener('pointermove',e=>{
    if(!st||e.pointerId!==st.id)return;
    const dx=e.clientX-st.startX,dy=e.clientY-st.startY;
    if(!st.locked){
      if(Math.abs(dx)<12&&Math.abs(dy)<12)return;
      /* 纵向滚动优先：横向意图必须明显（dx 大于纵向 1.6 倍且达到 12px），
         防止左缘纵向滚动/点按抖动误锁成返回手势 */
      if(Math.abs(dy)*1.6>Math.abs(dx)||Math.abs(dx)<12){st=null;return;}
      st.locked=true;st.under=underEl();
      if(st.under)st.under.classList.add('nav-under');
      st.el.classList.add('nav-dragging');st.el.style.zIndex='6';
      hint.classList.add('show');haptic(6);
    }else{
      /* 已锁定后轨迹转为明显纵向（拇指滚动），且未越过 1/3 屏宽：放弃手势，交回滚动 */
      if(Math.abs(dy)>2.2*Math.abs(dx)&&dx<window.innerWidth*0.3){_abort();return;}
    }
    const now=performance.now(),dt=Math.max(1,now-st.lastT);
    st.vel=st.vel*.5+((e.clientX-st.lastX)/dt)*.5;   /* px/ms，指数平滑 */
    st.lastX=e.clientX;st.lastY=e.clientY;st.lastT=now;
    /* 跟手：越往右阻尼越小（全程跟手），左越界硬止 */
    st.dx=Math.max(0,Math.min(window.innerWidth,dx));
    st.el.style.transform='translateX('+st.dx+'px)';
  },{passive:true});
  function finish(cancel){
    if(!st)return;const s=st;st=null;
    if(!s.locked){if(s.under)s.under.classList.remove('nav-under');return;}
    hint.classList.remove('show');
    /* 指尖落在按钮/分段控件上（例如从左缘拖到主题按钮再抬手）：
       判定为点按控件，取消返回，且不吞掉控件的 click */
    const onControl=endOverControl(s.lastX,s.lastY);
    if(!cancel&&onControl){cancel=true;}
    const velPxSec=s.vel*1000;
    /* 快速轻扫也必须至少走过 18% 屏宽，防止小幅度横向抖动误返回 */
    let commit=!cancel&&(s.dx>window.innerWidth*TH||(velPxSec>450&&s.dx>window.innerWidth*0.18));
    if(commit){
      edgeLockT=performance.now(); /* 真返回：吞掉抬手合成的 click */
    }else{
      if(s.under)s.under.classList.remove('nav-under');
      s.el.classList.remove('nav-dragging');
      s.el.style.transition='transform var(--dur-3) var(--ease-spring-soft)';
      s.el.style.transform='';
      setTimeout(()=>{s.el.style.transition='';s.el.style.zIndex='';},320);
      return;
    }
    s.el.classList.remove('nav-dragging');
    haptic(10);
    navGesture=true;
    s.el.style.transition='transform var(--dur-4) var(--ease-decel)';
    s.el.style.transform='translateX(100%)';
    s.el.style.zIndex='6';
    if(history.length>1)history.back();
    else{ /* 无历史时兜底：直接回首页并复位 */
      navGesture=false;
      go('home');
    }
    setTimeout(()=>{
      s.el.style.transition='';s.el.style.transform='';s.el.style.zIndex='';
      s.el.classList.remove('nav-leave','nav-under');
    },430);
  }
  window.addEventListener('pointerup',()=>finish(false));
  window.addEventListener('pointercancel',()=>finish(true));
}
/* 顶栏按钮的"滑动防误触"：在按钮上按下后移动超过 12px 视为滑动/滚动，
   吞掉抬手时合成的 click（手指在返回键上蹭到、滑出又滑回不会误触）；
   静止点按完全不受影响。 */
(function setupTopBarDragGuard(){
  const SLOP=12;
  const moved=new WeakMap();
  const start=new Map();
  window.addEventListener('pointerdown',e=>{
    const btn=e.target&&e.target.closest&&e.target.closest('.topbar button');
    if(!btn)return;
    start.set(e.pointerId,{x:e.clientX,y:e.clientY,btn});
    moved.delete(btn);
  },true);
  window.addEventListener('pointermove',e=>{
    const s=start.get(e.pointerId);
    if(!s)return;
    if(Math.hypot(e.clientX-s.x,e.clientY-s.y)>SLOP)moved.set(s.btn,true);
  },true);
  const clear=e=>{const s=start.get(e.pointerId);start.delete(e.pointerId);};
  window.addEventListener('pointerup',clear,true);
  window.addEventListener('pointercancel',clear,true);
  window.addEventListener('click',e=>{
    const btn=e.target&&e.target.closest&&e.target.closest('.topbar button');
    if(btn&&moved.get(btn)){
      e.stopPropagation();e.preventDefault();
      moved.delete(btn);
    }
  },true);
})();
window.addEventListener('hashchange',route);
/* ============ 边界阻尼（顶部/底部橡皮筋，非线性阻力，松手回弹） ============ */
function setupRubber(){
  if(IS_DESKTOP)return;
  const DAMP=.42,MAX=130;
  document.querySelectorAll('.screen-body,.paper-scroll,.nbp-scroll').forEach(el=>{
    if(el.__rb)return;el.__rb=1;
    let sy=0,locked=false;
    const release=()=>{
      el.style.transition='transform var(--dur-3) var(--ease-spring-soft)';
      el.style.transform='';
      setTimeout(()=>{el.style.transition='';el.style.transform='';},340);
    };
    el.addEventListener('touchstart',e=>{locked=false;sy=e.touches[0].clientY;},{passive:true});
    el.addEventListener('touchmove',e=>{
      if(reduceMotion())return;
      const dy=e.touches[0].clientY-sy;
      if(!locked){
        if(Math.abs(dy)<8)return;
        const atTop=el.scrollTop<=0;
        const atBottom=el.scrollTop+el.clientHeight>=el.scrollHeight-1;
        if(dy>0&&atTop)locked='top';
        else if(dy<0&&atBottom)locked='bottom';
        else return;
        el.style.transition='none';
      }
      e.preventDefault();  /* 阻止原生滚动与 overscroll 光晕，接管为橡皮筋 */
      const pull=Math.abs(e.touches[0].clientY-sy);
      const d=Math.min(MAX,pull*DAMP)*(locked==='top'?1:-1);
      el.style.transform='translateY('+d.toFixed(1)+'px)';
    },{passive:false});
    const end=()=>{if(locked){release();locked=false;}};
    el.addEventListener('touchend',end);
    el.addEventListener('touchcancel',end);
  });
}
/* 兜底：#app 不允许横向滚动（聚焦输入框在部分机型会把容器横向带偏） */
(function(){const a=$('#app');
  a.addEventListener('scroll',()=>{if(a.scrollLeft)a.scrollLeft=0;},{passive:true});})();
function route(){
  const {name,params}=parseHash();
  /* 兜底：任何路由变化都清掉可能残留的主题扩散克隆层与顶栏锁 */
  document.querySelectorAll('.trl').forEach(o=>o.remove());
  document.body.classList.remove('theme-reveal-on');
  _themeRevealToken++;
  if(editingId&&name!=='edit')commitEditor(); /* 系统返回键等绕过按钮的离开路径 */
  if(name!=='edit')setNativeMenuSuppressed(false);
  if(name==='edit'){const e=$('#scr-edit');if(e)e.classList.remove('hide-instant');editingId=params.id;renderEditor();}
  if(name==='trash')renderTrash();
  if(name==='settings')renderSettings();
  if(name==='pan')renderPan();
  if(name==='ai')renderAiList();
  if(name==='log')renderLog();
  if(name==='chat')openChatScreen();
  if(name==='search'){renderSearch();setTimeout(()=>{const i=$('#srInput');
    if(i){try{i.focus({preventScroll:true});}catch(e){i.focus();}$('#app').scrollLeft=0;}},150);}
  if(name==='home'){renderChips({bump:true});if(!patchHomeAfterEdit())renderNotes();}
  showScreen(name);
}
