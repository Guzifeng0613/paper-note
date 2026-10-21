const {chromium}=require('playwright');const path=require('path');
const EXE='/opt/vm/preinstall/ms-playwright/chromium_headless_shell-1169/chrome-linux/headless_shell';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const b=await chromium.launch({headless:true,executablePath:EXE});
  const ctx=await b.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'no-preference'});
  const page=await ctx.newPage();
  page.on('pageerror',e=>console.log('[pageerror]',e.message));
  const assert=(c,m)=>{if(c)console.log('PASS:',m);else{console.log('FAIL:',m);process.exitCode=1;}};
  await page.goto('file://'+path.resolve('index.html'));
  await page.waitForFunction(()=>window.__app);await sleep(400);
  const nid=await page.evaluate(()=>{
    const A=window.__app;
    const n={id:A.uid(),type:'note',pinned:false,trashed:false,trashedAt:null,files:[],
      title:'V',content:'',todos:[],color:'cream',createdAt:Date.now(),updatedAt:Date.now()};
    A.notes.push(n);A.persist();location.hash='#/edit?id='+n.id;return n.id;
  });
  await sleep(500);
  /* 造一个查看器 DOM 并打开（模拟 openImgViewer 后的状态） */
  const open=await page.evaluate(()=>{
    if(!document.querySelector('.img-viewer')){
      const d=document.createElement('div');d.className='img-viewer';d.innerHTML='<div class="iv-stage"></div>';
      document.body.appendChild(d);
    }
    document.querySelector('.img-viewer').classList.add('show');
    return !!document.querySelector('.img-viewer.show');
  });
  assert(open,'查看器打开');
  await page.evaluate(()=>location.hash='#/home');
  await sleep(500);
  const gone=await page.evaluate(()=>!document.querySelector('.img-viewer.show'));
  assert(gone,'离开编辑器后大图查看器被收走（commitEditor 清理）');
  await b.close();
})();
