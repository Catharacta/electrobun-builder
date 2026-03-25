import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import sharp from 'sharp';
import { ElectrobunConfig } from '../config';

/**
 * MSIX パッケージを生成します。
 */
export async function packMsix(config: ElectrobunConfig, buildDir: string, outDir: string): Promise<string> {
    const appName = config.name || 'ElectrobunApp';
    const version = config.version || '1.0.0';
    const identifier = config.id || `com.example.${appName.toLowerCase()}`;
    const msixConfig = config.windows?.msix;
    
    // MSIX must be 4 quad version (e.g. 1.0.0.0)
    const quadVersion = version.split('.').length === 3 ? `${version}.0` : version;

    // 1. Assets の準備
    await ensureAssets(config, buildDir);
    
    // 1.5. アプリケーションファイルのコピー
    copyAppFiles(config, buildDir, path.join(path.dirname(buildDir), '..'));

    // 2. マニフェストの生成
    const manifest = generateManifest(config, identifier, quadVersion);
    const manifestPath = path.join(buildDir, 'AppxManifest.xml');
    fs.writeFileSync(manifestPath, manifest);

    // 3. パッケージング
    const outputFilename = `${appName}_${quadVersion}_x64.msix`;
    const outputMsix = path.join(outDir, outputFilename);
    
    try {
        console.log(`Creating MSIX package: ${outputMsix}`);
        // makeappx が PATH に通っていることは deps.ts で確認済み
        execSync(`makeappx pack /d "${buildDir}" /p "${outputMsix}" /o`, { stdio: 'inherit' });
        console.log(`Successfully created MSIX package: ${outputMsix}`);
        return outputMsix;
    } catch (error) {
        throw new Error(`Failed to create MSIX package: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/**
 * AppxManifest.xml を動的に生成します。
 */
function generateManifest(config: ElectrobunConfig, identifier: string, version: string): string {
    const appName = config.name || 'ElectrobunApp';
    const msixConfig = config.windows?.msix;
    const publisher = msixConfig?.publisher || 'CN=Electrobun';
    const publisherDisplayName = msixConfig?.publisherDisplayName || config.author || 'Electrobun Developer';
    const description = appName;
    const executableName = `${appName}.exe`;

    const manifestTemplatePath = path.join(__dirname, '../../templates/AppxManifest.xml.template');
    if (!fs.existsSync(manifestTemplatePath)) {
        throw new Error(`Manifest template not found: ${manifestTemplatePath}`);
    }

    let manifest = fs.readFileSync(manifestTemplatePath, 'utf8');

    // 基本項目の置換
    manifest = manifest
        .replace(/{{IDENTIFIER}}/g, identifier)
        .replace(/{{PUBLISHER}}/g, publisher)
        .replace(/{{VERSION}}/g, version)
        .replace(/{{APP_NAME}}/g, appName)
        .replace(/{{PUBLISHER_DISPLAY_NAME}}/g, publisherDisplayName)
        .replace(/{{DESCRIPTION}}/g, description)
        .replace(/{{EXECUTABLE_NAME}}/g, executableName);

    // 言語タグの置換
    const languageCode = config.windows?.languageCode || "1041";
    const languageTag = languageCode === "1041" ? "ja-JP" : "en-US";
    manifest = manifest.replace(/{{LANGUAGE_TAG}}/g, languageTag);

    // Extensions の生成
    const extensions = generateExtensionsXml(msixConfig?.extensions);
    manifest = manifest.replace(/{{EXTENSIONS}}/g, extensions);

    // Capabilities の追加生成
    const capabilities = generateCapabilitiesXml(msixConfig?.capabilities);
    manifest = manifest.replace(/{{CAPABILITIES}}/g, capabilities);

    return manifest;
}

/**
 * 拡張機能の XML を生成します。
 */
function generateExtensionsXml(extensionsConfig: any): string {
    if (!extensionsConfig) return '';
    
    let xml = '      <Extensions>\n';
    
    // File Associations
    if (extensionsConfig.fileAssociations) {
        for (const assoc of extensionsConfig.fileAssociations) {
            xml += `        <uap:Extension Category="windows.fileTypeAssociation">\n`;
            xml += `          <uap:FileTypeAssociation Name="${assoc.name}">\n`;
            for (const ext of assoc.extensions) {
                xml += `            <uap:FileType>${ext}</uap:FileType>\n`;
            }
            xml += `          </uap:FileTypeAssociation>\n`;
            xml += `        </uap:Extension>\n`;
        }
    }

    // Protocols
    if (extensionsConfig.protocols) {
        for (const proto of extensionsConfig.protocols) {
            xml += `        <uap:Extension Category="windows.protocol">\n`;
            xml += `          <uap:Protocol Name="${proto.name}">\n`;
            xml += `            <uap:DisplayName>${proto.name} Protocol</uap:DisplayName>\n`;
            xml += `          </uap:Protocol>\n`;
            xml += `        </uap:Extension>\n`;
        }
    }

    xml += '      </Extensions>';
    return xml;
}

/**
 * 権限の XML を生成します。
 */
function generateCapabilitiesXml(capabilities?: string[]): string {
    if (!capabilities) return '';
    return capabilities.map(cap => `    <Capability Name="${cap}" />`).join('\n');
}

/**
 * MSIX に必要なアセット類（ロゴ等）を準備します。
 * config.windows.icon から各サイズを自動生成します。
 */
async function ensureAssets(config: ElectrobunConfig, buildDir: string): Promise<void> {
    const assetsDir = path.join(buildDir, 'Assets');
    if (!fs.existsSync(assetsDir)) {
        fs.mkdirSync(assetsDir, { recursive: true });
    }

    const iconPath = config.windows?.icon ? path.resolve(process.cwd(), config.windows.icon) : null;
    
    const assetsToGenerate = [
        { name: 'StoreLogo.png', size: 50 },
        { name: 'Square150x150Logo.png', size: 150 },
        { name: 'Square44x44Logo.png', size: 44 },
        { name: 'Wide310x150Logo.png', size: [310, 150] },
        { name: 'SplashScreen.png', size: [620, 300] }
    ];

    for (const asset of assetsToGenerate) {
        const assetPath = path.join(assetsDir, asset.name);
        
        if (iconPath && fs.existsSync(iconPath)) {
            try {
                const s = sharp(iconPath);
                if (Array.isArray(asset.size)) {
                    await s.resize(asset.size[0], asset.size[1], { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).toFile(assetPath);
                } else {
                    await s.resize(asset.size, asset.size).toFile(assetPath);
                }
                continue;
            } catch (err) {
                console.warn(`Warning: Failed to resize ${asset.name} from ${iconPath}: ${err}. Using placeholder.`);
            }
        }

        // プレースホルダー（フォールバック）
        const transparentPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==', 'base64');
        fs.writeFileSync(assetPath, transparentPng);
    }
}

/**
 * アプリケーションファイルを MSIX 用のディレクトリにコピーします
 */
function copyAppFiles(config: ElectrobunConfig, buildDir: string, projectRoot: string): void {
    const appFolderName = config.windows?.installDir || config.name;
    const sourceDirCandidate = path.join(projectRoot, "build", "stable-win-x64", appFolderName);
    const sourceDir = fs.existsSync(sourceDirCandidate) ? sourceDirCandidate : path.join(projectRoot, "build", "stable-win-x64");

    console.log(`Copying app files from ${sourceDir} to ${buildDir}`);
    
    // シンプルな再帰コピー
    function copyRecursive(src: string, dest: string) {
        if (!fs.existsSync(src)) return;
        const stat = fs.statSync(src);
        if (stat.isDirectory()) {
            if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
            fs.readdirSync(src).forEach(child => {
                copyRecursive(path.join(src, child), path.join(dest, child));
            });
        } else {
            // Assets フォルダやマニフェストは既に生成されている可能性があるので上書き注意
            // (通常はサブフォルダに分かれているので問題ないはず)
            if (path.basename(dest) === 'AppxManifest.xml' || dest.includes(`${path.sep}Assets${path.sep}`)) {
                return;
            }
            fs.copyFileSync(src, dest);
        }
    }

    copyRecursive(sourceDir, buildDir);
}
