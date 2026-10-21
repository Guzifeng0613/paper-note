/* ============================================================
   v16-boot.js —— v16 新 UI 引导（M1 alpha 启动入口）
   排在旧 main.js 之后执行：旧 v15 逻辑仍在磁盘与旧 screen 里运行
   （M2-M4 复用其功能），新 UI 通过 #v16root（z-index:60）覆盖其上。
   M2 起把 mock 切换为 RealVault：VUI 内部 const Vault = useMock?MockVault:RealVault。
   ============================================================ */
(function(){
'use strict';
function start(){
  try{
    /* 让旧 boot() 先跑一帧完成 DOM 绑定，再挂载新 UI */
    requestAnimationFrame(()=>{
      VUI.boot().catch(e=>console.warn('v16 boot failed', e));
    });
  }catch(e){ console.warn('v16 start failed', e); }
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', start);
else start();
})();
