/* 知识库切片 + RAG 检索验收：vault 笔记 → 同步 → 切片 → 检索命中 */
const { chromium } = require('playwright');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const browser=await chromium.launch({ executablePath:'/opt/vm/preinstall/ms-playwright/chromium_headless_shell-1169/chrome-linux/headless_shell', args:['--no-sandbox'] });
  const page=await browser.newPage({viewport:{width:360,height:792},deviceScaleFactor:4,hasTouch:false});
  const errs=[];
  page.on('pageerror',e=>errs.push('PAGEERR:'+e.message));
  const results=[];
  const check=(name,cond)=>results.push({name,pass:!!cond});

  await page.goto('http://localhost:8765/index.html',{waitUntil:'load'});
  await sleep(2500);

  // 新建一篇含明确关键词的笔记
  await page.click('#v16Fab'); await sleep(500);
  await page.evaluate(()=>document.querySelector('.v16-fab-item[data-f="note"]').click());
  await sleep(1200);
  const body=await page.$('#v16EdBody');
  await body.click({position:{x:100,y:100}});
  await page.keyboard.type('量子计算的核心是量子比特，它可以处于叠加态。');
  await sleep(1200);
  // 退出回首页，确保落盘
  await page.click('#v16EdBack');
  await sleep(1000);

  // 同步 vault → 旧模型
  await page.evaluate(()=>window.__testKB.sync());
  await sleep(800);
  // 构建切片
  await page.evaluate(()=>window.__testKB.build());
  await sleep(3000);
  const info=await page.evaluate(()=>window.__testKB.kbInfo());
  check('知识库可用且有切片',info.available && info.chunks>0);

  // 检索
  const hits=await page.evaluate(()=>window.__testKB.search('量子比特叠加态'));
  const got=Array.isArray(hits)&&hits.some(h=>JSON.stringify(h).includes('量子比特'));
  check('RAG 检索命中切片',got);

  let pass=0;
  results.forEach(r=>{ console.log((r.pass?'✓ ':'✗ ')+r.name); if(r.pass)pass++; });
  console.log('通过: '+pass+'/'+results.length);
  if(errs.length)console.log('PAGEERR:',errs);
  if(pass!==results.length)process.exit(1);
  await browser.close();
})();
