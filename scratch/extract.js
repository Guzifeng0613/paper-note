// M0 一次性提取脚本：从 v15.4.4 原始 index.html 精确切片生成 src/ 树
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const orig = fs.readFileSync(path.join(ROOT, 'scratch/index.v15.4.4.orig.html'), 'utf8');
const L = orig.split('\n'); // L[i] = 第 i+1 行
const slice = (a, b) => L.slice(a - 1, b).join('\n'); // 1-based inclusive

// ---- CSS 片段（第 11..1234 行）----
const cssFiles = [
  ['tokens.css',        11,  92],
  ['base.css',          93, 198],
  ['home.css',         199, 555],
  ['editor.css',       556, 633],
  ['settings.css',     634, 758],
  ['search.css',       759, 837],
  ['cloud.css',        838, 897],
  ['editor-v4.css',    898,1139],
  ['desktop.css',      1140,1234],
];
// ---- JS 片段（IIFE body，第 1534..7866 行）----
const jsFiles = [
  ['util.js',          1534,1681],
  ['store.js',         1682,1923],
  ['theme.js',         1924,2154],
  ['route.js',         2155,2425],
  ['sheets.js',        2426,2529],
  ['home.js',          2530,3053],
  ['editor.js',        3054,4596],
  ['notebook-trash.js',4597,4818],
  ['settings.js',      4819,5021],
  ['cloud.js',         5022,5819],
  ['parse.js',         5820,6502],
  ['ai.js',            6503,7539],
  ['main.js',          7540,7866],
];

// 连续性断言：CSS 与 JS 各自首尾相接、无缺口无重叠
let prev = 10;
for (const [name, a, b] of cssFiles) {
  if (a !== prev + 1) throw new Error('CSS gap at ' + name + ': expected ' + (prev + 1) + ' got ' + a);
  prev = b;
}
if (prev !== 1234) throw new Error('CSS must end at 1234, got ' + prev);
prev = 1533;
for (const [name, a, b] of jsFiles) {
  if (a !== prev + 1) throw new Error('JS gap at ' + name + ': expected ' + (prev + 1) + ' got ' + a);
  prev = b;
}
if (prev !== 7866) throw new Error('JS must end at 7866, got ' + prev);

for (const [name, a, b] of cssFiles) fs.writeFileSync(path.join(ROOT, 'src/css', name), slice(a, b));
for (const [name, a, b] of jsFiles)  fs.writeFileSync(path.join(ROOT, 'src/js', name),  slice(a, b));

// ---- src/index.html 骨架 ----
// 行 1..10（含 <style>）、CSS 占位、1235 </style>、1236 </head>、
// 行 1237..1531（body 骨架 + vendor script + <script>）、JS 占位、
// 行 7868 </script>、行 7869..末尾
const skel = [
  ...L.slice(0, 10),           // 1..10
  '/*__CSS__*/',
  L[1234],                     // 1235 </style>
  L[1235],                     // 1236 </head>
  ...L.slice(1236, 1531),      // 1237..1531 (含 vendor 引用与 <script>)
  '/*__JS__*/',
  L[7867],                     // 7868 </script>
  ...L.slice(7868),            // 7869..end
].join('\n');
fs.writeFileSync(path.join(ROOT, 'src/index.html'), skel);
console.log('extract OK');
