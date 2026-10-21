/* run-perf.js —— 纸片 v16 性能测量（1000 篇 vault）
   测量项：
     1) 冷启动索引耗时：reload 后 Vault.init() 耗时（10 次，中位数/P95）
     2) 单文件保存落盘：VaultFS.write 实际写盘耗时（50 次，中位数/P95）
     3) 列表滚动帧率：1000 卡片网格程序化滚动，rAF 采样（平均帧率/长帧占比）
     4) pageerror 计数 + performance.memory 前后对比
   后端：opfs（localhost 静态服务；浏览器预览端真实后端）
   运行：node _verify/perf/run-perf.js
   注意：本脚本只读取 src/，不修改任何业务文件；lib 使用 _verify/perf/lib/ 固定副本。 */
'use strict';
const {chromium} = require('playwright');
const fs = require('fs');
const path = require('path');
const http = require('http');

const EXE = '/opt/vm/preinstall/ms-playwright/chromium_headless_shell-1169/chrome-linux/headless_shell';
const ROOT = path.resolve(__dirname, '..', '..');           // worktree 根
const PERF = __dirname;
const MIME = {'.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8',
              '.css':'text/css; charset=utf-8', '.json':'application/json'};

/* ---------- 本地静态服务（localhost = 安全上下文，OPFS 可用） ---------- */
const server = http.createServer((req,res)=>{
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  fs.readFile(f,(e,d)=>{
    if(e){ res.statusCode=404; res.end('nf'); return; }
    res.setHeader('Content-Type', MIME[path.extname(f)]||'application/octet-stream');
    res.end(d);
  });
});
const listen = ()=>new Promise(r=>server.listen(0,'127.0.0.1',()=>r(server.address().port)));

/* ---------- 固定 lib 副本（避免并行开发改 src 影响测量） ---------- */
const libFiles = [
  ['vault-fs.js',  fs.readFileSync(path.join(PERF,'lib','vault-fs.js'),'utf8')],
  ['markdown.js',  fs.readFileSync(path.join(PERF,'lib','markdown.js'),'utf8')],
  ['vault.js',     fs.readFileSync(path.join(PERF,'lib','vault.js'),'utf8')],
];

/* 注入 lib 到页面（<script> 文本注入，与 build 拼接等价） */
async function injectLibs(page){
  await page.evaluate((files)=>{
    for(const [,src] of files){
      const s=document.createElement('script'); s.textContent=src; document.head.appendChild(s);
    }
  }, libFiles);
}

/* ============================================================
   探针 1：生成 1000 篇 vault（opfs）
   ============================================================ */
const FOLDERS = [
  '工作','工作/周报','工作/项目A','工作/项目A/前端','工作/项目A/后端','工作/项目B',
  '生活','生活/读书','生活/读书/小说','生活/读书笔记','生活/健身',
  '学习','学习/英语','学习/课程',
  '想法','想法/灵感','财务','健康','旅行','收藏'
];
const COLORS = ['yellow','green','blue','pink','purple','cream'];
const SENT = ['今天的事情很多，先把最重要的三件写下来。','把想法先记下来，以后再慢慢整理。',
  '会议纪要要趁早写，细节会随时间模糊。','读了一段很有意思的文字，摘录在这里。',
  '周末计划：早起、跑步、写一页笔记。','工具的意义是减少摩擦，让人专注在内容本身。',
  '待办拆小一点，完成感会推着人往前走。','颜色用来区分心情，也用来区分优先级。',
  '复盘比计划更重要，记得每周回顾一次。','把高频动作藏在拇指热区里，界面才不会累人。'];

async function seedProbe(page, force){
  return page.evaluate(async ({files, folders, colors, sent, total, backend})=>{
    for(const [,src] of files){ const s=document.createElement('script'); s.textContent=src; document.head.appendChild(s); }
    const V = window.VaultFS;
    await V.init(backend);
    const t0 = performance.now();
    /* 建 ~20 个文件夹（含 2~3 层嵌套） */
    for(const f of folders) await V.mkdir(f);
    const notes = [];
    const rand = (n)=>Math.floor(Math.random()*n);
    const now = Date.now();
    for(let i=0;i<total;i++){
      const folder = folders[i % folders.length];
      const name = '笔记'+i+'.md';
      const p = folder ? folder+'/'+name : name;
      const isTodo = i%3===0;
      const color = colors[i%colors.length];
      const pinned = i%20===0;  /* 5% 置顶 */
      const tags = i%2===0 ? ['工作','灵感'] : ['生活'];
      /* 正文：标题/段落/列表/待办/标签/高亮，长度随机 */
      const paras = 3 + rand(8);
      let body = '## 第 '+i+' 篇：随手记\n\n';
      for(let k=0;k<paras;k++){
        body += sent[rand(sent.length)] + (k%4===0?' **重点** ':k%4===1?' ==划重点== ':k%4===2?' #'+(i%2?'项目':'日常')+' ':'. ') + '\n\n';
      }
      body += '### 清单\n\n';
      for(let k=0;k<3+rand(5);k++) body += (isTodo?'- [ ':'- ') + '事项 '+(k+1)+(k<2&&isTodo?' x':'')+'\n';
      body += '\n';
      if(i%3===0) body += '\n\n![[attachments/笔记'+i+'/img'+i+'.jpg]]\n';   /* 与 writeAttachment 落盘路径一致 */
      const fm = '---\nid: n-'+i+'\ntype: '+(isTodo?'todo':'note')+'\ncolor: '+color+'\n'
        + (pinned?'pinned: true\n':'') + 'tags: ['+tags.join(', ')+']\n'
        + 'created: '+new Date(now-864e5*rand(30)).toISOString()+'\n'
        + 'updated: '+new Date(now-36e5*rand(48)).toISOString()+'\n---\n';
      const md = fm+body;
      await V.write(p, md);
      notes.push({path:p, title:'第 '+i+' 篇：随手记', summary: body.slice(0,80).replace(/\n/g,' '),
        tags, updated: now-36e5*rand(48), color, pinned});
    }
    /* 30% 带小二进制附件（data 小 blob） */
    let attCount = 0;
    for(let i=0;i<notes.length;i+=3){
      const n = notes[i];
      const bytes = new Uint8Array(64+rand(256));   /* 64~320 字节小二进制 */
      await V.writeAttachment('img'+i+'.jpg', new Blob([bytes], {type:'image/jpeg'}), n.path);
      attCount++;
    }
    return {seedMs: performance.now()-t0, noteCount: notes.length, folders: folders.length, attCount, notes};
  }, {files: libFiles, folders: FOLDERS, colors: COLORS, sent: SENT, total: Number(process.env.PERF_TOTAL||1000), backend: process.env.PERF_BACKEND||'opfs'});
}

/* ============================================================
   探针 2：冷启动索引（每次 reload 后调用）
   ============================================================ */
async function coldProbe(page, forceIdb){
  return page.evaluate(async ({files, forceIdb})=>{
    const injectT0 = performance.now();
    for(const [,src] of files){ const s=document.createElement('script'); s.textContent=src; document.head.appendChild(s); }
    const injectMs = performance.now()-injectT0;
    const V = window.VaultFS;
    if(forceIdb){ await V.init('idb'); V.init = async ()=>'idb'; }  /* 强制 idb：Vault.init() 内的 auto-init 变 no-op */
    /* 埋点：统计 list/read 次数与耗时（门面层） */
    const st = {listCalls:0, listMs:0, readCalls:0, readMs:0};
    const oList = V.list.bind(V), oRead = V.read.bind(V);
    V.list = async (p)=>{ const s=performance.now(); const r=await oList(p); st.listCalls++; st.listMs+=performance.now()-s; return r; };
    V.read = async (p)=>{ const s=performance.now(); const r=await oRead(p); st.readCalls++; st.readMs+=performance.now()-s; return r; };
    const t0 = performance.now();
    await window.Vault.init();
    const initMs = performance.now()-t0;
    const stats = await window.Vault.stats();
    const mem = performance.memory ? {used: performance.memory.usedJSHeapSize, total: performance.memory.totalJSHeapSize} : null;
    return {backend: V.backend(), injectMs, initMs, st, stats, mem};
  }, {files: libFiles, forceIdb});
}

/* ============================================================
   探针 3：单文件保存落盘（Vault.save 防抖后的实际写盘）
   ============================================================ */
async function saveProbe(page, notePaths, rounds){
  return page.evaluate(async ({paths, rounds})=>{
    const V = window.VaultFS;
    const times = [];
    const oWrite = V.write.bind(V);
    V.write = async (p,t)=>{ const s=performance.now(); const r=await oWrite(p,t); times.push(performance.now()-s); return r; };
    for(let r=0;r<rounds;r++){
      await Promise.all(paths.map(async (p)=>{
        let md=''; try{ md = await V.read(p); }catch(e){ md='x'; }
        await window.Vault.save(p, md + '\n<!-- edit round '+r+' -->\n');
      }));
    }
    return times;
  }, {paths: notePaths, rounds});
}

/* ============================================================
   探针 4：1000 卡片网格滚动帧率（rAF 采样 ~5s）
   ============================================================ */
async function scrollProbe(page, notes){
  return page.evaluate(async (notes)=>{
    const PIN_SVG = '<svg class="pin" viewBox="0 0 24 24" fill="currentColor"><path d="M9 3h6l1 7 3 3H7l3-3z"/><path d="M12 13v8"/></svg>';
    const SEL_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
    const esc = s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
    const cards = notes.map(n=>{
      const d = new Date(n.updated); const foot = (d.getMonth()+1)+'月'+d.getDate()+'日';
      return '<div class="v16-note-card c-'+n.color+'" data-path="'+esc(n.path)+'">'
        + (n.pinned?PIN_SVG:'')
        + '<div class="nt">'+(n.pinned?PIN_SVG:'')+esc(n.title)+'</div>'
        + '<div class="ns">'+esc(n.summary)+'</div>'
        + '<div class="nfoot">'
        + (n.tags||[]).slice(0,2).map(t=>'<span class="ntag">#'+esc(t)+'</span>').join('')
        + '<span class="dot">'+foot+'</span></div>'
        + '<span class="selmark">'+SEL_SVG+'</span></div>';
    }).join('');
    document.getElementById('gridMount').innerHTML = cards;
    const scroller = document.getElementById('scroller');
    await new Promise(r=>requestAnimationFrame(r));
    const mem0 = performance.memory ? {used: performance.memory.usedJSHeapSize, total: performance.memory.totalJSHeapSize} : null;
    const total = scroller.scrollHeight;
    /* 程序化快速滚动 + rAF 采样 */
    const deltas = [];
    const DURATION = 5000, STEP = 90;
    const med = await new Promise(resolve=>{
      let start=0, last=0;
      function tick(now){
        if(!start){ start=now; last=now; }
        deltas.push(now-last); last=now;
        scroller.scrollTop = Math.min(total-792, scroller.scrollTop + STEP);
        if(now-start < DURATION) requestAnimationFrame(tick);
        else resolve({frames: deltas.length, scrollEnd: scroller.scrollTop});
      }
      requestAnimationFrame(tick);
    });
    const mem1 = performance.memory ? {used: performance.memory.usedJSHeapSize, total: performance.memory.totalJSHeapSize} : null;
    deltas.shift();   // 首帧自举值剔除
    const sum = deltas.reduce((a,b)=>a+b,0);
    const avgFrame = sum/deltas.length;
    const long = deltas.filter(t=>t>16.7);
    const long20 = deltas.filter(t=>t>20);          /* 明显长帧 */
    const dropped = deltas.filter(t=>t>=33.4);      /* 丢一整帧（≥2 个显示周期） */
    return {frames: med.frames, scrollHeight: total, scrollEnd: med.scrollEnd,
      avgFps: 1000/avgFrame, avgFrameMs: avgFrame, longCount: long.length, longRatio: long.length/deltas.length,
      long20Ratio: long20.length/deltas.length, droppedRatio: dropped.length/deltas.length,
      maxFrame: Math.max(...deltas), p95Frame: deltas.sort((a,b)=>a-b)[Math.floor(deltas.length*0.95)],
      mem0, mem1};
  }, notes);
}

/* ---------- 统计工具 ---------- */
const statsOf = (arr)=>{
  if(!arr.length) return null;
  const s = arr.slice().sort((a,b)=>a-b);
  const n = s.length;
  return {n, median: s[Math.floor(n/2)], p95: s[Math.floor(n*0.95)], min: s[0], max: s[n-1], mean: arr.reduce((a,b)=>a+b,0)/n};
};

(async ()=>{
  const port = await listen();
  const browser = await chromium.launch({headless:true, executablePath: EXE,
    args:['--enable-precise-memory-info','--js-flags=--max-old-space-size=512']});
  const ctx = await browser.newContext({
    viewport:{width:360, height:792}, isMobile:true, hasTouch:true,
    reducedMotion:'no-preference', deviceScaleFactor:4,
  });
  const page = await ctx.newPage();
  let pageerrors = 0;
  page.on('pageerror', e=>{ pageerrors++; console.log('[pageerror]', e.message); });

  const result = {backend:null, seed:null, cold:[], save:null, scroll:null, pageerrors:0, noteMetaFile:null};

  /* ---- 阶段 1：生成 1000 篇 vault ---- */
  console.log('== 阶段1：生成 1000 篇 vault（opfs） ==');
  await page.goto('http://127.0.0.1:'+port+'/_verify/perf/vault-perf.html');
  const seed = await seedProbe(page, 'opfs');
  result.backend = 'opfs';
  result.seed = {seedMs: Math.round(seed.seedMs), noteCount: seed.noteCount, folders: seed.folders, attCount: seed.attCount};
  fs.writeFileSync(path.join(PERF,'gen-notes.json'), JSON.stringify(seed.notes));
  console.log('种子写入耗时', result.seed.seedMs+'ms', '| 笔记', seed.noteCount, '| 文件夹', seed.folders, '| 附件', seed.attCount);

  /* ---- 阶段 2：冷启动索引 ×10 ---- */
  console.log('== 阶段2：冷启动索引（每次 reload） ==');
  const COLD_N = Number(process.env.PERF_COLD||10);
  for(let i=0;i<COLD_N;i++){
    await page.reload({waitUntil:'load'});
    const c = await coldProbe(page, process.env.PERF_BACKEND==='idb');
    result.cold.push(c);
    console.log(`#${i+1} [${c.backend}] init=${c.initMs.toFixed(1)}ms (inject=${c.injectMs.toFixed(1)}ms) list:${c.st.listCalls}次/${c.st.listMs.toFixed(0)}ms read:${c.st.readCalls}次/${c.st.readMs.toFixed(0)}ms notes=${c.stats.notes} folders=${c.stats.folders}`);
  }
  const coldArr = result.cold.map(c=>c.initMs);
  const coldStat = statsOf(coldArr);
  const listCalls = result.cold[result.cold.length-1].st.listCalls;
  const readCalls = result.cold[result.cold.length-1].st.readCalls;

  /* ---- 阶段 2.5：正确性断言（跳过 attachments 后的索引正确性） ---- */
  const correct = await page.evaluate(async ()=>{
    const out={};
    out.stats = await window.Vault.stats();
    const root = await window.Vault.entries('');
    out.rootFolders = root.folders.length;
    out.rootNotes = root.notes.length;
    out.searchHits = (await window.Vault.search('随手记')).length;
    const tree = window.Vault.tree();
    out.treeRootChildren = tree.children.length;
    out.treeHasAttachments = JSON.stringify(tree).includes('attachments');
    const att = await window.Vault.attachments('工作/笔记0.md');
    out.attNote0Count = att.length;
    out.attNote0Kind = att[0] && att[0].kind;
    out.attNote0Url = !!(att[0] && att[0].url);
    out.trash = (await window.Vault.trashList()).length;
    return out;
  });
  result.correct = correct;
  console.log('正确性断言:', JSON.stringify(correct));

  /* ---- 阶段 3：单文件保存落盘 ×50 ---- */
  console.log('== 阶段3：单文件保存落盘（5 轮 × 10 篇并发 = 50 次） ==');
  const paths = seed.notes.filter((_,i)=>i%100===0).map(n=>n.path).slice(0,10);
  const saveTimes = await saveProbe(page, paths, Number(process.env.PERF_SAVEROUNDS||5));
  result.save = statsOf(saveTimes);
  console.log('写盘耗时:', JSON.stringify(result.save));

  /* ---- 阶段 4：滚动帧率 + 内存 ---- */
  console.log('== 阶段4：1000 卡片网格滚动帧率 ==');
  const memBeforeScroll = await page.evaluate(()=>performance.memory ? {used: performance.memory.usedJSHeapSize, total: performance.memory.totalJSHeapSize} : null);
  result.scroll = await scrollProbe(page, seed.notes);
  result.scroll.memBefore = memBeforeScroll;
  console.log('滚动结果:', JSON.stringify({frames:result.scroll.frames, avgFps:result.scroll.avgFps.toFixed(1),
    avgFrameMs:result.scroll.avgFrameMs.toFixed(2), longRatio:(result.scroll.longRatio*100).toFixed(1)+'%',
    long20Ratio:(result.scroll.long20Ratio*100).toFixed(2)+'%', droppedRatio:(result.scroll.droppedRatio*100).toFixed(2)+'%',
    maxFrame:result.scroll.maxFrame.toFixed(1), p95:result.scroll.p95Frame.toFixed(1)}));

  /* ---- 汇总 ---- */
  result.pageerrors = pageerrors;
  result.coldStat = coldStat;
  result.coldListRead = {listCalls, readCalls};
  result.conclusion = {
    coldPass: coldStat.median <= 2000,
    savePass: result.save.median <= 100,
    scrollPass: result.scroll.avgFps >= 55 && result.scroll.droppedRatio < 0.02,
    pageerrorPass: pageerrors === 0,
  };
  fs.writeFileSync(path.join(PERF,'results.json'), JSON.stringify(result, null, 2));
  await page.screenshot({path: path.join(PERF,'scroll-shot.png')});
  await browser.close(); server.close();

  console.log('\n========== 汇总 ==========');
  console.log('冷启动索引: n='+coldStat.n+' 中位数='+coldStat.median.toFixed(1)+'ms P95='+coldStat.p95.toFixed(1)+'ms (门禁 ≤2s →', result.conclusion.coldPass?'PASS':'FAIL', ')');
  console.log('写盘耗时:   中位数='+result.save.median.toFixed(1)+'ms P95='+result.save.p95.toFixed(1)+'ms (目标 ≤100ms →', result.conclusion.savePass?'PASS':'FAIL', ')');
  console.log('滚动帧率:   平均='+result.scroll.avgFps.toFixed(1)+'fps 长帧>16.7ms占比='+(result.scroll.longRatio*100).toFixed(1)+'% (>20ms='+(result.scroll.long20Ratio*100).toFixed(2)+'% 丢帧='+(result.scroll.droppedRatio*100).toFixed(2)+'%) →', result.conclusion.scrollPass?'PASS':'FAIL');
  console.log('pageerror:  '+pageerrors+' (目标 0 →', result.conclusion.pageerrorPass?'PASS':'FAIL', ')');
  console.log('内存:       滚动前='+JSON.stringify(result.scroll.memBefore)+' 滚动后='+JSON.stringify(result.scroll.mem1));
})().catch(e=>{ console.error('FATAL', e); process.exit(1); });
