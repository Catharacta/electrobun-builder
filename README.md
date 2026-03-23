# @catharacta/electrobun-builder

Packaging and signing tool for Electrobun applications on Windows. Support for NSIS, WiX, and MSIX formats.

## Features

- **NSIS**: 単一ファイルの EXE インストーラーを作成します。
- **WiX**: プロフェッショナルな MSI インストーラーを作成します。ビルドディレクトリを自動スキャンしてコンポーネントを生成し、`uuid` による安定したアップグレードコードを付与します。
- **MSIX**: `sharp` によるロゴの自動リサイズ機能付きで、モダンな Windows アプリパッケージ（Sparse Manifest 形式）を作成します。
- **コード署名**: PFX 証明書を使用して、インストーラーとアプリバイナリにデジタル署名を付与します。
- **自動更新**: Electrobun のオートアップデーター用 `latest.json` メタデータを生成します。
- **リソース編集**: `rcedit` を使用して、EXE のアイコンやバージョン情報をプロジェクト設定から自動的に更新します。

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
