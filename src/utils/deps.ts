import { execSync } from 'child_process';

/**
 * PATH に指定されたバイナリが存在するか確認します。
 */
export function isBinaryInPath(binaryName: string): boolean {
    try {
        // Windows では 'where' コマンドを使用
        execSync(`where ${binaryName}`, { stdio: 'ignore' });
        return true;
    } catch {
        return false;
    }
}

export interface DependencyInfo {
    name: string;
    description: string;
    url: string;
}

const DEPS: Record<string, DependencyInfo> = {
    makensis: {
        name: 'NSIS (makensis)',
        description: 'Required for building EXE installers.',
        url: 'https://nsis.sourceforge.io/Download'
    },
    wix: {
        name: 'WiX Toolset',
        description: 'Required for building MSI installers.',
        url: 'https://wixtoolset.org/releases/'
    },
    signtool: {
        name: 'Windows SDK (signtool)',
        description: 'Required for code signing.',
        url: 'https://developer.microsoft.com/en-us/windows/downloads/windows-sdk/'
    },
    makeappx: {
        name: 'Windows SDK (makeappx)',
        description: 'Required for building MSIX packages.',
        url: 'https://developer.microsoft.com/en-us/windows/downloads/windows-sdk/'
    }
};

/**
 * ターゲットやオプションに応じて必要な依存関係をチェックします。
 */
export async function checkDependencies(target: string, sign: boolean): Promise<void> {
    const required: string[] = [];

    if (target === 'nsis') required.push('makensis');
    if (target === 'wix') required.push('wix'); // WiX v4+ assumed, or custom check for candle/light
    if (target === 'msix') required.push('makeappx');
    if (sign) required.push('signtool');

    const missing: DependencyInfo[] = [];

    for (const bin of required) {
        if (!isBinaryInPath(bin)) {
            missing.push(DEPS[bin] || { name: bin, description: 'Required tool.', url: '' });
        }
    }

    if (missing.length > 0) {
        let errorMsg = '\n[ERROR] Missing dependencies required for this build target:\n\n';
        
        for (const dep of missing) {
            errorMsg += `- ${dep.name}: ${dep.description}\n`;
            if (dep.url) {
                errorMsg += `  Download from: ${dep.url}\n`;
            }
        }
        
        errorMsg += '\nPlease install the missing tools and ensure they are added to your PATH.\n';
        throw new Error(errorMsg);
    }
}
