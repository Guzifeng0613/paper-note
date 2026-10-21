/* ============================================================
   v16-anim.js —— 16 项动效的真实迁移层（独立文件，不改动业务逻辑）
   通过事件委托/自定义事件挂接稳定元素；所有动效过 reduced-motion 降级。
   耦合点约定（业务侧 dispatch，本层监听）：
     window.dispatchEvent(new CustomEvent('v16:before-delete',{detail:{paths:[...], done:fn}}))
   本层在完成删除动画（飞至回收站）后调用 done()；未监听或降级时业务侧自行继续。
   覆盖：#2 触点倾斜  #3 chip三连  #4 曲线飞行删除  #5 错峰勾选  #6 边界阻尼
         #7 待办弹簧拖拽  #8 勾选三连  #9 字号刻度尺  #10 内联联想
         #11 大图查看器  #12 删除收拢  #13 Press-to-Cancel  #15 手风琴  #16 进度条弹性收尾
   （#1 跟手返回 / #14 主题圆形扩散 业务侧已实现，本层不重复）
   ============================================================ */
(function(){
'use strict';
const reduceMotion = ()=> window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const haptic = (ms)=>{ try{ if(navigator.vibrate) navigator.vibrate(ms); }catch(e){} };
const $  = (s, r)=> (r||document).querySelector(s);
const $$ = (s, r)=> Array.from((r||document).querySelectorAll(s));
const escHtml = (s)=> String(s==null?'':s).replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const cssescAttr = (s)=> String(s).replace(/\\/g,'\\\\').replace(/"/g,'\\"');

/* ============================================================
   #2 触点倾斜：卡片按下随触点轻微 3D 倾斜（rotateX/Y 跟手）
   ============================================================ */
function initTilt(){
  let active = null;
  document.addEventListener('pointerdown', (e)=>{
    if(reduceMotion()) return;
    const card = e.target && e.target.closest && e.target.closest('#v16Body .v16-note-card, #v16Body .v16-folder-card');
    if(!card) return;
    active = { card, pid:e.pointerId };
    paintTilt(card, e.clientX, e.clientY);
    card.classList.add('v16-tilt');
  });
  window.addEventListener('pointermove', (e)=>{
    if(!active || e.pointerId!==active.pid) return;
    paintTilt(active.card, e.clientX, e.clientY);
  });
  const up = (e)=>{
    if(!active || e.pointerId!==active.pid) return;
    active.card.classList.remove('v16-tilt');
    active = null;
  };
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', up);
  function paintTilt(card, cx, cy){
    const r = card.getBoundingClientRect();
    const px = (cx - r.left)/r.width  - .5;   /* -0.5 .. 0.5 */
    const py = (cy - r.top) /r.height - .5;
    card.style.setProperty('--vtilt-x', (py*-4.5).toFixed(2)+'deg');
    card.style.setProperty('--vtilt-y', (px*5.5).toFixed(2)+'deg');
  }
}

/* ============================================================
   #3 chip 三连：点按 .v16cdot → 收缩→回弹→回落 三段式缩放
   ============================================================ */
function initChip(){
  document.addEventListener('pointerdown', (e)=>{
    if(reduceMotion()) return;
    const chip = e.target && e.target.closest && e.target.closest('.v16cdot');
    if(!chip) return;
    chip.classList.remove('v16-chip-pop');
    void chip.offsetWidth;                 /* 重置动画 */
    chip.classList.add('v16-chip-pop');
  });
  document.addEventListener('animationend', (e)=>{
    const t = e.target;
    if(t && t.classList && t.classList.contains('v16-chip-pop')) t.classList.remove('v16-chip-pop');
  });
}

/* ============================================================
   #4 曲线飞行删除（WAAPI 贝塞尔三段关键帧）+ #12 删除收拢（FLIP 补位）
   监听 'v16:before-delete' {paths, done}；未 dispatch 时业务照常。
   ============================================================ */
function initDeleteFx(){
  function snapAll(){
    const body = document.getElementById('v16Body');
    const m = new Map();
    if(!body) return m;
    $$('#v16Body .v16-note-card, #v16Body .v16-folder-card').forEach(el=>{
      const k = el.dataset.path || el.dataset.folder;
      if(k!=null) m.set(k, el.getBoundingClientRect());
    });
    return m;
  }
  window.addEventListener('v16:before-delete', (ev)=>{
    const det = ev.detail || {};
    const done = typeof det.done === 'function' ? det.done : null;
    const paths = det.paths || [];
    const body = document.getElementById('v16Body');
    if(!body || reduceMotion() || !paths.length){ if(done) done(); return; }
    const before = snapAll();
    const cards = [];
    paths.forEach(p=>{
      const el = body.querySelector('.v16-note-card[data-path="'+cssescAttr(p)+'"], .v16-folder-card[data-folder="'+cssescAttr(p)+'"]');
      if(el) cards.push(el);
    });
    if(!cards.length){ if(done) done(); return; }
    haptic(10);
    const tx = window.innerWidth - 56, ty = window.innerHeight - 76;   /* 回收站/FAB 落点 */
    let finished = 0;
    cards.forEach((card, i)=>{
      const r0 = card.getBoundingClientRect();
      const dx = tx - (r0.left + r0.width/2);
      const dy = ty - (r0.top  + r0.height/2);
      card.style.zIndex = '6';
      card.style.pointerEvents = 'none';
      const anim = card.animate([
        { transform:'translate(0px,0px) scale(1)', opacity:1, offset:0 },
        { transform:'translate('+(dx*.55).toFixed(1)+'px,'+(dy*.6-36).toFixed(1)+'px) scale(.82)', opacity:.92, offset:.55 },
        { transform:'translate('+dx.toFixed(1)+'px,'+dy.toFixed(1)+'px) scale(.3)', opacity:0, offset:1 }
      ], { duration:420, delay:i*70, easing:'cubic-bezier(.45,0,.8,.6)', fill:'forwards' });
      anim.onfinish = ()=>{
        card.style.visibility = 'hidden';
        if(++finished === cards.length && done){
          done();                             /* 业务侧真正删除 + renderHome() */
          /* #12 收拢：业务重渲染后，同 key 卡片位移差值用 FLIP 动画补位 */
          requestAnimationFrame(()=>requestAnimationFrame(()=>{
            $$('#v16Body .v16-note-card, #v16Body .v16-folder-card').forEach(el=>{
              const k = el.dataset.path || el.dataset.folder;
              const old = before.get(k);
              if(!old) return;
              const r1 = el.getBoundingClientRect();
              const ddx = old.left - r1.left, ddy = old.top - r1.top;
              if(Math.abs(ddx)>2 || Math.abs(ddy)>2){
                el.animate([
                  { transform:'translate('+ddx.toFixed(1)+'px,'+ddy.toFixed(1)+'px)' },
                  { transform:'translate(0px,0px)' }
                ], { duration:380, easing:'cubic-bezier(.22,1,.36,1)' });
              }
            });
          }));
        }
      };
    });
  });
}

/* ============================================================
   #8 勾选三连（缩放弹出 + 划线画出 + 弱化）+ #5 错峰勾选（批量 done 错峰延迟）
   MutationObserver 监听编辑器待办列表重渲染（业务 toggleTodo 后 innerHTML 替换），
   仅给「新变为已勾选」的 li 打 class，不改写 DOM 文本，不影响 htmlToMD 序列化。
   ============================================================ */
function initTodoCheckFx(){
  function refresh(){
    const b = document.getElementById('v16EdBody');
    if(!b) return;
    const doneLis = [];
    $$('li.v16-todo-li', b).forEach(li=>{
      const cb = li.querySelector('input.v16-ed-todoinput');
      const isDone = !!(cb && (cb.checked || cb.hasAttribute('checked')));
      if(isDone){ li.classList.add('v16-li-done'); doneLis.push(li); }
      else li.classList.remove('v16-li-done','v16-todo-pop');
    });
    if(reduceMotion()) return;
    /* 错峰：本批次新 done 的 li 按序号递增 animation-delay */
    doneLis.forEach((li, idx)=>{
      if(li.classList.contains('v16-todo-pop')) return;
      li.style.animationDelay = (idx*70)+'ms';
      li.classList.add('v16-todo-pop');
    });
  }
  const mo = new MutationObserver(()=>{
    requestAnimationFrame(refresh);   /* 业务重渲染/勾选属性变化后下一帧刷新 */
  });
  function start(){
    if(document.body) mo.observe(document.body, { childList:true, subtree:true, attributes:true, attributeFilter:['checked','class'] });
  }
  if(document.body) start(); else document.addEventListener('DOMContentLoaded', start);
}

/* ============================================================
   #6 边界阻尼：#v16Body / #v16EdScroll 滚到顶/底时橡皮筋回弹
   ============================================================ */
function initRubber(){
  function bind(scroller){
    if(!scroller || scroller._v16Band) return;
    scroller._v16Band = true;
    let startY = 0, startTop = 0, pulling = false;
    const release = ()=>{
      if(!pulling) return;
      pulling = false;
      scroller.style.transition = 'transform .38s cubic-bezier(.22,1,.36,1)';
      scroller.style.transform = '';
    };
    scroller.addEventListener('touchstart', (e)=>{
      const t = e.touches[0]; if(!t) return;
      startY = t.clientY; startTop = scroller.scrollTop; pulling = false;
    }, {passive:true});
    scroller.addEventListener('touchmove', (e)=>{
      if(reduceMotion()) return;
      const t = e.touches[0]; if(!t) return;
      const dy = t.clientY - startY;
      const max = scroller.scrollHeight - scroller.clientHeight;
      const atTop = startTop <= 0, atBottom = startTop >= max - 1;
      if((atTop && dy > 0) || (atBottom && dy < 0)){
        e.preventDefault();
        pulling = true;
        haptic(4);
        scroller.style.transition = 'none';
        scroller.style.transform = 'translateY('+(dy*.35).toFixed(1)+'px)';
      }
    }, {passive:false});
    scroller.addEventListener('touchend', release);
    scroller.addEventListener('touchcancel', release);
    /* 滚轮路径（桌面调试/远程）：边界 wheel 同样给出阻尼 */
    let wheelTimer = 0;
    scroller.addEventListener('wheel', (e)=>{
      if(reduceMotion()) return;
      const max = scroller.scrollHeight - scroller.clientHeight;
      const atTop = scroller.scrollTop <= 0, atBottom = scroller.scrollTop >= max - 1;
      if((atTop && e.deltaY < 0) || (atBottom && e.deltaY > 0)){
        e.preventDefault();
        pulling = true;
        scroller.style.transition = 'none';
        scroller.style.transform = 'translateY('+(e.deltaY*.18).toFixed(1)+'px)';
        clearTimeout(wheelTimer);
        wheelTimer = setTimeout(release, 120);
      }
    }, {passive:false});
  }
  function scan(){
    bind(document.getElementById('v16Body'));
    bind(document.getElementById('v16EdScroll'));
  }
  scan();
  window.addEventListener('v16:ready', scan);
  setTimeout(scan, 1200);   /* 兜底：滚动容器稍后出现再绑 */
}

/* ============================================================
   #7 待办弹簧拖拽：按下待办文本→抬起跟手（弹簧滞后）→松手过冲归位
   仅视觉，不改 DOM 顺序、不写盘（业务无 reorder API）。
   ============================================================ */
function initTodoDrag(){
  let drag = null;
  document.addEventListener('pointerdown', (e)=>{
    if(reduceMotion()) return;
    if(e.target.closest && e.target.closest('input,textarea,.md-prio-tag')) return;
    const li = e.target.closest && e.target.closest('#v16EdBody li.v16-todo-li');
    if(!li) return;
    drag = { li, pid:e.pointerId, startY:e.clientY, targetY:0, renderY:0, on:false, raf:0 };
  });
  window.addEventListener('pointermove', (e)=>{
    if(!drag || e.pointerId!==drag.pid) return;
    const d = drag;
    const dy = e.clientY - d.startY;
    if(!d.on){
      if(Math.abs(dy) < 10) return;
      d.on = true;
      d.renderY = 0; d.targetY = dy;
      d.li.classList.add('v16-li-dragging');
      d.li.style.transition = 'none';
      haptic(8);
    }
    d.targetY = dy;
    if(!d.raf){
      const step = ()=>{
        if(!drag) return;
        drag.renderY += (drag.targetY - drag.renderY) * .22;   /* 弹簧滞后 */
        drag.li.style.transform = 'translateY('+drag.renderY.toFixed(1)+'px) scale(1.02)';
        if(Math.abs(drag.targetY - drag.renderY) > .6) drag.raf = requestAnimationFrame(step);
        else { drag.raf = 0; drag.li.style.transform = 'translateY('+drag.targetY.toFixed(1)+'px) scale(1.02)'; }
      };
      d.raf = requestAnimationFrame(step);
    }
  });
  const endDrag = (e)=>{
    if(!drag || e.pointerId!==drag.pid) return;
    const d = drag; drag = null;
    if(d.raf) cancelAnimationFrame(d.raf);
    if(!d.on){ d.li.classList.remove('v16-li-dragging'); return; }
    /* 松手：回弹过渡带回弹过冲 */
    d.li.style.transition = 'transform .45s cubic-bezier(.34,1.56,.64,1)';
    d.li.style.transform = 'translateY(0px) scale(1)';
    haptic(6);
    setTimeout(()=>{
      d.li.classList.remove('v16-li-dragging');
      d.li.style.transition = ''; d.li.style.transform = '';
    }, 480);
  };
  window.addEventListener('pointerup', endDrag);
  window.addEventListener('pointercancel', endDrag);
}

/* ============================================================
   #9 字号刻度尺：捕获点击设置行 data-row=fontscale → 调起 v15 真实刻度尺
   （theme.js openFontSizeSheet：拖动实时改 documentElement.style.zoom，松手吸附刻度）
   ============================================================ */
function initFontRuler(){
  document.addEventListener('click', (e)=>{
    const row = e.target && e.target.closest && e.target.closest('.v16-row[data-row="fontscale"]');
    if(!row) return;
    e.stopPropagation(); e.preventDefault();
    if(typeof openFontSizeSheet === 'function'){
      try{ openFontSizeSheet(); }catch(err){ console.warn('font ruler failed', err); }
    }
  }, true);
}

/* ============================================================
   #10 正文 #笔记本/文件夹 内联联想：光标旁浮层，选中即替换触发文本
   候选 = Vault.tree() 中已有文件夹名；动画：淡入+下滑 120ms。
   ============================================================ */
function initNbSuggest(){
  const el = document.createElement('div');
  el.id = 'v16NbSuggest';
  el.className = 'v16-nb-sug';
  document.body.appendChild(el);
  let state = null;
  function folderNames(){
    const names = [];
    try{
      if(window.Vault && Vault.tree){
        (function walk(n){ if(n && n.name) names.push(n.name); (n.children||[]).forEach(walk); })(Vault.tree());
      }
    }catch(_){}
    return names;
  }
  function readCtx(){
    const b = document.getElementById('v16EdBody');
    const sel = window.getSelection && getSelection();
    if(!sel || !sel.rangeCount || !b || !b.contains(sel.anchorNode)) return null;
    const node = sel.anchorNode;
    if(node.nodeType !== 3) return null;
    if(node.parentElement && node.parentElement.closest('.nb-tag')) return null;
    const caret = sel.anchorOffset;
    const text = node.nodeValue.slice(0, caret);
    const m = text.match(/(^|[\s\n，。、,.；;：:（）()『』「」])#([^\s#，。、,.；;：:（）()]{0,12})$/);
    if(!m) return null;
    return { node, hashStart: caret - (m[0].length - m[1].length), caret, query: m[2] };
  }
  function choose(btn){
    const st = state; if(!st) return;
    const name = btn.dataset.nm;
    if(!name) return;
    /* 文本节点切分替换：#query → #name ，光标留在其后 */
    const q = st.node;
    const head = q.nodeValue.slice(0, st.hashStart);
    const tail = q.nodeValue.slice(st.caret);
    q.nodeValue = head;
    const added = document.createTextNode('#'+name+' ');
    const tailNode = document.createTextNode(tail);
    q.parentNode.insertBefore(added, q.nextSibling);
    q.parentNode.insertBefore(tailNode, added.nextSibling);
    el.classList.remove('show');
    state = null;
    const sel = getSelection();
    const rng = document.createRange();
    rng.setStart(tailNode, 0); rng.collapse(true);
    sel.removeAllRanges(); sel.addRange(rng);
  }
  function update(){
    const ctx = readCtx();
    if(!ctx){ el.classList.remove('show'); state = null; return; }
    const q = ctx.query.trim();
    let items = folderNames().filter(n => n && n.toLowerCase().includes(q.toLowerCase()));
    items.sort((a,b)=> (a.startsWith(q)?0:1)-(b.startsWith(q)?0:1) || a.localeCompare(b,'zh'));
    if(q && !items.some(n=>n===q)) items.push('__new__:'+q);
    if(!items.length){ el.classList.remove('show'); state = null; return; }
    state = ctx;
    el.innerHTML = items.map(it=>{
      if(it.indexOf('__new__:')===0){
        return '<button class="v16-ns-item" data-nm="'+escHtml(it.slice(7))+'"><span class="v16-ns-ic">＋</span>新建「'+escHtml(it.slice(7))+'」</button>';
      }
      return '<button class="v16-ns-item" data-nm="'+escHtml(it)+'"><span class="v16-ns-ic">▸</span>#'+escHtml(it)+'</button>';
    }).join('');
    el.querySelectorAll('.v16-ns-item').forEach(bn=>{
      bn.onmousedown = (ev)=>{ ev.preventDefault(); choose(bn); };
    });
    /* 定位到光标处 */
    const r = document.createRange();
    r.setStart(ctx.node, ctx.hashStart); r.setEnd(ctx.node, ctx.caret);
    const rc = r.getBoundingClientRect();
    el.style.left = Math.max(8, Math.min(rc.left, window.innerWidth - 198)) + 'px';
    el.style.top = (rc.bottom + 6) + 'px';
    el.classList.add('show');
  }
  document.addEventListener('input', (e)=>{
    if(!(e.target && e.target.id === 'v16EdBody')) return;
    if(reduceMotion()){ el.classList.remove('show'); return; }
    update();
  });
  document.addEventListener('selectionchange', ()=>{
    const ae = document.activeElement;
    if(ae && ae.id === 'v16EdBody' && !reduceMotion()) update();
  });
}

/* ============================================================
   #11 大图查看器：双击/双指缩放、左右分页（单图边界阻尼）
   挂接 #v16ImgViewer；打开时从编辑器正文收集图片页。
   ============================================================ */
function initImgViewer(){
  const viewerEl = document.getElementById('v16ImgViewer');
  if(!viewerEl){
    /* v16root 由 boot 异步挂载；观察 body 直到查看器出现再初始化 */
    const wait = new MutationObserver(()=>{
      if(document.getElementById('v16ImgViewer')){ wait.disconnect(); initImgViewer(); }
    });
    wait.observe(document.body, { childList:true, subtree:true });
    return;
  }
  const im = ()=> document.getElementById('v16Img');
  function freshState(){ return { scale:1, tx:0, ty:0, swipeX:0, index:0, pages:[], pointers:new Map(), startX:0, startY:0, moved:0, _lastTap:0, pinchDist:0, pinchScale:1 }; }
  let st = freshState();
  function apply(animate){
    const i = im(); if(!i || !st) return;
    i.style.transition = animate ? 'transform .28s cubic-bezier(.22,1,.36,1)' : 'none';
    i.style.transform = 'translate('+st.tx+'px,'+st.ty+'px) scale('+st.scale+')';
  }
  /* 打开时收集正文图片作为分页列表 */
  function collectPages(){
    const urls = [];
    $$('#v16EdBody img.md-img, #v16EdScroll img.md-img').forEach(i2=>{
      const src = i2.getAttribute('data-relpath') || i2.getAttribute('src');
      if(src) urls.push(src);
    });
    st.pages = urls;
    const cur = im() && im().getAttribute('src');
    st.index = Math.max(0, urls.indexOf(cur));
  }
  const mo = new MutationObserver(()=>{
    if(viewerEl.classList.contains('open')){ st = freshState(); collectPages(); }
    else { st = freshState(); const i = im(); if(i) i.style.transform=''; }
  });
  mo.observe(viewerEl, { attributes:true, attributeFilter:['class'] });

  viewerEl.addEventListener('pointerdown', (e)=>{
    if(reduceMotion()) return;
    st.pointers.set(e.pointerId, { x:e.clientX, y:e.clientY });
    st.startX = e.clientX; st.startY = e.clientY; st.moved = 0;
    if(st.pointers.size === 2){
      const pts = [...st.pointers.values()];
      st.pinchDist = Math.hypot(pts[0].x-pts[1].x, pts[0].y-pts[1].y);
      st.pinchScale = st.scale;
    }
  });
  viewerEl.addEventListener('pointermove', (e)=>{
    if(!st.pointers.has(e.pointerId)) return;
    const pt = st.pointers.get(e.pointerId);
    const dx = e.clientX - pt.x, dy = e.clientY - pt.y;
    pt.x = e.clientX; pt.y = e.clientY;
    st.moved = Math.max(st.moved, Math.abs(e.clientX - st.startX), Math.abs(e.clientY - st.startY));
    if(st.pointers.size === 2){                       /* 双指缩放 */
      const pts = [...st.pointers.values()];
      const d = Math.hypot(pts[0].x-pts[1].x, pts[0].y-pts[1].y);
      if(st.pinchDist){
        st.scale = Math.min(3, Math.max(1, st.pinchScale * d / st.pinchDist));
        apply(false);
      }
      return;
    }
    if(st.scale > 1){                                /* 放大态单指平移 */
      st.tx += dx; st.ty += dy; apply(false);
    } else if(st.moved > 8){                        /* 左右分页（边界阻尼） */
      let sx = dx;
      const n = st.pages.length;
      if(st.index === 0 && sx > 0) sx *= .35;
      if(st.index >= n-1 && sx < 0) sx *= .35;
      st.swipeX += sx;
      const i = im(); if(i){ i.style.transition='none'; i.style.transform='translate('+st.swipeX.toFixed(1)+'px,0) scale(1)'; }
    }
  });
  const up = (e)=>{
    if(!st.pointers.has(e.pointerId)) return;
    st.pointers.delete(e.pointerId);
    if(st.pointers.size < 2) st.pinchDist = 0;
    if(st.pointers.size > 0) return;
    const W = window.innerWidth;
    if(st.moved < 10){                              /* 双击缩放：任意当前档下切换 */
      const t = performance.now();
      if(st._lastTap && t - st._lastTap < 300){
        st._lastTap = 0;
        st.scale = st.scale > 1 ? 1 : 2.2;
        st.tx = 0; st.ty = 0;
        haptic(10); apply(true);
      } else st._lastTap = t;
    } else if(Math.abs(st.swipeX) > 8){
      const n = st.pages.length;
      if(st.swipeX < -W*.25 && st.index < n-1){      /* 下一页 */
        st.index++; st.swipeX = 0;
        const i = im(); if(i && st.pages[st.index]) i.src = st.pages[st.index];
        haptic(8); apply(true);
      } else if(st.swipeX > W*.25 && st.index > 0){ /* 上一页 */
        st.index--; st.swipeX = 0;
        const i = im(); if(i && st.pages[st.index]) i.src = st.pages[st.index];
        haptic(8); apply(true);
      } else {                                       /* 回弹 */
        st.swipeX = 0; apply(true);
      }
    } else {                                        /* 放大态拖动后松手 */
      apply(true);
    }
  };
  viewerEl.addEventListener('pointerup', up);
  viewerEl.addEventListener('pointercancel', up);
}

/* ============================================================
   #13 Press-to-Cancel：按下后拖动超过阈值 → 抬手不触发点击
   作用于：首页卡片 / sheet 选项 / FAB 菜单 / 设置行 / 开关
   ============================================================ */
function initPressCancel(){
  const SEL = '#v16Body .v16-note-card, #v16Body .v16-folder-card, .v16-sheet-opt, .v16-fab-item, .v16-row, .v16-switch';
  let grab = null;
  document.addEventListener('pointerdown', (e)=>{
    const el = e.target && e.target.closest && e.target.closest(SEL);
    if(!el) return;
    grab = { el, x:e.clientX, y:e.clientY, moved:false };
    el._v16grab = grab;
  }, true);
  window.addEventListener('pointermove', (e)=>{
    if(!grab || grab.moved) return;
    if(Math.abs(e.clientX - grab.x) > 14 || Math.abs(e.clientY - grab.y) > 14) grab.moved = true;
  });
  document.addEventListener('click', (e)=>{
    const el = e.target && e.target.closest && e.target.closest(SEL);
    if(el && el._v16grab && el._v16grab.moved){
      e.stopImmediatePropagation();
      e.preventDefault();
    }
  }, true);
  const clear = ()=>{ setTimeout(()=>{ if(grab){ grab.el._v16grab = null; grab = null; } }, 0); };
  window.addEventListener('pointerup', clear);
  window.addEventListener('pointercancel', clear);
}

/* ============================================================
   #15 手风琴：设置分组展开折叠真实高度动画
   捕获阶段记录「折叠前高度」→ 业务 toggle class 后，用 WAAPI 从旧高度过渡到目标高度。
   ============================================================ */
function animateHeight(el, startH, endH){
  if(reduceMotion() || !el) return;
  if(Math.abs(endH - startH) < 2){ el.style.height=''; el.style.overflow=''; el.style.maxHeight=''; return; }
  el.style.overflow = 'hidden';
  el.style.maxHeight = 'none';                 /* 中和业务 max-height 规则的瞬间夹取 */
  el.style.height = startH + 'px';
  requestAnimationFrame(()=>{
    const anim = el.animate([
      { height: startH+'px' },
      { height: endH+'px' }
    ], { duration: 340, easing: 'cubic-bezier(.22,1,.36,1)' });
    anim.onfinish = ()=>{ el.style.height=''; el.style.overflow=''; el.style.maxHeight=''; };
  });
}
function initAccordion(){
  /* 设置分组：点 .v16-set-head */
  document.addEventListener('click', (e)=>{
    if(reduceMotion()) return;
    const head = e.target && e.target.closest && e.target.closest('.v16-set-group > .v16-set-head');
    if(!head) return;
    const group = head.parentElement;
    const body = group.querySelector('.v16-set-body');
    if(!body) return;
    const startH = body.offsetHeight;
    const willOpen = !group.classList.contains('open');
    requestAnimationFrame(()=>{
      animateHeight(body, startH, willOpen ? body.scrollHeight : 0);
    });
  }, true);
  /* 文件树：点箭头（业务会重绘抽屉，动画挂在新 children 上） */
  document.addEventListener('click', (e)=>{
    if(reduceMotion()) return;
    const tw = e.target && e.target.closest && e.target.closest('.v16-tree-row .tw');
    if(!tw) return;
    const row = tw.closest('.v16-tree-row');
    const children = row && row.parentElement ? row.parentElement.querySelector(':scope > .v16-children') : null;
    if(!children) return;
    const startH = children.offsetHeight;
    const willOpen = !children.classList.contains('open');
    requestAnimationFrame(()=>{
      /* 重绘已发生；取新 children */
      const newChildren = row && row.parentElement ? row.parentElement.querySelector(':scope > .v16-children') : null;
      if(newChildren) animateHeight(newChildren, startH, willOpen ? newChildren.scrollHeight : 0);
    });
  }, true);
}

/* ============================================================
   #16 进度条弹性收尾：.v16-progress>i 到达 100% 时 scaleX 过冲回弹
   ============================================================ */
function initProgress(){
  const mo = new MutationObserver(()=>{
    $$('.v16-progress > i').forEach(bar=>{
      if(reduceMotion()) return;
      const w = parseFloat(bar.style.width) || 0;
      if(bar._v16Overshoot){
        if(w < 98) bar._v16Overshoot = false;
        return;
      }
      if(w >= 99.5){
        bar._v16Overshoot = true;
        bar.style.transformOrigin = 'left center';
        bar.animate([
          { transform:'scaleX(1)' },
          { transform:'scaleX(1.07)', offset:.35 },
          { transform:'scaleX(1)' }
        ], { duration: 450, easing: 'ease-out' });
      }
    });
  });
  if(document.body) mo.observe(document.body, { attributes:true, subtree:true, attributeFilter:['style'] });
}

/* ============================================================
   启动（脚本在 </body> 前执行，document 委托无需等待 v16root）
   ============================================================ */
initTilt();
initChip();
initDeleteFx();
initTodoCheckFx();
initRubber();
initTodoDrag();
initFontRuler();
initNbSuggest();
initImgViewer();
initPressCancel();
initAccordion();
initProgress();

window.V16Anim = { reduceMotion, haptic, version:'v16.0.0-anim' };
})();
