import { ipcMain, dialog, shell } from 'electron';
import { promises as fs } from 'node:fs';
import { serializeLinksCsv } from './csv.js';
import { analyzeUrl } from './tagger.js';
import { MAX_BATCH_SIZE, normalizeUrl, prepareBatch, prepareLink } from './link-service.js';

const MAX_DELETE_IDS = 10_000;
const MAX_IMPORT_BYTES = 10 * 1024 * 1024;
const RENDERER_URL = new URL('../../index.html', import.meta.url).href;

/** Persist a prepared batch, skipping the store round-trip when there is nothing to write. */
async function saveBatch(store, links) {
    if (links.length === 0) return { inserted: 0, duplicates: 0 };
    return store.addMany(links);
}

function handle(channel, fn) {
    ipcMain.handle(channel, async (event, ...args) => {
        if (event.senderFrame?.url !== RENDERER_URL) {
            console.warn(`Blocked IPC ${channel} from an untrusted sender`);
            return { ok: false, error: 'Unauthorized IPC sender' };
        }
        try {
            return await fn(...args);
        } catch (error) {
            console.error(`IPC ${channel} failed:`, error);
            return { ok: false, error: error instanceof Error ? error.message : 'Unexpected error' };
        }
    });
}

export function registerIpc(store) {
    handle('links:add', async (input) => {
        const link = prepareLink(input || {});
        if (!link) return { ok: false, error: 'Invalid URL — must start with http:// or https://' };

        const { inserted } = await store.addMany([link]);
        if (inserted === 0) return { ok: false, error: 'This link is already saved' };
        return { ok: true, aiEnhanced: link.aiGenerated.length > 0 };
    });

    handle('links:add-bulk', async (inputs) => {
        if (!Array.isArray(inputs)) return { ok: false, error: 'Expected an array of links' };
        if (inputs.length > MAX_BATCH_SIZE) {
            return { ok: false, error: `Import is limited to ${MAX_BATCH_SIZE} links at a time` };
        }

        const batch = prepareBatch(inputs);
        const saved = await saveBatch(store, batch.links);

        return {
            ok: true,
            added: saved.inserted,
            duplicates: batch.duplicates + saved.duplicates,
            invalid: batch.invalid,
            aiEnhanced: batch.aiEnhanced
        };
    });

    handle('links:page', async (options) => {
        const result = await store.page(options || {});
        return { ok: true, ...result };
    });

    handle('links:delete', async (ids) => {
        if (!Array.isArray(ids) || ids.length === 0) return { ok: true, deleted: 0 };
        const safeIds = [...new Set(ids)]
            .filter((id) => Number.isSafeInteger(id) && id > 0)
            .slice(0, MAX_DELETE_IDS);
        const deleted = await store.remove(safeIds);
        return { ok: true, deleted };
    });

    handle('links:enhance', async () => {
        const untagged = await store.untagged();
        const updates = [];
        for (const link of untagged) {
            const analysis = analyzeUrl(link.url);
            if (analysis.ok && analysis.tags.length > 0) {
                updates.push({ url: link.url, tags: analysis.tags, aiGenerated: analysis.tags });
            }
        }
        const enhanced = updates.length > 0 ? await store.setTagsMany(updates) : 0;
        return { ok: true, enhanced };
    });

    handle('links:stats', async () => {
        const stats = await store.stats();
        return { ok: true, ...stats };
    });

    handle('links:export', async () => {
        const { filePath } = await dialog.showSaveDialog({
            title: 'Export Links',
            defaultPath: 'links-export.json',
            filters: [
                { name: 'JSON', extensions: ['json'] },
                { name: 'CSV', extensions: ['csv'] }
            ]
        });
        if (!filePath) return { ok: false, cancelled: true };

        const links = await store.all();
        if (filePath.endsWith('.csv')) {
            await fs.writeFile(filePath, serializeLinksCsv(links), 'utf8');
        } else {
            await fs.writeFile(filePath, JSON.stringify(links, null, 2), 'utf8');
        }
        return { ok: true, count: links.length, path: filePath };
    });

    handle('links:import', async () => {
        const { filePaths } = await dialog.showOpenDialog({
            title: 'Import Links',
            filters: [{ name: 'JSON', extensions: ['json'] }],
            properties: ['openFile']
        });
        if (!filePaths || filePaths.length === 0) return { ok: false, cancelled: true };

        const { size } = await fs.stat(filePaths[0]);
        if (size > MAX_IMPORT_BYTES) {
            return { ok: false, error: 'Import file is larger than 10 MB' };
        }

        const parsed = JSON.parse(await fs.readFile(filePaths[0], 'utf8'));
        if (!Array.isArray(parsed)) {
            return { ok: false, error: 'Invalid file — expected a JSON array of links' };
        }
        if (parsed.length > MAX_BATCH_SIZE) {
            return { ok: false, error: `Import is limited to ${MAX_BATCH_SIZE} links at a time` };
        }

        const batch = prepareBatch(parsed);
        const saved = await saveBatch(store, batch.links);

        return {
            ok: true,
            imported: saved.inserted,
            duplicates: batch.duplicates + saved.duplicates,
            invalid: batch.invalid,
            aiEnhanced: batch.aiEnhanced
        };
    });

    handle('url:analyze', async (url) => {
        const normalized = normalizeUrl(url);
        if (!normalized) return { ok: false, error: 'Enter a full URL starting with http:// or https://', tags: [] };
        return analyzeUrl(normalized);
    });

    handle('app:open-external', async (url) => {
        const normalized = normalizeUrl(url);
        if (!normalized) return { ok: false, error: 'Refusing to open non-http(s) URL' };
        await shell.openExternal(normalized);
        return { ok: true };
    });

    handle('app:info', async () => ({
        ok: true,
        backend: store.backend,
        location: store.location
    }));
}
