#!/usr/bin/env node
/**
 * Writes Codi-managed husky hook scripts after `husky` itself sets up
 * `.husky/_/`. Idempotent — overwrites the pre-push hook every install so
 * the gate stays in sync with the source-of-truth content below. Other hook
 * files (e.g. `.husky/pre-commit`) are left alone because they are generated
 * separately by `codi generate`.
 *
 * Why this exists: `.husky/` is gitignored (codi regenerates the hooks it
 * manages, so they are not committed). The pre-push gate has to be set up
 * by every developer's `pnpm install`, not by `codi generate`, because it
 * runs the codi-cli test suite — a self-development concern, not a user
 * concern. So we keep the source content here, in a tracked `scripts/` file,
 * and invoke this script from `package.json`'s `prepare` hook chain.
 *
 * Policy reference: docs/20260430_155234_[TECH]_quality-gates-policy.md
 */

import { mkdirSync, writeFileSync, chmodSync, existsSync } from "node:fs";
import { join } from "node:path";

const HUSKY_DIR = ".husky";
const PRE_PUSH_PATH = join(HUSKY_DIR, "pre-push");

const PRE_PUSH_CONTENT = `# Codi pre-push gate
#
# Runs the same checks the CI \`test\` job runs, locally, before any push.
# Mirrors GitHub Actions exactly so failures here surface in seconds instead
# of after a 2-minute CI round trip.
#
# Policy reference: docs/*_[TECH]_quality-gates-policy.md
# - Pre-commit: fast file-level checks only (≤5s).
# - Pre-push  : full type check + test suite + coverage thresholds (~25-30s).
# - CI on PR  : same gate, authoritative environment.
#
# Do NOT bypass this with \`git push --no-verify\`. Codi's repository policy
# forbids it (see CLAUDE.md). If a check fails, fix the underlying issue.

pnpm lint
pnpm test:coverage
`;

if (!existsSync(HUSKY_DIR)) {
  mkdirSync(HUSKY_DIR, { recursive: true });
}

writeFileSync(PRE_PUSH_PATH, PRE_PUSH_CONTENT, { mode: 0o755 });
chmodSync(PRE_PUSH_PATH, 0o755);

console.log(`[setup-husky-hooks] wrote ${PRE_PUSH_PATH}`);
