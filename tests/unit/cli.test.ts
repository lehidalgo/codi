import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

const CLI_PATH = resolve(import.meta.dirname, '../../dist/cli.js');

describe('CLI', () => {
  it('prints version with --version', () => {
    const output = execFileSync('node', [CLI_PATH, '--version'], {
      encoding: 'utf-8',
    }).trim();
    expect(output).toBe('0.2.0');
  });

  it('prints help with --help', () => {
    const output = execFileSync('node', [CLI_PATH, '--help'], {
      encoding: 'utf-8',
    });
    expect(output).toContain('codi');
    expect(output).toContain('Unified configuration platform');
  });
});
