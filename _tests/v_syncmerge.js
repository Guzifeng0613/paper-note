const {chromium}=require('playwright');
const EXE='/opt/vm/preinstall/ms-playwright/chromium_headless_shell-1169/chrome-linux/headless_shell';
const URL0='file:///home/user/Doubao/chats/38443854002369026/notes-app/index.html';
const MK="const mk=(id,ts,title)=>({id,type:'note',title,content:'<p>x</p>',tags:[],todos:[],files:[],pinned:false,trashed:false,createdAt:ts,updatedAt:ts});";
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:EXE});
  const page=await browser.newPage({viewport:{width:390,height:844}});
  await page.goto(URL0);
  await page.waitForFunction(()=>window.__app,{timeout:8000});
  const R=[];const ok=(n,c)=>R.push([n,!!c]);
  await page.waitForFunction("document.querySelector('#scr-home').classList.contains('active')",null,{timeout:6000}).catch(()=>{});
  const r1=await page.evaluate(MK+"(()=>{"+
    "const lib={notes:[mk('cloud1',9999999999999,'云端独有')],cloudDeleted:['del1']};"+
    "const changed=window.__app.mergeLibIntoMemory(lib);"+
    "return {changed,has:window.__app.notes.some(n=>n.id==='cloud1')};})()");
  ok('主页：云端独有便签被补入',r1.changed&&r1.has);
  const r2=await page.evaluate(MK+"(()=>{"+
    "const A=window.__app,x=A.uid();A.notes.push(mk(x,2000,'本地新'));"+
    "A.mergeLibIntoMemory({notes:[mk(x,1000,'云端旧')]});"+
    "return A.notes.find(z=>z.id===x).title;})()");
  ok('updatedAt 更旧的云端副本不覆盖本地',r2==='本地新');
  const r3=await page.evaluate(MK+"(()=>{"+
    "const A=window.__app,x=A.uid();A.notes.push(mk(x,3000,'编辑中'));"+
    "location.hash='#/edit?id='+x;"+
    "return new Promise(res=>setTimeout(()=>{"+
      "const before=A.notes.find(z=>z.id===x);"+
      "A.mergeLibIntoMemory({notes:[mk(x,9999999999998,'云端改')]});"+
      "const after=A.notes.find(z=>z.id===x);"+
      "res({same:before===after,title:after.title,edit:document.querySelector('#scr-edit').classList.contains('active')});"+
    "},400));})()");
  ok('编辑中：当前便签引用不被替换、不打断',r3.same&&r3.title==='编辑中'&&r3.edit);
  let pass=0;R.forEach(([n,c])=>{console.log((c?'PASS':'FAIL')+'  '+n);if(c)pass++;});
  console.log(pass+'/'+R.length);
  await browser.close();
  process.exit(pass===R.length?0:1);
})();
