# v16 性能测量报告（1000 篇 vault）

## 【附】优化落地后复测（2026-10-21 二轮）

### 实现的优化（仅改 src/js/vault.js、src/js/vault-fs.js）

1. **vault.js scanDir 跳过保留目录**：根级 `attachments/` 不再递归 list、不再入 `_folders`（附件是存储区，单篇 get 时按 md 内 `![[...]]` 引用按需解析）；list 调用 356→21。
2. **vault.js 目录遍历并行化**：同层子目录 `Promise.all` 并发扫描、同层 .md 并发读，消除逐层串行 await 链。
3. **vault-fs.js idbBE 内存索引**：init 时游标一次性全量扫描建 `_idx: Map<key,{kind,size,mtime}>`；list 变为纯内存前缀过滤（O(子项) 输出），写/mkdir/delete/moveRaw/writeBlob 同步维护索引。
4. （跳过）索引只读文件头部：todoLines/extractTags 依赖全文，改 head 会破坏正确性，放弃。

### 优化前后冷启动对比（10 次取样，ms）

| 后端 | 优化前 中位数/P95 | 优化后 中位数/P95 | 结论 |
|---|---|---|---|
| OPFS | 1642 / 1732 | **780 / 880** | PASS（2.1×） |
| IDB | 3768 / 3899（FAIL） | **1320 / 1509** | PASS（2.9×，转绿） |

### 其余指标（优化后）

- 单文件保存落盘：OPFS 中位 10.4ms/P95 12.5ms；IDB 中位 6.2ms/P95 9.4ms（目标 ≤100ms，均 PASS）。
- 滚动：两后端均 60.0fps，>20ms 长帧 0%，丢帧 0%。
- pageerror：0。
- 内存：滚动前 used 29.5~37.8MB → 快滚后 GC 回收 5.1~5.7MB，无单调增长。

### 正确性断言（两后端均通过）

- 索引笔记数=1000、文件夹=20（根级 8 个，嵌套 12 个）；根目录笔记=0。
- 搜索 `随手记` 命中 1000；文件树不含 `attachments`。
- 单篇附件解析：`工作/笔记0.md` 内 `![[attachments/笔记0/img0.jpg]]` → 解析出 1 个 image 附件且 objectURL 生成成功。
- 回收站初始 0 条。

### 回归（既有套件全绿）

- `t_vault_fs.js` 52/52；`t_vault.js` 26/26；`t_vault_crud.js`（opfs+idb 双后端 CRUD）39/39、pageerror 0。

---

## 首轮基线（优化前，保留存档）

- 日期：2026-10-21 ｜ 环境：headless Chromium（真机尺寸 360×792 / dpr4 / isMobile / hasTouch / reducedMotion:'no-preference'）
- 被测代码：`_verify/perf/lib/` 固定副本（vault-fs.js / markdown.js / vault.js，与 src 冻结时刻一致）
- 主测后端：**opfs**（localhost 静态服务，浏览器预览端真实后端）；对照后端：**idb**（兜底路径）
- 脚本：`_verify/perf/run-perf.js`（`PERF_TOTAL/PERF_COLD/PERF_SAVEROUNDS/PERF_BACKEND` 可调）

## 一、1000 篇 vault 生成方式

- VaultFS(opfs) 写入：20 个文件夹（含 2~3 层嵌套，如 `工作/项目A/前端`），1000 个 `笔记N.md` 按轮询均布；
- 每篇含 frontmatter（id/type/color/pinned/tags/created/updated）+ 正文（标题/段落/列表/待办 `[ ]`/`==高亮==`/`**加粗**`/`#标签`），正文长度随机 0.3~3KB；
- 334 篇（33%）带 64~320 字节小二进制附件，落 `attachments/<笔记名>/`；
- 生成耗时：2.9s。笔记元数据存 `_verify/perf/gen-notes.json`。

## 二、测量结果（opfs 主测，门禁对照）

| 指标 | 中位数 | P95 | 门禁 | 结论 |
|---|---|---|---|---|
| 冷启动索引（reload 后 Vault.init，10 次） | **1642ms** | 1732ms | ≤2000ms | PASS（余量 18%） |
| 单文件保存落盘（VaultFS.write，50 次） | **8.8ms** | 15.8ms | ≤100ms | PASS |
| 列表滚动帧率（1000 卡片网格，5s 快滚） | **60.0fps** | —（p95 帧 16.7ms） | 60fps | PASS（>20ms 长帧 0%，丢帧 0%） |
| pageerror | **0** | — | 0 | PASS |

- 冷启动逐次（ms）：1524 / 1647 / 1642 / 1578 / 1648 / 1701 / 1732 / 1598 / 1434 / 1224（末两次为页缓存预热；真机首启对应 #1~#9 水平）。
- 内存（performance.memory）：滚动前 used 34.4MB / total 55.0MB → 快滚 5s 后 GC 回收 used 5.6MB / total 48.3MB；无单调增长、无泄漏迹象。
- 截图证据：`_verify/perf/scroll-shot.png`。

### 冷启动耗时分解（opfs，埋点埋在 VaultFS 门面层）

- `VaultFS.read`：1000 次 / ~1150ms（**约 70%**）——每篇都要 getFile+text 全文读入才能解析 frontmatter；
- `VaultFS.list`：**356 次** / ~426ms（**约 26%**）——其中 ~335 次在递归遍历 `attachments/` 数据目录（334 个附件文件夹 + 根），产出的目录最终全部混入 `_folders`（folders=355，其中 334 是附件目录）。

## 三、对照：idb 后端（兜底路径，3 次冷启动）

| 指标 | 中位数 | P95 | 结论 |
|---|---|---|---|
| 冷启动索引 | **3768ms** | 3899ms | **FAIL（超门禁 1.9 倍）** |
| 其中 list 部分 | 356 次 / 2713ms（占 72%） | | idbBE.list 每次全表 getAllKeys + 逐条 get |
| read 部分 | 1000 次 / 1006ms | | 与 opfs 相当 |
| 保存落盘 / 滚动 / pageerror | 7.5ms / 58fps（1 次 66.7ms GC 掉帧）/ 0 | | 其余达标 |

## 四、瓶颈定位与优化建议（未改业务代码，待主控评审）

1. **【收益最大】scanDir 跳过 `attachments/` 保留数据目录**：它是附件存储区而非用户内容目录，不应递归索引。可消除 ~335 次 list 调用 ≈ **-380~420ms**，预计冷启动 1642 → **~1.2~1.25s**；同时目录树不再混入 334 个附件文件夹（顺带修数据卫生）。
2. **【次优】同层目录 list 并行化**：scanDir 目前串行 `await` 递归；拿到父目录条目后可 `Promise.all` 并发 list 子目录，预计 list 段再省 30~50%。
3. **【中等】索引只读文件头部**：建索引只需 frontmatter（前 ~400B）+ 摘要，无需全文读。OPFS/native 均可 `File.slice(0, 800).text()`。正文均长 1.5KB 时收益 ~10~20%，大文件（数万字）收益显著。
4. **【idb 后端必修】list 全表扫描**：`idbBE.list(rel)` 每次都 getAllKeys 全表扫 + 匹配项逐条 get，356 次 × 全量。建议一次性 getAll 建内存索引、按前缀过滤，或随种子写入时维护 `dir → children` 映射。否则任何走到 idb 兜底的环境（无 OPFS/无 SAF 的 WebView）冷启动约 3.8s 不达标。
5. 观察：opfs 预热后冷启动 1224ms，说明 FS 缓存生效；真机首次冷启动应按 #1~#9（1434~1732ms）评估。

## 五、交付物清单

- `_verify/perf/run-perf.js` —— 驱动脚本（生成+测量一体）
- `_verify/perf/vault-perf.html` —— 隔离宿主页（只读链接 vault-ui.css）
- `_verify/perf/lib/{vault-fs,markdown,vault}.js` —— 固定被测副本
- `_verify/perf/results-opfs.json` / `results-idb.json` —— 两次原始数据
- `_verify/perf/gen-notes.json` —— 1000 篇笔记元数据
- `_verify/perf/scroll-shot.png` —— 滚动中截图
- `_verify/perf/run-full.log` —— opfs 全量运行日志
- `_verify/perf/debug-idb-persist.js` —— IDB 持久化最小复现（调试留档）
