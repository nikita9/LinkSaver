# Changelog

All notable changes to Link Saver are documented here.

## [2.1.0] - 2026-08-23

### Added

- CI checks for linting, unit tests, production dependency auditing, and packaging.
- Cross-platform artifact names and SHA-256 checksums on GitHub releases.
- Dependabot configuration and repository ownership metadata.

### Changed

- Upgraded Electron, electron-builder, and better-sqlite3 to supported releases.
- Refactored link normalization and batch validation into a tested service.
- Hardened renderer permissions, navigation, IPC sender validation, and CSP.
- Made the CommonJS preload boundary explicit with `preload.cjs`.
- Limited Windows packages to x64 and made cleanup cross-platform.

### Fixed

- Prevented stale search results when renderer page requests overlap.
- Counted duplicates within bulk imports correctly.
- Preserved valid URLs containing commas and normalized imported timestamps.
- Stopped loading remote favicons, keeping saved domains private.

## [2.0.0] - 2026-08-22

- Rebuilt Link Saver around SQLite storage, bulk operations, smart tags, and cross-platform packaging.

[2.1.0]: https://github.com/nikita9/LinkSaver/compare/v2.0.0...v2.1.0
[2.0.0]: https://github.com/nikita9/LinkSaver/releases/tag/v2.0.0
