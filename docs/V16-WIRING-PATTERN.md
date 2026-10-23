# v16 功能接线规范（M5 rc，冻结模式）

> 目标：把 v15 成熟功能接回 v16 新 UI，**原有功能一项不能少**。禁止用 toast 占位、禁止改审计脚本、禁止只验元素存在。每项必须有真实行为（读写/落盘/可操作）并在真机尺寸（360×792）下验证。

## 已冻结并验证的四个模式（直接复用，勿重写）

### 1. 受控待办（已实现）
- 待办笔记正文用 `MD.todoLines(md)` 解析，`buildTodoUL(rows, todoDivs)` 构建嵌套 `ul`（checkbox 带 `data-key` 与 `checked`、`md-todo-text`、优先级徽章）。
- 勾选：一次性 `change` 委托 → `Vault.toggleTodo(path,key)` → 用新 md 重渲染；checkbox 的 input 不触发自由序列化。
- 已验证：初始勾选态、`#p/high`/`#p/low` 不丢、二次切换正常。

### 2. 旧屏桥接 openLegacy（已实现）
```js
openLegacy(name, returnScr)   // 不改 hash、不进 navStack，把旧 #scr-<name> 提升到 v16 之上（z-index:70）
closeLegacy()                 // 移除提升，回到 v16 屏（returnScr: home/settings/editor）
```
- 旧屏内 `id` 含 `Back` 的返回按钮已被捕获式拦截 → 回 v16。
- 旧屏在移动端隐藏的 `.desk-only` 返回键会自动显示。
- 已接线：设置 AI 配置→`openLegacy('ai','settings')`、日志→`openLegacy('log','settings')`、首页 AI 对话→`openLegacy('chat','home')`。

### 3. 本页问答 openVaultNoteAi（已实现）
- 从当前 vault 笔记合成 v15 风格笔记（id/title/content=渲染HTML/todos/files）注入 `notes`，设 `editingId`，调 `openNoteAi()`；关闭时移除合成笔记并还原 `editingId`。

### 4. 颜色选择器 openColorPicker（已实现）
- 7 色：`cream/yellow/orange/pink/green/blue/purple`；单篇（编辑器更多）与批量（选择栏）共用，调 `Vault.setColor(path,color)` 落盘。

## 待接线清单（按批次，复用 v15 模块，禁止 stub）

### 批次 A：文件/文件夹操作
- 笔记「移动到…」（编辑器更多）：打开文件夹选择面板（复用现有目录树/移动 UI），调 `Vault.move(path,dirPath)`；移动后附件随迁（相对路径保持）。
- 文件夹：重命名（`Vault.renameFolder`/`vaultRename`）、删除（`Vault.removeFolder`，含确认）。
- 长按卡片 sheet：移动/重命名/删除（文件夹）接到真实函数，移除 toast。
- 批量移动：选择栏「移动」→ 文件夹选择面板 → 逐个 `Vault.move`。

### 批次 B：附件（原生桥已就绪）
- 编辑器附件区：图片/拍照/PDF/任意文件
  - 拍照：`Native.call('vaultTakePhoto',{notePath:path})` → 插入 `![[相对路径]]`。
  - 选文件/导入：`Native.call('vaultPickImport',{dirPath})` → 图片插入引用、其他作为附件。
  - 已有附件展示：`Vault.attachments(path)`（图片缩略图、文件行）。
- 附件操作：打开 `Native.call('openWith',{path})`、分享 `Native.call('shareFile',{path})`。
- 大图查看器：`#v16ImgViewer` 补双指/双击缩放、多图左右分页（#11）。
- 移动笔记后附件引用仍有效（相对路径）。

### 批次 C：网盘 / 导入导出 / SAF
- 百度网盘：设置或首页加入口 → `openLegacy('pan', ...)`（连接/上传/恢复 UI 沿用）。
  - 上传前需把 vault 数据同步到旧 Store（见"库同步桥"）；恢复后把 Store 同步回 vault。
- 统一导入（FAB「导入文件」）：
  - 原生：旧备份（zip/JSON/JSONL）→ 导入 Store → 经 Migrate 转 vault；KB 包/Markdown 直接落 vault。
  - 复用 `unifiedImportEntry()` + Migrate，结果落 vault。
- 导出：
  - 资料库 zip：`VaultFS.exportZip()`（设置「导出资料库」）。
  - 备份包/JSONL/知识库 MD/JSON：先 vault→Store 同步，再复用 `exportData()`/`exportRAGJsonl()`/`exportRAGMarkdown()`。
- SAF：设置「绑定外部文件夹」→ `VaultFS.bindFolder()`；「同步到目录/从目录恢复」接现有 `syncFolder`/SAF 逻辑。

### 批次 D：显示与杂项
- 显示字体：设置行 → 复用 v15 字体选择（openLegacy 或直接），真实改 `--font-ui`/`font-family`。
- 字号刻度尺：设置行 → 复用 v16 刻度尺（theme.js），真实改缩放（CSS 变量/zoom），不再恒为 16px。
- 跟随系统主题：`matchMedia('(prefers-color-scheme: dark)')` 监听。
- 关于页：真实关于页（版本/简介/隐私链接），非 toast。
- 安装到主屏、纯本地隐私说明页：接现有页面/逻辑。

### 批次 E：16 项动效真实迁移
- 除 #14 圆形扩散外，逐项移植真行为（真实 keyframes/物理，非 class 占位）：
  #1 跟手返回（已做）、#2 触点倾斜、#3 chip 三连、#4 曲线飞行删除、#5 错峰勾选、#6 边界阻尼、#7 待办弹簧拖拽、#8 勾选三连、#9 字号刻度尺、#10 笔记本内联联想、#11 大图查看器、#12 删除收拢、#13 Press-to-Cancel、#15 手风琴、#16 进度条弹性收尾。
- 每项过 `reduce-motion` 降级；保留纸感克制风格。

## 库同步桥（库级功能需要，关键设计）
- `syncVaultToStore()`：读全部 vault 条目 → 转 v15 笔记（id=fm.id、title、content=MD 渲染 HTML、color、pinned、todos、files）→ 写入 Store 内存并落盘（供网盘上传/备份导出）。
- `syncStoreToVault()`：复用 Migrate 逻辑把 Store 笔记转成 vault markdown（供网盘恢复/导入后）。
- 网盘 push/备份导出前调前者；网盘 pull/merge、统一导入后调后者。

## 验收
- 每批次完成：`node scripts/build.js` → `node --check _verify/_inline_0.js` → 跑 `_verify/audit/a00–a04`（看输出 true/false，非仅 exit 0）→ 相关 node 测试（187 项）→ 0 pageerror。
- 真机尺寸截图核对。
