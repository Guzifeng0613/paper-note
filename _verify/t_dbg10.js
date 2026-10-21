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
  const nid=await page.evaluate(()=>{
    const A=window.__app;
    const n={id:A.uid(),type:'todo',pinned:false,trashed:false,trashedAt:null,files:[],
      title:'终验',content:'',
      todos:[{id:A.uid(),text:'待办A',done:false,priority:'normal'},
             {id:A.uid(),text:'待办B',done:false,priority:'normal'}],
      color:'green',createdAt:Date.now(),updatedAt:Date.now()};
    A.notes.push(n);A.persist();
    location.hash='#/edit?id='+n.id;return n.id;
  });
  await sleep(500);
  const body=await page.$('#paperBody');
  await body.click();
  await page.keyboard.type('标签 #');
  await sleep(300);
  const dbg=await page.evaluate(()=>({
    html:document.querySelector('#paperBody').innerHTML.slice(0,200),
    sel:document.getSelection().anchorNode&&document.getSelection().anchorNode.nodeName,
    sug:document.querySelector('#nbSuggest')?document.querySelector('#nbSuggest').className:'null',
    active:document.activeElement.id
  }));
  console.log(JSON.stringify(dbg,null,1));
  await b.close();
})();
