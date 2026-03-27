import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * Maps project indicator files to programming language keys
 * that match the hook-registry language entries.
 */
const STACK_INDICATORS: Record<string, string[]> = {
  'tsconfig.json':    ['typescript'],
  'package.json':     ['javascript'],
  'pyproject.toml':   ['python'],
  'requirements.txt': ['python'],
  'go.mod':           ['go'],
  'Cargo.toml':       ['rust'],
  'pom.xml':          ['java'],
  'build.gradle':     ['kotlin'],
  'build.gradle.kts': ['kotlin'],
  'Package.swift':    ['swift'],
};

export async function detectStack(projectRoot: string): Promise<string[]> {
  const detected = new Set<string>();
  for (const [file, languages] of Object.entries(STACK_INDICATORS)) {
    try {
      await fs.access(path.join(projectRoot, file));
      for (const lang of languages) detected.add(lang);
    } catch {
      // File not found, skip
    }
  }
  return [...detected];
}
