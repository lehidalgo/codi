import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { VERSION_BUMP_TEMPLATE } from "#src/core/hooks/version-bump-template.js";

function git(cwd: string, args: string[]) {
  return execFileSync("git", args, { cwd, encoding: "utf-8" });
}

async function setupRepo(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "codi-bump-src-"));
  git(dir, ["init", "-q", "-b", "main"]);
  git(dir, ["config", "user.email", "test@example.com"]);
  git(dir, ["config", "user.name", "Test"]);
  await fs.mkdir(path.join(dir, "src", "templates", "rules"), { recursive: true });
  await fs.mkdir(path.join(dir, ".git", "hooks"), { recursive: true });
  const hookPath = path.join(dir, ".git", "hooks", "codi-version-bump.mjs");
  writeFileSync(hookPath, VERSION_BUMP_TEMPLATE, { encoding: "utf-8", mode: 0o755 });
  return dir;
}

describe("version-bump pre-commit (source layer)", () => {
  let dir: string;
  beforeEach(async () => {
    dir = await setupRepo();
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("auto-bumps version when source template content changed", async () => {
    const file = path.join(dir, "src/templates/rules/test.ts");
    await fs.writeFile(file, "---\nname: test\nversion: 1\n---\noriginal");
    git(dir, ["add", "."]);
    git(dir, ["commit", "-q", "-m", "init"]);

    await fs.writeFile(file, "---\nname: test\nversion: 1\n---\nCHANGED");
    git(dir, ["add", "."]);

    execFileSync("node", [path.join(dir, ".git/hooks/codi-version-bump.mjs")], { cwd: dir });

    const after = await fs.readFile(file, "utf-8");
    expect(after).toContain("version: 2");
    expect(after).toContain("CHANGED");
  });

  it("no-op when content matches HEAD", async () => {
    const file = path.join(dir, "src/templates/rules/test.ts");
    await fs.writeFile(file, "---\nname: test\nversion: 1\n---\nbody");
    git(dir, ["add", "."]);
    git(dir, ["commit", "-q", "-m", "init"]);
    git(dir, ["add", "."]);

    execFileSync("node", [path.join(dir, ".git/hooks/codi-version-bump.mjs")], { cwd: dir });

    const after = await fs.readFile(file, "utf-8");
    expect(after).toContain("version: 1");
  });

  it("rejects version regression", async () => {
    const file = path.join(dir, "src/templates/rules/test.ts");
    await fs.writeFile(file, "---\nname: test\nversion: 5\n---\nbody");
    git(dir, ["add", "."]);
    git(dir, ["commit", "-q", "-m", "init"]);

    await fs.writeFile(file, "---\nname: test\nversion: 3\n---\nCHANGED");
    git(dir, ["add", "."]);

    let err = "";
    let exitCode = 0;
    try {
      execFileSync("node", [path.join(dir, ".git/hooks/codi-version-bump.mjs")], {
        cwd: dir,
        encoding: "utf-8",
        stdio: "pipe",
      });
    } catch (e) {
      err = (e as { stderr: Buffer }).stderr.toString();
      exitCode = (e as { status: number }).status;
    }
    expect(exitCode).toBe(1);
    expect(err).toContain("regression");
  });
});
