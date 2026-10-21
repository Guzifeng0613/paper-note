(function(){
/* ============ Toast / Modal / Sheet ============ */
let toastTimer=null;
function hideToast(){$('#toast').classList.remove('show');clearTimeout(toastTimer);}
function toast(msg,action){
  const t=$('#toast');
  t.innerHTML='<span>'+esc(msg)+'</span>'+(action?'<button class="t-undo" id="tUndo">'+esc(action.label)+'</button>':'');
  t.classList.add('show');
  if(action){$('#tUndo').onclick=()=>{action.fn();hideToast();};}
  clearTimeout(toastTimer);toastTimer=setTimeout(hideToast,action?4500:1900);
}
function openModal(html){
  $('#modalBox').innerHTML=html;$('#modal').classList.add('show');
  $('#modalBox').querySelectorAll('[data-close]').forEach(b=>b.onclick=closeModal);
}
function closeModal(){$('#modal').classList.remove('show');}
function openActionSheet(items,title){
  $('#dynTitle').textContent=title||'请选择';
  $('#dynOpts').innerHTML=items.map((it,i)=>{
    let lead;
    if(it.dot)lead='<span class="opt-ico"><i style="width:22px;height:22px;border-radius:50%;background:'+it.dot+';box-shadow:0 0 0 1px rgba(0,0,0,.08)"></i></span>';
    else lead='<span class="opt-ico" style="color:'+(it.danger?'var(--danger)':'var(--pine)')+'">'+(it.icon||'')+'</span>';
    return '<button class="sheet-opt'+(it.danger?' danger':'')+'" data-i="'+i+'">'+lead
      +'<span style="color:'+(it.danger?'var(--danger)':'inherit')+'">'+it.label+'</span></button>';
  }).join('');
  $('#dynOpts').querySelectorAll('.sheet-opt').forEach(b=>b.onclick=()=>{
    closeActionSheet();const fn=items[+b.dataset.i].fn;if(fn)setTimeout(fn,80);});
  $('#mask').classList.add('show');$('#dynSheet').classList.add('show');
}
function closeActionSheet(){$('#mask').classList.remove('show');$('#dynSheet').classList.remove('show');}

/* #13 危险按钮 Press-to-Cancel：按下时红色确认区域；手指滑出按钮区域恢复常态，
   抬手不触发；不设 pointer capture，原生 click 仅在原位抬手时才会发生。
   对个别机型滑出仍补发的 click，用 document 捕获阶段一次性拦截，按下一次即清除。 */
(function setupPressCancel(){
  const PC_SEL='.sheet-opt.danger, .modal .btn-danger';
  let pcEl=null,pcInside=false;
  const inRect=(x,y,el,pad)=>{
    const r=el.getBoundingClientRect();
    return x>=r.left-pad&&x<=r.right+pad&&y>=r.top-pad&&y<=r.bottom+pad;
  };
  document.addEventListener('pointerdown',e=>{
    if(!e.target.closest)return;
    const el=e.target.closest(PC_SEL);
    if(!el)return;
    pcEl=el;pcInside=true;
    el._pcBlock=0;
    el.classList.add('pc-pressed');
  },{passive:true});
  document.addEventListener('pointermove',e=>{
    if(!pcEl)return;
    const inside=inRect(e.clientX,e.clientY,pcEl,14);
    if(inside!==pcInside){
      pcInside=inside;
      pcEl.classList.toggle('pc-pressed',inside);
    }
  },{passive:true});
  const finish=e=>{
    if(!pcEl)return;
    const el=pcEl;
    const inside=e&&typeof e.clientX==='number'?inRect(e.clientX,e.clientY,el,14):false;
    if(!inside){
      el.classList.remove('pc-pressed');
      el._pcBlock=1;
      /* 没有补发 click 时，300ms 后自动失效，不影响下一次正常点按 */
      setTimeout(()=>{if(el._pcBlock)el._pcBlock=0;},300);
    }
    pcEl=null;
    setTimeout(()=>el.classList.remove('pc-pressed'),200);
  };
  document.addEventListener('pointerup',finish);
  document.addEventListener('pointercancel',finish);
  document.addEventListener('click',e=>{
    if(!e.target.closest)return;
    const el=e.target.closest(PC_SEL);
    if(!el)return;
    if(el._pcBlock){
      e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
    }
    el._pcBlock=0;
  },true);
})();
function fmtDur(s){s=Math.max(0,Math.round(s));
  if(s<60)return s+' 秒';return Math.floor(s/60)+' 分'+(s%60)+' 秒';}
/* 通用任务进度：百分比 + X/Y + 已耗时 + 预计剩余（EMA），并上报原生通知 */
const TaskUI={
  t0:0,total:0,
  begin(title,total){this.t0=Date.now();this.total=total||1;
    $('#syncTitle').textContent=title;
    $('#syncOverlay').classList.add('show');this.update(0,'准备中…');},
  update(done,label){
    const pct=Math.round(done/this.total*100);
    $('#syncPct').textContent=pct+'%';
    const el=(Date.now()-this.t0)/1000;
    let etaStr='';let etaSec=0;
    if(done>0){const avg=el/done;etaSec=Math.round(avg*(this.total-done));
      etaStr=' · 预计剩余 '+fmtDur(etaSec);}
    $('#syncMsg').textContent=(label||'')+' · '+done+'/'+this.total
      +' · 已用 '+fmtDur(el)+etaStr;
    if(hasNative())Native.call('taskProgress',JSON.stringify(
      {pct,done,total:this.total,label:label||'',eta:etaSec})).catch(()=>{});
  },
  end(){$('#syncOverlay').classList.remove('show');
    if(hasNative())Native.call('taskProgress',JSON.stringify({done:true})).catch(()=>{});}
};
})();
