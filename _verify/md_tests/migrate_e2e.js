/* migrate e2e（Playwright + 真实浏览器 idb 后端）
   用法：node _verify/md_tests/migrate_e2e.js */
const {chromium} = require('playwright');
const path = require('path');
const EXE = '/opt/vm/preinstall/ms-playwright/chromium_headless_shell-1169/chrome-linux/headless_shell';

let pass = 0, fail = 0; const fails = [];
const t = (c, m) => { if(c){pass++; console.log('  PASS  '+m);} else {fail++; fails.push(m); console.log('  FAIL  '+m);} };

(async()=>{
  const b = await chromium.launch({headless:true, executablePath:EXE});
  const ctx = await b.newContext({viewport:{width:360,height:792}, isMobile:true, hasTouch:true, reducedMotion:'no-preference'});
  const page = await ctx.newPage();
  let pageerr = 0;
  page.on('pageerror', e => { pageerr++; console.log('[pageerror]', e.message); });
  await page.goto('file://'+path.resolve(__dirname,'e2e_page.html'));
  await page.waitForFunction(() => window.__result, {timeout:15000});
  const R = await page.evaluate(() => window.__result);

  console.log('\n[E2E] detect/backup/run/verify（idb 后端）');
  t(R.ok, '页面无异常跑完 ('+(R.ok?'OK':'ERR '+R.err)+')');
  if(R.ok){
    t(R.det.found && R.det.summary.notes===5, 'detect 命中旧库 5 篇');
    t(R.det.summary.trashed===1 && R.det.summary.attachments===3, '回收站 1 / 附件 3');
    t(/^迁移前备份-\d{8}\.zip$/.test(R.bak.name), '备份 zip 命名规范');
    t(R.bak.entries===4 && R.bak.zipEntries.includes('library.json'), '备份条目 library.json + 3 附件');
    t(R.rep.files===4 && R.rep.trash===1 && R.rep.attachments===3, '迁移：4 活跃 + 1 回收 + 3 附件');
    t(R.rep.failures.length===0, 'run 0 失败');
    t(R.rep.notes.includes('工作/产品灵感记录.md') && R.rep.notes.includes('工作/本周采购清单.md')
      && R.rep.notes.includes('随手记.md') && R.rep.notes.includes('生活/未命名.md'), '路径结构正确');
    t(R.v.parseRate===1 && R.v.files===4, 'verify parseRate=1 / 4 篇');
    t(R.v.attachments===2 && R.v.missingAttach.length===0, 'verify 附件引用 2 / 0 缺失');
    t(R.n1Has.bold && R.n1Has.hl && R.n1Has.img && R.n1Has.link && R.n1Has.ul && R.n1Has.quote, '富文本元素全部转换');
    t(R.n2Has.todo && R.n2Has.type, '待办优先级/type 正确');
    t(Array.isArray(R.trashList) && R.trashList.some(x=>/废弃草稿\.md$/.test(x.name)), '回收站列表可列出废弃草稿');
  }
  t(pageerr===0, '全程无 pageerror');

  console.log('\n========================================');
  console.log('E2E 结果：PASS '+pass+' / FAIL '+fail);
  if(fail){ console.log('失败：\n - '+fails.join('\n - ')); process.exitCode=1; }
  await b.close();
})().catch(e=>{ console.error('E2E 异常', e); process.exit(1); });
