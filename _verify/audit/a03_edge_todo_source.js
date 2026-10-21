/* a03_edge_todo_source.js — A10 左缘手势 + 待办勾选回写 + 源码模式 + 附件图片 */
'use strict';
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const browser = await chromium.launch({ headless: true,
    executablePath: '/opt/vm/preinstall/ms-playwright/chromium_headless_shell-1169/chrome-linux/headless_shell' });
  const ctx = await browser.newContext({ viewport: { width: 360, height: 792, deviceScaleFactor: 4 },
    isMobile: true, hasTouch: true, reducedMotion: 'no-preference' });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  const log = (...a) => console.log(...a);

  await page.goto('http://localhost:8765/index.html', { waitUntil: 'load' });
  await page.waitForSelector('#v16root .v16-folder-card', { timeout: 15000 });
  await page.waitForTimeout(800);

  log('VaultFS backend:', await page.evaluate(()=>window.VaultFS.backend()));

  /* 进 工作 → 打开待办笔记 */
  await page.evaluate(()=>{ window.VUI.state.curFolder=''; window.VUI.renderHome(); });
  await page.waitForTimeout(300);
  await page.evaluate(()=>{[...document.querySelectorAll('.v16-folder-card')].find(f=>f.dataset.folder==='工作').click();});
  await page.waitForTimeout(400);
  await page.evaluate(()=>{const c=[...document.querySelectorAll('.v16-note-card')].find(x=>x.dataset.path.includes('采购清单')); c.click();});
  await page.waitForSelector('#v16EdBody', {timeout:5000});
  await page.waitForTimeout(400);

  log('=== A2 待办勾选 ===');
  const todosBefore = await page.$$eval('.v16-ed-todoinput', els=>els.map(e=>({checked:e.checked})));
  log('待办 checkbox 数:', todosBefore.length, '已勾选:', todosBefore.filter(t=>t.checked).length);
  /* 勾一个未完成项 */
  const unchecked = await page.$$('.v16-ed-todoinput:not(:checked)');
  if(unchecked.length){
    await unchecked[0].click();
    await page.waitForTimeout(600);
  }
  const md = await page.evaluate(async()=>await window.VaultFS.read('工作/本周采购清单.md'));
  log('勾选后 .md 中 [ ]/[x] 行:');
  md.split('\n').filter(l=>/^\s*- \[[ xX]\]/.test(l)).forEach(l=>log('   '+l));

  log('\n=== A2 源码模式 ===');
  await page.click('#v16EdSource');
  await page.waitForTimeout(400);
  const isSource = await page.evaluate(()=>!!document.querySelector('#v16SourceTa'));
  log('切到源码模式 textarea:', isSource);
  if(isSource){
    try{
      const taVal = await page.$eval('#v16SourceTa', e=>e.value);
      log('源码 textarea 前 200 字:', taVal.slice(0,200));
      await page.fill('#v16SourceTa', taVal + '\n\n<!-- AUDIT_SOURCE_MARKER -->\n新写的一行源码内容');
      await page.waitForTimeout(900);
      const onDisk = await page.evaluate(async()=>await window.VaultFS.read('工作/本周采购清单.md'));
      log('源码编辑落盘含 AUDIT_SOURCE_MARKER?', onDisk.includes('AUDIT_SOURCE_MARKER'));
      log('源码编辑落盘含"新写的一行源码内容"?', onDisk.includes('新写的一行源码内容'));
    }catch(e){ log('源码模式异常:', e.message); }
  }

  log('\n=== A10 左缘返回手势（v16 编辑器屏） ===');
  const scrBefore = await page.evaluate(()=>document.querySelector('.v16-scr.on')?.dataset.scr);
  log('手势前 on 的 v16-screen:', scrBefore);
  /* 旧 navStack 状态 */
  const navInfo = await page.evaluate(()=>({
    appChildren: document.querySelectorAll('#app > .screen').length,
    oldActiveScr: document.querySelector('#app > .screen.active')?.id
  }));
  log('旧 v15 激活屏:', navInfo.oldActiveScr);
  /* 从左缘跟手拖动 */
  await page.mouse.move(5, 400);
  await page.mouse.down();
  for(let x=5; x<=300; x+=12){ await page.mouse.move(x, 400); await page.waitForTimeout(14); }
  const draggedTransform = await page.evaluate(()=>{
    const d=document.querySelector('.nav-dragging'); return d? getComputedStyle(d).transform : 'NO .nav-dragging';
  });
  await page.mouse.up();
  await page.waitForTimeout(600);
  log('拖动中是否有 .nav-dragging 元素:', draggedTransform);
  const scrAfter = await page.evaluate(()=>document.querySelector('.v16-scr.on')?.dataset.scr);
  log('抬手后 on 的 v16-screen:', scrAfter, '（期望 home）');
  /* 再试一次：从左缘拖，模拟更像手机的 touch */
  await page.evaluate(()=>{ const c=[...document.querySelectorAll('.v16-note-card')].find(x=>x.dataset.path.includes('采购清单')); if(c)c.click(); });
  await page.waitForSelector('#v16EdBody', {timeout:5000});
  await page.waitForTimeout(300);
  /* CDP touch 事件 */
  const client = await ctx.newCDPSession(page);
  await client.send('Input.dispatchTouchEvent',{type:'touchStart', touchPoints:[{x:5,y:400,id:1,radiusX:5,radiusY:5}]});
  for(let x=5;x<=260;x+=15){
    await client.send('Input.dispatchTouchEvent',{type:'touchMove', touchPoints:[{x,y:400,id:1,radiusX:5,radiusY:5}]});
    await page.waitForTimeout(14);
  }
  await client.send('Input.dispatchTouchEvent',{type:'touchEnd', touchPoints:[]});
  await page.waitForTimeout(600);
  const scrAfterTouch = await page.evaluate(()=>document.querySelector('.v16-scr.on')?.dataset.scr);
  log('touch 手势后 on 的 v16-screen:', scrAfterTouch);

  log('\n=== A4 附件：图片插入（模拟 file chooser） ===');
  /* 当前应在编辑器 */
  const isEditor = await page.evaluate(()=>document.querySelector('.v16-scr.on')?.dataset.scr==='editor');
  log('当前在编辑器?', isEditor);
  if(isEditor){
    /* 准备一张小 png */
    const pngB64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    await page.evaluate(async (b64)=>{
      const bin=atob(b64); const arr=new Uint8Array(bin.length);
      for(let i=0;i<bin.length;i++)arr[i]=bin.charCodeAt(i);
      const blob=new Blob([arr],{type:'image/png'});
      const rel = await window.VaultFS.writeAttachment('audit.png', blob, window.VUI.state._cur.entry.path);
      window.__attachRel = rel;
    }, pngB64);
    const rel = await page.evaluate(()=>window.__attachRel);
    log('VaultFS.writeAttachment 返回相对路径:', rel);
    const exists = await page.evaluate(async(r)=>{ try{ await window.VaultFS.readBlob(r); return true; }catch(e){ return e.message; } }, rel);
    log('附件文件在 vault 中可读:', exists);
    /* 大图查看器 DOM */
    log('#v16ImgViewer 存在?', await page.$('#v16ImgViewer')!==null);
  }

  log('\n=== pageerrors ('+errs.length+') ==='); errs.forEach(e=>log('  '+e));
  await browser.close();
})();
