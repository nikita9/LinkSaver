import { analyzeUrl } from './tagger.js';

export const MAX_BATCH_SIZE = 10_000;

const MAX_NAME_LENGTH = 500;
const MAX_TAG_LENGTH = 64;
const MAX_TAGS_PER_LINK = 20;
const MAX_URL_LENGTH = 8_192;

/** Normalize a URL received from an untrusted renderer or import file. */
export function normalizeUrl(raw) {
    if (typeof raw !== 'string') return null;

    const cleaned = raw.split(/\s+\|\s+/u, 1)[0].trim();
    if (!cleaned || cleaned.length > MAX_URL_LENGTH) return null;

    try {
        const parsed = new URL(cleaned);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
        return parsed.href;
    } catch {
        return null;
    }
}

export function sanitizeTags(tags) {
    if (!Array.isArray(tags)) return [];

    const unique = new Map();
    for (const tag of tags) {
        if (typeof tag !== 'string') continue;
        const value = tag.trim().slice(0, MAX_TAG_LENGTH);
        const key = value.toLocaleLowerCase();
        if (value && !unique.has(key)) unique.set(key, value);
        if (unique.size === MAX_TAGS_PER_LINK) break;
    }
    return [...unique.values()];
}

function normalizeTimestamp(value) {
    if (typeof value !== 'string') return undefined;
    const timestamp = Date.parse(value);
    return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : undefined;
}

/** Build a sanitized link record and add heuristic tags when none were supplied. */
export function prepareLink(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) return null;

    const url = normalizeUrl(input.url);
    if (!url) return null;

    const name = typeof input.name === 'string'
        ? input.name.trim().slice(0, MAX_NAME_LENGTH) || null
        : null;
    const link = {
        url,
        name,
        tags: sanitizeTags(input.tags),
        aiGenerated: [],
        added: normalizeTimestamp(input.added)
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

/** Sanitize, de-duplicate, and summarize a batch from the renderer or an import. */
export function prepareBatch(inputs) {
    if (!Array.isArray(inputs)) {
        return { links: [], invalid: 0, duplicates: 0, aiEnhanced: 0 };
    }

    const seen = new Set();
    const links = [];
    let invalid = Math.max(0, inputs.length - MAX_BATCH_SIZE);
    let duplicates = 0;
    let aiEnhanced = 0;

    for (const input of inputs.slice(0, MAX_BATCH_SIZE)) {
        const link = prepareLink(input);
        if (!link) {
            invalid++;
            continue;
        }
        if (seen.has(link.url)) {
            duplicates++;
            continue;
        }
        seen.add(link.url);
        if (link.aiGenerated.length > 0) aiEnhanced++;
        links.push(link);
    }
    return { links, invalid, duplicates, aiEnhanced };
}
