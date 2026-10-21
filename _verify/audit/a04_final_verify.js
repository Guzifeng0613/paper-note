/* a04_final_verify.js — 源码模式落盘长等待 + 待办回写路径 + 动效 CSS 证据 */
'use strict';
const { chromium } = require('playwright');
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

  await page.evaluate(()=>{[...document.querySelectorAll('.v16-folder-card')].find(f=>f.dataset.folder==='工作').click();});
  await page.waitForTimeout(400);
  await page.evaluate(()=>{const c=[...document.querySelectorAll('.v16-note-card')].find(x=>x.dataset.path.includes('采购清单')); c.click();});
  await page.waitForSelector('#v16EdBody', {timeout:5000});
  await page.waitForTimeout(400);

  log('=== 待办 checkbox：点击后是否落盘 ===');
  /* 当前 checked 状态 */
  let boxes = await page.$$eval('.v16-ed-todoinput', els=>els.map(e=>e.checked));
  log('点击前 checkbox.checked:', boxes);
  const before = await page.evaluate(async()=>await window.VaultFS.read('工作/本周采购清单.md'));
  /* 点第一个 unchecked */
  await page.evaluate(()=>{const inp=document.querySelector('.v16-ed-todoinput:not(:checked)'); if(inp){ inp.click(); inp.dispatchEvent(new Event('input',{bubbles:true})); inp.dispatchEvent(new Event('change',{bubbles:true})); }});
  await page.waitForTimeout(1500);
  const after = await page.evaluate(async()=>await window.VaultFS.read('工作/本周采购清单.md'));
  const bBefore = before.split('\n').filter(l=>/^\s*- \[[ xX]\]/.test(l));
  const bAfter  = after.split('\n').filter(l=>/^\s*- \[[ xX]\]/.test(l));
  log('落盘前 todo 行:', bBefore);
  log('落盘后 todo 行:', bAfter);
  log('勾选回写生效?', JSON.stringify(bBefore)!==JSON.stringify(bAfter));

  log('\n=== 源码模式：长等待（1.6s）后落盘 ===');
  await page.click('#v16EdSource'); await page.waitForTimeout(300);
  const taVal = await page.$eval('#v16SourceTa', e=>e.value);
  await page.fill('#v16SourceTa', taVal + '\nAUDIT_LONG_WAIT_MARKER');
  await page.waitForTimeout(1600);
  const onDisk = await page.evaluate(async()=>await window.VaultFS.read('工作/本周采购清单.md'));
  log('长等待后落盘含 MARKER?', onDisk.includes('AUDIT_LONG_WAIT_MARKER'));

  log('\n=== 字体选择/字号刻度尺：v16 是否真的改了 CSS 变量 ===');
  await page.evaluate(()=>{ window.VUI.show('settings'); window.VUI.renderSettings(); });
  await page.waitForTimeout(400);
  const beforeFontScale = await page.evaluate(()=>getComputedStyle(document.getElementById('v16root')).fontSize);
  /* 点字号刻度尺 row（stub） */
  await page.evaluate(()=>{[...document.querySelectorAll('.v16-row[data-row]')].find(r=>r.dataset.row==='fontscale').click();});
  await page.waitForTimeout(300);
  const afterFontScale = await page.evaluate(()=>getComputedStyle(document.getElementById('v16root')).fontSize);
  log('字号刻度尺点击前 fontSize:', beforeFontScale, ' 点击后:', afterFontScale, ' 有变化?', beforeFontScale!==afterFontScale);

  log('\n=== 动效证据：v16 CSS transition/keyframes ===');
  const cssInfo = await page.evaluate(()=>{
    let kf=0, tr=0;
    for(const ss of document.styleSheets){
      let rules; try{ rules=ss.cssRules; }catch(e){ continue; }
      for(const r of rules){
        if(r.type===7) kf++; /* CSSKeyframesRule */
        if(r.style && r.style.transitionProperty && r.style.transitionProperty!=='all' && r.style.transitionProperty!=='none') tr++;
      }
    }
    return { keyframes:kf, transitionRules:tr };
  });
  log('document.styleSheets 中 keyframes 数:', cssInfo.keyframes, ' transition 规则数:', cssInfo.transitionRules);

  log('\npageerrors:', errs);
  await browser.close();
})();
