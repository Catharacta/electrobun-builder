import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';

/**
 * Checks if the binary specified in PATH exists, or checks standard installation paths.
 */
export function isBinaryInPath(binaryName: string): string | null {
    try {
        // 1. Search in the normal PATH first
        const whereOutput = execSync(`where ${binaryName}`, { stdio: 'pipe' }).toString().trim();
        if (whereOutput) {
            // Select the first line as multiple lines may be returned
            return whereOutput.split('\n')[0].trim();
        }
    } catch {
        // ignore error and try standard paths
    }

    // 2. Search standard installation paths (Windows)
    const standardPaths: Record<string, string[]> = {
        makensis: [
            "C:\\Program Files (x86)\\NSIS\\makensis.exe",
            "C:\\Program Files\\NSIS\\makensis.exe"
        ],
        candle: [
            "C:\\Program Files (x86)\\WiX Toolset v3.14\\bin\\candle.exe",
            "C:\\Program Files (x86)\\WiX Toolset v3.11\\bin\\candle.exe",
            "C:\\Program Files (x86)\\WiX Toolset v3.10\\bin\\candle.exe"
        ],
        light: [
            "C:\\Program Files (x86)\\WiX Toolset v3.14\\bin\\light.exe",
            "C:\\Program Files (x86)\\WiX Toolset v3.11\\bin\\light.exe",
            "C:\\Program Files (x86)\\WiX Toolset v3.10\\bin\\light.exe"
        ],
        signtool: [
            "C:\\Program Files (x86)\\Windows Kits\\10\\bin\\x64\\signtool.exe",
            "C:\\Program Files (x86)\\Windows Kits\\10\\bin\\10.0.19041.0\\x64\\signtool.exe"
        ]
    };

    const paths = standardPaths[binaryName];
    if (paths) {
        for (const p of paths) {
            if (existsSync(p)) {
                return p;
            }
        }
    }

    return null;
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
 * Checks for necessary dependencies based on the target and options.
 */
export async function checkDependencies(target: string, sign: boolean): Promise<void> {
    const required: string[] = [];
    const missing: DependencyInfo[] = [];

    if (target === 'nsis') required.push('makensis');
    if (target === 'wix') {
        if (!isBinaryInPath('wix') && (!isBinaryInPath('candle') || !isBinaryInPath('light'))) {
            missing.push(DEPS['wix']);
        }
    }
    if (target === 'msix') required.push('makeappx');
    if (sign) required.push('signtool');

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
