import { app, BrowserWindow } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createStore } from './src/main/store.js';
import { registerIpc } from './src/main/ipc.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let store = null;

function createWindow() {
    const win = new BrowserWindow({
        width: 1240,
        height: 840,
        minWidth: 920,
        minHeight: 600,
        backgroundColor: '#0b0b0f',
        titleBarStyle: 'hiddenInset',
        icon: path.join(__dirname, 'assets', 'icon.png'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true
        }
    });

    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    win.loadFile('index.html');
}

app.whenReady().then(async () => {
    store = await createStore(app.getPath('userData'));
    console.log(`Store ready (${store.backend}): ${store.location}`);

    registerIpc(store);
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
    try {
        store?.close();
    } catch (error) {
        console.error('Error closing store:', error);
    }
});
