/* 交叉构建 Windows x64 免安装包：准备干净 staging → @electron/packager 输出 win32 x64 目录 */
const { packager } = require('@electron/packager');
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const STAGE = path.join(ROOT, 'dist-stage');
const OUT = path.join(ROOT, 'release');
const VER = require('./package.json').version;
const ELECTRON_VER = require('electron/package.json').version;

const rmrf = p => fs.rmSync(p, { recursive: true, force: true });
const cp = (s, d) => fs.cpSync(s, d, { recursive: true });
const mkdirp = p => fs.mkdirSync(p, { recursive: true });

(async () => {
  process.env.ELECTRON_MIRROR =
    process.env.ELECTRON_MIRROR || 'https://npmmirror.com/mirrors/electron/';

  rmrf(STAGE);
  mkdirp(path.join(STAGE, 'desktop'));

  /* Electron 入口 package.json（main 指向 desktop/main.js） */
  fs.writeFileSync(path.join(STAGE, 'package.json'), JSON.stringify({
    name: 'zhipian-desktop', version: VER, description: '纸片 · 桌面便签',
    main: 'desktop/main.js', author: '纸片', license: 'UNLICENSED'
  }, null, 2));

  cp(path.join(ROOT, 'index.html'), path.join(STAGE, 'index.html'));
  cp(path.join(ROOT, 'vendor'), path.join(STAGE, 'vendor'));
  cp(path.join(ROOT, 'desktop', 'main.js'), path.join(STAGE, 'desktop', 'main.js'));
  cp(path.join(ROOT, 'desktop', 'preload.js'), path.join(STAGE, 'desktop', 'preload.js'));
  cp(path.join(ROOT, 'desktop', 'icon.png'), path.join(STAGE, 'desktop', 'icon.png'));
  cp(path.join(ROOT, 'desktop', 'icon.ico'), path.join(STAGE, 'desktop', 'icon.ico'));
  if (fs.existsSync(path.join(ROOT, 'README.md')))
    cp(path.join(ROOT, 'README.md'), path.join(STAGE, '使用说明-README.md'));

  console.log('packaging win32 x64 (electron mirror:', process.env.ELECTRON_MIRROR + ') ...');
  const appPaths = await packager({
    dir: STAGE,
    name: '纸片',
    platform: 'win32',
    arch: 'x64',
    out: OUT,
    overwrite: true,
    electronVersion: ELECTRON_VER,
    prune: true,
    asar: true,
    icon: path.join(ROOT, 'desktop', 'icon.ico'),
    win32metadata: {
      ProductName: '纸片',
      FileDescription: '纸片 · 桌面便签',
      OriginalFilename: '纸片.exe',
      CompanyName: '纸片'
    }
  });
  console.log('DONE', JSON.stringify(appPaths));
})().catch(e => { console.error(e); process.exit(1); });
