const { contextBridge, ipcRenderer } = require('electron');

// The only thing exposed to the page: a narrow network request bridge.
contextBridge.exposeInMainWorld('rakebNet', {
  request: (opts) => ipcRenderer.invoke('net:request', opts)
});
