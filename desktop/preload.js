const { contextBridge, ipcRenderer } = require('electron');

/* 向网页暴露桌面环境标识与少量原生能力（不直接开放 Node） */
contextBridge.exposeInMainWorld('__DESKTOP__', {
  desktop: true,
  platform: process.platform,
  saveFile: (name, data, isBinary) => ipcRenderer.invoke('saveFile', name, data, isBinary),
  openLink: (url) => ipcRenderer.invoke('openLink', url),
  httpRequest: (opts) => ipcRenderer.invoke('httpRequest', opts),
  panUploadBytes: (o) => ipcRenderer.invoke('panUploadBytes', o),
  panDownloadBytes: (o) => ipcRenderer.invoke('panDownloadBytes', o),
  panMd5: (o) => ipcRenderer.invoke('panMd5', o),
  win: {
    min: () => ipcRenderer.invoke('winMin'),
    max: () => ipcRenderer.invoke('winMax'),
    close: () => ipcRenderer.invoke('winClose')
  }
});
