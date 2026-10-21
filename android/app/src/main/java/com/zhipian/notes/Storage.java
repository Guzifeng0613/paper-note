package com.zhipian.notes;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.database.Cursor;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.Rect;
import android.net.Uri;
import android.provider.OpenableColumns;
import androidx.documentfile.provider.DocumentFile;

import org.json.JSONObject;
import org.json.JSONArray;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Enumeration;
import java.util.Iterator;
import java.util.zip.ZipEntry;
import java.util.zip.ZipFile;
import java.util.zip.ZipOutputStream;

class Storage {
    private static final String SP = "zhipian", KEY_TREE = "tree";
    /* 资料库目录结构（中文命名、条理清晰，便于人工查看与迁移） */
    static final String D_DATA="数据", D_FILES="附件", D_EXPORT="导出", D_NOTES="便签";
    static final String E_BACKUP="备份", E_KB="知识库包", E_SHOT="长截图",
        E_PDF="PDF", E_JSON="JSON", E_CHUNK="切片", E_MD="Markdown";

    /* ---------- 目录 ---------- */
    static File root(Context c) {
        File f = new File(c.getFilesDir(), "library");
        new File(f, "files").mkdirs();
        return f;
    }
    static File fileDir(Context c, String id) {
        File f = new File(new File(root(c), "files"), id);
        f.mkdirs();
        return f;
    }
    /* 在指定附件根目录下取/建 id 目录（导入先落临时根，校验通过再整体替换） */
    static File fileDirIn(File filesRoot, String id) {
        File f = new File(filesRoot, id);
        f.mkdirs();
        return f;
    }
    /* 原子替换目录：newDir 就位后才删除 oldDir；rename 失败则逐文件拷贝兜底 */
    static void replaceDir(File oldDir, File newDir) {
        deleteRecursively(oldDir);
        if (newDir.renameTo(oldDir)) return;
        oldDir.mkdirs();
        File[] xs = newDir.listFiles();
        if (xs != null) for (File x : xs) {
            File t = new File(oldDir, x.getName());
            if (x.isDirectory()) { copyTree(x, t); }
            else {
                try (FileInputStream in = new FileInputStream(x);
                     FileOutputStream o = new FileOutputStream(t)) {
                    byte[] buf = new byte[65536]; int n;
                    while ((n = in.read(buf)) > 0) o.write(buf, 0, n);
                } catch (Exception ignore) {}
            }
        }
        deleteRecursively(newDir);
    }
    static void copyTree(File src, File dst) {
        dst.mkdirs();
        File[] xs = src.listFiles();
        if (xs == null) return;
        for (File x : xs) {
            File t = new File(dst, x.getName());
            if (x.isDirectory()) copyTree(x, t);
            else try (FileInputStream in = new FileInputStream(x);
                      FileOutputStream o = new FileOutputStream(t)) {
                byte[] buf = new byte[65536]; int n;
                while ((n = in.read(buf)) > 0) o.write(buf, 0, n);
            } catch (Exception ignore) {}
    }
    }
    static String sanitize(String n) {
        return n == null ? "file" : n.replaceAll("[\\\\/:*?\"<>|]", "_");
    }
    static void deleteRecursively(File f) {
        if (f != null && f.isDirectory()) {
            File[] xs = f.listFiles();
            if (xs != null) for (File x : xs) deleteRecursively(x);
        }
        if (f != null) f.delete();
    }

    /* ---------- 字节 / 文本 ---------- */
    static byte[] readAll(File f) throws IOException {
        try (FileInputStream in = new FileInputStream(f);
             ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            byte[] buf = new byte[8192]; int n;
            while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
            return out.toByteArray();
        }
    }
    static byte[] readAll(InputStream in) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] buf = new byte[65536]; int n;
        while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
        return out.toByteArray();
    }
    static String loadMeta(Context c) throws IOException {
        File f = new File(root(c), "library.json");
        if (!f.exists()) return null;
        return new String(readAll(f), StandardCharsets.UTF_8);
    }
    static void saveMeta(Context c, String json) throws IOException {
        json = reconcile(c, json);
        File f = new File(root(c), "library.json");
        f.getParentFile().mkdirs();
        try (FileOutputStream o = new FileOutputStream(f)) {
            o.write(json.getBytes(StandardCharsets.UTF_8));
        }
    }
    /* 一致性自愈：移除"有 meta、无物理文件"的派生 md（重新 OCR 可再生成），
       避免同步/导出引用幽灵文件；原始附件物理缺失则保留（可从备份恢复） */
    static String reconcile(Context c, String json) {
        try {
            JSONObject lib = new JSONObject(json);
            JSONArray notes = lib.optJSONArray("notes");
            if (notes == null) return json;
            File filesRoot = new File(root(c), "files");
            boolean changed = false;
            for (int i = 0; i < notes.length(); i++) {
                JSONObject n = notes.getJSONObject(i);
                JSONArray fs = n.optJSONArray("files");
                if (fs == null) continue;
                JSONArray kept = new JSONArray();
                for (int j = 0; j < fs.length(); j++) {
                    JSONObject f = fs.getJSONObject(j);
                    File dir = new File(filesRoot, f.optString("id"));
                    File[] have = dir.listFiles();
                    boolean phys = have != null && have.length > 0;
                    if (!phys && f.optBoolean("hidden", false)
                            && "md".equals(f.optString("kind"))) { changed = true; continue; }
                    kept.put(f);
                }
                if (kept.length() != fs.length()) { n.put("files", kept); changed = true; }
            }
            return changed ? lib.toString() : json;
        } catch (Exception e) { return json; }
    }

    /* ---------- 附件落盘 ---------- */
    static File copyUri(Context c, Uri uri, String id, String name) throws IOException {
        File dir = fileDir(c, id);
        File[] old = dir.listFiles();
        if (old != null) for (File x : old) x.delete();
        File out = new File(dir, sanitize(name));
        try (InputStream in = c.getContentResolver().openInputStream(uri);
             FileOutputStream o = new FileOutputStream(out)) {
            if (in == null) throw new IOException("无法读取所选文件");
            byte[] buf = new byte[65536]; int n;
            while ((n = in.read(buf)) > 0) o.write(buf, 0, n);
        }
        filesDirty = true;
        return out;
    }
    static File writeDataUrl(Context c, String id, String name, String dataUrl) throws IOException {
        int comma = dataUrl.indexOf(',');
        byte[] bytes = android.util.Base64.decode(dataUrl.substring(comma + 1), android.util.Base64.DEFAULT);
        File dir = fileDir(c, id);
        File[] old = dir.listFiles();
        if (old != null) for (File x : old) x.delete();
        File out = new File(dir, sanitize(name));
        try (FileOutputStream o = new FileOutputStream(out)) { o.write(bytes); }
        filesDirty = true;
        return out;
    }
    static File findFile(Context c, String id) {
        File dir = new File(new File(root(c), "files"), id);
        File[] fs = dir.listFiles();
        return (fs == null || fs.length == 0) ? null : fs[0];
    }
    static Uri contentUri(Context c, String id) throws IOException {
        File f = findFile(c, id);
        if (f == null) throw new IOException("文件不存在：" + id);
        return androidx.core.content.FileProvider.getUriForFile(
                c, c.getPackageName() + ".fileprovider", f);
    }
    static void deleteId(Context c, String id) {
        deleteRecursively(new File(new File(root(c), "files"), id));
        filesDirty = true;
    }
    static String displayName(Context c, Uri uri) {
        String result = null;
        try (Cursor cur = c.getContentResolver().query(uri,
                new String[]{OpenableColumns.DISPLAY_NAME}, null, null, null)) {
            if (cur != null && cur.moveToFirst()) result = cur.getString(0);
        } catch (Exception e) { /* ignore */ }
        return result;
    }
    static String mimeOf(String n) {
        n = n.toLowerCase();
        if (n.endsWith(".pdf")) return "application/pdf";
        if (n.endsWith(".json")) return "application/json";
        if (n.endsWith(".jpg") || n.endsWith(".jpeg")) return "image/jpeg";
        if (n.endsWith(".png")) return "image/png";
        if (n.endsWith(".xlsx"))
            return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
        if (n.endsWith(".xls")) return "application/vnd.ms-excel";
        if (n.endsWith(".docx"))
            return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
        if (n.endsWith(".doc")) return "application/msword";
        return "application/octet-stream";
    }

    /* ---------- SAF 绑定目录 ---------- */
    static SharedPreferences sp(Context c) {
        return c.getSharedPreferences(SP, Context.MODE_PRIVATE);
    }
    static void bindTree(Context c, Uri treeUri) {
        try {
            c.getContentResolver().takePersistableUriPermission(treeUri,
                    Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
        } catch (Exception e) { /* ignore */ }
        sp(c).edit().putString(KEY_TREE, treeUri.toString()).apply();
    }
    static Uri boundTree(Context c) {
        String s = sp(c).getString(KEY_TREE, null);
        return s == null ? null : Uri.parse(s);
    }
    /* 时间戳命名：名称-YYYYMMdd-HHmmss.ext（可排序、避免重名） */
    static String tsFileName(String base, String ext){
        java.text.SimpleDateFormat f=new java.text.SimpleDateFormat("yyyyMMdd-HHmmss");
        String b=(base==null)?"":sanitize(base).trim();
        if(b.isEmpty())b="便签";
        return b+"-"+f.format(new java.util.Date())+ext;
    }
    /* 导出分类目录：根/导出/{分类} */
    static DocumentFile exportCatDir(Context c, Uri tree, String cat){
        DocumentFile root=DocumentFile.fromTreeUri(c,tree);
        return ensureDir(ensureDir(root,D_EXPORT),cat);
    }
    /* 通用字节导出（如长截图）：绑定目录→写 导出/{cat}/，返回路径；未绑定→null */
    static String writeExport(Context c, String cat, String name, String mime, byte[] bytes) throws Exception {
        Uri t=boundTree(c);
        if(t==null)return null;
        DocumentFile dir=exportCatDir(c,t,cat);
        DocumentFile old=dir.findFile(name);if(old!=null)old.delete();
        DocumentFile f=createFileRobust(dir,mime,name);
        try(OutputStream o=c.getContentResolver().openOutputStream(f.getUri())){o.write(bytes);}
        return D_EXPORT+"/"+cat+"/"+f.getName();
    }
    static DocumentFile ensureDir(DocumentFile parent, String name) {
        DocumentFile ex = parent.findFile(name);
        if (ex != null && ex.isDirectory()) return ex;
        return parent.createDirectory(name);
    }
    static DocumentFile writeDoc(Context c, DocumentFile dir, String name, String mime, byte[] bytes) throws IOException {
        DocumentFile ex = dir.findFile(name);
        if (ex != null) ex.delete();
        DocumentFile f = createFileRobust(dir, mime, name);
        try (OutputStream o = c.getContentResolver().openOutputStream(f.getUri())) {
            o.write(bytes);
        }
        return f;
    }
    /* 健壮建文件：多 MIME 兜底 + 短暂重试；彻底失败抛错（不静默） */
    static DocumentFile createFileRobust(DocumentFile dir, String mime, String name) {
        DocumentFile f = dir.createFile(mime, name);
        if (f == null) f = dir.createFile("application/octet-stream", name);
        if (f == null) {
            try { Thread.sleep(120); } catch (Exception ignore) {}
            f = dir.createFile(mime, name);
        }
        if (f == null) throw new RuntimeException(
                "无法在该目录创建文件：" + name + "（目录可能不可写或空间不足）");
        return f;
    }
    static void exportToTree(Context c, Uri treeUri) throws IOException {
        DocumentFile root = DocumentFile.fromTreeUri(c, treeUri);
        DocumentFile dataDir = ensureDir(root, D_DATA);
        writeDoc(c, dataDir, "library.json", "application/json",
                readAll(new File(root(c), "library.json")));
        DocumentFile filesDir = ensureDir(dataDir, D_FILES);
        File[] idDirs = new File(root(c), "files").listFiles();
        if (idDirs != null) for (File id : idDirs) {
            DocumentFile tDir = ensureDir(filesDir, id.getName());
            File[] fs = id.listFiles();
            if (fs != null) for (File f : fs)
                writeDoc(c, tDir, f.getName(), mimeOf(f.getName()), readAll(f));
        }
        filesDirty = false;
    }
    static boolean filesDirty = false;
    static long lastJsonMirror = 0;
    interface Prog { void on(int done, int total, String label); }
    static JSONObject syncBoundTree(Context c) { return mirrorToTree(c, false, null); }
    static JSONObject forceSync(Context c) { return mirrorToTree(c, true, null); }
    static JSONObject forceSync(Context c, Prog p) { return mirrorToTree(c, true, p); }
    /* 增量镜像：私有权威 → 绑定目录；只传新增/修改，删除私有已不存在的附件。
       自动(force=false)时 library.json 做 1.5s 节流以降低连续输入 IO；强制立即写 */
    static JSONObject mirrorToTree(Context c, boolean force, final Prog prog) {
        JSONObject r = new JSONObject();
        int added=0,updated=0,skipped=0,removed=0,expected=0,verifiedFiles=0;
        Uri t = boundTree(c);
        try {
            r.put("ok", t != null);
            if (t == null) { r.put("msg","未绑定目录"); return r; }
            DocumentFile root = DocumentFile.fromTreeUri(c, t);
            DocumentFile dataDir = ensureDir(root, D_DATA);
            File libRoot = root(c);
            File lj = new File(libRoot, "library.json");
            /* 1) library.json：force 立即写，否则 1.5s 节流 */
            boolean doJson = force || (System.currentTimeMillis()-lastJsonMirror > 1500);
            boolean jsonOk = false;
            if (lj.exists() && doJson) {
                writeDoc(c, dataDir, "library.json", "application/json", readAll(lj));
                lastJsonMirror = System.currentTimeMillis(); jsonOk = true;
            } else if (dataDir.findFile("library.json") != null) jsonOk = true;
            /* 2) 附件：force 强制全量校验（忽略 filesDirty，这是"同步不全"的修复核心）；
               增量判定 = 大小相等 且 目录修改时间≥私有（容差2s），否则更新 */
            boolean scan = force || filesDirty;
            java.util.Set<String> keep = new java.util.HashSet<>();
            DocumentFile filesDir = null;
            if (scan) {
                filesDir = ensureDir(dataDir, D_FILES);
                File[] idDirs = new File(libRoot, "files").listFiles();
                final int totalIds = idDirs == null ? 0 : idDirs.length;
                if (idDirs != null) for (int ii=0; ii<idDirs.length; ii++) {
                    File id = idDirs[ii];
                    File[] fs = id.listFiles();
                    if (fs == null || fs.length == 0) {
                        if (prog != null) prog.on(ii+1,totalIds,"核对附件 "+(ii+1)+"/"+totalIds);
                        continue;
                    }
                    keep.add(id.getName());
                    DocumentFile tDir = filesDir.findFile(id.getName());
                    for (File f : fs) {
                        expected++;
                        DocumentFile ex = (tDir != null) ? tDir.findFile(f.getName()) : null;
                        boolean same = ex != null && !ex.isDirectory()
                                && ex.length() == f.length()
                                && ex.lastModified() >= f.lastModified() - 2000L;
                        if (same) { skipped++; verifiedFiles++; continue; }
                        if (ex != null) { updated++; ex.delete(); } else added++;
                        if (tDir == null || !tDir.isDirectory())
                            tDir = ensureDir(filesDir, id.getName());
                        DocumentFile wf = writeDoc(c, tDir, f.getName(),
                                mimeOf(f.getName()), readAll(f));
                        if (wf != null && wf.length() == f.length()) verifiedFiles++;
                    }
                    if (prog != null) prog.on(ii+1,totalIds,"核对附件 "+(ii+1)+"/"+totalIds);
                }
                /* 删除私有已不存在的多余 id 目录 */
                DocumentFile[] exDirs = filesDir.listFiles();
                if (exDirs != null) for (DocumentFile d : exDirs)
                    if (d.isDirectory() && !keep.contains(d.getName())) { deleteDoc(d); removed++; }
                filesDirty = false;
            }
            /* 2.5) 便签单文件：用户在文件夹里直接看到每张便签（标题命名） */
            int nc0=0,nc1=0,nc2=0,nc3=0;
            if (lj.exists()) {
                try {
                    org.json.JSONArray nsa = new JSONObject(
                            new String(readAll(lj),StandardCharsets.UTF_8)).optJSONArray("notes");
                    if (nsa != null) { int[] nr = syncNoteFiles(c, root, nsa);
                        nc0=nr[0];nc1=nr[1];nc2=nr[2];nc3=nr[3];
                        writeAttachmentIndex(c, root, nsa); }
                } catch (Exception ne) { ne.printStackTrace(); }
            }
            r.put("noteCreated",nc0);r.put("noteChanged",nc1);
            r.put("noteRenamed",nc2);r.put("noteDeleted",nc3);
            /* 3) 核对结论：所有期望附件最终一致、library.json 在位、无多余 id */
            boolean verified = scan && jsonOk && (verifiedFiles == expected);
            r.put("jsonWritten", jsonOk);
            r.put("added",added);r.put("updated",updated);
            r.put("skipped",skipped);r.put("removed",removed);
            r.put("expectedFiles",expected);r.put("verifiedFiles",verifiedFiles);
            r.put("verified",verified);
        } catch (Exception e) {
            try { r.put("ok",false); r.put("verified",false);
                  r.put("msg", e.getMessage()==null?"同步失败":e.getMessage()); } catch (Exception ignore) {}
            e.printStackTrace();
        }
        return r;
    }
    /* ---- DocumentFile 相对路径辅助（按笔记本子目录组织） ---- */
    static DocumentFile ensureRelDir(DocumentFile base, String rel) {
        DocumentFile d = base;
        for (String part : rel.split("/")) {
            if (part.isEmpty()) continue;
            DocumentFile nx = d.findFile(part);
            if (nx == null || !nx.isDirectory()) nx = d.createDirectory(part);
            d = nx;
        }
        return d;
    }
    static DocumentFile findRel(DocumentFile base, String rel) {
        DocumentFile d = base;
        for (String part : rel.split("/")) {
            if (part.isEmpty()) continue;
            if (d == null) return null;
            d = d.findFile(part);
        }
        return d;
    }
    static boolean deleteRel(DocumentFile base, String rel) {
        DocumentFile d = findRel(base, rel);
        return d != null && d.delete();
    }
    /* 递归收集目录下所有 .json，key 为相对路径 */
    static void collectJson(DocumentFile d, String prefix, java.util.Map<String,DocumentFile> out) {
        if (d == null) return;
        DocumentFile[] kids = d.listFiles();
        if (kids == null) return;
        for (DocumentFile k : kids) {
            String rel = prefix.isEmpty() ? k.getName() : prefix + "/" + k.getName();
            if (k.isDirectory()) collectJson(k, rel, out);
            else if (k.getName().toLowerCase().endsWith(".json")) out.put(rel, k);
        }
    }
    /* 删除空的子目录（不处理 base 自身），保持文件夹整洁 */
    static void cleanupEmptyDirs(DocumentFile d) {
        if (d == null) return;
        DocumentFile[] kids = d.listFiles();
        if (kids == null) return;
        for (DocumentFile k : kids) {
            if (k.isDirectory()) {
                cleanupEmptyDirs(k);
                DocumentFile[] left = k.listFiles();
                if (left == null || left.length == 0) k.delete();
            }
        }
    }
    /* 便签单文件镜像：每张便签写 <根>/便签/<笔记本>/<标题>.json（无笔记本归入「全部」），
       同一笔记本内同标题加序号；移动笔记本即在文件系统真实迁移。文件内 id/updatedAt 自描述。
       返回 [新增,更新,重命名,删除] */
    static int[] syncNoteFiles(Context c, DocumentFile root, org.json.JSONArray notes) throws Exception {
        DocumentFile dataDir = root.findFile(D_DATA);
        if (dataDir == null) dataDir = ensureDir(root, D_DATA);
        DocumentFile notesDir = ensureDir(root, D_NOTES);
        final String IDX = ".notes_index.json";
        JSONObject index = new JSONObject();
        DocumentFile idxf = dataDir.findFile(IDX);
        if (idxf != null) {
            try (InputStream in = c.getContentResolver().openInputStream(idxf.getUri())) {
                index = new JSONObject(new String(readAll(in), StandardCharsets.UTF_8));
            } catch (Exception e) { index = new JSONObject(); }
        }
        /* 递归收集现有便签 .json（含历史扁平文件），key=相对路径 */
        java.util.Map<String,DocumentFile> physMap = new java.util.HashMap<>();
        collectJson(notesDir, "", physMap);
        JSONObject nindex = new JSONObject();
        java.util.Map<String,java.util.Set<String>> usedByDir = new java.util.HashMap<>();
        java.util.Set<String> wantIds = new java.util.HashSet<>();
        int created=0, changed=0, renamed=0;
        for (int i=0;i<notes.length();i++) {
            JSONObject n = notes.getJSONObject(i);
            String id = n.optString("id", null); if (id == null) continue;
            wantIds.add(id);
            String nb = n.optString("notebook","").trim();
            String dir = sanitize(nb.isEmpty() ? "全部" : nb);
            String base = sanitize(n.optString("title","").trim().isEmpty()
                    ? "未命名" : n.optString("title").trim());
            java.util.Set<String> used = usedByDir.get(dir);
            if (used == null) { used = new java.util.HashSet<>(); usedByDir.put(dir, used); }
            String fileName = base+".json"; int seq=1;
            while (used.contains(fileName)) { seq++; fileName = base+"-"+seq+".json"; }
            used.add(fileName);
            String rel = dir + "/" + fileName;
            long ua = n.optLong("updatedAt", 0L);
            JSONObject rec = index.optJSONObject(id);
            String curRel = rec != null ? rec.optString("n", null) : null;
            byte[] payload = n.toString().getBytes(StandardCharsets.UTF_8);
            JSONObject nr = new JSONObject(); nr.put("n", rel); nr.put("u", ua);
            nindex.put(id, nr);
            DocumentFile targetDir = ensureRelDir(notesDir, dir);
            if (curRel == null) {
                writeDoc(c, targetDir, fileName, "application/json", payload); created++;
            } else if (!curRel.equals(rel)) {
                deleteRel(notesDir, curRel);
                writeDoc(c, targetDir, fileName, "application/json", payload); renamed++;
            } else if (rec.optLong("u", -1L) != ua) {
                writeDoc(c, targetDir, fileName, "application/json", payload); changed++;
            }
        }
        int deleted=0;
        java.util.Iterator<String> it = index.keys();
        while (it.hasNext()) {
            String id = it.next();
            if (!wantIds.contains(id)) {
                String rel = index.getJSONObject(id).optString("n", null);
                if (rel != null && deleteRel(notesDir, rel)) deleted++;
            }
        }
        /* 清理不在期望集合的物理文件（含历史扁平 .json） */
        java.util.Set<String> keepRels = new java.util.HashSet<>();
        java.util.Iterator<String> it2 = nindex.keys();
        while (it2.hasNext()) keepRels.add(nindex.getJSONObject(it2.next()).optString("n"));
        for (String rel : new java.util.ArrayList<>(physMap.keySet()))
            if (!keepRels.contains(rel) && deleteRel(notesDir, rel)) deleted++;
        cleanupEmptyDirs(notesDir);
        writeDoc(c, dataDir, IDX, "application/json",
                nindex.toString().getBytes(StandardCharsets.UTF_8));
        return new int[]{created, changed, renamed, deleted};
    }
    static String idxName(JSONObject idx, String id) {
        JSONObject r = idx.optJSONObject(id); return r == null ? "" : r.optString("n", "");
    }
    /* 附件索引（自描述清单）：记录每个附件的归属便签/序号/物理路径/大小/类型，
       写 数据/附件索引.json（程序用）与 数据/附件索引.md（人读），
       供用户定位附件、一键导回与换机还原。 */
    static void writeAttachmentIndex(Context c, DocumentFile root, org.json.JSONArray notes) throws Exception {
        DocumentFile dataDir = root.findFile(D_DATA);
        if (dataDir == null) dataDir = ensureDir(root, D_DATA);
        org.json.JSONArray arr = new org.json.JSONArray();
        StringBuilder md = new StringBuilder("# 附件索引\n\n生成时间："
                + new java.text.SimpleDateFormat("yyyy-MM-dd HH:mm").format(new java.util.Date())
                + "\n\n");
        for (int i=0;i<notes.length();i++) {
            JSONObject n = notes.getJSONObject(i);
            String nt = n.optString("title","").trim().isEmpty()
                    ? "未命名" : n.optString("title").trim();
            org.json.JSONArray fs = n.optJSONArray("files"); if (fs == null) continue;
            for (int j=0;j<fs.length();j++) {
                JSONObject f = fs.getJSONObject(j);
                if (f.optBoolean("hidden",false) || f.optString("derivedOf","").length()>0) continue;
                String id = f.optString("id","");
                String path = D_DATA+"/"+D_FILES+"/"+id+"/"+sanitize(f.optString("name","file"));
                JSONObject r = new JSONObject();
                r.put("id",id); r.put("noteId",n.optString("id",""));
                r.put("noteTitle",nt); r.put("idx",f.optInt("idx",0));
                r.put("name",f.optString("name","")); r.put("size",f.optLong("size",0));
                r.put("kind",f.optString("kind","file")); r.put("path",path);
                arr.put(r);
                md.append("- ").append(nt).append(" ｜[").append(f.optInt("idx",0))
                  .append("] ").append(f.optString("name","")).append("（")
                  .append(f.optString("kind","file")).append("）→ ").append(path).append("\n");
            }
        }
        writeDoc(c, dataDir, "附件索引.json", "application/json",
                arr.toString().getBytes(StandardCharsets.UTF_8));
        writeDoc(c, dataDir, "附件索引.md", "text/markdown",
                md.toString().getBytes(StandardCharsets.UTF_8));
    }
    static void deleteDoc(DocumentFile d) {
        if (d != null && d.isDirectory())
            for (DocumentFile x : d.listFiles()) deleteDoc(x);
        if (d != null) d.delete();
    }
    /* 孤儿附件 GC：删除不被任何便签（含回收站）引用的附件目录；返回清理数 */
    static int gcFiles(Context c) throws Exception {
        java.util.Set<String> live = new java.util.HashSet<>();
        String meta = loadMeta(c);
        if (meta != null) {
            org.json.JSONArray ns = new JSONObject(meta).optJSONArray("notes");
            if (ns != null) for (int i = 0; i < ns.length(); i++) {
                org.json.JSONArray fs = ns.getJSONObject(i).optJSONArray("files");
                if (fs != null) for (int j = 0; j < fs.length(); j++)
                    live.add(fs.getJSONObject(j).getString("id"));
            }
        }
        File[] ds = new File(root(c), "files").listFiles();
        int removed = 0;
        if (ds != null) for (File d : ds)
            if (!live.contains(d.getName())) { deleteRecursively(d); removed++; }
        if (removed > 0) filesDirty = true;
        return removed;
    }
    /* 无整库/整库损坏时，递归从 <根>/便签/<笔记本>/*.json 单文件重建
       （按后缀识别、同 id 取最新、updatedAt 排序） */
    static JSONObject libFromNoteFiles(Context c, DocumentFile root) throws Exception {
        DocumentFile notesDir = root.findFile(D_NOTES);
        if (notesDir == null)
            throw new Exception("该目录不是有效的纸片资料库：缺少 library.json 与 便签 目录");
        java.util.Map<String,DocumentFile> files = new java.util.HashMap<>();
        collectJson(notesDir, "", files);
        java.util.Map<String,JSONObject> byId = new java.util.HashMap<>();
        for (DocumentFile sf : files.values()) {
            try (InputStream in = c.getContentResolver().openInputStream(sf.getUri())) {
                JSONObject o = new JSONObject(new String(readAll(in), StandardCharsets.UTF_8));
                String id = o.optString("id", null); if (id == null) continue;
                JSONObject ex = byId.get(id);
                if (ex == null || o.optLong("updatedAt",0L) > ex.optLong("updatedAt",0L))
                    byId.put(id, o);
            } catch (Exception ignore) {}
        }
        if (byId.isEmpty()) throw new Exception("便签 目录里没有可读取的 .json");
        java.util.List<JSONObject> list = new java.util.ArrayList<>(byId.values());
        list.sort((a,b)->Long.compare(a.optLong("updatedAt",0L), b.optLong("updatedAt",0L)));
        org.json.JSONArray nsa = new org.json.JSONArray();
        for (JSONObject o : list) nsa.put(o);
        JSONObject lib = new JSONObject();
        lib.put("notes", nsa);
        return lib;
    }
    static JSONObject importFromTree(Context c, Uri treeUri) throws Exception {
        DocumentFile root = DocumentFile.fromTreeUri(c, treeUri);
        DocumentFile dataDir = root.findFile(D_DATA);
        DocumentFile lj = (dataDir != null) ? dataDir.findFile("library.json") : null;
        if (lj == null) lj = root.findFile("library.json");
        JSONObject lib = null;
        if (lj != null) {
            String meta;
            try (InputStream in = c.getContentResolver().openInputStream(lj.getUri())) {
                meta = new String(readAll(in), StandardCharsets.UTF_8);
            }
            try { lib = new JSONObject(meta); } catch (Exception e) { lib = null; }
            if (lib != null && lib.optJSONArray("notes") == null) lib = null;
        }
        /* 整库缺失/损坏 → 从 便签/*.json 单文件重建（按后缀识别） */
        if (lib == null) lib = libFromNoteFiles(c, root);
        org.json.JSONArray nsa = lib.getJSONArray("notes");
        /* 期望附件 id（完整性校验） */
        java.util.Set<String> expect = new java.util.HashSet<>();
        for (int i=0;i<nsa.length();i++){
            org.json.JSONArray ff=nsa.getJSONObject(i).optJSONArray("files");
            if(ff!=null)for(int j=0;j<ff.length();j++)expect.add(ff.getJSONObject(j).optString("id"));
        }
        DocumentFile filesDir = (dataDir != null) ? dataDir.findFile(D_FILES) : null;
        if (filesDir == null) filesDir = root.findFile("files");
        java.util.Set<String> have = new java.util.HashSet<>();
        int restored=0, skipped=0;
        if (filesDir != null) for (DocumentFile idDir : filesDir.listFiles()) {
            if (!idDir.isDirectory() || idDir.listFiles().length==0) continue;
            have.add(idDir.getName());
            File local = fileDir(c, idDir.getName()); local.mkdirs();
            for (DocumentFile f : idDir.listFiles()) {
                if (f.isDirectory()) continue;
                File out = new File(local, sanitize(f.getName()));
                /* 目录为权威：大小相等且私有不旧于目录才跳过，否则覆盖 */
                boolean same = out.exists() && out.length()==f.length()
                        && out.lastModified() >= f.lastModified()-2000L;
                if (same) { skipped++; continue; }
                if (out.exists()) out.delete();
                try (InputStream in = c.getContentResolver().openInputStream(f.getUri());
                     FileOutputStream o = new FileOutputStream(out)) {
                    byte[] buf = new byte[65536]; int n;
                    while ((n = in.read(buf)) > 0) o.write(buf, 0, n);
                }
                restored++;
            }
        }
        /* 完整性：期望但目录缺失的附件 */
        org.json.JSONArray missing = new org.json.JSONArray();
        for (String id : expect) if (!have.contains(id)) missing.put(id);
        lib.put("_missing", missing);
        lib.put("_noteCount", nsa.length());
        lib.put("_restored", restored); lib.put("_skipped", skipped);
        lib.put("_verified", missing.length()==0);
        /* 私有刚被目录覆盖，二者一致，不标 dirty */
        filesDirty = false;
        return lib;
    }

    /* ---------- zip ---------- */
    private static void writeZipToStream(Context c, OutputStream os) throws IOException {
        try (ZipOutputStream z = new ZipOutputStream(os)) {
            /* manifest：用于导入时校验完整性 */
            File[] idDirs0 = new File(root(c), "files").listFiles();
            int fileCount = 0;
            if (idDirs0 != null) for (File id : idDirs0) {
                File[] fs = id.listFiles(); if (fs != null) fileCount += fs.length;
            }
            int noteCount = 0;
            try { noteCount = new JSONObject(new String(readAll(new File(root(c), "library.json")),
                    StandardCharsets.UTF_8)).optJSONArray("notes").length(); } catch (Exception ignore) {}
            String manifest;
            try {
                JSONObject m = new JSONObject();
                m.put("app","zhipian-notes");m.put("format","backup");m.put("version",3);
                m.put("exportedAt",new java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss").format(new java.util.Date()));
                m.put("notes",noteCount);m.put("files",fileCount);
                manifest = m.toString();
            } catch (Exception e) { manifest = "{}"; }
            z.putNextEntry(new ZipEntry("manifest.json"));
            z.write(manifest.getBytes(StandardCharsets.UTF_8));
            z.closeEntry();
            z.putNextEntry(new ZipEntry("library.json"));
            z.write(readAll(new File(root(c), "library.json")));
            z.closeEntry();
            File[] idDirs = new File(root(c), "files").listFiles();
            if (idDirs != null) for (File id : idDirs) {
                File[] fs = id.listFiles();
                if (fs != null) for (File f : fs) {
                    z.putNextEntry(new ZipEntry("files/" + id.getName() + "/" + f.getName()));
                    z.write(readAll(f));
                    z.closeEntry();
                }
            }
        }
    }
    /* 绑定目录→直接写 导出/备份/，返回显示路径；未绑定→null（调用方弹 SAF） */
    static String exportZipToDir(Context c, String baseName) throws IOException {
        Uri t = boundTree(c);
        if (t == null) return null;
        String name = tsFileName(baseName, ".zip");
        DocumentFile dir = exportCatDir(c, t, E_BACKUP);
        DocumentFile old = dir.findFile(name); if (old != null) old.delete();
        DocumentFile f = dir.createFile("application/zip", name);
        if (f == null) f = dir.createFile("application/octet-stream", name);
        try (OutputStream os = c.getContentResolver().openOutputStream(f.getUri())) {
            writeZipToStream(c, os);
        }
        return D_EXPORT + "/" + E_BACKUP + "/" + name;
    }
    static void exportZip(Context c, Uri target) throws IOException {
        try (OutputStream os = c.getContentResolver().openOutputStream(target)) {
            writeZipToStream(c, os);
        }
    }
    /* ---------- 知识库包（开放格式，可整体迁移） ---------- */
    static File kbCacheDir(Context c) {
        File d = new File(c.getCacheDir(), "kb");
        d.mkdirs();
        return d;
    }
    static void kbChunksBegin(Context c) throws IOException {
        new FileOutputStream(new File(kbCacheDir(c), "chunks.jsonl")).close();
    }
    static void kbChunksPart(Context c, String b64) throws IOException {
        byte[] bytes = android.util.Base64.decode(b64, android.util.Base64.DEFAULT);
        try (FileOutputStream o = new FileOutputStream(
                new File(kbCacheDir(c), "chunks.jsonl"), true)) {
            o.write(bytes);
        }
    }
    private static void addEntry(ZipOutputStream z, String name, byte[] bytes)
            throws IOException {
        z.putNextEntry(new ZipEntry(name));
        z.write(bytes);
        z.closeEntry();
    }
    private static void writeKbToStream(Context c, OutputStream os, String manifestJson) throws IOException {
        try (ZipOutputStream z = new ZipOutputStream(os)) {
            addEntry(z, "manifest.json", manifestJson.getBytes(StandardCharsets.UTF_8));
            File lib = new File(root(c), "library.json");
            if (lib.exists()) addEntry(z, "library.json", readAll(lib));
            File chunks = new File(kbCacheDir(c), "chunks.jsonl");
            if (chunks.exists()) addEntry(z, "chunks.jsonl", readAll(chunks));
            File[] idDirs = new File(root(c), "files").listFiles();
            if (idDirs != null) for (File id : idDirs) {
                File[] fs = id.listFiles();
                if (fs != null) for (File f : fs)
                    addEntry(z, "files/" + id.getName() + "/" + f.getName(), readAll(f));
            }
        }
    }
    static String exportKbToDir(Context c, String baseName, String manifestJson) throws IOException {
        Uri t = boundTree(c);
        if (t == null) return null;
        String name = tsFileName(baseName, ".kbpkg.zip");
        DocumentFile dir = exportCatDir(c, t, E_KB);
        DocumentFile old = dir.findFile(name); if (old != null) old.delete();
        DocumentFile f = dir.createFile("application/zip", name);
        if (f == null) f = dir.createFile("application/octet-stream", name);
        try (OutputStream os = c.getContentResolver().openOutputStream(f.getUri())) {
            writeKbToStream(c, os, manifestJson);
        }
        return D_EXPORT + "/" + E_KB + "/" + name;
    }
    static void exportKbPackage(Context c, Uri target, String manifestJson)
            throws IOException {
        try (OutputStream os = c.getContentResolver().openOutputStream(target);
             ZipOutputStream z = new ZipOutputStream(os)) {
            addEntry(z, "manifest.json", manifestJson.getBytes(StandardCharsets.UTF_8));
            File lib = new File(root(c), "library.json");
            if (lib.exists()) addEntry(z, "library.json", readAll(lib));
            File chunks = new File(kbCacheDir(c), "chunks.jsonl");
            if (chunks.exists()) addEntry(z, "chunks.jsonl", readAll(chunks));
            File[] idDirs = new File(root(c), "files").listFiles();
            if (idDirs != null) for (File id : idDirs) {
                File[] fs = id.listFiles();
                if (fs != null) for (File f : fs)
                    addEntry(z, "files/" + id.getName() + "/" + f.getName(), readAll(f));
            }
        }
    }

    static JSONObject importZip(Context c, Uri source) throws Exception {
        File tmp = new File(c.getCacheDir(), "import.zip");
        try (InputStream in = c.getContentResolver().openInputStream(source);
             FileOutputStream o = new FileOutputStream(tmp)) {
            byte[] buf = new byte[65536]; int n;
            while ((n = in.read(buf)) > 0) o.write(buf, 0, n);
        }
        /* 安全导入：附件先全部解压到临时根 files.tmp，校验完整后才整体替换现有 files；
           任何一步失败都只清理临时目录，现有附件原样保留（修复"先删后验"导致的数据丢失） */
        File libRoot = root(c);
        File filesFinal = new File(libRoot, "files");
        File filesTmp = new File(libRoot, "files.tmp");
        deleteRecursively(filesTmp);
        filesTmp.mkdirs();
        JSONObject lib = null;
        boolean okZip = false;
        ZipFile zf = new ZipFile(tmp);
        try {
            Enumeration<? extends ZipEntry> en = zf.entries();
            while (en.hasMoreElements()) {
                ZipEntry e = en.nextElement();
                if (e.isDirectory()) continue;
                String path = e.getName();
                if (path.equals("library.json")) {
                    try (InputStream in = zf.getInputStream(e)) {
                        lib = new JSONObject(new String(readAll(in), StandardCharsets.UTF_8));
                    }
                } else if (path.equals("chunks.jsonl")) {
                    File kbd = new File(c.getCacheDir(), "kb");
                    kbd.mkdirs();
                    try (FileOutputStream fo = new FileOutputStream(
                            new File(kbd, "import_chunks.jsonl"))) {
                        fo.write(readAll(zf.getInputStream(e)));
                    }
                } else if (path.startsWith("files/")) {
                    String[] parts = path.split("/");
                    if (parts.length >= 3) {
                        File dir = fileDirIn(filesTmp, parts[1]);
                        File out = new File(dir, sanitize(parts[parts.length - 1]));
                        try (InputStream in = zf.getInputStream(e); FileOutputStream o = new FileOutputStream(out)) {
                            byte[] buf = new byte[65536]; int nn;
                            while ((nn = in.read(buf)) > 0) o.write(buf, 0, nn);
                        }
                    }
                }
            }
            okZip = true;
        } finally {
            zf.close();
            tmp.delete();
        }
        if (lib == null || lib.optJSONArray("notes") == null) {
            deleteRecursively(filesTmp);   // 校验失败：不动现有数据
            throw new Exception("zip 中没有有效的 library.json");
        }
        /* 校验通过：旧附件先整体备份为 files.bak，再放入新附件。
           用户在弹窗选 覆盖→提交(删备份)、合并→备份并回(并集)、取消→回滚 */
        File filesBak = new File(libRoot, "files.bak");
        deleteRecursively(filesBak);
        if (filesFinal.exists()) {
            if (!filesFinal.renameTo(filesBak)) {
                copyTree(filesFinal, filesBak);
                deleteRecursively(filesFinal);
            }
        }
        filesFinal.mkdirs();
        if (!filesTmp.renameTo(filesFinal)) {
            copyTree(filesTmp, filesFinal);
            deleteRecursively(filesTmp);
        }
        filesDirty = true;
        return lib;
    }
    /* 覆盖导入确认：旧附件备份不再需要 */
    static void commitImportBackup(Context c) {
        deleteRecursively(new File(root(c), "files.bak"));
    }
    /* 合并导入：把旧附件按 id 并入当前附件根（已存在的不覆盖），再清备份 */
    static void mergeImportBackup(Context c) {
        File libRoot = root(c);
        File filesFinal = new File(libRoot, "files");
        File filesBak = new File(libRoot, "files.bak");
        filesFinal.mkdirs();
        File[] ids = filesBak.listFiles();
        if (ids != null) for (File id : ids) {
            File t = new File(filesFinal, id.getName());
            if (t.exists()) continue;
            if (!id.renameTo(t)) copyTree(id, t);
        }
        deleteRecursively(filesBak);
        filesDirty = true;
    }
    /* 取消导入：用备份还原附件根 */
    static void rollbackImportBackup(Context c) {
        File libRoot = root(c);
        File filesFinal = new File(libRoot, "files");
        File filesBak = new File(libRoot, "files.bak");
        if (!filesBak.exists()) return;
        deleteRecursively(filesFinal);
        if (!filesBak.renameTo(filesFinal)) {
            filesFinal.mkdirs();
            copyTree(filesBak, filesFinal);
            deleteRecursively(filesBak);
        }
        filesDirty = true;
    }

    /* ---------- HTTP ---------- */
    static String httpGet(String url) throws IOException {
        HttpURLConnection con = (HttpURLConnection) new URL(url).openConnection();
        con.setConnectTimeout(15000);
        con.setReadTimeout(25000);
        con.setInstanceFollowRedirects(true);
        con.setRequestProperty("User-Agent", "Mozilla/5.0 (Linux; Android) Zhipian");
        int code = con.getResponseCode();
        InputStream is = code >= 400 ? con.getErrorStream() : con.getInputStream();
        if (is == null) return "";
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] buf = new byte[8192]; int n;
        while ((n = is.read(buf)) > 0) out.write(buf, 0, n);
        return out.toString("UTF-8");
    }

    /* 通用 HTTP（OpenAI 兼容接口测试/调用：method/url/headers/body） */
    static JSONObject httpRequest(String method, String url, JSONObject headers, String body) throws IOException {
        HttpURLConnection con = (HttpURLConnection) new URL(url).openConnection();
        con.setConnectTimeout(15000);
        con.setReadTimeout(40000);
        con.setInstanceFollowRedirects(true);
        con.setRequestProperty("User-Agent", "Zhipian/Android");
        if (headers != null) {
            Iterator<String> it = headers.keys();
            while (it.hasNext()) {
                String k = it.next();
                try { con.setRequestProperty(k, String.valueOf(headers.get(k))); } catch (Exception ignore) {}
            }
        }
        method = method == null ? "GET" : method.toUpperCase();
        con.setRequestMethod(method);
        if (body != null && (method.equals("POST") || method.equals("PUT") || method.equals("PATCH"))) {
            con.setDoOutput(true);
            try (OutputStream os = con.getOutputStream()) {
                os.write(body.getBytes(StandardCharsets.UTF_8));
            }
        }
        int code = con.getResponseCode();
        InputStream is = code >= 400 ? con.getErrorStream() : con.getInputStream();
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] buf = new byte[8192]; int n;
        if (is != null) while ((n = is.read(buf)) > 0) out.write(buf, 0, n);
        JSONObject r = new JSONObject();
        try {
            r.put("status", code);
            r.put("body", out.toString("UTF-8"));
        } catch (Exception je) { throw new IOException(je); }
        return r;
    }

    /* ---------- 图片压缩 ---------- */
    static JSONObject compressImageUri(Context c, Uri uri, int maxEdge, int quality) throws Exception {
        BitmapFactory.Options bounds = new BitmapFactory.Options();
        bounds.inJustDecodeBounds = true;
        try (InputStream in = c.getContentResolver().openInputStream(uri)) {
            BitmapFactory.decodeStream(in, null, bounds);
        }
        int w = bounds.outWidth, h = bounds.outHeight, sample = 1;
        while (w / (sample * 2) >= maxEdge && h / (sample * 2) >= maxEdge) sample *= 2;
        BitmapFactory.Options o2 = new BitmapFactory.Options();
        o2.inSampleSize = sample;
        Bitmap bmp;
        try (InputStream in = c.getContentResolver().openInputStream(uri)) {
            bmp = BitmapFactory.decodeStream(in, null, o2);
        }
        if (bmp == null) throw new IOException("无法解码图片");
        int bw = bmp.getWidth(), bh = bmp.getHeight();
        float scale = Math.min(1f, (float) maxEdge / Math.max(bw, bh));
        if (scale < 1f) {
            Bitmap nb = Bitmap.createBitmap(Math.round(bw * scale), Math.round(bh * scale), Bitmap.Config.ARGB_8888);
            Canvas cv = new Canvas(nb);
            cv.drawBitmap(bmp, new Rect(0, 0, bw, bh),
                    new Rect(0, 0, nb.getWidth(), nb.getHeight()), null);
            bmp.recycle();
            bmp = nb;
        }
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        bmp.compress(Bitmap.CompressFormat.JPEG, quality, out);
        bmp.recycle();
        String dataUrl = "data:image/jpeg;base64," +
                android.util.Base64.encodeToString(out.toByteArray(), android.util.Base64.NO_WRAP);
        JSONObject r = new JSONObject();
        r.put("dataUrl", dataUrl);
        String name = displayName(c, uri);
        r.put("name", (name == null ? "图片.jpg" : name.replaceAll("(?i)\\.(png|heic|heif|webp|gif|bmp)$", ".jpg")));
        return r;
    }

    /* ---------- 缩略图（附件卡片用） ---------- */
    static String thumbForId(Context c, String id) throws Exception {
        File f = findFile(c, id);
        if (f == null) throw new IOException("文件不存在");
        BitmapFactory.Options bounds = new BitmapFactory.Options();
        bounds.inJustDecodeBounds = true;
        BitmapFactory.decodeFile(f.getAbsolutePath(), bounds);
        int w = bounds.outWidth, h = bounds.outHeight, sample = 1, target = 160;
        while (w / (sample * 2) >= target && h / (sample * 2) >= target) sample *= 2;
        BitmapFactory.Options o2 = new BitmapFactory.Options();
        o2.inSampleSize = sample;
        Bitmap bmp = BitmapFactory.decodeFile(f.getAbsolutePath(), o2);
        if (bmp == null) throw new IOException("无法解码图片");
        int bw = bmp.getWidth(), bh = bmp.getHeight();
        float sc = Math.min(1f, (float) target / Math.max(bw, bh));
        if (sc < 1f) {
            Bitmap nb = Bitmap.createBitmap(Math.round(bw * sc), Math.round(bh * sc), Bitmap.Config.ARGB_8888);
            Canvas cv = new Canvas(nb);
            cv.drawColor(0xFFFFFFFF);
            cv.drawBitmap(bmp, new Rect(0, 0, bw, bh), new Rect(0, 0, nb.getWidth(), nb.getHeight()), null);
            bmp.recycle();
            bmp = nb;
        }
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        bmp.compress(Bitmap.CompressFormat.JPEG, 82, out);
        bmp.recycle();
        return "data:image/jpeg;base64," +
                android.util.Base64.encodeToString(out.toByteArray(), android.util.Base64.NO_WRAP);
    }
}
