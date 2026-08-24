# Link Saver

A fast, minimal desktop app for saving, organizing, and managing bookmarks — with smart tag suggestions based on domain, TLD, and URL-path analysis. Built with Electron.

[![CI](https://github.com/nikita9/LinkSaver/actions/workflows/ci.yml/badge.svg)](https://github.com/nikita9/LinkSaver/actions/workflows/ci.yml)
[![Release](https://github.com/nikita9/LinkSaver/actions/workflows/release.yml/badge.svg)](https://github.com/nikita9/LinkSaver/actions/workflows/release.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

[Download the latest release](https://github.com/nikita9/LinkSaver/releases/latest) · [Read the Wiki](https://github.com/nikita9/LinkSaver/wiki)

> [!WARNING]
> The v2.1.0 macOS and Windows packages were published before trusted code-signing was enforced. Verify `SHA256SUMS` before opening them, and use only the documented per-app operating-system exception. Never disable Gatekeeper or SmartScreen globally.

## Install Link Saver

1. Open the [latest release](https://github.com/nikita9/LinkSaver/releases/latest).
2. Download the package for your operating system and `SHA256SUMS`.
3. Verify the checksum, then follow the platform-specific installation steps.

See the **[complete installation guide](docs/INSTALLATION.md)** for download selection, checksum commands, macOS **Open Anyway**, Windows SmartScreen, Linux installation, and building locally from source.

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
preload.cjs             contextBridge API (sandboxed, IPC only)
index.html              App shell
src/
  main/
    store.js            Storage layer: SqliteStore + JsonStore behind one interface
    link-service.js     Input normalization, validation, and batch preparation
    tagger.js           Heuristic URL analyzer / tag suggester
    ipc.js              IPC handlers, input validation, import/export
  renderer/
    app.js              UI logic (no framework, event delegation)
    styles.css          Design system
```

Security: sandboxed renderer with context isolation, strict CSP, IPC-validated `openExternal` (http/https only), and all renderer input sanitized in the main process.

The app makes no network requests of its own — your saved links are never sent anywhere. Browsing the library is entirely offline; URLs leave the app only when you explicitly open one.

## Development

Requires Node.js 22.13 or a newer supported even-numbered release.

```bash
npm ci
npm run check
npm start
```

See [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request.

## Building

```bash
npm run pack          # unpacked app for the current platform
npm run build         # installers for the current platform
npm run build:mac     # macOS DMG (x64 and arm64)
npm run build:win     # Windows installer and portable app (x64)
npm run build:linux   # Linux AppImage and Debian package (x64)
npm run clean         # remove generated dist/ output
```

Installers are written to `dist/`.

## Releases

CI runs linting, unit tests, a production dependency audit, and a packaging smoke test for every pull request and push to `main`. Tags matching the package version build on native macOS, Windows, and Linux runners. Stable releases fail closed unless macOS Developer ID/notarization credentials and Windows Authenticode credentials are configured. The workflow verifies signatures before publishing installers and `SHA256SUMS`.

Maintainers should follow [docs/RELEASING.md](docs/RELEASING.md).

## Data location

Links are stored in the Electron user-data directory (`links.db`):

- macOS: `~/Library/Application Support/linkssaver/`
- Windows: `%APPDATA%/linkssaver/`
- Linux: `~/.config/linkssaver/`

## License

[MIT](LICENSE)

## Contributing and security

- Contributions are welcome under [CONTRIBUTING.md](CONTRIBUTING.md) and the [Code of Conduct](CODE_OF_CONDUCT.md).
- Report vulnerabilities privately according to [SECURITY.md](SECURITY.md). Do not open public security issues.
