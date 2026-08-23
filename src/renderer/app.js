'use strict';

// ── Helpers ──

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

function debounce(fn, wait) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), wait);
    };
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

const dateCache = new Map();
function formatDate(iso) {
    let formatted = dateCache.get(iso);
    if (!formatted) {
        formatted = new Date(iso).toLocaleDateString(undefined, {
            month: 'short', day: 'numeric', year: 'numeric'
        });
        if (dateCache.size < 2000) dateCache.set(iso, formatted);
    }
    return formatted;
}

function domainOf(url) {
    try {
        return new URL(url).hostname.replace(/^www\./, '');
    } catch {
        return url;
    }
}

function toast(type, message) {
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = message;
    $('#toasts').appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => {
        el.classList.remove('show');
        setTimeout(() => el.remove(), 250);
    }, 3200);
}

function pluralize(count, noun) {
    return `${count} ${count === 1 ? noun : `${noun}s`}`;
}

/** "Imported 4 links (2 auto-tagged), 1 duplicate skipped" — shared by bulk paste and file import. */
function importSummary(added, result) {
    let msg = `Imported ${pluralize(added, 'link')}`;
    if (result.aiEnhanced > 0) msg += ` (${result.aiEnhanced} auto-tagged)`;
    if (result.duplicates > 0) msg += `, ${pluralize(result.duplicates, 'duplicate')} skipped`;
    if (result.invalid > 0) msg += `, ${result.invalid} invalid`;
    return msg;
}

function parseTags(value) {
    return [...new Set(value.split(',').map((t) => t.trim()).filter(Boolean))];
}

// ── State ──

const state = {
    page: 1,
    limit: 50,
    search: '',
    tag: '',
    sort: 'newest',
    totalCount: 0,
    loading: false,
    selected: new Set(),
    view: 'library'
};

// ── Navigation ──

function switchView(name) {
    state.view = name;
    $$('.nav-item').forEach((btn) => btn.classList.toggle('active', btn.dataset.view === name));
    $$('.view').forEach((view) => view.classList.toggle('active', view.id === `view-${name}`));

    if (name === 'library') {
        clearSelection();
        loadLibrary(true);
        refreshTags();
    } else if (name === 'manage') {
        loadManage();
    } else if (name === 'add') {
        $('#urlInput').focus();
    }
}

// ── Library: loading & rendering ──

async function loadLibrary(reset) {
    if (state.loading) return;
    state.loading = true;
    if (reset) state.page = 1;

    try {
        const result = await window.api.getPage({
            page: state.page,
            limit: state.limit,
            search: state.search,
            tag: state.tag,
            sort: state.sort
        });
        if (!result.ok) {
            toast('error', result.error || 'Failed to load links');
            return;
        }

        state.totalCount = result.totalCount;
        renderCards(result.links, reset);

        const noun = result.totalCount === 1 ? 'link' : 'links';
        $('#librarySub').textContent = state.search || state.tag
            ? `${result.totalCount} matching ${noun}`
            : `${result.totalCount} saved ${noun}`;

        const loadMore = $('#loadMoreBtn');
        loadMore.hidden = !result.hasMore;
        if (result.hasMore) {
            const shown = state.page * state.limit;
            loadMore.textContent = `Load more (${result.totalCount - shown} remaining)`;
        }

        const empty = $('#libraryEmpty');
        empty.hidden = result.totalCount !== 0;
        if (result.totalCount === 0) {
            const filtered = Boolean(state.search || state.tag);
            $('#emptyTitle').textContent = filtered ? 'No matches' : 'No links yet';
            $('#emptyText').textContent = filtered
                ? 'Try a different search or clear the tag filter.'
                : 'Save your first link from the Add Link tab.';
        }
    } catch (error) {
        toast('error', `Error: ${error.message}`);
    } finally {
        state.loading = false;
    }
}

const ICONS = {
    copy: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>',
    open: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>',
    trash: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>'
};

function cardHtml(link) {
    const domain = domainOf(link.url);
    const title = link.name || link.url;
    const aiSet = new Set(link.aiGenerated || []);
    const chips = (link.tags || []).map((tag) => {
        const ai = aiSet.has(tag);
        return `<button class="chip${ai ? ' ai' : ''}" data-tag="${escapeHtml(tag)}" title="${ai ? 'Auto tag — click to filter' : 'Click to filter'}">${escapeHtml(tag)}</button>`;
    }).join('');
    const selected = state.selected.has(link.id);

    return `
    <article class="card${selected ? ' selected' : ''}" data-id="${link.id}" data-url="${escapeHtml(link.url)}">
        <label class="card-check"><input type="checkbox"${selected ? ' checked' : ''}></label>
        <div class="favicon" aria-hidden="true">${escapeHtml(domain.charAt(0).toUpperCase() || '?')}</div>
        <div class="card-body">
            <div class="card-title" data-action="open" title="${escapeHtml(link.url)}">${escapeHtml(title)}</div>
            <div class="card-meta">${escapeHtml(domain)} · ${formatDate(link.added)}</div>
            ${chips ? `<div class="card-tags">${chips}</div>` : ''}
        </div>
        <div class="card-actions">
            <button class="icon-btn" data-action="copy" title="Copy URL">${ICONS.copy}</button>
            <button class="icon-btn" data-action="open" title="Open link">${ICONS.open}</button>
            <button class="icon-btn danger" data-action="delete" title="Delete">${ICONS.trash}</button>
        </div>
    </article>`;
}

function renderCards(links, reset) {
    const list = $('#linkList');
    const html = links.map(cardHtml).join('');
    if (reset) {
        list.innerHTML = html;
    } else {
        list.insertAdjacentHTML('beforeend', html);
    }
}

// ── Library: interactions (event delegation) ──

function setupLibrary() {
    const list = $('#linkList');

    list.addEventListener('click', async (e) => {
        const chip = e.target.closest('.chip[data-tag]');
        if (chip) {
            state.tag = chip.dataset.tag;
            $('#tagFilter').value = state.tag;
            clearSelection();
            loadLibrary(true);
            return;
        }

        const actionBtn = e.target.closest('[data-action]');
        if (!actionBtn) return;
        const card = actionBtn.closest('.card');
        const url = card.dataset.url;

        switch (actionBtn.dataset.action) {
            case 'open':
                window.api.openExternal(url);
                break;
            case 'copy':
                try {
                    await navigator.clipboard.writeText(url);
                    toast('success', 'URL copied');
                } catch {
                    toast('error', 'Copy failed');
                }
                break;
            case 'delete':
                deleteLinks([Number(card.dataset.id)]);
                break;
        }
    });

    list.addEventListener('change', (e) => {
        if (e.target.type !== 'checkbox') return;
        const card = e.target.closest('.card');
        const id = Number(card.dataset.id);
        if (e.target.checked) state.selected.add(id);
        else state.selected.delete(id);
        card.classList.toggle('selected', e.target.checked);
        updateSelectionBar();
    });

    $('#searchInput').addEventListener('input', debounce((e) => {
        state.search = e.target.value.trim();
        clearSelection();
        loadLibrary(true);
    }, 250));

    $('#tagFilter').addEventListener('change', (e) => {
        state.tag = e.target.value;
        clearSelection();
        loadLibrary(true);
    });

    $('#sortSelect').addEventListener('change', (e) => {
        state.sort = e.target.value;
        loadLibrary(true);
    });

    $('#loadMoreBtn').addEventListener('click', () => {
        state.page++;
        loadLibrary(false);
    });

    $('#selectPageBtn').addEventListener('click', () => {
        $$('.card', list).forEach((card) => {
            state.selected.add(Number(card.dataset.id));
            card.classList.add('selected');
            $('input[type="checkbox"]', card).checked = true;
        });
        updateSelectionBar();
    });

    $('#clearSelectionBtn').addEventListener('click', clearSelection);

    $('#deleteSelectedBtn').addEventListener('click', () => {
        deleteLinks([...state.selected]);
    });

    // '/' focuses search when browsing the library
    document.addEventListener('keydown', (e) => {
        if (e.key === '/' && state.view === 'library' &&
            !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) {
            e.preventDefault();
            $('#searchInput').focus();
        }
    });
}

function updateSelectionBar() {
    const count = state.selected.size;
    $('#selectionBar').hidden = count === 0;
    $('#selectionCount').textContent = `${count} selected`;
    $('#linkList').classList.toggle('selecting', count > 0);
}

function clearSelection() {
    state.selected.clear();
    $$('#linkList .card.selected').forEach((card) => {
        card.classList.remove('selected');
        const cb = $('input[type="checkbox"]', card);
        if (cb) cb.checked = false;
    });
    updateSelectionBar();
}

async function deleteLinks(ids) {
    if (ids.length === 0) return;
    const word = ids.length === 1 ? 'link' : `${ids.length} links`;
    if (!confirm(`Delete ${word}? This cannot be undone.`)) return;

    const result = await window.api.deleteLinks(ids);
    if (result.ok) {
        toast('success', `Deleted ${pluralize(result.deleted, 'link')}`);
        clearSelection();
        loadLibrary(true);
        refreshTags();
    } else {
        toast('error', result.error || 'Delete failed');
    }
}

// ── Tags & counts ──

async function refreshTags() {
    try {
        const stats = await window.api.getStats();
        if (!stats.ok) return;

        const select = $('#tagFilter');
        const current = state.tag;
        select.innerHTML = '<option value="">All tags</option>' +
            stats.allTags.map((tag) =>
                `<option value="${escapeHtml(tag)}">${escapeHtml(tag)}</option>`
            ).join('');
        select.value = stats.allTags.includes(current) ? current : '';
        if (select.value !== current) state.tag = select.value;

        $('#sidebarCount').textContent =
            `${pluralize(stats.totalLinks, 'link')} · ${stats.totalTags} tags`;
    } catch (error) {
        console.error('Failed to refresh tags:', error);
    }
}

// ── Add Link ──

function setupAdd() {
    const urlInput = $('#urlInput');
    const nameInput = $('#nameInput');
    const tagsInput = $('#tagsInput');
    const box = $('#analysisBox');

    const analyze = debounce(async () => {
        let url = urlInput.value.trim();
        if (!url) {
            box.hidden = true;
            return;
        }

        // OneTab paste: "url | title" → split into fields
        const oneTab = url.match(/^(https?:\/\/\S+)\s+\|\s+(.+)$/);
        if (oneTab) {
            url = oneTab[1];
            urlInput.value = url;
            if (!nameInput.value) nameInput.value = oneTab[2].split(' | ')[0];
        }

        const result = await window.api.analyzeUrl(url);
        box.hidden = false;
        $('#analysisText').textContent = result.ok ? result.summary : result.error;

        const tagsBox = $('#analysisTags');
        tagsBox.innerHTML = '';
        for (const tag of result.tags || []) {
            const chip = document.createElement('button');
            chip.className = 'suggest-chip';
            chip.textContent = tag;
            chip.addEventListener('click', () => {
                const current = parseTags(tagsInput.value);
                if (!current.includes(tag)) {
                    current.push(tag);
                    tagsInput.value = current.join(', ');
                }
            });
            tagsBox.appendChild(chip);
        }
    }, 400);

    urlInput.addEventListener('input', analyze);

    async function save() {
        const url = urlInput.value.trim();
        if (!url) {
            toast('error', 'Enter a URL first');
            return;
        }

        const btn = $('#saveLinkBtn');
        btn.disabled = true;
        try {
            const result = await window.api.addLink({
                url,
                name: nameInput.value.trim(),
                tags: parseTags(tagsInput.value)
            });

            if (result.ok) {
                toast('success', result.aiEnhanced ? 'Link saved with auto tags' : 'Link saved');
                urlInput.value = '';
                nameInput.value = '';
                tagsInput.value = '';
                box.hidden = true;
                refreshTags();
            } else {
                toast('error', result.error || 'Failed to save');
            }
        } finally {
            btn.disabled = false;
        }
    }

    $('#saveLinkBtn').addEventListener('click', save);
    [urlInput, nameInput, tagsInput].forEach((input) => {
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') save();
        });
    });
}

// ── Bulk Import ──

function parseBulk(content) {
    const results = [];
    for (const raw of content.split('\n')) {
        const line = raw.trim();
        if (!line) continue;

        // OneTab with tags: URL | Title | tag1, tag2
        let match = line.match(/^(https?:\/\/\S+)\s+\|\s+([^|]+)\s+\|\s+(.+)$/);
        if (match) {
            results.push({ url: match[1], name: match[2].trim(), tags: parseTags(match[3]) });
            continue;
        }
        // OneTab: URL | Title
        match = line.match(/^(https?:\/\/\S+)\s+\|\s+(.+)$/);
        if (match) {
            results.push({ url: match[1], name: match[2].trim(), tags: [] });
            continue;
        }
        // CSV: URL, tag1, tag2
        match = line.match(/^(https?:\/\/[^,]+),(.+)$/);
        if (match) {
            results.push({ url: match[1].trim(), tags: parseTags(match[2]) });
            continue;
        }
        // Plain URL (or anything else — main process validates)
        results.push({ url: line, tags: [] });
    }
    return results;
}

function setupBulk() {
    const input = $('#bulkInput');
    const hint = $('#formatHint');

    const detect = debounce(() => {
        const value = input.value.trim();
        if (!value) {
            hint.hidden = true;
            return;
        }
        const lines = value.split('\n').filter((l) => l.trim());
        const oneTab = lines.filter((l) => /^https?:\/\/\S+\s+\|\s+.+$/.test(l)).length;
        const csv = lines.filter((l) => /^https?:\/\/[^,]+,.+$/.test(l)).length;
        const plain = lines.filter((l) => /^https?:\/\/\S+$/.test(l)).length;

        let format = 'Mixed / unknown';
        if (oneTab > lines.length * 0.7) format = 'OneTab';
        else if (csv > lines.length * 0.7) format = 'CSV (URL, tags)';
        else if (plain > lines.length * 0.7) format = 'Plain URL list';

        hint.textContent = `Detected: ${format} — ${pluralize(lines.length, 'line')}`;
        hint.hidden = false;
    }, 300);

    input.addEventListener('input', detect);

    $('#saveBulkBtn').addEventListener('click', async () => {
        const value = input.value.trim();
        if (!value) {
            toast('error', 'Paste some links first');
            return;
        }

        const links = parseBulk(value);
        if (links.length === 0) {
            toast('error', 'No links found');
            return;
        }

        const btn = $('#saveBulkBtn');
        btn.disabled = true;
        try {
            const result = await window.api.addBulk(links);
            if (result.ok) {
                toast(result.added > 0 ? 'success' : 'info', importSummary(result.added, result));
                input.value = '';
                hint.hidden = true;
                refreshTags();
            } else {
                toast('error', result.error || 'Import failed');
            }
        } finally {
            btn.disabled = false;
        }
    });

    $('#clearBulkBtn').addEventListener('click', () => {
        input.value = '';
        hint.hidden = true;
    });
}

// ── Manage ──

async function loadManage() {
    try {
        const [stats, info] = await Promise.all([window.api.getStats(), window.api.appInfo()]);
        if (stats.ok) {
            $('#statLinks').textContent = stats.totalLinks;
            $('#statTags').textContent = stats.totalTags;
            $('#statAiTags').textContent = stats.aiTagCount;
        }
        if (info.ok) {
            const backend = info.backend === 'sqlite' ? 'SQLite database' : 'JSON file';
            $('#storageInfo').textContent = `${backend} — ${info.location}`;
        }
    } catch (error) {
        console.error('Failed to load manage data:', error);
    }
}

function setupManage() {
    $('#enhanceBtn').addEventListener('click', async () => {
        const btn = $('#enhanceBtn');
        btn.disabled = true;
        try {
            const result = await window.api.enhanceAll();
            if (result.ok) {
                toast('success', result.enhanced > 0
                    ? `Auto-tagged ${pluralize(result.enhanced, 'link')}`
                    : 'All links already have tags');
                loadManage();
            } else {
                toast('error', result.error || 'Auto-tagging failed');
            }
        } finally {
            btn.disabled = false;
        }
    });

    $('#exportBtn').addEventListener('click', async () => {
        const result = await window.api.exportLinks();
        if (result.ok) toast('success', `Exported ${result.count} links`);
        else if (!result.cancelled) toast('error', result.error || 'Export failed');
    });

    $('#importBtn').addEventListener('click', async () => {
        const result = await window.api.importLinks();
        if (result.ok) {
            toast(result.imported > 0 ? 'success' : 'info', importSummary(result.imported, result));
            loadManage();
            refreshTags();
        } else if (!result.cancelled) {
            toast('error', result.error || 'Import failed');
        }
    });
}

// ── Boot ──

document.addEventListener('DOMContentLoaded', () => {
    $$('.nav-item').forEach((btn) => {
        btn.addEventListener('click', () => switchView(btn.dataset.view));
    });

    setupLibrary();
    setupAdd();
    setupBulk();
    setupManage();

    switchView('library');
});
