const FORMULA_PREFIX = /^(?:[=+\-@]|[\t\r\n]|[ \f\v]+[=+\-@])/u;

/** Serialize an untrusted value as a literal spreadsheet cell. */
export function csvField(value) {
    let text = String(value ?? '');
    if (FORMULA_PREFIX.test(text)) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
}

export function serializeLinksCsv(links) {
    const rows = links.map((link) => [
        csvField(link.url),
        csvField(link.name),
        csvField((link.tags || []).join(';')),
        csvField(link.added)
    ].join(','));
    return ['URL,Name,Tags,Date Added', ...rows].join('\n');
}
