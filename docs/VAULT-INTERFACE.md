# 纸片 v16 模块接口约定（M1 起各 agent 共同遵守）

> 本文件是 UI / 文件系统 / Markdown 三条线的**接口契约**。M1 阶段 UI 基于本文件的 mock 实现开发；
> M2/M3 用真实实现替换 mock，**方法签名与返回结构不得变更**，需变更走主控评审。
> 路径一律为 vault 相对 POSIX 路径（`/` 分隔），根目录用 `''`（空串）表示。
> 文件名规则：`${标题}.md`；空标题 `未命名.md`；同目录重名 `标题 2.md`、`标题 3.md`。

---

## 1. VaultFS（低层，仅做文件/目录操作，不做业务索引）
位于 `src/js/vault-fs.js`，全局名 `VaultFS`；三后端：`native`（AndroidBridge）/ `opfs` / `idb`，由 `Store`/启动时决定。

| 方法 | 入参 | 返回 |
|---|---|---|
| `backend()` | — | `'native'\|'opfs'\|'idb'` |
| `root()` | — | `{type:'private'\|'saf'\|'opfs'\|'idb', path:string}` |
| `list(path)` | 目录相对路径 | `Array<{name, type:'file'\|'folder', size:number, mtime:number}>`（不含 `.`/`..`；`.trash` 仅在显式列回收站时返回） |
| `read(path)` | 文件相对路径 | `string`（UTF-8） |
| `write(path, text)` | — | 原子写（`.tmp`+`rename`）；返回 `path` |
| `mkdir(path)` | — | 递归创建；返回 `path` |
| `rename(path, newPath)` | — | 同/跨目录重命名移动；返回 `newPath` |
| `move(path, dirPath)` | 文件 + 目标文件夹 | 返回新路径 |
| `trash(path)` | — | 移入 `.trash/`（保留相对结构，重名加序号）；返回 trash 内路径 |
| `restore(trashPath)` | — | 还原到原相对路径（占位则加序号）；返回原路径 |
| `listTrash()` | — | 同 `list` 结构，附 `originalPath` |
| `delete(path)` | — | 物理删除，不可恢复 |
| `readBlob(path)` | — | `Blob` |
| `writeAttachment(name, blob, dirPath)` | 文件名、二进制、目标目录 | 落 `attachments/<笔记名>/`（dirPath 给定时从其推导），返回相对路径 |
| `importFile(uri, dirPath)` | 外部 content/file uri | 导入 vault，返回 `{path, name, size, type}` |
| `bindFolder()` | — | SAF 选目录，返回 `root()` 描述 |
| `exportZip(uri)` | 目标 uri | 整 vault 打包，返回 `{ok, bytes}` |

约定：所有方法失败时 `throw Error(中文可读信息)`；不静默吞错。

---

## 2. Vault（业务层：索引 / 搜索 / 树 / 写盘调度）
位于 `src/js/vault.js`，全局名 `Vault`。仅索引 `.md`（忽略 `.trash`、隐藏文件，附件不进笔记索引）。

**索引条目 Entry 结构：**
```js
{
  path: '工作/周会纪要.md',
  name: '周会纪要.md',
  folder: '工作',
  title: '周会纪要',
  type: 'note'|'todo',
  color: 'yellow'|null,
  pinned: boolean,
  tags: ['工作'],
  summary: '纯文本摘要（去标记，≤120 字）',
  id: 'frontmatter.id',
  created: number, updated: number, mtime: number,
  todoTotal: 0, todoDone: 0   // type=todo 时
}
```

| 方法 | 说明 | 返回 |
|---|---|---|
| `async init()` | 全量扫描建索引（1000 篇 ≤2s），后台增量 | — |
| `entries(folderPath)` | 当前文件夹内容，**文件夹置顶**其后 md；置顶 md 在前 | `{folders:Entry-like[], notes:Entry[]}` |
| `tree()` | 全量嵌套树（手风琴数据源） | `Node{name,path,type,children,count}` |
| `get(path)` | 读盘并解析 | `{entry, md, frontmatter, html}` |
| `search(q)` | 标题/正文/标签，命中高亮片段 | `Entry[]`（附 `matches`） |
| `async create({title, folder, type, content})` | 新建并落盘 | `path` |
| `async save(path, md)` | 单文件原子写（防抖 300~500ms），更新索引 | `path` |
| `async rename(path, title)` | 改标题=重命名文件，重名加序号 | `newPath` |
| `async move(path, dirPath)` | 移动；附件相对引用随 `attachments` 整体移动或重写 | `newPath` |
| `async remove(path)` / `async restore(path)` | 回收站 | trashPath / 原路径 |
| `async toggleTodo(path, rowKey)` | 回写对应行（只改该文件，防抖 300ms） | 新行状态 |
| `async setColor(path,color)` / `setPin(path,bool)` | 仅改 frontmatter | — |
| `crumbs(path)` | 面包屑 | `[{name,path}]` |
| `stats()` | `{notes, folders, attachments, bytes}` | — |

---

## 3. Markdown（引擎：解析 / 序列化 / frontmatter / HTML↔MD）
位于 `src/js/markdown.js`，全局名 `MD`。纸片方言 = Obsidian 兼容子集（见 PLAN 2.2）。

| 方法 | 说明 |
|---|---|
| `parseFrontmatter(text)` | → `{fm:Object, body:string}`；无 fm 时 `fm:null` |
| `stringifyFrontmatter(fm)` | → YAML 头部字符串（含首尾 `---`） |
| `parse(md)` | → `{fm, blocks:Array<Block>}`（块级 AST） |
| `toHTML(md)` | MD→HTML（含 `==高亮==`、`<u>`、`[[wiki]]`、`![]()`、`![[]]`、待办） |
| `htmlToMD(html)` | 编辑器 HTML→MD（富文本工具栏全元素可逆） |
| `serialize(blocks, fm)` | AST+fm→标准 md |
| `todoLines(md)` | 抽出待办行：`[{key, indent, done, priority, text, start, end}]` |
| `setTodoLine(md, key, patch)` | 回写单行 → 新 md |
| `extractTags(md)` / `extractSummary(md)` | 索引辅助 |
| `extractAttachRefs(md)` | → `[{alt, link, embed}]` |

**Block 形态（最小集）：**
`{type:'heading'|'para'|'ul'|'ol'|'todo'|'quote'|'code'|'hr'|'attach', level?, items?, text?, lang?, refs?}`

**语法映射（验收基准）：** 标题 `##`~`######`；加粗 `**`；斜体 `*`；高亮 `==`；下划线 `<u></u>`；
删除线 `~~`；行内码 `` ` ``；代码块 ` ``` `；引用 `>`；无序列表 `-`；有序 `1.`；分割线 `---`；
待办 `- [ ]`/`- [x]`，优先级 `#p/high`、`#p/low`；图片 `![](path)`/`![[path]]`；其他附件 `[名](path)`；
双链 `[[名]]`；标签 `#标签`。

---

## 4. 迁移（M4）
位于 `src/js/migrate.js`，全局名 `Migrate`：
- `detect()` → 旧库是否存在（native `loadMeta` / IDB `library`）。
- `async backup()` → 先导出完整备份 zip，失败中止。
- `async run({onProgress})` → 笔记本→文件夹、HTML→MD、待办→checkbox+优先级、附件→`attachments/<笔记名>/` 并重写引用、frontmatter 沿用旧 uid/时间戳/颜色/置顶/标签、回收站→`.trash`。
- `verify()` → `{files, attachments, parseRate, failures[], skipped[]}`（parseRate 必须 100%）。

---

## 5. 全局命名与构建约定
- 采用**顺序拼接的经典脚本**（非 ES module import/export），每个文件把对象挂到约定全局名（`VaultFS`/`Vault`/`MD`/`Migrate`），由 `scripts/build.js` 按固定顺序拼进单个 IIFE，保证单文件输出与零行为变化。
- 加载顺序：tokens/base/...css → 工具/Store → native-bridge → vault-fs → markdown → vault → migrate → home/editor/settings/animations → main。
- UI 层只通过 `Vault`/`MD` 接口取数，M1 由 `src/js/mock-vault.js`（全局 `MockVault`，实现第 2 节全部方法）提供数据，main 中 `const Vault = useMock ? MockVault : RealVault`。
