const {chromium}=require('playwright');
const EXE='/opt/vm/preinstall/ms-playwright/chromium_headless_shell-1169/chrome-linux/headless_shell';
const URL0='file:///home/user/Doubao/chats/38443854002369026/notes-app/index.html';
const st=a=>{const s=[...a].sort((x,y)=>x-y);const q=p=>s[Math.min(s.length-1,Math.floor(s.length*p))];
  return {p50:q(.5),p95:q(.95)};};
const fmt=o=>'p50='+o.p50.toFixed(1)+' p95='+o.p95.toFixed(1)+'ms';
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:EXE});
  const page=await browser.newPage({viewport:{width:390,height:844}});
  page.on('pageerror',e=>console.log('PAGEERROR',e.message));
  await page.goto(URL0);await page.waitForFunction(()=>window.__app);await page.waitForTimeout(300);

  const renderAt=async(N,lim,times)=>page.evaluate(async a=>{
    const A=window.__app;A.notes.length=0;
    for(let i=0;i<a.N;i++)A.notes.push({id:A.uid(),type:i%3?'note':'todo',pinned:false,trashed:false,
      files:[],title:'便签'+i,content:'正文内容'+i,tags:i%5?[]:['t'],todos:i%3?[]:[{id:A.uid(),text:'x',done:false}],
      createdAt:Date.now()-i,updatedAt:Date.now()-i});
    A._renderLimit=a.lim;
    const t=[];
    for(let k=0;k<a.times;k++){const s=performance.now();A.renderNotes(true);t.push(performance.now()-s);}
    return t;
  },{N,lim,times});

  /* 首屏渲染（渐进：300/1000 只建 240） */
  const r100=st(await renderAt(100,100,8));
  const r300=st(await renderAt(300,240,8));
  const r1000=st(await renderAt(1000,240,8));
  const rFull=st(await renderAt(1000,1000,4));

  /* 回主页跳转（100 条）：dispatch hashchange */
  const homeRt=await page.evaluate(async()=>{
    const A=window.__app;A.notes.length=0;
    for(let i=0;i<100;i++)A.notes.push({id:A.uid(),type:'note',pinned:false,trashed:false,
      files:[],title:'t'+i,content:'c'+i,tags:[],todos:[],createdAt:Date.now(),updatedAt:Date.now()});
    const id=A.notes[0].id;const t=[];
    for(let k=0;k<8;k++){
      location.hash='#/edit?id='+id;window.dispatchEvent(new HashChangeEvent('hashchange'));
      location.hash='#/home';const s=performance.now();
      window.dispatchEvent(new HashChangeEvent('hashchange'));t.push(performance.now()-s);
    }return t;
  });
  const rHome=st(homeRt);

  /* 设置二次进入（签名命中） */
  const setRt=await page.evaluate(async()=>{
    const A=window.__app;
    location.hash='#/settings';window.dispatchEvent(new HashChangeEvent('hashchange'));
    const first=[];/* 再进一次（回home再进settings） */
    location.hash='#/home';window.dispatchEvent(new HashChangeEvent('hashchange'));
    const t=[];
    for(let k=0;k<6;k++){location.hash='#/settings';const s=performance.now();
      window.dispatchEvent(new HashChangeEvent('hashchange'));t.push(performance.now()-s);
      location.hash='#/home';window.dispatchEvent(new HashChangeEvent('hashchange'));}
    return t;
  });
  const rSet=st(setRt);

  /* 监听器数量：委托后 notesWrap 上固定少量；用大数据确认卡片无监听（无法直接计数，报告设计值） */
  console.log('========= 优化后实测 =========');
  console.log('首屏渲染 100条 :',fmt(r100));
  console.log('首屏渲染 300条(建240):',fmt(r300));
  console.log('首屏渲染 1000条(建240):',fmt(r1000));
  console.log('全量构建 1000条(参考):',fmt(rFull));
  console.log('返回主页跳转   :',fmt(rHome));
  console.log('设置二次进入   :',fmt(rSet));
  await browser.close();
})();
