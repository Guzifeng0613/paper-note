const {chromium}=require('playwright');const path=require('path');
const EXE='/opt/vm/preinstall/ms-playwright/chromium_headless_shell-1169/chrome-linux/headless_shell';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const b=await chromium.launch({headless:true,executablePath:EXE});
  const ctx=await b.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'no-preference'});
  const page=await ctx.newPage();
  page.on('pageerror',e=>console.log('[pageerror]',e.message));
  await page.goto('file://'+path.resolve('index.html'));
  await page.waitForFunction(()=>window.__app);await sleep(300);
  const nid=await page.evaluate(()=>{
    const A=window.__app;
    const n={id:A.uid(),type:'note',pinned:false,trashed:false,trashedAt:null,files:[],title:'T13',content:'',todos:[],color:'yellow',createdAt:Date.now(),updatedAt:Date.now()};
    A.notes.push(n);A.persist();
    location.hash='#/edit?id='+n.id;return n.id;
  });
  await sleep(500);
  await page.click('#editMore');await sleep(350);
  // 直接 .click() 调用，不走鼠标
  await page.evaluate(()=>document.querySelector('#dynOpts .sheet-opt.danger').click());
  await sleep(400);
  const s=await page.evaluate((id)=>{
    const n=window.__app.notes.find(x=>x.id===id);
    return{hash:location.hash,mask:document.querySelector('#mask').classList.contains('show'),trashed:n&&n.trashed};
  },nid);
  console.log('direct el.click():',s);
  await b.close();
})();
