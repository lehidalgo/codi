import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.resolve(__dirname, "../../../scripts/verify-artifact-versions.mjs");

function git(cwd: string, args: string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf-8" });
}

describe("verify-artifact-versions.mjs", () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "codi-verify-"));
    git(dir, ["init", "-q", "-b", "main"]);
    git(dir, ["config", "user.email", "test@example.com"]);
    git(dir, ["config", "user.name", "Test"]);
    await fs.mkdir(path.join(dir, "src", "templates", "rules"), { recursive: true });
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("exits 0 when artifact bumps are present", async () => {
    const file = path.join(dir, "src/templates/rules/test.ts");
    await fs.writeFile(file, "---\nname: test\nversion: 1\n---\noriginal", "utf-8");
    git(dir, ["add", "."]);
    git(dir, ["commit", "-q", "-m", "init"]);

    await fs.writeFile(file, "---\nname: test\nversion: 2\n---\nchanged", "utf-8");
    git(dir, ["add", "."]);
    git(dir, ["commit", "-q", "-m", "bump"]);

    const result = execFileSync("node", [SCRIPT, "--base", "HEAD~1", "--head", "HEAD"], {
      cwd: dir,
      encoding: "utf-8",
    });
    expect(result).toContain("OK");
  });

  it("exits 1 when artifact changed without version bump", async () => {
    const file = path.join(dir, "src/templates/rules/test.ts");
    await fs.writeFile(file, "---\nname: test\nversion: 1\n---\noriginal", "utf-8");
    git(dir, ["add", "."]);
    git(dir, ["commit", "-q", "-m", "init"]);

    await fs.writeFile(file, "---\nname: test\nversion: 1\n---\nchanged", "utf-8");
    git(dir, ["add", "."]);
    git(dir, ["commit", "-q", "-m", "no bump"]);

    let exitCode = 0;
    try {
      execFileSync("node", [SCRIPT, "--base", "HEAD~1", "--head", "HEAD"], {
        cwd: dir,
        encoding: "utf-8",
        stdio: "pipe",
      });
    } catch (e) {
      exitCode = (e as { status: number }).status;
    }
    expect(exitCode).toBe(1);
  });

  it("exits 0 when no artifact paths in diff", async () => {
    await fs.writeFile(path.join(dir, "README.md"), "v1", "utf-8");
    git(dir, ["add", "."]);
    git(dir, ["commit", "-q", "-m", "init"]);
    await fs.writeFile(path.join(dir, "README.md"), "v2", "utf-8");
    git(dir, ["add", "."]);
    git(dir, ["commit", "-q", "-m", "readme"]);

    const result = execFileSync("node", [SCRIPT, "--base", "HEAD~1", "--head", "HEAD"], {
      cwd: dir,
      encoding: "utf-8",
    });
    expect(result).toContain("0 artifact path(s) inspected");
  });
});
