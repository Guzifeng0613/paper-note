const {chromium}=require('playwright');const path=require('path');
const EXE='/opt/vm/preinstall/ms-playwright/chromium_headless_shell-1169/chrome-linux/headless_shell';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const b=await chromium.launch({headless:true,executablePath:EXE});
  const ctx=await b.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'no-preference'});
  const page=await ctx.newPage();
  await page.goto('file://'+path.resolve('index.html'));
  await page.waitForFunction(()=>window.__app);await sleep(400);
  const nid=await page.evaluate(()=>{
    const A=window.__app;
    const n={id:A.uid(),type:'note',pinned:false,trashed:false,trashedAt:null,files:[],
      title:'X',content:'',todos:[],color:'cream',createdAt:Date.now(),updatedAt:Date.now()};
    A.notes.push(n);A.persist();location.hash='#/edit?id='+n.id;return n.id;
  });
  await sleep(500);
  for(const theme of ['light','dark']){
    await page.evaluate(t=>{window.__app.prefs.theme=t;window.__app.persistPrefs();window.__app.applyTheme();},theme);
    await page.click('#editMore');await sleep(300);
    const c=await page.evaluate(()=>{
      const btns=document.querySelectorAll('#dynOpts .sheet-opt');
      const del=btns[btns.length-1];
      const span=del.querySelector('span:nth-child(2)');
      return{span:getComputedStyle(span).color,btn:getComputedStyle(del).color};
    });
    console.log(theme,JSON.stringify(c));
    await page.evaluate(()=>window.__dismissOverlay());
    await sleep(200);
  }
  await b.close();
})();
