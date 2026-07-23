<p align="center">
  <img src="icons/icon-96.png" alt="VaultKey Logo" width="96">
</p>

<h1 align="center">VaultKey</h1>

<p align="center">
  <strong>Offline TOTP Authenticator for Firefox</strong><br>
  <em>Your 2FA codes. Your device. No compromises.</em>
</p>

<p align="center">
  <a href="https://github.com/Ark-Lino/VaultKey/releases/latest">
    <img src="https://img.shields.io/github/v/release/Ark-Lino/VaultKey?style=flat-square&color=7c3aed" alt="Version">
  </a>
  <a href="https://github.com/Ark-Lino/VaultKey/blob/main/LICENSE">
    <img src="https://img.shields.io/github/license/Ark-Lino/VaultKey?style=flat-square&color=34d399" alt="License">
  </a>
  <img src="https://img.shields.io/badge/Firefox-109%2B-orange?style=flat-square&logo=firefox" alt="Firefox 109+">
  <img src="https://img.shields.io/badge/Chrome-Coming%20Soon-blue?style=flat-square&logo=googlechrome" alt="Chrome Soon">
</p>

<p align="center">
  <a href="#features">Features</a> &bull;
  <a href="#installation">Install</a> &bull;
  <a href="#security--privacy">Security</a> &bull;
  <a href="https://github.com/Ark-Lino/VaultKey">GitHub</a> &bull;
  <a href="https://github.com/Ark-Lino/VaultKey/stargazers">Star on GitHub</a>
</p>

---

## What is VaultKey?

VaultKey is a Firefox extension that generates **two-factor authentication (TOTP)** codes **entirely offline**. No accounts, no cloud, no tracking. Your secrets stay on your device, period.

Import your existing accounts from **Google Authenticator** via migration links, or add them manually. VaultKey generates fresh 6-digit codes every 30 seconds with **HMAC-SHA1** cryptography — using only the browser's native Web Crypto API.

> **Chrome version coming soon.**

---

## Features

| Feature | Description |
|---------|-------------|
| **100% Offline** | Zero network requests. CSP locked. No data leaves your browser. |
| **Real-time TOTP** | Live countdown with visual timer circle. Auto-refreshes every second. |
| **Google Authenticator Import** | Paste `otpauth-migration://` links to import all your accounts at once. |
| **QR Codes** | Generate scannable QR codes (ISO/IEC 18004) for each account. |
| **Dark & Light Theme** | Auto-detects your system preference, or toggle manually. |
| **Export / Import** | Backup your accounts as migration links. Restore anytime. |
| **Multi-select Delete** | Select and delete multiple accounts at once. |
| **Search** | Filter accounts by name or issuer in real-time. |
| **Zero Dependencies** | No npm packages, no external libraries (except QR encoder). What you see is what you get. |

---

## Installation

### From GitHub Releases (Recommended)

1. Go to [Releases](https://github.com/Ark-Lino/VaultKey/releases/latest)
2. Download the latest `.xpi` file
3. Open Firefox and go to `about:debugging#/runtime/this-firefox`
4. Click **"Load Temporary Add-on..."** and select the `.xpi` file
5. VaultKey appears in your toolbar

### From Source

```bash
git clone https://github.com/Ark-Lino/VaultKey.git
cd VaultKey
```

Then load the folder as a temporary add-on in Firefox.

> **Note:** Temporary add-ons are removed when Firefox restarts. To keep VaultKey permanently, it will be available on [Firefox Add-ons](https://addons.mozilla.org) soon.

---

## Security & Privacy

VaultKey is built with a **security-first** mindset:

- **Zero network requests** — The extension's CSP blocks all outgoing connections
- **Web Crypto API** — Native browser cryptography, no external crypto libs
- **Local storage only** — Secrets are stored in `browser.storage.local`, never synced to any cloud
- **No telemetry** — No analytics, no tracking, no phone-home. We don't know you exist
- **Open source** — Every line of code is auditable on GitHub
- **Manifest V3** — Latest extension format with strict content security policies

Your 2FA secrets are **yours**. VaultKey is just a tool to generate codes — nothing more.

---

## How It Works

1. **Import** accounts from Google Authenticator via migration links, or **add manually** with a Base32 secret
2. VaultKey stores your secrets **locally** in encrypted browser storage
3. Every 30 seconds, the extension generates a new **6-digit TOTP code** using HMAC-SHA1
4. **Copy** codes with one click, or **scan** QR codes to export to other apps

### Tech Stack

| Technology | Purpose |
|------------|---------|
| Web Crypto API | HMAC-SHA1 TOTP generation |
| Manifest V3 | Extension architecture |
| Protobuf Parser | Google Authenticator migration link decoding |
| QR Code ISO/IEC 18004 | Scannable QR code generation |

---

## Supported Algorithms

| Algorithm | Status |
|-----------|--------|
| SHA-1 (6 digits) | Supported |
| SHA-256 | Supported |
| SHA-512 | Supported |
| HOTP (counter-based) | Imported but not fully supported yet |

---

## Contributing

Contributions are welcome! Feel free to open issues or submit pull requests.

```bash
# Fork the repo
# Create your feature branch
git checkout -b feature/amazing-feature

# Commit your changes
git commit -m 'Add amazing feature'

# Push to the branch
git push origin feature/amazing-feature

# Open a Pull Request
```

---

## License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

## Support

If you find VaultKey useful, consider supporting the project:

<a href="https://github.com/Ark-Lino/VaultKey">
  <img src="https://img.shields.io/github/stars/Ark-Lino/VaultKey?style=for-the-badge&logo=github&color=7c3aed" alt="Star on GitHub">
</a>
<a href="https://ko-fi.com/ark_lino">
  <img src="https://img.shields.io/badge/Ko--fi-Support-FF5E5B?style=for-the-badge&logo=ko-fi&logoColor=white" alt="Support on Ko-fi">
</a>

---

<p align="center">
  Made with care for your security
</p>
