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
  const dir = await mkdtemp(path.join(tmpdir(), "codi-bump-user-"));
  git(dir, ["init", "-q", "-b", "main"]);
  git(dir, ["config", "user.email", "test@example.com"]);
  git(dir, ["config", "user.name", "Test"]);
  await fs.mkdir(path.join(dir, ".codi", "rules"), { recursive: true });
  await fs.mkdir(path.join(dir, ".git", "hooks"), { recursive: true });
  writeFileSync(path.join(dir, ".git/hooks/codi-version-bump.mjs"), VERSION_BUMP_TEMPLATE, {
    mode: 0o755,
  });
  await fs.writeFile(
    path.join(dir, ".codi/artifact-manifest.json"),
    JSON.stringify({ version: "1", artifacts: {} }, null, 2),
  );
  return dir;
}

describe("version-bump pre-commit (.codi user-managed)", () => {
  let dir: string;
  beforeEach(async () => {
    dir = await setupRepo();
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("auto-bumps + updates manifest on user-managed edit", async () => {
    const file = path.join(dir, ".codi/rules/my-rule.md");
    await fs.writeFile(file, "---\nname: my-rule\nmanaged_by: user\nversion: 1\n---\noriginal");
    git(dir, ["add", "."]);
    git(dir, ["commit", "-q", "-m", "init"]);

    await fs.writeFile(file, "---\nname: my-rule\nmanaged_by: user\nversion: 1\n---\nCHANGED");
    git(dir, ["add", "."]);
    execFileSync("node", [path.join(dir, ".git/hooks/codi-version-bump.mjs")], { cwd: dir });

    const after = await fs.readFile(file, "utf-8");
    expect(after).toContain("version: 2");

    const manifest = JSON.parse(
      await fs.readFile(path.join(dir, ".codi/artifact-manifest.json"), "utf-8"),
    );
    expect(manifest.artifacts["my-rule"].installedArtifactVersion).toBe(2);
  });

  it("rejects edits to managed_by: codi artifacts with fork message", async () => {
    const file = path.join(dir, ".codi/rules/codi-debugging.md");
    await fs.writeFile(
      file,
      "---\nname: codi-debugging\nmanaged_by: codi\nversion: 11\n---\noriginal",
    );
    git(dir, ["add", "."]);
    git(dir, ["commit", "-q", "-m", "init"]);

    await fs.writeFile(
      file,
      "---\nname: codi-debugging\nmanaged_by: codi\nversion: 11\n---\nCHANGED",
    );
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
    expect(err).toContain("managed-by-codi");
    expect(err).toMatch(/--as/);
  });

  it("creates new manifest entry for newly-added user-managed artifact", async () => {
    const file = path.join(dir, ".codi/rules/brand-new.md");
    await fs.writeFile(file, "---\nname: brand-new\nmanaged_by: user\n---\nbody");
    git(dir, ["add", "."]);
    execFileSync("node", [path.join(dir, ".git/hooks/codi-version-bump.mjs")], { cwd: dir });

    const after = await fs.readFile(file, "utf-8");
    expect(after).toContain("version: 1");

    const manifest = JSON.parse(
      await fs.readFile(path.join(dir, ".codi/artifact-manifest.json"), "utf-8"),
    );
    expect(manifest.artifacts["brand-new"]).toBeDefined();
  });
});
