import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtemp, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

function commandExists(cmd: string): boolean {
  try {
    execFileSync("which", [cmd], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

const hasPreCommit = commandExists("pre-commit");

describe.skipIf(!hasPreCommit)("precommit-multilanguage E2E", () => {
  it("generated config validates with `pre-commit validate-config`", async () => {
    const { renderPreCommitConfig } = await import("#src/core/hooks/renderers/yaml-renderer.js");
    const { getHooksForLanguage, getGlobalHooks } =
      await import("#src/core/hooks/hook-registry.js");
    const specs = [
      ...getHooksForLanguage("typescript"),
      ...getHooksForLanguage("python").filter((h) => h.name !== "mypy" && h.name !== "pyright"),
      ...getGlobalHooks(),
    ];
    const yaml = renderPreCommitConfig(specs, null);

    const dir = await mkdtemp(path.join(tmpdir(), "codi-e2e-"));
    await mkdir(path.join(dir, ".git"), { recursive: true });
    await writeFile(path.join(dir, ".git", "HEAD"), "ref: refs/heads/main\n");
    await writeFile(path.join(dir, ".pre-commit-config.yaml"), yaml);

    expect(() =>
      execFileSync("pre-commit", ["validate-config"], { cwd: dir, stdio: "pipe" }),
    ).not.toThrow();
  });
});
