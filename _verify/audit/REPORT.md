# 纸片 v16.0.0-rc 独立验收审计报告

- 审计对象：worktree `.worktrees/md-vault`（分支 `feat/md-vault`，HEAD `c9bc349`，自述 M5/rc）
- 审计物：`dist/index.html` / 根 `index.html`（594284 字节，由 `scripts/build.js` 拼接 src 而成）
- 审计方式：Playwright（headless shell，360×792 dpr4，isMobile/hasTouch，reducedMotion:no-preference）+ 代码走读；OPFS 后端（`VaultFS.backend() === 'opfs'`）
- 审计日期：2026-10-21
- 审计人：独立验收审计员（未参与开发）

## 总评

**当前 rc 远未达到"原有功能全部保留"的发布门槛。** v16 新 UI（`#v16root`，z-index:60）是一个覆盖层，把旧 v15 的全部屏（AI 对话/百度网盘/API 配置/运行日志/本页问答）盖在下面且没有任何入口。数据层（VaultFS/Vault/MD）基础可用，但 UI 层存在多处**数据损坏级缺陷**（待办勾选回写破坏 `#p/high` 标签与勾选状态、WYSIWYG 加粗位置错乱），以及**大量"占位 stub"**（设置里 14 行有 11 行点了只 toast"后续里程碑接入"）。左缘跟手返回手势在 v16 屏上**完全失效**，这是此前多轮硬啃过的回归。

---

## 一、逐项功能审计表

| # | 功能项 | 结论 | 证据 / 复现 |
|---|---|---|---|
| 1 | 新建笔记（FAB 长按） | **PASS** | 长按 FAB>520ms 菜单展开，点"新建笔记"→ 编辑器打开 `工作/未命名.md`，落盘含 frontmatter（id/created/updated/type） |
| 1 | 标题输入联动文件名 | **PASS** | `#v16EdTitle` 输入"审计测试笔记AAA"，600ms 防抖后 Vault.rename 执行，`VaultFS.read('工作/审计测试笔记AAA.md')` 成功 |
| 1 | 两类笔记（note/todo） | **PASS**（数据层） | seed 有 type:todo 与 type:note；新建默认 note |
| 1 | 颜色（卡片色）读取 | **PASS**（只读） | 卡片 class `c-${color}` 正确渲染 |
| 1 | **颜色设置** | **MISSING** | 编辑器"更多"sheet 只有 移动/删除/置顶；批量条"颜色"按钮 toast"批量颜色·单篇可在编辑器里设置"——但编辑器里根本没有颜色入口。`grep` 全 vault-ui.js 无 setColor 调用 |
| 1 | 置顶（frontmatter pinned:true） | **PASS** | 编辑器更多→置顶后，`VaultFS.read` 含 `pinned: true` |
| 1 | 删除进回收站 | **PASS** | 卡片从首页消失，回收站列表出现条目（含原路径） |
| 1 | 回收站恢复 | **PARTIAL** | 数据层恢复成功（`.trash/工作/x.md` 回到 `工作/x.md`），但 `#v16TrashBack` 只 `show('home')` 不 `renderHome()`，**返回首页列表是 stale 的**，需手动重渲染才见卡片（已实测：恢复后立刻返回 false，手动 `VUI.renderHome()` 后 true） |
| 1 | 回收站彻底删除 | **PASS** | 点"彻底删除"后条目消失 |
| 1 | **回收站清空** | **MISSING**（stub） | `#v16TrashEmpty` onclick 仅 `toast('清空回收站 · 后续接入')`；而 `Vault.emptyTrash()` 已实现却没接 |
| 1 | 时间戳 | **PASS** | frontmatter created/updated 写入；卡片底部 `M月D日` |
| 2 | 加粗/斜体/下划线/删除线 | **PARTIAL（有数据损坏）** | dock 按钮齐全，execCommand 执行；但 htmlToMD 序列化把 `**` 放到错误位置（实测：选 PLAINTEXT123 加粗，落盘变成 `…高亮关键词==**，…PLAI**NTEXT123`，开头 `**` 错位且无配对）；`<i>` 经 insertHTML 后未落盘；段落间空行被吞。断言见 `a02b_rich_debug.js` |
| 2 | 高亮 ==x== | **PARTIAL** | 工具栏高亮按钮写 `hiliteColor`，依赖 styleWithCSS；序列化对 `<span style="background">` 有分支，但实测与既有 `**` 混排时位置错乱 |
| 2 | 列表 / 引用 / 代码块 | **PARTIAL** | dock 按钮存在；实测列表识别 true，引用与代码块断言 false（formatBlock 在 contenteditable 里产生的 DOM 与 htmlToMD 分支不匹配） |
| 2 | 分割线 | **MISSING** | dock 工具栏无分割线按钮（head/bold/italic/hl/underline/strike/list/todo/quote/code/link/image 共 12 个，无 hr） |
| 2 | 字号/字体内联显示 | **MISSING** | v16 编辑器无字号调节、无字体选择工具栏；设置里"字号刻度尺"是 stub |
| 2 | 待办勾选回写 | **MISSING（数据损坏）** | WYSIWYG 下 5 个 checkbox 初始全部 unchecked（seed 明明有 2 个 `- [x]`）；点击 checkbox 只切视觉不调 `Vault.toggleTodo`，不落盘；一旦因输入触发序列化，把 seed 里 `- [x] 牛奶、鸡蛋 #p/high` 序列化成 `- [ ]  牛奶、鸡蛋`——**勾选状态丢失 + `#p/high`/`#p/low` 优先级标签被吞**（实测见 a04_final_verify.js） |
| 2 | 源码模式 | **PASS** | 点 `#v16EdSource` 切出 textarea，内容是原始 md（frontmatter+body）；长等待（1.6s）后编辑内容落盘成功（AUDIT_LONG_WAIT_MARKER 已写入） |
| 3 | 笔记本→文件夹迁移 | **N/A（未触发）** | 设置"迁移旧库"在浏览器无旧 library.json，toast"未检测到旧库"；Migrate 模块存在但未在浏览器演练 |
| 3 | 新建文件夹 | **PASS** | FAB 菜单/抽屉"新建文件夹"均可建，文件树刷新 |
| 3 | 任意层级文件夹 | **PARTIAL** | 数据层支持（mkdir 递归），UI 只能在当前目录建一级；无 UI 建嵌套 |
| 3 | 文件树浏览/展开折叠 | **PASS** | 抽屉树可展开折叠，点行进入目录并关抽屉 |
| 3 | 移动笔记 | **PARTIAL** | 编辑器"移动到…"硬编码 3 个目标（工作/生活/根目录），不是文件夹选择器；实测移到根目录后 `VaultFS.read('产品灵感记录.md')` 成功 |
| 3 | **文件夹重命名** | **MISSING**（stub） | 长按文件夹→"重命名" toast"重命名 · v16 后续里程碑接入"（vault-ui.js:246） |
| 3 | **文件夹删除** | **MISSING**（stub） | 同上，toast"删除 · v16 后续里程碑接入" |
| 3 | **拖拽移动文件到文件夹** | **MISSING** | 全 vault-ui.js 无 dragstart/dragover/drop 绑定 |
| 4 | 图片附件落盘 | **PASS**（FS 层） | `VaultFS.writeAttachment` 返回 `attachments/本周采购清单/audit.png`，readBlob 可读 |
| 4 | 图片插入 UI | **PARTIAL** | dock"图片"按钮触发 file chooser → writeAttachment → insertHTML；浏览器里未端到端跑通（file chooser stub） |
| 4 | 拍照附件 | **MISSING** | v16 dock 无 camera/拍照入口 |
| 4 | PDF / 任意文件附件 | **MISSING** | 附件区只渲染 image 与 generic file 两类，但插入入口只有"图片"按钮，无"任意文件" |
| 4 | 大图查看器 | **PARTIAL（降级）** | `#v16ImgViewer` 全屏黑底 img，点遮罩/关闭按钮关闭；**无 pinch/双击缩放、无左右滑动分页**（CSS 仅 `max-width:94%;max-height:88%`）。相比 v15 #11 大图查看器是降级 |
| 4 | 附件打开/分享（系统 Intent） | **MISSING** | 无 openWith/share 调用；v16 无 Native.call 附件分享 |
| 4 | 移动笔记后附件引用 | **MISSING** | Vault.rename/move 注释明说"附件目录随迁 M4 完整实现；M2 仅处理 md"——移动后 attachments/<笔记名>/ 不会跟着走 |
| 5 | 搜索（标题） | **PASS** | 搜"采购"命中"本周采购清单" |
| 5 | 搜索（正文） | **PASS** | 搜"潜水艇"命中"读书笔记·《夜晚的潜水艇》" |
| 5 | 搜索（标签） | **PARTIAL** | Vault.search 代码含 tags 分支，但 seed 无标签；UI 搜索结果无标签 chip 过滤 |
| 5 | 网格/列表双视图 | **PASS** | 切 list → 容器 class `v16-list`；切 grid → `v16-grid` |
| 5 | **显示字体选择** | **MISSING**（stub） | 设置"显示字体"行 toast"v16 后续里程碑接入" |
| 5 | **字号刻度尺** | **MISSING**（stub） | 设置"字号刻度尺"行 toast"后续接入"；实测点击前后 `#v16root` fontSize 恒为 16px |
| 6 | 浅色/深色切换 | **PASS** | 点切换后 `documentElement.dataset.theme` 变 dark，`#v16root` 背景变 #18191C |
| 6 | **跟随系统主题** | **MISSING** | v16 仅 light/dark 二态切换，无 matchMedia('(prefers-color-scheme)') 监听，无"跟随系统"选项 |
| 6 | 圆形扩散揭示 | **PASS** | toggleTheme(true) 后生成 `.v16-reveal` 圆形遮罩从右上扩散（实测层数=1，双图层结构：circle 覆盖 + 120ms 后 applyTheme） |
| 7 | 百度网盘连接/上传/恢复 | **MISSING** | v16 UI 全文件无 `scr-pan`/`panBody`/百度网盘 任何引用；旧 `#scr-pan` 在 DOM 里但被 #v16root(z-index:60) 盖住，无入口可达 |
| 7 | SAF 绑定目录 / 同步到目录 / 从目录恢复 | **MISSING**（stub） | 设置"绑定外部文件夹（SAF）"行 toast"后续接入"；`VaultFS.bindFolder()` 在浏览器后端 reject"浏览器预览端不支持"，且无 UI 触发 |
| 7 | 导出资料库 zip | **MISSING**（stub） | 设置"导出资料库（zip）"行 toast"后续接入" |
| 7 | 统一导入（kbpkg/zip/json/jsonl） | **MISSING**（stub） | FAB 菜单"导入文件"与更多菜单"导入文件"均 toast"M4 接入"；旧 `#importUnified` input 在 DOM 里但 v16 不引用 |
| 7 | 完整备份包 / JSONL 切片 / 知识库 Markdown / JSON 导出 | **MISSING** | v16 UI 无任何导出入口 |
| 8 | AI 服务与模型配置 | **MISSING**（stub） | 设置"AI 服务与模型"行 toast"后续接入"；旧 `#scr-ai` 屏不可达 |
| 8 | AI 对话 | **MISSING** | v16 首页顶栏无 AI 按钮（实测 `v16HomeAi:false`）；旧 `#openChat` 在 DOM 里 getBoundingClientRect>0 但被 z-index:60 盖住，点不到 |
| 8 | 本页智能问答 | **MISSING** | v16 编辑器顶栏无 AI 按钮（实测 `v16EditorAiBtn:false`）；旧 `#editNoteAI` 被遮 |
| 8 | 知识库切片构建/更新 + RAG 搜索 | **MISSING** | v16 搜索屏只有一个文本输入，无"知识库/RAG" tab；旧 `#srSeg`(search/rag) 在旧屏里不可达 |
| 9 | 安装到主屏 | **MISSING** | v16 UI 无任何引用 |
| 9 | 运行日志 | **MISSING**（stub） | 设置"运行日志"行 toast"后续接入" |
| 9 | 关于页 | **MISSING**（stub） | 设置"关于"行只 toast"纸片 v16.0.0-rc"，无关于页（无版本号/开源许可/更新日志） |
| 9 | 纯本地隐私说明 | **PARTIAL** | 设置里一行静态文字"数据不出设备"，无可展开说明页 |
| 10 | #1 跟手返回/屏幕转场 | **MISSING（严重回归）** | 在 v16 编辑器屏从左缘 (5,400) 拖到 (300,400)：无 `.nav-dragging` 元素，屏仍停在 `editor`（实测两种 mouse/CDP touch 均不触发）。原因：旧 route.js `initEdgeBack` 只对 `navStack` 里的旧 `.screen` 生效，v16 的 `.v16-scr` 不在 navStack |
| 10 | #2 触点倾斜 | **MISSING** | 卡片无 `:active` transform 规则绑定；旧 t_m5_anim.js 只是 `classList.add('is-pressed')` 自测，无真实倾斜 |
| 10 | #3 chip 三连 | **PARTIAL** | 视图切换 chip 可切 on，但无"三连"动效 |
| 10 | #4 曲线飞行删除 | **MISSING** | 删除即卡片消失，无 FLIP/飞行动画 |
| 10 | #5 错峰勾选 | **MISSING** | 勾选无错峰动效（且勾选本身不落盘，见 #2 待办） |
| 10 | #6 边界阻尼（橡皮筋） | **MISSING** | `setupRubber` 只绑 `.screen-body/.paper-scroll/.nbp-scroll`，v16 滚动容器是 `.v16-ed-scroll/.v16-body`，没接 |
| 10 | #7 待办弹簧拖拽 | **MISSING** | 待办 li 无拖拽手柄/弹簧 |
| 10 | #8 勾选三连 | **MISSING** | 同 #5 |
| 10 | #9 字号刻度尺 | **MISSING** | stub，见上 |
| 10 | #10 笔记本内联联想 | **PARTIAL** | `.md-wiki` span 渲染存在，但点击跳转调 `Vault.search(target, 3)`——签名错误（search 只接受一个参数），实测走 catch toast"未找到" |
| 10 | #11 大图查看器 | **PARTIAL** | 见上，无缩放/分页 |
| 10 | #12 删除收拢 | **MISSING** | 无收拢动画 |
| 10 | #13 Press-to-Cancel | **PARTIAL** | FAB 长按菜单有，但无 Press-to-Cancel 手势闭环 |
| 10 | #14 主题圆形扩散 | **PASS** | 见上 |
| 10 | #15 手风琴 | **PARTIAL** | 设置分组点 head 切 `.open` class，无高度动画 |
| 10 | #16 进度条弹性收尾 | **PARTIAL** | 迁移进度条 `<i style="width:X%">`，无弹性收尾；且迁移未真跑过 |
| 12 | 左缘返回手势 | **MISSING（严重回归）** | 同 #1。起手点控件守卫/抬手控件判定/12px 防误触/150ms click 抑制这一整套是在 route.js 旧屏上写的，v16 屏完全没接入 |

---

## 二、汇总

**PASS：15 项**
新建笔记、标题联动重命名、置顶、删除进回收站、彻底删除、新建文件夹、文件树浏览展开折叠、面包屑、搜索（标题/正文）、网格/列表切换、浅色/深色切换、圆形扩散揭示、移动笔记（3 个硬编码目标）、源码模式切换+落盘、VaultFS 附件相对路径落盘。

**PARTIAL：11 项**
回收站恢复（数据通但列表不刷新）、移动到…（硬编码目标非选择器）、批量置顶/删除（批量颜色/移动 stub）、WYSIWYG 富文本（按钮在但序列化损坏）、附件（FS 层通但 UI 入口少）、图片查看器（无缩放分页）、设置分组手风琴（无动画）、wiki 双链（渲染在但跳转签名错）、`hlsyn/wiki` 开关（只切 class 不落盘）、搜索标签（代码在但无 UI 过滤）、Press-to-Cancel/FAB 长按（半吊子）。

**MISSING（含严重）：30+ 项**，按严重度排序：

### 🔴 阻断发布（数据损坏/核心回归）
1. **待办勾选回写损坏数据**：WYSIWYG 下已勾状态丢失、`#p/high`/`#p/low` 优先级标签被吞。
2. **左缘跟手返回手势在 v16 完全失效**（此前多轮硬啃的 #1，用户已习惯）。
3. **WYSIWYG→MD 加粗/空行/italic 序列化错乱**，编辑后文档会被改写坏。
4. **颜色选择器完全没有**（v15 核心功能）。

### 🟠 大面积功能缺失（v16 UI 是个壳）
5. AI 全链路（对话/本页问答/模型配置/知识库 RAG）——v16 零入口。
6. 百度网盘连接/上传/恢复——零入口。
7. 导入导出全链路（统一导入/备份包/JSONL/知识库 MD/JSON/zip 导出）——全 stub。
8. SAF 绑定目录 / 切换资料库——stub。
9. 文件夹重命名/删除/拖拽移动——stub/缺失。
10. 回收站"清空"按钮 stub（但 Vault.emptyTrash 已写好）。
11. 运行日志 / 关于页 / 安装到主屏 / 隐私说明页——全部 stub 或缺页。
12. 显示字体选择 / 字号刻度尺 / 跟随系统主题——stub 或缺失。
13. 拍照附件 / PDF/任意文件 / 附件打开分享 / 移动后附件随迁——缺失。

### 🟡 动效迁移基本未做
14. 16 项动效里只有 #14 主题扩散真正做了；其余 15 项要么是 class toggle 占位，要么完全没接。v16 CSS 里 0 个 @keyframes（document.styleSheets 里的 15 个 keyframes 全是旧 v15 的，被 z-index 盖住用不上）。

---

## 三、pageerror

全程 **0 个 pageerror**。控制台仅 1 条 404（favicon/字体外链无关）。

---

## 四、审计脚本与产物路径

- 审计目录：`/home/user/Doubao/chats/38447785792052226/notes-app/.worktrees/md-vault/_verify/audit/`
- 脚本：
  - `a00_smoke.js`（启动冒烟 + v16root 结构 dump）
  - `a01_crud.js`（便签 CRUD / 置顶 / 回收站 / 文件夹新建 / 移动 / 重命名 stub）
  - `a02_rich_search_theme.js`（工具栏 / 搜索 / 视图 / 主题 / 设置逐项 toast 审计）
  - `a02b_rich_debug.js`（WYSIWYG bold/italic 序列化损坏实测）
  - `a03_edge_todo_source.js`（待办勾选 / 源码模式 / 左缘手势 / 附件 FS）
  - `a04_final_verify.js`（待办回写数据损坏复现 / 源码长等待 / 字号刻度尺无效 / keyframes 统计）
- 截图：`_verify/audit/shots/{a00_home,a01_fabmenu,a01_trash,a01_drawer,a02_dark,a02_settings}.png`
- 本报告：`_verify/audit/REPORT.md`

---

## 五、发布建议

**不建议按现状发 v16.0.0。** 当前 rc 状态与"原有功能全部保留"的硬约束差距很大：
- 必须先修 4 个阻断项（待办数据损坏、左缘手势回归、WYSIWYG 序列化、颜色选择器）；
- 再把 AI / 网盘 / 导入导出 / SAF / 文件夹重命名删除这 6 大块要么接回 v16 入口（复用旧模块）、要么明确告诉用户本期砍掉；
- 16 项动效要么逐项真迁移、要么在 release notes 里诚实标注"动效在 v16 精简"，不能以"已迁移"交付。
