// Electron 预加载脚本（contextIsolation 开启，最小暴露）
const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('ainews', {
  isElectron: true,
  version: '1.0.0',
});
