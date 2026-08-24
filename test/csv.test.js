import test from 'node:test';
import assert from 'node:assert/strict';
import { csvField, serializeLinksCsv } from '../src/main/csv.js';

test('csvField neutralizes spreadsheet formulas and control-character prefixes', () => {
    for (const value of [
        '=WEBSERVICE("https://example.test")',
        '+SUM(1,1)',
        '-1+2',
        '@SUM(1,1)',
        '\t=1+1',
        '\r=1+1',
        '\n=1+1',
        '  =1+1'
    ]) {
        assert.equal(csvField(value).startsWith('"\''), true, value);
    }
});

test('csvField preserves normal text while escaping CSV quotes', () => {
    assert.equal(csvField('Example, "quoted"'), '"Example, ""quoted"""');
    assert.equal(csvField('  ordinary text'), '"  ordinary text"');
});

test('serializeLinksCsv applies literal-cell encoding to imported fields', () => {
    const csv = serializeLinksCsv([{
        url: 'https://example.com/',
        name: '=WEBSERVICE("https://example.test")',
        tags: ['@SUM(1,1)'],
        added: '2026-08-24T00:00:00.000Z'
    }]);

    assert.match(csv, /"'=WEBSERVICE\(""https:\/\/example\.test""\)"/u);
    assert.match(csv, /"'@SUM\(1,1\)"/u);
});
