const {chromium}=require('playwright');
const fs=require('fs');
const EXE='/opt/vm/preinstall/ms-playwright/chromium_headless_shell-1169/chrome-linux/headless_shell';
const BASE='/home/user/Doubao/chats/38443854002369026/notes-app/';
const OUT=BASE+'_perf/screens';fs.mkdirSync(OUT,{recursive:true});
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:EXE});
  const page=await browser.newPage({viewport:{width:390,height:844}});
  await page.goto('file://'+BASE+'index.html');
  await page.waitForFunction(()=>window.__app);await page.waitForTimeout(400);
  const ids=await page.evaluate(()=>{
    const A=window.__app;
    if(!A.notes.length)A.notes.push(...A.seed());
    if(!A.AIs.all().length){const cid=A.AIs.add({name:'演示',baseUrl:'https://x/v1',key:'k',model:'demo'});A.AIs.setCur(cid);}
    return {note:(A.notes.find(n=>n.type==='note')||{}).id,
      todo:(A.notes.find(n=>n.type==='todo')||{}).id};
  });
  const shot=n=>page.screenshot({path:OUT+'/'+n+'.png'});
  const goS=async h=>{await page.evaluate(h=>location.hash=h,h);await page.waitForTimeout(500);};

  await goS('#/home');await shot('01_home');
  await goS('#/edit?id='+ids.note);await shot('02_edit_note');
  await goS('#/edit?id='+ids.todo);await shot('03_edit_todo');
  await page.evaluate(()=>{const n=window.__app.notes.find(x=>!x.trashed);
    n.trashed=true;n.trashedAt=Date.now();window.__app.persist();});
  await goS('#/trash');await shot('04_trash');
  await page.evaluate(()=>{const n=window.__app.notes.find(x=>x.trashed);
    n.trashed=false;n.trashedAt=null;window.__app.persist();});
  await goS('#/settings');await shot('05_settings');
  await goS('#/pan');await shot('06_pan');
  await goS('#/search');
  await page.fill('#srInput','报告');await page.waitForTimeout(500);await shot('07_search');
  await goS('#/chat');await shot('08_chat');
  await goS('#/ai');await shot('09_ai');
  await goS('#/log');await shot('10_log');

  await goS('#/home');
  await page.evaluate(()=>window.__app.openNotebookPicker('filter'));
  await page.waitForTimeout(700);await shot('11_nb_picker');
  await page.click('#nbpClose');await page.waitForTimeout(400);

  await goS('#/edit?id='+ids.note);
  await page.click('#editNoteAI');await page.waitForTimeout(600);await shot('12_note_ai');
  await page.click('#naiBack');await page.waitForTimeout(400);

  await goS('#/chat');
  await page.click('#chatMenu');await page.waitForTimeout(500);await shot('13_chat_drawer');
  await page.click('#cdClose');await page.waitForTimeout(400);

  console.log('截图完成',fs.readdirSync(OUT).length,'张');
  await browser.close();
})();
