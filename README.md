# Link Saver

A fast, minimal desktop app for saving, organizing, and managing bookmarks — with smart tag suggestions based on domain, TLD, and URL-path analysis. Built with Electron.

## Features

- **Library view** — search, tag filter, and sorting over your full collection, with paginated loading
- **Smart tagging** — untagged links automatically get suggested tags on save; a one-click pass can auto-tag your whole backlog
- **Bulk import** — paste OneTab exports, `URL, tags` CSV lines, or plain URL lists; the format is detected automatically
- **Multi-select delete** — select links directly in the library and delete them in one batch
- **Export / Import** — JSON or CSV export, JSON import with duplicate and validity checks
- **SQLite storage** — WAL-mode SQLite via `better-sqlite3`, with automatic one-time migration from the legacy `links.json` and a pure-JSON fallback if the native module can't load

## Architecture

```
main.js                 Electron entry: window + app lifecycle
preload.js              contextBridge API (sandboxed, IPC only)
index.html              App shell
src/
  main/
    store.js            Storage layer: SqliteStore + JsonStore behind one interface
    tagger.js           Heuristic URL analyzer / tag suggester
    ipc.js              IPC handlers, input validation, import/export
  renderer/
    app.js              UI logic (no framework, event delegation)
    styles.css          Design system
```

Security: sandboxed renderer with context isolation, strict CSP, IPC-validated `openExternal` (http/https only), and all renderer input sanitized in the main process.

The app makes no network requests of its own — your saved links are never sent anywhere. Browsing the library is entirely offline; URLs leave the app only when you explicitly open one.

## Development

```bash
npm install
npm start
```

## Building

```bash
npm run build        # current platform
npm run build-win    # Windows
npm run dist         # all configured targets, no publish
```

Installers are written to `dist/`.

## Data location

Links are stored in the Electron user-data directory (`links.db`):

- macOS: `~/Library/Application Support/linkssaver/`
- Windows: `%APPDATA%/linkssaver/`
- Linux: `~/.config/linkssaver/`

## License

MIT
