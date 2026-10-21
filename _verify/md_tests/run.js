/* ============================================================
   md_tests/run.js —— markdown.js node 单测（≥60 断言）
   用法：node _verify/md_tests/run.js
   不依赖浏览器，直接 require src/js/markdown.js。
   ============================================================ */
const assert = require('assert');
const MD = require('../../src/js/markdown.js');

let pass = 0, fail = 0;
const fails = [];
function t(name, fn){
  try { fn(); pass++; console.log('  PASS  ' + name); }
  catch(e){ fail++; fails.push(name); console.log('  FAIL  ' + name + '  -> ' + e.message); }
}
function eq(actual, expected, name){ assert.strictEqual(actual, expected, name||('期望 '+JSON.stringify(expected)+'，实际 '+JSON.stringify(actual))); }
function ok(v, name){ assert.ok(v, name||('truthy，实际 '+JSON.stringify(v))); }

console.log('\n[1] frontmatter 解析 / 序列化 / 往返');
t('无 fm 纯 md → fm:null，body 原样', ()=>{
  const r = MD.parseFrontmatter('## 标题\n正文');
  eq(r.fm, null); eq(r.body, '## 标题\n正文');
});
t('标准 fm 全字段解析', ()=>{
  const r = MD.parseFrontmatter('---\nid: 8f3a\ncreated: 2026-10-21T10:00:00+08:00\ncolor: yellow\npinned: true\ntags: [工作, 周会]\ntype: note\n---\n正文');
  eq(r.fm.id, '8f3a');
  eq(r.fm.created, '2026-10-21T10:00:00+08:00');
  eq(r.fm.color, 'yellow');
  eq(r.fm.pinned, true);
  ok(Array.isArray(r.fm.tags) && r.fm.tags.length===2 && r.fm.tags[0]==='工作');
  eq(r.fm.type, 'note');
  eq(r.body, '正文');
});
t('fm 布尔 false / 数字 / 引号串', ()=>{
  const r = MD.parseFrontmatter('---\npinned: false\ncount: 42\ntitle: "我的笔记"\n---\n');
  eq(r.fm.pinned, false); eq(r.fm.count, 42); eq(r.fm.title, '我的笔记');
});
t('tags 空数组 → []', ()=>{
  const r = MD.parseFrontmatter('---\ntags: []\n---\n正文');
  ok(Array.isArray(r.fm.tags) && r.fm.tags.length===0);
});
t('body 紧跟在闭合 --- 之后（偏移正确）', ()=>{
  const r = MD.parseFrontmatter('---\nid: a\n---\n\n第一段\n第二段');
  eq(r.body, '\n第一段\n第二段');
});
t('stringifyFrontmatter 输出首尾 ---', ()=>{
  const s = MD.stringifyFrontmatter({id:'x', pinned:true});
  ok(s.startsWith('---\n') && s.endsWith('---\n')); ok(s.includes('pinned: true'));
});
t('stringify 空 fm → 空串', ()=>{ eq(MD.stringifyFrontmatter({}), ''); eq(MD.stringifyFrontmatter(null), ''); });
t('fm 往返：parse(stringify(fm)) 深等', ()=>{
  const fm = {id:'abc', created:'2026-10-21T10:00:00+08:00', updated:'2026-10-21T12:30:00+08:00', color:'yellow', pinned:true, tags:['工作','周会'], type:'todo'};
  const r = MD.parseFrontmatter(MD.stringifyFrontmatter(fm));
  assert.deepStrictEqual(r.fm, fm);
});
t('字段顺序 id/created/updated/color/pinned/tags/type', ()=>{
  const s = MD.stringifyFrontmatter({type:'note', id:'a', tags:['x'], color:'red'});
  const order = s.split('\n').filter(l=>l.includes(':')).map(l=>l.split(':')[0]);
  eq(order.join(','), 'id,color,tags,type');
});
t('正文里独立 --- 不是 fm（fm 必须在文件开头）', ()=>{
  const r = MD.parseFrontmatter('开头正文\n---\n后面');
  eq(r.fm, null); ok(r.body.startsWith('开头正文'));
});

console.log('\n[2] parse 块级 AST');
t('标题 ## → level 2 / ###### → level 6', ()=>{
  const b = MD.parse('## 二级\n###### 六级').blocks;
  eq(b[0].type,'heading'); eq(b[0].level,2); eq(b[0].text,'二级');
  eq(b[1].type,'heading'); eq(b[1].level,6);
});
t('# 一级号按段落处理（方言 # 不做正文标题）', ()=>{
  const b = MD.parse('# 一级号').blocks;
  eq(b[0].type,'para');
});
t('无序列表 items', ()=>{
  const b = MD.parse('- 甲\n- 乙').blocks;
  eq(b[0].type,'ul'); eq(b[0].items.length,2); eq(b[0].items[1].text,'乙');
});
t('有序列表 items 含序号', ()=>{
  const b = MD.parse('1. 一\n2. 二').blocks;
  eq(b[0].type,'ol'); eq(b[0].items[0].num,1); eq(b[0].items[1].num,2);
});
t('待办块 done / priority / indent', ()=>{
  const b = MD.parse('- [ ] 高优 #p/high\n- [x] 低优 #p/low\n  - [ ] 子任务').blocks;
  eq(b[0].type,'todo'); eq(b[0].done,false); eq(b[0].priority,'high');
  eq(b[1].done,true); eq(b[1].priority,'low');
  eq(b[2].indent,2); eq(b[2].priority,'normal');
});
t('引用块多行 items', ()=>{
  const b = MD.parse('> 第一行\n> 第二行').blocks;
  eq(b[0].type,'quote'); eq(b[0].items.length,2); eq(b[0].items[1],'第二行');
});
t('代码块含语言', ()=>{
  const b = MD.parse('```js\nconst a=1;\n```').blocks;
  eq(b[0].type,'code'); eq(b[0].lang,'js'); eq(b[0].text,'const a=1;');
});
t('代码块无语言 → lang 空串', ()=>{
  const b = MD.parse('```\n纯文本\n```').blocks;
  eq(b[0].lang,'');
});
t('分割线 hr', ()=>{
  eq(MD.parse('---').blocks[0].type,'hr');
});
t('独立图片行 → attach 块', ()=>{
  const b = MD.parse('![](attachments/x.jpg)').blocks;
  eq(b[0].type,'attach'); eq(b[0].refs[0].link,'attachments/x.jpg'); ok(b[0].refs[0].embed);
});
t('普通段落 para', ()=>{
  eq(MD.parse('随便一段话').blocks[0].type,'para');
});
t('空输入 → blocks 空数组', ()=>{
  eq(MD.parse('').blocks.length,0); eq(MD.parse(null).blocks.length,0);
});

console.log('\n[3] toHTML 内联标记');
t('加粗 → strong', ()=> ok(MD.toHTML('**粗**').includes('<strong>粗</strong>')));
t('斜体 → em', ()=> ok(MD.toHTML('*斜*').includes('<em>斜</em>')));
t('高亮 → mark', ()=> ok(MD.toHTML('==高亮==').includes('<mark class="md-hl">高亮</mark>')));
t('删除线 → del', ()=> ok(MD.toHTML('~~删~~').includes('<del>删</del>')));
t('行内码不解析内部标记', ()=> ok(MD.toHTML('`**不是粗**`').includes('<code class="md-code">**不是粗**</code>')));
t('<u> 原样保留', ()=> ok(MD.toHTML('<u>下划</u>').includes('<u>下划</u>')));
t('图片 ![alt](url)', ()=> ok(MD.toHTML('![图](a.jpg)').includes('src="a.jpg"') && MD.toHTML('![图](a.jpg)').includes('alt="图"')));
t('![[path]] → attachments 内嵌图', ()=> ok(MD.toHTML('![[白板.jpg]]').includes('src="attachments/') && MD.toHTML('![[白板.jpg]]').includes('%E7%99%BD%E6%9D%BF')));
t('链接 [名](url) → a', ()=> ok(MD.toHTML('[文档](a.pdf)').includes('<a class="md-link" href="a.pdf">文档</a>')));
t('双链 [[名]]', ()=> ok(MD.toHTML('[[笔记名]]').includes('data-target="笔记名"')));
t('双链别名 [[名|显示]]', ()=> ok(MD.toHTML('[[笔记名|点我]]').includes('data-target="笔记名"') && MD.toHTML('[[笔记名|点我]]').includes('>点我<')));
t('行内标签 → span.md-tag', ()=> ok(MD.toHTML('文字 #工作').includes('<span class="md-tag">#工作</span>')));
t('优先级 #p/high 不包成标签', ()=> {
  const h = MD.toHTML('- [ ] 任务 #p/high');
  ok(!h.includes('#p/high</span>')); ok(h.includes('md-todo p-high'));
});
t('空笔记兜底', ()=> ok(MD.toHTML('').includes('md-empty')));
t('标题 h2 输出', ()=> ok(MD.toHTML('## 标题').includes('<h2 class="md-h">')));
t('代码块 HTML 转义（防注入）', ()=> {
  const h = MD.toHTML('```\n<b>&"\n```');
  ok(h.includes('&lt;b&gt;') && h.includes('&amp;'));
});

console.log('\n[4] 待办抽取 / 回写');
t('todoLines 抽取两项，key 为正文行号', ()=>{
  const md = '---\nid:a\n---\n前言\n- [ ] 甲\n- [x] 乙 #p/low';
  const rows = MD.todoLines(md);
  eq(rows.length,2); eq(rows[0].key,'1'); eq(rows[0].done,false); eq(rows[1].done,true); eq(rows[1].priority,'low');
});
t('todoLines start/end 精确指向该行切片', ()=>{
  const md = '---\nid:a\n---\n- [ ] 目标行十二字';
  const rows = MD.todoLines(md);
  eq(md.slice(rows[0].start, rows[0].end), '- [ ] 目标行十二字');
});
t('setTodoLine 勾选 [ ] → [x]', ()=>{
  const md = '---\nid:a\n---\n- [ ] 任务';
  const out = MD.setTodoLine(md, '0', {done:true});
  ok(out.includes('- [x] 任务'));
});
t('setTodoLine 取消勾选 [x] → [ ]', ()=>{
  const out = MD.setTodoLine('---\nid:a\n---\n- [x] 任务', '0', {done:false});
  ok(out.includes('- [ ] 任务'));
});
t('setTodoLine 保留原 fm 头部与其余行', ()=>{
  const md = '---\nid:a\ncolor: yellow\n---\n- [ ] 甲\n普通段落';
  const out = MD.setTodoLine(md, '0', {done:true});
  ok(out.startsWith('---\nid:a\ncolor: yellow\n---\n')); ok(out.endsWith('- [x] 甲\n普通段落') || out.includes('- [x] 甲\n普通段落'));
});
t('setTodoLine 缩进保留', ()=>{
  const out = MD.setTodoLine('---\n---\n  - [ ] 子', '0', {done:true});
  ok(out.includes('  - [x] 子'));
});
t('setTodoLine 非法 key 返回原文', ()=>{
  const md = '---\n---\n- [ ] 甲';
  eq(MD.setTodoLine(md, '9', {done:true}), md);
});

console.log('\n[5] 索引辅助');
t('extractTags：fm.tags + 行内标签合并去重', ()=>{
  const tags = MD.extractTags('---\ntags: [工作]\n---\n正文 #工作 #生活');
  eq(tags.length,2); ok(tags.includes('工作') && tags.includes('生活'));
});
t('extractTags 排除 #p/high #p/low', ()=>{
  const tags = MD.extractTags('- [ ] 任务 #p/high #普通标签');
  ok(!tags.includes('p/high')); ok(tags.includes('普通标签'));
});
t('extractSummary：去标记、图片→[图]、≤120字', ()=>{
  const s = MD.extractSummary('## 标题\n这是**粗**文字 ![](a.jpg)');
  ok(s.includes('标题') && s.includes('粗') && s.includes('[图]')); ok(s.length<=120);
});
t('extractAttachRefs：图片 embed / 附件非 embed / 不重复计数', ()=>{
  const refs = MD.extractAttachRefs('![](a.jpg)\n![[b.png]]\n[文档](c.pdf)');
  eq(refs.length,3);
  eq(refs[0].embed,true); eq(refs[0].link,'a.jpg');
  eq(refs[1].embed,true); eq(refs[1].link,'b.png');
  eq(refs[2].embed,false); eq(refs[2].link,'c.pdf');
});

console.log('\n[6] htmlToMD（编辑器 HTML → MD）');
t('粗体 ** / 斜体 * / 删除线 ~~ / 高亮 ==', ()=>{
  const md = MD.htmlToMD('<p>a <strong>b</strong> <em>i</em> <del>d</del> <mark>h</mark></p>');
  ok(md.includes('**b**') && md.includes('*i*') && md.includes('~~d~~') && md.includes('==h=='));
});
t('下划线保留 <u></u>', ()=> ok(MD.htmlToMD('<p><u>x</u></p>').includes('<u>x</u>')));
t('行内 code → 反引号', ()=> ok(MD.htmlToMD('<p><code>x=1</code></p>').includes('`x=1`')));
t('h2 → ## ；h1 归一为 ##', ()=>{
  ok(MD.htmlToMD('<h2>节</h2>').startsWith('## 节'));
  ok(MD.htmlToMD('<h1>节</h1>').startsWith('## 节'));
});
t('引用块 > 前缀', ()=>{
  const md = MD.htmlToMD('<blockquote><p>一</p><p>二</p></blockquote>');
  ok(md.startsWith('> 一') && md.includes('> 二'));
});
t('无序列表 / 有序列表', ()=>{
  const md = MD.htmlToMD('<ul><li>甲</li><li>乙</li></ul><ol><li>一</li></ol>');
  ok(md.includes('- 甲') && md.includes('- 乙') && md.includes('1. 一'));
});
t('列表勾选 checked → - [x] / 未勾 → - [ ]', ()=>{
  const md = MD.htmlToMD('<ul><li><input type="checkbox" checked>已</li><li><input type="checkbox">未</li></ul>');
  ok(md.includes('- [x] 已') && md.includes('- [ ] 未'));
});
t('pre → 围栏代码块（带语言）', ()=>{
  const md = MD.htmlToMD('<pre class="language-js"><code>let a=1;</code></pre>');
  ok(md.includes('```js') && md.includes('let a=1;') && md.includes('```'));
});
t('hr → ---', ()=> ok(MD.htmlToMD('<p>a</p><hr><p>b</p>').includes('\n---\n')));
t('img → ![alt](src)', ()=> ok(MD.htmlToMD('<p><img src="x.jpg" alt="图"></p>').includes('![图](x.jpg)')));
t('a → [文字](href)', ()=> ok(MD.htmlToMD('<p><a href="x.pdf">文档</a></p>').includes('[文档](x.pdf)')));
t('span.md-wiki → [[双链]]', ()=> ok(MD.htmlToMD('<p><span class="md-wiki">笔记</span></p>').includes('[[笔记]]')));
t('嵌套内联：strong 内 em', ()=> ok(MD.htmlToMD('<p><strong>a <em>b</em></strong></p>').includes('**a *b***')));
t('空串 → 换行结尾的空串', ()=> eq(MD.htmlToMD(''), ''));

console.log('\n[7] 往返一致性（信息不丢）');
t('serialize(parse(md)) 再 parse，块类型序列一致', ()=>{
  const md = '---\nid:a\n---\n## 标题\n段落**粗**\n- 甲\n1. 乙\n- [ ] 待办\n> 引用\n```js\ncode\n```\n---\n![](a.jpg)';
  const p1 = MD.parse(md);
  const md2 = MD.serialize(p1.blocks, p1.fm);
  const p2 = MD.parse(md2);
  assert.deepStrictEqual(p2.blocks.map(b=>b.type), p1.blocks.map(b=>b.type));
});
t('HTML→MD→HTML：工具栏元素全部还原', ()=>{
  const html = '<h2>节</h2><p>文字<strong>粗</strong><em>斜</em><u>下</u><del>删</del><mark>亮</mark><code>c</code></p><blockquote><p>引</p></blockquote><ul><li>列</li></ul><hr>';
  const md = MD.htmlToMD(html);
  const h2 = MD.toHTML(md);
  ok(h2.includes('<strong>粗</strong>'));
  ok(h2.includes('<em>斜</em>'));
  ok(h2.includes('<u>下</u>'));
  ok(h2.includes('<del>删</del>'));
  ok(h2.includes('<mark class="md-hl">亮</mark>'));
  ok(h2.includes('<code class="md-code">c</code>'));
  ok(h2.includes('<blockquote'));
  ok(h2.includes('<ul>') && h2.includes('<li>列</li>'));
  ok(h2.includes('<hr'));
  ok(h2.includes('<h2'));
});
t('无 fm 纯 md：parse 后 fm=null，序列化不伪造 fm', ()=>{
  const p = MD.parse('## 笔记\n正文');
  eq(p.fm, null);
  const s = MD.serialize(p.blocks, null);
  ok(!s.startsWith('---'));
});
t('代码块内 HTML 实体还原：htmlToMD 后 toHTML 不注入标签', ()=>{
  const md = MD.htmlToMD('<pre><code>a &lt; b &amp; c</code></pre>');
  const h = MD.toHTML(md);
  ok(h.includes('a &lt; b &amp; c'));
});
t('标签/双链/附件 在 serialize(parse) 后仍可提取', ()=>{
  const md = '---\ntags: [工作]\n---\n#标签 [[双链]] ![](a.jpg) [b](c.pdf)';
  const md2 = MD.serialize(MD.parse(md).blocks, MD.parse(md).fm);
  ok(MD.extractTags(md2).includes('标签'));
  ok(MD.toHTML(md2).includes('md-wiki'));
  eq(MD.extractAttachRefs(md2).length,2);
});

console.log('\n========================================');
console.log('结果：PASS ' + pass + ' / FAIL ' + fail + ' （共 ' + (pass+fail) + ' 断言）');
if(fail){ console.log('失败用例：\n - ' + fails.join('\n - ')); process.exit(1); }
