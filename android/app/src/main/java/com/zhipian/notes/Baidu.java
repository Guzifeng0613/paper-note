package com.zhipian.notes;

import android.content.Context;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileNotFoundException;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 百度网盘手动增量同步。
 *
 * 云端结构（/apps/纸片/）：
 *   manifest.json                 全局清单（便签映射 + 附件清单 + lastSync）
 *   notes/{标题}.json             每个便签一个 JSON，文件名=标题；重名自动 -1/-2
 *   files/{id}/{idx}_{name}       附件，idx 为添加顺序序号，内容按 id 增量
 *
 * 增量：附件只传新增 / 大小变化的，已传跳过；便签 JSON 每次覆盖（小）；
 * 换设备用「从云端恢复」按清单下载，正文图片靠 data-id 回到原位。
 */
class Baidu {
    static final String PAN = "https://pan.baidu.com/rest/2.0/xpan";
    static final String UP = "https://d.pcs.baidu.com/rest/2.0/pcs/superfile2";
    static final String APP_DIR = "/apps/纸片";
    static final int SLICE = 4 * 1024 * 1024;
    static final String UA = "Mozilla/5.0 (Linux; Android) Zhipian";

    interface Listener { void onProgress(int pct, String msg); }

    static class LocalFile {
        String id; String name; long size; File file; String md5;
    }

    /* ---------------- 基础工具 ---------------- */
    static String ue(String s) {
        try { return URLEncoder.encode(s, "UTF-8"); }
        catch (Exception e) { return s; }
    }
    static String hex(byte[] d) {
        StringBuilder sb = new StringBuilder();
        for (byte x : d) {
            sb.append(Character.forDigit((x >> 4) & 0xf, 16));
            sb.append(Character.forDigit(x & 0xf, 16));
        }
        return sb.toString();
    }
    static String pad2(int n) { return (n < 10 ? "0" : "") + n; }
    static String leafOf(String p) { int i = p.lastIndexOf('/'); return p.substring(i + 1); }
    static String safeCloudName(String t) {
        if (t == null) t = "";
        t = t.replaceAll("[\\\\/:*?\"<>|]", "_").trim();
        t = t.replaceAll("[.\\s]+$", "").trim();
        return t.isEmpty() ? "未命名" : t;
    }
    static String cloudFile(String n) {
        if (n == null || n.isEmpty()) return "file";
        return n.replaceAll("[\\\\/:*?\"<>|]", "_");
    }
    static String readResp(HttpURLConnection c) throws IOException {
        int code = c.getResponseCode();
        InputStream is = code >= 400 ? c.getErrorStream() : c.getInputStream();
        if (is == null) return "";
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] buf = new byte[8192]; int n;
        while ((n = is.read(buf)) > 0) out.write(buf, 0, n);
        return out.toString("UTF-8");
    }
    static String get(String urlStr) throws IOException {
        HttpURLConnection c = (HttpURLConnection) new URL(urlStr).openConnection();
        c.setConnectTimeout(20000); c.setReadTimeout(60000);
        c.setInstanceFollowRedirects(true);
        c.setRequestProperty("User-Agent", UA);
        return readResp(c);
    }
    static String postForm(String urlStr, String body) throws IOException {
        HttpURLConnection c = (HttpURLConnection) new URL(urlStr).openConnection();
        c.setConnectTimeout(20000); c.setReadTimeout(60000);
        c.setRequestMethod("POST"); c.setDoOutput(true);
        c.setRequestProperty("Content-Type", "application/x-www-form-urlencoded");
        c.setRequestProperty("User-Agent", UA);
        try (OutputStream os = c.getOutputStream()) {
            os.write(body.getBytes("UTF-8"));
        }
        return readResp(c);
    }
    static void postPart(String urlStr, File part) throws IOException {
        final String b = "----ZP" + Long.toHexString(System.currentTimeMillis());
        HttpURLConnection c = (HttpURLConnection) new URL(urlStr).openConnection();
        c.setConnectTimeout(20000); c.setReadTimeout(180000);
        c.setRequestMethod("POST"); c.setDoOutput(true);
        c.setRequestProperty("Content-Type", "multipart/form-data; boundary=" + b);
        c.setRequestProperty("User-Agent", UA);
        OutputStream os = c.getOutputStream();
        os.write(("--" + b + "\r\n").getBytes("UTF-8"));
        os.write(("Content-Disposition: form-data; name=\"file\"; filename=\"file\"\r\n")
                .getBytes("UTF-8"));
        os.write("Content-Type: application/octet-stream\r\n\r\n".getBytes("UTF-8"));
        try (FileInputStream in = new FileInputStream(part)) {
            byte[] buf = new byte[65536]; int n;
            while ((n = in.read(buf)) > 0) os.write(buf, 0, n);
        }
        os.write(("\r\n--" + b + "--\r\n").getBytes("UTF-8"));
        os.close();
        int rc = c.getResponseCode(); String resp = readResp(c);
        if (rc >= 400) throw new IOException("分片上传失败 " + rc + " " + resp);
    }
    static void copy(File in, File out) throws IOException {
        try (FileInputStream is = new FileInputStream(in);
             FileOutputStream o = new FileOutputStream(out)) {
            byte[] buf = new byte[65536]; int n;
            while ((n = is.read(buf)) > 0) o.write(buf, 0, n);
        }
    }
    static void deleteDir(File f) {
        if (f == null || !f.exists()) return;
        File[] xs = f.listFiles();
        if (xs != null) for (File x : xs) {
            if (x.isDirectory()) deleteDir(x); else x.delete();
        }
        f.delete();
    }

    /* 文件内容 MD5（附件增量按内容校验，避免同大小不同内容漏传） */
    static String fileMd5(File f){
        try {
            MessageDigest md = MessageDigest.getInstance("MD5");
            try (FileInputStream in = new FileInputStream(f)) {
                byte[] buf = new byte[65536]; int n;
                while ((n = in.read(buf)) > 0) md.update(buf, 0, n);
            }
            return hex(md.digest());
        } catch (Exception e) { return ""; }
    }

    /* ---------------- 本地附件清单 ---------------- */
    static List<LocalFile> localFiles(Context c) {
        List<LocalFile> out = new ArrayList<>();
        File files = new File(Storage.root(c), "files");
        File[] ids = files.listFiles();
        if (ids != null) for (File id : ids) {
            File[] fs = id.listFiles();
            if (fs != null && fs.length > 0) {
                File f = fs[0];
                LocalFile lf = new LocalFile();
                lf.id = id.getName(); lf.file = f;
                lf.name = f.getName(); lf.size = f.length();
                out.add(lf);
            }
        }
        return out;
    }

    /* ---------------- 单文件上传（自动分片） ---------------- */
    static void uploadOneFile(Context c, String token, String remotePath, File file)
            throws Exception {
        File pdir = new File(c.getCacheDir(), "zp_parts_" + Math.abs(remotePath.hashCode()));
        deleteDir(pdir); pdir.mkdirs();
        List<String> hashes = new ArrayList<>();
        List<File> parts = new ArrayList<>();
        MessageDigest md = MessageDigest.getInstance("MD5");
        try (FileInputStream in = new FileInputStream(file)) {
            byte[] buf = new byte[SLICE]; int n, idx = 0;
            while ((n = in.read(buf)) > 0) {
                md.reset(); md.update(buf, 0, n);
                hashes.add(hex(md.digest()));
                File pf = new File(pdir, "p" + idx);
                try (FileOutputStream o = new FileOutputStream(pf)) {
                    o.write(buf, 0, n);
                }
                parts.add(pf); idx++;
            }
        }
        JSONArray bl = new JSONArray();
        for (String h : hashes) bl.put(h);
        String blockJson = bl.toString();

        JSONObject pc = new JSONObject(postForm(
                PAN + "/file?method=precreate&access_token=" + ue(token),
                "path=" + ue(remotePath) + "&size=" + file.length()
                        + "&isdir=0&autoinit=1&block_list=" + ue(blockJson)));
        if (pc.optInt("errno", -1) != 0)
            throw new IOException("预上传失败：" + pc);
        if (pc.optInt("return_type") == 2) { deleteDir(pdir); return; }
        String uploadid = pc.optString("uploadid");

        for (int i = 0; i < parts.size(); i++) {
            postPart(UP + "?method=upload&access_token=" + ue(token)
                    + "&type=tmpfile&partseq=" + i
                    + "&path=" + ue(remotePath)
                    + "&uploadid=" + ue(uploadid), parts.get(i));
        }
        JSONObject cr = new JSONObject(postForm(
                PAN + "/file?method=create&access_token=" + ue(token),
                "path=" + ue(remotePath) + "&size=" + file.length()
                        + "&isdir=0&block_list=" + ue(blockJson)
                        + "&uploadid=" + ue(uploadid) + "&rtype=1"));
        if (cr.optInt("errno", -1) != 0)
            throw new IOException("创建文件失败：" + cr);
        deleteDir(pdir);
    }

    /* ---------------- 单文件下载（按路径） ---------------- */
    static File downloadByPath(Context c, String token, String remotePath)
            throws Exception {
        int s = remotePath.lastIndexOf('/');
        String dir = remotePath.substring(0, s);
        String name = remotePath.substring(s + 1);
        String ls = get(PAN + "/file?method=list&dir=" + ue(dir)
                + "&access_token=" + ue(token));
        JSONArray arr = new JSONObject(ls).optJSONArray("list");
        long fsid = -1;
        if (arr != null) for (int i = 0; i < arr.length(); i++) {
            JSONObject f = arr.getJSONObject(i);
            if (name.equals(f.optString("server_filename"))) {
                fsid = f.getLong("fs_id"); break;
            }
        }
        if (fsid < 0) throw new FileNotFoundException("云端文件不存在：" + remotePath);

        String fm = get(PAN + "/multimedia?method=filemetas&access_token=" + ue(token)
                + "&fsids=[" + fsid + "]&dlink=1");
        JSONArray fl = new JSONObject(fm).optJSONArray("list");
        if (fl == null || fl.length() == 0) throw new IOException("获取下载链接失败");
        String dlink = fl.getJSONObject(0).optString("dlink");
        if (dlink == null || dlink.isEmpty()) throw new IOException("无下载链接");
        String dl = dlink.startsWith("//") ? "https:" + dlink : dlink;
        dl += (dl.contains("?") ? "&" : "?") + "access_token=" + ue(token);

        File out = new File(c.getCacheDir(), "zp_dl_" + Math.abs(remotePath.hashCode()));
        HttpURLConnection hc = (HttpURLConnection) new URL(dl).openConnection();
        hc.setConnectTimeout(20000); hc.setReadTimeout(180000);
        hc.setInstanceFollowRedirects(true);
        hc.setRequestProperty("User-Agent", UA);
        int code = hc.getResponseCode();
        if (code >= 400) throw new IOException("下载失败 " + code);
        try (InputStream is = hc.getInputStream();
             FileOutputStream o = new FileOutputStream(out)) {
            byte[] buf = new byte[65536]; int n;
            while ((n = is.read(buf)) > 0) o.write(buf, 0, n);
        }
        return out;
    }
    static String downloadTextByPath(Context c, String token, String path) {
        try {
            File f = downloadByPath(c, token, path);
            byte[] b = Storage.readAll(f);
            f.delete();
            return new String(b, "UTF-8");
        } catch (Exception e) {
            return null;
        }
    }
    static JSONArray listDirSafe(Context c, String token, String dir) {
        try {
            String s = get(PAN + "/file?method=list&dir=" + ue(dir)
                    + "&access_token=" + ue(token));
            return new JSONObject(s).optJSONArray("list");
        } catch (Exception e) { return null; }
    }
    static void deleteFiles(Context c, String token, List<String> paths) throws Exception {
        JSONArray arr = new JSONArray();
        for (String p : paths) arr.put(p);
        JSONObject r = new JSONObject(postForm(
                PAN + "/file?method=filemanager&opera=delete&access_token=" + ue(token),
                "async=0&filelist=" + ue(arr.toString())));
        if (r.optInt("errno", -1) != 0)
            throw new IOException("删除失败：" + r);
    }

    /* ---------------- 推送（本机 → 云端） ---------------- */
    static JSONObject push(Context c, String token, Listener L) throws Exception {
        if (L != null) L.onProgress(2, "读取云端清单");
        String ms = downloadTextByPath(c, token, APP_DIR + "/manifest.json");
        JSONObject manifest = ms == null ? new JSONObject() : new JSONObject(ms);
        JSONObject oldNotes = manifest.optJSONObject("notes");
        if (oldNotes == null) oldNotes = new JSONObject();
        JSONObject oldFiles = manifest.optJSONObject("files");
        if (oldFiles == null) oldFiles = new JSONObject();

        File libFile = new File(Storage.root(c), "library.json");
        if (!libFile.exists()) throw new IOException("本地还没有数据");
        JSONObject lib = new JSONObject(new String(Storage.readAll(libFile), "UTF-8"));
        JSONArray libNotes = lib.getJSONArray("notes");

        List<JSONObject> live = new ArrayList<>();
        for (int i = 0; i < libNotes.length(); i++) {
            JSONObject n = libNotes.getJSONObject(i);
            if (!n.optBoolean("trashed")) live.add(n);
        }
        live.sort((a, b) -> Long.compare(
                a.optLong("createdAt", a.optLong("updatedAt")),
                b.optLong("createdAt", b.optLong("updatedAt"))));

        Set<String> cloudNotes = new HashSet<>();
        JSONArray cn = listDirSafe(c, token, APP_DIR + "/notes");
        if (cn != null) for (int i = 0; i < cn.length(); i++)
            cloudNotes.add(cn.getJSONObject(i).optString("server_filename"));

        if (L != null) L.onProgress(8, "同步笔记内容");
        Set<String> used = new HashSet<>();
        Map<String, String> idToFile = new HashMap<>();
        List<String> toDelete = new ArrayList<>();
        int noteSkipped = 0;
        for (JSONObject n : live) {
            String id = n.optString("id"), title = n.optString("title", "");
            JSONObject oldRec = oldNotes.optJSONObject(id);
            String oldF = oldRec != null ? oldRec.optString("file", null) : null;
            String oldTitle = oldRec != null ? oldRec.optString("title", null) : null;
            /* 未修改：标题与 updatedAt 一致、云端文件仍在 → 完全跳过，不重传 */
            boolean unchanged = oldF != null && title.equals(oldTitle)
                    && oldRec.optLong("updatedAt") == n.optLong("updatedAt")
                    && cloudNotes.contains(leafOf(oldF))
                    && !used.contains(leafOf(oldF));
            String file;
            if (unchanged) {
                file = oldF; noteSkipped++;
            } else {
                String base = safeCloudName(title);
                int k = 0; String leaf = base + ".json";
                while (used.contains(leaf)
                        || (cloudNotes.contains(leaf) && !("notes/" + leaf).equals(oldF))) {
                    k++; leaf = base + "-" + k + ".json";
                }
                file = "notes/" + leaf;
                File tmp = File.createTempFile("note", ".json", c.getCacheDir());
                try (FileOutputStream o = new FileOutputStream(tmp)) {
                    o.write(n.toString().getBytes("UTF-8"));
                }
                uploadOneFile(c, token, APP_DIR + "/" + file, tmp);
                tmp.delete();
                if (oldF != null && !oldF.equals(file)) toDelete.add(APP_DIR + "/" + oldF);
            }
            used.add(leafOf(file));
            idToFile.put(id, file);
        }
        Set<String> liveIds = new HashSet<>();
        for (JSONObject n : live) liveIds.add(n.optString("id"));
        /* 永久删除墓碑：只有墓碑里的便签才从云端删除；
           回收站中（未永久删）与云端独有（非墓碑）的一律保留，避免误删 */
        Set<String> tombs = new HashSet<>();
        JSONArray tarr = lib.optJSONArray("cloudDeleted");
        if (tarr != null) for (int i=0;i<tarr.length();i++) tombs.add(tarr.optString(i));
        Iterator<String> oit = oldNotes.keys();
        while (oit.hasNext()) {
            String id = oit.next();
            if (!liveIds.contains(id) && tombs.contains(id)) {
                String f = oldNotes.getJSONObject(id).optString("file", null);
                if (f != null) toDelete.add(APP_DIR + "/" + f);
            }
        }

        if (L != null) L.onProgress(45, "检查附件");
        Map<String, JSONObject> metaById = new HashMap<>();
        for (JSONObject n : live) {
            JSONArray fs = n.optJSONArray("files");
            if (fs != null) for (int i = 0; i < fs.length(); i++) {
                JSONObject f = fs.getJSONObject(i);
                metaById.put(f.optString("id"), f);
            }
        }
        List<LocalFile> locals = new ArrayList<>();
        for (LocalFile lf : localFiles(c))
            if (metaById.containsKey(lf.id)) locals.add(lf);
        List<LocalFile> need = new ArrayList<>();
        int skipped = 0;
        for (LocalFile lf : locals) {
            JSONObject oldR = oldFiles.optJSONObject(lf.id);
            String lm = fileMd5(lf.file); lf.md5 = lm;
            if (oldR != null && oldR.optLong("size") == lf.size
                    && (oldR.optString("md5").isEmpty() || oldR.optString("md5").equals(lm)))
                skipped++;
            else need.add(lf);
        }
        int done = 0;
        for (LocalFile lf : need) {
            JSONObject mm = metaById.get(lf.id);
            int idx = mm != null ? mm.optInt("idx", 1) : 1;
            String remote = "files/" + lf.id + "/" + pad2(idx) + "_" + cloudFile(lf.name);
            if (L != null) L.onProgress(50 + (int) (40.0 * done / Math.max(1, need.size())),
                    "上传附件 " + lf.name);
            uploadOneFile(c, token, APP_DIR + "/" + remote, lf.file);
            done++;
        }

        if (!toDelete.isEmpty()) {
            if (L != null) L.onProgress(92, "清理旧文件");
            deleteFiles(c, token, toDelete);
        }

        JSONObject newNotes = new JSONObject();
        for (JSONObject n : live) {
            String id = n.optString("id");
            JSONObject r = new JSONObject();
            r.put("file", idToFile.get(id));
            r.put("title", n.optString("title", ""));
            r.put("updatedAt", n.optLong("updatedAt"));
            newNotes.put(id, r);
        }
        JSONObject newFiles = new JSONObject();
        for (LocalFile lf : locals) {
            JSONObject mm = metaById.get(lf.id);
            JSONObject r = new JSONObject();
            r.put("name", lf.name); r.put("size", lf.size);
            r.put("idx", mm != null ? mm.optInt("idx", 1) : 1);
            r.put("md5", lf.md5 != null ? lf.md5 : fileMd5(lf.file));
            newFiles.put(lf.id, r);
        }
        long now = System.currentTimeMillis();
        JSONObject nm = new JSONObject();
        nm.put("app", "zhipian-notes"); nm.put("version", 2);
        nm.put("lastSync", now);
        nm.put("notes", newNotes); nm.put("files", newFiles);
        File mf = File.createTempFile("manifest", ".json", c.getCacheDir());
        try (FileOutputStream o = new FileOutputStream(mf)) {
            o.write(nm.toString().getBytes("UTF-8"));
        }
        if (L != null) L.onProgress(96, "更新清单");
        uploadOneFile(c, token, APP_DIR + "/manifest.json", mf);
        mf.delete();

        JSONObject res = new JSONObject();
        res.put("added", need.size()); res.put("skipped", skipped);
        res.put("noteSkipped", noteSkipped);
        res.put("notes", live.size()); res.put("lastSync", now);
        if (L != null) L.onProgress(100, "同步完成");
        return res;
    }

    /* ---------------- 拉取（云端 → 本机，一键恢复） ---------------- */
    static JSONObject pull(Context c, String token, Listener L) throws Exception {
        if (L != null) L.onProgress(3, "读取云端清单");
        String ms = downloadTextByPath(c, token, APP_DIR + "/manifest.json");
        if (ms == null) throw new IOException("云端没有备份，请先在某台设备同步一次");
        JSONObject manifest = new JSONObject(ms);
        JSONObject upFiles = manifest.optJSONObject("files");

        int downloaded = 0, skipped = 0;
        if (upFiles != null) {
            List<String> ids = new ArrayList<>();
            Iterator<String> it = upFiles.keys();
            while (it.hasNext()) ids.add(it.next());
            int done = 0;
            for (String id : ids) {
                JSONObject rec = upFiles.getJSONObject(id);
                File dir = new File(new File(Storage.root(c), "files"), id);
                File[] have = dir.listFiles();
                if (have != null && have.length > 0) { skipped++; continue; }
                int idx = rec.optInt("idx", 1);
                String name = rec.optString("name", "file");
                String remote = "files/" + id + "/" + pad2(idx) + "_" + cloudFile(name);
                if (L != null) L.onProgress(5 + (int) (70.0 * done / Math.max(1, ids.size())),
                        "下载附件 " + name);
                File f = null;
                try { f = downloadByPath(c, token, APP_DIR + "/" + remote); }
                catch (FileNotFoundException nf) { f = null; }
                if (f != null) {
                    File localDir = Storage.fileDir(c, id);
                    File dest = new File(localDir, Storage.sanitize(name));
                    copy(f, dest); f.delete();
                    downloaded++;
                }
                done++;
            }
        }

        if (L != null) L.onProgress(82, "恢复笔记内容");
        JSONArray notesArr = new JSONArray();
        JSONObject upNotes = manifest.optJSONObject("notes");
        if (upNotes != null) {
            Iterator<String> it = upNotes.keys();
            while (it.hasNext()) {
                String id = it.next();
                String file = upNotes.getJSONObject(id).optString("file", null);
                if (file == null) continue;
                String txt = downloadTextByPath(c, token, APP_DIR + "/" + file);
                if (txt != null) notesArr.put(new JSONObject(txt));
            }
        }

        JSONObject res = new JSONObject();
        res.put("downloaded", downloaded); res.put("skipped", skipped);
        res.put("notes", notesArr);
        res.put("lastSync", manifest.optLong("lastSync"));
        if (L != null) L.onProgress(100, "恢复完成");
        return res;
    }

    /* ---------------- 双向合并同步 ----------------
       规则（用户指定）：
       · 云端有、本地无 → 下载到本地（云端更全则补本地）；
       · 本地有、云端无 → 上传；
       · 同 id 内容有出入 → 一律以本地为准，覆盖云端；
       · 完全一致 → 跳过。附件按 id 同样处理。 */
    static JSONObject mergeSync(Context c, String token, Listener L) throws Exception {
        if (L != null) L.onProgress(2, "读取云端清单");
        String ms = downloadTextByPath(c, token, APP_DIR + "/manifest.json");
        JSONObject manifest = ms == null ? new JSONObject() : new JSONObject(ms);
        JSONObject oldNotes = manifest.optJSONObject("notes"); if (oldNotes==null) oldNotes=new JSONObject();
        JSONObject oldFiles = manifest.optJSONObject("files"); if (oldFiles==null) oldFiles=new JSONObject();

        File libFile = new File(Storage.root(c), "library.json");
        if (!libFile.exists()) throw new IOException("本地还没有数据");
        JSONObject lib = new JSONObject(new String(Storage.readAll(libFile), "UTF-8"));
        JSONArray libNotes = lib.getJSONArray("notes");

        Map<String,JSONObject> localById = new java.util.LinkedHashMap<>();
        for (int i=0;i<libNotes.length();i++){
            JSONObject n=libNotes.getJSONObject(i);
            if(!n.optBoolean("trashed")) localById.put(n.optString("id"), n);
        }

        /* 永久删除墓碑：墓碑里的云端笔记不下载、直接删，避免永久删除后被同步“复活” */
        Set<String> tombs = new HashSet<>();
        JSONArray tarr = lib.optJSONArray("cloudDeleted");
        if (tarr != null) for (int i=0;i<tarr.length();i++) tombs.add(tarr.optString(i));

        /* A. 云端独有笔记 → 下载到本地（墓碑里的除外，记入待删除） */
        if (L != null) L.onProgress(10, "对比笔记");
        List<JSONObject> cloudOnly = new ArrayList<>();
        List<String> cloudDeletes = new ArrayList<>();
        Iterator<String> cit = oldNotes.keys();
        while(cit.hasNext()){
            String id=cit.next();
            if(localById.containsKey(id))continue;
            String file=oldNotes.getJSONObject(id).optString("file",null);
            if(file==null)continue;
            if(tombs.contains(id)){ cloudDeletes.add(APP_DIR+"/"+file); continue; }
            String txt=downloadTextByPath(c,token,APP_DIR+"/"+file);
            if(txt!=null){
                JSONObject n=new JSONObject(txt);
                n.put("trashed",false);
                cloudOnly.add(n);
            }
        }
        int pulledNotes=cloudOnly.size();
        for(JSONObject n:cloudOnly)localById.put(n.optString("id"),n);

        /* B. 同步后全部笔记引用的附件；本地缺失且云端有 → 下载 */
        if (L != null) L.onProgress(28, "检查云端附件");
        Map<String,JSONObject> metaById=new HashMap<>();
        for(JSONObject n:localById.values()){
            JSONArray fs=n.optJSONArray("files");
            if(fs!=null)for(int i=0;i<fs.length();i++){
                JSONObject f=fs.getJSONObject(i);metaById.put(f.optString("id"),f);
            }
        }
        int dlFiles=0;
        for(Map.Entry<String,JSONObject> e:metaById.entrySet()){
            String id=e.getKey();JSONObject mm=e.getValue();
            File dir=new File(new File(Storage.root(c),"files"),id);
            File[] have=dir.listFiles();
            if(have!=null&&have.length>0)continue;
            JSONObject cr=oldFiles.optJSONObject(id);
            int idx=mm.optInt("idx",cr!=null?cr.optInt("idx",1):1);
            String name=mm.optString("name",cr!=null?cr.optString("name","file"):"file");
            String remote="files/"+id+"/"+pad2(idx)+"_"+cloudFile(name);
            File f=null;
            try{f=downloadByPath(c,token,APP_DIR+"/"+remote);}
            catch(FileNotFoundException nf){f=null;} /* 云端也没有：跳过，稍后本地上传阶段处理 */
            if(f!=null){
                File dest=new File(Storage.fileDir(c,id),Storage.sanitize(name));
                copy(f,dest);f.delete();dlFiles++;
            }
        }

        /* C. 上传笔记：本地独有→新增；同 id updatedAt/标题不同→以本地覆盖 */
        if (L != null) L.onProgress(55, "上传笔记改动");
        Set<String> cloudLeafs=new HashSet<>();
        Iterator<String> it0=oldNotes.keys();
        while(it0.hasNext()){
            String id=it0.next();
            String f=oldNotes.getJSONObject(id).optString("file",null);
            if(f!=null)cloudLeafs.add(leafOf(f));
        }
        Map<String,String> idToFile=new HashMap<>();
        List<String> toDelete=new ArrayList<>();
        int upNotes=0,noteSkip=0;
        List<JSONObject> ordered=new ArrayList<>(localById.values());
        ordered.sort((a,b)->Long.compare(a.optLong("createdAt",a.optLong("updatedAt")),
                                          b.optLong("createdAt",b.optLong("updatedAt"))));
        Set<String> usedLeaf=new HashSet<>();
        for(JSONObject n:ordered){
            String id=n.optString("id");
            JSONObject oldRec=oldNotes.optJSONObject(id);
            String oldF=oldRec!=null?oldRec.optString("file",null):null;
            boolean same=oldRec!=null&&oldF!=null
                &&oldRec.optLong("updatedAt")==n.optLong("updatedAt")
                &&n.optString("title","").equals(oldRec.optString("title",""))
                &&cloudLeafs.contains(leafOf(oldF));
            if(same){idToFile.put(id,oldF);usedLeaf.add(leafOf(oldF));noteSkip++;continue;}
            String base=safeCloudName(n.optString("title",""));
            int k=0;String leaf=base+".json";
            while(usedLeaf.contains(leaf)||(cloudLeafs.contains(leaf)&&!("notes/"+leaf).equals(oldF))){
                k++;leaf=base+"-"+k+".json";
            }
            String file="notes/"+leaf;
            File tmp=File.createTempFile("note",".json",c.getCacheDir());
            try(FileOutputStream o=new FileOutputStream(tmp)){o.write(n.toString().getBytes("UTF-8"));}
            uploadOneFile(c,token,APP_DIR+"/"+file,tmp);tmp.delete();
            if(oldF!=null&&!oldF.equals(file))toDelete.add(APP_DIR+"/"+oldF);
            idToFile.put(id,file);usedLeaf.add(leaf);upNotes++;
        }

        /* D. 上传附件：本地有、云端无或大小不同 → 覆盖上传 */
        if (L != null) L.onProgress(78, "上传附件改动");
        List<LocalFile> locals=new ArrayList<>();
        for(LocalFile lf:localFiles(c))if(metaById.containsKey(lf.id))locals.add(lf);
        int upFiles=0,fileSkip=0,fdone=0;
        for(LocalFile lf:locals){
            JSONObject oldR=oldFiles.optJSONObject(lf.id);
            String lm=fileMd5(lf.file);lf.md5=lm;
            if(oldR!=null&&oldR.optLong("size")==lf.size
                &&(oldR.optString("md5").isEmpty()||oldR.optString("md5").equals(lm))){fileSkip++;continue;}
            JSONObject mm=metaById.get(lf.id);
            int idx=mm!=null?mm.optInt("idx",1):1;
            String remote="files/"+lf.id+"/"+pad2(idx)+"_"+cloudFile(lf.name);
            if(L!=null)L.onProgress(78+(int)(14.0*fdone/Math.max(1,locals.size())),"上传附件 "+lf.name);
            uploadOneFile(c,token,APP_DIR+"/"+remote,lf.file);
            fdone++;upFiles++;
        }

        List<String> allDelete=new ArrayList<>(toDelete);
        allDelete.addAll(cloudDeletes);
        if(!allDelete.isEmpty()){
            if(L!=null)L.onProgress(93,"清理旧文件");
            deleteFiles(c,token,allDelete);
        }

        /* E. 云端独有笔记并入本地 library.json */
        if(pulledNotes>0){
            for(JSONObject n:cloudOnly)libNotes.put(n);
            try(FileOutputStream o=new FileOutputStream(libFile)){
                o.write(lib.toString().getBytes("UTF-8"));
            }
        }

        /* F. 写回新 manifest */
        JSONObject newNotes=new JSONObject();
        for(JSONObject n:ordered){
            String id=n.optString("id");
            JSONObject r=new JSONObject();
            r.put("file",idToFile.get(id));r.put("title",n.optString("title",""));
            r.put("updatedAt",n.optLong("updatedAt"));
            newNotes.put(id,r);
        }
        JSONObject newFiles=new JSONObject();
        for(LocalFile lf:locals){
            JSONObject mm=metaById.get(lf.id);
            JSONObject r=new JSONObject();
            r.put("name",lf.name);r.put("size",lf.size);
            r.put("idx",mm!=null?mm.optInt("idx",1):1);
            r.put("md5",lf.md5!=null?lf.md5:fileMd5(lf.file));
            newFiles.put(lf.id,r);
        }
        /* 同步最终状态到本地绑定目录（SAF），保证仓库与云端一致 */
        try { Storage.forceSync(c); } catch (Exception se) {}
        long now=System.currentTimeMillis();
        JSONObject nm=new JSONObject();
        nm.put("app","zhipian-notes");nm.put("version",2);nm.put("lastSync",now);
        nm.put("notes",newNotes);nm.put("files",newFiles);
        File mf=File.createTempFile("manifest",".json",c.getCacheDir());
        try(FileOutputStream o=new FileOutputStream(mf)){o.write(nm.toString().getBytes("UTF-8"));}
        if(L!=null)L.onProgress(97,"更新清单");
        uploadOneFile(c,token,APP_DIR+"/manifest.json",mf);mf.delete();

        JSONObject res=new JSONObject();
        res.put("pulledNotes",pulledNotes);res.put("dlFiles",dlFiles);
        res.put("upNotes",upNotes);res.put("upFiles",upFiles);
        res.put("noteSkip",noteSkip);res.put("fileSkip",fileSkip);
        res.put("notes",ordered.size());res.put("lastSync",now);
        if(L!=null)L.onProgress(100,"同步完成");
        return res;
    }
}
