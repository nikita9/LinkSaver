import test from 'node:test';
import assert from 'node:assert/strict';
import {
    normalizeUrl,
    prepareBatch,
    prepareLink,
    sanitizeTags
} from '../src/main/link-service.js';

test('normalizeUrl accepts only canonical HTTP(S) URLs', () => {
    assert.equal(normalizeUrl(' HTTPS://Example.COM:443/path?q=1 '), 'https://example.com/path?q=1');
    assert.equal(normalizeUrl('https://example.com | Example title'), 'https://example.com/');
    assert.equal(normalizeUrl('https://example.com/a,b'), 'https://example.com/a,b');
    assert.equal(normalizeUrl('javascript:alert(1)'), null);
    assert.equal(normalizeUrl('file:///tmp/private'), null);
    assert.equal(normalizeUrl({}), null);
});

test('sanitizeTags trims, bounds, and de-duplicates tags case-insensitively', () => {
    const tags = sanitizeTags([' Work ', 'work', '', null, 'x'.repeat(80)]);
    assert.deepEqual(tags, ['Work', 'x'.repeat(64)]);
});

test('prepareLink sanitizes imported fields and preserves supplied tags', () => {
    const link = prepareLink({
        url: 'https://example.com',
        name: `  ${'A'.repeat(600)}  `,
        tags: ['Reference'],
        added: '2026-08-23T10:30:00+03:00'
    });

    assert.equal(link.url, 'https://example.com/');
    assert.equal(link.name.length, 500);
    assert.deepEqual(link.tags, ['Reference']);
    assert.deepEqual(link.aiGenerated, []);
    assert.equal(link.added, '2026-08-23T07:30:00.000Z');
});

test('prepareLink auto-tags untagged URLs', () => {
    const link = prepareLink({ url: 'https://github.com/openai/codex', tags: [] });

    assert.ok(link.tags.includes('github'));
    assert.deepEqual(link.aiGenerated, link.tags);
});

test('prepareBatch reports invalid and canonical duplicate records', () => {
    const result = prepareBatch([
        { url: 'https://example.com' },
        { url: 'https://EXAMPLE.com/' },
        { url: 'not a URL' }
    ]);

    assert.equal(result.links.length, 1);
    assert.equal(result.duplicates, 1);
    assert.equal(result.invalid, 1);
    assert.equal(result.aiEnhanced, 1);
});
