# Roadmap (ROADMAP.md)

## Phase 1: Core Foundation (Completed)
- [x] Initializing Git repository and structure definition
- [x] Configuration parsing (`electrobun.config.ts`)
- [x] Basic CLI command implementation

## Phase 2: Windows Resource Processing (Completed)
- [x] Editing binary metadata using `rcedit`
- [x] Embedding icon (.ico) support

## Phase 3: Installer Automation (Completed)
- [x] NSIS (EXE) template and build logic implementation
- [x] WiX (MSI) template and build logic implementation (v0.1.x)

## Phase 4: Advanced Features (Completed - v0.3.7)
- [x] **Code Signing**: Integration of `signtool` across all targets
- [x] **Auto Update**: Generation of `latest.json` for Electrobun's `Updater`
- [x] **MSIX Packaging**: Support for AppxManifest and Sparse Manifests
- [x] **Internationalization**: Full English codebase and English messaging policy

## Phase 5: Stabilization (Ongoing/Completed)
- [x] **Encoding Fix (v0.3.7)**: Resolving WiX `LGHT0311` via UTF-8 BOM and XML header logic
- [x] **Spawn Fix (v0.3.6)**: Enforcing `shell: false` for stable argument passing on Windows
- [ ] Extensive tests with various Electrobun apps (Ongoing)
- [x] CI/CD pipeline via GitHub Actions
- [x] Documentation Refactoring (README.md, README.ja.md)

## Phase 6: Future Enhancement
- [ ] macOS (DMG/PKG) support (Exploratory)
- [ ] Linux (AppImage/Deb) support (Exploratory)
- [ ] Integration with Electrobun CLI as an official plugin
