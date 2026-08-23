import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeUrl } from '../src/main/tagger.js';

test('analyzeUrl applies domain and path heuristics without network access', () => {
    const result = analyzeUrl('https://docs.github.com/en/rest/api');

    assert.equal(result.ok, true);
    assert.ok(result.tags.includes('github'));
    assert.ok(result.tags.length <= 5);
});

test('analyzeUrl uses stable fallback tags and rejects invalid URLs', () => {
    assert.deepEqual(analyzeUrl('https://example.com').tags, ['website', 'reference']);
    assert.equal(analyzeUrl('not a URL').ok, false);
});
