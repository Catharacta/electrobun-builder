import { execSync } from 'child_process';
import fs from 'node:fs';

export interface SignOptions {
    pfxPath: string;
    password?: string;
    timestampUrl?: string;
    digestAlgorithm?: 'SHA256' | 'SHA1';
}

/**
 * Signs the file using signtool.exe from the Windows SDK.
 */
export async function signFile(filePath: string, options: SignOptions): Promise<void> {
    if (!fs.existsSync(filePath)) {
        throw new Error(`File to sign not found: ${filePath}`);
    }

    if (!fs.existsSync(options.pfxPath)) {
        throw new Error(`PFX certificate not found: ${options.pfxPath}`);
    }

    const digest = options.digestAlgorithm || 'SHA256';
    const timestamp = options.timestampUrl || 'http://timestamp.digicert.com';

    const { isBinaryInPath } = await import("./utils/deps.js");
    const signtoolPath = isBinaryInPath("signtool") || "signtool";

    let command = `"${signtoolPath}" sign /f "${options.pfxPath}"`;
    
    if (options.password) {
        command += ` /p "${options.password}"`;
    }

    command += ` /fd ${digest} /tr "${timestamp}" /td ${digest} "${filePath}"`;

    try {
        console.log(`Executing signature: ${filePath}`);
        execSync(command, { stdio: 'inherit' });
        console.log(`Successfully signed: ${filePath}`);
    } catch (error) {
        throw new Error(`Signature failed: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/**
 * Verifies the digital signature.
 */
export async function verifySignature(filePath: string): Promise<boolean> {
    try {
        const { isBinaryInPath } = await import("./utils/deps.js");
        const signtoolPath = isBinaryInPath("signtool") || "signtool";
        execSync(`"${signtoolPath}" verify /pa /v "${filePath}"`, { stdio: 'ignore' });
        return true;
    } catch {
        return false;
    }
}
