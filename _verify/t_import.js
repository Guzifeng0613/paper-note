/* 文件导入验收：JSON 备份（含 notes）→ 合并 → 写回 vault */
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

  // 构造 JSON 备份
  const libJson = JSON.stringify({
    notes:[
      {id:'imp-1', title:'导入笔记甲', content:'这是导入的内容甲', color:'', tags:[], todos:[], files:[], pinned:false, updated:Date.now()}
    ],
    prefs:{}
  });
  // 通过统一导入入口（浏览器端走 #importUnified file input）
  await page.setInputFiles('#importUnified', {name:'library.json', mimeType:'application/json', buffer:Buffer.from(libJson)});
  await sleep(700);
  // 弹窗出现，点合并
  const modalShown=await page.evaluate(()=>document.getElementById('modal').classList.contains('show'));
  check('导入确认弹窗出现',modalShown);
  await page.evaluate(()=>document.getElementById('uimm').click());
  await sleep(2000);
  // 验证笔记进入 legacy 模型
  const inLegacy=await page.evaluate(()=>window.__hasNote('imp-1'));
  check('导入笔记进入数据模型',inLegacy);
  // 验证写回 vault（文件存在）
  await page.evaluate(()=>window.__opIdle());
  const inVault=await page.evaluate(async()=>{
    try{ const e=await Vault.get('导入笔记甲.md'); return !!(e&&e.entry); }
    catch(_){ return false; }
  });
  check('导入笔记写回 vault 文件',inVault);

  let pass=0;
  results.forEach(r=>{ console.log((r.pass?'✓ ':'✗ ')+r.name); if(r.pass)pass++; });
  console.log('通过: '+pass+'/'+results.length);
  if(errs.length)console.log('PAGEERR:',errs);
  if(pass!==results.length)process.exit(1);
  await browser.close();
})();
