const { chromium } = require('playwright');
const EXE = '/opt/vm/preinstall/ms-playwright/chromium_headless_shell-1169/chrome-linux/headless_shell';
const URL0 = 'file:///home/user/Doubao/chats/38443854002369026/notes-app/index.html';

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: EXE });
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });

  await page.addInitScript(() => {
    const pngB64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=';
    const bin = Uint8Array.from(atob(pngB64), c => c.charCodeAt(0));
    const note = {
      id: 'cloud-note', type: 'note', title: '手机便签', content: '<p>手机内容</p>',
      tags: [], todos: [], pinned: false, trashed: false,
      files: [{ id: 'cloud-file', name: 'photo.png', type: 'image/png', kind: 'image', idx: 1, size: bin.length }],
      createdAt: 1760000000000, updatedAt: 1760000000000
    };
    const manifest = {
      app: 'zhipian-notes', version: 2, lastSync: 1760000000000,
      notes: { 'cloud-note': { file: 'notes/test.json', title: '手机便签', updatedAt: 1760000000000 } },
      files: { 'cloud-file': { name: 'photo.png', idx: 1, size: bin.length, md5: 'test' } }
    };
    const enc = s => new TextEncoder().encode(s).buffer;
    window.__mockEmptyManifest = false;
    window.__mockUploads = [];
    window.__DESKTOP__ = {
      desktop: true,
      platform: 'linux',
      panDownloadBytes: async ({ path }) => {
        if (path.endsWith('/manifest.json')) {
          return { ok: true, buf: enc(JSON.stringify(window.__mockEmptyManifest ? {} : manifest)) };
        }
        if (path.endsWith('/notes/test.json')) return { ok: true, buf: enc(JSON.stringify(note)) };
        if (path.endsWith('/files/cloud-file/01_photo.png')) return { ok: true, buf: bin.buffer.slice(0) };
        return { ok: false, error: 'unexpected path ' + path };
      },
      panUploadBytes: async ({ path }) => {
        window.__mockUploads.push(path);
        return { ok: true, md5: 'local-md5' };
      },
      panMd5: async () => 'local-md5'
    };
  });

  await page.goto(URL0);
  await page.waitForFunction(() => window.__app, { timeout: 8000 });
  const result = await page.evaluate(async () => {
    window.__app.prefs.pan = { token: 'test-token' };
    const r = await window.__app.desktopMergeSync(false);
    const blob = await window.__app.idbGetBlob('cloud-file');
    return {
      noteCount: r.notes.length,
      downloaded: r.downloaded,
      failedFiles: r.failedFiles,
      noteId: r.notes[0] && r.notes[0].id,
      blobType: blob && blob.type,
      blobSize: blob && blob.size
    };
  });

  const push = await page.evaluate(async () => {
    const A = window.__app;
    window.__mockEmptyManifest = true;
    window.__mockUploads.length = 0;
    const localNote = {
      id: 'local-note', type: 'note', title: '电脑便签', content: '<p>电脑内容</p>',
      tags: [], todos: [], pinned: false, trashed: false,
      files: [{ id: 'local-file', name: 'hello.txt', type: 'text/plain', kind: 'file', idx: 1, size: 5 }],
      createdAt: 1760000001000, updatedAt: 1760000001000
    };
    await A.idbPutBlob('local-file', new Blob([new TextEncoder().encode('hello')], { type: 'text/plain' }));
    A.notes.splice(0, A.notes.length, localNote);
    const r = await A.desktopMergeSync(true);
    return { r, uploads: [...window.__mockUploads] };
  });

  const checks = [
    ['恢复到 1 张手机便签', result.noteCount === 1 && result.noteId === 'cloud-note'],
    ['附件下载成功', result.downloaded === 1 && result.failedFiles === 0],
    ['附件保留 PNG MIME 类型', result.blobType === 'image/png'],
    ['附件字节完整', result.blobSize === 68],
    ['双向同步上传 1 张电脑便签', push.r.upNotes === 1],
    ['双向同步上传 1 个电脑附件', push.r.upFiles === 1 && push.r.failedFiles === 0],
    ['云端清单被更新', push.uploads.some(p => p.endsWith('/manifest.json'))],
    ['电脑附件路径正确', push.uploads.some(p => p.endsWith('/files/local-file/01_hello.txt'))],
    ['页面无 JS 错误', errors.length === 0]
  ];
  let pass = 0;
  checks.forEach(([name, ok]) => {
    console.log((ok ? 'PASS' : 'FAIL') + '  ' + name);
    if (ok) pass++;
  });
  if (errors.length) console.log(errors.join('\n'));
  console.log(result);
  console.log(push);
  await browser.close();
  process.exit(pass === checks.length ? 0 : 1);
})();
