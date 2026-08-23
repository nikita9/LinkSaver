import { app, BrowserWindow, Menu, session } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createStore } from './src/main/store.js';
import { registerIpc } from './src/main/ipc.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let store = null;
let mainWindow = null;

function focusMainWindow() {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
}

function createWindow() {
    const win = new BrowserWindow({
        width: 1240,
        height: 840,
        minWidth: 920,
        minHeight: 600,
        backgroundColor: '#0b0b0f',
        titleBarStyle: 'hiddenInset',
        icon: path.join(__dirname, 'assets', 'icon.png'),
        show: false,
        webPreferences: {
            preload: path.join(__dirname, 'preload.cjs'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
            webSecurity: true,
            allowRunningInsecureContent: false,
            navigateOnDragDrop: false,
            spellcheck: false,
            devTools: !app.isPackaged || process.argv.includes('--dev')
        }
    });

    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    win.webContents.on('will-navigate', (event) => event.preventDefault());
    win.once('ready-to-show', () => win.show());
    win.on('closed', () => {
        if (mainWindow === win) mainWindow = null;
    });
    void win.loadFile(path.join(__dirname, 'index.html'));
    mainWindow = win;
    return win;
}

async function bootstrap() {
    if (process.platform !== 'darwin') Menu.setApplicationMenu(null);
    session.defaultSession.setPermissionCheckHandler(() => false);
    session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
        callback(false);
    });

    store = await createStore(app.getPath('userData'));
    console.log(`Store ready (${store.backend}): ${store.location}`);

    registerIpc(store);
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
}

const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) {
    app.quit();
} else {
    app.on('second-instance', focusMainWindow);
    app.whenReady().then(bootstrap).catch((error) => {
        console.error('Application startup failed:', error);
        app.quit();
    });
}

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
    try {
        store?.close();
        store = null;
    } catch (error) {
        console.error('Error closing store:', error);
    }
});
