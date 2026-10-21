(function(){
/* ============ 主题 ============ */
function applyTheme(){
  let t=prefs.theme||'auto';
  if(t==='auto'&&window.matchMedia)
    t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';
  document.documentElement.dataset.theme=t;
}
/* #14 主题切换圆形扩散（真实"扫到哪变到哪"）：
   克隆当前屏幕作为"新主题预览层"，用 clip-path 圆形从触点揭开——
   圈内已经是新主题的真实界面，圈外仍是旧主题；圆形铺满后切换真实主题并移除克隆。
   生命周期由计时器权威驱动，任何 WebView 动画回调丢失都不会残留。 */
let _themeRevealToken=0;
function themeSwitchTo(t,x,y){
  if((prefs.theme||'light')===t)return;
  const eff=t==='auto'
    ?(window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light')
    :t;
  const cur=document.documentElement.dataset.theme||'light';
  const apply=()=>{
    prefs.theme=t;persistPrefs();applyTheme();
    if($('#settingsBody'))patchSettingsTheme(t);else renderSettings();
    /* 防止个别 WebView 在按钮重建/失焦后把焦点落到返回键，造成“点亮”假象 */
    const ae=document.activeElement;
    if(ae&&ae.id&&ae.id.endsWith('Back')){try{ae.blur();}catch(_){}}
  };
  const unlock=()=>document.body.classList.remove('theme-reveal-on');
  if(eff===cur){apply();return;}
  if(reduceMotion()||!Element.prototype.animate){apply();return;}
  /* 单实例：快速连点清掉旧层；旧实例定时器用 token 失效化 */
  document.querySelectorAll('.trl').forEach(o=>o.remove());
  const my=++_themeRevealToken;
  const fresh=()=>my===_themeRevealToken;
  /* 扩散期间锁定顶栏真实按钮（返回键不会被任何残影/补发事件点亮或误点）；
     克隆层 pointer-events:none，视觉不受影响，结束后立即恢复 */
  document.body.classList.add('theme-reveal-on');
  const screen=document.querySelector('.screen.active');
  const host=document.querySelector('.phone')||screen;
  const rect=host.getBoundingClientRect();
  /* 克隆当前屏幕（含滚动位置）作为新主题层 */
  const layer=document.createElement('div');
  layer.className='trl';
  layer.dataset.theme=eff;
  layer.style.left=rect.left+'px';
  layer.style.top=rect.top+'px';
  layer.style.width=rect.width+'px';
  layer.style.height=rect.height+'px';
  const clone=screen.cloneNode(true);
  clone.classList.add('trl-screen');
  const ob=screen.querySelector('.screen-body'),cb=clone.querySelector('.screen-body');
  if(ob&&cb){cb.scrollTop=ob.scrollTop;cb.scrollLeft=ob.scrollLeft;}
  /* 克隆里的主题段直接显示目标选中态，避免切换瞬间按钮高光错位 */
  const seg=clone.querySelector('#themeSeg');
  if(seg)seg.querySelectorAll('button').forEach(btn=>btn.classList.toggle('on',btn.dataset.t===t));
  layer.appendChild(clone);
  document.body.appendChild(layer);
  haptic(10);
  /* 圆的圆心/半径按层自身坐标计算 */
  const cx=Math.min(rect.width,Math.max(0,x-rect.left));
  const cy=Math.min(rect.height,Math.max(0,y-rect.top));
  const maxR=Math.hypot(Math.max(cx,rect.width-cx),Math.max(cy,rect.height-cy));
  layer.style.clipPath='circle(0px at '+cx+'px '+cy+'px)';
  const DUR=480;
  try{
    layer.animate(
      [{clipPath:'circle(0px at '+cx+'px '+cy+'px)'},
       {clipPath:'circle('+(maxR*1.02)+'px at '+cx+'px '+cy+'px)'}],
      {duration:DUR,easing:'cubic-bezier(.28,.72,.22,1)',fill:'forwards'});
  }catch(_){layer.remove();unlock();apply();return;}
  /* 圆形铺满瞬间切换真实主题（此时全屏已被新主题克隆遮住，切换无感） */
  setTimeout(()=>{
    if(!fresh())return;
    apply();
    /* 两帧后克隆与真实界面一致，直接移除；真实界面是淡入 100ms 兜底错位 */
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      if(fresh()){layer.style.transition='opacity .1s ease-out';layer.style.opacity='0';
        setTimeout(()=>{if(layer.parentNode)layer.remove();unlock();},130);}
    }));
  },DUR-10);
  /* 硬兜底：无论如何 900ms 后移除并解锁，杜绝残留 */
  setTimeout(()=>{if(fresh()){try{apply();}catch(_){}if(layer.parentNode)layer.remove();unlock();}},900);
  /* 切后台立即清掉 */
  const onVis=()=>{if(document.hidden){layer.remove();unlock();document.removeEventListener('visibilitychange',onVis);}};
  document.addEventListener('visibilitychange',onVis);
}
if(window.matchMedia)window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change',
  ()=>{if((prefs.theme||'auto')==='auto')applyTheme();});

/* ============ 显示字体 ============ */
const FONTS=[
 {key:'system',name:'系统默认',desc:'最稳最快，跟随设备',family:'',
  stack:'system-ui,-apple-system,"Manrope","Noto Sans SC",sans-serif'},
 {key:'yahei',name:'微软雅黑',desc:'清晰方正，Windows 常用',family:'Microsoft YaHei',
  stack:'"Microsoft YaHei","PingFang SC","Noto Sans SC",system-ui,sans-serif'},
 {key:'sans',name:'思源黑体',desc:'现代清晰，适合速记',family:'Noto Sans SC',
  stack:'"Noto Sans SC","Noto Sans CJK SC",system-ui,sans-serif',
  css:'https://miaoda.feishu.cn/fonts/css2?family=Noto+Sans+SC:wght@400;500;700&display=swap'},
 {key:'serif',name:'思源宋体',desc:'书卷气，适合长读',family:'Noto Serif SC',
  stack:'"Noto Serif SC","Noto Serif CJK SC","Noto Sans SC",serif',
  css:'https://miaoda.feishu.cn/fonts/css2?family=Noto+Serif+SC:wght@400;600;700&display=swap'},
 {key:'wenkai',name:'霞鹜文楷',desc:'温润楷体，耐看有温度',family:'LXGW WenKai',
  stack:'"LXGW WenKai","Noto Sans SC",sans-serif',
  css:'https://cdn.jsdelivr.net/npm/lxgw-wenkai-webfont@1.7.0/lxgwwenkai-regular.css'}
];
function curFont(){return FONTS.find(f=>f.key===(prefs.font||'system'))||FONTS[0];}
function curFontName(){return curFont().name;}
const loadedFontCss=new Set();
function loadFontCss(href){
  if(!href||loadedFontCss.has(href))return;loadedFontCss.add(href);
  const l=document.createElement('link');l.rel='stylesheet';l.href=href;document.head.appendChild(l);
}
function applyFont(key){
  const f=FONTS.find(x=>x.key===key)||FONTS[0];
  loadFontCss(f.css);
  document.documentElement.style.setProperty('--font-base',f.stack);
  prefs.font=f.key;persistPrefs();
}
function openFontPicker(){
  const cur=curFont();
  /* 不做不可靠的样例预览：只列字体名（名字用该字体渲染，加载后即真实样貌）+ 描述 */
  const rows=FONTS.map(f=>
    '<button class="pick-row'+(f.key===cur.key?' on':'')+'" data-k="'+f.key+'">'+
    '<span class="pr-main"><b class="pr-name" style="font-family:'+f.stack+';font-size:17px">'+f.name+'</b>'+
    '<small>'+f.desc+'</small></span>'+
    (f.key===cur.key?'<span class="pr-check">'+I.check+'</span>':'')+'</button>').join('');
  openModal('<h3 class="pick-title">显示字体</h3><div class="pick-list">'+rows+'</div>'+
    '<button class="pick-cancel" data-close>取消</button>');
  document.querySelectorAll('.pick-row').forEach(b=>b.onclick=async()=>{
    const k=b.dataset.k;const f=FONTS.find(x=>x.key===k);
    applyFont(k);closeModal();renderSettings();
    if(f.css&&f.family&&document.fonts&&document.fonts.load){
      toast('正在加载「'+f.name+'」…');
      try{
        await Promise.race([
          document.fonts.load('16px "'+f.family+'", "Noto Sans SC"','的一是不了人我在有他这为之大来以个中上们到说时地也子道会'),
          new Promise(r=>setTimeout(r,4500))]);
      }catch(e){}
    }
    toast('已切换为「'+f.name+'」');
  });
}

/* ============ 全局字体大小（整页统一缩放；便签内部另有独立字号） ============ */
function applyFontScale(){document.documentElement.style.zoom=(prefs.fontScale&&prefs.fontScale!==1)?prefs.fontScale:'';}
/* #9 横向字号刻度尺：两侧渐隐、居中高亮、拖动实时预览、松手吸附最近刻度 */
function buildFontRuler(ruler,numEl,setScale){
  const SCALE_MIN=.85,SCALE_MAX=1.30,STEP=5,SPACE=46;
  const vals=[];
  for(let v=SCALE_MIN*100;v<=SCALE_MAX*100+0.001;v+=STEP)vals.push(Math.round(v));
  const cursor=document.createElement('div');cursor.className='fs-cursor';
  ruler.appendChild(cursor);
  const track=document.createElement('div');track.className='fs-track';
  ruler.appendChild(track);
  vals.forEach((v,i)=>{
    const major=v%10===0;
    const t=document.createElement('div');
    t.className='fs-tick '+(major?'major':'minor');
    t.innerHTML='<i></i><span class="fs-tk-num">'+(major?v:'')+'</span>';
    t.dataset.i=i;
    track.appendChild(t);
  });
  const scaleToIdx=s=>(s*100-SCALE_MIN*100)/STEP;
  const idxToScale=i=>SCALE_MIN+i*STEP/100;
  let idx=scaleToIdx(prefs.fontScale||1),dragStartX=0,dragStartIdx=0,dragging=false;
  const paint=()=>{
    const near=Math.round(idx);
    track.querySelectorAll('.fs-tick').forEach((t,i)=>{
      const off=i-idx;
      t.style.left='calc(50% + '+(off*SPACE).toFixed(1)+'px)';
      t.style.opacity=Math.max(0,Math.min(1,1-Math.abs(off)/6)).toFixed(2);
      t.classList.toggle('on',i===near);
    });
    if(numEl)numEl.textContent=Math.round((SCALE_MIN+near*STEP/100)*100);
  };
  const snap=()=>{
    const i=Math.max(0,Math.min(vals.length-1,Math.round(idx)));
    idx=i;
    if(!reduceMotion()){
      const start=performance.now();
      const from=track._animIdx===undefined?i:track._animIdx;
      const ease=t=>1-Math.pow(1-t,3);
      const to=i;
      const run=t=>{
        const p=Math.min(1,(t-start)/220);
        idx=from+(to-from)*ease(p);
        paint();
        if(p<1)requestAnimationFrame(run);
      };
      requestAnimationFrame(run);
    }else paint();
    setScale(idxToScale(i),false);
    haptic(12);
  };
  ruler.addEventListener('pointerdown',e=>{
    dragging=true;dragStartX=e.clientX;dragStartIdx=idx;
    ruler.classList.add('dragging');
    try{ruler.setPointerCapture(e.pointerId);}catch(_){}
  });
  ruler.addEventListener('pointermove',e=>{
    if(!dragging)return;
    const raw=dragStartIdx-(e.clientX-dragStartX)/SPACE;
    idx=Math.max(0,Math.min(vals.length-1,raw));
    track._animIdx=idx;
    paint();
    setScale(idxToScale(idx),true);
  });
  const end=()=>{if(!dragging)return;dragging=false;ruler.classList.remove('dragging');snap();};
  ruler.addEventListener('pointerup',end);
  ruler.addEventListener('pointercancel',end);
  paint();
  return {
    setIndex(i){idx=Math.max(0,Math.min(vals.length-1,i));track._animIdx=idx;paint();},
    scaleToIdx
  };
}
function openFontSizeSheet(){
  const setScale=(v,live)=>{
    prefs.fontScale=Math.min(1.3,Math.max(.85,live?v:Math.round(v*20)/20));
    applyFontScale();
    if(!live){persistPrefs();renderSettings();}
  };
  openModal('<h3 class="pick-title">字体大小</h3>'
    +'<div class="fs-cur-row"><b id="fsNum">100</b><small>%</small></div>'
    +'<div class="fs-ruler" id="fsRuler"></div>'
    +'<div class="fs-preview">纸片便签 · 拖动刻度尺，所见即所得</div>'
    +'<div class="modal-actions"><button class="btn-ghost" id="fsReset" type="button">重置</button>'
    +'<button class="btn-primary" id="fsDone" type="button">完成</button></div>');
  const ctl=buildFontRuler($('#fsRuler'),$('#fsNum'),setScale);
  $('#fsReset').onclick=()=>{setScale(1,true);ctl.setIndex(ctl.scaleToIdx(1));haptic(8);};
  $('#fsDone').onclick=()=>{persistPrefs();closeModal();renderSettings();};
}

})();
