(function(){
/* ============ 平台检测（Electron 桌面端） ============ */
const IS_DESKTOP=!!(window.__DESKTOP__&&window.__DESKTOP__.desktop);
if(IS_DESKTOP)document.documentElement.classList.add('platform-desktop');
/* ============ 基础工具 ============ */
const $=s=>document.querySelector(s), $$=s=>Array.from(document.querySelectorAll(s));
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7);
const esc=s=>(s==null?'':String(s)).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
/* ============ 动效工具（安卓 UI 打磨公共基线） ============ */
const reduceMotion=()=>window.matchMedia&&window.matchMedia('(prefers-reduced-motion:reduce)').matches;
/* 轻触感：轻操作 8ms，确认/吸附 12ms，删除 18ms（仅原生壳内 navigator.vibrate 生效） */
function haptic(ms){ try{ if(navigator.vibrate) navigator.vibrate(ms||8); }catch(e){} }
/* FLIP：记录一组元素位置 → 执行变更 → 在下一帧用 transform 平滑补位
   只动 transform/opacity；返回选择器内全部元素。opts:duration/ease/stagger */
function flipPositions(els, mutate, opts){
  opts=opts||{};
  const list=els.filter(Boolean);
  const before=new Map(list.map(el=>[el, el.getBoundingClientRect()]));
  const ret=mutate();
  if(reduceMotion()) return ret;
  const dur=opts.duration||'var(--dur-3)', ease=opts.ease||'var(--ease-spring-soft)';
  requestAnimationFrame(()=>{
    list.forEach((el,i)=>{
      const b=before.get(el); if(!b)return;
      const a=el.getBoundingClientRect();
      const dx=b.left-a.left, dy=b.top-a.top;
      if(!dx&&!dy)return;
      const st=el.style;
      st.transition='none'; st.transform='translate('+dx+'px,'+dy+'px)';
      const delay=opts.stagger?(';transition-delay:'+(i*opts.stagger)+'ms'):'';
      void el.offsetWidth;
      st.transition='transform '+dur+' '+ease+delay;
      st.transform='';
      const clear=()=>{st.transition='';st.transitionDelay='';st.transform='';el.removeEventListener('transitionend',clear);};
      el.addEventListener('transitionend',clear);
      setTimeout(clear, opts.timeout||600);
    });
  });
  return ret;
}
/* 数字滚动（odometer）：把文本节点的旧数字滚动到新值；非数字部分不动 */
function animateNumber(el, newVal, opts){
  opts=opts||{};
  const decimals=(String(newVal).split('.')[1]||'').length;
  const from=parseFloat((el.textContent||'').replace(/[^\d.]/g,''))||0;
  const to=parseFloat(newVal);
  if(reduceMotion()||from===to||isNaN(to)){ el.textContent=opts.format?opts.format(to):to; return; }
  const t0=performance.now(), dur=opts.duration||240;
  const prefix=opts.prefix||'', suffix=opts.suffix||'';
  function tick(t){
    const p=Math.min(1,(t-t0)/dur), e=1-Math.pow(1-p,3);
    const v=from+(to-from)*e;
    el.textContent=prefix+(decimals?v.toFixed(decimals):Math.round(v))+suffix;
    if(p<1)requestAnimationFrame(tick);
    else el.textContent=prefix+(decimals?to.toFixed(decimals):to)+suffix;
  }
  requestAnimationFrame(tick);
}
function stripHtml(h){const d=document.createElement('div');d.innerHTML=h||'';return d.textContent.replace(/\s+/g,' ').trim();}
function fmtDate(ts){
  const d=new Date(ts),now=new Date(),p=n=>String(n).padStart(2,'0');
  if(isNaN(ts)||d.getFullYear()<2000)return '';  /* 异常/占位时间戳不显示 1970 */
  if(d.toDateString()===now.toDateString())return p(d.getHours())+':'+p(d.getMinutes());
  const y=new Date(now);y.setDate(now.getDate()-1);
  if(d.toDateString()===y.toDateString())return '昨天';
  const base=(d.getMonth()+1)+'月'+d.getDate()+'日';
  return d.getFullYear()===now.getFullYear()?base:d.getFullYear()+'年'+base;
}
function fmtSize(b){
  if(b<1024)return b+' B';
  if(b<1048576)return (b/1024).toFixed(1)+' KB';
  return (b/1048576).toFixed(2)+' MB';
}
const formatSize=fmtSize;
function debounce(fn,ms){let t;return function(){clearTimeout(t);const a=arguments,c=this;t=setTimeout(()=>fn.apply(c,a),ms);};}
function readAsDataURL(file){return new Promise((res,rej)=>{const r=new FileReader();
  r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(file);});}
function downloadURL(url,name){
  try{window.__lastExport={url,name};}catch(e){}
  const a=document.createElement('a');a.href=url;if(name)a.download=name;
  document.body.appendChild(a);a.click();a.remove();
}
function renderHome(){try{renderChips();renderNotes();}catch(e){}}

/* ============ 图标 ============ */
const I={
 note:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/></svg>',
 todo:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 7 2 2 3-3"/><path d="m3 17 2 2 3-3"/><path d="M13 8h8M13 18h8"/></svg>',
 check:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
 grid:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>',
 list:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/></svg>',
 image:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2.5"/><circle cx="9" cy="9" r="2"/><path d="m21 15-4-4a2 2 0 0 0-2.8 0L6 21"/></svg>',
 clip:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21 11-8.5 8.5a5 5 0 0 1-7-7L15 3a3.5 3.5 0 0 1 5 5L9.5 18.5a2 2 0 0 1-3-3L15 6"/></svg>',
 flag:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 22V4M4 4h13l-2 4 2 4H4"/></svg>',
 restore:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>',
 sun:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
 moon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z"/></svg>',
 auto:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 0 0 18z" fill="currentColor"/></svg>',
 down:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>',
 up:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>',
 folder:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.7-.9L9.3 3.6A2 2 0 0 0 7.6 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2z"/></svg>',
 trash:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>',
 info:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/></svg>',
 plus:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
 x:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
 chev:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>',
 save:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/></svg>',
 cloud:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.5 19a4.5 4.5 0 0 0 .5-9 6 6 0 0 0-11.6-1.5A4 4 0 0 0 6.5 19z"/></svg>',
 install:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="16" height="18" rx="2.5"/><path d="M12 8v6M9.5 11.5 12 14l2.5-2.5M9 18h6"/></svg>',
 font:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20 10.5 5 17 20M6.8 14h7.4"/></svg>',
 edit:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>',
 more:'<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.9"/><circle cx="12" cy="12" r="1.9"/><circle cx="12" cy="19" r="1.9"/></svg>'
};

/* ============ 文件类型 ============ */
function fileKind(name){
  const e=(name.split('.').pop()||'').toLowerCase();
  if(['xlsx','xls','csv','numbers'].includes(e))return 'excel';
  if(['docx','doc','pages','rtf'].includes(e))return 'word';
  if(e==='pdf')return 'pdf';
  if(['jpg','jpeg','png','gif','webp','svg','heic'].includes(e))return 'image';
  if(['mp3','wav','m4a','aac','flac','ogg'].includes(e))return 'audio';
  if(['mp4','mov','avi','mkv','webm'].includes(e))return 'video';
  if(['zip','rar','7z','tar','gz'].includes(e))return 'zip';
  return 'file';
}
function mimeForName(name,fallback){
  const e=(name||'').split('.').pop()?.toLowerCase()||'';
  const m={
    png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',gif:'image/gif',webp:'image/webp',
    svg:'image/svg+xml',bmp:'image/bmp',heic:'image/heic',heif:'image/heif',
    pdf:'application/pdf',txt:'text/plain;charset=utf-8',json:'application/json;charset=utf-8',
    doc:'application/msword',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls:'application/vnd.ms-excel',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ppt:'application/vnd.ms-powerpoint',pptx:'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    mp3:'audio/mpeg',wav:'audio/wav',m4a:'audio/mp4',aac:'audio/aac',ogg:'audio/ogg',flac:'audio/flac',
    mp4:'video/mp4',mov:'video/quicktime',webm:'video/webm',avi:'video/x-msvideo',mkv:'video/x-matroska',
    zip:'application/zip',rar:'application/vnd.rar','7z':'application/x-7z-compressed'
  };
  return m[e]||fallback||'application/octet-stream';
}
const KIND_META={
 excel:{bg:'#2E9E5B',label:'表格'},word:{bg:'#3B78D6',label:'文档'},
 pdf:{bg:'#D94B43',label:'PDF'},image:{bg:'#B07CD8',label:'图片'},
 audio:{bg:'#8A5CF0',label:'音频'},video:{bg:'#E0833A',label:'视频'},
 zip:{bg:'#8C8F88',label:'压缩包'},file:{bg:'#6E7A72',label:'文件'}};
const kindColor=k=>(KIND_META[k]||KIND_META.file).bg;
const DEMO_PDF='data:application/pdf;base64,JVBERi0xLjMKMSAwIG9iajw8L1R5cGUvQ2F0YWxvZy9QYWdlcyAyIDAgUj4+ZW5kb2JqCjIgMCBvYmo8PC9UeXBlL1BhZ2VzL0tpZHNbMyAwIFJdL0NvdW50IDE+PmVuZG9iagozIDAgb2JqPDwvVHlwZS9QYWdlL1BhcmVudCAyIDAgUi9NZWRpYUJveFswIDAgMzIwIDIwMF0vQ29udGVudHMgNCAwIFIvUmVzb3VyY2VzPDwvRm9udDw8L0YxIDUgMCBSPj4+Pj4+ZW5kb2JqCjQgMCBvYmo8PC9MZW5ndGggNjA+PnN0cmVhbQpCVCAvRjEgMjAgVGYgNDAgMTQwIFRkIChaaGlQaWFuIERlbW8pIFRqIEVUCkJUIC9GMSAxMyBUZiA0MCAxMTAgVGQgKGF0dGFjaG1lbnQgcHJldmlldykgVGogRVQKZW5kc3RyZWFtIGVuZG9iago1IDAgb2JqPDwvVHlwZS9Gb250L1N1YnR5cGUvVHlwZTEvQmFzZUZvbnQvSGVsdmV0aWNhPj5lbmRvYmoKdHJhaWxlcjw8L1Jvb3QgMSAwIFI+PgolJUVPRg==';

})();
