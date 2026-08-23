'use strict';

const { contextBridge, ipcRenderer } = require('electron');

const invoke = (channel) => (...args) => ipcRenderer.invoke(channel, ...args);

contextBridge.exposeInMainWorld('api', Object.freeze({
    addLink: invoke('links:add'),
    addBulk: invoke('links:add-bulk'),
    getPage: invoke('links:page'),
    deleteLinks: invoke('links:delete'),
    enhanceAll: invoke('links:enhance'),
    getStats: invoke('links:stats'),
    exportLinks: invoke('links:export'),
    importLinks: invoke('links:import'),
    analyzeUrl: invoke('url:analyze'),
    openExternal: invoke('app:open-external'),
    appInfo: invoke('app:info')
}));
