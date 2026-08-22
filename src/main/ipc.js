import { ipcMain, dialog, shell } from 'electron';
import { promises as fs } from 'node:fs';
import { analyzeUrl } from './tagger.js';

const MAX_TAG_LENGTH = 64;
const MAX_TAGS_PER_LINK = 20;

/** Strip trailing OneTab/CSV noise, require http(s), and validate. Returns null if invalid. */
export function normalizeUrl(raw) {
    if (typeof raw !== 'string') return null;
    const cleaned = raw.includes(' | ')
        ? raw.split(' | ')[0].trim()
        : raw.split(',')[0].trim();
    try {
        const parsed = new URL(cleaned);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
        return cleaned;
    } catch {
        return null;
    }
}

function sanitizeTags(tags) {
    if (!Array.isArray(tags)) return [];
    return [...new Set(
        tags
            .filter((tag) => typeof tag === 'string')
            .map((tag) => tag.trim().slice(0, MAX_TAG_LENGTH))
            .filter(Boolean)
    )].slice(0, MAX_TAGS_PER_LINK);
}

/** Build a sanitized link record from untrusted renderer input; AI-tags it if untagged. */
function prepareLink(input) {
    const url = normalizeUrl(input.url);
    if (!url) return null;

    const link = {
        url,
        name: typeof input.name === 'string' ? input.name.trim().slice(0, 500) || null : null,
        tags: sanitizeTags(input.tags),
        aiGenerated: [],
        added: typeof input.added === 'string' ? input.added : undefined
    };

    if (link.tags.length === 0) {
        const analysis = analyzeUrl(url);
        if (analysis.ok && analysis.tags.length > 0) {
            link.tags = analysis.tags;
            link.aiGenerated = analysis.tags;
        }
    }
    return link;
}

/**
 * Sanitize a batch of untrusted link inputs: drops invalid URLs, collapses
 * duplicates within the batch, and reports how many were rejected.
 */
function prepareBatch(inputs) {
    const seen = new Set();
    const links = [];
    let invalid = 0;
    let aiEnhanced = 0;

    for (const input of inputs) {
        const link = prepareLink(input || {});
        if (!link) { invalid++; continue; }
        if (seen.has(link.url)) continue;
        seen.add(link.url);
        if (link.aiGenerated.length > 0) aiEnhanced++;
        links.push(link);
    }
    return { links, invalid, aiEnhanced };
}

/** Persist a prepared batch, skipping the store round-trip when there is nothing to write. */
async function saveBatch(store, links) {
    if (links.length === 0) return { inserted: 0, duplicates: 0 };
    return store.addMany(links);
}

function csvField(value) {
    return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

function handle(channel, fn) {
    ipcMain.handle(channel, async (event, ...args) => {
        try {
            return await fn(...args);
        } catch (error) {
            console.error(`IPC ${channel} failed:`, error);
            return { ok: false, error: error.message };
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

        const { links, invalid, aiEnhanced } = prepareBatch(inputs);
        const { inserted, duplicates } = await saveBatch(store, links);

        return { ok: true, added: inserted, duplicates, invalid, aiEnhanced };
    });

    handle('links:page', async (options) => {
        const result = await store.page(options || {});
        return { ok: true, ...result };
    });

    handle('links:delete', async (ids) => {
        if (!Array.isArray(ids) || ids.length === 0) return { ok: true, deleted: 0 };
        const deleted = await store.remove(ids.filter((id) => Number.isFinite(id)));
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
            const rows = links.map((link) => [
                csvField(link.url),
                csvField(link.name),
                csvField((link.tags || []).join(';')),
                csvField(link.added)
            ].join(','));
            await fs.writeFile(filePath, ['URL,Name,Tags,Date Added', ...rows].join('\n'));
        } else {
            await fs.writeFile(filePath, JSON.stringify(links, null, 2));
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

        const parsed = JSON.parse(await fs.readFile(filePaths[0], 'utf8'));
        if (!Array.isArray(parsed)) {
            return { ok: false, error: 'Invalid file — expected a JSON array of links' };
        }

        const { links, invalid } = prepareBatch(parsed);
        const { inserted, duplicates } = await saveBatch(store, links);

        return { ok: true, imported: inserted, duplicates, invalid };
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
