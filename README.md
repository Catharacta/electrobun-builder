# electrobun-builder-for-windows

[![npm version](https://img.shields.io/npm/v/electrobun-builder-for-windows.svg)](https://www.npmjs.com/package/electrobun-builder-for-windows)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Build Status](https://github.com/Catharacta/electrobun-builder/actions/workflows/publish.yml/badge.svg)](https://github.com/Catharacta/electrobun-builder/actions)

Packaging and signing tool for Electrobun applications on Windows. Support for NSIS, WiX, and MSIX formats.

[日本語のドキュメントはこちら](#japanese)

## Features

- **NSIS**: Create a single-file EXE installer with custom icons and professional UI.
- **WiX**: Create professional MSI installers with stable upgrade codes and automatic component scanning.
- **MSIX**: Create modern Windows app packages (Sparse Manifest) with automatic logo resizing.
- **Code Signing**: Digitally sign installers and binaries using PFX certificates.
- **Auto Update**: Generate `latest.json` metadata for Electrobun's auto-updater.
- **Resource Editing**: Automatically update EXE icons and version info using `rcedit`.

## Installation

```bash
npm install -g electrobun-builder-for-windows
```

## Configuration

`electrobun-builder-for-windows` reads `electrobun.config.ts` from your project root.

```typescript
import { type ElectrobunConfig } from "electrobun-builder-for-windows";

const config: ElectrobunConfig = {
  name: "MyApp",
  version: "1.0.0",
  author: "Your Name",
  windows: {
    icon: "assets/app.ico",
    productId: "com.example.myapp",
    installDir: "MyApp",
    languageCode: "1041", // Optional: 1041 for Japanese (default)
    languageName: "Japanese", // Optional: "Japanese" (default)
    msix: {
      publisher: "CN=YourPublisher",
      capabilities: ["internetClient"]
    }
  }
};

export default config;
```

---

<a id="japanese"></a>

## 日本語 (Japanese)

Electrobun アプリケーションを Windows 向けにパッケージ化・署名するためのツールです。NSIS, WiX, MSIX 形式をサポートしています。

### 主な機能

- **NSIS**: カスタムアイコンに対応した単一ファイルの EXE インストーラーを作成します。
- **WiX**: 安定したアップグレードコードを持つプロフェッショナルな MSI インストーラーを作成します。
- **MSIX**: ロゴの自動リサイズ機能付きで、モダンな Windows アプリパッケージを作成します。
- **署名**: PFX 証明書を使用して、インストーラーとバイナリにデジタル署名を付与します。
- **自動更新**: Electrobun のオートアップデーター用メタデータを生成します。
- **リソース編集**: `rcedit` で EXE のアイコンやバージョン情報を自動更新します。

### 設定例

`electrobun.config.ts` にて詳細な設定が可能です。

```typescript
windows: {
  icon: "assets/app.ico",
  languageCode: "1041", // MSI 用の言語コード (デフォルト: 1041)
  languageName: "Japanese", // NSIS 用の言語名 (デフォルト: Japanese)
}
```

## License

MIT
