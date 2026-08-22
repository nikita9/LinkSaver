const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    addLink: (link) => ipcRenderer.invoke('links:add', link),
    addBulk: (links) => ipcRenderer.invoke('links:add-bulk', links),
    getPage: (options) => ipcRenderer.invoke('links:page', options),
    deleteLinks: (ids) => ipcRenderer.invoke('links:delete', ids),
    enhanceAll: () => ipcRenderer.invoke('links:enhance'),
    getStats: () => ipcRenderer.invoke('links:stats'),
    exportLinks: () => ipcRenderer.invoke('links:export'),
    importLinks: () => ipcRenderer.invoke('links:import'),
    analyzeUrl: (url) => ipcRenderer.invoke('url:analyze', url),
    openExternal: (url) => ipcRenderer.invoke('app:open-external', url),
    appInfo: () => ipcRenderer.invoke('app:info')
});
