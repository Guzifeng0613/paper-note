#!/usr/bin/env node
// M0 构建：src/index.html 骨架 + src/css/*.css + src/js/*.js → dist/index.html，并同步覆盖根 index.html
// 规则：顺序拼接经典脚本（无 import/export），片段间不添加任何空白/换行，保证字节级可复现。
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');

const CSS_ORDER = [
  'tokens.css', 'base.css', 'home.css', 'editor.css', 'settings.css',
  'search.css', 'cloud.css', 'editor-v4.css',
  'vault-ui.css',
  'v16-anim.css',
];
const JS_ORDER = [
  'util.js', 'store.js', 'theme.js', 'route.js', 'sheets.js', 'home.js',
  'editor.js', 'notebook-trash.js', 'settings.js', 'cloud.js',
  'parse.js', 'ai.js', 'main.js',
  /* ---- v16 新 UI（M2/M3）---- */
  'vault-fs.js', 'markdown.js', 'migrate.js', 'vault.js', 'vault-sync.js', 'vault-ui.js', 'v16-anim.js', 'v16-boot.js',
];

const read = p => fs.readFileSync(p, 'utf8');

const tpl = read(path.join(ROOT, 'src/index.html'));
// 片段间补 '\n' 还原相邻行；用 split/join 避免 replace 把内容里的 $$ $& 当特殊模式
const cssOut = CSS_ORDER.map(f => read(path.join(ROOT, 'src/css', f))).join('\n');
const jsOut = '(function(){\n\'use strict\';\n' +
              JS_ORDER.map(f => read(path.join(ROOT, 'src/js', f))).join('\n') +
              '\n})();';

let out = tpl;
if (!out.includes('/*__CSS__*/')) throw new Error('src/index.html 缺少 /*__CSS__*/ 占位');
if (!out.includes('/*__JS__*/'))  throw new Error('src/index.html 缺少 /*__JS__*/ 占位');
out = out.split('/*__CSS__*/').join(cssOut).split('/*__JS__*/').join(jsOut);

fs.mkdirSync(path.join(ROOT, 'dist'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'dist/index.html'), out);
fs.writeFileSync(path.join(ROOT, 'index.html'), out);
console.log('build OK -> dist/index.html, index.html (' + out.length + ' bytes)');
