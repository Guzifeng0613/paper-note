/* ============ 数据与存储 v3 ============ */
const KNOTES_V1='zhipian.notes.v1', KNOTES_V2='zhipian.notes.v2', KPREF_V2='zhipian.prefs.v2';
const APP_VERSION='16.0.9';
const KLIB_V3='zhipian.library.v3', DB_NAME='zhipian-db-v3';
const MAX_FILE=100*1024*1024;  /* 单个附件上限 100MB */
const COLORS=['cream','yellow','orange','pink','green','blue','purple'];
const COLOR_CSS={cream:'var(--c-cream)',yellow:'var(--c-yellow)',orange:'var(--c-orange)',pink:'var(--c-pink)',green:'var(--c-green)',blue:'var(--c-blue)',purple:'var(--c-purple)'};
/* 归一化卡片颜色：兼容数字索引 / 颜色名 / 历史与导入数据（可迁移） */
function cardColor(n){let c=n&&n.color;if(typeof c==='number')c=COLORS[c];return COLOR_CSS[c]||COLOR_CSS.cream;}
let notes=[];
/* 云端删除墓碑：本地永久删除的便签 id，同步时只删这些；云端独有且不在墓碑的会被保留/下载，避免误删 */
let cloudDeleted=[];
/* native 导入 zip 时附件已暂换为导入内容，等待弹窗 覆盖/合并/取消 决定提交或回滚 */
let importBackupActive=false;
function markCloudDeleted(ids){
  let changed=false;
  ids.forEach(id=>{if(id&&!cloudDeleted.includes(id)){cloudDeleted.push(id);changed=true;}});
  return changed;
}
let prefs={theme:'auto',view:'grid',filter:'全部',recents:[],favoriteTags:[],
  notebooks:[],nbFilter:null,pan:null,libName:'',lastPanSync:null,
  hlSyntax:true,wikiSyntax:true,defaultType:'note',newFileLoc:'current'};

/* ---- 运行日志（本地持久：操作可追溯、异常可定位） ---- */
const LOG_KEY='zhipian.logs.v1', LOG_MAX=400;
const Logs={
  list:[],
  load(){try{const a=JSON.parse(localStorage.getItem(LOG_KEY)||'[]');
    this.list=Array.isArray(a)?a:[];}catch(e){this.list=[];}},
  save(){try{localStorage.setItem(LOG_KEY,JSON.stringify(this.list.slice(-LOG_MAX)));}catch(e){}},
  add(level,cat,msg,detail){const e={t:Date.now(),level,cat:cat||'其他',msg:String(msg==null?'':msg)};
    if(detail!=null)e.detail=String(detail).slice(0,900);
    this.list.push(e);
    if(this.list.length>LOG_MAX)this.list=this.list.slice(-LOG_MAX);
    this.save();},
  info(c,m,d){this.add('info',c,m,d);},
  warn(c,m,d){this.add('warn',c,m,d);},
  error(c,m,d){this.add('error',c,m,d);},
  clear(){this.list=[];this.save();}
};
window.addEventListener('error',e=>{
  Logs.error('全局异常',e.message,(e.filename||'').split('/').pop()+':'+e.lineno);});
window.addEventListener('unhandledrejection',e=>{
  Logs.error('未捕获Promise',(e.reason&&e.reason.message)||e.reason);});

/* ---- Native Bridge 通信 ---- */
function hasNative(){return !!(window.AndroidBridge&&window.AndroidBridge.post);}
/* v13.445 统一触感反馈：原生壳优先（Bridge vibrate），浏览器回退 */
function haptic(ms){
  ms=ms||9;
  try{
    if(hasNative()){Native.call('vibrate',String(ms)).catch(()=>{});}
    else if(navigator.vibrate){navigator.vibrate(ms);}
  }catch(e){}
}
document.addEventListener('click',function(e){
  if(!e.target.closest)return;
  const el=e.target.closest(
    '.fab,.chat-send,#naiSend,.cd-item,.note-card,.tcp,.nb-filter-btn,.bb-btn,.sheet-opt,.cr-ref,.icon-btn');
  if(el)haptic((el.classList&&(el.classList.contains('fab')||el.classList.contains('chat-send')))?14:8);
},{passive:true});
const Native={seq:0,waiting:{},
  call(method,payload){
    return new Promise((resolve,reject)=>{
      const id='c'+(++Native.seq);Native.waiting[id]={resolve,reject};
      window.AndroidBridge.post(id,method,payload==null?'':(typeof payload==='string'?payload:JSON.stringify(payload)));
    });},
  dispatch(id,payload){
    const w=Native.waiting[id];if(!w)return;delete Native.waiting[id];
    let r=null;try{r=JSON.parse(payload);}catch(e){r={ok:true,data:payload};}
    if(r&&r.ok)w.resolve(r.data);else w.reject(r&&r.error?r.error:'原生调用失败');}};
window.NativeBridge={onResult:(id,p)=>Native.dispatch(id,p)};
/* native 后台动作（自动镜像等）写入操作日志 */
window.__nativeLog=(level,cat,msg,detail)=>{try{Logs[level||'info'](cat,msg,detail);}catch(e){}};

/* ---- IndexedDB 助手 ---- */
function idbAwait(rq){return new Promise((res,rej)=>{rq.onsuccess=()=>res(rq.result);rq.onerror=()=>rej(rq.error);});}
function idbStore(s,m){return Store.db.transaction(s,m).objectStore(s);}
const idbPut=(k,v)=>idbAwait(idbStore('kv','readwrite').put(v,k));
const idbGet=k=>idbAwait(idbStore('kv','readonly').get(k));
const idbPutBlob=(k,b)=>idbAwait(idbStore('blobs','readwrite').put(b,k));
const idbGetBlob=k=>idbAwait(idbStore('blobs','readonly').get(k));
const idbDelBlob=k=>idbAwait(idbStore('blobs','readwrite').delete(k));
function dataURLtoBlob(dataurl){
  const parts=dataurl.split(','),m=/data:(.*?);base64/.exec(parts[0]||'');
  const bin=atob(parts[1]||''),len=bin.length,arr=new Uint8Array(len);
  for(let i=0;i<len;i++)arr[i]=bin.charCodeAt(i);
  return new Blob([arr],{type:m?m[1]:'application/octet-stream'});}

/* ---- Store：统一持久层 ---- */
const Store={
  env:'idb',db:null,
  async init(){
    this.env=hasNative()?'native':(window.indexedDB?'idb':'legacy');
    if(this.env==='idb'){
      await new Promise((res,rej)=>{
        const rq=indexedDB.open(DB_NAME,1);
        rq.onupgradeneeded=e=>{const db=e.target.result;
          if(!db.objectStoreNames.contains('kv'))db.createObjectStore('kv');
          if(!db.objectStoreNames.contains('blobs'))db.createObjectStore('blobs');};
        rq.onsuccess=e=>{this.db=e.target.result;res();};rq.onerror=()=>rej(rq.error);});
    }
    await this.bootData();
  },
  payload(){
    /* 新建后从未改动的便签（_pristine）不落盘；同时剔除临时字段 */
    const kept=notes.filter(n=>!n._pristine)
      .map(n=>{const c=Object.assign({},n);delete c._pristine;return c;});
    return JSON.stringify({app:'zhipian-notes',version:3,savedAt:new Date().toISOString(),notes:kept,prefs,cloudDeleted});
  },
  async saveMeta(){
    const p=this.payload();
    if(this.env==='native')await Native.call('saveMeta',p);
    else if(this.env==='idb')await idbPut('library',p);
    else localStorage.setItem(KLIB_V3,p);
  },
  async addBlob(id,blob){
    if(this.env==='native'){
      const dataUrl=await readAsDataURL(blob);
      await Native.call('putBlobFromDataUrl',JSON.stringify(
        {id,dataUrl,name:blob.name||'',type:blob.type||'application/octet-stream'}));
    }
    else if(this.env==='idb')await idbPutBlob(id,blob);
    else if(this.env==='legacy'){/* 无 blob 能力，忽略 */}
  },
  async blobURL(f){
    if(this.env==='idb'){const b=await idbGetBlob(f.id);return URL.createObjectURL(b);}
    return null;
  },
  async removeBlob(f){
    if(this.env==='native')await Native.call('deleteFile',JSON.stringify({id:f.id}));
    else if(this.env==='idb')await idbDelBlob(f.id);
  },
  async bootData(){
    let lib=null;
    if(this.env==='native')lib=await Native.call('loadMeta').catch(()=>null);
    else if(this.env==='idb')lib=await idbGet('library');
    else lib=localStorage.getItem(KLIB_V3);
    if(typeof lib==='string'){try{lib=JSON.parse(lib);}catch(e){lib=null;}}
    if(lib&&Array.isArray(lib.notes)){notes=lib.notes;prefs=Object.assign(prefs,lib.prefs||{});
      cloudDeleted=Array.isArray(lib.cloudDeleted)?lib.cloudDeleted:[];migrate();return;}
    if(await this.migrateLegacy()){migrate();return;}
    notes=seed();await this.seedBlobs();migrate();
  },
  async absorbFiles(list){
    for(const n of list){
      for(const f of(n.files||[])){
        if(f.data){
          if(this.env==='native')
            await Native.call('putBlobFromDataUrl',JSON.stringify({id:f.id,dataUrl:f.data,name:f.name,type:f.type}));
          else if(this.env==='idb')await idbPutBlob(f.id,dataURLtoBlob(f.data));
          delete f.data;
        }
      }
    }
  },
  async migrateLegacy(){
    const raw=localStorage.getItem(KNOTES_V2)||localStorage.getItem(KNOTES_V1);
    if(!raw)return false;
    let old;try{old=JSON.parse(raw);}catch(e){return false;}
    if(!Array.isArray(old))return false;
    notes=old;
    try{const p=localStorage.getItem(KPREF_V2);if(p)prefs=Object.assign(prefs,JSON.parse(p));}catch(e){}
    await this.absorbFiles(notes);
    return true;
  },
  async seedBlobs(){await this.absorbFiles(notes);}
};

/* ---- 落盘调度（保持同步签名，内部异步） ---- */
let diskTimer=null;
function scheduleDisk(){
  clearTimeout(diskTimer);
  diskTimer=setTimeout(()=>{Store.saveMeta().catch(e=>console.warn('save failed',e));},180);
}
function persist(){scheduleDisk();return true;}
function persistPrefs(){scheduleDisk();return true;}
function flushDisk(){
  clearTimeout(diskTimer);
  return Store.saveMeta()
    .then(()=>{ if(Store.env==='native')return Native.call('forceMirror').catch(()=>{}); })
    .catch(e=>console.warn('flush failed',e));
}
function seed(){
  const now=Date.now(),D=864e5;
  return [
   {id:uid(),type:'todo',pinned:true,trashed:false,trashedAt:null,files:[],title:'本周采购清单',content:'',color:'yellow',createdAt:now-2*D,updatedAt:now-36e5,
    todos:[{id:uid(),text:'咖啡豆 200g',done:true,priority:'normal'},{id:uid(),text:'牛奶、鸡蛋',done:true,priority:'high'},{id:uid(),text:'厨房纸巾',done:false,priority:'normal'},{id:uid(),text:'洗衣液',done:false,priority:'low'},{id:uid(),text:'周末的水果',done:false,priority:'normal'}]},
   {id:uid(),type:'note',pinned:false,trashed:false,trashedAt:null,files:[],title:'读书笔记 ·《夜晚的潜水艇》',content:'陈春成的短篇，文字像<b>浸在水里</b>，想象<u>辽阔又克制</u>。<br><br><span class="hl">最喜欢《竹峰寺》</span>——一个人如何把一块石碑，连同自己的心事，妥帖地藏进山里。<br><br>下次读他的新书前，可以先看看访谈。',color:'pink',createdAt:now-5*D,updatedAt:now-5*D},
   {id:uid(),type:'todo',pinned:false,trashed:false,trashedAt:null,files:[],title:'纸片 App 1.0 清单',content:'',color:'green',createdAt:now-6*D,updatedAt:now-2*36e5,
    todos:[{id:uid(),text:'新建笔记与待办',done:true,priority:'normal'},{id:uid(),text:'富文本：加粗 / 下划线 / 高亮',done:true,priority:'high'},{id:uid(),text:'笔记本分类整理',done:true,priority:'normal'},{id:uid(),text:'实时搜索',done:false,priority:'normal'},{id:uid(),text:'数据备份与恢复',done:false,priority:'low'}]},
   {id:uid(),type:'note',pinned:false,trashed:false,trashedAt:null,
    files:[{id:uid(),name:'需求说明.pdf',size:480,type:'application/pdf',kind:'pdf',data:DEMO_PDF}],
    title:'产品灵感记录',content:'便签的<b>字号调节</b>要像真实书写一样顺手；<span class="hl">搜索结果里高亮关键词</span>，让人一眼定位。<br><br>待办卡片上直接显示完成进度条，比红点提醒更安静。',color:'blue',createdAt:now-4*D,updatedAt:now-8*36e5},
   {id:uid(),type:'note',pinned:false,trashed:false,trashedAt:null,files:[],title:'周末徒步路线',content:'西山国家森林公园，<u>东门进、沿盘山步道上行</u>，约 6 公里。<br><br>带 1.5L 水、帽子和干粮；<span class="hl">下午四点前下山</span>，赶上日落前的光线。',color:'purple',createdAt:now-3*D,updatedAt:now-3*D},
   {id:uid(),type:'note',pinned:false,trashed:false,trashedAt:null,files:[],title:'随手记',content:'便利店新出的桂花拿铁不错，<b>秋天的味道</b>。',color:'cream',createdAt:now-D,updatedAt:now-D}
  ];
}
function migrate(){
  let changed=false;const now=Date.now();
  notes.forEach(n=>{
    if(typeof n!=='object'||n===null)return;
    if(!n.id){n.id=uid();changed=true;}
    if(n.type!=='note'&&n.type!=='todo'){n.type='note';changed=true;}
    if(n.title==null){n.title='';changed=true;}
    if(n.content==null){n.content='';changed=true;}
    if('tags' in n){delete n.tags;changed=true;}
    if(!Array.isArray(n.files)){n.files=[];changed=true;}
    if(!Array.isArray(n.todos)){n.todos=[];changed=true;}
    if(n.pinned==null){n.pinned=false;changed=true;}
    if(n.trashed==null){n.trashed=false;changed=true;}
    if(n.trashedAt==null){n.trashedAt=null;changed=true;}
    if(n.color==null||n.color===''){n.color=n.type==='todo'?'green':'yellow';changed=true;}
    if(n.createdAt==null){n.createdAt=now;changed=true;}
    if(n.updatedAt==null){n.updatedAt=n.createdAt;changed=true;}
    n.todos.forEach(t=>{
      if(typeof t!=='object'||t===null)return;
      if(!t.id){t.id=uid();changed=true;}
      if(t.text==null){t.text='';changed=true;}
      if(t.done==null){t.done=false;changed=true;}
      if(!['high','normal','low'].includes(t.priority)){t.priority='normal';changed=true;}
    });
    n.files.forEach((f,fi)=>{
      if(typeof f!=='object'||f===null)return;
      if(!f.id){f.id=uid();changed=true;}
      if(f.name==null){f.name='文件';changed=true;}
      if(f.size==null){f.size=0;changed=true;}
      if(!f.kind){f.kind=fileKind(f.name);changed=true;}
      if(f.type==null){f.type='';changed=true;}
      if(f.idx==null){f.idx=fi+1;changed=true;}
    });
  });
  const b=notes.length;
  notes=notes.filter(n=>n&&n.id&&!(n.trashed&&n.trashedAt&&now-n.trashedAt>7*864e5));
  if(notes.length!==b)changed=true;
  /* 清理历史遗留空便签（无标题/正文/附件/待办文本，含回收站里的） */
  const a2=notes.length;
  notes=notes.filter(n=>!isEmptyNote(n));
  if(notes.length!==a2)changed=true;
  /* 标签功能已移除：直接清掉偏好上的标签字段，不保留旧数据兼容逻辑 */
  ['favoriteTags','extraTags','tagSug','tagBlock'].forEach(k=>{if(k in prefs){delete prefs[k];changed=true;}});
  if(changed)persist();
}