package com.zhipian.notes;

import android.Manifest;
import android.content.ClipData;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.net.Uri;
import android.provider.OpenableColumns;
import android.os.Build;
import android.os.Bundle;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.appcompat.app.AppCompatActivity;
import androidx.core.content.ContextCompat;
import androidx.documentfile.provider.DocumentFile;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Picture;
import android.graphics.Rect;
import android.graphics.pdf.PdfDocument;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Map;

public class MainActivity extends AppCompatActivity {

    WebView web;
    Bitmap pendingBitmap = null;
    final Map<Integer, String> pending = new HashMap<>();
    String baiduTokenTemplate = null, savedPanUrl = null, exportKbManifest = null;

    static final int RC_PICK_FILES = 101, RC_PICK_IMAGE = 102,
            RC_BIND_TREE = 103, RC_OPEN_TREE = 104,
            RC_CREATE_ZIP = 105, RC_OPEN_ZIP = 106,
            RC_CAPTURE_PNG = 107, RC_CAPTURE_PDF = 108,
            RC_EXPORT_KB = 109, RC_IMPORT_DATA = 110,
            RC_VAULT_BIND = 111, RC_VAULT_CAMERA = 112, RC_VAULT_EXPORT = 113,
            RC_VAULT_PICK = 114;
    /* 待接续的 v16 vault 上下文 */
    String pendingCameraNote = "", pendingVaultDir = "";

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        // 固定 60Hz：高刷屏上 WebView 难以稳定跑满 90/120，锁定 60 帧反而更跟手、
        // 打字与返回延迟更低，也更省电（用户明确要求固定 60 帧）
        try {
            android.view.WindowManager.LayoutParams lp = getWindow().getAttributes();
            android.view.Display d = getWindowManager().getDefaultDisplay();
            android.view.Display.Mode cur = d.getMode();
            android.view.Display.Mode best = null;
            for (android.view.Display.Mode m : d.getSupportedModes()) {
                if (m.getPhysicalWidth() != cur.getPhysicalWidth()
                        || m.getPhysicalHeight() != cur.getPhysicalHeight()) continue;
                float r = m.getRefreshRate();
                if (Math.abs(r - 60f) < 0.6f) { best = m; break; }
                if (best == null || Math.abs(r - 60f) < Math.abs(best.getRefreshRate() - 60f)) best = m;
            }
            if (best == null) best = cur;
            lp.preferredDisplayModeId = best.getModeId();
            lp.preferredRefreshRate = 60f;
            getWindow().setAttributes(lp);
        } catch (Exception ignore) {}
        if (android.os.Build.VERSION.SDK_INT >= 21) {
            WebView.enableSlowWholeDocumentDraw();
        }
        web = new ZhipianWebView(this);
        setContentView(web);
        // 缝隙底色与 App 米色一致；隐藏系统滚动条与边缘回弹高光（避免真机右侧露出冷白条）
        web.setBackgroundColor(android.graphics.Color.parseColor("#ECEAE2"));
        web.setVerticalScrollBarEnabled(false);
        web.setHorizontalScrollBarEnabled(false);
        web.setOverScrollMode(android.view.View.OVER_SCROLL_NEVER);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(true);
        s.setAllowContentAccess(true);
        s.setJavaScriptCanOpenWindowsAutomatically(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        // 禁用缩放检测（页面已 user-scalable=no），减少手势/双指缩放的额外开销
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setDisplayZoomControls(false);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);

        web.addJavascriptInterface(new Bridge(this), "AndroidBridge");

        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
                Uri u = req.getUrl();
                String us = u.toString();
                if (us.startsWith("zhipian://")) {
                    if (us.startsWith("zhipian://oauth/redirect")) handleBaiduRedirect(u);
                    else if (us.startsWith("zhipian://oauth/back")) {
                        if (savedPanUrl != null) {
                            web.loadUrl(savedPanUrl);
                            web.postDelayed(() -> web.clearHistory(), 500);
                        }
                    }
                    return true;
                }
                String host = u.getHost();
                if ("zhipian.local".equals(host)) return false;
                if (host != null && (host.endsWith("baidu.com") || host.contains("baidupcs")))
                    return false;
                if ("http".equals(u.getScheme()) || "https".equals(u.getScheme())) {
                    try {
                        startActivity(new Intent(Intent.ACTION_VIEW, u));
                        return true;
                    } catch (Exception e) {
                        return false;
                    }
                }
                return false;
            }
            @Override
            public void onPageFinished(WebView view, String url) {
                if (url != null && url.contains("/oauth/2.0/login_success")) {
                    Uri u = Uri.parse(url);
                    String code = u.getQueryParameter("code");
                    if (code != null && code.length() > 0) {
                        finishBaiduWithCode(code);
                        return;
                    }
                    /* oob：授权码只显示在页面里，注入提示条引导复制后返回 */
                    view.evaluateJavascript(
                        "(function(){if(document.getElementById('__zpbar'))return;"
                        + "var b=document.createElement('div');b.id='__zpbar';"
                        + "b.style.cssText='position:fixed;top:0;left:0;right:0;z-index:99999;background:#2f6b4f;color:#fff;padding:12px 14px;box-shadow:0 2px 10px rgba(0,0,0,.25)';"
                        + "b.innerHTML='<div style=\"margin-bottom:9px;font-size:14px;line-height:1.5\">长按下方页面中的授权码将其复制，然后点此返回纸片</div><button style=\"width:100%;height:42px;border:0;border-radius:10px;background:#fff;color:#2f6b4f;font-weight:700;font-size:15px\">已复制，返回纸片</button>';"
                        + "b.querySelector('button').onclick=function(){location.href='zhipian://oauth/back';};"
                        + "document.body.appendChild(b);})();", null);
                }
            }
            /* 拦截虚拟域名：让 JS 能读取本机附件字节、以及导入用的切片文件 */
            @Override
            public WebResourceResponse shouldInterceptRequest(
                    WebView view, WebResourceRequest request) {
                Uri u = request.getUrl();
                if (u == null || !"zhipian.local".equals(u.getHost())) return null;
                String p = u.getPath();
                try {
                    if ("/file".equals(p)) {
                        File f = Storage.findFile(MainActivity.this,
                                u.getQueryParameter("id"));
                        if (f == null) return null;
                        return new WebResourceResponse(
                                Storage.mimeOf(f.getName()), "UTF-8",
                                new FileInputStream(f));
                    }
                    if ("/kb/import_chunks.jsonl".equals(p)) {
                        File f = new File(getCacheDir(), "kb/import_chunks.jsonl");
                        InputStream in = f.exists() ? new FileInputStream(f)
                                : new java.io.ByteArrayInputStream(new byte[0]);
                        return new WebResourceResponse(
                                "application/x-ndjson", "UTF-8", in);
                    }
                    /* 主文档与全部静态资源同源提供：App 即标准 https 网页，
                       wasm 可流式编译、Worker 同源，彻底规避 file:// 的 fetch/实例化问题 */
                    String ap = null, mt = null;
                    if ("/".equals(p) || "/index.html".equals(p)) {
                        ap = "web/index.html"; mt = "text/html";
                    } else if (p.startsWith("/vendor/")) {
                        ap = "web" + p; mt = mimeForAsset(p);
                    }
                    if (ap != null) {
                        if (ap.contains("..")) return null;
                        InputStream in = getAssets().open(ap);
                        java.util.Map<String, String> hdr = new java.util.HashMap<>();
                        hdr.put("Cache-Control", "no-cache");
                        return new WebResourceResponse(mt, null, 200, "OK", hdr, in);
                    }
                } catch (Exception e) { return null; }
                return null;
            }
        });

        if (b == null) web.loadUrl("https://zhipian.local/");
    }

    static String mimeForAsset(String rel) {
        String r = rel.toLowerCase();
        if (r.endsWith(".wasm")) return "application/wasm";
        if (r.endsWith(".js")) return "text/javascript";
        if (r.endsWith(".json")) return "application/json";
        if (r.endsWith(".txt")) return "text/plain";
        if (r.endsWith(".onnx")) return "application/octet-stream";
        if (r.endsWith(".png")) return "image/png";
        if (r.endsWith(".jpg") || r.endsWith(".jpeg")) return "image/jpeg";
        return "application/octet-stream";
    }

    /* ---------- 回调注入 ---------- */
    void emit(String callId, JSONObject r) {
        final String js = "window.NativeBridge.onResult(" +
                JSONObject.quote(callId) + "," + JSONObject.quote(r.toString()) + ")";
        runOnUiThread(() -> web.evaluateJavascript(js, null));
    }
    void cbData(String callId, Object data) {
        JSONObject r = new JSONObject();
        try { r.put("ok", true); r.put("data", data == null ? JSONObject.NULL : data); }
        catch (JSONException ignore) {}
        emit(callId, r);
    }
    void cbErr(String callId, String err) {
        JSONObject r = new JSONObject();
        try { r.put("ok", false); r.put("error", err == null ? "错误" : err); }
        catch (JSONException ignore) {}
        emit(callId, r);
    }
    /* native → JS 操作日志（自动镜像等后台失败也能在日志页看到） */
    void jsLog(final String level, final String cat, final String msg) {
        runOnUiThread(() -> {
            final String js = "window.__nativeLog&&window.__nativeLog(" +
                    JSONObject.quote(level) + "," + JSONObject.quote(cat) + "," +
                    JSONObject.quote(msg == null ? "" : msg) + ")";
            web.evaluateJavascript(js, null);
        });
    }

    /* ---------- Intent 发起 ---------- */
    void launch(String callId, final Intent intent, final int rc) {
        pending.put(rc, callId);
        runOnUiThread(() -> {
            try { startActivityForResult(intent, rc); }
            catch (Exception e) { pending.remove(rc); cbErr(callId, "无法打开选择器"); }
        });
    }

    /* ---------- 按场景开关系统选择菜单 ---------- */
    void setMenuSuppressed(final boolean on) {
        if (web instanceof ZhipianWebView) {
            ((ZhipianWebView) web).suppressActionMenu = on;
        }
    }

    /* ---------- 百度网盘增量同步（后台线程，进度回注 JS） ---------- */
    void baiduSync(final String callId, final String token, final boolean push, final String mode) {
        /* Android 13+ 通知权限，用于显示同步进度；被拒也不影响前台服务继续运行 */
        if (Build.VERSION.SDK_INT >= 33
                && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)
                        != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 201);
        }
        SyncService.callback = new SyncService.Callback() {
            @Override public void onOk(final JSONObject r) {
                runOnUiThread(() -> cbData(callId, r));
            }
            @Override public void onErr(final String m) {
                runOnUiThread(() -> cbErr(callId, m));
            }
            @Override public void onProgress(final int pct, final String msg) {
                runOnUiThread(() -> {
                    if (web != null) web.evaluateJavascript(
                            "window.__app&&window.__app.syncProgress(" + pct + ","
                                    + JSONObject.quote(msg) + ")", null);
                });
            }
        };
        Intent it = new Intent(this, SyncService.class);
        it.putExtra("token", token);
        it.putExtra("push", push);
        it.putExtra("mode", mode);
        ContextCompat.startForegroundService(this, it);
    }

    /* 切后台 / 退出前通知网页立即保存 */
    @Override
    protected void onPause() {
        super.onPause();
        if (web != null) web.evaluateJavascript(
                "window.__app&&window.__app.flushDisk&&window.__app.flushDisk()", null);
    }

    /* 回前台：部分机型 WebView 硬件加速合成层在切后台/转场后纹理丢失，
       表现为页面空白（只剩原生底色）。主动 invalidate 并通知网页强制重绘 */
    @Override
    protected void onResume() {
        super.onResume();
        if (web != null) {
            web.invalidate();
            web.postDelayed(() -> {
                if (web != null) {
                    web.invalidate();
                    web.evaluateJavascript(
                            "window.__forceRepaint&&window.__forceRepaint()", null);
                }
            }, 120);
        }
    }

    @Override
    protected void onDestroy() {
        /* 真正退出时断开服务回调，避免持有已销毁 Activity；同步仍由前台通知继续完成 */
        SyncService.callback = null;
        super.onDestroy();
    }

    /* ---------- 整页长截图 / PDF ---------- */
    void captureExport(final String callId, final String kind, final String name) {
        runOnUiThread(() -> web.postDelayed(() -> {
            try {
                final int viewW = web.getWidth();
                if (viewW <= 0) { cbErr(callId, "页面尚未准备好"); return; }
                final float density = getResources().getDisplayMetrics().density;
                int contentH = (int) Math.ceil(web.getContentHeight() * density);
                final int viewH = web.getHeight();
                if (contentH < viewH) contentH = viewH;
                if (contentH <= 0) { cbErr(callId, "页面内容为空"); return; }
                final Bitmap bmp;
                try {
                    bmp = Bitmap.createBitmap(viewW, contentH, Bitmap.Config.ARGB_8888);
                    final Canvas c = new Canvas(bmp);
                    c.drawColor(Color.WHITE);
                    web.draw(c);   // enableSlowWholeDocumentDraw 后渲染整个文档
                } catch (OutOfMemoryError oom) {
                    cbErr(callId, "内容太长、内存不足，请缩短后再导出");
                    return;
                }
                final String base = (name == null || name.trim().isEmpty()) ? "便签" : name;
                Uri tree = Storage.boundTree(this);
                if (tree != null) {
                    String dpath = null; String derr = null;
                    try {
                        if ("pdf".equals(kind)) {
                            String fn = Storage.tsFileName(base, ".pdf");
                            DocumentFile dir = Storage.exportCatDir(this, tree, Storage.E_PDF);
                            DocumentFile old = dir.findFile(fn); if (old != null) old.delete();
                            DocumentFile f = Storage.createFileRobust(dir, "application/pdf", fn);
                            try (OutputStream pos = getContentResolver()
                                    .openOutputStream(f.getUri())) {
                                writePdf(bmp, pos);
                            }
                            dpath = Storage.D_EXPORT + "/" + Storage.E_PDF + "/" + f.getName();
                        } else {
                            java.io.ByteArrayOutputStream bos = new java.io.ByteArrayOutputStream();
                            bmp.compress(Bitmap.CompressFormat.PNG, 100, bos);
                            String fn = Storage.tsFileName(base, ".png");
                            dpath = Storage.writeExport(this, Storage.E_SHOT, fn,
                                    "image/png", bos.toByteArray());
                        }
                    } catch (Exception de) { dpath = null; derr = de.getMessage(); }
                    if (dpath != null) {
                        bmp.recycle();
                        JSONObject r = new JSONObject(); r.put("path", dpath);
                        cbData(callId, r);
                        return;
                    }
                    if (derr != null) android.widget.Toast.makeText(this,
                            "资料库目录写入失败，请选择其他位置", android.widget.Toast.LENGTH_SHORT).show();
                }
                final Intent i = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                i.addCategory(Intent.CATEGORY_OPENABLE);
                final int rc;
                if ("pdf".equals(kind)) {
                    i.setType("application/pdf");
                    i.putExtra(Intent.EXTRA_TITLE, base + ".pdf");
                    rc = RC_CAPTURE_PDF;
                } else {
                    i.setType("image/png");
                    i.putExtra(Intent.EXTRA_TITLE, base + ".png");
                    rc = RC_CAPTURE_PNG;
                }
                if (pendingBitmap != null) pendingBitmap.recycle();
                pendingBitmap = bmp;
                launch(callId, i, rc);
            } catch (Exception e) { cbErr(callId, e.getMessage()); }
        }, 150));
    }
    void writePdf(Bitmap b, OutputStream os) throws Exception {
        PdfDocument pd = new PdfDocument();
        int vw = b.getWidth();
        int pageH = (int)Math.round(vw * 297.0 / 210.0);
        int pages = Math.max(1, (int)Math.ceil(b.getHeight() / (double)pageH));
        for (int i = 0; i < pages; i++) {
            int top = i * pageH;
            int h = Math.min(pageH, b.getHeight() - top);
            PdfDocument.Page pg = pd.startPage(
                    new PdfDocument.PageInfo.Builder(vw, pageH, i + 1).create());
            Canvas c = pg.getCanvas();
            c.drawColor(Color.WHITE);
            Rect src = new Rect(0, top, vw, top + h);
            Rect dst = new Rect(0, 0, vw, h);
            c.drawBitmap(b, src, dst, null);
            pd.finishPage(pg);
        }
        pd.writeTo(os);
        pd.close();
        os.close();
    }

    /* ---------- 百度授权 ---------- */
    void startBaidu(final String callId, final String authUrl, final String tokenTemplate) {
        baiduTokenTemplate = tokenTemplate;
        runOnUiThread(() -> {
            savedPanUrl = web.getUrl();   // WebView 方法必须在主线程
            web.loadUrl(authUrl);
        });
        cbData(callId, new JSONObject());
    }
    void handleBaiduRedirect(Uri u) {
        String code = u.getQueryParameter("code");
        final String target = savedPanUrl;
        if (code == null) {
            String err = u.getQueryParameter("error");
            Storage.sp(this).edit().putString("pending_auth_error",
                    err == null ? "授权失败" : "授权失败：" + err).apply();
            if (target != null) web.loadUrl(target);
            return;
        }
        finishBaiduWithCode(code);
    }
    void finishBaiduWithCode(final String codeIn) {
        final String tmpl = baiduTokenTemplate;
        baiduTokenTemplate = null;
        final String target = savedPanUrl;
        new Thread(() -> {
            try {
                String body = Storage.httpGet(tmpl.replace("{CODE}", Uri.encode(codeIn)));
                Storage.sp(MainActivity.this).edit()
                        .putString("pending_auth", body).apply();
            } catch (Exception e) {
                Storage.sp(MainActivity.this).edit()
                        .putString("pending_auth_error", "令牌获取失败：" + e.getMessage()).apply();
            }
            runOnUiThread(() -> {
                if (target != null) {
                    web.loadUrl(target);
                    web.postDelayed(() -> web.clearHistory(), 500);
                }
            });
        }).start();
    }

    /* ---------- 结果处理 ---------- */
    @Override
    protected void onActivityResult(final int rc, final int result, final Intent data) {
        super.onActivityResult(rc, result, data);
        final String callId = pending.remove(rc);
        if (callId == null) return;
        if (result != RESULT_OK || data == null) {
            if (pendingBitmap != null) { pendingBitmap.recycle(); pendingBitmap = null; }
            cbErr(callId, "已取消"); return;
        }
        final ArrayList<Uri> pickedFiles = (rc == RC_PICK_FILES) ? collect(data) : null;
        if (pickedFiles != null) {
            for (Uri u : pickedFiles) {
                try {
                    getContentResolver().takePersistableUriPermission(
                            u, Intent.FLAG_GRANT_READ_URI_PERMISSION);
                } catch (Exception ignore) {}
            }
        }
        if (rc == RC_BIND_TREE || rc == RC_OPEN_TREE || rc == RC_VAULT_BIND) {
            try {
                getContentResolver().takePersistableUriPermission(data.getData(),
                        Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
            } catch (Exception ignore) {}
        }
        new Thread(() -> {
            try {
                switch (rc) {
                    case RC_PICK_FILES: {
                        JSONArray arr = new JSONArray();
                        StringBuilder errs = new StringBuilder();
                        ArrayList<Uri> uris = pickedFiles != null ? pickedFiles : collect(data);
                        for (Uri u : uris) {
                            String id = genId();
                            String name = null;
                            try { name = Storage.displayName(this, u); } catch (Exception ignore) {}
                            if (name == null || name.trim().isEmpty()) name = "文件";
                            try {
                                Storage.copyUri(this, u, id, name);
                                File f = Storage.findFile(this, id);
                                if (f == null || f.length() == 0)
                                    throw new Exception("文件写入失败或为空");
                                JSONObject m = new JSONObject();
                                m.put("id", id); m.put("name", name);
                                m.put("size", f.length());
                                m.put("type", guessMime(name));
                                m.put("kind", kindOf(name));
                                arr.put(m);
                            } catch (Exception fe) {
                                if (errs.length() > 0) errs.append("；");
                                String why = fe.getMessage();
                                errs.append(name).append("(")
                                        .append(why == null ? "读取失败" : why).append(")");
                            }
                        }
                        if (arr.length() == 0) {
                            cbErr(callId, "无法添加：" + errs
                                    + "。请从系统「文件」管理器选择，或先把文件保存到手机再添加");
                        } else {
                            cbData(callId, arr);
                            if (errs.length() > 0) {
                                final String em = errs.toString().replace("'", "");
                                runOnUiThread(() -> web.evaluateJavascript(
                                        "window.__app&&window.__app.toast('部分文件未添加：" + em + "')", null));
                            }
                        }
                        break;
                    }
                    case RC_PICK_IMAGE: {
                        Uri u = data.getData();
                        cbData(callId, Storage.compressImageUri(this, u, 1280, 78));
                        break;
                    }
                    case RC_BIND_TREE: {
                        Uri tree = data.getData();
                        try {
                            Storage.exportToTree(MainActivity.this, tree); // 先验证可写
                            Storage.bindTree(MainActivity.this, tree);      // 成功才持久绑定
                            JSONObject r = new JSONObject();
                            r.put("name", nameOfTree(tree));
                            cbData(callId, r);
                        } catch (Exception e) { cbErr(callId, "绑定失败：" + e.getMessage()); }
                        break;
                    }
                    case RC_OPEN_TREE: {
                        Uri tree = data.getData();
                        Storage.bindTree(MainActivity.this, tree); // 含持久读写权限
                        try {
                            JSONObject lib = Storage.importFromTree(MainActivity.this, tree);
                            JSONObject out = new JSONObject();
                            out.put("notes", lib.getJSONArray("notes"));
                            if (lib.has("prefs")) out.put("prefs", lib.getJSONObject("prefs"));
                            out.put("name", nameOfTree(tree));
                            out.put("missing", lib.optJSONArray("_missing"));
                            out.put("restored", lib.optInt("_restored"));
                            out.put("skipped", lib.optInt("_skipped"));
                            out.put("verified", lib.optBoolean("_verified"));
                            cbData(callId, out);
                        } catch (Exception e) { cbErr(callId, e.getMessage()); }
                        break;
                    }
                    case RC_CREATE_ZIP: {
                        Storage.exportZip(this, data.getData());
                        cbData(callId, new JSONObject());
                        break;
                    }
                    case RC_OPEN_ZIP: {
                        JSONObject lib = Storage.importZip(this, data.getData());
                        JSONObject out = new JSONObject();
                        out.put("notes", lib.getJSONArray("notes"));
                        if (lib.has("prefs")) out.put("prefs", lib.getJSONObject("prefs"));
                        cbData(callId, out);
                        break;
                    }
                    case RC_IMPORT_DATA: {
                        Uri uri = data.getData();
                        String dn = displayName(uri);
                        String low = dn == null ? "" : dn.toLowerCase();
                        JSONObject out = new JSONObject();
                        if (low.endsWith(".zip") || low.endsWith(".kbpkg")) {
                            new File(getCacheDir(), "import_chunks.jsonl").delete();
                            JSONObject lib = Storage.importZip(this, uri);
                            out.put("kind", "lib");
                            out.put("notes", lib.getJSONArray("notes"));
                            if (lib.has("prefs")) out.put("prefs", lib.getJSONObject("prefs"));
                            out.put("label", new File(getCacheDir(), "import_chunks.jsonl").exists()
                                    ? "知识库包" : "备份 zip");
                        } else if (low.endsWith(".jsonl")) {
                            writeToCache("import_chunks.jsonl",
                                    getContentResolver().openInputStream(uri));
                            out.put("kind", "chunks");
                        } else if (low.endsWith(".json")) {
                            InputStream is = getContentResolver().openInputStream(uri);
                            ByteArrayOutputStream bo = new ByteArrayOutputStream();
                            byte[] bb = new byte[8192]; int nn;
                            while ((nn = is.read(bb)) > 0) bo.write(bb, 0, nn);
                            is.close();
                            out.put("kind", "json");
                            out.put("text", bo.toString("UTF-8"));
                        } else {
                            cbErr(callId, "不支持的文件类型，请选择 .zip / .json / .jsonl");
                            break;
                        }
                        cbData(callId, out);
                        break;
                    }
                    case RC_EXPORT_KB: {
                        Storage.exportKbPackage(this, data.getData(),
                                exportKbManifest == null ? "{}" : exportKbManifest);
                        exportKbManifest = null;
                        cbData(callId, new JSONObject());
                        break;
                    }
                    case RC_CAPTURE_PNG: {
                        Bitmap bmp = pendingBitmap; pendingBitmap = null;
                        OutputStream os = getContentResolver()
                                .openOutputStream(data.getData());
                        bmp.compress(Bitmap.CompressFormat.PNG, 100, os);
                        os.close(); bmp.recycle();
                        cbData(callId, new JSONObject());
                        break;
                    }
                    case RC_CAPTURE_PDF: {
                        Bitmap bmp = pendingBitmap; pendingBitmap = null;
                        writePdf(bmp, getContentResolver()
                                .openOutputStream(data.getData()));
                        bmp.recycle();
                        cbData(callId, new JSONObject());
                        break;
                    }
                    case RC_VAULT_BIND: {
                        Uri tree = data.getData();
                        Storage.sp(MainActivity.this).edit()
                                .putString("vault_tree", tree.toString()).apply();
                        cbData(callId, Storage.vaultRootDesc(MainActivity.this));
                        break;
                    }
                    case RC_VAULT_EXPORT: {
                        long bytes = Storage.vaultExportZip(this, data.getData());
                        JSONObject r = new JSONObject();
                        r.put("ok", true); r.put("bytes", bytes);
                        cbData(callId, r);
                        break;
                    }
                    case RC_VAULT_CAMERA: {
                        /* 系统相机拍照完成 → 落 vault attachments/<笔记名>/ */
                        File tmp = new File(getCacheDir(), "vault_camera_tmp.jpg");
                        if (!tmp.exists() || tmp.length() == 0)
                            throw new Exception("未拍摄到照片");
                        byte[] bytes = Storage.readAll(tmp);
                        tmp.delete();
                        String name = "拍照-" + new java.text.SimpleDateFormat("yyyyMMdd-HHmmss")
                                .format(new java.util.Date()) + ".jpg";
                        String rel = Storage.vaultWriteAttachment(this, pendingCameraNote, name, bytes);
                        pendingCameraNote = "";
                        JSONObject o = new JSONObject();
                        o.put("path", rel); o.put("name", name);
                        o.put("size", bytes.length); o.put("type", "image/jpeg");
                        cbData(callId, o);
                        break;
                    }
                    case RC_VAULT_PICK: {
                        /* 任意文件/PDF 多选 → 导入 vault 指定目录 */
                        JSONArray arr = new JSONArray();
                        for (Uri u : collect(data))
                            arr.put(Storage.vaultImportFile(this, u.toString(), pendingVaultDir));
                        pendingVaultDir = "";
                        cbData(callId, arr);
                        break;
                    }
                    default:
                        cbErr(callId, "未知请求");
                }
            } catch (Exception e) {
                cbErr(callId, e.getMessage());
            }
        }).start();
    }

    String displayName(Uri uri) {
        String name = null;
        Cursor cur = null;
        try {
            cur = getContentResolver().query(uri,
                    new String[]{OpenableColumns.DISPLAY_NAME}, null, null, null);
            if (cur != null && cur.moveToFirst()) name = cur.getString(0);
        } catch (Exception ignore) {
        } finally { if (cur != null) cur.close(); }
        return name;
    }

    void writeToCache(String fileName, InputStream is) throws Exception {
        File f = new File(getCacheDir(), fileName);
        FileOutputStream os = new FileOutputStream(f);
        byte[] b = new byte[8192]; int n;
        if (is != null) while ((n = is.read(b)) > 0) os.write(b, 0, n);
        os.close();
        if (is != null) is.close();
    }

    ArrayList<Uri> collect(Intent data) {
        ArrayList<Uri> l = new ArrayList<>();
        ClipData cd = data.getClipData();
        if (cd != null) {
            for (int i = 0; i < cd.getItemCount(); i++) l.add(cd.getItemAt(i).getUri());
        } else if (data.getData() != null) l.add(data.getData());
        return l;
    }
    String nameOfTree(Uri tree) {
        DocumentFile df = DocumentFile.fromTreeUri(this, tree);
        return df == null ? "资料库" : df.getName();
    }
    String genId() {
        return Long.toString(System.currentTimeMillis(), 36)
                + Integer.toString((int) (Math.random() * 60466176), 36);
    }
    String guessMime(String name) {
        String m = java.net.URLConnection.guessContentTypeFromName(name);
        return m == null ? "application/octet-stream" : m;
    }
    String kindOf(String n) {
        n = n.toLowerCase();
        if (n.matches(".*\\.(xlsx?|csv|numbers)$")) return "excel";
        if (n.matches(".*\\.(docx?|pages|wps)$")) return "word";
        if (n.endsWith(".pdf")) return "pdf";
        if (n.matches(".*\\.(png|jpe?g|gif|webp|bmp|svg|heic|heif)$")) return "image";
        if (n.matches(".*\\.(mp3|wav|m4a|aac|flac|ogg)$")) return "audio";
        if (n.matches(".*\\.(mp4|mov|avi|mkv|webm)$")) return "video";
        if (n.matches(".*\\.(zip|rar|7z|tar|gz)$")) return "zip";
        return "file";
    }

    public boolean inSelectMode = false;

    /* 供 JS 回调里退出应用（匿名回调内无法直接写 super.onBackPressed） */
    void finishFromBack(){ super.onBackPressed(); }

    @Override
    public void onBackPressed() {
        if (inSelectMode && web != null) {
            web.evaluateJavascript("window.__backInSelect && window.__backInSelect();", null);
            return;
        }
        if (web == null) { super.onBackPressed(); return; }
        /* 先让网页关闭浮层（标签/动作面板、模态、笔记本选择）；已处理则不回退历史 */
        web.evaluateJavascript(
            "(window.__dismissOverlay && window.__dismissOverlay()) ? true : false;", val -> {
                if ("true".equals(val)) return;
                if (web.canGoBack()) web.goBack();
                else finishFromBack();
            });
    }
}
