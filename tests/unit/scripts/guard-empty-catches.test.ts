/**
 * CORE-015 — `scripts/guard-empty-catches.mjs` contract tests.
 *
 * The guard scans `src/**\/*.ts` for `catch (e) { … }` blocks whose
 * body is whitespace + comments only. If such a body contains a
 * marker token from the closed vocabulary (`ignore`, `best-effort`,
 * `missing`, `race`, …) the block is accepted. Otherwise the guard
 * fails CI with a per-site report.
 *
 * Tests fork the guard against ad-hoc fixture directories so we can
 * pin both happy and failing inputs without touching the real
 * source tree. The exit code is the contract — the guard returns 0
 * on a clean tree and 1 on any unmarked empty catch.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const SCRIPT = join(process.cwd(), "scripts/guard-empty-catches.mjs");

function runGuardIn(cwd: string): { code: number; stdout: string; stderr: string } {
  const result = spawnSync("node", [SCRIPT], { cwd, encoding: "utf8" });
  return {
    code: result.status ?? -1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

function makeFixture(): string {
  const dir = mkdtempSync(join(tmpdir(), "codi-guard-empty-"));
  mkdirSync(join(dir, "src"), { recursive: true });
  return dir;
}

describe("guard-empty-catches (CORE-015)", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeFixture();
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("passes on a clean tree (no empty catches)", () => {
    writeFileSync(
      join(tmpDir, "src/a.ts"),
      `export function f() { try { return 1; } catch (e) { console.log(e); return 0; } }\n`,
    );
    const { code } = runGuardIn(tmpDir);
    expect(code).toBe(0);
  });

  it("passes when an empty catch has a marker comment", () => {
    writeFileSync(
      join(tmpDir, "src/a.ts"),
      `export function f() {
  try { /* whatever */ }
  catch { /* ignore */ }
}
`,
    );
    const { code } = runGuardIn(tmpDir);
    expect(code).toBe(0);
  });

  it("fails when an empty catch lacks a marker comment", () => {
    writeFileSync(
      join(tmpDir, "src/a.ts"),
      `export function f() {
  try { /* whatever */ }
  catch (e) {}
}
`,
    );
    const { code, stderr } = runGuardIn(tmpDir);
    expect(code).toBe(1);
    expect(stderr).toMatch(/missing an intent marker/);
    expect(stderr).toMatch(/src\/a\.ts:/);
  });

  it("fails when the only catch comment lacks a marker token", () => {
    writeFileSync(
      join(tmpDir, "src/a.ts"),
      `export function f() {
  try { /* whatever */ }
  catch { /* TODO something */ }
}
`,
    );
    const { code, stderr } = runGuardIn(tmpDir);
    expect(code).toBe(1);
    expect(stderr).toMatch(/missing an intent marker/);
  });

  it("ignores catch substrings inside string literals (template files)", () => {
    writeFileSync(
      join(tmpDir, "src/template.ts"),
      `// Fixture: simulates src/core/hooks/hook-policy-templates.ts.
// The catch(e){} inside the backtick string is NOT a TS catch —
// it is shell/JS source emitted to a generated script. Guard must
// strip strings before scanning.
export const TEMPLATE = \`
  try { foo(); } catch(e) {}
\`;
`,
    );
    const { code } = runGuardIn(tmpDir);
    expect(code).toBe(0);
  });

  it("accepts any of the canonical markers from the lexicon", () => {
    const markers = [
      "/* ignore */",
      "/* best-effort cleanup */",
      "/* missing — fall through */",
      "/* race — keep walking */",
      "/* malformed — fall through */",
      "/* probe — capability detection */",
      "/* intentional — documented in ISSUE-066 */",
    ];
    const body = markers
      .map((mk, i) => `  function f${i}() { try { 1; } catch { ${mk} } }`)
      .join("\n");
    writeFileSync(join(tmpDir, "src/all.ts"), `export {};\n${body}\n`);
    const { code } = runGuardIn(tmpDir);
    expect(code).toBe(0);
  });

  it("handles nested catch bodies (brace-balanced scanner)", () => {
    writeFileSync(
      join(tmpDir, "src/a.ts"),
      `export function f() {
  try { foo(); }
  catch (e) {
    if (e instanceof Error) {
      console.error(e.message);
    }
  }
}
`,
    );
    // This is NOT empty (it has logic) — guard must NOT flag it.
    const { code } = runGuardIn(tmpDir);
    expect(code).toBe(0);
  });

  it("the real src/ tree passes (regression sentinel)", () => {
    // Run the guard against the repo root — the corpus at the moment
    // of CORE-015's landing already passes every marker check. This
    // test fails the day a new uncommented empty catch sneaks in.
    const result = spawnSync("node", [SCRIPT], {
      cwd: process.cwd(),
      encoding: "utf8",
    });
    if (result.status !== 0) {
      // Surface stderr so debugging the new offender is one click.
      throw new Error(`guard-empty-catches failed on real src/:\n${result.stderr}`);
    }
    expect(result.status).toBe(0);
  });
});
