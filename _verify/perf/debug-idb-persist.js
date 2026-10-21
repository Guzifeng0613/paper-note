/* debug-idb-persist.js —— 最小复现：IDB 写入后 reload 是否还在 */
'use strict';
const {chromium}=require('playwright');
const fs=require('fs'), path=require('path'), http=require('http');
const EXE='/opt/vm/preinstall/ms-playwright/chromium_headless_shell-1169/chrome-linux/headless_shell';
const ROOT=path.resolve(__dirname,'..','..');
const server=http.createServer((req,res)=>{
  const f=path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  fs.readFile(f,(e,d)=>{ if(e){res.statusCode=404;res.end();return;}
    res.setHeader('Content-Type','text/html; charset=utf-8'); res.end(d); });
});
const listen=()=>new Promise(r=>server.listen(0,'127.0.0.1',()=>r(server.address().port)));
const SRC=fs.readFileSync(path.join(__dirname,'lib','vault-fs.js'),'utf8');

(async()=>{
  const port=await listen();
  const b=await chromium.launch({headless:true,executablePath:EXE});
  const ctx=await b.newContext({viewport:{width:360,height:792},isMobile:true,hasTouch:true,reducedMotion:'no-preference'});
  const page=await ctx.newPage();
  page.on('pageerror',e=>console.log('[pageerror]',e.message));
  await page.goto('http://127.0.0.1:'+port+'/_verify/perf/vault-perf.html');

  const r1=await page.evaluate(async (src)=>{
    const s=document.createElement('script'); s.textContent=src; document.head.appendChild(s);
    await window.VaultFS.init('idb');
    await window.VaultFS.write('工作/测试.md','## hello');
    await window.VaultFS.mkdir('生活');
    const keys=await new Promise(res=>{ const rq=indexedDB.open('zhipian-vaultfs',1);
      rq.onsuccess=()=>{ const db=rq.result; const tx=db.transaction('files','readonly');
        tx.objectStore('files').getAllKeys().onsuccess=e=>res(e.target.result); }; });
    return {keysAfterWrite: keys.length, keys: keys.slice(0,5)};
  }, SRC);
  console.log('写后(内存中):', JSON.stringify(r1));

  await page.reload({waitUntil:'load'});
  const r2=await page.evaluate(async (src)=>{
    const s=document.createElement('script'); s.textContent=src; document.head.appendChild(s);
    await window.VaultFS.init('idb');
    const keys=await new Promise(res=>{ const rq=indexedDB.open('zhipian-vaultfs',1);
      rq.onsuccess=()=>{ const db=rq.result; const tx=db.transaction('files','readonly');
        tx.objectStore('files').getAllKeys().onsuccess=e=>res(e.target.result); }; });
    const rootList=await window.VaultFS.list('');
    return {keysAfterReload: keys.length, keys: keys.slice(0,5), rootList};
  }, SRC);
  console.log('reload 后:', JSON.stringify(r2));
  await b.close(); server.close();
})().catch(e=>{console.error('FATAL',e);process.exit(1);});
