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
  fsRoot: () => ipcRenderer.invoke('fs:root'),
  fsList: (rel) => ipcRenderer.invoke('fs:list', rel),
  fsRead: (rel) => ipcRenderer.invoke('fs:read', rel),
  fsWrite: (rel, content) => ipcRenderer.invoke('fs:write', rel, content),
  fsCreateFile: (parentRel, name) => ipcRenderer.invoke('fs:create-file', parentRel, name),
  fsCreateDir: (parentRel, name) => ipcRenderer.invoke('fs:create-dir', parentRel, name),
  fsDelete: (rel) => ipcRenderer.invoke('fs:delete', rel),
  fsReveal: (rel) => ipcRenderer.invoke('fs:reveal', rel),
  logTail: () => ipcRenderer.invoke('app:log-tail'),
  log: (msg) => ipcRenderer.send('app:log', msg),
});
