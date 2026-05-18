/**
 * secret-scan — pre-commit check. Scans staged files for API keys,
 * tokens, private keys, and other credentials. ADR-013 Paso 9.
 *
 * Replaces SECRET_SCAN_TEMPLATE in src/core/hooks/hook-templates.ts.
 * Same pattern set, same false-positive filters, same Shannon-entropy
 * gate, ported from the legacy Node template to a TypeScript module
 * invoked by the codi hook git-pre-commit dispatcher.
 */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import type { GitHookContext, GitHookVerdict } from "./types.js";
import { failOpen } from "./types.js";

const PATTERNS: readonly RegExp[] = [
  /(?:api[_-]?key|apikey)\s*[:=]\s*['"][^'"]{8,}/i,
  /(?:secret|password|passwd|pwd)\s*[:=]\s*['"][^'"]{8,}/i,
  /(?:token|bearer)\s*[:=]\s*['"][^'"]{8,}/i,
  /-----BEGIN (?:RSA |EC |DSA )?PRIVATE KEY-----/,
  /ghp_[a-zA-Z0-9]{36}/,
  /gho_[a-zA-Z0-9]{36}/,
  /github_pat_[a-zA-Z0-9]{22}_[a-zA-Z0-9]{59}/,
  /sk-[a-zA-Z0-9]{32,}/,
  /xox[bpors]-[a-zA-Z0-9-]{10,}/,
  /AKIA[0-9A-Z]{16}/,
];

// Lines matching any of these are safe (env var refs, placeholders, examples).
const FALSE_POS: readonly RegExp[] = [
  /['"](?:your-|example-|test-|dummy-|fake-|placeholder)/i,
  /\$\{/,
  /process\.env/,
  /os\.environ/,
  /import\.meta\.env/,
  /\bgetenv\b/,
  /['"](?:changeme|replace.?me|xxx+|\*{3,}|TODO|FIXME)/i,
  /sk-[a-z]{3,6}\d{2,4}(?:\.\.\.|\*)/,
];

const EXCLUDED: readonly RegExp[] = [
  /tests?\//,
  /\.test\.[jt]sx?$/,
  /\.spec\.[jt]sx?$/,
  /__tests__\//,
  /\/references\//,
  /\/templates\//,
  /docs\//,
  /\.md$/,
];

/**
 * Shannon entropy: real secrets have high entropy (>3.5), env var names
 * and placeholders have low entropy. Used to filter regex matches.
 */
function entropy(s: string): number {
  if (s.length === 0) return 0;
  const freq: Record<string, number> = {};
  for (const c of s) freq[c] = (freq[c] ?? 0) + 1;
  let e = 0;
  for (const k of Object.keys(freq)) {
    const p = (freq[k] ?? 0) / s.length;
    e -= p * Math.log2(p);
  }
  return e;
}

function stagedFiles(cwd: string): string[] {
  try {
    const out = execFileSync(
      "git",
      ["diff", "--cached", "--name-only", "--diff-filter=ACMR"],
      { cwd, encoding: "utf8" },
    );
    return out.split("\n").filter((line) => line.length > 0);
  } catch {
    return [];
  }
}

export function checkSecretScan(ctx: GitHookContext): GitHookVerdict {
  try {
    const files = stagedFiles(ctx.cwd).filter((f) => !EXCLUDED.some((re) => re.test(f)));
    const offenders: string[] = [];
    for (const rel of files) {
      const abs = join(ctx.cwd, rel);
      if (!existsSync(abs)) continue;
      let stat;
      try {
        stat = statSync(abs);
      } catch {
        continue;
      }
      if (!stat.isFile()) continue;
      let content: string;
      try {
        content = readFileSync(abs, "utf8");
      } catch {
        continue;
      }
      const lines = content.split("\n");
      for (const line of lines) {
        if (FALSE_POS.some((re) => re.test(line))) continue;
        for (const re of PATTERNS) {
          const m = re.exec(line);
          if (!m) continue;
          // High-entropy gate: filters env var names accidentally matching the regex.
          if (entropy(m[0]) < 3.5) continue;
          offenders.push(`${rel}: line matches ${re.source.slice(0, 60)}`);
          break;
        }
      }
    }
    if (offenders.length === 0) return { severity: "pass", check: "secret-scan", messages: [] };
    return {
      severity: "block",
      check: "secret-scan",
      messages: [
        "Potential secrets detected in staged files:",
        ...offenders.slice(0, 10).map((s) => "  " + s),
        offenders.length > 10 ? `  ...and ${offenders.length - 10} more` : "",
        "Unstage the file, remove the secret, and re-stage. Use env vars or a secrets manager.",
      ].filter((s) => s.length > 0),
    };
  } catch (err) {
    return failOpen("secret-scan", err);
  }
}
