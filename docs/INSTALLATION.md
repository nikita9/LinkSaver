# Install Link Saver

Link Saver is available as a prebuilt desktop application for macOS, Windows, and Linux. Download files only from the official [GitHub Releases](https://github.com/nikita9/LinkSaver/releases/latest) page.

## Choose the right download

Replace `<version>` with the release number shown on GitHub.

| System | Download |
| --- | --- |
| macOS with Apple silicon (M1 or newer) | `Link.Saver-<version>-mac-arm64.dmg` |
| macOS with an Intel processor | `Link.Saver-<version>-mac-x64.dmg` |
| Windows 10/11, installer | `Link.Saver-Setup-<version>-x64.exe` |
| Windows 10/11, portable | `Link.Saver-Portable-<version>-x64.exe` |
| Ubuntu, Debian, or a derivative | `Link.Saver-<version>-linux-amd64.deb` |
| Other x64 Linux distributions | `Link.Saver-<version>-linux-x86_64.AppImage` |

On a Mac, open **Apple menu → About This Mac** if you are unsure whether it has an Apple or Intel processor.

## Verify the download

Each release includes `SHA256SUMS`. Download it alongside the application and compare the checksum before overriding any operating-system warning.

### macOS

In Terminal, change the asset name to the file you downloaded:

```bash
cd ~/Downloads
ASSET="Link.Saver-2.1.0-mac-arm64.dmg"
grep -F "  ./$ASSET" SHA256SUMS | shasum -a 256 -c -
```

The result must end with `OK`.

### Windows

In PowerShell, change the filename as needed:

```powershell
Get-FileHash .\Link.Saver-Setup-2.1.0-x64.exe -Algorithm SHA256
```

Compare the displayed hash with the matching line in `SHA256SUMS`. They must be identical.

### Linux

Change the asset name to the file you downloaded:

```bash
ASSET="Link.Saver-2.1.0-linux-x86_64.AppImage"
grep -F "  ./$ASSET" SHA256SUMS | sha256sum -c -
```

The result must end with `OK`.

If verification fails, delete the files and download them again from GitHub Releases. Do not run a file with a mismatched checksum.

## macOS installation

> [!IMPORTANT]
> The v2.1.0 Mac packages are not signed or notarized with an Apple Developer ID. macOS will therefore block the first launch even when the checksum is correct.

1. Open the `.dmg` and drag **Link Saver** into **Applications**.
2. Eject the Link Saver disk image.
3. Try to open **Link Saver** from Applications once, then dismiss the warning.
4. Open **System Settings → Privacy & Security**.
5. Scroll to **Security** and select **Open Anyway** for Link Saver.
6. Authenticate when macOS asks, then select **Open**.

The exception applies only to this copy of Link Saver. Do not disable Gatekeeper globally. Apple documents this process in [Safely open apps on your Mac](https://support.apple.com/en-us/102445).

If **Open Anyway** is unavailable, retry step 3 and return to Privacy & Security within about an hour. On an organization-managed Mac, an administrator may prevent unsigned applications from running; use the source-build option below instead.

## Windows installation

> [!IMPORTANT]
> The v2.1.0 Windows packages do not have an Authenticode publisher signature, so Microsoft Defender SmartScreen may show **Windows protected your PC**.

1. Verify the checksum first.
2. Run the installer, or run the portable `.exe` without installing it.
3. If SmartScreen warns about an unrecognized app, select **More info**.
4. Confirm that the filename matches the verified download, then select **Run anyway**.

Do not disable SmartScreen globally. Some Windows 11 systems use Smart App Control and do not offer **Run anyway** for unsigned software; use the source-build option below on those systems. Microsoft explains the unsigned-app behavior in [SmartScreen reputation for Windows app developers](https://learn.microsoft.com/windows/apps/package-and-deploy/smartscreen-reputation).

## Linux installation

For Debian or Ubuntu:

```bash
sudo apt install ./Link.Saver-2.1.0-linux-amd64.deb
```

For the AppImage:

```bash
chmod +x Link.Saver-2.1.0-linux-x86_64.AppImage
./Link.Saver-2.1.0-linux-x86_64.AppImage
```

## Build locally instead

Building locally avoids running a downloaded unsigned application bundle. Install Git and [Node.js](https://nodejs.org/) 22.13 or a newer supported even-numbered release, then run:

```bash
git clone https://github.com/nikita9/LinkSaver.git
cd LinkSaver
npm ci
npm run check
npm run pack
```

The unpacked application is created under `dist/` for the current computer. To create an installer instead, run `npm run build`.

## Getting help

If the checksum is correct but Link Saver still does not start, open a [bug report](https://github.com/nikita9/LinkSaver/issues/new?template=bug_report.yml) and include the operating system, selected download, and exact error message. Do not post passwords, private links, or other sensitive data.
