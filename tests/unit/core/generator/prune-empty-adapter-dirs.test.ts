import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { cleanupTmpDir } from "#tests/helpers/fs.js";
import { pruneEmptyAdapterDirs } from "#src/core/generator/prune-empty-adapter-dirs.js";

describe("pruneEmptyAdapterDirs", () => {
  let projectRoot: string;
  beforeEach(async () => {
    projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), "codi-prune-"));
  });
  afterEach(() => cleanupTmpDir(projectRoot));

  it("removes empty .cursor/rules/ then .cursor/ when cursor is unselected", async () => {
    await fs.mkdir(path.join(projectRoot, ".cursor", "rules"), {
      recursive: true,
    });
    await fs.mkdir(path.join(projectRoot, ".cursor", "skills"), {
      recursive: true,
    });
    const removed = await pruneEmptyAdapterDirs(projectRoot, [], ["cursor"]);
    expect(removed).toContain(".cursor/rules");
    expect(removed).toContain(".cursor/skills");
    expect(removed).toContain(".cursor");
    const exists = await fs.stat(path.join(projectRoot, ".cursor")).catch(() => null);
    expect(exists).toBeNull();
  });

  it("leaves .cursor/ alone when a user file sits inside", async () => {
    await fs.mkdir(path.join(projectRoot, ".cursor", "rules"), {
      recursive: true,
    });
    await fs.writeFile(path.join(projectRoot, ".cursor", "notes.md"), "user\n");
    const removed = await pruneEmptyAdapterDirs(projectRoot, [], ["cursor"]);
    expect(removed).toContain(".cursor/rules");
    expect(removed).not.toContain(".cursor");
    const exists = await fs.stat(path.join(projectRoot, ".cursor")).catch(() => null);
    expect(exists).not.toBeNull();
  });

  it("walks parents of deleted file paths", async () => {
    await fs.mkdir(path.join(projectRoot, ".claude", "rules"), {
      recursive: true,
    });
    const removed = await pruneEmptyAdapterDirs(projectRoot, [".claude/rules/foo.md"], []);
    expect(removed).toContain(".claude/rules");
    expect(removed).toContain(".claude");
  });

  it("refuses to remove paths outside projectRoot", async () => {
    const removed = await pruneEmptyAdapterDirs(projectRoot, ["../escape.md"], []);
    expect(removed).toEqual([]);
  });
});
