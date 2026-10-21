const {chromium}=require('playwright');const path=require('path');const fs=require('fs');
const EXE='/opt/vm/preinstall/ms-playwright/chromium_headless_shell-1169/chrome-linux/headless_shell';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const b=await chromium.launch({headless:true,executablePath:EXE});
  const ctx=await b.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'no-preference'});
  const page=await ctx.newPage();
  let err=0;page.on('pageerror',e=>{err++;console.log('[pageerror]',e.message)});
  const assert=(c,m)=>{if(c)console.log('PASS:',m);else{console.log('FAIL:',m);process.exitCode=1;}};
  /* 用 canvas 生成两张不同纯色 PNG 落盘 */
  const shot=await page.evaluate(({c1,c2})=>{
    const make=(c)=>{const cv=document.createElement('canvas');cv.width=200;cv.height=200;
      const x=cv.getContext('2d');x.fillStyle=c;x.fillRect(0,0,200,200);return cv.toDataURL('image/png');};
    return[make(c1),make(c2)];
  },{c1:'#d29e14',c2:'#7aa5c9'});
  for(let i=0;i<2;i++){
    const data=shot[i].split(',')[1];
    fs.writeFileSync('/tmp/iv'+i+'.png',Buffer.from(data,'base64'));
  }
  await page.goto('file://'+path.resolve('index.html'));
  await page.waitForFunction(()=>window.__app);await sleep(400);
  const nid=await page.evaluate(()=>{
    const A=window.__app;
    const n={id:A.uid(),type:'note',pinned:false,trashed:false,trashedAt:null,files:[],
      title:'图片验收',content:'',todos:[],color:'cream',createdAt:Date.now(),updatedAt:Date.now()};
    A.notes.push(n);A.persist();
    location.hash='#/edit?id='+n.id;return n.id;
  });
  await sleep(500);
  /* 插入两张图：点 dock 加号 → 插入图片 → filechooser */
  for(let i=0;i<2;i++){
    const fcP=page.waitForEvent('filechooser');
    await page.click('#dockAdd');
    await sleep(300);
    await page.evaluate(()=>{
      /* 找到 action sheet 里“插入图片”的按钮 */
      const bs=[...document.querySelectorAll('#dynOpts .sheet-opt')];
      const b=bs.find(x=>x.textContent.includes('插入图片'));
      if(b)b.click();
    });
    const fc=await fcP;
    await fc.setFiles('/tmp/iv'+i+'.png');
    await sleep(900);
  }
  const imgCount=await page.evaluate(()=>document.querySelectorAll('#paperBody img.note-img').length);
  assert(imgCount===2,'正文插入 2 张图片（实际 '+imgCount+'）');
  /* 点第一张图 → 工具条 → 查看 */
  const p=await page.evaluate(()=>{
    const im=document.querySelector('#paperBody img.note-img');
    im.scrollIntoView({block:'center'});
    const rc=im.getBoundingClientRect();
    return{x:rc.left+rc.width/2,y:rc.top+rc.height/2};
  });
  await page.mouse.click(p.x,p.y);
  await sleep(300);
  const bar=await page.evaluate(()=>document.querySelector('#imgBar').style.display==='flex');
  assert(bar,'#11 点图出现工具条');
  await page.click('#imgBarView');
  await sleep(600);
  const opened=await page.evaluate(()=>{
    const v=document.querySelector('#imgViewer');
    return{show:v.classList.contains('show'),
      slides:v.querySelectorAll('.iv-slide').length,
      idx:document.querySelector('#ivIdx').textContent,
      src:[...v.querySelectorAll('.iv-slide img')].map(im=>im.src.slice(0,12))};
  });
  assert(opened.show&&opened.slides===2&&opened.idx==='1 / 2','#11 查看器打开 2 张图，页码 1/2（'+JSON.stringify(opened)+'）');
  assert(opened.src[0].startsWith('blob:'),'#11 图片已加载 blob URL');
  /* 左右切换：向左滑超过 22% */
  await page.mouse.move(260,420);await page.mouse.down();
  await page.mouse.move(120,420,{steps:4});
  await page.mouse.move(60,420,{steps:3});
  await sleep(60);
  await page.mouse.up();
  await sleep(500);
  const pg2=await page.evaluate(()=>document.querySelector('#ivIdx').textContent);
  assert(pg2==='2 / 2','#11 左滑切到第 2 张（'+pg2+'）');
  /* 再向右滑回来 */
  await page.mouse.move(120,420);await page.mouse.down();
  await page.mouse.move(300,420,{steps:6});
  await page.mouse.up();
  await sleep(500);
  const pg1=await page.evaluate(()=>document.querySelector('#ivIdx').textContent);
  assert(pg1==='1 / 2','#11 右滑回到第 1 张（'+pg1+'）');
  /* 双指缩放：两根 pointer 拉开 */
  const pinch=await page.evaluate(()=>{
    const stage=document.querySelector('#ivStage');
    const pe=(t,x,y,id)=>stage.dispatchEvent(new PointerEvent(t,{bubbles:true,cancelable:true,
      clientX:x,clientY:y,pointerId:id,pointerType:'touch'}));
    pe('pointerdown',140,420,1);
    pe('pointerdown',250,420,2);
    for(let k=1;k<=4;k++){
      pe('pointermove',140-18*k,420,1);
      pe('pointermove',250+18*k,420,2);
    }
    const m=document.querySelector('#ivStrip .iv-slide img');
    const tf=getComputedStyle(m).transform;
    return{tf,hasScale:tf.includes('scale')||tf.includes('matrix')};
  });
  assert(pinch.hasScale&&!pinch.tf.includes('matrix(1,0,0,1,0,0)'),'#11 双指捏合缩放生效（'+pinch.tf+'）');
  /* 松手结束双指 */
  await page.evaluate(()=>{
    const s=document.querySelector('#ivStage');
    s.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,clientX:68,clientY:420,pointerId:1,pointerType:'touch'}));
    s.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,clientX:322,clientY:420,pointerId:2,pointerType:'touch'}));
  });
  await sleep(400);
  /* 双击复位：放大状态下双击应回到 1 */
  const dblTap=()=>page.evaluate(()=>{
    const s=document.querySelector('#ivStage');
    const mk=(id)=>{
      s.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,clientX:195,clientY:420,pointerId:id,pointerType:'mouse'}));
      s.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,clientX:195,clientY:420,pointerId:id,pointerType:'mouse'}));
    };
    mk(3);mk(3);
  });
  await dblTap();
  await sleep(500);
  const dblReset=await page.evaluate(()=>{
    const m=document.querySelector('#ivStrip .iv-slide img');
    const t=getComputedStyle(m).transform;
    return t==='none'||t==='matrix(1, 0, 0, 1, 0, 0)';
  });
  assert(dblReset,'#11 双击在放大状态下复位');
  /* 再双击：放大到 2.4 */
  await dblTap();
  await sleep(500);
  const dblZoom=await page.evaluate(()=>{
    const m=document.querySelector('#ivStrip .iv-slide img');
    const t=getComputedStyle(m).transform;
    return t!=='none'&&t!=='matrix(1, 0, 0, 1, 0, 0)';
  });
  assert(dblZoom,'#11 双击放大到 2.4 倍');
  /* 关闭后重新点图打开，验证下拉关闭 */
  await page.evaluate(()=>{document.querySelector('#ivClose').click();});
  await sleep(400);
  assert(!await page.evaluate(()=>document.querySelector('#imgViewer').classList.contains('show')),'#11 关闭按钮可关闭');
  const p2=await page.evaluate(()=>{
    const im=document.querySelector('#paperBody img.note-img');
    im.scrollIntoView({block:'center'});
    const rc=im.getBoundingClientRect();
    return{x:rc.left+rc.width/2,y:rc.top+rc.height/2};
  });
  await page.mouse.click(p2.x,p2.y);
  await sleep(300);
  await page.click('#imgBarView');
  await sleep(600);
  await page.mouse.move(195,420);await page.mouse.down();
  await page.mouse.move(195,560,{steps:5});
  await page.mouse.move(195,640,{steps:4});
  const dim=await page.evaluate(()=>{
    const bg=getComputedStyle(document.querySelector('#imgViewer')).backgroundColor;
    return{bg};
  });
  await page.mouse.up();
  await sleep(500);
  const closed=await page.evaluate(()=>!document.querySelector('#imgViewer').classList.contains('show'));
  assert(closed,'#11 下拉超过阈值关闭查看器（'+JSON.stringify(dim)+'）');
  await page.screenshot({path:'_verify/shots/c_viewer.png'});
  console.log('errors:',err);
  await b.close();
})();
