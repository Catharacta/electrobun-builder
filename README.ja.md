# electrobun-builder-for-windows (日本語版)

[Electrobun](https://electrobun.sh) アプリケーションを Windows 向けにパッケージ化・署名するためのツールです。NSIS, WiX (MSI), MSIX 形式をサポートしています。

👉 [English README is here](README.md)

## クイックスタート

1.  **インストール**: `npm install -g electrobun-builder-for-windows`
2.  **設定**: プロジェクトのルートに `electrobun.config.ts` を作成します（後述の「設定方法」を参照）。
3.  **ビルド**: `electrobun-builder build --target nsis` を実行します。

## 主な機能

- **NSIS**: カスタムアイコンとプロフェッショナルな MUI2 インターフェースを備えた、単一ファイルの EXE インストーラーを作成します。
- **WiX (MSI)**: UUID を用いた安定したアップグレードコードと、自動コンポーネントスキャン機能を備えた MSI インストーラーを作成します。
- **MSIX**: `sharp` によるロゴの自動リサイズ機能付きで、モダンな Windows アプリパッケージ (Sparse Manifest) を作成します。
- **コード署名**: `signtool` と PFX 証明書を使用して、インストーラーとバイナリにデジタル署名を付与します。
- **自動更新**: Electrobun の `Updater` クラスが必要とするメタデータ `latest.json` (**SHA-256 ハッシュ値含む**) を自動生成します。
- **リソース編集**: `rcedit` を使用して、EXE のアイコン、著作権、会社名などのバージョン情報を自動的に更新します。

## インストール

```bash
npm install -g electrobun-builder-for-windows
```

## OS 依存関係

各ターゲットのビルドには、以下のツールがインストールされ、`PATH` が通っている必要があります。

| ターゲット | 必要ツール | 入手先 |
| --- | --- | --- |
| **NSIS** | NSIS 3.x | [ダウンロード](https://nsis.sourceforge.io/Download) |
| **WiX** | WiX Toolset v3.x | [ダウンロード](https://wixtoolset.org/releases/) |
| **MSIX / 署名** | Windows SDK (SignTool, MakeAppx) | [ダウンロード](https://developer.microsoft.com/en-us/windows/downloads/windows-sdk/) |

## 使い方

### 1. 基本的なビルド
ターゲットを指定してインストーラーを生成します。

```bash
# NSIS (.exe) をビルド
electrobun-builder build --target nsis

# WiX (.msi) をビルド
electrobun-builder build --target wix

# MSIX (.msix) をビルド
electrobun-builder build --target msix
```

### 2. 署名付きビルド
インストーラー本体と、内包されるアプリバイナリにデジタル署名を付与します。このオプションは全ターゲット（**nsis**, **wix**, **msix**）で利用可能です。

```bash
# NSIS (.exe) に署名
electrobun-builder build --target nsis --sign --pfx cert.pfx --password yourpassword

# WiX (.msi) に署名
electrobun-builder build --target wix --sign --pfx cert.pfx --password yourpassword

# MSIX (.msix) に署名
electrobun-builder build --target msix --sign --pfx cert.pfx --password yourpassword
```

### 3. 自動更新用メタデータの生成
Electrobun の `Updater` クラスが必要とする `latest.json` を生成します。これも全ターゲットで利用可能です。

```bash
# NSIS 用のメタデータを生成
electrobun-builder build --target nsis --update --baseUrl https://your-server.com/downloads

# WiX 用のメタデータを生成
electrobun-builder build --target wix --update --baseUrl https://your-server.com/downloads

# MSIX 用のメタデータを生成
electrobun-builder build --target msix --update --baseUrl https://your-server.com/downloads
```

### 4. ブランディング (単独実行)
`build/` フォルダ内にあるビルド済みのバイナリに対して、アイコンやメタデータを直接適用します。インストーラーを再生成せずに、実行ファイルのリソースのみを素早く更新したい場合に便利です。

```bash
electrobun-builder brand
```

## 設定方法

プロジェクトのルートにある `electrobun.config.ts` を読み込みます。

```typescript
import { type ElectrobunConfig } from "electrobun-builder-for-windows";

const config: ElectrobunConfig = {
  name: "MyApp",
  version: "1.0.0",
  author: "Your Company",
  windows: {
    icon: "assets/app.ico", // .ico ファイルへのパス
    productId: "com.example.myapp", // WiX の UpgradeCode やレジストリに使用
    installDir: "MyApp", // Program Files 内のインストールフォルダ名
    languageCode: "1033", // 任意: WiX 用言語コード (デフォルト: 1033 - 英語)
    languageName: "English", // 任意: NSIS 用言語名 (デフォルト: 英語)
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

## ライセンス

MIT - Copyright (c) 2026 Catharacta
