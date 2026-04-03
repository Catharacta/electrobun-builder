# Requirements (REQUIREMENTS.md)

`electrobun-builder` is a tool for packaging [Electrobun](https://electrobun.sh) applications for Windows and converting them into distributable formats such as installers.

## 1. Core Features
- **Packaging**: Integration with the `electrobun build --os win` command or providing an independent build flow.
- **Installer Generation**:
    - **EXE (NSIS)**: Generation of a standard setup format.
    - **MSI (WiX Toolset)**: Professional installer generation for enterprise deployment.
- **MSIX Packaging**: Modern Windows app package support with sparse manifest and automatic asset generation.
- **Binary Resource Editing**:
    - Updating executable icons (.ico).
    - Embedding version info, company name, and legal copyright using `rcedit`.

## 2. Configuration
- Loading from `electrobun.config.ts`.
- Support for Windows-specific settings (Product ID, installation path, shortcut creation, language codes, etc.).

## 3. CLI Interface
- Specification of build targets (`--target nsis`, `--target wix`, `--target msix`).
- Support for code signing (`--sign`) and update metadata generation (`--update`).
- Dry-run mode for validation and debugging.

## 4. Dependencies
- Bun runtime.
- External tools: `makensis` (NSIS), `candle.exe`/`light.exe` (WiX v3), and Windows SDK (`signtool`, `makeappx`).

## 5. Technical Implementation Details
- **Configuration Parsing**: Utilizing the native TypeScript import capability of Bun via `jiti`.
- **Binary Patching**: Modifying Windows resources through the `rcedit` package.
- **Robust Execution**: Using `spawn` with `shell: false` for stable cross-platform argument passing.
- **Encoding Management**: Enforcing UTF-8 with BOM for all installer templates to ensure reliability in international environments.
