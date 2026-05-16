import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { formatHooksList } from "#src/cli/hooks-list.js";
import { addHookToState } from "#src/cli/hooks-add.js";
import { removeHookFromState } from "#src/cli/hooks-remove.js";

describe("formatHooksList", () => {
  it("includes both buckets by default", () => {
    const out = formatHooksList({ cwd: process.cwd() });
    expect(out).toMatch(/eslint/);
    expect(out).toMatch(/security-reminder/);
    expect(out).toMatch(/git/i);
    expect(out).toMatch(/runtime/i);
  });
  it("filters with bucket=git", () => {
    const out = formatHooksList({ bucket: "git", cwd: process.cwd() });
    expect(out).not.toMatch(/security-reminder/);
    expect(out).toMatch(/eslint/);
  });
  it("filters with bucket=runtime", () => {
    const out = formatHooksList({ bucket: "runtime", cwd: process.cwd() });
    expect(out).toMatch(/security-reminder/);
    expect(out).not.toMatch(/^.*eslint/m);
  });
});

describe("addHookToState / removeHookFromState", () => {
  let dir: string;
  let statePath: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "codi-hooks-cli-"));
    statePath = join(dir, ".codi", "state", "state.json");
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("addHookToState creates state and adds hook", () => {
    const r = addHookToState("runtime", "security-reminder", statePath);
    expect(r.added).toBe(true);
    expect(existsSync(statePath)).toBe(true);
    const parsed = JSON.parse(readFileSync(statePath, "utf8")) as Record<string, unknown>;
    const sel = parsed["selectedHooks"] as { runtime: string[] };
    expect(sel.runtime).toContain("security-reminder");
  });

  it("addHookToState rejects unknown hook", () => {
    const r = addHookToState("runtime", "nope-doesnotexist", statePath);
    expect(r.added).toBe(false);
    expect(r.reason).toMatch(/unknown/i);
  });

  it("addHookToState rejects wrong bucket", () => {
    const r = addHookToState("git", "security-reminder", statePath);
    expect(r.added).toBe(false);
    expect(r.reason).toMatch(/bucket/i);
  });

  it("addHookToState is idempotent", () => {
    addHookToState("runtime", "security-reminder", statePath);
    const r = addHookToState("runtime", "security-reminder", statePath);
    expect(r.added).toBe(false);
    expect(r.reason).toMatch(/already/i);
  });

  it("removeHookFromState removes a non-required hook", () => {
    addHookToState("runtime", "security-reminder", statePath);
    const r = removeHookFromState("runtime", "security-reminder", statePath);
    expect(r.removed).toBe(true);
  });

  it("removeHookFromState refuses to remove required hooks", () => {
    addHookToState("runtime", "iron-laws-enforcer", statePath);
    const r = removeHookFromState("runtime", "iron-laws-enforcer", statePath);
    expect(r.removed).toBe(false);
    expect(r.reason).toMatch(/required/i);
  });
});
