package com.zhipian.notes;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.webkit.JavascriptInterface;

import androidx.core.content.ContextCompat;
import androidx.core.content.FileProvider;

import org.json.JSONObject;

import java.io.File;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

class Bridge {
    final MainActivity a;
    Bridge(MainActivity a) { this.a = a; }

    @JavascriptInterface
    public void post(final String callId, final String method, final String payload) {
        try {
            switch (method) {
                case "loadMeta": {
                    String d = Storage.loadMeta(a);
                    a.cbData(callId, d == null ? JSONObject.NULL : new JSONObject(d));
                    break;
                }
                case "readAsset": {
                    JSONObject ra = new JSONObject(payload);
                    String rel = ra.optString("path", "");
                    if (rel.contains("..")) { a.cbErr(callId, "非法路径"); break; }
                    try (java.io.InputStream is = a.getAssets().open("web/" + rel);
                         java.io.ByteArrayOutputStream bos = new java.io.ByteArrayOutputStream()) {
                        byte[] buf = new byte[8192];
                        int n;
                        while ((n = is.read(buf)) != -1) bos.write(buf, 0, n);
                        JSONObject rr = new JSONObject();
                        rr.put("data", android.util.Base64.encodeToString(
                                bos.toByteArray(), android.util.Base64.NO_WRAP));
                        a.cbData(callId, rr);
                    } catch (Exception ex) {
                        a.cbErr(callId, "读取资源失败：" + ex.getMessage());
                    }
                    break;
                }
                case "taskProgress": {
                    JSONObject tp = new JSONObject(payload);
                    if (tp.optBoolean("done", false)) {
                        TaskService.end(a);
                        a.cbData(callId, new JSONObject());
                        break;
                    }
                    int pct = tp.optInt("pct", 0);
                    int done = tp.optInt("done", 0), total = tp.optInt("total", 1);
                    int eta = tp.optInt("eta", -1);
                    String label = tp.optString("label", "");
                    String etaStr = "";
                    if (eta >= 0) etaStr = eta >= 60
                            ? " · 剩余约 " + (eta / 60) + "分" + (eta % 60) + "秒"
                            : " · 剩余约 " + eta + "秒";
                    TaskService.post(a, "纸片 · 后台任务", pct,
                            label + "  " + done + "/" + total + etaStr);
                    a.cbData(callId, new JSONObject());
                    break;
                }
                case "saveMeta": {
                    Storage.saveMeta(a, payload);
                    Storage.syncBoundTree(a);
                    a.cbData(callId, new JSONObject());
                    break;
                }
                case "pickFiles": {
                    Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                    i.addCategory(Intent.CATEGORY_OPENABLE);
                    i.setType("*/*");
                    i.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
                    a.launch(callId, i, MainActivity.RC_PICK_FILES);
                    break;
                }
                case "pickImageCompressed": {
                    Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                    i.addCategory(Intent.CATEGORY_OPENABLE);
                    i.setType("image/*");
                    a.launch(callId, i, MainActivity.RC_PICK_IMAGE);
                    break;
                }
                case "putBlobFromDataUrl": {
                    JSONObject p = new JSONObject(payload);
                    Storage.writeDataUrl(a, p.getString("id"),
                            p.optString("name", "附件"), p.getString("dataUrl"));
                    Storage.syncBoundTree(a);
                    a.cbData(callId, new JSONObject());
                    break;
                }
                case "openFile": {
                    openFile(callId, new JSONObject(payload).getString("id"));
                    break;
                }
                case "fileUri": {
                    try {
                        Uri u = Storage.contentUri(a, payload);
                        a.cbData(callId, new JSONObject().put("uri", u.toString()));
                    } catch (Exception e) {
                        a.cbErr(callId, e.getMessage() == null ? "读取失败" : e.getMessage());
                    }
                    break;
                }
                case "deleteFile": {
                    Storage.deleteId(a, new JSONObject(payload).getString("id"));
                    a.cbData(callId, new JSONObject());
                    break;
                }
                case "thumbForId": {
                    String tid = new JSONObject(payload).getString("id");
                    a.cbData(callId, Storage.thumbForId(a, tid));
                    break;
                }
                case "bindLibraryFolder": {
                    a.launch(callId, new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE),
                            MainActivity.RC_BIND_TREE);
                    break;
                }
                case "openLibraryFolder": {
                    a.launch(callId, new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE),
                            MainActivity.RC_OPEN_TREE);
                    break;
                }
                case "syncLibraryFolder": {
                    TaskService.post(a, "纸片 · 目录同步", 0, "准备核对…");
                    new Thread(() -> {
                        try {
                            JSONObject rr = Storage.forceSync(a, (done,total,label) -> {
                                int pct = total<=0 ? 100 : Math.round(done*100f/total);
                                TaskService.post(a, "纸片 · 目录同步", pct,
                                        label+"  "+done+"/"+total);
                            });
                            TaskService.end(a);
                            a.cbData(callId, rr);
                        } catch (Exception ex) {
                            TaskService.end(a);
                            a.cbErr(callId, "同步失败：" + ex.getMessage());
                        }
                    }).start();
                    break;
                }
                case "forceMirror": {
                    a.cbData(callId, Storage.forceSync(a));
                    break;
                }
                case "exportZip": {
                    String zp = null;
                    try { zp = Storage.exportZipToDir(a, "纸片备份"); } catch (Exception zpe) { zp = null; }
                    if (zp != null) {
                        JSONObject zr = new JSONObject(); zr.put("path", zp);
                        a.cbData(callId, zr);
                        break;
                    }
                    Intent i = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                    i.addCategory(Intent.CATEGORY_OPENABLE);
                    i.setType("application/zip");
                    String stamp = new SimpleDateFormat("yyyyMMdd", Locale.getDefault()).format(new Date());
                    i.putExtra(Intent.EXTRA_TITLE, "zhipian-backup-" + stamp + ".zip");
                    a.launch(callId, i, MainActivity.RC_CREATE_ZIP);
                    break;
                }
                case "importZip": {
                    Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                    i.addCategory(Intent.CATEGORY_OPENABLE);
                    i.setType("*/*");
                    i.putExtra(Intent.EXTRA_MIME_TYPES, new String[]{
                            "application/zip", "application/x-zip-compressed",
                            "application/octet-stream", "*/*"});
                    a.launch(callId, i, MainActivity.RC_OPEN_ZIP);
                    break;
                }
                case "importData": {
                    Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                    i.addCategory(Intent.CATEGORY_OPENABLE);
                    i.setType("*/*");
                    i.putExtra(Intent.EXTRA_MIME_TYPES, new String[]{
                            "application/zip", "application/x-zip-compressed",
                            "application/json", "application/x-ndjson",
                            "text/json", "application/octet-stream", "*/*"});
                    a.launch(callId, i, MainActivity.RC_IMPORT_DATA);
                    break;
                }
                case "baiduAuth": {
                    JSONObject p = new JSONObject(payload);
                    a.startBaidu(callId, p.getString("authUrl"), p.getString("tokenTemplate"));
                    break;
                }
                case "httpRequest": {
                    JSONObject hp = new JSONObject(payload);
                    JSONObject rr = Storage.httpRequest(hp.optString("method", "GET"),
                            hp.getString("url"), hp.optJSONObject("headers"),
                            hp.has("body") ? hp.optString("body") : null);
                    a.cbData(callId, rr);
                    break;
                }
                case "captureExport": {
                    JSONObject ce = new JSONObject(payload);
                    a.captureExport(callId, ce.optString("kind", "png"),
                            ce.optString("name", "便签"));
                    break;
                }
                case "exportMd": {
                    try {
                        JSONObject em = new JSONObject(payload);
                        String nm = em.optString("name", "识别结果.md");
                        String tx = em.optString("text", "");
                        String path = Storage.writeExport(a, Storage.E_MD, nm,
                                "text/markdown",
                                tx.getBytes(java.nio.charset.StandardCharsets.UTF_8));
                        if (path == null) {
                            a.cbErr(callId, "请先在设置中绑定资料库目录");
                            break;
                        }
                        JSONObject rr = new JSONObject();
                        rr.put("path", path);
                        a.cbData(callId, rr);
                    } catch (Exception ex) {
                        a.cbErr(callId, "导出失败：" + ex.getMessage());
                    }
                    break;
                }
                case "exportToFolder": {
                    try {
                        JSONObject eo = new JSONObject(payload);
                        byte[] bytes = android.util.Base64.decode(
                                eo.optString("data",""), android.util.Base64.DEFAULT);
                        String path = Storage.writeExport(a, eo.optString("cat","导出"),
                                eo.optString("name","file"),
                                eo.optString("mime","application/octet-stream"), bytes);
                        JSONObject rr = new JSONObject();
                        if (path == null) { rr.put("ok", false);
                            rr.put("msg","请先在设置中绑定资料库目录"); }
                        else { rr.put("ok", true); rr.put("path", path); }
                        a.cbData(callId, rr);
                    } catch (Exception ex) {
                        JSONObject rr = new JSONObject();
                        try { rr.put("ok",false); rr.put("msg","导出失败："+ex.getMessage()); }
                        catch (Exception i) {}
                        a.cbData(callId, rr);
                    }
                    break;
                }
                case "setMenuSuppressed": {
                    final boolean on = "1".equals(payload);
                    a.runOnUiThread(() -> a.setMenuSuppressed(on));
                    a.cbData(callId, new JSONObject());
                    break;
                }
                case "setUiMode": {
                    a.inSelectMode = new JSONObject(payload).optBoolean("select", false);
                    a.cbData(callId, new JSONObject());
                    break;
                }
                case "gcFiles": {
                    a.cbData(callId, new JSONObject().put("removed", Storage.gcFiles(a)));
                    break;
                }
                case "commitImport": {
                    Storage.commitImportBackup(a);
                    a.cbData(callId, new JSONObject());
                    break;
                }
                case "mergeImport": {
                    Storage.mergeImportBackup(a);
                    a.cbData(callId, new JSONObject());
                    break;
                }
                case "rollbackImport": {
                    Storage.rollbackImportBackup(a);
                    a.cbData(callId, new JSONObject());
                    break;
                }
                case "baiduPush": {
                    a.baiduSync(callId, payload, true, "push");
                    break;
                }
                case "baiduPull": {
                    a.baiduSync(callId, payload, false, "pull");
                    break;
                }
                case "baiduMerge": {
                    a.baiduSync(callId, payload, true, "merge");
                    break;
                }
                case "startChunkService": {
                    ContextCompat.startForegroundService(a,
                            new Intent(a, ChunkService.class));
                    a.cbData(callId, new JSONObject());
                    break;
                }
                case "stopChunkService": {
                    a.stopService(new Intent(a, ChunkService.class));
                    a.cbData(callId, new JSONObject());
                    break;
                }
                case "chunkProgress": {
                    JSONObject p = new JSONObject(payload);
                    ChunkService s = ChunkService.instance;
                    if (s != null) s.update(p.optInt("pct", 0),
                            p.optString("msg", ""));
                    a.cbData(callId, new JSONObject());
                    break;
                }
                case "kbChunksBegin": {
                    Storage.kbChunksBegin(a);
                    a.cbData(callId, new JSONObject());
                    break;
                }
                case "kbChunksPart": {
                    Storage.kbChunksPart(a,
                            new JSONObject(payload).getString("b64"));
                    a.cbData(callId, new JSONObject());
                    break;
                }
                case "exportKbPackage": {
                    String kp = null;
                    try { kp = Storage.exportKbToDir(a, "纸片知识库", payload); }
                    catch (Exception kpe) { kp = null; }
                    if (kp != null) {
                        JSONObject kr = new JSONObject(); kr.put("path", kp);
                        a.cbData(callId, kr);
                        break;
                    }
                    Intent i = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                    i.addCategory(Intent.CATEGORY_OPENABLE);
                    i.setType("application/zip");
                    i.putExtra(Intent.EXTRA_TITLE, "zhipian-kb-"
                            + new SimpleDateFormat("yyyyMMdd", Locale.getDefault())
                                    .format(new Date()) + ".zip");
                    a.exportKbManifest = payload;
                    a.launch(callId, i, MainActivity.RC_EXPORT_KB);
                    break;
                }
                case "takePendingAuth": {
                    String body = Storage.sp(a).getString("pending_auth", null);
                    if (body != null) {
                        Storage.sp(a).edit().remove("pending_auth").apply();
                        a.cbData(callId, new JSONObject(body));
                    } else a.cbData(callId, JSONObject.NULL);
                    break;
                }
                case "takePendingAuthError": {
                    String err = Storage.sp(a).getString("pending_auth_error", null);
                    if (err != null) {
                        Storage.sp(a).edit().remove("pending_auth_error").apply();
                        a.cbData(callId, err);
                    } else a.cbData(callId, JSONObject.NULL);
                    break;
                }
                case "vibrate": {
                    try {
                        long vms = 9;
                        if (payload != null && payload.length() > 0) vms = Long.parseLong(payload);
                        Object svc = a.getSystemService(android.content.Context.VIBRATOR_SERVICE);
                        if (svc instanceof android.os.Vibrator)
                            ((android.os.Vibrator) svc).vibrate(vms);
                    } catch (Exception ignore) {}
                    a.cbData(callId, new JSONObject());
                    break;
                }
                /* ---------- v16 Vault：目录式 Markdown 资料库 ---------- */
                case "vaultRoot": {
                    a.cbData(callId, Storage.vaultRootDesc(a));
                    break;
                }
                case "vaultList": {
                    JSONObject p = vaultPayload(payload);
                    a.cbData(callId, Storage.vaultList(a, p.optString("path", "")));
                    break;
                }
                case "vaultRead": {
                    JSONObject p = vaultPayload(payload);
                    a.cbData(callId, Storage.vaultRead(a, p.optString("path", "")));
                    break;
                }
                case "vaultWrite": {
                    JSONObject p = vaultPayload(payload);
                    Storage.vaultWrite(a, p.optString("path", ""), p.optString("text", ""));
                    a.cbData(callId, new JSONObject().put("path", p.optString("path", "")));
                    break;
                }
                case "vaultMkdir": {
                    JSONObject p = vaultPayload(payload);
                    Storage.vaultMkdir(a, p.optString("path", ""));
                    a.cbData(callId, new JSONObject().put("path", p.optString("path", "")));
                    break;
                }
                case "vaultRename": {
                    JSONObject p = vaultPayload(payload);
                    Storage.vaultRename(a, p.optString("path", ""), p.optString("newPath", ""));
                    a.cbData(callId, new JSONObject().put("newPath", p.optString("newPath", "")));
                    break;
                }
                case "vaultMove": {
                    JSONObject p = vaultPayload(payload);
                    String rel = p.optString("path", "");
                    String dir = p.optString("dirPath", "");
                    String base = vaultBaseOf(rel);
                    String target = (dir.isEmpty() ? "" : dir + "/") + base;
                    Storage.vaultRename(a, rel, target);
                    a.cbData(callId, target);
                    break;
                }
                case "vaultTrash": {
                    JSONObject p = vaultPayload(payload);
                    String t = Storage.vaultTrash(a, p.optString("path", ""));
                    a.cbData(callId, new JSONObject().put("trashPath", t));
                    break;
                }
                case "vaultRestore": {
                    JSONObject p = vaultPayload(payload);
                    String o = Storage.vaultRestore(a, p.optString("path", ""));
                    a.cbData(callId, new JSONObject().put("path", o));
                    break;
                }
                case "vaultListTrash": {
                    a.cbData(callId, Storage.vaultListTrash(a));
                    break;
                }
                case "vaultDelete": {
                    JSONObject p = vaultPayload(payload);
                    Storage.vaultDelete(a, p.optString("path", ""));
                    a.cbData(callId, new JSONObject());
                    break;
                }
                case "vaultReadBlob": {
                    JSONObject p = vaultPayload(payload);
                    byte[] bytes = Storage.vaultReadBlobBytes(a, p.optString("path", ""));
                    JSONObject r = new JSONObject();
                    r.put("b64", android.util.Base64.encodeToString(bytes, android.util.Base64.NO_WRAP));
                    r.put("type", Storage.mimeOf(Storage.vaultBase(p.optString("path", ""))));
                    a.cbData(callId, r);
                    break;
                }
                case "vaultWriteAttachment": {
                    JSONObject p = vaultPayload(payload);
                    byte[] bytes = android.util.Base64.decode(p.optString("b64", ""), android.util.Base64.DEFAULT);
                    String rel = Storage.vaultWriteAttachment(a, p.optString("notePath", ""),
                            p.optString("name", "附件"), bytes);
                    a.cbData(callId, new JSONObject().put("path", rel));
                    break;
                }
                case "vaultImportFile": {
                    JSONObject p = vaultPayload(payload);
                    a.cbData(callId, Storage.vaultImportFile(a,
                            p.optString("uri", ""), p.optString("dirPath", "")));
                    break;
                }
                case "vaultBindFolder": {
                    a.launch(callId, new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE),
                            MainActivity.RC_VAULT_BIND);
                    break;
                }
                case "vaultExport": {
                    Intent i = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                    i.addCategory(Intent.CATEGORY_OPENABLE);
                    i.setType("application/zip");
                    i.putExtra(Intent.EXTRA_TITLE, "zhipian-vault-"
                            + new SimpleDateFormat("yyyyMMdd", Locale.getDefault()).format(new Date()) + ".zip");
                    a.launch(callId, i, MainActivity.RC_VAULT_EXPORT);
                    break;
                }
                /* ---------- v16 迁移/附件：旧库附件读取 + 打开/分享/拍照/选文件 ---------- */
                case "loadBlobBytes": {
                    /* 读旧库附件（files/<id>/ 下首个文件），base64 返回，供迁移复制到 vault */
                    String id = new JSONObject(payload).optString("id", "");
                    File f = Storage.findFile(a, id);
                    if (f == null) throw new java.io.IOException("附件不存在：" + id);
                    byte[] bytes = Storage.readAll(f);
                    JSONObject r = new JSONObject();
                    r.put("b64", android.util.Base64.encodeToString(bytes, android.util.Base64.NO_WRAP));
                    r.put("name", f.getName());
                    r.put("size", bytes.length);
                    r.put("type", a.guessMime(f.getName()));
                    a.cbData(callId, r);
                    break;
                }
                case "openWith": {
                    openVaultFile(callId, vaultPayload(payload).optString("path", ""), false);
                    break;
                }
                case "shareFile": {
                    openVaultFile(callId, vaultPayload(payload).optString("path", ""), true);
                    break;
                }
                case "vaultTakePhoto": {
                    /* 系统相机拍照 → 落 vault attachments/<笔记名>/ */
                    a.pendingCameraNote = vaultPayload(payload).optString("notePath", "");
                    File tmp = new File(a.getCacheDir(), "vault_camera_tmp.jpg");
                    Uri out = FileProvider.getUriForFile(a, a.getPackageName() + ".fileprovider", tmp);
                    Intent i = new Intent(android.provider.MediaStore.ACTION_IMAGE_CAPTURE);
                    i.putExtra(android.provider.MediaStore.EXTRA_OUTPUT, out);
                    a.launch(callId, i, MainActivity.RC_VAULT_CAMERA);
                    break;
                }
                case "vaultPickImport": {
                    /* 任意文件/PDF 多选 → 导入 vault 指定目录 */
                    a.pendingVaultDir = vaultPayload(payload).optString("dirPath", "");
                    Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                    i.addCategory(Intent.CATEGORY_OPENABLE);
                    i.setType("*/*");
                    i.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
                    a.launch(callId, i, MainActivity.RC_VAULT_PICK);
                    break;
                }
                default:
                    a.cbErr(callId, "未知方法：" + method);
            }
        } catch (Exception e) {
            a.cbErr(callId, e.getMessage());
        }
    }

    /* payload 容错：无参方法传来空串时给空 JSONObject */
    static JSONObject vaultPayload(String payload) throws Exception {
        return (payload == null || payload.length() == 0) ? new JSONObject() : new JSONObject(payload);
    }
    static String vaultBaseOf(String rel) {
        int i = rel.lastIndexOf('/');
        return i < 0 ? rel : rel.substring(i + 1);
    }

    /* 打开/分享 vault 内文件：私有目录走 FileProvider，SAF 绑定目录直接用 DocumentFile uri */
    void openVaultFile(final String callId, final String vaultRel, final boolean share) {
        try {
            final Uri uri;
            final String mime;
            if (Storage.vaultHasSaf(a)) {
                androidx.documentfile.provider.DocumentFile df =
                        Storage.findRel(Storage.vaultSafRoot(a), vaultRel);
                if (df == null || !df.isFile()) throw new java.io.IOException("文件不存在：" + vaultRel);
                uri = df.getUri();
                mime = a.guessMime(df.getName());
            } else {
                File f = Storage.vaultFile(a, vaultRel);
                if (!f.isFile()) throw new java.io.IOException("文件不存在：" + vaultRel);
                uri = FileProvider.getUriForFile(a, a.getPackageName() + ".fileprovider", f);
                mime = a.guessMime(f.getName());
            }
            a.runOnUiThread(() -> {
                try {
                    Intent i = share ? new Intent(Intent.ACTION_SEND) : new Intent(Intent.ACTION_VIEW);
                    i.setType(mime);
                    if (share) i.putExtra(Intent.EXTRA_STREAM, uri);
                    else i.setDataAndType(uri, mime);
                    i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
                    if (share) i = Intent.createChooser(i, "分享");
                    a.startActivity(i);
                    a.cbData(callId, new JSONObject());
                } catch (ActivityNotFoundException e) {
                    a.cbErr(callId, "没有能处理此文件的应用");
                } catch (Exception e) {
                    a.cbErr(callId, e.getMessage());
                }
            });
        } catch (Exception e) {
            a.cbErr(callId, e.getMessage());
        }
    }

    void openFile(final String callId, final String id) {
        final File f = Storage.findFile(a, id);
        if (f == null) { a.cbErr(callId, "文件不存在"); return; }
        a.runOnUiThread(() -> {
            try {
                Uri uri = FileProvider.getUriForFile(a, a.getPackageName() + ".fileprovider", f);
                Intent intent = new Intent(Intent.ACTION_VIEW);
                String mime = a.guessMime(f.getName());
                intent.setDataAndType(uri, mime);
                intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION
                        | Intent.FLAG_GRANT_WRITE_URI_PERMISSION
                        | Intent.FLAG_ACTIVITY_NEW_TASK);
                a.startActivity(intent);
                a.cbData(callId, new JSONObject());
            } catch (ActivityNotFoundException e) {
                a.cbErr(callId, "没有能打开此文件的应用");
            } catch (Exception e) {
                a.cbErr(callId, e.getMessage());
            }
        });
    }
}
