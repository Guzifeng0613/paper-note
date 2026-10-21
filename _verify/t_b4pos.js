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
  await page.evaluate(()=>{
    const cards=document.querySelectorAll('#notesWrap .note-card');
    cards[2].click();cards[3].click();
  });
  await sleep(200);
  const tr=await page.evaluate(()=>{
    const t=document.querySelector('#bbDelete').getBoundingClientRect();
    return {x:t.left+t.width/2,y:t.top+t.height/2};
  });
  console.log('target center:',JSON.stringify(tr));
  await page.evaluate(()=>document.querySelector('#bbDelete').click());
  for(const ts of [50,150,250,350,450]){
    await sleep(ts===50?50:100);
    const pos=await page.evaluate(()=>Array.from(document.querySelectorAll('body > *')).filter(e=>e.style.zIndex==='300').map(e=>{
      const r=e.getBoundingClientRect();
      return {l:Math.round(r.left),t:Math.round(r.top),w:Math.round(r.width),h:Math.round(r.height),
        opacity:getComputedStyle(e).opacity,
        anims:e.getAnimations().map(a=>({name:a.animationName||a.effect&&a.effect.getKeyframes&&'wa',prog:a.playState})),
        play:e.getAnimations()[0]?Math.round(e.getAnimations()[0].currentTime):null};
    }));
    console.log('@'+ts+'ms:',JSON.stringify(pos));
  }
  await b.close();
})();
