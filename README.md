# electrobun-builder-for-windows

[![npm version](https://img.shields.io/npm/v/electrobun-builder-for-windows.svg)](https://www.npmjs.com/package/electrobun-builder-for-windows)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Build Status](https://github.com/Catharacta/electrobun-builder/actions/workflows/publish.yml/badge.svg)](https://github.com/Catharacta/electrobun-builder/actions)

Packaging and signing tool for [Electrobun](https://electrobun.sh) applications on Windows. Support for NSIS, WiX (MSI), and MSIX formats.

👉 [日本語のドキュメントはこちら (Japanese README)](README.ja.md)

## Quick Start

1.  **Install**: `npm install -g electrobun-builder-for-windows`
2.  **Configure**: Create `electrobun.config.ts` in your project root.
3.  **Build**: Run `electrobun-builder build --target nsis`

## Features

- **NSIS**: Create a single-file EXE installer with custom icons and professional MUI2 interface.
- **WiX (MSI)**: Create professional MSI installers with stable upgrade codes using UUIDs and automatic component scanning.
- **MSIX**: Create modern Windows app packages (Sparse Manifest) with automatic logo resizing via `sharp`.
- **Code Signing**: Digitally sign installers and binaries using PFX certificates via `signtool`.
- **Auto Update**: Generate `latest.json` metadata (including **SHA-256 hash**) for Electrobun's `Updater` class.
- **Resource Editing**: Automatically update EXE icons and version info (Copyright, Company, etc.) using `rcedit`.

## Installation

```bash
npm install -g electrobun-builder-for-windows
```

## OS Dependencies

This tool requires several Windows SDK and packaging tools. Ensure these are installed and available in your `PATH`:

| Target | Required Tool | Link |
| --- | --- | --- |
| **NSIS** | NSIS 3.x | [Download](https://nsis.sourceforge.io/Download) |
| **WiX** | WiX Toolset v3.x | [Download](https://wixtoolset.org/releases/) |
| **MSIX / Sign** | Windows SDK (SignTool, MakeAppx) | [Download](https://developer.microsoft.com/en-us/windows/downloads/windows-sdk/) |

## Usage

### 1. Basic Build
Build an installer for a specific target.

```bash
# Build NSIS (.exe)
electrobun-builder build --target nsis

# Build WiX (.msi)
electrobun-builder build --target wix

# Build MSIX (.msix)
electrobun-builder build --target msix
```

### 2. Build and Sign
Apply a digital signature to the installer and the internal application binary. This works for all targets (**nsis**, **wix**, **msix**).

```bash
# Sign NSIS (.exe)
electrobun-builder build --target nsis --sign --pfx cert.pfx --password yourpassword

# Sign WiX (.msi)
electrobun-builder build --target wix --sign --pfx cert.pfx --password yourpassword

# Sign MSIX (.msix)
electrobun-builder build --target msix --sign --pfx cert.pfx --password yourpassword
```

### 3. Auto-Update Metadata
Generate `latest.json` required for Electrobun's `Updater`. This is also available for all targets.

```bash
# Generate for NSIS
electrobun-builder build --target nsis --update --baseUrl https://your-server.com/downloads

# Generate for WiX
electrobun-builder build --target wix --update --baseUrl https://your-server.com/downloads

# Generate for MSIX
electrobun-builder build --target msix --update --baseUrl https://your-server.com/downloads
```

### 4. Branding (Standalone)
Apply branding (icons and metadata) to already built binaries in the `build/` folder without recreating the full installer. This is useful for adjusting executable resources quickly.

```bash
electrobun-builder brand
```

## Configuration

The builder reads `electrobun.config.ts` from your project root.

```typescript
import { type ElectrobunConfig } from "electrobun-builder-for-windows";

const config: ElectrobunConfig = {
  name: "MyApp",
  version: "1.0.0",
  author: "Your Company",
  windows: {
    icon: "assets/app.ico", // Path to your .ico file
    productId: "com.example.myapp", // Used for WiX UpgradeCode and Registry
    installDir: "MyApp", // Folder name in Program Files
    languageCode: "1033", // Optional: WiX LCID (Default: 1033 - English)
    languageName: "English", // Optional: NSIS Language (Default: English)
    msix: {
      publisher: "CN=YourPublisher",
      publisherDisplayName: "Your Name",
      identityName: "com.example.myapp",
      capabilities: ["internetClient"]
    }
  }
};

export default config;
```

## License

MIT - Copyright (c) 2026 Catharacta
