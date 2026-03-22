import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

export interface SignOptions {
    pfxPath: string;
    password?: string;
    timestampUrl?: string;
    digestAlgorithm?: 'SHA256' | 'SHA1';
}

/**
 * Windows SDK の signtool.exe を使用してファイルを署名します。
 * 環境パスに signtool.exe が含まれている必要があります。
 */
export async function signFile(filePath: string, options: SignOptions): Promise<void> {
    if (!fs.existsSync(filePath)) {
        throw new Error(`署名対象のファイルが見つかりません: ${filePath}`);
    }

    if (!fs.existsSync(options.pfxPath)) {
        throw new Error(`PFX証明書が見つかりません: ${options.pfxPath}`);
    }

    const digest = options.digestAlgorithm || 'SHA256';
    const timestamp = options.timestampUrl || 'http://timestamp.digicert.com';

    let command = `signtool sign /f "${options.pfxPath}"`;
    
    if (options.password) {
        command += ` /p "${options.password}"`;
    }

    command += ` /fd ${digest} /tr "${timestamp}" /td ${digest} "${filePath}"`;

    try {
        console.log(`署名を実行中: ${filePath}`);
        execSync(command, { stdio: 'inherit' });
        console.log(`署名に成功しました: ${filePath}`);
    } catch (error) {
        throw new Error(`署名に失敗しました: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/**
 * 署名の検証を行います。
 */
export function verifySignature(filePath: string): boolean {
    try {
        execSync(`signtool verify /pa /v "${filePath}"`, { stdio: 'ignore' });
        return true;
    } catch {
        return false;
    }
}
