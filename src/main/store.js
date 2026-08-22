import path from 'node:path';
import { promises as fs } from 'node:fs';

const PAGE_SORTS = {
    newest: 'ORDER BY added DESC',
    oldest: 'ORDER BY added ASC',
    url: 'ORDER BY url COLLATE NOCASE ASC',
    name: "ORDER BY COALESCE(NULLIF(name, ''), url) COLLATE NOCASE ASC"
};

/** Normalize the query options both backends accept, filling in defaults. */
function pageOptions({ page = 1, limit = 50, search = '', tag = '', sort = 'newest' } = {}) {
    return { page, limit, search, tag, sort };
}

/** Shared shape for a page of results, so both backends answer identically. */
function pageResult(links, totalCount, page, limit) {
    const offset = (page - 1) * limit;
    return {
        links,
        totalCount,
        page,
        totalPages: Math.max(1, Math.ceil(totalCount / limit)),
        hasMore: offset + limit < totalCount
    };
}

function rowToLink(row) {
    return {
        id: row.id,
        url: row.url,
        name: row.name,
        tags: JSON.parse(row.tags || '[]'),
        aiGenerated: JSON.parse(row.ai_generated || '[]'),
        added: row.added,
        updated: row.updated
    };
}

/**
 * SQLite-backed store. All methods are synchronous (better-sqlite3),
 * but callers treat them as async so both backends share one interface.
 */
class SqliteStore {
    backend = 'sqlite';

    constructor(db, dbPath) {
        this.db = db;
        this.location = dbPath;
        this.statements = new Map();
    }

    stmt(sql) {
        let prepared = this.statements.get(sql);
        if (!prepared) {
            prepared = this.db.prepare(sql);
            this.statements.set(sql, prepared);
        }
        return prepared;
    }

    init() {
        this.db.pragma('journal_mode = WAL');
        this.db.pragma('synchronous = NORMAL');
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS links (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                url TEXT UNIQUE NOT NULL,
                name TEXT,
                tags TEXT,
                ai_generated TEXT,
                added DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated DATETIME DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS idx_added ON links(added);
        `);
    }

    addMany(links) {
        const insert = this.stmt(`
            INSERT OR IGNORE INTO links (url, name, tags, ai_generated, added)
            VALUES (?, ?, ?, ?, ?)
        `);
        const run = this.db.transaction((list) => {
            let inserted = 0;
            for (const link of list) {
                inserted += insert.run(
                    link.url,
                    link.name || null,
                    JSON.stringify(link.tags || []),
                    JSON.stringify(link.aiGenerated || []),
                    link.added || new Date().toISOString()
                ).changes;
            }
            return inserted;
        });
        const inserted = run(links);
        return { inserted, duplicates: links.length - inserted };
    }

    page(options = {}) {
        const { page, limit, search, tag, sort } = pageOptions(options);
        const conditions = [];
        const params = [];

        if (search) {
            conditions.push('(url LIKE ? OR name LIKE ? OR tags LIKE ?)');
            const pattern = `%${search}%`;
            params.push(pattern, pattern, pattern);
        }
        if (tag) {
            conditions.push(`EXISTS (SELECT 1 FROM json_each(COALESCE(links.tags, '[]')) WHERE value = ?)`);
            params.push(tag);
        }

        const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
        const order = PAGE_SORTS[sort] || PAGE_SORTS.newest;

        const totalCount = this.stmt(`SELECT COUNT(*) AS c FROM links ${where}`).get(...params).c;
        const offset = (page - 1) * limit;
        const rows = this.stmt(`SELECT * FROM links ${where} ${order} LIMIT ? OFFSET ?`)
            .all(...params, limit, offset);

        return pageResult(rows.map(rowToLink), totalCount, page, limit);
    }

    all() {
        return this.stmt('SELECT * FROM links ORDER BY added DESC').all().map(rowToLink);
    }

    untagged() {
        return this.stmt(`SELECT * FROM links WHERE tags IS NULL OR tags = '[]'`).all().map(rowToLink);
    }

    setTagsMany(updates) {
        const update = this.stmt(`
            UPDATE links
            SET tags = ?, ai_generated = ?, updated = CURRENT_TIMESTAMP
            WHERE url = ?
        `);
        const run = this.db.transaction((items) => {
            let changed = 0;
            for (const item of items) {
                changed += update.run(
                    JSON.stringify(item.tags),
                    JSON.stringify(item.aiGenerated || []),
                    item.url
                ).changes;
            }
            return changed;
        });
        return run(updates);
    }

    remove(ids) {
        const del = this.stmt('DELETE FROM links WHERE id = ?');
        const run = this.db.transaction((list) => {
            let deleted = 0;
            for (const id of list) deleted += del.run(id).changes;
            return deleted;
        });
        return run(ids);
    }

    stats() {
        const totalLinks = this.stmt('SELECT COUNT(*) AS c FROM links').get().c;
        const allTags = this.stmt(`
            SELECT DISTINCT value AS tag
            FROM links, json_each(COALESCE(links.tags, '[]'))
            ORDER BY tag COLLATE NOCASE
        `).all().map((row) => row.tag);
        const aiTagCount = this.stmt(`
            SELECT COALESCE(SUM(json_array_length(COALESCE(ai_generated, '[]'))), 0) AS c
            FROM links
        `).get().c;

        return { totalLinks, totalTags: allTags.length, aiTagCount, allTags };
    }

    isEmpty() {
        return this.stmt('SELECT COUNT(*) AS c FROM links').get().c === 0;
    }

    close() {
        this.db.close();
    }
}

/**
 * JSON-file store used only when the native SQLite module cannot load.
 * Keeps everything in memory and persists atomically after each mutation.
 */
class JsonStore {
    backend = 'json';

    constructor(filePath) {
        this.location = filePath;
        this.links = [];
        this.urls = new Set();
        this.nextId = 1;
    }

    async init() {
        try {
            const raw = await fs.readFile(this.location, 'utf8');
            this.links = JSON.parse(raw);
        } catch (error) {
            if (error.code !== 'ENOENT') throw error;
            this.links = [];
        }
        for (const link of this.links) {
            if (typeof link.id !== 'number') link.id = this.nextId;
            this.nextId = Math.max(this.nextId, Math.floor(link.id) + 1);
            this.urls.add(link.url);
        }
    }

    async persist() {
        const tmp = `${this.location}.tmp`;
        await fs.writeFile(tmp, JSON.stringify(this.links, null, 2));
        await fs.rename(tmp, this.location);
    }

    async addMany(links) {
        let inserted = 0;
        for (const link of links) {
            if (this.urls.has(link.url)) continue;
            this.urls.add(link.url);
            this.links.push({
                id: this.nextId++,
                url: link.url,
                name: link.name || null,
                tags: link.tags || [],
                aiGenerated: link.aiGenerated || [],
                added: link.added || new Date().toISOString()
            });
            inserted++;
        }
        if (inserted > 0) await this.persist();
        return { inserted, duplicates: links.length - inserted };
    }

    page(options = {}) {
        const { page, limit, search, tag, sort } = pageOptions(options);
        const term = search.toLowerCase();
        const filtered = this.links.filter((link) => {
            const matchesSearch = !term ||
                link.url.toLowerCase().includes(term) ||
                (link.name && link.name.toLowerCase().includes(term)) ||
                (link.tags || []).some((t) => t.toLowerCase().includes(term));
            const matchesTag = !tag || (link.tags || []).includes(tag);
            return matchesSearch && matchesTag;
        });

        const byName = (link) => link.name || link.url;
        filtered.sort((a, b) => {
            switch (sort) {
                case 'oldest': return new Date(a.added) - new Date(b.added);
                case 'url': return a.url.localeCompare(b.url);
                case 'name': return byName(a).localeCompare(byName(b));
                default: return new Date(b.added) - new Date(a.added);
            }
        });

        const offset = (page - 1) * limit;
        return pageResult(filtered.slice(offset, offset + limit), filtered.length, page, limit);
    }

    all() {
        return [...this.links].sort((a, b) => new Date(b.added) - new Date(a.added));
    }

    untagged() {
        return this.links.filter((link) => !link.tags || link.tags.length === 0);
    }

    async setTagsMany(updates) {
        const byUrl = new Map(this.links.map((link) => [link.url, link]));
        let changed = 0;
        for (const item of updates) {
            const link = byUrl.get(item.url);
            if (!link) continue;
            link.tags = item.tags;
            link.aiGenerated = item.aiGenerated || [];
            link.updated = new Date().toISOString();
            changed++;
        }
        if (changed > 0) await this.persist();
        return changed;
    }

    async remove(ids) {
        const idSet = new Set(ids);
        const before = this.links.length;
        this.links = this.links.filter((link) => !idSet.has(link.id));
        const deleted = before - this.links.length;
        if (deleted > 0) {
            this.urls = new Set(this.links.map((link) => link.url));
            await this.persist();
        }
        return deleted;
    }

    stats() {
        const tagSet = new Set();
        let aiTagCount = 0;
        for (const link of this.links) {
            for (const tag of link.tags || []) tagSet.add(tag);
            aiTagCount += (link.aiGenerated || []).length;
        }
        const allTags = [...tagSet].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
        return { totalLinks: this.links.length, totalTags: allTags.length, aiTagCount, allTags };
    }

    close() {}
}

async function migrateLegacyJson(store, jsonPath) {
    if (!store.isEmpty()) return;

    let raw;
    try {
        raw = await fs.readFile(jsonPath, 'utf8');
    } catch {
        return; // nothing to migrate
    }

    try {
        const links = JSON.parse(raw);
        if (!Array.isArray(links) || links.length === 0) return;
        const { inserted } = store.addMany(links.filter((link) => link && link.url));
        await fs.copyFile(jsonPath, `${jsonPath}.backup`);
        console.log(`Migrated ${inserted} links from links.json (backup written)`);
    } catch (error) {
        console.error('Legacy JSON migration failed:', error);
    }
}

export async function createStore(userDataDir) {
    const dbPath = path.join(userDataDir, 'links.db');
    const jsonPath = path.join(userDataDir, 'links.json');

    try {
        const { default: Database } = await import('better-sqlite3');
        const store = new SqliteStore(new Database(dbPath), dbPath);
        store.init();
        await migrateLegacyJson(store, jsonPath);
        return store;
    } catch (error) {
        console.error('SQLite unavailable, falling back to JSON store:', error.message);
        const store = new JsonStore(jsonPath);
        await store.init();
        return store;
    }
}
