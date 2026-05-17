/**
 * Regression e2e suite for ISSUE-006 (functional audit 2026-05-17).
 *
 * The defect: `src/core/hooks/registry/loader.ts` resolves the YAML
 * registry directory via `import.meta.url`. In source the file structure
 * is preserved, so it finds `src/core/hooks/registry/yaml/`. In the
 * tsup-bundled `dist/`, non-entry modules collapse into top-level
 * `dist/chunk-*.js` files — `import.meta.url` then resolves to `dist/`
 * and the loader looks for `dist/yaml/`. Before the fix, the YAML copy
 * script put files at `dist/core/hooks/registry/yaml/` instead, so every
 * hook-related command crashed with ENOENT in the published binary.
 *
 * The existing test suite NEVER caught this because vitest runs via the
 * `#src/` alias, exercising source code only. This file plugs that gap
 * by spawning the actual `node dist/cli.js` binary and asserting hook
 * commands succeed end-to-end against the packaged artefact.
 *
 * If you ever change the YAML layout (e.g., move to a multi-entry tsup
 * config that emits `dist/core/hooks/registry/loader.js`), update BOTH
 * `scripts/copy-hook-yaml.mjs:DEST` AND the loader's path resolution
 * — and keep these tests green.
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

const SUITE_TIMEOUT = 60_000;
const REPO = process.cwd();
const CLI = join(REPO, "dist", "cli.js");

interface CliResult {
  code: number;
  stdout: string;
  stderr: string;
}

function ensureBuilt(): void {
  if (!existsSync(CLI)) {
    execFileSync("npm", ["run", "build"], { cwd: REPO, stdio: "inherit" });
  }
  if (!existsSync(CLI)) throw new Error(`dist/cli.js missing at ${CLI}`);
}

function runCli(
  args: string[],
  cwd: string,
  env: Record<string, string> = {},
): CliResult {
  try {
    const stdout = execFileSync("node", [CLI, ...args], {
      cwd,
      encoding: "utf-8",
      env: { ...process.env, ...env },
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { code: 0, stdout, stderr: "" };
  } catch (err) {
    const e = err as { status?: number; stdout?: Buffer | string; stderr?: Buffer | string };
    const stdout = typeof e.stdout === "string" ? e.stdout : (e.stdout?.toString() ?? "");
    const stderr = typeof e.stderr === "string" ? e.stderr : (e.stderr?.toString() ?? "");
    return { code: e.status ?? -1, stdout, stderr };
  }
}

let dir: string;

beforeAll(() => {
  ensureBuilt();
});

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "codi-hooks-dist-"));
  // Hooks setup needs a git directory present
  execFileSync("git", ["init", "-q"], { cwd: dir, stdio: "ignore" });
});

afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
});

describe("dist binary: hook commands (ISSUE-006 regression)", () => {
  it(
    "dist contains the YAML registry at the loader's expected location",
    () => {
      // The loader (src/core/hooks/registry/loader.ts:41-42) computes
      // YAML_DIR = join(dirname(import.meta.url), "yaml"). In dist this
      // resolves to dist/yaml/. The copy script must put files there.
      const yamlDir = join(REPO, "dist", "yaml");
      expect(existsSync(yamlDir)).toBe(true);
      const files = readdirSync(yamlDir).filter((f) => f.endsWith(".yaml"));
      // 14 languages + 1 global = 15 minimum. If the catalogue grows it's
      // fine — assert the floor and the always-present `global.yaml`.
      expect(files.length).toBeGreaterThanOrEqual(15);
      expect(files).toContain("global.yaml");
    },
    SUITE_TIMEOUT,
  );

  it(
    "`codi hooks doctor` does NOT crash with ENOENT",
    () => {
      const result = runCli(["hooks", "doctor", "--no-color"], dir);
      // Pre-fix: throws "cannot read YAML for language ... ENOENT".
      // Post-fix: runs the doctor report. Exit code may be non-zero on
      // host machines that legitimately lack required tools (gitleaks,
      // commitlint) — that's fine, only the crash signature is the
      // regression we're guarding.
      const combined = result.stdout + result.stderr;
      expect(combined).not.toMatch(/cannot read YAML/i);
      expect(combined).not.toMatch(/ENOENT.*yaml/i);
      // Pre-fix output had no "Languages detected" line; post-fix it does.
      // The CLI Logger emits [INF] lines to stderr, so check combined.
      expect(combined).toMatch(/Languages detected|Hooks checked/);
    },
    SUITE_TIMEOUT,
  );

  it(
    "`codi hooks list` does NOT crash with ENOENT",
    () => {
      const result = runCli(["hooks", "list", "--no-color"], dir);
      const combined = result.stdout + result.stderr;
      expect(combined).not.toMatch(/cannot read YAML/i);
      expect(combined).not.toMatch(/ENOENT.*yaml/i);
      // hooks list returns one row per hook; verify at least one
      // recognisable bucket label shows up.
      expect(combined).toMatch(/\[git\/|\[runtime\]/);
    },
    SUITE_TIMEOUT,
  );

  it(
    "`codi init` actually installs hooks (was silently skipped pre-fix)",
    () => {
      const result = runCli(
        [
          "init",
          "--preset",
          "codi-balanced",
          "--agents",
          "claude-code",
          "--force",
          "--no-color",
        ],
        dir,
      );
      // Pre-fix symptoms:
      //   - stdout contained "Hook detection failed; skipping hook installation"
      //   - .git/hooks/pre-commit was NOT created
      // Post-fix:
      //   - the warning is absent
      //   - the standalone hook script is present and executable
      const combined = result.stdout + result.stderr;
      expect(combined).not.toMatch(/Hook detection failed/);
      // Standalone runner (no husky/lefthook in the sandbox) writes
      // .git/hooks/pre-commit. The file is the strongest end-to-end
      // proof that the YAML loader resolved correctly inside dist —
      // without YAMLs, hook installation would have crashed/skipped.
      const preCommit = join(dir, ".git", "hooks", "pre-commit");
      expect(existsSync(preCommit)).toBe(true);
    },
    SUITE_TIMEOUT,
  );

  it(
    "init's swallowed catch now surfaces the underlying error in the warning (ISSUE-006 UX)",
    () => {
      // This documents the catch fix at init-helpers.ts:1298 — when hook
      // installation DOES fail in the future, the warning must include
      // the actual error so users (and audits) can diagnose without
      // re-running with debug.
      //
      // We can't easily inject a hook-installer failure in a sandbox
      // e2e, so this is a contract test: read the source and assert the
      // catch is bound + the warning interpolates it. If a future
      // refactor reverts to `} catch {`, this test fails loudly.
      const src = readFileSync(join(REPO, "src", "cli", "init-helpers.ts"), "utf-8");
      // 1. Catch must bind a parameter (not be empty).
      expect(src).toMatch(/\}\s*catch\s*\(\s*cause[^)]*\)/);
      // 2. Find the actual log.warn STATEMENT (not a comment line that
      //    happens to mention "Hook detection failed"). Stripping `//`
      //    lines avoids matching the explanatory comment block above
      //    the catch.
      const warnStatement = src
        .split("\n")
        .filter((l) => !l.trim().startsWith("//"))
        .find((l) => l.includes("log.warn") && l.includes("Hook detection failed"));
      expect(warnStatement, "expected a log.warn(... Hook detection failed ...) line").toBeDefined();
      // 3. The warn statement must interpolate the cause. We accept
      //    either `${msg}` (after `cause instanceof Error` narrowing)
      //    or `${cause}` (direct interpolation) — both convey the cause.
      expect(warnStatement).toMatch(/\$\{(msg|cause)/);
    },
    SUITE_TIMEOUT,
  );
});
