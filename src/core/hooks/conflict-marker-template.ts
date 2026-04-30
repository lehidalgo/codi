import { PROJECT_NAME_DISPLAY } from "#src/constants.js";

/**
 * Pre-commit hook script that scans staged files for git merge-conflict markers.
 *
 * Mirrors the detection logic in src/core/hooks/conflict-markers.ts and the
 * literal-block scanner in src/core/scanner/literal-blocks.ts, inlined so the
 * runtime hook script has zero Codi runtime dependency. The scanner ignores
 * markers inside fenced code blocks (``` or ~~~) and inside <example> tag
 * regions so legitimate documentation that demonstrates merge markers does
 * not trigger false positives.
 *
 * The two implementations are pinned by a parity test in tests/integration:
 * any drift between this template and the in-process scanner makes it fail.
 */
export const CONFLICT_MARKER_CHECK_TEMPLATE = `#!/usr/bin/env node
// ${PROJECT_NAME_DISPLAY} conflict-marker checker
import fs from 'fs';

const MARKER_RE = /^(<{7}|={7}|>{7}|\\|{7})( |$)/;
const FENCE_RE = /^[ \\t]{0,3}(\\\`{3,}|~{3,})/;
const EXAMPLE_OPEN_RE = /<\\s*example\\s*>/i;
const EXAMPLE_CLOSE_RE = /<\\s*\\/\\s*example\\s*>/i;
const BINARY_EXT = [
  /\\.png$/i, /\\.jpe?g$/i, /\\.gif$/i, /\\.webp$/i, /\\.ico$/i,
  /\\.pdf$/i, /\\.ttf$/i, /\\.woff2?$/i, /\\.eot$/i,
  /\\.zip$/i, /\\.tar(\\.gz)?$/i, /\\.gz$/i, /\\.7z$/i,
  /\\.mp[34]$/i, /\\.mov$/i, /\\.webm$/i,
];

function scanForMarkers(content) {
  const lines = content.split('\\n');
  const findings = [];
  let inFence = false;
  let inExample = false;
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i] ?? '';
    const line = raw.endsWith('\\r') ? raw.slice(0, -1) : raw;
    if (inFence) {
      if (FENCE_RE.test(line)) inFence = false;
      continue;
    }
    if (inExample) {
      if (EXAMPLE_CLOSE_RE.test(line)) inExample = false;
      continue;
    }
    if (FENCE_RE.test(line)) { inFence = true; continue; }
    const open = EXAMPLE_OPEN_RE.exec(line);
    if (open) {
      const tail = line.slice(open.index + open[0].length);
      if (!EXAMPLE_CLOSE_RE.test(tail)) inExample = true;
      continue;
    }
    if (MARKER_RE.test(line)) {
      findings.push({ line: i + 1, text: line.slice(0, 80) });
    }
  }
  return findings;
}

const files = process.argv.slice(2).filter(f => !BINARY_EXT.some(p => p.test(f)));
const allFindings = [];
for (const file of files) {
  try {
    const content = fs.readFileSync(file, 'utf-8');
    for (const hit of scanForMarkers(content)) {
      allFindings.push({ file, line: hit.line, text: hit.text });
    }
  } catch { /* unreadable — skip */ }
}
if (allFindings.length === 0) process.exit(0);

console.error('Git merge-conflict markers detected:');
for (const f of allFindings) console.error('  ' + f.file + ':' + f.line + '  ' + f.text);
console.error('\\nResolve the conflict, re-stage the file, and commit again. Do not bypass with --no-verify.');
process.exit(1);
`;
