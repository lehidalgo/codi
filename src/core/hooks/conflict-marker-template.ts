import { PROJECT_NAME_DISPLAY } from "#src/constants.js";

/**
 * Pre-commit hook script that scans staged files for git merge-conflict markers.
 * Mirrors the detection logic in src/core/hooks/conflict-markers.ts but inlined
 * so the runtime hook script has zero Codi runtime dependency.
 */
export const CONFLICT_MARKER_CHECK_TEMPLATE = `#!/usr/bin/env node
// ${PROJECT_NAME_DISPLAY} conflict-marker checker
import fs from 'fs';

const MARKER_RE = /^(<{7}|={7}|>{7}|\\|{7})( |$)/;
const BINARY_EXT = [
  /\\.png$/i, /\\.jpe?g$/i, /\\.gif$/i, /\\.webp$/i, /\\.ico$/i,
  /\\.pdf$/i, /\\.ttf$/i, /\\.woff2?$/i, /\\.eot$/i,
  /\\.zip$/i, /\\.tar(\\.gz)?$/i, /\\.gz$/i, /\\.7z$/i,
  /\\.mp[34]$/i, /\\.mov$/i, /\\.webm$/i,
];

const files = process.argv.slice(2).filter(f => !BINARY_EXT.some(p => p.test(f)));
const findings = [];
for (const file of files) {
  try {
    const content = fs.readFileSync(file, 'utf-8');
    const lines = content.split('\\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? '';
      const stripped = line.endsWith('\\r') ? line.slice(0, -1) : line;
      if (MARKER_RE.test(stripped)) {
        findings.push({ file, line: i + 1, text: stripped.slice(0, 80) });
      }
    }
  } catch { /* unreadable — skip */ }
}
if (findings.length === 0) process.exit(0);

console.error('Git merge-conflict markers detected:');
for (const f of findings) console.error('  ' + f.file + ':' + f.line + '  ' + f.text);
console.error('\\nResolve the conflict, re-stage the file, and commit again. Do not bypass with --no-verify.');
process.exit(1);
`;
