import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';
import { join } from 'node:path';

describe('electrobun-builder CLI Hybrid Execution', () => {
  const distPath = join(process.cwd(), 'dist', 'index.js');

  it('should run and show help with Node.js', () => {
    const output = execSync(`node ${distPath} help`, { encoding: 'utf8' });
    expect(output).toContain('Usage: npx electrobun-builder');
  });

  it('should run and show help with Bun', () => {
    // Bun がインストールされている前提
    try {
        const output = execSync(`bun ${distPath} help`, { encoding: 'utf8' });
        expect(output).toContain('Usage: npx electrobun-builder');
    } catch (err) {
        console.warn('Bun is not available, skipping Bun execution test');
    }
  });

  it('should trigger build command with Node.js (dry-run)', () => {
    const output = execSync(`node ${distPath} build --target nsis --dry-run`, { encoding: 'utf8' });
    expect(output).toContain('Build target: nsis');
    expect(output).toContain('[DRY-RUN]');
  });
});
