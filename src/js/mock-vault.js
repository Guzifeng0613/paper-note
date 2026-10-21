/* ============================================================
   mock-vault.js —— 纸片 v16 MockVault（M1 高保真走查用）
   全局名 MockVault。实现 docs/VAULT-INTERFACE.md 第2节 Vault 全部方法。
   数据驻留内存，所有 async 方法带 30~80ms 模拟延时。
   M2 将被真实 vault.js 替换，方法签名与返回结构不得变更。
   ============================================================ */
(function(){
'use strict';

/* ---------- 内联 SVG 占位图（离线可用，不外链） ---------- */
function imgURI(label, c1, c2){
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='480' height='360'><rect width='480' height='360' fill='${c1}'/><circle cx='392' cy='64' r='42' fill='${c2}' opacity='.85'/><path d='M0 270 L130 160 L240 240 L340 170 L480 260 V360 H0 Z' fill='${c2}' opacity='.45'/><text x='22' y='330' font-size='26' fill='${c2}' font-family='sans-serif'>${label}</text></svg>`;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}
const IMG_WHITE = imgURI('白板照片', '#E8E2D2', '#B9A97E');
const IMG_MOVE  = imgURI('打包现场', '#E4E0D4', '#9CA88C');
const IMG_ROOM  = imgURI('房间草稿', '#E6E1D0', '#C0A98A');
const IMG_PDF   = 'data:application/pdf;base64,'; /* 占位：VUI 用文件图标渲染 */

/* ---------- 时间基准（2026-10，截图稳定） ---------- */
const T = (s)=>new Date(s).getTime();
const BASE = T('2026-10-18T09:00:00+08:00');

/* ---------- 原始 md 正文 ---------- */
const BODY = {
  '灵感速记.md': `---
id: 0a1b2c3d
created: 2026-10-20T08:30:00+08:00
updated: 2026-10-20T21:10:00+08:00
color: cream
tags: [灵感]
type: note
---
## 关于资料库的想法

纸片的 v16 想做成 ==类 Obsidian== 的目录式笔记：**每张便签 = 一个 .md 文件**，
正文用 *Markdown*，文件能被 Obsidian 直接打开。

> 克制比炫技更重要。

相关：[[周会纪要]]`,

  '临时想法.md': `---
id: 0b2c3d4e
created: 2026-10-19T07:50:00+08:00
updated: 2026-10-20T07:50:00+08:00
tags: [想法]
type: note
---
- 纸感要保留：暖纸底、柔和阴影
- 深色模式也要克制
- 动效不能丢

#产品`,

  '工作/周会纪要.md': `---
id: 8f3a2b1c
created: 2026-10-18T09:00:00+08:00
updated: 2026-10-20T14:30:00+08:00
color: yellow
pinned: true
tags: [工作, 周会]
type: todo
---
## 本周对齐事项

- [x] 同步 v16 资料库改造进度 #p/high
- [x] 确认 Markdown 方言与 Obsidian 兼容 #p/high
- [ ] 评审新建文件的命名规则 #p/high
- [ ] 附件相对路径迁移方案 #p/low
- [ ] 下周三前给出 M2 验收清单

> 会后补充：原子写方案沿用 .tmp + rename。

相关：[[需求清单]] [[本周周报]]`,

  '工作/项目A/需求清单.md': `---
id: 1b2c3d4e
created: 2026-10-15T11:00:00+08:00
updated: 2026-10-19T10:12:00+08:00
tags: [工作, 项目A, 需求]
type: note
---
## 项目A 需求

1. 支持任意层级文件夹
2. 文件树展开 / 折叠
3. 拖拽文件到文件夹
4. 重名自动加序号

核心片段：

\`\`\`js
function atomicWrite(path, text){
  write(path + '.tmp', text);
  rename(path + '.tmp', path);
}
\`\`\`

要点 **不要** 破坏旧库，==迁移前先备份==。`,

  '生活/购物清单.md': `---
id: 2c3d4e5f
created: 2026-10-12T20:00:00+08:00
updated: 2026-10-20T08:20:00+08:00
color: green
tags: [生活, 采购]
type: todo
---
## 双十一采购

- [x] 咖啡豆两袋
- [x] 厨房纸巾
- [ ] 床头台灯（暖光）#p/low
- [ ] 无线鼠标
- [ ] 绿植一盆

*记得核对优惠券*`,

  '读书/读书笔记.md': `---
id: 3d4e5f6a
created: 2026-10-08T21:00:00+08:00
updated: 2026-10-19T22:40:00+08:00
tags: [读书, 产品]
type: note
---
## 《设计心理学》摘录

> 好的设计有两个重要特征：==可视性== 和 ==易通性==。

- 映射 *自然* 而 *直观*
-  affordance 暗示操作方式
- **反馈** 让用户确信操作生效

下划线的想法：<u>可供性不是属性，是关系</u>。删除线：~~过时的拟物~~。

标签 #设计 #交互`,

  '工作/本周周报.md': `---
id: 4e5f6a7b
created: 2026-10-19T18:00:00+08:00
updated: 2026-10-20T19:00:00+08:00
color: blue
tags: [工作, 周报]
type: note
---
## 本周完成

- 完成 M0 工程化拆分
- 新 UI 走查版搭建中

---

## 下周计划

推进 M2 原生桥联调，==预留两天== 给回归。`,

  '生活/搬家记录.md': `---
id: 5f6a7b8c
created: 2026-10-10T10:00:00+08:00
updated: 2026-10-17T16:00:00+08:00
tags: [生活, 搬家]
type: note
---
## 搬家手记

打包顺序：书籍 → 厨房 → 衣物。

![[打包现场.jpg]]

房间草稿留底：

![[房间草稿.png]]

白板方案见附件。`,

  '旅行/旅行清单.md': `---
id: 6a7b8c9d
created: 2026-10-01T15:00:00+08:00
updated: 2026-10-05T12:00:00+08:00
tags: [旅行, 云南]
type: note
---
## 云南行

- 身份证 / 充电宝
- 相机 + 备用电池
- 防晒 / 外套
- 预订民宿确认

*昆明 → 大理 → 丽江*`,

  '.trash/旧便签/会议草稿.md': `---
id: 7b8c9d0e
created: 2026-09-20T09:00:00+08:00
updated: 2026-09-22T09:00:00+08:00
tags: [草稿]
type: note
---
## 被淘汰的会议草稿

这篇已移入回收站，可恢复或彻底删除。`,

  '.trash/旧便签/随手记.md': `---
id: 8c9d0e1f
created: 2026-09-18T22:00:00+08:00
updated: 2026-09-19T09:00:00+08:00
type: note
---
## 随手记

回收站第二篇示例。`
};

/* ---------- 附件映射（相对路径 → 资源） ---------- */
const ATTACH = {
  '生活/搬家记录.md': [
    { name:'打包现场.jpg', kind:'image', url:IMG_MOVE },
    { name:'房间草稿.png', kind:'image', url:IMG_ROOM }
  ],
  '工作/周会纪要.md': [
    { name:'白板照片.jpg', kind:'image', url:IMG_WHITE }
  ]
};

/* ---------- 内部状态 ---------- */
let _files = {};          // path -> md全文
let _trashOrigin = {};    // trash内path -> 原path
const _delay = ()=> 30 + Math.floor(Math.random()*50);

function _mkdirsFromFiles(){ /* 目录由文件路径推导，无需额外维护 */ }

function _dirname(p){ const i = p.lastIndexOf('/'); return i<0 ? '' : p.slice(0,i); }
function _basename(p){ const i = p.lastIndexOf('/'); return i<0 ? p : p.slice(i+1); }
function _titleOf(p){ return _basename(p).replace(/\.md$/,''); }

/* 由 md 全文构造 Entry */
function _makeEntry(path){
  const md = _files[path];
  const { fm, body } = MD.parseFrontmatter(md);
  const name = _basename(path);
  const folder = _dirname(path);
  const title = _titleOf(path);
  const todos = MD.todoLines(md);
  return {
    path, name, folder, title,
    type: (fm && fm.type) || 'note',
    color: (fm && fm.color) || null,
    pinned: !!(fm && fm.pinned),
    tags: (fm && Array.isArray(fm.tags)) ? fm.tags : MD.extractTags(md),
    summary: MD.extractSummary(md),
    id: (fm && fm.id) || path,
    created: fm && fm.created ? T(fm.created) : BASE,
    updated: fm && fm.updated ? T(fm.updated) : BASE,
    mtime: fm && fm.updated ? T(fm.updated) : BASE,
    todoTotal: todos.length,
    todoDone: todos.filter(t=>t.done).length
  };
}

/* 收集所有非 trash 目录 */
function _allDirs(){
  const set = new Set();
  Object.keys(_files).forEach(p=>{
    if(p.startsWith('.trash/')) return;
    let d = _dirname(p);
    while(d){ set.add(d); d = _dirname(d); }
  });
  return Array.from(set);
}
function _subDirs(folder){
  return _allDirs().filter(d=>{
    if(folder==='') return _dirname(d)==='';
    return d.indexOf(folder+'/')===0 && _dirname(d)===folder;
  }).sort();
}
function _mdFilesUnder(folder){
  return Object.keys(_files).filter(p=>{
    if(p.startsWith('.trash/')) return false;
    return _dirname(p)===folder;
  });
}
/* 该文件夹下（含所有子目录）的笔记数，用于文件夹卡片"内含篇数" */
function _notesUnder(dir){
  return Object.keys(_files).filter(p=>{
    if(p.startsWith('.trash/')) return false;
    const d = _dirname(p);
    return dir==='' ? true : (d===dir || d.indexOf(dir+'/')===0);
  }).length;
}

const MockVault = {
  /* ---- 初始化 ---- */
  async init(){
    await new Promise(r=>setTimeout(r,_delay()));
    if(!Object.keys(_files).length){
      _files = Object.assign({}, BODY);
      Object.keys(BODY).forEach(p=>{
        if(p.startsWith('.trash/')){
          _trashOrigin[p] = p.replace('.trash/旧便签/','');
        }
      });
    }
    return true;
  },

  /* ---- 当前文件夹内容：文件夹置顶，其后 md（pinned 在前） ---- */
  entries(folderPath){
    folderPath = folderPath || '';
    const folders = _subDirs(folderPath).map(d=>({
      type:'folder', name:_basename(d)+'/', path:d,
      title:_basename(d), count:_notesUnder(d)
    }));
    const notes = _mdFilesUnder(folderPath).map(_makeEntry)
      .sort((a,b)=> (b.pinned-a.pinned) || (b.updated-a.updated));
    return { folders, notes };
  },

  /* ---- 全量嵌套树 ---- */
  tree(){
    const build = (dir)=>{
      const node = { name: dir==='' ? '资料库' : _basename(dir), path:dir, type:'folder', children:[], count:_notesUnder(dir) };
      _subDirs(dir).forEach(d=>node.children.push(build(d)));
      return node;
    };
    return build('');
  },

  /* ---- 读单篇 ---- */
  get(path){
    const md = _files[path];
    if(md==null) throw new Error('笔记不存在：'+path);
    const { fm } = MD.parseFrontmatter(md);
    const entry = _makeEntry(path);
    return Promise.resolve().then(()=>({ entry, md, frontmatter:fm, html:MD.toHTML(md) }));
  },

  /* ---- 搜索：标题/正文/标签 ---- */
  search(q){
    q = (q||'').trim().toLowerCase();
    if(!q) return Promise.resolve([]);
    const hits = Object.keys(_files).filter(p=>!p.startsWith('.trash/'))
      .map(_makeEntry)
      .filter(e=>{
        if(e.title.toLowerCase().includes(q)) return true;
        if(e.summary.toLowerCase().includes(q)) return true;
        if((e.tags||[]).some(t=>t.toLowerCase().includes(q))) return true;
        return false;
      });
    return Promise.resolve(hits);
  },

  /* ---- 新建 ---- */
  async create({ title, folder, type, content }){
    await new Promise(r=>setTimeout(r,_delay()));
    title = (title||'').trim() || '未命名';
    folder = folder || '';
    let name = title + '.md';
    let path = folder ? folder+'/'+name : name;
    let n = 2;
    while(_files[path]){ path = (folder?folder+'/':'') + title + ' '+n+'.md'; n++; }
    const fm = '---\nid: '+uid()+'\ncreated: '+new Date().toISOString()+'\nupdated: '+new Date().toISOString()+'\ntype: '+(type||'note')+'\n---\n';
    _files[path] = fm + (content||'');
    return path;
  },

  /* ---- 保存 ---- */
  async save(path, md){
    await new Promise(r=>setTimeout(r,_delay()));
    _files[path] = md;
    return path;
  },

  /* ---- 重命名（改标题=改文件名） ---- */
  async rename(path, title){
    await new Promise(r=>setTimeout(r,_delay()));
    const folder = _dirname(path);
    let name = (title||'未命名')+'.md';
    let np = folder?folder+'/'+name:name;
    let n=2; while(_files[np] && np!==path){ np = (folder?folder+'/':'') + (title||'未命名')+' '+n+'.md'; n++; }
    if(_files[path]!=null){ _files[np] = _files[path]; delete _files[path]; }
    return np;
  },

  /* ---- 移动 ---- */
  async move(path, dirPath){
    await new Promise(r=>setTimeout(r,_delay()));
    const name = _basename(path);
    const np = dirPath ? dirPath+'/'+name : name;
    if(_files[path]!=null){ _files[np] = _files[path]; delete _files[path]; }
    return np;
  },

  /* ---- 删除（进回收站） ---- */
  async remove(path){
    await new Promise(r=>setTimeout(r,_delay()));
    const trashPath = '.trash/旧便签/'+_basename(path);
    _trashOrigin[trashPath] = path;
    if(_files[path]!=null){ _files[trashPath] = _files[path]; delete _files[path]; }
    return trashPath;
  },

  /* ---- 回收站列表 ---- */
  trashList(){
    return Object.keys(_files).filter(p=>p.startsWith('.trash/'))
      .map(p=>({ entry:_makeEntry(p), originalPath:_trashOrigin[p]||_titleOf(p) }));
  },

  /* ---- 恢复 ---- */
  async restore(trashPath){
    await new Promise(r=>setTimeout(r,_delay()));
    const orig = _trashOrigin[trashPath] || _titleOf(trashPath);
    if(_files[trashPath]!=null){ _files[orig] = _files[trashPath]; delete _files[trashPath]; delete _trashOrigin[trashPath]; }
    return orig;
  },

  /* ---- 彻底删除 ---- */
  async deleteForever(trashPath){
    await new Promise(r=>setTimeout(r,_delay()));
    delete _files[trashPath]; delete _trashOrigin[trashPath];
    return true;
  },

  /* ---- 待办勾选回写 ---- */
  async toggleTodo(path, rowKey){
    await new Promise(r=>setTimeout(r,_delay()));
    const md = _files[path];
    const line = MD.todoLines(md).find(t=>t.key===rowKey);
    const newMd = MD.setTodoLine(md, rowKey, { done: !(line && line.done) });
    _files[path] = newMd;
    const nl = MD.todoLines(newMd).find(t=>t.key===rowKey);
    return nl ? { done: nl.done, key: rowKey } : null;
  },

  /* ---- 改色 ---- */
  async setColor(path, color){
    await new Promise(r=>setTimeout(r,_delay()));
    let md = _files[path];
    const { fm } = MD.parseFrontmatter(md);
    fm.color = color || undefined;
    const body = md.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/,'');
    _files[path] = MD.stringifyFrontmatter(cleanFm(fm)) + body;
    return path;
  },

  /* ---- 置顶 ---- */
  async setPin(path, pinned){
    await new Promise(r=>setTimeout(r,_delay()));
    let md = _files[path];
    const { fm } = MD.parseFrontmatter(md);
    fm.pinned = !!pinned;
    const body = md.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/,'');
    _files[path] = MD.stringifyFrontmatter(cleanFm(fm)) + body;
    return path;
  },

  /* ---- 面包屑 ---- */
  crumbs(path){
    const parts = [];
    if(!path || !path.includes('/')) return [{name:'资料库', path:''}];
    const dir = _dirname(path);
    let acc='';
    parts.push({name:'资料库', path:''});
    dir.split('/').forEach(seg=>{ acc = acc?acc+'/'+seg:seg; parts.push({name:seg, path:acc}); });
    return parts;
  },

  /* ---- 统计 ---- */
  stats(){
    const notes = Object.keys(_files).filter(p=>!p.startsWith('.trash/')).length;
    const folders = _allDirs().length;
    const attachments = Object.keys(ATTACH).length;
    const bytes = Object.keys(_files).reduce((s,p)=>s+_files[p].length,0);
    return Promise.resolve({ notes, folders, attachments, bytes });
  },

  /* ---- 取附件（M1 mock） ---- */
  attachments(path){ return ATTACH[path] || []; },
  attachmentUrl(path, name){
    const list = ATTACH[path]||[];
    const f = list.find(a=>a.name===name);
    return f ? f.url : null;
  }
};

function cleanFm(fm){
  const out = {};
  Object.keys(fm||{}).forEach(k=>{
    if(fm[k]==null || fm[k]==='' ) return;
    out[k]=fm[k];
  });
  return out;
}
window.MockVault = MockVault;
})();
