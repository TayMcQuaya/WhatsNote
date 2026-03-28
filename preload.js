const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  loadData: () => ipcRenderer.invoke('data:load'),
  saveData: (data) => ipcRenderer.invoke('data:save', data),
  exportData: () => ipcRenderer.invoke('data:export'),
  importData: () => ipcRenderer.invoke('data:import'),
  showMessageMenu: (info) => ipcRenderer.invoke('context-menu:message', info),
  showProjectMenu: (info) => ipcRenderer.invoke('context-menu:project', info),
  showMultiProjectMenu: (info) => ipcRenderer.invoke('context-menu:multi-project', info),
  showMultiMessageMenu: (info) => ipcRenderer.invoke('context-menu:multi-message', info),
  pickImage: () => ipcRenderer.invoke('dialog:pick-image'),
  openExternal: (url) => ipcRenderer.invoke('shell:open-external', url),
});
