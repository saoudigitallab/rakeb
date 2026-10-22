const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('rakebDesktop', {
  platform: process.platform,
  openExternal: (url) => ipcRenderer.invoke('open-external', String(url))
});
