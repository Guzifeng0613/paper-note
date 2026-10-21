/* a00_smoke.js — 启动冒烟：加载首页，抓 pageerror，dump v16root 结构 */
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
  const consoleMsgs = []; page.on('console', m => { if(m.type()==='error'||m.type()==='warning') consoleMsgs.push(m.type+': '+m.text()); });

  await page.goto('http://localhost:8765/index.html', { waitUntil: 'load' });
  await page.waitForTimeout(3000);

  const info = await page.evaluate(()=>{
    const r = document.getElementById('v16root');
    const out = { v16rootExists: !!r };
    if(r){
      out.visible = getComputedStyle(r).display !== 'none' && r.offsetWidth>0;
      out.scrs = [...r.querySelectorAll('.v16-scr')].map(s=>({scr:s.dataset.scr, on:s.classList.contains('on')}));
      out.folderCards = [...r.querySelectorAll('.v16-folder-card')].map(f=>f.dataset.folder || f.textContent.trim().slice(0,20));
      out.noteCards = [...r.querySelectorAll('.v16-note-card')].map(n=>({p:n.dataset.path, t:n.textContent.trim().slice(0,30)}));
      out.buttons = [...r.querySelectorAll('button,[data-act]')].map(b=>({id:b.id, cls:b.className.slice(0,40), txt:b.textContent.trim().slice(0,15)})).slice(0,40);
    }
    out.oldHomeVisible = !!document.querySelector('#scr-home.active');
    out.vaultType = window.Vault ? (window.Vault.constructor.name || 'object') : 'NO window.Vault';
    out.vuiKeys = window.VUI ? Object.keys(window.VUI) : 'NO VUI';
    return out;
  });
  console.log(JSON.stringify(info, null, 2));
  console.log('--- PAGEERRORS ('+errs.length+') ---'); errs.forEach(e=>console.log('  '+e));
  console.log('--- CONSOLE err/warn ('+consoleMsgs.length+') ---'); consoleMsgs.slice(0,20).forEach(e=>console.log('  '+e));
  await page.screenshot({ path: path.resolve(__dirname, 'shots/a00_home.png') });
  await browser.close();
})();
