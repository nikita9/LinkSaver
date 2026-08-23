import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { JsonStore, pageOptions, SqliteStore } from '../src/main/store.js';

test('pageOptions validates and bounds renderer-controlled values', () => {
    assert.deepEqual(pageOptions(null), {
        page: 1,
        limit: 50,
        search: '',
        tag: '',
        sort: 'newest'
    });
    assert.deepEqual(pageOptions({
        page: -5,
        limit: 50_000,
        search: '  query  ',
        tag: '  work  ',
        sort: 'DROP TABLE links'
    }), {
        page: 1,
        limit: 100,
        search: 'query',
        tag: 'work',
        sort: 'newest'
    });
});

test('JsonStore persists mutations and returns consistent pages', async (t) => {
    const directory = await mkdtemp(path.join(tmpdir(), 'link-saver-test-'));
    t.after(() => rm(directory, { recursive: true, force: true }));
    const filePath = path.join(directory, 'links.json');
    const store = new JsonStore(filePath);
    await store.init();

    const saved = await store.addMany([
        {
            url: 'https://example.com/',
            name: 'Example',
            tags: ['reference'],
            aiGenerated: [],
            added: '2026-01-01T00:00:00.000Z'
        },
        {
            url: 'https://github.com/',
            name: 'GitHub',
            tags: ['code'],
            aiGenerated: ['code'],
            added: '2026-02-01T00:00:00.000Z'
        }
    ]);

    assert.deepEqual(saved, { inserted: 2, duplicates: 0 });
    assert.equal(store.page({ search: 'git', limit: 1 }).links[0].name, 'GitHub');
    assert.equal(store.page({ tag: 'reference' }).totalCount, 1);
    assert.equal(store.stats().aiTagCount, 1);

    const reloaded = new JsonStore(filePath);
    await reloaded.init();
    assert.equal(reloaded.all().length, 2);

    const deleted = await reloaded.remove([1]);
    assert.equal(deleted, 1);
    assert.equal(JSON.parse(await readFile(filePath, 'utf8')).length, 1);
});

test('SqliteStore persists, filters, and updates native database records', async (t) => {
    const directory = await mkdtemp(path.join(tmpdir(), 'link-saver-sqlite-test-'));
    const dbPath = path.join(directory, 'links.db');
    const store = new SqliteStore(new Database(dbPath), dbPath);
    store.init();
    t.after(async () => {
        store.close();
        await rm(directory, { recursive: true, force: true });
    });

    assert.deepEqual(store.addMany([
        {
            url: 'https://example.com/',
            name: 'Example',
            tags: ['reference'],
            aiGenerated: [],
            added: '2026-01-01T00:00:00.000Z'
        },
        {
            url: 'https://github.com/',
            name: 'GitHub',
            tags: [],
            aiGenerated: [],
            added: '2026-02-01T00:00:00.000Z'
        }
    ]), { inserted: 2, duplicates: 0 });

    assert.equal(store.page({ tag: 'reference' }).totalCount, 1);
    assert.equal(store.untagged().length, 1);
    assert.equal(store.setTagsMany([
        { url: 'https://github.com/', tags: ['code'], aiGenerated: ['code'] }
    ]), 1);
    assert.deepEqual(store.stats(), {
        totalLinks: 2,
        totalTags: 2,
        aiTagCount: 1,
        allTags: ['code', 'reference']
    });
});
