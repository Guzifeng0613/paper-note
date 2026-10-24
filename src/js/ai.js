/* ============================================================
   P2：端内混合检索（检索层 = 效果第一杠杆）
   BM25 全文 + 标题/元数据，RRF 融合，轻量重排；向量路可插拔
   ============================================================ */
/* 中文友好分词：汉字 unigram + bigram（免词典、召回稳），拉丁/数字整词 */
function qtokenize(text){
  const s=(text||'').toLowerCase();const toks=[];
  (s.match(/[一-鿿]+/g)||[]).forEach(run=>{
    for(const ch of run)toks.push(ch);
    for(let i=0;i<run.length-1;i++)toks.push(run.slice(i,i+2));
  });
  (s.match(/[a-z0-9]+/g)||[]).forEach(w=>toks.push(w));
  return toks;
}
const QSTOP=new Set(['的','了','是','我','你','他','她','它','和','与','吗','呢','什么','怎么','如何','请问','一下','这个','那个','可以','还有','我们','你们','他们','知道','告诉','以及','或者','还是','但是','因为','所以','啊','吧','呀','哦','的话']);
/* BM25（rank_bm25 思路，免部署） */
function buildBM25(docs){
  const N=docs.length,k1=1.5,b=0.75;
  const df={},docLen=new Array(N);
  docs.forEach((d,i)=>{docLen[i]=d.tokens.length;
    new Set(d.tokens).forEach(t=>df[t]=(df[t]||0)+1);});
  const avgdl=docLen.reduce((a,x)=>a+x,0)/(N||1);
  return {score(qt,i){
    const tf={};docs[i].tokens.forEach(t=>tf[t]=(tf[t]||0)+1);
    const dl=docLen[i];let s=0;
    new Set(qt).forEach(t=>{
      if(!(t in df))return;
      const f=tf[t]||0,idf=Math.log(1+(N-(df[t]||0)+0.5)/((df[t]||0)+0.5));
      s+=idf*(f*(k1+1))/(f+k1*(1-b+b*dl/(avgdl||1)));
    });return s;
  }};
}
/* 查询改写：去停用词取核心词（整句保留做短语命中） */
function expandQuery(q){
  const terms=Array.from(new Set(qtokenize(q).filter(t=>!QSTOP.has(t))));
  return {terms};
}
/* 向量路（可插拔）：配置 OpenAI 兼容 embedding 才启用，失败静默降级 */
/* ============================================================
   API 配置（ccswitch 风格：多套 OpenAI 兼容配置，本地保存/可切换/可测连通）
   ============================================================ */
function cfgUid(){return 'cfg'+Date.now().toString(36)+Math.random().toString(36).slice(2,7);}
/* 旧单套 prefs.ai → 多配置（仅一次） */
function migrateAiConfig(){
  if(prefs.ais&&Array.isArray(prefs.ais.list)){
    if(!prefs.ais.cur&&prefs.ais.list.length)prefs.ais.cur=prefs.ais.list[0].id;return;}
  const list=[];
  if(prefs.ai&&(prefs.ai.key||prefs.ai.baseUrl))
    list.push({id:cfgUid(),name:'我的配置',baseUrl:prefs.ai.baseUrl||'',
      key:prefs.ai.key||'',model:prefs.ai.model||'',embModel:prefs.ai.embeddingModel||'',
      addedAt:Date.now()});
  prefs.ais={cur:list.length?list[0].id:null,list};
  delete prefs.ai;
}
const AIs={
  all(){return (prefs.ais&&prefs.ais.list)||[];},
  get(id){return this.all().find(x=>x.id===id)||null;},
  current(){const l=this.all();
    return l.find(x=>x.id===(prefs.ais&&prefs.ais.cur))||l[0]||null;},
  add(cfg){const c={id:cfgUid(),name:cfg.name||('配置 '+(this.all().length+1)),
    baseUrl:cfg.baseUrl||'',key:cfg.key||'',model:cfg.model||'',
    embModel:cfg.embModel||'',addedAt:Date.now(),last:null};
    if(cfg.vision===true)c.vision=true;   /* 仅明确声明视觉才标记；否则交给模型名判断 */
    prefs.ais.list.push(c);
    if(!prefs.ais.cur)prefs.ais.cur=c.id;
    persistPrefs();Logs.info('AI配置','新增配置：'+c.name);return c;},
  update(id,cfg){const c=this.get(id);if(!c)return;
    ['name','baseUrl','key','model','embModel'].forEach(k=>{
      if(cfg[k]!=null)c[k]=cfg[k];});
    if(cfg.vision===true)c.vision=true;else delete c.vision;
    persistPrefs();Logs.info('AI配置','更新配置：'+c.name);},
  remove(id){prefs.ais.list=prefs.ais.list.filter(x=>x.id!==id);
    if(prefs.ais.cur===id)prefs.ais.cur=prefs.ais.list.length?prefs.ais.list[0].id:null;
    persistPrefs();Logs.info('AI配置','删除配置 '+id);},
  setCur(id){const c=this.get(id);if(!c)return;
    prefs.ais.cur=id;persistPrefs();Logs.info('AI配置','切换当前配置：'+c.name);}
};
/* 测试钩子：注入一套 AI 配置（验收 AI 全流程用；本地应用无远程攻击面） */
window.__injectAi=(c)=>{
  const cfg={id:cfgUid(),name:'测试配置',baseUrl:c.baseUrl,key:c.key,model:c.model,embModel:'',addedAt:Date.now()};
  prefs.ais={cur:cfg.id,list:[cfg]};persistPrefs();return cfg;
};
window.__hasVaultSynth=()=>notes.some(n=>n._vaultSynth);
async function vectorRank(children,query,size){
  const ai=AIs.current();
  const url=((ai&&ai.baseUrl)||'').replace(/\/$/,'');
  const key=(ai&&ai.key)||'',model=(ai&&ai.embModel)||'';
  if(!url||!key||!model)return [];
  try{
    const emb=async txt=>{
      const r=await fetch(url+'/embeddings',{method:'POST',
        headers:{'Content-Type':'application/json','Authorization':'Bearer '+key},
        body:JSON.stringify({model,input:txt})});
      if(!r.ok)throw new Error('embedding http '+r.status);
      return (await r.json()).data[0].embedding;
    };
    const qv=await emb(query);const scored=[];
    for(const c of children){
      const cv=await emb(c.text);
      let dot=0,nq=0,nv=0;
      for(let i=0;i<qv.length;i++){dot+=qv[i]*cv[i];nq+=qv[i]*qv[i];nv+=cv[i]*cv[i];}
      scored.push({id:c.id,s:dot/(Math.sqrt(nq)*Math.sqrt(nv)||1)});
    }
    return scored.filter(x=>!isNaN(x.s)).sort((a,b)=>b.s-a.s).slice(0,size);
  }catch(e){return [];}
}
/* 主入口：多路召回 → RRF 融合 → 轻量重排 → Small-to-Big 回父块 */
async function knowledgeSearch(query,opts){
  opts=opts||{};const limit=opts.limit||20;
  const all=await KB.allChunks();
  let children=all.filter(c=>c.level==='child');
  if(opts.noteIds){const nset=new Set(opts.noteIds);children=children.filter(c=>nset.has(c.noteId));}
  const docs=children.map(c=>({id:c.id,tokens:qtokenize(c.text)}));
  const bm=buildBM25(docs);
  const {terms}=expandQuery(query);
  const ql=query.trim().toLowerCase();
  const bmRank=children.map((c,i)=>({id:c.id,s:bm.score(terms,i)}))
    .filter(x=>x.s>0).sort((a,b)=>b.s-a.s).slice(0,limit*2);
  const metaRank=children.map(c=>{
    let s=0;const cl=(c.text||'').toLowerCase();
    if(ql&&cl.includes(ql))s+=4;
    if(c.crumbs){const cr=c.crumbs.toLowerCase();
      const titlePart=cr.split(' / ').slice(-1)[0]||'';
      if(ql&&titlePart.includes(ql))s+=3;
      if(ql&&cr.includes(ql))s+=1.2;}
    let hit=0;terms.forEach(t=>{if(cl.includes(t))hit++;});
    return {id:c.id,s:hit*0.25+s};
  }).filter(x=>x.s>0).sort((a,b)=>b.s-a.s).slice(0,limit*2);
  const vr=await vectorRank(children,query,limit*2);
  const K=60,fused={};
  [bmRank,metaRank,vr].forEach(rank=>rank.forEach((x,i)=>{
    fused[x.id]=(fused[x.id]||0)+1/(K+i+1);}));
  const byId=Object.fromEntries(children.map(c=>[c.id,c]));
  let ranked=Object.keys(fused).map(id=>{
    const c=byId[id],cl=(c.text||'').toLowerCase();let boost=0;
    if(ql&&cl.includes(ql))boost+=0.2;
    const cover=terms.length?terms.filter(t=>cl.includes(t)).length/terms.length:0;
    return {id,score:fused[id]+boost+cover*0.12,child:c};
  }).sort((a,b)=>b.score-a.score);
  const pmap=Object.fromEntries(all.filter(c=>c.level==='parent').map(c=>[c.id,c]));
  const results=[];const seenP=new Set(),seenN=new Set();
  for(const r of ranked){
    const pid=r.child.parentId;
    if(seenP.has(pid))continue;
    const par=pmap[pid]||r.child;
    const nid=par.noteId;
    /* 同一便签只保留最相关的一个父块，来源不重复 */
    if(nid!=null&&seenN.has(String(nid)))continue;
    seenP.add(pid);if(nid!=null)seenN.add(String(nid));
    results.push({parent:par,hit:r.child,score:r.score});
    if(results.length>=limit)break;
  }
  return results;
}

/* 高亮检索词（转义后替换，长词优先） */
function highlightText(text,ql){
  let html=esc(text);
  const terms=Array.from(new Set(qtokenize(ql).filter(t=>!QSTOP.has(t)&&t.length>=2)))
    .sort((a,b)=>b.length-a.length).slice(0,8);
  terms.forEach(t=>{
    const safe=esc(t).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    html=html.replace(new RegExp(safe,'g'),m=>'<mark>'+m+'</mark>');
  });
  return html;
}
/* ============================================================
   统一搜索：搜索 / 知识库 RAG / 问 AI
   ============================================================ */
let srMode='search';
const srBody=()=>document.getElementById('srBody');
const srQ=()=>document.getElementById('srInput').value.trim();
/* ---- 历史记录（清爽列表，可单删/清空） ---- */
const histIcon='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';
const xIcon='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>';
function removeRecent(q){prefs.recents=prefs.recents.filter(x=>x!==q);persistPrefs();renderSearch();}
function clearRecents(){prefs.recents=[];persistPrefs();renderSearch();toast('已清空搜索历史');}
function srResHead(kind,title,sub){
  const ic={
    search:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>',
    rag:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 13 9 5 9-5"/></svg>',
    ai:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/><circle cx="12" cy="12" r="3.2"/></svg>'
  }[kind];
  return '<div class="sr-res-head '+kind+'"><div class="rh-ico">'+ic+'</div>'
    +'<div><b>'+esc(title)+'</b><span>'+esc(sub)+'</span></div></div>';
}
function srGuide(){
  const map={search:['搜索便签','输入关键词，即时匹配标题、正文、待办与附件名。'],
    rag:['检索知识库','本地混合检索，展示完整段落与出处，点击打开原便签。']};
  const g=map[srMode];
  return '<div class="sr-loading" style="padding-top:70px"><b style="display:block;font-size:15px;color:var(--ink-1);margin-bottom:8px">'+g[0]+'</b>'+g[1]+'</div>';
}
function renderHistory(){
  const box=srBody();
  if(!prefs.recents.length){box.innerHTML=srGuide();return;}
  box.innerHTML='<div class="rh-head"><b>最近搜索</b><button id="rhClear">清空</button></div>'
    +prefs.recents.map(r=>'<div class="hist-row">'+histIcon+
      '<button class="hr-q" data-q="'+esc(r)+'">'+esc(r)+'</button>'+
      '<button class="hr-del" data-del="'+esc(r)+'" aria-label="删除">'+xIcon+'</button></div>').join('');
  box.querySelector('#rhClear').onclick=clearRecents;
  box.querySelectorAll('.hr-q').forEach(b=>b.onclick=()=>{
    document.getElementById('srInput').value=b.dataset.q;
    document.getElementById('srClear').hidden=false;runSrSubmit();});
  box.querySelectorAll('.hr-del').forEach(b=>b.onclick=()=>removeRecent(b.dataset.del));
}
/* ---- 正常搜索（关键词，实时） ---- */
function renderNormal(q){
  const box=srBody();const hits=searchHits(q);
  if(!hits.length){box.innerHTML='<div class="sr-loading">没有找到“'+esc(q)+'”<br>换个关键词，或试试知识库 / 问 AI。</div>';return;}
  box.innerHTML=srResHead('search',hits.length+' 张便签匹配','关键词命中标题、正文、待办或附件名')
    +'<div>'+hits.map(n=>srItem(n,q)).join('')+'</div>';
  box.querySelectorAll('.sr-item').forEach(el=>el.onclick=()=>{
    addRecent(q);location.hash='#/edit?id='+encodeURIComponent(el.dataset.id);});
}
/* ---- RAG（混合检索，完整父块+出处） ---- */
function renderRagResults(rs,q){
  const box=srBody();
  if(!rs.length){box.innerHTML='<div class="sr-loading">没有找到相关内容。<br>可先在设置里构建知识库切片，或换个说法。</div>';return;}
  box.innerHTML=srResHead('rag',rs.length+' 段知识库命中','本地混合检索，展示完整段落与出处');
  rs.forEach(r=>{
    const p=r.parent,card=document.createElement('div');card.className='ask-card';
    const loc=(p.fileName||p.loc)?('附件：'+[p.fileName,p.loc].filter(Boolean).join(' · ')):'';
    card.innerHTML='<div class="ac-crumbs"><span>'+esc(p.crumbs||'')+'</span>'+
      '<span class="ac-score">相关度 '+r.score.toFixed(3)+'</span></div>'+
      '<div class="ac-text">'+highlightText(p.text,q)+'</div>'+
      (loc?'<div class="ac-loc">'+I.clip+esc(loc)+'</div>':'')+
      '<div class="ac-open">查看原文 <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg></div>';
    card.onclick=()=>{addRecent(q);location.hash='#/edit?id='+encodeURIComponent(p.noteId);};
    box.appendChild(card);
  });
}
async function runRag(q){
  const box=srBody();box.innerHTML='<div class="sr-loading">检索中…</div>';
  try{renderRagResults(await knowledgeSearch(q,{limit:20}),q);}
  catch(e){box.innerHTML='<div class="sr-loading">检索失败，请重试。</div>';
    Logs.error('搜索','RAG 检索失败',(e&&e.message)||String(e));}
}
/* ---- AI（检索上下文 + LLM 生成 + 引用） ---- */
/* filetext 缓存展开为纯文本（带位置），限量避免附件过长撑爆上下文 */
function attachmentRecToText(rec,maxLen){
  if(!rec||!rec.data)return '';
  const segs=fileTextSegments(rec);
  let t=segs.map(s=>(s.loc?'['+s.loc+'] ':'')+s.text).join('\n');
  if(t.length>maxLen)t=t.slice(0,maxLen)+'…';
  return t.trim();
}
/* 命中切片若带附件索引：取回相关附件正文（缓存优先，缺失现场解析），随上下文一起发给模型 */
async function buildAttachmentContext(refs){
  const need=new Map();
  const addMeta=a=>{if(a&&a.id&&!need.has(a.id))need.set(a.id,a);};
  for(const r of refs){
    const p=r.parent;
    if(p&&p.fileId)addMeta({id:p.fileId,idx:p.fileIdx||0,name:p.fileName||'附件'});
    if(p&&p.attachments)p.attachments.forEach(addMeta);
  }
  if(!need.size)return '';
  const blocks=[];
  for(const [id,meta] of need){
    let rec=await KB.getFileText(id).catch(()=>null);
    if(!rec||!rec.data||rec.data.kind==='unsupported'||rec.data.kind==='error'){
      try{rec=await fileTextFor({id,name:meta.name,idx:meta.idx,kind:meta.kind});}catch(e){rec=null;}
    }
    const txt=attachmentRecToText(rec,2000);
    if(txt)blocks.push('〖附件：'+meta.name+'〗\n'+txt);
  }
  return blocks.length?('\n\n相关附件内容（随命中切片的附件索引一并提供）：\n'+blocks.join('\n\n')):'';
}
async function runAi(q){
  const box=srBody();const ai=AIs.current();
  if(!ai||!ai.baseUrl||!ai.key||!ai.model){
    box.innerHTML='<div class="sr-loading">还没配置 AI 接口。<br>请到 设置 → AI 配置 添加一套 OpenAI 兼容接口。</div>';return;}
  box.innerHTML='<div class="sr-loading">正在检索并思考…</div>';
  let refs=[];
  try{refs=await knowledgeSearch(q,{limit:8});}catch(e){refs=[];}
  const ctx=refs.map((r,i)=>'【来源'+(i+1)+'】'+liveCrumb(r)+'\n'+r.parent.text).join('\n\n');
  const attachCtx=await buildAttachmentContext(refs);
  const messages=[
    {role:'system',content:'你是严谨的个人知识库助手。只能依据下面参考资料回答；资料不足要明确说明；回答中用[1][2]标注来源编号。\n\n参考资料：\n'+(ctx||'(无)')+attachCtx},
    {role:'user',content:q}];
  const aiIcoS='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v3M12 18v3M3 12h3M18 12h3"/><circle cx="12" cy="12" r="3.2"/></svg>';
  const refsBoxHtml=()=>refs.length?('<div class="aia-refs"><div class="arf-h">参考来源（点击打开）</div>'+
    refs.map((r,i)=>'<button class="aia-ref" data-nid="'+r.parent.noteId+'"><b>['+(i+1)+']</b> '+
      esc(liveCrumb(r))+'</button>').join('')+'</div>'):'';
  box.innerHTML='<div class="ai-thread"><div class="ai-q-bubble">'+esc(q)+'</div>'
    +'<div class="ai-a-wrap"><div class="ai-avatar">'+aiIcoS+'</div>'
    +'<div class="ai-a-bubble"><div class="aia-txt" id="aiStream"></div><div id="aiRefs"></div></div></div></div>';
  try{
    const resp=await fetch(ai.baseUrl.replace(/\/$/,'')+'/chat/completions',{method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+ai.key},
      body:JSON.stringify({model:ai.model,messages,temperature:0.3,stream:true})});
    if(!resp.ok||!resp.body){
      let hint=(resp.status===401||resp.status===403)?'API Key 无效':resp.status===404?'地址或模型有误':('HTTP '+resp.status);
      box.innerHTML='<div class="sr-loading">AI 请求失败：'+hint+'</div>';
      Logs.error('搜索','AI 问答失败 HTTP '+resp.status);return;}
    const reader=resp.body.getReader(),dec=new TextDecoder('utf-8');
    let ans='',buf='';const tgt=document.getElementById('aiStream');
    while(true){
      const {done,value}=await reader.read();
      if(done)break;
      buf+=dec.decode(value,{stream:true});
      const lines=buf.split('\n');buf=lines.pop();
      for(const ln of lines){
        const s=ln.trim();if(!s.startsWith('data:'))continue;
        const d0=s.slice(5).trim();if(d0==='[DONE]')continue;
        try{const j=JSON.parse(d0);const d=j.choices&&j.choices[0]&&j.choices[0].delta;
          if(d&&d.content){ans+=d.content;tgt.innerHTML=esc(ans);}}catch(e){}
      }
    }
    if(!ans.trim())ans='(空回答)';
    tgt.innerHTML=esc(ans);
    document.getElementById('aiRefs').innerHTML=refsBoxHtml();
    box.querySelectorAll('.aia-ref').forEach(b=>b.onclick=()=>{
      addRecent(q);location.hash='#/edit?id='+encodeURIComponent(b.dataset.nid);});
    Logs.info('搜索','AI 问答完成（流式），引用 '+refs.length+' 段');
  }catch(e){
    box.innerHTML='<div class="sr-loading">AI 请求失败：'+esc((e&&e.message)||String(e))+'</div>';
    Logs.error('搜索','AI 问答异常',(e&&e.stack)||String(e));}
}
/* ---- 控制器 ---- */
function renderSearch(){
  const q=srQ();document.getElementById('srClear').hidden=!q;
  if(!q){renderHistory();return;}
  if(srMode==='search')renderNormal(q);
  else srBody().innerHTML='<div class="sr-loading">按键盘“回车”检索知识库</div>';
}
function runSrSubmit(){
  const q=srQ();if(!q)return;addRecent(q);
  if(srMode==='search')renderNormal(q);else runRag(q);
}
/* 兼容旧入口 */
async function runAsk(){const q=srQ();if(!q){toast('请输入内容');return;}await runRag(q);}

/* ============ AI 对话（独立模块） ============ */
const ChatStore={
  KEY:'zhipian.chats.v1',
  all(){try{return JSON.parse(localStorage.getItem(this.KEY))||[];}catch(e){return[];}},
  save(l){try{localStorage.setItem(this.KEY,JSON.stringify(l));}catch(e){}},
  get(id){return this.all().find(c=>c.id===id)||null;},
  create(){
    const c={id:'c'+Date.now().toString(36)+Math.random().toString(36).slice(2,6),
      title:'新对话',messages:[],createdAt:Date.now(),updatedAt:Date.now()};
    const l=this.all();l.unshift(c);this.save(l);return c;},
  update(id,fn){const l=this.all();const c=l.find(x=>x.id===id);
    if(c){fn(c);c.updatedAt=Date.now();this.save(l);}return c;},
  remove(id){this.save(this.all().filter(c=>c.id!==id));}
};
let curChatId=null;
const CHAT_AVATAR_AI='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v3M12 18v3M3 12h3M18 12h3"/><circle cx="12" cy="12" r="3.2"/></svg>';
/* 独立对话的知识库范围：跟随主页当前笔记本，null=全部 */
function chatScope(){
  const nb=prefs.nbFilter||null;
  const live=notes.filter(n=>!n.trashed);
  if(!nb)return {type:'all',name:null,noteIds:live.map(n=>n.id)};
  return {type:'notebook',name:nb,noteIds:live.filter(n=>n.notebook===nb).map(n=>n.id)};
}
function scopeBarHtml(sc){
  const ico='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/></svg>';
  let txt;
  if(sc.type==='all')txt='全部 · '+sc.noteIds.length+' 篇便签';
  else if(sc.type==='note')txt='本页笔记「'+(sc.name||'无标题')+'」';
  else txt='笔记本「'+sc.name+'」· '+sc.noteIds.length+' 篇';
  return '<span class="sb-ico">'+ico+'</span><span class="sb-txt">'+esc(txt)+'</span>';
}
function openChatScreen(){
  let c=curChatId?ChatStore.get(curChatId):null;
  if(!c){const all=ChatStore.all();c=all[0]||null;curChatId=c?c.id:null;}
  renderChatView(c);
}
function chatEmptyHtml(){return '<div class="chat-empty"></div>';}
function chatMsgHtml(m){
  if(m.role==='user')return '<div class="msg user"><div class="m-bubble">'+esc(m.content)+'</div></div>';
  const refs=(m.refs&&m.refs.length)?('<div class="chat-refs">'+
    m.refs.map(r=>'<button class="cr-ref" data-nid="'+r.noteId+'"><span class="cr-ico">'+
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m8 8-4 4 4 4M16 8l4 4-4 4M13 5l-2 14"/></svg></span>'+
      '<span class="cr-name">'+esc(r.title)+'</span></button>').join('')+'</div>'):'';
  return '<div class="msg ai"><div class="m-bubble">'+mdToHtml(m.content)+refs+'</div></div>';
}
function renderChatView(c){
  $('#chatTitle').textContent=(c&&c.title)?c.title:'AI 对话';
  $('#chatScopeBar').innerHTML=scopeBarHtml(chatScope());
  const body=$('#chatBody');
  if(!c||!c.messages.length){
    body.innerHTML=chatEmptyHtml();
    body.querySelectorAll('.ce-sugs button').forEach(b=>b.onclick=()=>{
      const inp=$('#chatInput');inp.value=b.dataset.q;autoGrowChat(inp);inp.focus();});
  }else{
    body.innerHTML=c.messages.map(chatMsgHtml).join('');
    body.querySelectorAll('.cr-ref').forEach(b=>b.onclick=()=>{
      editReturnHash='#/chat';
      location.hash='#/edit?id='+encodeURIComponent(b.dataset.nid);});
    body.scrollTop=body.scrollHeight;
  }
}
/* ---- 历史对话抽屉 ---- */
function openChatDrawer(){renderChatDrawer();
  $('#chatDrawer').classList.add('open');$('#chatDrawerMask').classList.add('open');}
function closeChatDrawer(){
  $('#chatDrawer').classList.remove('open');$('#chatDrawerMask').classList.remove('open');}
function chatGroupOf(ts){
  const now=new Date();
  const startToday=new Date(now.getFullYear(),now.getMonth(),now.getDate()).getTime();
  if(ts>=startToday)return '今天';
  if(ts>=startToday-7*864e5)return '7 天内';
  if(ts>=startToday-30*864e5)return '30 天内';
  return '更早';
}
function renderChatDrawer(){
  const list=$('#cdList');let chats=ChatStore.all();
  const kw=($('#cdSearch')&&$('#cdSearch').value||'').trim();
  if(kw)chats=chats.filter(c=>(c.title||'').includes(kw));
  if(!chats.length){list.innerHTML='<div class="log-empty" style="padding:30px 16px">'+
    (kw?'没有匹配的对话':'还没有对话，点上方“新对话”开始。')+'</div>';return;}
  const groups=['今天','7 天内','30 天内','更早'];const map={};
  chats.forEach(c=>{const g=chatGroupOf(c.updatedAt);(map[g]=map[g]||[]).push(c);});
  let html='';
  groups.forEach(g=>{
    if(!map[g])return;
    html+='<div class="cd-gl">'+g+'</div>';
    map[g].forEach(c=>{
      html+='<button class="cd-item'+(c.id===curChatId?' cur':'')+'" data-id="'+c.id+'"><b>'+
        esc(c.title||'新对话')+'</b><span class="cd-del" data-del="'+c.id+'" aria-label="删除">'+
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg></span></button>';
    });
  });
  list.innerHTML=html;
  list.querySelectorAll('.cd-item').forEach(it=>{
    it.onclick=e=>{
      if(e.target.closest('.cd-del'))return;
      const id=it.dataset.id;curChatId=id;
      renderChatView(ChatStore.get(id));closeChatDrawer();};
  });
  list.querySelectorAll('.cd-del').forEach(d=>{
    d.onclick=e=>{e.stopPropagation();
      const id=d.dataset.del;const c=ChatStore.get(id);
      openModal('<h3>删除这段对话？</h3><p>将永久删除「'+esc(c.title||'新对话')+
        '」及其全部消息。</p><div class="modal-actions"><button class="m-btn" data-close>取消</button>'+
        '<button class="m-btn danger" id="mConfirmDelChat">删除</button></div>');
      $('#mConfirmDelChat').onclick=()=>{
        ChatStore.remove(id);
        if(curChatId===id){const rest=ChatStore.all()[0]||null;
          curChatId=rest?rest.id:null;renderChatView(rest);}
        closeModal();renderChatDrawer();
        Logs.info('AI对话','删除对话 '+(c.title||''));
      };
    };
  });
}
function startNewChat(){
  const c=ChatStore.create();curChatId=c.id;renderChatView(c);closeChatDrawer();
  setTimeout(()=>$('#chatInput').focus(),220);
}
function autoGrowChat(el){el.style.height='auto';el.style.height=Math.min(el.scrollHeight,120)+'px';}
/* 轻量且安全的 markdown → HTML（先转义再标记，防 XSS） */
function mdInline(s){
  s=s.replace(/`([^`]+)`/g,(m,c)=>'<code>'+c+'</code>');
  s=s.replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>');
  s=s.replace(/__([^_]+)__/g,'<strong>$1</strong>');
  s=s.replace(/(^|[^*])\*([^*\n]+)\*/g,'$1<em>$2</em>');
  s=s.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+|mailto:[^)\s]+)\)/g,
    (m,t,u)=>'<a href="'+u+'" rel="noopener">'+t+'</a>');
  return s;
}
function mdToHtml(src){
  const text=esc(src==null?'':String(src)).replace(/\r\n?/g,'\n');
  const lines=text.split('\n');let out=[],i=0,para=[];
  const pushPara=()=>{if(para.length){out.push('<p>'+para.map(mdInline).join('<br>')+'</p>');para=[];}};
  while(i<lines.length){
    const ln=lines[i];
    if(/^```/.test(ln.trim())){
      pushPara();const buf=[];i++;
      while(i<lines.length&&!/^```/.test(lines[i].trim())){buf.push(lines[i]);i++;}
      i++;out.push('<pre><code>'+buf.join('\n')+'</code></pre>');continue;}
    const h=ln.match(/^(#{1,4})\s+(.*)$/);
    if(h){pushPara();const lv=h[1].length;out.push('<h'+lv+'>'+mdInline(h[2])+'</h'+lv+'>');i++;continue;}
    if(/^\s*&gt;\s?/.test(ln)){
      pushPara();const bq=[];
      while(i<lines.length&&/^\s*&gt;\s?/.test(lines[i])){bq.push(lines[i].replace(/^\s*&gt;\s?/,''));i++;}
      out.push('<blockquote>'+bq.map(mdInline).join('<br>')+'</blockquote>');continue;}
    if(/^\s*[-*]\s+/.test(ln)){
      pushPara();const items=[];
      while(i<lines.length&&/^\s*[-*]\s+/.test(lines[i])){items.push(lines[i].replace(/^\s*[-*]\s+/,''));i++;}
      out.push('<ul>'+items.map(x=>'<li>'+mdInline(x)+'</li>').join('')+'</ul>');continue;}
    if(/^\s*\d+[.)]\s+/.test(ln)){
      pushPara();const items=[];
      while(i<lines.length&&/^\s*\d+[.)]\s+/.test(lines[i])){items.push(lines[i].replace(/^\s*\d+[.)]\s+/,''));i++;}
      out.push('<ol>'+items.map(x=>'<li>'+mdInline(x)+'</li>').join('')+'</ol>');continue;}
    if(/^\s*([-*_])\1{2,}\s*$/.test(ln)){pushPara();out.push('<hr>');i++;continue;}
    if(ln.trim()===''){pushPara();i++;continue;}
    para.push(ln);i++;
  }
  pushPara();
  return out.join('');
}
let chatSending=false;
function updateChatSendBtn(){const b=$('#chatSend');if(b)b.disabled=chatSending;}
async function sendChat(){
  const inp=$('#chatInput');const text=inp.value.trim();
  if(!text||chatSending)return;
  const ai=AIs.current();
  if(!ai||!ai.baseUrl||!ai.key||!ai.model){toast('请先到 设置 → AI 配置 添加接口');return;}
  let c=curChatId?ChatStore.get(curChatId):null;
  if(!c){c=ChatStore.create();curChatId=c.id;}
  const cid=c.id;
  ChatStore.update(cid,cc=>cc.messages.push({role:'user',content:text,ts:Date.now()}));
  inp.value='';autoGrowChat(inp);
  renderChatView(ChatStore.get(cid));
  const body=$('#chatBody');
  const tmp=document.createElement('div');tmp.className='msg ai';
  tmp.innerHTML='<div class="m-bubble"><span class="typing"><i></i><i></i><i></i></span><div class="chat-refs" id="chatRefs"></div></div>';
  body.appendChild(tmp);body.scrollTop=body.scrollHeight;
  chatSending=true;updateChatSendBtn();
  const scope=chatScope();
  if(scope.type==='notebook'&&!scope.noteIds.length)toast('当前笔记本暂无便签，知识库为空');
  /* 放行联网：① 触发词“联网搜索”；② 模型为千问/智谱时默认开启。
     咒语从检索词中剥离，检索更准；联网参数按各厂商官方方式分别传 */
  const spellNet=/联网搜索|搜索网络|联网查询|web[ ]?search/i.test(text);
  const isQwen=/qwen|千问/i.test(ai.model||''),isGlm=/glm|智谱|chatglm/i.test(ai.model||'');
  const allowNet=spellNet||isQwen||isGlm;
  const cleanQ=text.replace(/联网搜索|搜索网络|联网查询|web[ ]?search/ig,'').trim()||text;
  let refs=[];
  try{refs=await knowledgeSearch(cleanQ,{limit:8,noteIds:scope.noteIds});}catch(e){refs=[];}
  const kbCtx=refs.map((r,i)=>'【来源'+(i+1)+'】'+liveCrumb(r)+'\n'+r.parent.text).join('\n\n');
  let attachCtx='';try{attachCtx=await buildAttachmentContext(refs);}catch(e){}
  const scopeDesc=scope.type==='all'?'全部便签（'+scope.noteIds.length+' 篇）'
    :('笔记本「'+scope.name+'」（'+scope.noteIds.length+' 篇）');
  const systemMsg={role:'system',content: allowNet ? (
    '本次你已被授权联网搜索，不必局限于知识库。你可读取的知识库范围：'+scopeDesc+
    '。先参考下面资料；资料不足或涉及时效性信息时使用联网搜索获取最新网页，结合后回答；'
    +'联网内容注明来源链接，知识库内容用[1][2]标注。\n\n参考资料：\n'+(kbCtx||'(该范围内暂无相关笔记)')+attachCtx)
    :('你是严谨的个人知识库助手。你可读取的知识库范围：'+scopeDesc+
    '。只能依据下面参考资料回答；该范围内若资料不足要明确说明，可结合常识但需与资料区分；回答中用[1][2]标注来源编号。\n\n参考资料：\n'+
    (kbCtx||'(该范围内暂无相关笔记)')+attachCtx)};
  const msgs=[systemMsg,...ChatStore.get(cid).messages
    .map(m=>({role:m.role==='user'?'user':'assistant',content:m.content}))];
  let ans='';
  try{
    const resp=await fetch(ai.baseUrl.replace(/\/$/,'')+'/chat/completions',{method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+ai.key},
      body:JSON.stringify((()=>{const p={model:ai.model,messages:msgs,temperature:0.6,stream:true};
        if(allowNet){
          if(isQwen)p.enable_search=true;
          else if(isGlm)p.tools=[{type:'web_search',web_search:{enable:true}}];
          /* 仅咒语、模型未知：不塞可能报错的参数，靠放行 system 提示 */
        }
        return p;})())});
    const bubble=tmp.querySelector('.m-bubble');
    if(!resp.ok||!resp.body){
      const hint=(resp.status===401||resp.status===403)?'API Key 无效':resp.status===404?'地址或模型有误':('HTTP '+resp.status);
      bubble.innerHTML='<span style="color:var(--danger)">请求失败：'+hint+'</span>';
      Logs.error('AI对话','请求失败 HTTP '+resp.status);
      chatSending=false;updateChatSendBtn();return;}
    const reader=resp.body.getReader(),dec=new TextDecoder('utf-8');let buf='';
    while(true){
      const {done,value}=await reader.read();if(done)break;
      buf+=dec.decode(value,{stream:true});
      const lines=buf.split('\n');buf=lines.pop();
      for(const ln of lines){
        const s=ln.trim();if(!s.startsWith('data:'))continue;
        const d0=s.slice(5).trim();if(d0==='[DONE]')continue;
        try{const j=JSON.parse(d0);const d=j.choices&&j.choices[0]&&j.choices[0].delta;
          if(d&&d.content){ans+=d.content;bubble.innerHTML=mdToHtml(ans);body.scrollTop=body.scrollHeight;}}catch(e){}
      }
    }
    if(!ans.trim())ans='(空回答)';
    bubble.innerHTML=mdToHtml(ans);
    const msgRefs=refs.map(r=>{
      const cn=notes.find(x=>String(x.id)===String(r.parent.noteId));
      return {noteId:r.parent.noteId,title:cn?crumbsFor(cn):(r.parent.crumbs||'原便签')};
    });
    ChatStore.update(cid,cc=>{
      cc.messages.push({role:'assistant',content:ans,ts:Date.now(),refs:msgRefs});
      if(!cc.title||cc.title==='新对话'){
        const fu=cc.messages.find(m=>m.role==='user');
        cc.title=fu?fu.content.slice(0,18):'新对话';}
    });
    renderChatView(ChatStore.get(cid));
    Logs.info('AI对话','完成一轮：'+ChatStore.get(cid).title);
  }catch(e){
    tmp.querySelector('.m-bubble').innerHTML='<span style="color:var(--danger)">请求失败：'+
      esc((e&&e.message)||String(e))+'</span>';
    Logs.error('AI对话','异常',(e&&e.stack)||String(e));}
  chatSending=false;updateChatSendBtn();
}

/* ============ 本页笔记智能问答 ============ */
function noteContextText(n){
  const parts=[];
  if(n.title)parts.push('标题：'+n.title);
  if(n.content){
    let md=htmlToMarkdown(n.content);
    md=md.replace(/\n{3,}/g,'\n\n').trim();
    if(md)parts.push('正文：\n'+md);}
  if(Array.isArray(n.todos)&&n.todos.length)
    parts.push('待办：\n'+n.todos.map(t=>(t.done?'[x]':'[ ]')+' '+(t.text||'')).join('\n'));
  if(Array.isArray(n.files)&&n.files.length)
    parts.push('附件：'+n.files.map(f=>(f.size||0)>ATTACH_INLINE_LIMIT
      ?(f.name+'（'+formatSize(f.size)+'，超过10MB仅提供索引）'):f.name).join('、'));
  return parts.join('\n\n');
}
let naiMessages=[],naiSending=false,naiContext='',naiReady=null;
function naiWelcomeHtml(n){
  return '<div class="chat-empty"><div class="ce-ico">'+
    '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.6l1.9 5.1 5.1 1.9-5.1 1.9L12 16.6l-1.9-5.1L5 9.6l5.1-1.9z"/></svg></div>'+
    '<h3>关于这页笔记想问什么？</h3><p>我已读入「'+esc(n.title||'无标题')+'」，将只依据它回答。</p></div>';
}
function naiMsgHtml(m){
  if(m.role==='user')return '<div class="msg user"><div class="m-bubble">'+esc(m.content)+'</div></div>';
  return '<div class="msg ai"><div class="m-bubble">'+mdToHtml(m.content)+'</div></div>';
}
function bindNaiSugs(){
  $('#naiBody').querySelectorAll('.ce-sugs button').forEach(b=>b.onclick=()=>{
    const inp=$('#naiInput');inp.value=b.dataset.q;autoGrowChat(inp);inp.focus();});
}
function renderNai(){
  const body=$('#naiBody');
  if(!naiMessages.length){body.innerHTML=naiWelcomeHtml(cur());bindNaiSugs();return;}
  body.innerHTML=naiMessages.map(naiMsgHtml).join('');
  body.scrollTop=body.scrollHeight;
}
async function openNoteAi(){
  const ai=AIs.current();
  if(!ai||!ai.baseUrl||!ai.key||!ai.model){toast('请先到 设置 → AI 配置 添加接口');return;}
  const n=cur();if(!n)return;
  flushDisk();
  naiMessages=[];
  $('#naiScopeBar').innerHTML=scopeBarHtml({type:'note',name:n.title,noteIds:[n.id]});
  naiContext=noteContextText(n);
  renderNai();
  /* 立即打开，不等待文档/图片解析 */
  $('#noteAiPanel').classList.add('open');$('#noteAiMask').classList.add('open');
  Logs.info('本页问答','打开，笔记 '+(n.title||n.id));
  /* 文档类附件全文 / 图片切片：后台加载，不阻塞界面；首轮提问前会等待它完成 */
  naiReady=(async()=>{let add='';
    try{
      const docs=await noteDocTexts(n);
      if(docs.length)add+='\n\n本页文档类附件全文：\n'+docs.join('\n\n');
      const isl=await noteImageSliceText(n);
      if(isl)add+='\n\n本页图片的知识切片：\n'+isl;
    }catch(e){}
    if(add)naiContext+=add;
  })();
}
function closeNoteAi(){
  $('#noteAiPanel').classList.remove('open');$('#noteAiMask').classList.remove('open');}
async function sendNoteAi(){
  const inp=$('#naiInput');const text=inp.value.trim();
  if(!text||naiSending)return;
  naiMessages.push({role:'user',content:text});
  inp.value='';autoGrowChat(inp);renderNai();
  const body=$('#naiBody');
  const tmp=document.createElement('div');tmp.className='msg ai';
  tmp.innerHTML='<div class="m-bubble"><span class="typing"><i></i><i></i><i></i></span></div>';
  body.appendChild(tmp);body.scrollTop=body.scrollHeight;
  naiSending=true;
  const ai=AIs.current();
  const n=cur();
  if(naiReady){try{await Promise.race([naiReady,new Promise(r=>setTimeout(r,8000))]);}catch(e){}}
  const vision=n?await noteVisionImages(n):[];
  /* 真正发图需模型支持视觉；否则只提示、仅发文字（不报错、不中断） */
  let useVision=vision.length>0&&modelSupportsVision(ai);
  if(vision.length&&!useVision){
    toast('当前模型「'+(ai.model||'未命名')+'」不支持图片识别，本轮仅发送文字；如需读图请换视觉模型（如豆包视觉版）');
  }
  const buildMsgs=withVision=>{
    const sysTail=withVision?('\n\n（已随本轮附上 '+vision.length+' 张本页图片，请结合图片内容回答）'):'';
    const conv=naiMessages.map(m=>({role:m.role==='user'?'user':'assistant',content:m.content}));
    if(withVision&&conv.length){
      const last=conv[conv.length-1];
      last.content=[{type:'text',text:String(last.content)}].concat(
        vision.map(v=>({type:'image_url',image_url:{url:v.dataUrl}})));
    }
    return [{role:'system',content:'你是严谨的个人笔记助手。只能依据下面这页笔记的内容（含标题、正文、附件与随附图片）回答；内容不足要明确说明，不要编造。\n\n'+naiContext+sysTail},
      ...conv];
  };
  let msgs=buildMsgs(useVision);
  let ans='';
  try{
    const doFetch=()=>fetch(ai.baseUrl.replace(/\/$/,'')+'/chat/completions',{method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+ai.key},
      body:JSON.stringify({model:ai.model,messages:msgs,temperature:0.4,stream:true})});
    let resp=await doFetch();
    const bubble=tmp.querySelector('.m-bubble');
    /* 兜底：发了图却被接口以 400/视觉相关原因拒绝 → 去图重试一次并提示 */
    if(!resp.ok&&useVision){
      const et=await resp.text().catch(()=>'');
      if(resp.status===400||/image|vision|multimodal|图片|视觉/i.test(et)){
        useVision=false;msgs=buildMsgs(false);
        toast('当前模型不支持图片，已自动改为仅发送文字');
        resp=await doFetch();
      }
    }
    if(!resp.ok||!resp.body){
      const hint=(resp.status===401||resp.status===403)?'API Key 无效':resp.status===404?'地址或模型有误':('HTTP '+resp.status);
      bubble.innerHTML='<span style="color:var(--danger)">请求失败：'+hint+'</span>';
      Logs.error('本页问答','失败 HTTP '+resp.status);naiSending=false;return;}
    const reader=resp.body.getReader(),dec=new TextDecoder('utf-8');let buf='';
    while(true){
      const {done,value}=await reader.read();if(done)break;
      buf+=dec.decode(value,{stream:true});
      const lines=buf.split('\n');buf=lines.pop();
      for(const ln of lines){
        const s=ln.trim();if(!s.startsWith('data:'))continue;
        const d0=s.slice(5).trim();if(d0==='[DONE]')continue;
        try{const j=JSON.parse(d0);const d=j.choices&&j.choices[0]&&j.choices[0].delta;
          if(d&&d.content){ans+=d.content;bubble.innerHTML=mdToHtml(ans);body.scrollTop=body.scrollHeight;}}catch(e){}
      }
    }
    if(!ans.trim())ans='(空回答)';
    bubble.innerHTML=mdToHtml(ans);
    naiMessages.push({role:'assistant',content:ans});renderNai();
    Logs.info('本页问答','完成一轮：'+(cur().title||''));
  }catch(e){
    tmp.querySelector('.m-bubble').innerHTML='<span style="color:var(--danger)">请求失败：'+esc((e&&e.message)||String(e))+'</span>';
    Logs.error('本页问答','异常',(e&&e.stack)||String(e));}
  naiSending=false;
}

/* ============================================================
   API 配置管理（ccswitch 风格）+ 连通性测试
   ============================================================ */
async function httpVia(method,url,headers,body){
  if(hasNative())return await Native.call('httpRequest',{method,url,headers,body});
  const r=await fetch(url,{method,headers:headers||{},body:body||undefined});
  return {status:r.status,body:await r.text()};
}
/* 连通性测试：有模型→最小 chat/completions；无模型→GET /models */
async function testAiConn(cfg){
  const base=(cfg.baseUrl||'').replace(/\/$/,'');
  if(!base)return {ok:false,msg:'请先填写请求地址'};
  if(!/^https?:\/\//i.test(base))return {ok:false,msg:'地址需以 http:// 或 https:// 开头'};
  const headers={'Content-Type':'application/json'};
  if(cfg.key)headers['Authorization']='Bearer '+cfg.key;
  const t0=Date.now();let r;
  try{
    if(cfg.model)
      r=await httpVia('POST',base+'/chat/completions',headers,
        JSON.stringify({model:cfg.model,messages:[{role:'user',content:'ping'}],max_tokens:1}));
    else
      r=await httpVia('GET',base+'/models',headers,null);
    const ms=Date.now()-t0,st=r.status;
    if(st>=200&&st<300)return {ok:true,status:st,ms,msg:'连通成功（'+ms+'ms）'};
    let hint='';
    if(st===401||st===403)hint='鉴权失败：检查 API Key';
    else if(st===404)hint='未找到：检查请求地址或模型名';
    else if(st===429)hint='限流或额度不足';
    else hint=(r.body||'').slice(0,140);
    return {ok:false,status:st,ms,msg:'HTTP '+st+' '+hint};
  }catch(e){
    const m=((e&&e.message)||String(e));let hint=m;
    if(/resolve host|failed to fetch|networkerror|network/i.test(m))
      hint='无法连接服务器，请检查手机网络与请求地址（'+m+'）';
    else if(/timeout|abort/i.test(m))hint='连接超时，请检查网络或稍后再试';
    return {ok:false,ms:Date.now()-t0,msg:'请求失败：'+hint};}
}
function renderAiList(){
  const box=$('#aiList');box.innerHTML='';
  const all=AIs.all(),curId=prefs.ais&&prefs.ais.cur;
  if(!all.length){box.innerHTML='<div class="log-empty">还没有配置，点下方按钮新增一套 OpenAI 兼容接口。</div>';return;}
  all.forEach(c=>{
    const isCur=c.id===curId;
    const el=document.createElement('div');
    el.className='ai-cfg'+(isCur?' cur':'');
    const dot=c.last==null?'<span class="ac-dot none"></span>'
      :c.last.ok?'<span class="ac-dot ok"></span>':'<span class="ac-dot bad"></span>';
    el.innerHTML='<div class="ac-top"><span class="ac-name">'+dot+esc(c.name||'未命名')+
      (isCur?'<span class="ac-curtag">当前</span>':'')+'</span></div>'+
      '<div class="ac-line">'+esc(c.baseUrl||'(未填地址)')+'</div>'+
      '<div class="ac-line">模型：'+esc(c.model||'(未填)')+
      (c.embModel?('　Embedding：'+esc(c.embModel)):'')+'</div>'+
      '<div class="ac-acts">'+
      (isCur?'':'<button data-a="cur">设为当前</button>')+
      '<button data-a="edit">编辑/测试</button>'+
      '<button data-a="del" class="danger">删除</button></div>';
    el.querySelectorAll('button').forEach(b=>b.onclick=()=>{
      const a=b.dataset.a;
      if(a==='cur'){AIs.setCur(c.id);renderAiList();}
      else if(a==='edit')editAiCfg(c.id);
      else if(a==='del')confirmDelAi(c.id);
    });
    box.appendChild(el);
  });
}
function confirmDelAi(id){
  const c=AIs.get(id);
  openModal('<h3>删除配置？</h3><p>将删除「'+esc(c.name)+'」，不影响已保存的便签。</p>'+
    '<div class="modal-actions"><button class="btn-ghost" data-close>取消</button>'+
    '<button class="btn-primary" id="delAiOk">删除</button></div>');
  $('#delAiOk').onclick=()=>{AIs.remove(id);closeModal();renderAiList();};
}
function editAiCfg(id){
  const c=id?AIs.get(id):null;
  const d=c||{name:'',baseUrl:'',key:'',model:'',embModel:'',vision:false};
  openModal('<h3>'+(c?'编辑配置':'新增配置')+'</h3>'+
    '<div class="pan-form" style="margin:0 0 10px">'+
    '<div class="pf-row"><span>配置名称（备注）</span><input id="cfName" value="'+esc(d.name)+'" placeholder="如 公司号 / 本地号"></div>'+
    '<div class="pf-row"><span>请求地址 base_url</span><input id="cfBase" value="'+esc(d.baseUrl)+'" placeholder="https://…"></div>'+
    '<div class="pf-row"><span>API Key</span><input id="cfKey" type="password" value="'+esc(d.key)+'"></div>'+
    '<div class="pf-row"><span>模型名称</span><input id="cfModel" value="'+esc(d.model)+'" placeholder="模型名或接入点 ID"></div>'+
    '<div class="pf-row"><span>Embedding 模型（可选）</span><input id="cfEmb" value="'+esc(d.embModel)+'" placeholder="留空则仅 BM25"></div>'+
    '<label style="display:flex;align-items:center;gap:8px;margin:6px 0 2px;font-size:14px;color:var(--ink-1)"><input type="checkbox" id="cfVision" style="width:17px;height:17px"'+(d.vision?' checked':'')+'> 支持图片识别（视觉模型，用于读取图片内容）</label>'+
    '</div>'+
    '<div id="cfTestRes" class="ac-line" style="margin:0 0 8px"></div>'+
    '<div class="modal-actions"><button class="btn-ghost" data-close>取消</button>'+
    '<button class="btn-ghost" id="cfTest">测试连通</button>'+
    '<button class="btn-primary" id="cfSave">保存</button></div>');
  $('#cfTest').onclick=async ()=>{
    const res=$('#cfTestRes');res.innerHTML='测试中…';
    const r=await testAiConn({baseUrl:$('#cfBase').value,key:$('#cfKey').value,model:$('#cfModel').value});
    res.innerHTML=(r.ok?'<span class="ac-dot ok"></span>':'<span class="ac-dot bad"></span>')+esc(r.msg);
  };
  $('#cfSave').onclick=()=>{
    const cfg={name:$('#cfName').value.trim(),baseUrl:$('#cfBase').value.trim(),
      key:$('#cfKey').value.trim(),model:$('#cfModel').value.trim(),
      embModel:$('#cfEmb').value.trim(),vision:$('#cfVision').checked};
    if(c)AIs.update(c.id,cfg);else AIs.add(cfg);
    closeModal();renderAiList();toast('配置已保存');
  };
}
/* 设置入口 → 配置列表页 */
function openAiCfg(){location.hash='#/ai';}

/* ============================================================
   运行日志查看（筛选 / 展开详情 / 清空 / 导出）
   ============================================================ */
let logLv='all';
function fmtLogT(t){const d=new Date(t),p=n=>String(n).padStart(2,'0');
  return p(d.getMonth()+1)+'-'+p(d.getDate())+' '+p(d.getHours())+':'+p(d.getMinutes())+':'+p(d.getSeconds());}
function renderLog(){
  const box=$('#logList');box.innerHTML='';
  let arr=Logs.list.slice();
  if(logLv!=='all')arr=arr.filter(e=>e.level===logLv);
  arr=arr.slice(-300).reverse();
  if(!arr.length){box.innerHTML='<div class="log-empty">当前筛选下没有日志。</div>';return;}
  arr.forEach(e=>{
    const row=document.createElement('div');row.className='log-row';
    row.innerHTML='<span class="lr-lv '+e.level+'"></span><div class="lr-body">'+
      '<div class="lr-meta"><span class="lr-cat">'+esc(e.cat)+'</span>'+
      '<span class="lr-t">'+fmtLogT(e.t)+'</span></div>'+
      '<div class="lr-msg">'+esc(e.msg)+'</div>'+
      (e.detail?('<div class="lr-detail">'+esc(e.detail)+'</div>'):'')+'</div>';
    if(e.detail)row.onclick=()=>row.classList.toggle('open');
    box.appendChild(row);
  });
}
async function exportLogs(){
  const jsonl=Logs.list.map(e=>JSON.stringify(e)).join('\n');
  try{const p=await exportArtifact('日志','纸片运行日志.jsonl','application/x-ndjson',jsonl);
    exportToast(p,'纸片运行日志.jsonl');
  }catch(e){toast((e&&e.message)||'导出失败');}
}

/* ---- 知识库包（开放格式，可整体迁移） ---- */
function kbFileName(){
  const d=new Date(),p=n=>String(n).padStart(2,'0');
  return '纸片知识库-'+d.getFullYear()+p(d.getMonth()+1)+p(d.getDate())+'.kbpkg.zip';
}
async function kbManifest(live,chunks){
  let fc=0,fb=0;
  live.forEach(n=>(n.files||[]).forEach(f=>{fc++;fb+=f.size||0;}));
  return {app:'zhipian-kb',format:KB_VERSION,chunkVersion:CHUNK_VERSION,
    createdAt:new Date().toISOString(),embedding:null,embeddingModel:null,
    counts:{notes:live.length,chunks:chunks.length,files:fc,fileBytes:fb},
    note:'开放格式：library.json(原文)+chunks.jsonl(切片)+files/(附件)，换设备/工具导入即完整还原'};
}
function b64encode(str){
  const bytes=new TextEncoder().encode(str);let bin='';
  for(let i=0;i<bytes.length;i+=0x8000)
    bin+=String.fromCharCode.apply(null,bytes.subarray(i,i+0x8000));
  return btoa(bin);
}
/* native：chunks.jsonl 分片传给 Java，由 Java 连同 library/files 打包（高效处理大附件） */
async function nativeExportKbPackage(){
  const live=notes.filter(n=>!n.trashed);
  const allCh=(await KB.allChunks()).filter(c=>live.some(n=>n.id===c.noteId));
  const manifest=await kbManifest(live,allCh);
  await Native.call('kbChunksBegin');
  const jsonl=allCh.map(c=>JSON.stringify(c)).join('\n');
  for(let k=0;k<jsonl.length;k+=900000)
    await Native.call('kbChunksPart',
      JSON.stringify({b64:b64encode(jsonl.slice(k,k+900000))}));
  const kr=await Native.call('exportKbPackage',JSON.stringify(manifest));
  toast(kr&&kr.path?('已保存到 '+kr.path):'知识库包已导出');
}
async function exportKbPackage(){
  /* 导出前补齐附件 md（确定性解析，图片除外） */
  let st=false;
  await ensureAllExportMd(o=>{if(!st){TaskUI.begin('准备知识库',o.total);st=true;}
    TaskUI.update(o.i-1,'解析附件 '+o.i+'/'+o.total);});
  if(st){TaskUI.update(1,'准备完成');setTimeout(()=>TaskUI.end(),300);}
  if(Store.env==='native'){try{await nativeExportKbPackage();}catch(e){if(e)toast(e);}return;}
  /* 切片未构建也能导出：chunks.jsonl 留空，之后可重建 */
  toast('正在打包完整备份…');
  try{
    window.__estep='zip';
    const zip=new JSZip();
    const live=notes.filter(n=>!n.trashed);window.__estep='live';
    const allCh=(await KB.allChunks()).filter(c=>live.some(n=>n.id===c.noteId));
    window.__estep='allCh '+allCh.length;
    zip.file('manifest.json',JSON.stringify(await kbManifest(live,allCh),null,2));
    window.__estep='man';
    zip.file('library.json',Store.payload());window.__estep='lib';
    zip.file('chunks.jsonl',allCh.map(c=>JSON.stringify(c)).join('\n'));window.__estep='cj';
    const fd=zip.folder('files');
    for(const n of live)for(const f of n.files||[]){
      window.__estep='att '+f.id+' '+(f.name||'');
      const b=await attachmentBlob(f).catch(e=>{window.__estep='attErr '+String(e);return null;});
      window.__estep='attOk '+f.id+' '+(b?b.size:0);
      if(b)fd.folder(f.id).file(safeName(f.name),b);
    }
    window.__estep='gen';
    const blob=await zip.generateAsync({type:'blob',compression:'DEFLATE',
      compressionOptions:{level:6}});
    window.__estep='genok '+blob.size;
    const url=URL.createObjectURL(blob);
    downloadURL(url,kbFileName());
    setTimeout(()=>URL.revokeObjectURL(url),5000);
    toast('知识库包已导出');
  }catch(e){window.__estep='CATCH '+(e&&e.message);toast('打包失败');}
}
async function importChunksJsonl(txt){
  const items=[];
  for(const line of txt.split('\n')){
    const ln=line.trim();if(!ln)continue;
    try{const c=JSON.parse(ln);if(c&&c.id)items.push({store:'chunks',obj:c});}catch(e){}
  }
  await KB.batch(items);
}
/* ============================================================
   统一导入：一个入口，按后缀 + 内容自动识别还原
   zip/kbpkg（知识库包 or 备份）、json（备份）、jsonl（切片）
   ============================================================ */
/* 应用 library 负载，让用户选 合并 / 覆盖 */
function applyLibrary(lib,label){
  if(!lib||!Array.isArray(lib.notes)){toast('文件中没有便签数据');return;}
  const hadBackup=importBackupActive;
  const settleImport=async kind=>{
    if(hadBackup&&hasNative()){try{await Native.call(kind);}catch(e){}}
    importBackupActive=false;
  };
  openModal('<h3>导入 '+lib.notes.length+' 张便签</h3>'+
    '<p>来源：'+esc(label)+'<br><b>合并</b>：保留现有，同 ID 以导入为准；<b>覆盖</b>：清空后完全替换。</p>'+
    '<div class="modal-actions"><button class="btn-ghost" data-close>取消</button>'+
    '<button class="btn-ghost" id="uimm">合并</button>'+
    '<button class="btn-primary" id="uimo">覆盖</button></div>');
  /* 取消：附件暂换内容回滚到导入前 */
  $('#modalBox [data-close]').onclick=async()=>{
    await settleImport('rollbackImport');closeModal();
  };
  $('#uimm').onclick=async()=>{
    const m={};notes.concat(lib.notes).forEach(x=>m[x.id]=x);
    notes=Object.values(m);prefs=Object.assign(prefs,lib.prefs||{});
    markCloudDeleted(Array.isArray(lib.cloudDeleted)?lib.cloudDeleted:[]);
    migrate();persist();closeModal();renderSettings();renderChips();renderNotes();
    /* 合并：旧附件按 id 并入（并集），避免现有便签丢附件 */
    await settleImport('mergeImport');
    toast('已合并，共 '+notes.length+' 张');
    Logs.info('导入','合并（'+label+'）'+lib.notes.length+' 张');
    /* v16：把本次新进来的笔记追加回 Markdown 资料库（已有笔记不动，避免副本），再刷新首页 */
    v16WritebackAfterImport('append', lib.notes);
  };
  $('#uimo').onclick=async()=>{
    notes=lib.notes;prefs=Object.assign(prefs,lib.prefs||{});
    cloudDeleted=Array.isArray(lib.cloudDeleted)?[...lib.cloudDeleted]:[];
    migrate();persist();closeModal();renderSettings();renderChips();renderNotes();
    /* 覆盖：确认使用导入附件，删除旧备份 */
    await settleImport('commitImport');
    toast('已导入 '+notes.length+' 张');
    Logs.info('导入','覆盖（'+label+'）'+lib.notes.length+' 张');
    /* v16：覆盖=整库替换，清空 vault 后把当前 Store 全量落回 .md，再刷新首页 */
    v16WritebackAfterImport('replace');
  };
}
/* v16 Markdown 资料库回写：导入确认后把结果落到 vault 文件并刷新首页。
   append=只追加本次新笔记（合并）；replace=清空 vault 后全量重写（覆盖）。
   纯 v15 环境无 VaultSync 时自动跳过，不影响旧流程。 */
async function v16WritebackAfterImport(kind, incomingNotes){
  try{
    if(typeof VaultSync==='undefined' || !VaultSync || !VaultSync.appendNotesToVault) return;
    await flushDisk();
    if(kind==='replace'){
      toast('正在写入资料库…');
      await VaultSync.restoreFromStore();
    }else{
      toast('正在追加到资料库…');
      await VaultSync.appendNotesToVault(incomingNotes || null);
    }
    if(window.VUI && VUI.renderHome) VUI.renderHome();
    Logs.info('导入','v16 vault 回写完成（'+kind+'）');
  }catch(e){ console.warn('v16 import writeback failed', e); Logs.error('导入','v16 回写失败',(e&&e.message)||String(e)); }
}
/* zip：自动区分 知识库包（manifest+chunks）/ 备份 */
async function importZipBlob(file){
  toast('正在读取压缩包…');
  let zip;
  try{zip=await JSZip.loadAsync(file);}catch(e){toast('压缩包无法识别');
    Logs.error('导入','zip 无法识别',(e&&e.message)||String(e));return;}
  const man=zip.file('manifest.json'),lj=zip.file('library.json');
  if(!lj){toast('压缩包中没有 library.json');return;}
  let lib;
  try{lib=JSON.parse(await lj.async('string'));}catch(e){toast('library.json 解析失败');return;}
  for(const path of Object.keys(zip.files)){
    if(!path.startsWith('files/'))continue;
    const parts=path.split('/');if(parts.length<3)continue;
    const entry=zip.files[path];
    if(entry&&!entry.dir&&Store.env==='idb')
      await idbPutBlob(parts[1],await entry.async('blob')).catch(()=>{});
  }
  const cj=zip.file('chunks.jsonl');
  if(cj){const t=await cj.async('string');if(t.trim())await importChunksJsonl(t);}
  applyLibrary(lib,man?'知识库包':'备份 zip');
}
/* json：备份（含 notes） */
async function importJsonText(text,label){
  let data;
  try{data=JSON.parse(text);}catch(e){toast('JSON 无法解析');return;}
  if(data&&Array.isArray(data.notes))applyLibrary(data,label||'JSON 备份');
  else if(Array.isArray(data))applyLibrary({notes:data},label||'JSON 数组');
  else toast('未识别：JSON 需含 notes 数组');
}
/* jsonl：切片 */
async function importJsonlText(text){
  if(!text||!text.trim()){toast('文件为空');return;}
  await importChunksJsonl(text);
  toast('切片已导入');Logs.info('导入','切片 JSONL');
}
function unifiedImportEntry(){
  if(Store.env==='native'){nativeUnifiedImport();return;}
  $('#importUnified').click();
}
async function unifiedHandleFile(file){
  const nm=(file.name||'').toLowerCase();
  if(nm.endsWith('.zip')||nm.endsWith('.kbpkg'))return importZipBlob(file);
  if(nm.endsWith('.jsonl'))return importJsonlText(await file.text());
  if(nm.endsWith('.json'))return importJsonText(await file.text());
  toast('不支持的类型，请选择 .zip / .json / .jsonl');
}
$('#importUnified').addEventListener('change',async e=>{
  const f=e.target.files[0];e.target.value='';if(f)await unifiedHandleFile(f);
});
/* native 统一导入：原生选文件并按后缀分流，结果回 JS 处理 */
async function nativeUnifiedImport(){
  let r;
  try{r=await Native.call('importData');}catch(e){if(e)toast(e);return;}
  if(r.kind==='lib'){
    try{
      const cr=await fetch('https://zhipian.local/kb/import_chunks.jsonl');
      if(cr.ok){const t=await cr.text();if(t.trim())await importChunksJsonl(t);}
    }catch(e){}
    importBackupActive=true;
    applyLibrary({notes:r.notes,prefs:r.prefs},r.label||'知识库包/备份');
  }else if(r.kind==='chunks'){
    try{const cr=await fetch('https://zhipian.local/kb/import_chunks.jsonl');
      if(cr.ok)await importJsonlText(await cr.text());}catch(e){toast('切片导入失败');}
  }else if(r.kind==='json'){
    importJsonText(r.text,'JSON 备份');
  }
}
/* 构建切片：前台 / 后台保活 二选一 */
function askBuildKnowledge(){
  openActionSheet([
    {icon:I.note,label:'前台构建（显示进度）',fn:()=>buildKnowledgeIndex(false)},
    {icon:I.note,label:'后台保活构建（切后台继续）',fn:()=>buildKnowledgeIndex(true)},
  ],'构建知识切片');
}
