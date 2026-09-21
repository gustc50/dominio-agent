const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings),
  onvioLogin: () => ipcRenderer.invoke('onvio:login'),
  sendMessage: (payload) => ipcRenderer.invoke('agent:send', payload),
});
