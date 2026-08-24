# Releasing Link Saver

Stable installers must be signed before publication. The release workflow fails closed when required signing credentials are absent or when signature verification fails.

## Required GitHub Actions secrets

Store credentials as GitHub Actions secrets; never commit certificates, passwords, or API keys.

### macOS

| Secret | Purpose |
| --- | --- |
| `MAC_CSC_LINK` | Base64-encoded Developer ID Application `.p12` certificate |
| `MAC_CSC_KEY_PASSWORD` | Certificate password |
| `APPLE_API_KEY` | Base64-encoded App Store Connect `.p8` API key |
| `APPLE_API_KEY_ID` | App Store Connect key ID |
| `APPLE_API_ISSUER` | App Store Connect issuer ID |
| `APPLE_TEAM_ID` | Apple Developer team ID |

The workflow requires hardened runtime, submits each app to Apple notarization, and verifies `codesign`, Gatekeeper assessment, and the stapled notarization ticket.

### Windows

| Secret | Purpose |
| --- | --- |
| `WIN_CSC_LINK` | Base64-encoded Authenticode `.pfx` certificate |
| `WIN_CSC_KEY_PASSWORD` | Certificate password |

The workflow requires code signing and verifies every generated `.exe` with `Get-AuthenticodeSignature`.

## Release checklist

1. Confirm `main` is clean and CI is green.
2. Update `package.json`, `package-lock.json`, and `CHANGELOG.md` with the same semantic version.
3. Run `npm ci`, `npm run check`, and the relevant local package command.
4. Commit the release preparation.
5. Create an annotated tag matching the package version, such as `v2.2.0`.
6. Push `main` and the tag.
7. Wait for every native build, signing verification, checksum, and publication step to pass.
8. Download the public assets and verify `SHA256SUMS` before announcing the release.

The `release` GitHub environment should be protected with required maintainer review before public publication.
