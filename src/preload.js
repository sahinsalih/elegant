const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desk', {
  load: () => ipcRenderer.invoke('db:load'),
  saveProject: (payload) => ipcRenderer.invoke('db:saveProject', payload),
  deleteProject: (id) => ipcRenderer.invoke('db:deleteProject', id),
  saveNote: (payload) => ipcRenderer.invoke('db:saveNote', payload),
  deleteNote: (id) => ipcRenderer.invoke('db:deleteNote', id),
  saveTask: (payload) => ipcRenderer.invoke('db:saveTask', payload),
  deleteTask: (id) => ipcRenderer.invoke('db:deleteTask', id),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (payload) => ipcRenderer.invoke('settings:set', payload),
  version: () => ipcRenderer.invoke('app:version'),
});
