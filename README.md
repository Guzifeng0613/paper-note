# 纸片（Zhipian Notes）

一款**纯本地、离线优先**的安卓便签 App。所有数据保存在本机，无账号、无强制联网。

- 当前版本：**v15.3.7**（versionCode 224）
- 包名：`com.zhipian.notes`
- 已签名 Release 包：`纸片-v15.3.7.apk`（约 3.4 MB），可直接安装

---

## 一、这是什么

「纸片」是一个单页 WebView 应用：

- 全部界面与业务逻辑集中在 **`index.html`**（约 5900 行，HTML + CSS + 原生 JS 全部内联，不依赖任何前端框架）；
- 跑在一个全屏 `WebView` 里；
- Java 原生层通过 `@JavascriptInterface`（`AndroidBridge`）和 `shouldInterceptRequest` 拦截，向网页提供私有文件存储、选文件、拍照、截图导出、百度网盘、后台同步等原生能力。

数据存储默认走浏览器端 IndexedDB；在 App 内则由原生层落盘到应用私有目录，附件以独立文件形式存放并建立位置索引。

## 二、目录结构

```
notes-app/
├── index.html                  # 全部界面 + 业务逻辑（单文件）
├── 纸片-v15.3.7.apk            # 最新已签名 Release 包，直接安装即可
├── README.md                   # 本文件
├── ACCEPTANCE.md               # 各版本改动与验收记录（v15.2.0 → v15.3.7）
├── 纸片功能说明-v15.3.5.html    # 功能 / 架构 / 跳转关系说明（浏览器打开）
├── 优化总结报告-v15.2.0.html    # 性能优化总结
├── 性能分析与清理清单.html      # 性能分析与冗余清理清单
│
├── android/                    # 安卓工程
│   ├── settings.gradle / build.gradle / gradle.properties
│   └── app/
│       ├── build.gradle        # versionCode 224 / versionName 15.3.7
│       ├── proguard-rules.pro  # R8 混淆规则
│       └── src/main/
│           ├── AndroidManifest.xml
│           ├── java/com/zhipian/notes/   # 原生层
│           │   ├── MainActivity.java      # 入口、WebView、百度授权回调
│           │   ├── ZhipianWebView.java    # WebView 配置 / 请求拦截
│           │   ├── Bridge.java            # @JavascriptInterface 桥接分发
│           │   ├── Storage.java           # 私有文件读写、HTTP、图片压缩
│           │   ├── Baidu.java             # 百度网盘上传/下载/分片
│           │   ├── ChunkService.java       # 后台分片上传服务
│           │   ├── SyncService.java       # 后台同步服务
│           │   └── TaskService.java        # 后台任务服务
│           ├── res/                       # 图标 / 主题 / 字符串
│           └── assets/web/
│               ├── index.html             # 打包用副本（由根 index.html 同步）
│               └── vendor/               # 附件解析库：pdf / mammoth / xlsx / jszip
│
└── _tests/                     # Playwright 回归套件（14 套 / 209 断言）
```

> 打包时已排除：历史 APK、`.idsig` 签名文件、`android/app/build/`、`android/.gradle/`、
> `_shots/ _perf/ _backup/ _ref/ _review/ _test/` 等中间产物，以及未进包的 `ocr-models/`。

## 三、直接安装

把 `纸片-v15.3.7.apk` 拷到安卓手机，允许「安装未知来源应用」后点击安装即可。覆盖安装会保留原数据。

## 四、从源码构建

环境要求：JDK 17、Android SDK（platform / build-tools 34）、Gradle 8.9。

```bash
# 0. 本机需先写 android/local.properties，指向你的 SDK 路径：
#    sdk.dir=/path/to/android-sdk

# 1. 把最新网页源码同步进 assets
cp index.html android/app/src/main/assets/web/index.html

# 2. 构建 Release（未签名）
cd android
JAVA_HOME=/path/to/jdk-17 ANDROID_HOME=/path/to/android-sdk \
  gradle assembleRelease --console=plain
# 产物：android/app/build/outputs/apk/release/app-release-unsigned.apk

# 3. 对齐 + 签名（示例用 debug keystore；正式发布请换自己的密钥库）
BT=$ANDROID_HOME/build-tools/34.0.0
$BT/zipalign -p -f 4 app-release-unsigned.apk aligned.apk
$BT/apksigner sign --ks my.keystore --ks-pass pass:*** --key-pass pass:*** \
  --out 纸片-v15.3.7.apk aligned.apk
$BT/apksigner verify 纸片-v15.3.7.apk
```

## 五、运行回归测试

需要 Node.js 与 Playwright（headless Chromium）：

```bash
cd _tests
NODE_PATH=/path/to/playwright/node_modules node v_accept_app.js   # 任选一个套件
```

套件覆盖：编辑器、端到端流程、待办 UI、白屏、附件 AI、抽屉、笔记本管理、
聊天、字体、便签 AI、网盘合并等（共 14 套）。

## 六、当前版本要点（v15.3.7）

- 单文件 `index.html` 全部界面与逻辑；
- 便签 CRUD、笔记本/分组、回收站、待办（可置顶/置底开关）、撤销重做；
- 附件：PDF / Word / Excel / 图片，小于 10 MB 可随上下文打包发给 AI；
- 长截图 / PDF 导出、分享；
- 百度网盘手动增量同步（push / pull），OAuth 授权走原生 HTTP 通道；
- 性能：渐进渲染、事件委托、去转场动画、R8 瘦身，快速切换便签无卡顿。

详细功能与跳转关系见 **`纸片功能说明-v15.3.5.html`**（浏览器打开）。
