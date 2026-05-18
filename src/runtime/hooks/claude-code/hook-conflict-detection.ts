/**
 * Hook-conflict detection — UserPromptSubmit contribution.
 *
 * ADR-013 Paso 9: codi-default uses `core.hooksPath ./.githooks/` for
 * git hooks. This conflicts with project-installed Husky / Lefthook /
 * pre-commit-framework (each sets its own `core.hooksPath` or relies
 * on `.git/hooks/` shims). They cannot coexist without one silently
 * winning.
 *
 * When `codi init` runs in a project with an existing runner, codi
 * does NOT auto-migrate — that would surprise users with custom
 * scripts. Instead, codi defers the migration to the AGENT via this
 * module: every UserPromptSubmit fires a small prompt block telling
 * the agent to invoke the `${PROJECT_NAME}-dev-migrate-hooks` skill,
 * which walks the user through the migration safely.
 *
 * The block stops firing automatically once `core.hooksPath` is set
 * to `.githooks/` AND the legacy config (`.husky/`, `lefthook.yml`,
 * `.pre-commit-config.yaml`) has been renamed by the skill.
 *
 * Gating: silent no-op unless the codi-default preset's
 * `hook_conflict_detection: true` flag is set (via preferences,
 * default true). Same convention as capability_discovery +
 * claudemd_memory_sync.
 */

import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

interface ConflictReport {
  husky: boolean;
  lefthook: boolean;
  preCommit: boolean;
  hooksPathSet: boolean;
}

function detectConflicts(cwd: string): ConflictReport {
  const husky = existsSync(join(cwd, ".husky"));
  const lefthook =
    existsSync(join(cwd, "lefthook.yml")) || existsSync(join(cwd, "lefthook.yaml"));
  const preCommit = existsSync(join(cwd, ".pre-commit-config.yaml"));

  let hooksPathSet = false;
  try {
    const out = execFileSync("git", ["config", "--get", "core.hooksPath"], {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    hooksPathSet = out === ".githooks" || out === ".githooks/";
  } catch {
    // `git config --get` exits non-zero when the key is unset; that's
    // expected. The hook fails open: no conflict alert when we can't read.
  }

  return { husky, lefthook, preCommit, hooksPathSet };
}

/**
 * Build the conflict-migration prompt block. Returns empty string when
 * disabled or when no conflict is present.
 */
export function buildHookConflictBlock(opts: {
  cwd: string;
  enabled: boolean;
  projectName: string;
}): string {
  if (!opts.enabled) return "";

  const report = detectConflicts(opts.cwd);
  const conflicts: string[] = [];
  if (report.husky) conflicts.push(".husky/");
  if (report.lefthook) conflicts.push("lefthook.yml");
  if (report.preCommit) conflicts.push(".pre-commit-config.yaml");

  // No conflicts → silent.
  if (conflicts.length === 0) return "";

  // Migration already complete (codi's core.hooksPath active AND no
  // legacy markers) → silent. We already checked legacy markers above;
  // this is the "post-migration but legacy renamed" case.
  if (report.hooksPathSet && conflicts.length === 0) return "";

  const skillName = `${opts.projectName}-dev-migrate-hooks`;
  return `<hook-setup-conflict>
codi-default ships git hook integration via \`core.hooksPath ./.githooks/\`
but this project still has a conflicting hook runner configured:

${conflicts.map((c) => "  - " + c).join("\n")}

These two cannot coexist. One will silently win when \`git commit\` /
\`git push\` fires. To migrate cleanly, invoke the skill:

  ${skillName}

It will:
  1. Rename the existing config to a legacy location (e.g. \`.husky.legacy/\`)
     so any custom logic survives for review.
  2. Set \`core.hooksPath\` to \`.githooks/\` and write the 3 stub scripts
     that delegate to \`${opts.projectName} hook git-{pre-commit, commit-msg, pre-push}\`.
  3. Summarize any logic from the legacy config that the user may want
     to manually port forward (e.g. \`lint-staged\` patterns, custom
     project scripts).

The skill is idempotent and safe to run. If the user prefers to keep
their existing runner, suggest disabling codi's git hooks by editing
\`.codi/flags.yaml\`: set \`git_hooks_enabled\` to \`false\`.
</hook-setup-conflict>`;
}
