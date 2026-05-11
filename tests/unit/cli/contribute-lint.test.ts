import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { runContributeLint } from "#src/cli/contribute-lint.js";

interface Repo {
  root: string;
  cleanup: () => void;
}

function makeGitRepo(): Repo | null {
  try {
    const root = mkdtempSync(join(tmpdir(), "codi-contrib-lint-"));
    const git = (...args: string[]) => execFileSync("git", args, { cwd: root, stdio: "ignore" });
    git("init", "--quiet", "-b", "main");
    git("config", "user.email", "t@t");
    git("config", "user.name", "t");
    git("config", "commit.gpgsign", "false");
    return { root, cleanup: () => rmSync(root, { recursive: true, force: true }) };
  } catch {
    return null;
  }
}

function commitAll(root: string, msg: string): void {
  execFileSync("git", ["add", "-A"], { cwd: root, stdio: "ignore" });
  execFileSync("git", ["commit", "--quiet", "-m", msg, "--no-verify"], {
    cwd: root,
    stdio: "ignore",
  });
}

function checkout(root: string, branch: string): void {
  execFileSync("git", ["checkout", "-q", "-b", branch], { cwd: root, stdio: "ignore" });
}

function writeFile(root: string, rel: string, body: string): void {
  const path = join(root, rel);
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, body);
}

function findingCodes(result: { data: { findings: readonly { check: number }[] } }): number[] {
  return result.data.findings.map((f) => f.check).sort((a, b) => a - b);
}

let repo: Repo | null;

beforeEach(() => {
  repo = makeGitRepo();
});

afterEach(() => {
  repo?.cleanup();
});

describe("runContributeLint — clean diff", () => {
  it("passes with no findings on a fresh branch with no changes", async () => {
    if (repo === null) return;
    // Seed an initial commit so HEAD exists
    writeFile(repo.root, "README.md", "init");
    commitAll(repo.root, "init");
    checkout(repo.root, "feature/clean");
    const result = await runContributeLint({ cwd: repo.root, baseBranch: "main" });
    expect(result.data.findings).toEqual([]);
    expect(result.data.errors).toBe(0);
    expect(result.exitCode).toBe(0);
    expect(result.success).toBe(true);
  });
});

describe("runContributeLint — check 1 generated edits", () => {
  it("flags edits to .claude/ as error", async () => {
    if (repo === null) return;
    writeFile(repo.root, "README.md", "init");
    commitAll(repo.root, "init");
    checkout(repo.root, "feature/edit-claude");
    writeFile(repo.root, ".claude/rules/something.md", "content");
    commitAll(repo.root, "edit");
    const result = await runContributeLint({ cwd: repo.root, baseBranch: "main" });
    expect(findingCodes(result)).toContain(1);
    expect(result.data.errors).toBeGreaterThanOrEqual(1);
  });

  it("flags edits to .codex/ and .cursor/ similarly", async () => {
    if (repo === null) return;
    writeFile(repo.root, "README.md", "init");
    commitAll(repo.root, "init");
    checkout(repo.root, "feature/edit-other");
    writeFile(repo.root, ".codex/something.md", "c");
    writeFile(repo.root, ".cursor/rules.md", "c");
    commitAll(repo.root, "edit");
    const result = await runContributeLint({ cwd: repo.root, baseBranch: "main" });
    const codes = findingCodes(result);
    expect(codes.filter((c) => c === 1)).toHaveLength(2);
  });
});

describe("runContributeLint — check 2 skill evals", () => {
  it("flags new skill template without evals/evals.json", async () => {
    if (repo === null) return;
    writeFile(repo.root, "README.md", "init");
    commitAll(repo.root, "init");
    checkout(repo.root, "feature/new-skill");
    writeFile(
      repo.root,
      "src/templates/skills/cool/template.ts",
      "export const template = `---\nname: cool\n---\nbody\n`;\n",
    );
    writeFile(repo.root, "src/templates/skills/cool/index.ts", "export {};\n");
    commitAll(repo.root, "new skill");
    const result = await runContributeLint({ cwd: repo.root, baseBranch: "main" });
    expect(findingCodes(result)).toContain(2);
  });

  it("does NOT flag when evals/evals.json is present", async () => {
    if (repo === null) return;
    writeFile(repo.root, "README.md", "init");
    commitAll(repo.root, "init");
    checkout(repo.root, "feature/new-skill-with-evals");
    writeFile(
      repo.root,
      "src/templates/skills/cool2/template.ts",
      "export const template = `---\nname: cool2\nversion: 1\n---\nbody\n`;\n",
    );
    writeFile(repo.root, "src/templates/skills/cool2/index.ts", "export {};\n");
    writeFile(repo.root, "src/templates/skills/cool2/evals/evals.json", '{"cases":[]}');
    commitAll(repo.root, "new skill with evals");
    const result = await runContributeLint({ cwd: repo.root, baseBranch: "main" });
    expect(findingCodes(result)).not.toContain(2);
  });
});

describe("runContributeLint — check 3 description size", () => {
  it("flags skill template with description > 1500 chars", async () => {
    if (repo === null) return;
    writeFile(repo.root, "README.md", "init");
    commitAll(repo.root, "init");
    checkout(repo.root, "feature/long-desc");
    const longDesc = "x".repeat(1600);
    writeFile(
      repo.root,
      "src/templates/skills/longboi/template.ts",
      `export const template = \`---\nname: longboi\ndescription: |\n  ${longDesc}\nversion: 1\n---\nbody\n\`;\n`,
    );
    writeFile(repo.root, "src/templates/skills/longboi/index.ts", "export {};\n");
    writeFile(repo.root, "src/templates/skills/longboi/evals/evals.json", '{"cases":[]}');
    commitAll(repo.root, "long desc");
    const result = await runContributeLint({ cwd: repo.root, baseBranch: "main" });
    expect(findingCodes(result)).toContain(3);
  });
});

describe("runContributeLint — check 5 hook edits", () => {
  it("flags edits inside .husky/ as error", async () => {
    if (repo === null) return;
    writeFile(repo.root, "README.md", "init");
    commitAll(repo.root, "init");
    checkout(repo.root, "feature/edit-husky");
    writeFile(repo.root, ".husky/pre-commit", "#!/bin/sh\necho hi\n");
    commitAll(repo.root, "edit husky");
    const result = await runContributeLint({ cwd: repo.root, baseBranch: "main" });
    expect(findingCodes(result)).toContain(5);
  });
});

describe("runContributeLint — check 6 version bump", () => {
  it("flags modified skill template without version bump", async () => {
    if (repo === null) return;
    writeFile(
      repo.root,
      "src/templates/skills/x/template.ts",
      "export const template = `---\nname: x\nversion: 1\ndescription: original\n---\nbody\n`;\n",
    );
    writeFile(repo.root, "src/templates/skills/x/index.ts", "export {};\n");
    commitAll(repo.root, "init");
    checkout(repo.root, "feature/no-bump");
    writeFile(
      repo.root,
      "src/templates/skills/x/template.ts",
      "export const template = `---\nname: x\nversion: 1\ndescription: changed\n---\nbody\n`;\n",
    );
    commitAll(repo.root, "no-bump edit");
    const result = await runContributeLint({ cwd: repo.root, baseBranch: "main" });
    expect(findingCodes(result)).toContain(6);
  });

  it("does NOT flag when version is bumped", async () => {
    if (repo === null) return;
    writeFile(
      repo.root,
      "src/templates/skills/y/template.ts",
      "export const template = `---\nname: y\nversion: 1\ndescription: original\n---\nbody\n`;\n",
    );
    writeFile(repo.root, "src/templates/skills/y/index.ts", "export {};\n");
    commitAll(repo.root, "init");
    checkout(repo.root, "feature/bump");
    writeFile(
      repo.root,
      "src/templates/skills/y/template.ts",
      "export const template = `---\nname: y\nversion: 2\ndescription: changed\n---\nbody\n`;\n",
    );
    commitAll(repo.root, "bump");
    const result = await runContributeLint({ cwd: repo.root, baseBranch: "main" });
    expect(findingCodes(result)).not.toContain(6);
  });
});

describe("runContributeLint — check 7 no --no-verify", () => {
  it("flags commit message that mentions --no-verify", async () => {
    if (repo === null) return;
    writeFile(repo.root, "README.md", "init");
    commitAll(repo.root, "init");
    checkout(repo.root, "feature/no-verify-commit");
    writeFile(repo.root, "README.md", "changed");
    commitAll(repo.root, "skipped pre-commit with --no-verify");
    const result = await runContributeLint({ cwd: repo.root, baseBranch: "main" });
    expect(findingCodes(result)).toContain(7);
  });
});

describe("runContributeLint — check 8 doc naming", () => {
  it("flags docs/ file without YYYYMMDD_HHMMSS_[CATEGORY]_ prefix", async () => {
    if (repo === null) return;
    writeFile(repo.root, "README.md", "init");
    commitAll(repo.root, "init");
    checkout(repo.root, "feature/bad-doc");
    writeFile(repo.root, "docs/just-notes.md", "stuff");
    commitAll(repo.root, "add doc");
    const result = await runContributeLint({ cwd: repo.root, baseBranch: "main" });
    expect(findingCodes(result)).toContain(8);
  });

  it("does NOT flag docs/ file with valid timestamp prefix", async () => {
    if (repo === null) return;
    writeFile(repo.root, "README.md", "init");
    commitAll(repo.root, "init");
    checkout(repo.root, "feature/good-doc");
    writeFile(repo.root, "docs/20260101_120000_[PLAN]_feature.md", "stuff");
    commitAll(repo.root, "add doc");
    const result = await runContributeLint({ cwd: repo.root, baseBranch: "main" });
    expect(findingCodes(result)).not.toContain(8);
  });
});

describe("runContributeLint — check 9 skill index barrel", () => {
  it("flags new skill template without index.ts", async () => {
    if (repo === null) return;
    writeFile(repo.root, "README.md", "init");
    commitAll(repo.root, "init");
    checkout(repo.root, "feature/no-barrel");
    writeFile(
      repo.root,
      "src/templates/skills/lone/template.ts",
      "export const template = `---\nname: lone\nversion: 1\n---\nbody\n`;\n",
    );
    writeFile(repo.root, "src/templates/skills/lone/evals/evals.json", '{"cases":[]}');
    commitAll(repo.root, "skill without barrel");
    const result = await runContributeLint({ cwd: repo.root, baseBranch: "main" });
    expect(findingCodes(result)).toContain(9);
  });
});

describe("runContributeLint — exit code + errors mapping", () => {
  it("exit code is non-zero when any error-level finding exists", async () => {
    if (repo === null) return;
    writeFile(repo.root, "README.md", "init");
    commitAll(repo.root, "init");
    checkout(repo.root, "feature/has-error");
    writeFile(repo.root, ".claude/rules/x.md", "edit");
    commitAll(repo.root, "edit");
    const result = await runContributeLint({ cwd: repo.root, baseBranch: "main" });
    expect(result.success).toBe(false);
    expect(result.exitCode).not.toBe(0);
    expect(result.errors).toBeDefined();
    expect(result.errors?.[0]?.code).toMatch(/^LINT_CHECK_\d+$/);
  });
});
