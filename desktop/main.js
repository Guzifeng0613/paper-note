const { app, BrowserWindow, protocol, ipcMain, Menu, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

/* 网页根：index.html 与 vendor/ 所在的 notes-app 根目录 */
const WEB = path.resolve(__dirname, '..');
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
  '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8'
};

/* 注册为标准 / 安全 / 支持 ServiceWorker 的协议，使 IndexedDB、Worker、fetch 正常工作，
   并与安卓的 https://zhipian.local 环境等价 */
protocol.registerSchemesAsPrivileged([{
  scheme: 'zhipian',
  privileges: { standard: true, secure: true, supportServiceWorker: true,
    fetchWindowOpen: true, corsEnabled: true }
}]);

let win = null;

function createWindow() {
  win = new BrowserWindow({
    width: 1220,
    height: 800,
    minWidth: 960,
    minHeight: 620,
    backgroundColor: '#E9EAF4',
    title: '纸片',
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false
    }
  });

  win.loadURL('zhipian://app/');

  if (process.env.SELFTEST) {
    win.webContents.on('console-message', (_e, level, message) => {
      if (level >= 2) console.log('[renderer:' + level + ']', message);
    });
    win.webContents.on('render-process-gone', (_e, d) => {
      console.log('GONE', JSON.stringify(d)); app.exit(1);
    });
    win.webContents.on('did-fail-load', (_e, ec, desc, url) =>
      console.log('FAIL_LOAD', ec, desc, url));
    win.webContents.on('did-finish-load', () => setTimeout(async () => {
      const info = await win.webContents.executeJavaScript(
        `({env:window.__app&&window.__app.Store.env,notes:window.__app?window.__app.notes.length:-1,desk:!!window.__DESKTOP__})`
      ).catch(e => 'JSERR ' + e.message);
      console.log('SELFTEST_RESULT', JSON.stringify(info));
      app.quit();
    }, 4000));
  }

  if (process.env.SHOT) {
    win.webContents.on('did-finish-load', () => setTimeout(async () => {
      const base = process.env.SHOT;
      fs.writeFileSync(base + '_1empty.png', (await win.webContents.capturePage()).toPNG());
      await win.webContents.executeJavaScript(
        `(function(){const c=document.querySelector('#notesWrap .note-card');if(c)c.click();})()`
      );
      setTimeout(async () => {
        fs.writeFileSync(base + '_2open.png', (await win.webContents.capturePage()).toPNG());
        win.webContents.executeJavaScript(`location.hash='#/settings'`);
        setTimeout(async () => {
          fs.writeFileSync(base + '_3settings.png', (await win.webContents.capturePage()).toPNG());
          win.webContents.executeJavaScript(`location.hash='#/home'`);
          setTimeout(() => app.quit(), 1000);
        }, 1700);
      }, 1300);
    }, 2800));
  }

  /* 外链交给系统浏览器，不在应用内导航走丢 */
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) { shell.openExternal(url); return { action: 'deny' }; }
    return { action: 'allow' };
  });
}

app.whenReady().then(() => {
  protocol.handle('zhipian', (req) => {
    let p = decodeURIComponent(new URL(req.url).pathname);
    if (p === '/' || p === '') p = '/index.html';
    const file = path.normalize(path.join(WEB, p));
    if (!file.startsWith(WEB)) return new Response('forbidden', { status: 403 });
    try {
      const data = fs.readFileSync(file);
      const ext = path.extname(file).toLowerCase();
      return new Response(data, {
        headers: { 'Content-Type': MIME[ext] || 'application/octet-stream',
          'Cache-Control': 'no-cache' }
      });
    } catch (e) {
      return new Response('not found: ' + p, { status: 404 });
    }
  });

  /* 保存文件对话框（导出用） */
  ipcMain.handle('saveFile', async (_e, name, data, isBinary) => {
    const res = await dialog.showSaveDialog(win, { defaultPath: name });
    if (res.canceled || !res.filePath) return false;
    fs.writeFileSync(res.filePath, isBinary ? Buffer.from(data) : data);
    return res.filePath;
  });
  ipcMain.handle('openLink', (_e, url) => { shell.openExternal(url); return true; });

  /* 原生 HTTP 通道（百度网盘换令牌 / API，绕过浏览器 CORS） */
  ipcMain.handle('httpRequest', async (_e, opts) => {
    return new Promise((resolve) => {
      try {
        const u = new URL(opts.url);
        const mod = u.protocol === 'https:' ? require('https') : require('http');
        const req = mod.request(u, {
          method: (opts.method || 'GET').toUpperCase(),
          headers: Object.assign({ 'User-Agent': 'Zhipian/Desktop' }, opts.headers || {})
        }, (res) => {
          const chunks = [];
          res.on('data', c => chunks.push(c));
          res.on('end', () => resolve({
            status: res.statusCode,
            body: Buffer.concat(chunks).toString('utf8')
          }));
        });
        req.on('error', e => resolve({ status: 0, body: String(e) }));
        req.setTimeout(40000, () => { req.destroy(); resolve({ status: 0, body: 'timeout' }); });
        if (opts.body) req.write(opts.body);
        req.end();
      } catch (e) { resolve({ status: 0, body: String(e) }); }
    });
  });

  /* ============ 百度网盘字节原语（上传/下载，复刻安卓 Baidu.java） ============ */
  const PAN = 'https://pan.baidu.com/rest/2.0/xpan';
  const UP = 'https://d.pcs.baidu.com/rest/2.0/pcs/superfile2';
  const SLICE = 4 * 1024 * 1024;
  const UA = 'Mozilla/5.0 Zhipian';
  const ue = s => encodeURIComponent(s);

  function httpReq(urlStr, method, headers, bodyBuf, redirectsLeft = 5) {
    return new Promise((resolve, reject) => {
      const u = new URL(urlStr);
      const mod = u.protocol === 'https:' ? require('https') : require('http');
      const req = mod.request(u, { method: method || 'GET', headers: Object.assign({ 'User-Agent': UA }, headers || {}) }, res => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          if (redirectsLeft <= 0) return reject(new Error('too many redirects'));
          const loc = res.headers.location;
          const next = loc.startsWith('http') ? loc : new URL(loc, u).href;
          return resolve(httpReq(next, method, headers, bodyBuf, redirectsLeft - 1));
        }
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, buf: Buffer.concat(chunks) }));
      });
      req.on('error', reject);
      req.setTimeout(180000, () => { req.destroy(); reject(new Error('timeout')); });
      if (bodyBuf) req.write(bodyBuf);
      req.end();
    });
  }
  async function panPostForm(urlStr, form) {
    const r = await httpReq(urlStr, 'POST', { 'Content-Type': 'application/x-www-form-urlencoded' }, Buffer.from(form, 'utf8'));
    return JSON.parse(r.buf.toString('utf8') || '{}');
  }
  async function panUploadBytes(token, remotePath, buf) {
    const parts = [], blockList = [];
    const wholeMd5 = crypto.createHash('md5').update(buf).digest('hex');
    for (let i = 0; i < buf.length; i += SLICE) {
      const p = buf.subarray(i, Math.min(i + SLICE, buf.length));
      parts.push(p);
      blockList.push(crypto.createHash('md5').update(p).digest('hex'));
    }
    const bl = JSON.stringify(blockList);
    const pc = await panPostForm(PAN + '/file?method=precreate&access_token=' + ue(token),
      'path=' + ue(remotePath) + '&size=' + buf.length + '&isdir=0&autoinit=1&block_list=' + ue(bl));
    if ((pc.errno ?? -1) !== 0) throw new Error('预上传失败：' + JSON.stringify(pc));
    if (pc.return_type === 2) return { skipped: true, md5: wholeMd5 };
    const uploadid = pc.uploadid;
    for (let i = 0; i < parts.length; i++) {
      const boundary = '----ZP' + Date.now().toString(16) + i;
      const head = Buffer.from('--' + boundary + '\r\nContent-Disposition: form-data; name="file"; filename="file"\r\nContent-Type: application/octet-stream\r\n\r\n');
      const tail = Buffer.from('\r\n--' + boundary + '--\r\n');
      const total = Buffer.concat([head, parts[i], tail]);
      const r = await httpReq(UP + '?method=upload&access_token=' + ue(token) +
        '&type=tmpfile&partseq=' + i + '&path=' + ue(remotePath) + '&uploadid=' + ue(uploadid),
        'POST', { 'Content-Type': 'multipart/form-data; boundary=' + boundary }, total);
      if (r.status >= 400) throw new Error('分片上传失败 ' + r.status + ' ' + r.buf.toString('utf8'));
    }
    const cr = await panPostForm(PAN + '/file?method=create&access_token=' + ue(token),
      'path=' + ue(remotePath) + '&size=' + buf.length + '&isdir=0&block_list=' + ue(bl) +
      '&uploadid=' + ue(uploadid) + '&rtype=1');
    if ((cr.errno ?? -1) !== 0) throw new Error('创建文件失败：' + JSON.stringify(cr));
    return { ok: true, md5: wholeMd5 };
  }
  function panApiError(j, fallback) {
    if (j && typeof j.errno !== 'undefined' && j.errno !== 0) {
      return new Error(fallback + '（错误码 ' + j.errno + (j.errmsg ? '：' + j.errmsg : '') + '）');
    }
    return null;
  }
  async function panDownloadBytes(token, remotePath) {
    const s = remotePath.lastIndexOf('/');
    const dir = remotePath.slice(0, s), name = remotePath.slice(s + 1);
    const ls = await httpReq(PAN + '/file?method=list&dir=' + ue(dir) + '&access_token=' + ue(token), 'GET');
    const lsText = ls.buf.toString('utf8');
    let lsj;
    try { lsj = JSON.parse(lsText || '{}'); }
    catch (e) { throw new Error('云端文件列表响应异常'); }
    const lsErr = panApiError(lsj, '读取云端目录失败');
    if (lsErr) throw lsErr;
    let fsid = -1;
    (lsj.list || []).forEach(f => { if (f.server_filename === name) fsid = f.fs_id; });
    if (fsid < 0) throw new Error('文件不存在：' + remotePath);
    const fm = await httpReq(PAN + '/multimedia?method=filemetas&access_token=' + ue(token) +
      '&fsids=[' + fsid + ']&dlink=1', 'GET');
    const fmText = fm.buf.toString('utf8');
    let fmj;
    try { fmj = JSON.parse(fmText || '{}'); }
    catch (e) { throw new Error('云端下载链接响应异常'); }
    const fmErr = panApiError(fmj, '获取云端下载链接失败');
    if (fmErr) throw fmErr;
    const dlink = fmj.list && fmj.list[0] && fmj.list[0].dlink;
    if (!dlink) throw new Error('无下载链接');
    let dl = dlink.startsWith('//') ? 'https:' + dlink : dlink;
    dl += (dl.includes('?') ? '&' : '?') + 'access_token=' + ue(token);
    const r = await httpReq(dl, 'GET');
    if (r.status >= 400) throw new Error('下载失败 ' + r.status);
    if (!r.buf || r.buf.length === 0) throw new Error('下载内容为空');
    return r.buf;
  }

  ipcMain.handle('panUploadBytes', async (_e, { token, path, buf }) => {
    try {
      const r = await panUploadBytes(token, path, Buffer.from(buf));
      return { ok: true, md5: r.md5 || '', skipped: !!r.skipped };
    }
    catch (e) { return { ok: false, error: String(e && e.message || e) }; }
  });
  ipcMain.handle('panDownloadBytes', async (_e, { token, path }) => {
    try {
      const buf = await panDownloadBytes(token, path);
      return { ok: true, buf: buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length) };
    } catch (e) { return { ok: false, error: String(e && e.message || e) }; }
  });
  ipcMain.handle('panMd5', (_e, { buf }) => crypto.createHash('md5').update(Buffer.from(buf)).digest('hex'));
  ipcMain.handle('winMin', () => win.minimize());
  ipcMain.handle('winMax', () => {
    if (win.isMaximized()) win.unmaximize(); else win.maximize();
    return win.isMaximized();
  });
  ipcMain.handle('winClose', () => win.close());

  Menu.setApplicationMenu(null);
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
