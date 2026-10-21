(function(){
/* ============ 百度网盘授权 ============ */
/* 百度默认回调 oob：授权后在官方页面直接显示授权码，无需后台配置、不挑 scheme；
   自定义回调必须是在百度应用后台登记过的 http/https 地址。 */
function panDefaultRedirect(){return 'oob';}
function panState(){
  const p=prefs.pan;
  if(!p||!p.ak)return 0;
  if(!p.token)return 1;
  if(p.expiresAt&&p.expiresAt<Date.now())return 3;
  return 2;
}
function renderPan(){
  const s=panState(),p=prefs.pan||{};
  const meta=[
    {h:'尚未连接',d:'填入开发者凭证并完成授权后，可把备份上传到百度网盘。',c:''},
    {h:'已保存凭证，待授权',d:'点击下方「开始授权」登录百度账号。',c:'wait'},
    {h:'已连接百度网盘',d:(p.baiduName?('当前账号：'+p.baiduName+'　'):'')
      +'令牌到期：'+fmtDate(p.expiresAt),c:'ok'},
    {h:'授权已过期',d:'请重新授权，或点「刷新令牌」。',c:'wait'}
  ][s];
  let html='<div class="pan-state '+meta.c+'"><b>'+meta.h+'</b><span>'+meta.d+'</span></div>'
    +'<div class="set-card-h">开发者凭证</div><div class="set-card pan-form">'
    +'<label class="pf-row"><span>AppKey（client_id）</span>'
    +'<input id="panAk" value="'+esc(p.ak||'')+'" placeholder="百度应用的 AppKey" autocomplete="off"></label>'
    +'<label class="pf-row"><span>SecretKey（client_secret）</span><div class="sk-wrap">'
    +'<input id="panSk" type="password" value="'+esc(p.sk||'')+'" placeholder="百度应用的 SecretKey">'
    +'<button type="button" id="panSkEye">显示</button></div></label>'
    +'<label class="pf-row"><span>回调地址 redirect_uri</span>'
    +'<input id="panRedirect" value="'+esc(p.redirect||panDefaultRedirect())
    +'" placeholder="默认 oob；自定义须 http/https 开头且与后台一致"></label>'
    +'<button class="pan-save" id="panSave">保存凭证</button></div>'
    +'<div class="set-card-h">授权</div><div class="set-card">'
    +'<button class="set-row" id="panAuth"><span class="s-ico">'+I.cloud+'</span>'
    +'<span class="s-txt"><b>开始授权</b><small>跳转百度登录并授权网盘读写</small></span>'
    +'<span class="chev">'+I.chev+'</span></button>'
    +'<button class="set-row" id="panManual"><span class="s-ico">'+I.clip+'</span>'
    +'<span class="s-txt"><b>手动输入授权码</b><small>授权页返回 code 后粘贴到这里</small></span>'
    +'<span class="chev">'+I.chev+'</span></button>';
  if(s===2||s===3)html+='<button class="set-row" id="panRefresh"><span class="s-ico">'+I.auto+'</span>'
    +'<span class="s-txt"><b>刷新令牌</b><small>用 refresh_token 延长有效期</small></span>'
    +'<span class="chev">'+I.chev+'</span></button>';
  html+='<button class="set-row" id="panDisconnect"><span class="s-ico" style="background:#F7E2E0">'
    +I.trash.replace('<svg','<svg style="color:var(--danger)"')+'</span>'
    +'<span class="s-txt"><b>断开并清除凭证</b></span><span class="chev">'+I.chev+'</span></button></div>';
  if(s===2)html+='<div class="set-card-h">同步</div><div class="set-card">'
    +'<button class="set-row" id="panPush"><span class="s-ico">'+I.cloud+'</span>'
    +'<span class="s-txt"><b>立即同步到云端</b><small>只传新增附件、覆盖更新笔记，不整库重传</small></span>'
    +'<span class="chev">'+I.chev+'</span></button>'
    +'<button class="set-row" id="panPull"><span class="s-ico">'+I.folder+'</span>'
    +'<span class="s-txt"><b>从云端恢复</b><small>下载云端备份到本机（会覆盖当前数据）</small></span>'
    +'<span class="chev">'+I.chev+'</span></button></div>';
  html+='<div class="set-card-h">接入步骤</div><div class="set-card pan-guide">'
    +'<div><b>1</b><span>登录百度网盘开放平台，创建应用并开通网盘权限</span></div>'
    +'<div><b>2</b><span>复制 AppKey、SecretKey 填入上方并保存（SecretKey 可长按粘贴）</span></div>'
    +'<div><b>3</b><span>点「开始授权」登录并同意；回调默认 oob，官方页面会显示授权码</span></div>'
    +'<div><b>4</b><span>用「手动输入授权码」把 code 粘贴回来，即完成连接</span></div></div>'
    +'<p class="about-txt">安全提示：凭证与令牌仅保存在本机、不会上传，本功能面向个人使用，请勿在公共或共享设备保存。安卓版通过原生通道换取令牌；浏览器版若提示跨域受限属正常现象。</p>';
  $('#panBody').innerHTML=html;

  $('#panSave').onclick=panSave;
  $('#panSkEye').onclick=()=>{const i=$('#panSk'),show=i.type==='password';
    i.type=show?'text':'password';$('#panSkEye').textContent=show?'隐藏':'显示';};
  $('#panAuth').onclick=panStartAuth;
  $('#panManual').onclick=panManualFlow;
  if($('#panRefresh'))$('#panRefresh').onclick=panRefreshToken;
  $('#panDisconnect').onclick=panDisconnect;
  if($('#panPush'))$('#panPush').onclick=()=>doCloudSync(true);
  if($('#panPull'))$('#panPull').onclick=()=>doCloudSync(false);
}
function panSave(){
  const ak=$('#panAk').value.trim(),sk=$('#panSk').value.trim(),
    redirect=$('#panRedirect').value.trim()||panDefaultRedirect();
  if(!ak){toast('请填写 AppKey');return;}
  if(!sk){toast('请填写 SecretKey');return;}
  if(redirect!=='oob'&&!/^https?:\/\//i.test(redirect)){
    toast('回调地址需以 http:// 或 https:// 开头；不填则用默认 oob');return;}
  prefs.pan=Object.assign({},prefs.pan,{ak,sk,redirect});
  persistPrefs();renderPan();toast('凭证已保存');
}
function panEnsure(){
  if(!prefs.pan||!prefs.pan.ak||!prefs.pan.sk)
    {toast('请先填写并保存 AppKey / SecretKey');return false;}
  return true;
}
function panAuthUrl(redirect){
  const p=prefs.pan;
  return 'https://openapi.baidu.com/oauth/2.0/authorize?response_type=code&client_id='
    +encodeURIComponent(p.ak)+'&redirect_uri='+encodeURIComponent(redirect)
    +'&scope='+encodeURIComponent('basic netdisk')+'&display=page';
}
function panTokenUrl(code,redirect){
  const p=prefs.pan;
  return 'https://openapi.baidu.com/oauth/2.0/token?grant_type=authorization_code&code='
    +encodeURIComponent(code)+'&client_id='+encodeURIComponent(p.ak)
    +'&client_secret='+encodeURIComponent(p.sk)
    +'&redirect_uri='+encodeURIComponent(redirect);
}
async function panStartAuth(){
  if(!panEnsure())return;
  const p=prefs.pan,redirect=p.redirect||panDefaultRedirect();p.redirect=redirect;persistPrefs();
  if(Store.env==='native'){
    try{
      const tokenTemplate=panTokenUrl('__CODE__',redirect).replace('__CODE__','{CODE}');
      await Native.call('baiduAuth',
        JSON.stringify({authUrl:panAuthUrl(redirect),tokenTemplate}));
      toast('请在打开的页面完成授权');
    }catch(e){if(e)toast(e);}
    return;
  }
  window.open(panAuthUrl(redirect),'_blank');
  toast('授权页已打开；完成后复制页面上的授权码，点「手动输入授权码」');
}
function panApplyToken(r){
  if(!r||!(r.access_token||r.token))throw '令牌获取失败';
  const p=prefs.pan;
  p.token=r.access_token||r.token;
  p.refresh=r.refresh_token||r.refresh;
  const ei=r.expires_in||r.expiresIn||2592000;
  p.expiresAt=Date.now()+ei*1000;
  persistPrefs();
  panFetchName().catch(()=>{});
}
function panManualFlow(){
  if(!panEnsure())return;
  openModal('<h3>输入授权码</h3><p>在百度授权页完成授权后，把页面显示或回调地址中的 <b>code</b> 粘贴到这里。</p>'
    +'<input class="modal-input" id="panCode" placeholder="授权码 code">'
    +'<div class="modal-actions"><button class="btn-ghost" data-close>取消</button>'
    +'<button class="btn-primary" id="panCodeOk">换取令牌</button></div>');
  setTimeout(()=>$('#panCode').focus(),120);
  $('#panCodeOk').onclick=async()=>{
    const code=$('#panCode').value.trim();if(!code){toast('请输入授权码');return;}
    closeModal();await panExchange(code);
  };
}
async function panNativeHttp(url){
  let o;
  if(IS_DESKTOP){
    o=await window.__DESKTOP__.httpRequest({method:'GET',url});
  }else{
    const r=await Native.call('httpRequest',JSON.stringify({url}));
    o=typeof r==='string'?JSON.parse(r):r;
  }
  /* 原生 HTTP 通道统一返回 {status, body}：解析 body 得到百度 JSON，
     并透传 HTTP 状态，供上层识别错误 */
  if(o&&typeof o.body==='string'){
    try{const p=JSON.parse(o.body);
      if(p&&typeof p==='object'&&typeof o.status==='number')p.__status=o.status;
      return p;}catch(e){return o;}
  }
  return o;
}
async function panExchange(code){
  const p=prefs.pan,redirect=p.redirect||panDefaultRedirect();
  toast('正在换取令牌…');
  try{
    let data;
    if(IS_DESKTOP||Store.env==='native')data=await panNativeHttp(panTokenUrl(code,redirect));
    else data=await (await fetch(panTokenUrl(code,redirect))).json();
    if(!data||!(data.access_token||data.token)){
      const why=data&&(data.error_description||data.error);
      throw new Error(why?('百度返回：'+why)
        :(data&&data.__status?('HTTP '+data.__status):'令牌获取失败'));
    }
    panApplyToken(data);renderPan();
  }catch(e){
    const msg=(e&&e.message)||String(e);
    toast(Store.env==='native'?('换取令牌失败：'+msg)
      :'换取令牌失败：浏览器跨域受限，请在安卓 App 内授权，或检查凭证');
    Logs.error('网盘','换取令牌失败',msg);
  }
}
async function panRefreshToken(){
  if(!panEnsure())return;
  const p=prefs.pan;
  if(!p.refresh){toast('缺少 refresh_token，请重新授权');return;}
  const url='https://openapi.baidu.com/oauth/2.0/token?grant_type=refresh_token&refresh_token='
    +encodeURIComponent(p.refresh)+'&client_id='+encodeURIComponent(p.ak)
    +'&client_secret='+encodeURIComponent(p.sk);
  try{
    let data;
    if(IS_DESKTOP||Store.env==='native')data=await panNativeHttp(url);
    else data=await (await fetch(url)).json();
    panApplyToken(data);renderPan();
  }catch(e){toast('刷新失败，请重新授权');}
}
async function panFetchName(){
  const p=prefs.pan;if(!p.token)return;
  const url='https://pan.baidu.com/rest/2.0/xpan/nas?method=uinfo&access_token='
    +encodeURIComponent(p.token);
  let data;
  if(IS_DESKTOP||Store.env==='native')data=await panNativeHttp(url);
  else data=await (await fetch(url)).json();
  if(data&&(data.baidu_name||data.uk)){
    p.baiduName=data.baidu_name||('用户'+data.uk);persistPrefs();
  }
}
function panDisconnect(){
  openModal('<h3>断开百度网盘？</h3><p>将清除 AppKey、SecretKey 与令牌。</p>'
    +'<div class="modal-actions"><button class="btn-ghost" data-close>取消</button>'
    +'<button class="btn-danger" id="pdOk">断开</button></div>');
  $('#pdOk').onclick=()=>{
    prefs.pan=null;persistPrefs();closeModal();renderPan();toast('已断开百度网盘');
  };
}

/* ============ 手动增量同步（点击触发，非开关） ============ */
function confirmModal(title,desc){
  return new Promise(res=>{
    openModal('<h3>'+title+'</h3><p>'+desc+'</p>'
      +'<div class="modal-actions"><button class="btn-ghost" id="cmNo">取消</button>'
      +'<button class="btn-primary" id="cmYes">继续</button></div>');
    $('#cmNo').onclick=()=>{closeModal();res(false);};
    $('#cmYes').onclick=()=>{closeModal();res(true);};
  });
}
let syncing=false;
function showSyncOverlay(on){$('#syncOverlay').classList.toggle('show',on);}
function syncProgress(pct,msg){
  const ring=$('#syncRing');
  ring.style.setProperty('--p',pct+'%');
  $('#syncPct').textContent=pct+'%';
  if(msg)$('#syncMsg').textContent=msg;
  /* #16 到达 100% 时圆环弹一下（弹性收尾）；进度回退时重新就绪 */
  if(pct>=100){
    if(!ring.classList.contains('pulse-done')){
      ring.classList.add('pulse-done');
      haptic(12);
    }
  }else ring.classList.remove('pulse-done');
}
/* #16 顶部细进度条收尾：成功时停止无限滑动，铺到 100% 并弹簧超调，再淡出；
   失败直接淡出。 */
function finishSyncTopBar(ok){
  const bar=$('#syncTopBar');
  if(!bar.classList.contains('show'))return;
  const i=bar.querySelector('i');
  const rm=reduceMotion();
  if(rm||!ok){bar.classList.remove('show');return;}
  i.style.animation='none';
  i.style.width='100%';
  i.style.background='var(--pine)';
  i.animate([
    {transform:'scaleX(.12)'},
    {transform:'scaleX(1.04)',offset:.62},
    {transform:'scaleX(1)'}
  ],{duration:520,easing:'cubic-bezier(.34,1.3,.64,1)'});
  setTimeout(()=>{
    bar.classList.remove('show');
    setTimeout(()=>{
      i.style.animation='';i.style.width='';i.style.background='';i.style.transform='';
    },280);
  },440);
}
async function silentRefresh(){
  const p=prefs.pan;
  const url='https://openapi.baidu.com/oauth/2.0/token?grant_type=refresh_token'
    +'&refresh_token='+encodeURIComponent(p.refresh)
    +'&client_id='+encodeURIComponent(p.ak)
    +'&client_secret='+encodeURIComponent(p.sk);
  const data=(IS_DESKTOP||Store.env==='native')?await panNativeHttp(url):await(await fetch(url)).json();
  panApplyToken(data);return p.token;
}
async function ensureFreshToken(){
  const p=prefs.pan;
  if(p.expiresAt&&p.expiresAt<Date.now()+120000)return await silentRefresh();
  return p.token;
}
/* ===== 桌面端百度网盘双向同步（复刻安卓 Baidu.mergeSync/pull） ===== */
const PAN_APP_DIR='/apps/纸片';
const _pad2=n=>(n<10?'0':'')+n;
const _leafOf=p=>p.slice(p.lastIndexOf('/')+1);
function _safeCloudName(t){t=(t||'').replace(/[\\/:*?"<>|]/g,'_').trim().replace(/[\.\s]+$/,'').trim();return t||'未命名';}
function _cloudFile(n){return (n||'').replace(/[\\/:*?"<>|]/g,'_')||'file';}
function _cloudBlob(buf,name,type){return new Blob([new Uint8Array(buf)],{type:mimeForName(name,type)});}
function _parseCloudJson(text,label){
  try{return JSON.parse(text);}
  catch(e){throw new Error(label+'已损坏或不是有效 JSON');}
}
async function _panDlText(token,path){
  const r=await window.__DESKTOP__.panDownloadBytes({token,path});
  if(!r.ok)return null;
  return new TextDecoder('utf-8').decode(new Uint8Array(r.buf));
}
async function _panUploadBuf(token,path,buf){
  const data=buf&&buf.buffer?buf.buffer.slice(buf.byteOffset,buf.byteOffset+buf.byteLength):buf;
  const r=await window.__DESKTOP__.panUploadBytes({token,path,buf:data});
  if(!r.ok)throw new Error(r.error||'上传失败');
  return r.md5||'';
}
async function _panUploadText(token,path,text){return _panUploadBuf(token,path,new TextEncoder().encode(text));}
async function _panMd5Buf(buf){
  const data=buf&&buf.buffer?buf.buffer.slice(buf.byteOffset,buf.byteOffset+buf.byteLength):buf;
  return await window.__DESKTOP__.panMd5({buf:data});
}
async function _panPostForm(token,path,form){
  const r=await window.__DESKTOP__.httpRequest({method:'POST',
    url:'https://pan.baidu.com/rest/2.0/xpan'+path+'&access_token='+encodeURIComponent(token),
    headers:{'Content-Type':'application/x-www-form-urlencoded'},body:form});
  return JSON.parse(r.body||'{}');
}
async function _panDel(token,paths){
  return _panPostForm(token,'/file?method=filemanager&opera=delete',
    'async=0&filelist='+encodeURIComponent(JSON.stringify(paths)));
}
async function desktopMergeSync(push,onProgress){
  const token=prefs.pan.token, APP=PAN_APP_DIR;
  const prog=onProgress||(()=>{});
  // 1. 云端清单
  prog(3,'读取云端清单');
  const ms=await _panDlText(token,APP+'/manifest.json');
  const manifest=ms?_parseCloudJson(ms,'云端备份清单'):{};
  const oldNotes=manifest.notes||{}, oldFiles=manifest.files||{};
  const tombs=new Set(cloudDeleted||[]);
  const localById=new Map();
  notes.forEach(n=>{if(!n.trashed)localById.set(n.id,n);});

  /* ---- 从云端恢复（push=false）---- */
  if(!push){
    if(!ms)throw new Error('云端没有备份，请先在手机版点一次「立即同步到云端」');
    const upFiles=manifest.files||{};
    const ids=Object.keys(upFiles);
    let downloaded=0, failedFiles=0;
    const failedNames=[];
    for(let i=0;i<ids.length;i++){
      const id=ids[i],rec=upFiles[id];
      prog(5+Math.floor(70*i/Math.max(1,ids.length)),'下载附件 '+(rec.name||''));
      const have=await idbGetBlob(id).catch(()=>null);
      if(have)continue;
      const remote='files/'+id+'/'+_pad2(rec.idx||1)+'_'+_cloudFile(rec.name||'file');
      try{
        const r=await window.__DESKTOP__.panDownloadBytes({token,path:APP+'/'+remote});
        if(r.ok){
          await idbPutBlob(id,_cloudBlob(r.buf,rec.name||'file',rec.type||''));
          downloaded++;
        }else{
          failedFiles++;failedNames.push(rec.name||id);
          Logs.warn('云同步','附件下载失败：'+(rec.name||id)+' '+(r.error||''));
        }
      }catch(e){
        failedFiles++;failedNames.push(rec.name||id);
        Logs.warn('云同步','附件下载异常：'+(rec.name||id),e&&e.stack?e.stack:String(e));
      }
    }
    prog(82,'恢复笔记内容');
    const upNotes=manifest.notes||{};
    const noteIds=Object.keys(upNotes);
    const arr=[];let badNotes=0,missingNotes=0;
    for(const id of noteIds){
      const f=upNotes[id].file;
      if(!f){badNotes++;continue;}
      const txt=await _panDlText(token,APP+'/'+f);
      if(!txt){missingNotes++;continue;}
      try{
        const n=_parseCloudJson(txt,'云端便签 '+(upNotes[id].title||id));
        if(!n.id)throw new Error('缺少 id');
        arr.push(n);
      }catch(e){
        badNotes++;
        Logs.warn('云同步','便签恢复失败：'+(upNotes[id].title||id),e&&e.stack?e.stack:String(e));
      }
    }
    if(noteIds.length&&arr.length===0)throw new Error('云端清单存在，但没有读到可恢复的便签');
    if(badNotes||missingNotes)throw new Error('有 '+(badNotes+missingNotes)+' 张云端便签读取失败，请重新同步手机端后再恢复');
    return {downloaded,failedFiles,failedNames,notes:arr,lastSync:manifest.lastSync||0};
  }

  /* ---- 双向合并（push=true）---- */
  // A. 云端独有笔记下载（墓碑除外）
  prog(10,'对比笔记');
  const cloudOnly=[],cloudDeletes=[];
  for(const id of Object.keys(oldNotes)){
    if(localById.has(id))continue;
    const f=oldNotes[id].file;if(!f)continue;
    if(tombs.has(id)){cloudDeletes.push(APP+'/'+f);continue;}
    const txt=await _panDlText(token,APP+'/'+f);
    if(txt)try{
      const n=_parseCloudJson(txt,'云端便签 '+(oldNotes[id].title||id));
      if(n.id){n.trashed=false;cloudOnly.push(n);localById.set(id,n);}
    }catch(e){Logs.warn('云同步','云端便签读取失败：'+(oldNotes[id].title||id),e&&e.stack?e.stack:String(e));}
  }
  const pulledNotes=cloudOnly.length;

  // B. 附件下载（本地缺失）
  prog(28,'检查云端附件');
  const metaById={};
  localById.forEach(n=>(n.files||[]).forEach(f=>{metaById[f.id]=f;}));
  let dlFiles=0, failedFiles=0;
  const failedNames=[];
  for(const id of Object.keys(metaById)){
    const mm=metaById[id];
    const have=await idbGetBlob(id).catch(()=>null);
    if(have)continue;
    const cr=oldFiles[id]||{};
    const idx=mm.idx||cr.idx||1, name=mm.name||cr.name||'file';
    const remote='files/'+id+'/'+_pad2(idx)+'_'+_cloudFile(name);
    try{
      const r=await window.__DESKTOP__.panDownloadBytes({token,path:APP+'/'+remote});
      if(r.ok){
        await idbPutBlob(id,_cloudBlob(r.buf,name,mm.type||cr.type||''));
        dlFiles++;
      }else{
        failedFiles++;failedNames.push(name);
        Logs.warn('云同步','附件下载失败：'+name+' '+(r.error||''));
      }
    }catch(e){
      failedFiles++;failedNames.push(name);
      Logs.warn('云同步','附件下载异常：'+name,e&&e.stack?e.stack:String(e));
    }
  }

  // C. 上传笔记（本地新增/改动 → 覆盖云端）
  prog(55,'上传笔记改动');
  const cloudLeafs=new Set(Object.keys(oldNotes)
    .map(id=>oldNotes[id].file).filter(Boolean).map(_leafOf));
  const idToFile={},toDelete=[];
  let upNotes=0,noteSkip=0;
  const ordered=[...localById.values()].sort((a,b)=>
    (a.createdAt||a.updatedAt)-(b.createdAt||b.updatedAt));
  const usedLeaf=new Set();
  for(const n of ordered){
    const id=n.id, oldRec=oldNotes[id], oldF=oldRec?oldRec.file:null;
    const same=oldRec&&oldF&&oldRec.updatedAt===n.updatedAt&&
      (n.title||'')===(oldRec.title||'')&&cloudLeafs.has(_leafOf(oldF));
    if(same){idToFile[id]=oldF;usedLeaf.add(_leafOf(oldF));noteSkip++;continue;}
    const base=_safeCloudName(n.title||'');
    let k=0,leaf=base+'.json';
    while(usedLeaf.has(leaf)||(cloudLeafs.has(leaf)&&('notes/'+leaf)!==oldF)){k++;leaf=base+'-'+k+'.json';}
    const file='notes/'+leaf;
    await _panUploadText(token,APP+'/'+file,JSON.stringify(n));
    if(oldF&&oldF!==file)toDelete.push(APP+'/'+oldF);
    idToFile[id]=file;usedLeaf.add(leaf);upNotes++;
  }

  // D. 上传附件（本地有、云端无或大小变）
  prog(78,'上传附件改动');
  const newFiles={};
  let upFiles=0,fileSkip=0;
  const fids=Object.keys(metaById);
  for(let i=0;i<fids.length;i++){
    const id=fids[i],mm=metaById[id],oldR=oldFiles[id]||{};
    const rec={name:mm.name||oldR.name||'file',idx:mm.idx||oldR.idx||1,size:oldR.size||0,md5:oldR.md5||''};
    const blob=await idbGetBlob(id).catch(()=>null);
    if(blob){
      const u8=new Uint8Array(await blob.arrayBuffer());
      const localMd5=await _panMd5Buf(u8);
      rec.size=blob.size;
      if(oldR.size===blob.size&&(!oldR.md5||oldR.md5===localMd5)){
        rec.md5=oldR.md5||localMd5;fileSkip++;
      }else{
        const remote='files/'+id+'/'+_pad2(rec.idx)+'_'+_cloudFile(rec.name);
        prog(78+Math.floor(14*i/Math.max(1,fids.length)),'上传附件 '+rec.name);
        rec.md5=await _panUploadBuf(token,APP+'/'+remote,u8);
        upFiles++;
      }
    }
    newFiles[id]=rec;
  }

  const allDel=[...toDelete,...cloudDeletes];
  if(allDel.length){prog(93,'清理旧文件');await _panDel(token,allDel);}

  // E. 云端独有并入本地
  if(pulledNotes>0)cloudOnly.forEach(n=>notes.push(n));

  // F. 写新 manifest
  prog(96,'更新清单');
  const newNotes={};
  ordered.forEach(n=>{newNotes[n.id]={file:idToFile[n.id],title:n.title||'',updatedAt:n.updatedAt};});
  await _panUploadText(token,APP+'/manifest.json',JSON.stringify(
    {app:'zhipian-notes',version:2,lastSync:Date.now(),notes:newNotes,files:newFiles}));
  return {pulledNotes,dlFiles,failedFiles,failedNames,upNotes,upFiles,noteSkip,fileSkip,notes:ordered.length,lastSync:Date.now()};
}
async function doCloudSync(push){
  if(syncing)return;
  if(!prefs.pan||!prefs.pan.token){toast('请先连接百度网盘');go('pan');return;}
  if(!push){
    const ok=await confirmModal('从云端恢复？','将用云端备份覆盖当前数据，建议先「立即同步」保存本机内容。');
    if(!ok)return;
  }
  const topBar=$('#syncTopBar');
  let pushOk=false;
  if(push)topBar.classList.add('show');
  else{showSyncOverlay(true);syncProgress(1,'准备恢复…');}
  try{
    if(push)await flushDisk();
    const token=await ensureFreshToken();
    let r;
    if(hasNative()) r=await Native.call(push?'baiduMerge':'baiduPull',token);
    else if(IS_DESKTOP) r=await desktopMergeSync(push,(pct,msg)=>{
      if(push)topBar.classList.add('show'); else syncProgress(pct,msg);
    });
    else throw new Error('当前环境不支持云同步');
    if(push){
      prefs.lastPanSync=Date.now();persistPrefs();
      const sum='云端补入笔记 '+(r.pulledNotes||0)+'、附件 '+(r.dlFiles||0)
        +'；上传笔记 '+(r.upNotes||0)+'、附件 '+(r.upFiles||0)
        +'；跳过笔记 '+(r.noteSkip||0)+'、附件 '+(r.fileSkip||0)
        +(r.failedFiles?('；附件失败 '+(r.failedFiles||0)):'');
      let refreshed=false;
      if(hasNative())refreshed=await quietMergeFromNative();
      else if(IS_DESKTOP){await flushDisk();if($('#scr-home').classList.contains('active'))renderNotes();refreshed=true;}
      toast('同步完成：'+sum);
      Logs.info('云同步','双向同步：'+sum+(refreshed?'（已静默刷新）':''));
      pushOk=true;
      finishSyncTopBar(true);   /* #16 弹性收尾 */
    }else{
      syncProgress(100,'恢复完成');
      const arr=Array.isArray(r.notes)?r.notes:[];
      const pm=mergeNotes(notes,arr);
      notes.splice(0,notes.length,...pm.list);
      syncProgress(96,'写入本机');
      await flushDisk();
      const failWarn=r.failedFiles?('；'+r.failedFiles+' 个附件下载失败，可稍后重试恢复'):'';
      toast('恢复完成：'+arr.length+' 张便签'+(pm.added?('（合并新增 '+pm.added+'）'):'')+'；下载附件 '+(r.downloaded||0)+' 个'+failWarn);
      Logs.info('云同步','从云端恢复：'+arr.length+' 张，下载附件 '+(r.downloaded||0)+(r.failedFiles?('，失败 '+r.failedFiles+'：'+(r.failedNames||[]).join(',')):''));
      setTimeout(()=>location.reload(),900);
    }
  }catch(e){
    let m=((e&&e.message)||String(e));
    if(/Unable to resolve host|No address associated|failed to connect|Network is unreachable|timeout|UnknownHost/i.test(m))
      m='网络不可用，请检查网络连接后重试';
    toast('同步失败：'+m);
    Logs.error('云同步','同步失败：'+m,(e&&e.stack)?e.stack:String(e));
    showSyncOverlay(false);
    finishSyncTopBar(false);
  }finally{
    syncing=false;
    /* 成功：finishSyncTopBar 播放弹性收尾后自行隐藏；失败：立即隐藏 */
    if(push&&!pushOk)topBar.classList.remove('show');
  }
}
/* 同步后静默合并 native 库：补入云端独有、更新改动；不整页 reload、不打断当前编辑 */
let _pendingNativeMerge=false;
async function quietMergeFromNative(){
  if(Store.env!=='native')return false;
  try{return mergeLibIntoMemory(await Native.call('loadMeta'));}catch(e){return false;}
}
function mergeLibIntoMemory(lib){
  if(!lib||!Array.isArray(lib.notes))return false;
  const editingId=($('#scr-edit').classList.contains('active')&&cur())?cur().id:null;
  const m={};notes.forEach(n=>m[n.id]=n);let changed=false;
  lib.notes.forEach(x=>{
    const c=m[x.id];
    if(!c){m[x.id]=x;changed=true;}
    else if((x.updatedAt||0)>(c.updatedAt||0)){
      if(x.id===editingId){_pendingNativeMerge=true;return;}
      m[x.id]=x;changed=true;
    }
  });
  if(Array.isArray(lib.cloudDeleted))cloudDeleted=lib.cloudDeleted;
  if(changed){notes=Object.values(m);
    if($('#scr-home').classList.contains('active'))renderNotes();}
  return changed;
}

/* ============ 资料库目录 + zip 备份（跨设备迁移） ============ */
function fsaOK(){return !!(window.showDirectoryPicker);}
function safeName(n){return String(n).replace(/[\\/:*?"<>|]/g,'_');}
let dirHandle=null;

async function bindFolder(){
  if(Store.env==='native'){
    try{
      const r=await Native.call('bindLibraryFolder');
      prefs.libName=r&&r.name?r.name:'';persistPrefs();renderSettings();
      toast('已绑定资料库目录'+(r&&r.name?'：'+r.name:''));
      Logs.info('资料库','绑定目录'+(r&&r.name?'：'+r.name:''));
    }catch(e){if(e)toast(e);Logs.error('资料库','绑定目录失败',(e&&e.message)||String(e));}
    return;
  }
  if(!fsaOK()){toast('当前浏览器不支持选目录，请用 zip 备份');return;}
  try{
    dirHandle=await window.showDirectoryPicker({mode:'readwrite'});
    await writeToFSA(dirHandle);
    await idbPut('dirHandle',dirHandle).catch(()=>{});
    prefs.libName=dirHandle.name;persistPrefs();renderSettings();
    toast('资料库已绑定并写入：'+dirHandle.name);
  }catch(e){if(e&&e.name!=='AbortError')toast('绑定失败');}
}
async function writeToFSA(handle){
  const f=await handle.getFileHandle('library.json',{create:true});
  let w=await f.createWritable();await w.write(Store.payload());await w.close();
  const filesDir=await handle.getDirectoryHandle('files',{create:true});
  for(const n of notes){
    for(const bf of n.files){
      const blob=await idbGetBlob(bf.id).catch(()=>null);if(!blob)continue;
      const sub=await filesDir.getDirectoryHandle(bf.id,{create:true});
      const ff=await sub.getFileHandle(safeName(bf.name),{create:true});
      const ww=await ff.createWritable();await ww.write(blob);await ww.close();
    }
  }
}
let __folderSyncing=false;
async function syncFolder(){
  if(__folderSyncing){toast('正在同步…');return;}
  __folderSyncing=true;
  try{
  if(Store.env==='native'){
    try{
      const r=await Native.call('syncLibraryFolder');
      if(r&&r.ok===false){toast('同步失败：'+(r.msg||''));Logs.error('资料库','同步失败',r.msg||'');}
      else{
        const parts=[];
        if(r.added)parts.push('新增 '+r.added);
        if(r.updated)parts.push('更新 '+r.updated);
        if(r.removed)parts.push('删除 '+r.removed);
        if(r.skipped)parts.push('一致 '+r.skipped);
        const detail=parts.join('、')||'无变化';
        toast((r.verified?'已核对一致':'已同步，建议再点一次核对')
          +'：'+detail+'，共'+(r.expectedFiles||0)+'个附件');
        Logs.info('资料库','手动同步 '+(r.verified?'[已核对一致] ':'[未完全核对] ')+detail);
      }
    }catch(e){if(e)toast(e);}
    return;
  }
  if(!dirHandle){toast('请先绑定资料库目录');return;}
  try{await writeToFSA(dirHandle);toast('已同步到：'+dirHandle.name);}
  catch(e){toast('同步失败，请重新绑定目录');}
  }finally{__folderSyncing=false;}
}
/* 按 id 合并便签：同 id 取 updatedAt 较新者，新 id 加入；返回合并结果与新增数 */
function mergeNotes(local,incoming){
  const byId={};local.forEach(n=>byId[n.id]=n);
  let added=0;
  incoming.forEach(n2=>{
    const ex=byId[n2.id];
    if(!ex){byId[n2.id]=n2;added++;}
    else if((n2.updatedAt||0)>(ex.updatedAt||0))byId[n2.id]=n2;
  });
  return {list:Object.values(byId),added};
}
async function openFolder(){
  if(Store.env==='native'){
    try{
      const lib=await Native.call('openLibraryFolder');
      if(lib&&lib.notes){
        const merged=mergeNotes(notes,lib.notes);notes=merged.list;
        prefs=Object.assign(prefs,lib.prefs||{});
        prefs.libName=lib.name||prefs.libName;
        migrate();persist();renderSettings();
        const miss=lib.missing||[];
        toast('已打开资料库：'+notes.length+' 张，附件还原 '+(lib.restored||0)
          +(miss.length?('，'+miss.length+' 个缺失'):(lib.verified?'，已核对一致':'')));
        Logs.info('资料库','从文件夹恢复 '+notes.length+'张 还原'+(lib.restored||0)
          +' 跳过'+(lib.skipped||0)+(miss.length?(' 缺失'+miss.length):''));
        if(miss.length)Logs.warn('资料库','附件缺失：'+miss.join(','));
      }
    }catch(e){if(e)toast(e);}
    return;
  }
  if(!fsaOK()){toast('请改用导入 zip 备份');return;}
  try{
    dirHandle=await window.showDirectoryPicker({mode:'readwrite'});
    const lf=await dirHandle.getFileHandle('library.json');
    const lib=JSON.parse(await (await lf.getFile()).text());
    if(!lib.notes)throw 0;
    const filesDir=await dirHandle.getDirectoryHandle('files').catch(()=>null);
    if(filesDir){
      for(const n of lib.notes){
        for(const bf of n.files||[]){
          const sub=await filesDir.getDirectoryHandle(bf.id).catch(()=>null);if(!sub)continue;
          const ff=await sub.getFileHandle(safeName(bf.name)).catch(()=>null);if(!ff)continue;
          await idbPutBlob(bf.id,await ff.getFile());
        }
      }
    }
    notes=lib.notes;prefs=Object.assign(prefs,lib.prefs||{});
    migrate();persist();prefs.libName=dirHandle.name;persistPrefs();
    await idbPut('dirHandle',dirHandle).catch(()=>{});
    renderSettings();toast('资料库已打开，共 '+notes.length+' 张');
  }catch(e){toast('该目录不是有效的资料库');}
}

/* ---- zip 备份包 ---- */
/* ============ RAG 知识库语料导出（切片 + 溯源） ============ */
function downloadText(text,name,mime){
  const url=URL.createObjectURL(new Blob([text],{type:mime||'text/plain'}));
  downloadURL(url,name);setTimeout(()=>URL.revokeObjectURL(url),4000);
}
/* 统一导出通道：native→写绑定目录「导出/{中文分类}/」并返回完整路径；
   网页浏览器→直接下载。所有导出都走这里，确保按指定目录、命名规范。 */
function u8ToB64(u8){
  let bin='',i=0;const CH=0x8000;
  for(;i<u8.length;i+=CH)bin+=String.fromCharCode.apply(null,u8.subarray(i,i+CH));
  return btoa(bin);
}
async function exportArtifact(cat,name,mime,payload){
  if(Store.env==='native'){
    const u8=(typeof payload==='string')?new TextEncoder().encode(payload)
      :new Uint8Array(payload);
    const r=await Native.call('exportToFolder',JSON.stringify(
      {cat,name,mime:mime||'application/octet-stream',data:u8ToB64(u8)}));
    if(!r||r.ok===false)throw new Error((r&&r.msg)||'导出失败');
    return r.path;
  }
  if(typeof payload==='string')downloadText(payload,name,mime);
  else downloadURL(URL.createObjectURL(new Blob([payload],{type:mime})),name);
  return name;
}
/* 导出反馈：展示绑定目录名 + 导出/分类/文件名 */
function exportToast(path,name){
  toast('已导出到 '+(prefs.libName?'【'+prefs.libName+'】/':'')+(path||name));
  Logs.info('导出',name+' → '+(path||'下载'));
}
/* 富文本 HTML → 纯文本，块级元素之间补换行 */
function htmlToText(html){
  const d=document.createElement('div');d.innerHTML=html||'';
  d.querySelectorAll('img.note-img[data-id]').forEach(im=>im.replaceWith('〖图片：'+im.dataset.id+'〗'));
  d.querySelectorAll('img').forEach(im=>im.replaceWith('[图片]'));
  d.querySelectorAll('.attref').forEach(s=>s.replaceWith(
     '〖附件'+(s.dataset.idx||'')+'：'+(s.dataset.name||'')+'〗'));
  d.querySelectorAll('br').forEach(br=>br.replaceWith('\n'));
  const BLOCKS=['P','DIV','LI','H1','H2','H3','H4','TR','BLOCKQUOTE','PRE'];
  const out=[];
  const walk=el=>{
    el.childNodes.forEach(node=>{
      if(node.nodeType===3)out.push(node.textContent);
      else if(node.nodeType===1){
        if(BLOCKS.indexOf(node.tagName)>=0){out.push('\n');walk(node);out.push('\n');}
        else walk(node);
      }
    });
  };
  walk(d);
  let t=out.join('');
  t=t.replace(/ /g,' ').replace(/[ \t]+\n/g,'\n')
     .replace(/\n{3,}/g,'\n\n').trim();
  return t;
}
/* 单条便签 → 若干带溯源的知识切片 */
function noteToChunks(n){
  const title=n.title||'未命名';
  const base={note_id:n.id,title,notebook:n.notebook||'',
    created_at:n.createdAt?new Date(n.createdAt).toISOString():null,
    updated_at:n.updatedAt?new Date(n.updatedAt).toISOString():null};
  const chunks=[];let ci=0;const SIZE=300;
  htmlToText(n.content).split(/\n{2,}/).map(s=>s.trim()).filter(Boolean)
    .forEach(p=>{
      for(let k=0;k<p.length;k+=SIZE){
        chunks.push(Object.assign({},base,{chunk_index:ci++,kind:'text',
          text:title+'\n'+p.slice(k,k+SIZE)}));
      }
    });
  (n.todos||[]).forEach(t=>{
    chunks.push(Object.assign({},base,{chunk_index:ci++,kind:'todo',
      text:title+' · 待办（'+(t.done?'已完成':'未完成')+'）\n'+(t.text||'')}));
  });
  /* 附件索引切片：正文切片出现〖附件idx：name〗时，下游据此把对应附件一并取回；
     图片与文档都建索引，保证换机/导入后附件与正文可关联、可随切片送入模型。 */
  (n.files||[]).forEach(f=>{
    if(f.hidden||f.derivedOf)return;
    chunks.push(Object.assign({},base,{chunk_index:ci++,
      kind:f.kind==='image'?'image_index':'file_index',
      file_id:f.id,file_idx:f.idx||0,file_name:f.name||'',file_kind:f.kind||'file',
      text:title+' · '+(f.kind==='image'?'图片':'附件')+'索引：'+(f.name||'')+'（idx '+(f.idx||0)+'）'}));
  });
  return chunks;
}
function allChunks(){
  let out=[];notes.filter(n=>!n.trashed).forEach(n=>out=out.concat(noteToChunks(n)));
  return out;
}
/* JSONL：每行一个检索切片，直接喂 embedding / 向量库管线；
   优先导出 KB 父子体系的子块（Small-to-Big 检索单元），未构建则回退即时切 */
async function exportRAGJsonl(){
  let ch=[];
  if(KB.available){
    const live=new Set(notes.filter(n=>!n.trashed).map(n=>n.id));
    ch=(await KB.allChunks()).filter(c=>c.level==='child'&&live.has(c.noteId));
  }
  if(!ch.length)ch=allChunks();
  if(!ch.length){toast('暂无可导出的内容');return;}
  const jsonl=ch.map(c=>JSON.stringify(c)).join('\n');
  try{const p=await exportArtifact('切片','纸片知识库.jsonl','application/x-ndjson',jsonl);
    exportToast(p,'纸片知识库.jsonl（'+ch.length+' 切片）');
  }catch(e){toast((e&&e.message)||'导出失败');}
}
/* Markdown：整库成文，便于直接喂 LLM 或人工查看 */
async function exportRAGMarkdown(){
  const live=notes.filter(n=>!n.trashed);
  let md='# 纸片知识库\n\n导出时间：'+new Date().toLocaleString()+'\n\n';
  live.forEach(n=>{
    md+='## '+(n.title||'未命名')+'\n\n';
    const meta=[];
    if(n.notebook)meta.push('笔记本：'+n.notebook);
    if(meta.length)md+='> '+meta.join('｜')+'\n\n';
    const t=htmlToText(n.content);if(t)md+=t+'\n\n';
    if(n.todos&&n.todos.length){
      md+='### 待办\n';
      n.todos.forEach(x=>{md+='- ['+(x.done?'x':' ')+'] '+(x.text||'')+'\n';});
      md+='\n';
    }
  });
  try{const p=await exportArtifact('Markdown','纸片知识库.md','text/markdown',md);
    exportToast(p,'纸片知识库.md');
  }catch(e){toast((e&&e.message)||'导出失败');}
}

})();
