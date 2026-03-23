# @catharacta/electrobun-builder

Packaging and signing tool for Electrobun applications on Windows. Support for NSIS, WiX, and MSIX formats.

## Features

- **NSIS**: Create single-file EXE installers.
- **WiX**: Create professional MSI installers.
- **MSIX**: Create modern Windows App packages with sparse manifests.
- **Code Signing**: Sign your installers and app binaries with PFX certificates.
- **Auto-Update**: Generate `latest.json` metadata for Electrobun auto-updater.
- **Resource Editing**: Automatically update EXE icons and version information using `rcedit`.

## Installation

```bash
npm install -g @catharacta/electrobun-builder
# or
bun install -g @catharacta/electrobun-builder
```

## OS Dependencies

This tool requires several Windows SDK and packaging tools to be installed and available in your `PATH`:

- **NSIS**: Required for `--target nsis`. [Download NSIS](https://nsis.sourceforge.io/Download)
- **WiX Toolset v3**: Required for `--target wix`. [Download WiX](https://wixtoolset.org/releases/)
- **Windows SDK**: Required for `--target msix` (`makeappx.exe`) and `--sign` (`signtool.exe`). [Download Windows SDK](https://developer.microsoft.com/en-us/windows/downloads/windows-sdk/)

## Usage

### Build an installer

```bash
electrobun-builder build --target nsis
```

### Build and Sign

```bash
electrobun-builder build --target nsis --sign --pfx cert.pfx --password yourpassword
```

### Generate Update Metadata

```bash
electrobun-builder build --target msix --update --baseUrl https://example.com/downloads
```

## Configuration

`@catharacta/electrobun-builder` reads `electrobun.config.ts` from your project root.

```typescript
import { type ElectrobunConfig } from "@catharacta/electrobun-builder";

const config: ElectrobunConfig = {
  name: "MyApp",
  version: "1.0.0",
  author: "Your Name",
  windows: {
    icon: "assets/app.ico",
    productId: "com.example.myapp",
    installDir: "MyApp",
    msix: {
      publisher: "CN=YourPublisher",
      capabilities: ["internetClient"],
      extensions: {
        fileAssociations: [
          { name: "MyAppDoc", extensions: [".myapp"] }
        ]
      }
    }
  },
  views: {
    main: { url: "views://mainview/index.html" }
  }
};

export default config;
```

## License

MIT
