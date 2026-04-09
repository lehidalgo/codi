import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { cleanupTmpDir } from "#tests/helpers/fs.js";
import { STAGED_JUNK_CHECK_TEMPLATE } from "#src/core/hooks/hook-templates.js";

let tmpDir: string;
let scriptPath: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "codi-junk-check-"));
  scriptPath = path.join(tmpDir, "staged-junk-check.mjs");
  await fs.writeFile(scriptPath, STAGED_JUNK_CHECK_TEMPLATE, { mode: 0o755 });
});

afterEach(async () => {
  await cleanupTmpDir(tmpDir);
});

function runScript(files: string[]): { ok: boolean; stderr: string; stdout: string } {
  try {
    const stdout = execFileSync("node", [scriptPath, ...files], {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return { ok: true, stderr: "", stdout };
  } catch (e) {
    const err = e as { stderr?: string; stdout?: string; status?: number };
    return { ok: false, stderr: err.stderr ?? "", stdout: err.stdout ?? "" };
  }
}

describe("STAGED_JUNK_CHECK_TEMPLATE", () => {
  it("is a non-empty string", () => {
    expect(typeof STAGED_JUNK_CHECK_TEMPLATE).toBe("string");
    expect(STAGED_JUNK_CHECK_TEMPLATE.length).toBeGreaterThan(0);
  });

  it("contains all expected junk patterns", () => {
    expect(STAGED_JUNK_CHECK_TEMPLATE).toContain(".DS_Store");
    expect(STAGED_JUNK_CHECK_TEMPLATE).toContain("Thumbs.db");
    expect(STAGED_JUNK_CHECK_TEMPLATE).toContain("__pycache__");
    expect(STAGED_JUNK_CHECK_TEMPLATE).toContain(".pyc");
    expect(STAGED_JUNK_CHECK_TEMPLATE).toContain(".pyo");
    expect(STAGED_JUNK_CHECK_TEMPLATE).toContain(".pytest_cache");
    expect(STAGED_JUNK_CHECK_TEMPLATE).toContain("desktop.ini");
  });

  it("passes with no files", () => {
    const result = runScript([]);
    expect(result.ok).toBe(true);
  });

  it("passes with clean file paths", () => {
    const result = runScript(["src/index.ts", "README.md", "package.json"]);
    expect(result.ok).toBe(true);
  });

  it("fails when a .DS_Store path is passed", () => {
    const result = runScript(["src/templates/skills/rl3-brand/.DS_Store"]);
    expect(result.ok).toBe(false);
    expect(result.stderr).toContain(".DS_Store");
  });

  it("fails when a __pycache__ path is passed", () => {
    const result = runScript(["src/__pycache__/module.cpython-311.pyc"]);
    expect(result.ok).toBe(false);
    expect(result.stderr).toContain("__pycache__");
  });

  it("fails when a .pyc file is passed", () => {
    const result = runScript(["app/utils.pyc"]);
    expect(result.ok).toBe(false);
    expect(result.stderr).toContain(".pyc");
  });

  it("fails when Thumbs.db is passed", () => {
    const result = runScript(["assets/Thumbs.db"]);
    expect(result.ok).toBe(false);
    expect(result.stderr).toContain("Thumbs.db");
  });

  it("fails when desktop.ini is passed", () => {
    const result = runScript(["assets/desktop.ini"]);
    expect(result.ok).toBe(false);
    expect(result.stderr).toContain("desktop.ini");
  });

  it("lists all junk files in error output", () => {
    const result = runScript(["a/.DS_Store", "b/Thumbs.db", "src/main.ts"]);
    expect(result.ok).toBe(false);
    expect(result.stderr).toContain(".DS_Store");
    expect(result.stderr).toContain("Thumbs.db");
  });

  it("mentions git rm --cached in error output", () => {
    const result = runScript(["src/.DS_Store"]);
    expect(result.ok).toBe(false);
    expect(result.stderr).toContain("git rm --cached");
  });
});
