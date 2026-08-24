# Contributing to Link Saver

Thanks for improving Link Saver. Keep changes focused, preserve the offline-first privacy model, and include tests for behavior changes.

## Before you start

- Search existing issues before opening a duplicate.
- Use a public issue for bugs and feature proposals.
- Report vulnerabilities privately through the process in [SECURITY.md](SECURITY.md).
- Follow the [Code of Conduct](CODE_OF_CONDUCT.md).

## Development setup

Use Node.js 22.13 or a newer supported even-numbered release.

```bash
npm ci
npm run check
npm start
```

Before submitting a pull request, run:

```bash
npm run check
npm run pack
npm run clean
```

Do not commit `node_modules/`, `dist/`, local bookmark data, credentials, certificates, or signing keys.

## Pull requests

- Create a focused branch from `main`.
- Explain the problem, the chosen approach, and how it was verified.
- Add or update tests for user-visible behavior and bug fixes.
- Update documentation and `CHANGELOG.md` when behavior or release requirements change.
- Keep unrelated formatting and dependency changes out of the pull request.
- Confirm that the application still makes no background network requests.

Pull requests require passing CI and maintainer review before merge.
