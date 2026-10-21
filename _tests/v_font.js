const {chromium}=require('playwright');
(async()=>{
  const browser=await chromium.launch({headless:true,
    executablePath:'/opt/vm/preinstall/ms-playwright/chromium_headless_shell-1169/chrome-linux/headless_shell'});
  const page=await browser.newPage({viewport:{width:390,height:844}});
  const errs=[];page.on('console',m=>{if(m.type()==='error')errs.push(m.text());});
  await page.goto('file:///home/user/Doubao/chats/38443854002369026/notes-app/index.html');
  await page.waitForFunction(()=>window.__app,{timeout:8000});
  const r=[];
  await page.evaluate(()=>location.hash='#/settings');
  await page.waitForTimeout(200);
  r.push(['外观卡片有显示字体行',await page.$('#fontRow')!==null]);
  r.push(['默认显示系统默认',(await page.textContent('#fontRow')).includes('系统默认')]);
  await page.click('#fontRow');
  await page.waitForTimeout(150);
  r.push(['字体弹窗打开',await page.$('#modal .pick-list')!==null]);
  r.push(['列出5种字体',(await page.$$('#modal .pick-row')).length===5]);
  r.push(['含微软雅黑',await page.$('#modal .pick-row[data-k="yahei"]')!==null]);
  r.push(['只列字体名、无样例预览句',!(await page.textContent('#modal .pick-list')).includes('永和九年')]);
  const diagF=await page.evaluate(()=>{const el=document.querySelector('#modal .pick-row[data-k="system"] .pr-name');return el?el.getAttribute('style'):'NONE';});
  console.log('FONT DIAG:',diagF);
  r.push(['字体名以自身字体渲染',!!(diagF&&diagF.includes('font-family'))]);
  r.push(['当前系统默认被选中',await page.$('#modal .pick-row[data-k="system"].on')!==null]);
  await page.click('#modal .pick-row[data-k="wenkai"]');
  await page.waitForTimeout(200);
  const after=await page.evaluate(()=>({
    font:window.__app.prefs.font,
    var:getComputedStyle(document.documentElement).getPropertyValue('--font-base'),
    link:(function(l){return l?l.href:'';})(document.querySelector('link[href*="lxgw"]'))
  }));
  r.push(['prefs.font=wenkai',after.font==='wenkai']);
  r.push(['--font-base含LXGW',after.var.includes('LXGW')]);
  r.push(['注入文楷regular样式',after.link.includes('lxgwwenkai-regular')]);
  r.push(['设置行更新为霞鹜文楷',(await page.textContent('#fontRow')).includes('霞鹜文楷')]);
  await page.click('#fontRow');
  await page.waitForTimeout(150);
  await page.click('#modal .pick-row[data-k="serif"]');
  await page.waitForTimeout(150);
  const s=await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--font-base'));
  r.push(['可切到思源宋体',s.includes('Noto Serif SC')]);
  let pass=0;r.forEach(([n,ok])=>{console.log((ok?'PASS':'FAIL')+' | '+n);if(ok)pass++;});
  console.log('\n'+pass+'/'+r.length);console.log('console错误:',errs.length?errs:'无');
  await browser.close();
})();
