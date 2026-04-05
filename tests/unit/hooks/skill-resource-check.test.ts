import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import os from "node:os";
import { cleanupTmpDir } from "#tests/helpers/fs.js";
import { PROJECT_NAME } from "#src/constants.js";
import { SKILL_RESOURCE_CHECK_TEMPLATE } from "#src/core/hooks/hook-templates.js";

let tmpDir: string;
let scriptPath: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), `${PROJECT_NAME}-resource-check-`));
  scriptPath = path.join(tmpDir, "skill-resource-check.mjs");
  await fs.writeFile(scriptPath, SKILL_RESOURCE_CHECK_TEMPLATE, {
    mode: 0o755,
  });
});

afterEach(async () => {
  await cleanupTmpDir(tmpDir);
});

function runScript(cwd: string): { ok: boolean; stderr: string } {
  try {
    execFileSync("node", [scriptPath], {
      cwd,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return { ok: true, stderr: "" };
  } catch (e) {
    const err = e as { stderr?: string };
    return { ok: false, stderr: err.stderr ?? "" };
  }
}

async function setupUserSkill(
  root: string,
  skillBody: string,
  extraFiles: string[] = [],
): Promise<void> {
  const skillDir = path.join(root, ".codi", "skills", "audio");
  await fs.mkdir(path.join(skillDir, "scripts"), { recursive: true });
  await fs.writeFile(path.join(skillDir, "SKILL.md"), skillBody, "utf-8");
  for (const relPath of extraFiles) {
    const fullPath = path.join(skillDir, relPath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, "# helper\n", "utf-8");
  }
}

describe("skill resource check script", () => {
  it("accepts compact [[/path]] markers", async () => {
    const root = path.join(tmpDir, "compact");
    await setupUserSkill(root, "Run `[[/scripts/run.py]]`", ["scripts/run.py"]);

    const result = runScript(root);
    expect(result.ok).toBe(true);
  });

  it("accepts spaced [[ /path ]] markers", async () => {
    const root = path.join(tmpDir, "spaced");
    await setupUserSkill(root, "Run `[[ /scripts/run.py ]]`", ["scripts/run.py"]);

    const result = runScript(root);
    expect(result.ok).toBe(true);
  });

  it("still rejects missing resource files", async () => {
    const root = path.join(tmpDir, "missing");
    await setupUserSkill(root, "Run `[[ /scripts/run.py ]]`");

    const result = runScript(root);
    expect(result.ok).toBe(false);
    expect(result.stderr).toContain("scripts/run.py");
    expect(result.stderr).toContain("file does not exist");
  });

  it("does not treat TOML-style double brackets as resource markers", async () => {
    const root = path.join(tmpDir, "toml");
    await setupUserSkill(root, '[[tool.mypy.overrides]]\nmodule = ["pkg.*"]\n');

    const result = runScript(root);
    expect(result.ok).toBe(true);
  });
});
