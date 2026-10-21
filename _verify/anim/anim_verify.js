/* anim_verify.js —— v16 动效真机尺寸逐项真实验证
   360×792 / deviceScaleFactor4 / isMobile / hasTouch / reducedMotion:'no-preference'
   逐项触发并断言「真实属性发生变化」，输出 PASS/FAIL；全程统计 pageerror。
   运行：node _verify/anim/anim_verify.js
*/
'use strict';
const { chromium } = require('playwright');

const URL = 'http://localhost:8765/index.html';
const results = [];
function report(id, name, pass, evidence){
  results.push({ id, name, pass });
  console.log((pass?'PASS':'FAIL')+' ['+id+'] '+name+'  | '+(evidence||''));
}
const sleep = (ms)=> new Promise(r=>setTimeout(r, ms));

(async ()=>{
  const browser = await chromium.launch({ headless: true,
    executablePath: '/opt/vm/preinstall/ms-playwright/chromium_headless_shell-1169/chrome-linux/headless_shell' });
  const ctx = await browser.newContext({ viewport: { width: 360, height: 792, deviceScaleFactor: 4 },
    isMobile: true, hasTouch: true, reducedMotion: 'no-preference' });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));

  async function boot(){
    await page.goto(URL, { waitUntil: 'load' });
    await page.waitForTimeout(2800);
  }
  async function enterFolder(name){
    await page.evaluate((n)=>{
      const f = [...document.querySelectorAll('#v16Body .v16-folder-card')].find(c=>c.dataset.folder===n || c.textContent.includes(n));
      if(f) f.click();
    }, name);
    await page.waitForTimeout(700);
  }
  async function openNote(kw){
    await page.evaluate((k)=>{
      const c = [...document.querySelectorAll('#v16Body .v16-note-card')].find(n=>n.dataset.path.includes(k));
      if(c) c.click();
    }, kw);
    await page.waitForTimeout(900);
  }
  await boot();

  /* ---------- #2 触点倾斜（用文件夹卡：按左缘产生 rotateY） ---------- */
  try{
    const box = await page.evaluate(()=>{
      const c = document.querySelector('#v16Body .v16-folder-card');
      if(!c) return null;
      const r = c.getBoundingClientRect();
      return { x: r.left + 8, y: r.top + r.height/2 };
    });
    if(!box) throw new Error('no folder card');
    await page.mouse.move(box.x, box.y);
    await page.mouse.down();
    await sleep(130);
    const mid = await page.evaluate(()=> getComputedStyle(document.querySelector('#v16Body .v16-folder-card')).transform);
    /* 挪开 >14px 再抬：Press-to-Cancel 吃掉这次 click，避免误导航 */
    await page.mouse.move(box.x + 60, box.y);
    await page.mouse.up();
    await sleep(160);
    const after = await page.evaluate(()=> getComputedStyle(document.querySelector('#v16Body .v16-folder-card')).transform);
    const pass = mid.startsWith('matrix3d') && after === 'none';
    report('#2','触点倾斜', pass, 'mid='+mid.slice(0,60)+' after='+after);
  }catch(e){ report('#2','触点倾斜', false, e.message); }

  /* ---------- #13 Press-to-Cancel ---------- */
  try{
    const before = await page.evaluate(()=> window.VUI.state.curFolder);
    const box = await page.evaluate(()=>{
      const c = document.querySelector('#v16Body .v16-folder-card');
      if(!c) return null;
      const r = c.getBoundingClientRect();
      return { x: r.left + r.width/2, y: r.top + r.height/2 };
    });
    await page.mouse.move(box.x, box.y);
    await page.mouse.down();
    await page.mouse.move(box.x + 20, box.y, { steps: 2 });
    await page.mouse.move(box.x + 42, box.y, { steps: 3 });
    await page.mouse.up();
    await sleep(350);
    const afterDrag = await page.evaluate(()=> window.VUI.state.curFolder);
    await page.mouse.click(box.x, box.y, { delay: 40 });
    await sleep(600);
    const afterTap = await page.evaluate(()=> window.VUI.state.curFolder);
    const pass = afterDrag === before && afterTap !== before;
    report('#13','Press-to-Cancel', pass, 'before='+before+' afterDrag='+afterDrag+' afterTap='+afterTap);
    await boot();
  }catch(e){ report('#13','Press-to-Cancel', false, e.message); await boot(); }

  /* ---------- #4 曲线飞行删除 + #12 删除收拢（进入工作文件夹选笔记） ---------- */
  try{
    await enterFolder('工作');
    const path = await page.evaluate(()=> document.querySelector('#v16Body .v16-note-card').dataset.path);
    await page.evaluate((p)=>{
      window.dispatchEvent(new CustomEvent('v16:before-delete',{ detail:{ paths:[p], done:()=>{
        const c = document.querySelector('#v16Body .v16-note-card[data-path="'+p.replace(/"/g,'\\"')+'"]');
        if(c) c.remove();
      } } }));
    }, path);
    await sleep(170);
    const mid = await page.evaluate((p)=>{
      const sel = '#v16Body .v16-note-card[data-path="'+p.replace(/"/g,'\\"')+'"]';
      const c = document.querySelector(sel);
      return { anims: c ? c.getAnimations().length : -1 };
    }, path);
    let collapseAnim = false;
    for(let i=0;i<10;i++){
      await sleep(60);
      collapseAnim = await page.evaluate(()=>{
        for(const el of document.querySelectorAll('#v16Body .v16-note-card, #v16Body .v16-folder-card'))
          if(el.getAnimations().length) return true;
        return false;
      });
      if(collapseAnim) break;
    }
    await sleep(600);
    const after = await page.evaluate((p)=> !document.querySelector('#v16Body .v16-note-card[data-path="'+p.replace(/"/g,'\\"')+'"]'), path);
    const pass = mid.anims >= 1 && collapseAnim && after;
    report('#4/#12','曲线飞行删除 + 删除收拢', pass, 'flightAnimations='+mid.anims+' collapseFlipped='+collapseAnim+' nodeGone='+after);
    await boot();
  }catch(e){ report('#4/#12','曲线飞行删除 + 删除收拢', false, e.message); await boot(); }

  /* ---------- #3 chip 三连（打开笔记→更多→颜色） ---------- */
  try{
    await enterFolder('工作');
    await openNote('本周采购清单');
    await page.evaluate(()=> document.getElementById('v16EdMore').click());
    await sleep(400);
    await page.evaluate(()=>{
      const opt = [...document.querySelectorAll('.v16-sheet-opt')].find(o=>o.textContent.includes('颜色'));
      if(opt) opt.click();
    });
    await sleep(400);
    const box = await page.evaluate(()=>{
      const el = document.querySelector('.v16cdot');
      if(!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width/2, y: r.top + r.height/2 };
    });
    if(!box) throw new Error('no chip');
    await page.mouse.move(box.x, box.y);
    await page.mouse.down();
    let scaleVals = [];
    for(let i=0;i<9;i++){
      await sleep(45);
      const t = await page.evaluate(()=>{
        const el = document.querySelector('.v16cdot');
        const m = getComputedStyle(el).transform;
        const mm = m.match(/matrix\(([^)]+)\)/);
        return mm ? parseFloat(mm[1].split(',')[0]) : 1;
      });
      scaleVals.push(t);
    }
    await page.mouse.up();
    await sleep(500);
    const maxS = Math.max(...scaleVals), minS = Math.min(...scaleVals);
    const pass = (minS < 0.92) && (maxS > 1.03);
    report('#3','chip三连', pass, 'scale samples=['+scaleVals.map(v=>v.toFixed(2)).join(',')+']');
    await boot();
  }catch(e){ report('#3','chip三连', false, e.message); await boot(); }

  /* ---------- #5 错峰勾选 + #8 勾选三连 ---------- */
  try{
    await enterFolder('工作');
    await openNote('本周采购清单');
    const opened = await page.evaluate(()=>{
      const lis = [...document.querySelectorAll('#v16EdBody li.v16-todo-li')];
      return lis.map(li=>{
        const cb = li.querySelector('input.v16-ed-todoinput');
        return { done: cb && (cb.checked || cb.hasAttribute('checked')), delay: li.style.animationDelay||'0ms' };
      });
    });
    await page.evaluate(()=>{
      const lis = [...document.querySelectorAll('#v16EdBody li.v16-todo-li')];
      const target = lis.find(li=>{ const cb = li.querySelector('input.v16-ed-todoinput'); return cb && !cb.checked; });
      if(target) target.querySelector('input.v16-ed-todoinput').click();
    });
    await sleep(130);
    const mid = await page.evaluate(()=>{
      const lis = [...document.querySelectorAll('#v16EdBody li.v16-todo-li')];
      const last = lis.find(li=>{ const cb = li.querySelector('input.v16-ed-todoinput'); return cb && cb.checked && li.classList.contains('v16-todo-pop'); });
      if(!last) return null;
      const txt = last.querySelector('.md-todo-text');
      const cs = getComputedStyle(txt);
      return { anims: last.getAnimations().length, strikeSize: cs.backgroundSize, textOpacity: cs.opacity };
    });
    await sleep(600);
    const after = await page.evaluate(()=>{
      const lis = [...document.querySelectorAll('#v16EdBody li.v16-todo-li')];
      const doneCount = lis.filter(li=>{ const cb = li.querySelector('input.v16-ed-todoinput'); return cb && cb.checked; }).length;
      const struck = lis.filter(li=>{ const txt = li.querySelector('.md-todo-text'); return txt && getComputedStyle(txt).backgroundSize==='100% 1.5px'; }).length;
      return { doneCount, struck };
    });
    const pass = opened.filter(o=>o.done).length >= 1 && mid && mid.anims >= 1 && after.struck >= after.doneCount && after.doneCount >= 1;
    report('#5/#8','错峰勾选 + 勾选三连', pass, 'openedDone='+opened.filter(o=>o.done).length+' mid='+JSON.stringify(mid)+' after='+JSON.stringify(after));
    await boot();
  }catch(e){ report('#5/#8','错峰勾选 + 勾选三连', false, e.message); await boot(); }

  /* ---------- #6 边界阻尼（wheel 路径：首页顶部向上滚） ---------- */
  try{
    await page.evaluate(()=>{ const s = document.getElementById('v16Body'); if(s) s.scrollTop = 0; });
    await sleep(200);
    await page.mouse.move(180, 400);
    await page.mouse.wheel(0, -140);
    await sleep(60);
    const mid = await page.evaluate(()=> getComputedStyle(document.getElementById('v16Body')).transform);
    await sleep(700);
    const after = await page.evaluate(()=> getComputedStyle(document.getElementById('v16Body')).transform);
    const mm = mid.match(/matrix\(([^)]+)\)/);
    const ty = mm ? parseFloat(mm[1].split(',')[5]) : 0;
    const pass = mid !== 'none' && Math.abs(ty) > 3 && after === 'none';
    report('#6','边界阻尼', pass, 'mid='+mid+' (translateY='+ty.toFixed(1)+') after='+after);
    await boot();
  }catch(e){ report('#6','边界阻尼', false, e.message); await boot(); }

  /* ---------- #7 待办弹簧拖拽 ---------- */
  try{
    await enterFolder('工作');
    await openNote('本周采购清单');
    const box = await page.evaluate(()=>{
      const li = document.querySelector('#v16EdBody li.v16-todo-li');
      if(!li) return null;
      const r = li.getBoundingClientRect();
      return { x: r.left + r.width/2 + 40, y: r.top + r.height/2 };
    });
    await page.mouse.move(box.x, box.y);
    await page.mouse.down();
    await page.mouse.move(box.x, box.y + 30, { steps: 3 });
    await page.mouse.move(box.x, box.y + 60, { steps: 4 });
    await sleep(60);
    const mid = await page.evaluate(()=> document.querySelector('#v16EdBody li.v16-todo-li').style.transform || '');
    await page.mouse.up();
    await sleep(130);
    const overshoot = await page.evaluate(()=>{
      const li = document.querySelector('#v16EdBody li.v16-todo-li');
      const mm = getComputedStyle(li).transform.match(/matrix\(([^)]+)\)/);
      return mm ? parseFloat(mm[1].split(',')[5]) : 0;
    });
    await sleep(600);
    const after = await page.evaluate(()=> document.querySelector('#v16EdBody li.v16-todo-li').style.transform || '');
    const midY = parseFloat((mid.match(/translateY\((-?[\d.]+)px/)||[])[1] || 0);
    const pass = Math.abs(midY) > 5 && Math.abs(midY) < 60 && Math.abs(overshoot) > 0.5 && after === '';
    report('#7','待办弹簧拖拽', pass, 'mid='+mid+' overshootY='+overshoot.toFixed(1)+'px after="'+after+'"');
    await boot();
  }catch(e){ report('#7','待办弹簧拖拽', false, e.message); await boot(); }

  /* ---------- #9 字号刻度尺（合成指针事件驱动真实刻度尺） ---------- */
  try{
    await page.evaluate(()=> document.getElementById('v16More').click());
    await sleep(400);
    await page.evaluate(()=>{
      const opt = [...document.querySelectorAll('.v16-sheet-opt')].find(o=>o.textContent.includes('设置'));
      if(opt) opt.click();
    });
    await sleep(700);
    await page.evaluate(()=>{
      const row = document.querySelector('.v16-row[data-row="fontscale"]');
      if(row) row.click();
    });
    await sleep(600);
    const rulerExists = await page.evaluate(()=> !!document.getElementById('fsRuler'));
    if(!rulerExists) throw new Error('fsRuler 未打开');
    const zoom0 = await page.evaluate(()=> parseFloat(document.documentElement.style.zoom||'1'));
    /* 合成 pointer 事件拖动刻度尺 */
    await page.evaluate(()=>{
      const r = document.getElementById('fsRuler');
      const rc = r.getBoundingClientRect();
      const cx = rc.left + rc.width/2, cy = rc.top + rc.height/2;
      r.dispatchEvent(new PointerEvent('pointerdown', { clientX: cx, clientY: cy, bubbles: true, pointerId: 1 }));
      r.dispatchEvent(new PointerEvent('pointermove', { clientX: cx - 60, clientY: cy, bubbles: true, pointerId: 1 }));
      r.dispatchEvent(new PointerEvent('pointermove', { clientX: cx - 130, clientY: cy, bubbles: true, pointerId: 1 }));
    });
    await sleep(60);
    const zoomMid = await page.evaluate(()=> parseFloat(document.documentElement.style.zoom||'1'));
    await page.evaluate(()=>{
      const r = document.getElementById('fsRuler');
      r.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 1 }));
    });
    await sleep(500);
    const zoomSnap = await page.evaluate(()=> parseFloat(document.documentElement.style.zoom||'1'));
    await page.evaluate(()=>{
      const b = document.getElementById('fsDone'); if(b) b.click();
      document.documentElement.style.zoom='';
    });
    await sleep(300);
    const onTick = Math.abs(Math.round(zoomSnap*100) % 5) <= 1;
    const pass = zoomMid !== zoom0 && zoomMid > zoom0 && onTick && zoomMid <= 1.3;
    report('#9','字号刻度尺', pass, 'zoom '+zoom0+' → dragMid '+zoomMid+' → snap '+zoomSnap+' (tick='+onTick+')');
    await boot();
  }catch(e){ report('#9','字号刻度尺', false, e.message); await boot(); }

  /* ---------- #10 内联联想 ---------- */
  try{
    await enterFolder('工作');
    await openNote('本周采购清单');
    await page.evaluate(()=>{
      const ed = document.getElementById('v16EdBody');
      ed.focus();
      const rng = document.createRange();
      rng.selectNodeContents(ed); rng.collapse(false);
      const sel = getSelection(); sel.removeAllRanges(); sel.addRange(rng);
    });
    await page.keyboard.press('Enter');
    await page.keyboard.type('#工', { delay: 40 });
    await sleep(350);
    const sug = await page.evaluate(()=>{
      const el = document.getElementById('v16NbSuggest');
      if(!el || !el.classList.contains('show')) return null;
      return [...el.querySelectorAll('.v16-ns-item')].map(b=>b.dataset.nm);
    });
    if(!sug) throw new Error('联想浮层未弹出');
    await page.evaluate(()=>{
      const btn = [...document.querySelectorAll('#v16NbSuggest .v16-ns-item')].find(b=>b.dataset.nm==='工作');
      if(btn) btn.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,cancelable:true}));
    });
    await sleep(200);
    const afterText = await page.evaluate(()=> document.getElementById('v16EdBody').textContent);
    const pass = sug.includes('工作') && afterText.indexOf('#工作') >= 0;
    report('#10','内联联想', pass, 'items='+JSON.stringify(sug)+' bodyHas(#工作)='+(afterText.indexOf('#工作')>=0));
    await boot();
  }catch(e){ report('#10','内联联想', false, e.message); await boot(); }

  /* ---------- #11 大图查看器（注入一张 md-img） ---------- */
  try{
    await enterFolder('生活');
    await openNote('随手记');
    await page.evaluate(()=>{
      const ed = document.getElementById('v16EdBody');
      ed.insertAdjacentHTML('beforeend', '<img class="md-img" src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNDAiIGhlaWdodD0iMTYwIj48cmVjdCB3aWR0aD0iMjQwIiBoZWlnaHQ9IjE2MCIgZmlsbD0iJTJzYjhjNThhOCIvPjx0ZXh0IHg9IjEyMCIgeT0iODUiIGZvbnQtc2l6ZT0iMTYiIGZpbGw9IiUzMzMiIHRleHQtYW5jaG9yPSJtaWRkbGUiPnByb2JlPC90ZXh0Pjwvc3ZnPg==">');
      ed.querySelector('img.md-img').click();
    });
    await sleep(600);
    const opened = await page.evaluate(()=> document.getElementById('v16ImgViewer').classList.contains('open'));
    if(!opened) throw new Error('查看器未打开');
    /* 合成 pointer 事件驱动（该环境 mouse.move 跟手只投递单事件） */
    const fireTap = (x, y)=> page.evaluate(([px,py])=>{
      const v = document.getElementById('v16ImgViewer');
      v.dispatchEvent(new PointerEvent('pointerdown', { clientX: px, clientY: py, bubbles: true, pointerId: 7 }));
      v.dispatchEvent(new PointerEvent('pointerup',   { clientX: px, clientY: py, bubbles: true, pointerId: 7 }));
    }, [x, y]);
    await fireTap(180, 396);
    await sleep(180);
    await fireTap(180, 396);
    await sleep(500);
    const scaled = await page.evaluate(()=>{
      const mm = getComputedStyle(document.getElementById('v16Img')).transform.match(/matrix\(([^)]+)\)/);
      return mm ? parseFloat(mm[1].split(',')[0]) : 1;
    });
    /* 还原缩放：再来一次双击 */
    await fireTap(180, 396);
    await sleep(180);
    await fireTap(180, 396);
    await sleep(500);
    /* 单图左右滑动（边界阻尼） */
    await page.evaluate(()=>{
      const v = document.getElementById('v16ImgViewer');
      v.dispatchEvent(new PointerEvent('pointerdown', { clientX: 180, clientY: 396, bubbles: true, pointerId: 7 }));
      v.dispatchEvent(new PointerEvent('pointermove', { clientX: 130, clientY: 396, bubbles: true, pointerId: 7 }));
      v.dispatchEvent(new PointerEvent('pointermove', { clientX: 60, clientY: 396, bubbles: true, pointerId: 7 }));
    });
    await sleep(60);
    const swiped = await page.evaluate(()=>{
      const mm = getComputedStyle(document.getElementById('v16Img')).transform.match(/matrix\(([^)]+)\)/);
      return mm ? parseFloat(mm[1].split(',')[4]) : 0;
    });
    await page.evaluate(()=>{
      const v = document.getElementById('v16ImgViewer');
      v.dispatchEvent(new PointerEvent('pointerup', { clientX: 60, clientY: 396, bubbles: true, pointerId: 7 }));
    });
    await sleep(500);
    const settled = await page.evaluate(()=>{
      const mm = getComputedStyle(document.getElementById('v16Img')).transform.match(/matrix\(([^)]+)\)/);
      return mm ? parseFloat(mm[1].split(',')[4]) : 0;
    });
    await page.evaluate(()=> document.getElementById('v16ImgClose').click());
    const pass = scaled > 2.0 && Math.abs(swiped) > 5 && Math.abs(settled) < 2;
    report('#11','大图查看器', pass, 'scale='+scaled.toFixed(2)+' swipeX='+swiped.toFixed(1)+' settleX='+settled.toFixed(1));
    await boot();
  }catch(e){ report('#11','大图查看器', false, e.message); await boot(); }

  /* ---------- #15 手风琴 ---------- */
  try{
    await page.evaluate(()=> document.getElementById('v16More').click());
    await sleep(400);
    await page.evaluate(()=>{
      const opt = [...document.querySelectorAll('.v16-sheet-opt')].find(o=>o.textContent.includes('设置'));
      if(opt) opt.click();
    });
    await sleep(700);
    const target = await page.evaluate(()=>{
      const g = [...document.querySelectorAll('.v16-set-group')].find(x=>!x.classList.contains('open'));
      if(!g) return null;
      g.querySelector('.v16-set-head').click();
      return g.dataset.group;
    });
    if(!target) throw new Error('no closed group');
    await sleep(70);
    const mid = await page.evaluate((dg)=>{
      const g = document.querySelector('.v16-set-group[data-group="'+dg+'"]');
      const body = g.querySelector('.v16-set-body');
      return { anims: body.getAnimations().length, h: body.offsetHeight, want: body.scrollHeight };
    }, target);
    await sleep(500);
    const after = await page.evaluate((dg)=>{
      const g = document.querySelector('.v16-set-group[data-group="'+dg+'"]');
      const body = g.querySelector('.v16-set-body');
      return { h: body.offsetHeight, open: g.classList.contains('open') };
    }, target);
    const pass = mid.anims >= 1 && Math.abs(mid.h - mid.want) > 2 && after.open && after.h > 100;
    report('#15','手风琴', pass, 'group='+target+' mid='+JSON.stringify(mid)+' after='+JSON.stringify(after));
    await boot();
  }catch(e){ report('#15','手风琴', false, e.message); await boot(); }

  /* ---------- #16 进度条弹性收尾 ---------- */
  try{
    await page.evaluate(()=>{
      const d = document.createElement('div');
      d.innerHTML = '<div class="v16-progress" style="margin:20px"><i id="v16T1" style="width:0%"></i></div>';
      d.id = 'v16ProgProbe';
      document.body.appendChild(d);
    });
    await page.evaluate(()=>{ document.getElementById('v16T1').style.width = '100%'; });
    let peakScale = 1;
    for(let i=0;i<10;i++){
      await sleep(45);
      const s = await page.evaluate(()=>{
        const b = document.getElementById('v16T1');
        const mm = getComputedStyle(b).transform.match(/matrix\(([^)]+)\)/);
        return mm ? parseFloat(mm[1].split(',')[0]) : 1;
      });
      if(s > peakScale) peakScale = s;
    }
    await sleep(500);
    const endScale = await page.evaluate(()=>{
      const b = document.getElementById('v16T1');
      document.getElementById('v16ProgProbe').remove();
      const mm = getComputedStyle(b).transform.match(/matrix\(([^)]+)\)/);
      return mm ? parseFloat(mm[1].split(',')[0]) : 1;
    });
    const pass = peakScale > 1.02 && endScale < 1.01;
    report('#16','进度条弹性收尾', pass, 'peakScaleX='+peakScale.toFixed(3)+' endScaleX='+endScale.toFixed(3));
  }catch(e){ report('#16','进度条弹性收尾', false, e.message); }

  /* ---------- 汇总 ---------- */
  const passCount = results.filter(r=>r.pass).length;
  console.log('\n===== 汇总: '+passCount+'/'+results.length+' PASS, pageerror='+errs.length+' =====');
  errs.forEach(e=> console.log('  pageerror: '+e));
  await browser.close();
  process.exit(passCount === results.length && errs.length === 0 ? 0 : 1);
})();
