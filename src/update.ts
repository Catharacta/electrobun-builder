/**
 * All comments and messages in this library must be in English.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export interface UpdateMetadata {
    version: string;
    url: string;
    pub_date: string;
    notes?: string;
    signature?: string;
    sha256?: string;
}

/**
 * Calculates the SHA-256 hash value of a file.
 */
export async function calculateSha256(filePath: string): Promise<string> {
    const fileBuffer = fs.readFileSync(filePath);
    const hashSum = crypto.createHash('sha256');
    hashSum.update(fileBuffer);
    return hashSum.digest('hex');
}

/**
 * Generates metadata (latest.json) for automatic updates.
 */
export async function generateUpdateMetadata(
    binaryPath: string,
    version: string,
    baseUrl: string,
    outputDir: string,
    notes?: string
): Promise<void> {
    const fileName = path.basename(binaryPath);
    const downloadUrl = `${baseUrl.replace(/\/$/, '')}/${fileName}`;
    const sha256 = await calculateSha256(binaryPath);
    
    const metadata: UpdateMetadata = {
        version,
        url: downloadUrl,
        pub_date: new Date().toISOString(),
        notes,
        sha256
    };

    const outPath = path.join(outputDir, 'latest.json');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    fs.writeFileSync(outPath, JSON.stringify(metadata, null, 2), 'utf8');
    console.log(`Generated update metadata: ${outPath}`);
}
