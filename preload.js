const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings),
  testDominioConnection: (config) => ipcRenderer.invoke('dominio:test', config),
  sendMessage: (payload) => ipcRenderer.invoke('agent:send', payload),
});
