import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { VERSION_VERIFY_PRE_PUSH_TEMPLATE } from "#src/core/hooks/version-verify-pre-push-template.js";

function git(cwd: string, args: string[]) {
  return execFileSync("git", args, { cwd, encoding: "utf-8" });
}

async function setupRepo(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "codi-prepush-"));
  git(dir, ["init", "-q", "-b", "main"]);
  git(dir, ["config", "user.email", "test@example.com"]);
  git(dir, ["config", "user.name", "Test"]);
  await fs.mkdir(path.join(dir, "src", "templates", "rules"), { recursive: true });
  await fs.mkdir(path.join(dir, ".git", "hooks"), { recursive: true });
  writeFileSync(
    path.join(dir, ".git/hooks/codi-version-verify.mjs"),
    VERSION_VERIFY_PRE_PUSH_TEMPLATE,
    { mode: 0o755 },
  );
  return dir;
}

function runHook(dir: string, stdin: string) {
  return spawnSync("node", [path.join(dir, ".git/hooks/codi-version-verify.mjs")], {
    cwd: dir,
    input: stdin,
    encoding: "utf-8",
  });
}

describe("version-verify pre-push", () => {
  let dir: string;
  beforeEach(async () => {
    dir = await setupRepo();
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("rejects push range with unbumped artifact change", async () => {
    const file = path.join(dir, "src/templates/rules/x.ts");
    await fs.writeFile(file, "---\nname: x\nversion: 1\n---\nbody");
    git(dir, ["add", "."]);
    git(dir, ["commit", "-q", "-m", "init"]);
    const baseOid = git(dir, ["rev-parse", "HEAD"]).trim();

    await fs.writeFile(file, "---\nname: x\nversion: 1\n---\nCHANGED");
    git(dir, ["add", "."]);
    git(dir, ["commit", "-q", "-m", "skip bump"]);
    const headOid = git(dir, ["rev-parse", "HEAD"]).trim();

    const stdin = `refs/heads/main ${headOid} refs/heads/main ${baseOid}\n`;
    const r = runHook(dir, stdin);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("[version-verify]");
    expect(r.stderr).toContain("content changed");
  });

  it("allows push range with proper version bumps", async () => {
    const file = path.join(dir, "src/templates/rules/x.ts");
    await fs.writeFile(file, "---\nname: x\nversion: 1\n---\nbody");
    git(dir, ["add", "."]);
    git(dir, ["commit", "-q", "-m", "init"]);
    const baseOid = git(dir, ["rev-parse", "HEAD"]).trim();

    await fs.writeFile(file, "---\nname: x\nversion: 2\n---\nCHANGED");
    git(dir, ["add", "."]);
    git(dir, ["commit", "-q", "-m", "bumped"]);
    const headOid = git(dir, ["rev-parse", "HEAD"]).trim();

    const stdin = `refs/heads/main ${headOid} refs/heads/main ${baseOid}\n`;
    const r = runHook(dir, stdin);
    expect(r.status).toBe(0);
  });

  it("allows branch deletion (zero local_oid)", async () => {
    const stdin = `(delete) 0000000000000000000000000000000000000000 refs/heads/foo abcdef\n`;
    const r = runHook(dir, stdin);
    expect(r.status).toBe(0);
  });
});
