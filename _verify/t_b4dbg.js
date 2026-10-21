const {chromium}=require('playwright');const path=require('path');
const EXE='/opt/vm/preinstall/ms-playwright/chromium_headless_shell-1169/chrome-linux/headless_shell';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const b=await chromium.launch({headless:true,executablePath:EXE});
  const ctx=await b.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'no-preference'});
  const page=await ctx.newPage();
  page.on('pageerror',e=>console.log('[pageerror]',e.message));
  await page.goto('file://'+path.resolve('index.html'));
  await page.waitForFunction(()=>window.__app);await sleep(400);
  await page.evaluate(()=>location.hash='#/home');await sleep(300);
  await page.evaluate(()=>{const c=document.querySelector('#notesWrap .note-card');window.__app.enterSelect(c.dataset.id);});
  await sleep(200);
  await page.evaluate(()=>document.querySelector('#selectAll').click());
  await sleep(450);
  await page.evaluate(()=>document.querySelector('#selectAll').click());
  await sleep(350);
  const info=await page.evaluate(()=>{
    const cards=Array.from(document.querySelectorAll('#notesWrap .note-card'));
    const domTitles=cards.map(c=>c.querySelector('.nc-title')?c.querySelector('.nc-title').textContent:'?');
    cards[0].click();cards[1].click();
    return {domTitles,
      selected:Array.from(document.querySelectorAll('#notesWrap .sel-circle.on')).map(e=>e.closest('.note-card').querySelector('.nc-title').textContent)};
  });
  console.log('DOM 顺序:',JSON.stringify(info.domTitles));
  console.log('选中:',JSON.stringify(info.selected));
  await page.evaluate(()=>document.querySelector('#bbDelete').click());
  await sleep(700);
  const after=await page.evaluate(()=>({
    visible:Array.from(document.querySelectorAll('#notesWrap .note-card')).map(c=>c.querySelector('.nc-title').textContent),
    trashed:window.__app.notes.filter(n=>n.trashed).map(n=>n.title)
  }));
  console.log('删除后可见:',JSON.stringify(after.visible));
  console.log('回收站:',JSON.stringify(after.trashed));
  await b.close();
})();
