import { app, BrowserWindow, session } from 'electron';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { registerIpc } from '../src/main/ipc.js';
import { prepareBatch } from '../src/main/link-service.js';
import { createStore } from '../src/main/store.js';

const projectRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const outputDir = path.join(projectRoot, 'docs', 'images');

const demoLinks = [
    ['https://github.com/openai/openai-node', 'OpenAI Node SDK'],
    ['https://docs.github.com/en/actions', 'GitHub Actions Documentation'],
    ['https://www.figma.com/community', 'Figma Community'],
    ['https://stackoverflow.com/questions/tagged/javascript', 'JavaScript Questions'],
    ['https://news.ycombinator.com/', 'Hacker News'],
    ['https://dev.to/t/javascript', 'JavaScript Tutorials'],
    ['https://mermaid.live/', 'Mermaid Diagram Editor'],
    ['https://en.wikipedia.org/wiki/Information_retrieval', 'Information Retrieval']
].map(([url, name], index) => ({
    url,
    name,
    added: new Date(Date.UTC(2026, 7, 24 - index, 12)).toISOString()
}));

function waitFor(win, condition, timeout = 5_000) {
    return win.webContents.executeJavaScript(`
        new Promise((resolve, reject) => {
            const deadline = Date.now() + ${timeout};
            const check = () => {
                if (${condition}) return resolve(true);
                if (Date.now() >= deadline) return reject(new Error('Timed out waiting for screenshot state'));
                setTimeout(check, 50);
            };
            check();
        })
    `);
}

async function settle(win) {
    await win.webContents.executeJavaScript(`
        (async () => {
            document.activeElement?.blur();
            document.querySelector('.main').scrollTop = 0;
            await document.fonts.ready;
            await new Promise((resolve) => setTimeout(resolve, 250));
            await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        })()
    `);
}

async function capture(win, filename) {
    await settle(win);
    const image = await win.webContents.capturePage();
    await fs.writeFile(path.join(outputDir, filename), image.toPNG());
    console.log(`Captured docs/images/${filename}`);
}

async function run() {
    const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'link-saver-screenshots-'));
    let store;
    let win;

    try {
        await fs.mkdir(outputDir, { recursive: true });
        session.defaultSession.setPermissionCheckHandler(() => false);
        session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
            callback(false);
        });

        store = await createStore(dataDir);
        const prepared = prepareBatch(demoLinks);
        await store.addMany(prepared.links);
        registerIpc(store);

        win = new BrowserWindow({
            width: 1240,
            height: 840,
            useContentSize: true,
            show: false,
            backgroundColor: '#0b0b0f',
            webPreferences: {
                preload: path.join(projectRoot, 'preload.cjs'),
                contextIsolation: true,
                nodeIntegration: false,
                sandbox: true,
                webSecurity: true,
                allowRunningInsecureContent: false,
                navigateOnDragDrop: false,
                backgroundThrottling: false,
                spellcheck: false,
                devTools: false
            }
        });

        win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
        win.webContents.on('will-navigate', (event) => event.preventDefault());
        await win.loadFile(path.join(projectRoot, 'index.html'));

        await waitFor(win, "document.querySelectorAll('#linkList .card').length === 8");
        await capture(win, 'link-saver-library.png');

        await win.webContents.executeJavaScript(`
            document.querySelector('[data-view="add"]').click();
            const url = document.querySelector('#urlInput');
            url.value = 'https://github.com/openai/codex/tree/main/docs';
            document.querySelector('#nameInput').value = 'Codex Documentation';
            url.dispatchEvent(new Event('input', { bubbles: true }));
        `);
        await waitFor(win, "!document.querySelector('#analysisBox').hidden && document.querySelectorAll('#analysisTags .suggest-chip').length > 0");
        await capture(win, 'link-saver-smart-tags.png');

        await win.webContents.executeJavaScript(`
            document.querySelector('[data-view="manage"]').click();
        `);
        await waitFor(win, "document.querySelector('#statLinks').textContent === '8'");
        await win.webContents.executeJavaScript(`
            document.querySelector('#storageInfo').textContent =
                'SQLite database — ~/Library/Application Support/Link Saver/links.db';
        `);
        await capture(win, 'link-saver-manage.png');
    } finally {
        if (win && !win.isDestroyed()) win.destroy();
        store?.close();
        await fs.rm(dataDir, { recursive: true, force: true });
    }
}

app.whenReady()
    .then(run)
    .then(() => app.quit())
    .catch((error) => {
        console.error(error);
        app.exit(1);
    });
