// 蓝色大肥鱼 DSH - 预加载脚本（UI 与主进程的安全桥梁）
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('dsh', {
  minimize: () => ipcRenderer.send('win:minimize'),
  toggleMaximize: () => ipcRenderer.send('win:maximize-toggle'),
  isMaximized: () => ipcRenderer.invoke('win:is-maximized'),
  close: () => ipcRenderer.send('win:close'),
  status: () => ipcRenderer.invoke('app:status'),
  start: () => ipcRenderer.invoke('app:start'),
  submitKey: (key) => ipcRenderer.invoke('app:submit-key', key),
  keyInfo: () => ipcRenderer.invoke('app:key-info'),
  checkBalance: () => ipcRenderer.invoke('app:check-balance'),
  logTail: () => ipcRenderer.invoke('app:log-tail'),
  log: (msg) => ipcRenderer.send('app:log', msg),
});
