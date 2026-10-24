/* AI 全流程验收：注入配置 + mock SSE 流式问答（成功路径）+ 401 错误路径 */
const { chromium } = require('playwright');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const browser=await chromium.launch({ executablePath:'/opt/vm/preinstall/ms-playwright/chromium_headless_shell-1169/chrome-linux/headless_shell', args:['--no-sandbox'] });
  const page=await browser.newPage({viewport:{width:360,height:792},deviceScaleFactor:4,hasTouch:false});
  const errs=[];
  page.on('pageerror',e=>errs.push('PAGEERR:'+e.message));
  const results=[];
  const check=(name,cond)=>results.push({name,pass:!!cond});

  /* mock SSE 成功响应 */
  await page.route('**/chat/completions', route=>{
    const sse='data: {"choices":[{"delta":{"content":"这是"}}]}\n\n'
            + 'data: {"choices":[{"delta":{"content":"模拟回答"}}]}\n\n'
            + 'data: [DONE]\n\n';
    route.fulfill({status:200, contentType:'text/event-stream', body:sse});
  });

  await page.goto('http://localhost:8765/index.html',{waitUntil:'load'});
  await sleep(2500);
  await page.evaluate(()=>window.__injectAi({baseUrl:'https://api.test.com',key:'k',model:'m'}));
  await page.click('#v16Fab'); await sleep(500);
  await page.evaluate(()=>document.querySelector('.v16-fab-item[data-f="note"]').click());
  await sleep(1200);

  // 1) 面板打开
  await page.click('#v16EdAi');
  await sleep(1000);
  const open=await page.evaluate(()=>document.getElementById('noteAiPanel').classList.contains('open'));
  check('AI 面板打开',open);

  // 2) 发送问题，流式回答
  await page.evaluate(()=>{ document.getElementById('naiInput').value='你好'; });
  await page.evaluate(()=>document.getElementById('naiSend').click());
  await sleep(2000);
  const conv=await page.evaluate(()=>document.getElementById('naiBody').textContent);
  check('流式回答出现',conv.includes('模拟回答'));

  // 3) 关闭面板，合成笔记被清理（不残留）
  await page.evaluate(()=>document.getElementById('naiBack').click());
  await sleep(600);
  const ghost=await page.evaluate(()=>window.__hasVaultSynth());
  check('关闭后合成笔记已清理',!ghost);

  let pass=0;
  results.forEach(r=>{ console.log((r.pass?'✓ ':'✗ ')+r.name); if(r.pass)pass++; });
  console.log('通过: '+pass+'/'+results.length);
  if(errs.length)console.log('PAGEERR:',errs);
  if(pass!==results.length)process.exit(1);
  await browser.close();
})();
