import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { ElectrobunConfig } from '../config';

/**
 * MSIX パッケージを生成します。
 * makeappx.exe がパスに通っている必要があります。
 */
export async function packMsix(config: ElectrobunConfig, buildDir: string, outDir: string): Promise<string> {
    const appName = config.name || 'ElectrobunApp';
    const version = config.version || '1.0.0.0'; // MSIX must be 4 quad version
    const identifier = config.id || `com.example.${appName.toLowerCase()}`;
    const publisher = config.publisher || 'CN=Example';
    
    // Normalize version to quad (e.g. 1.0.0 -> 1.0.0.0)
    const quadVersion = version.split('.').length === 3 ? `${version}.0` : version;

    const manifestTemplatePath = path.join(__dirname, '../../templates/AppxManifest.xml.template');
    let manifest = fs.readFileSync(manifestTemplatePath, 'utf8');

    manifest = manifest
        .replace(/{{APP_NAME}}/g, appName)
        .replace(/{{VERSION}}/g, quadVersion)
        .replace(/{{IDENTIFIER}}/g, identifier)
        .replace(/{{PUBLISHER}}/g, publisher)
        .replace(/{{PUBLISHER_DISPLAY_NAME}}/g, appName)
        .replace(/{{DESCRIPTION}}/g, appName)
        .replace(/{{EXECUTABLE_NAME}}/g, `${appName}.exe`);

    const manifestPath = path.join(buildDir, 'AppxManifest.xml');
    fs.writeFileSync(manifestPath, manifest);

    // TODO: Assets directory and logos must exist for real MSIX
    const assetsDir = path.join(buildDir, 'Assets');
    if (!fs.existsSync(assetsDir)) {
        fs.mkdirSync(assetsDir, { recursive: true });
    }

    const outputMsix = path.join(outDir, `${appName}_${quadVersion}_x64.msix`);
    
    try {
        console.log(`MSIX パッケージを作成中: ${outputMsix}`);
        execSync(`makeappx pack /d "${buildDir}" /p "${outputMsix}" /o`, { stdio: 'inherit' });
        console.log(`MSIX パッケージの作成に成功しました: ${outputMsix}`);
        return outputMsix;
    } catch (error) {
        throw new Error(`MSIX パッケージの作成に失敗しました: ${error instanceof Error ? error.message : String(error)}`);
    }
}
