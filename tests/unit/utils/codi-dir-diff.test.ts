/**
 * ISSUE-088 — collectCodiDirConflicts walker contract.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { collectCodiDirConflicts } from "#src/utils/codi-dir-diff.js";

let localDir: string;
let incomingDir: string;
let root: string;

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "codi-dir-diff-"));
  localDir = path.join(root, "local");
  incomingDir = path.join(root, "incoming");
  for (const sub of ["rules", "skills", "agents"]) {
    await fs.mkdir(path.join(localDir, sub), { recursive: true });
    await fs.mkdir(path.join(incomingDir, sub), { recursive: true });
  }
});

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

describe("collectCodiDirConflicts", () => {
  it("returns no entries when both trees are identical", async () => {
    await fs.writeFile(path.join(localDir, "rules", "same.md"), "x", "utf-8");
    await fs.writeFile(path.join(incomingDir, "rules", "same.md"), "x", "utf-8");
    const out = await collectCodiDirConflicts(localDir, incomingDir);
    expect(out).toEqual([]);
  });

  it("emits one entry per file that differs in both trees", async () => {
    await fs.writeFile(path.join(localDir, "rules", "diff.md"), "old", "utf-8");
    await fs.writeFile(path.join(incomingDir, "rules", "diff.md"), "new", "utf-8");
    const out = await collectCodiDirConflicts(localDir, incomingDir);
    expect(out).toHaveLength(1);
    expect(out[0]!.label).toBe("rules/diff.md");
    expect(out[0]!.currentContent).toBe("old");
    expect(out[0]!.incomingContent).toBe("new");
  });

  it("emits entries for files only in incoming (currentContent='')", async () => {
    await fs.writeFile(path.join(incomingDir, "skills", "only-incoming.md"), "fresh", "utf-8");
    const out = await collectCodiDirConflicts(localDir, incomingDir);
    expect(out).toHaveLength(1);
    expect(out[0]!.label).toBe("skills/only-incoming.md");
    expect(out[0]!.currentContent).toBe("");
    expect(out[0]!.incomingContent).toBe("fresh");
  });

  it("ignores files outside the scanned subdirs", async () => {
    await fs.writeFile(path.join(incomingDir, "README.md"), "ignore me", "utf-8");
    const out = await collectCodiDirConflicts(localDir, incomingDir);
    expect(out).toEqual([]);
  });

  it("recurses into nested subdirectories (e.g. skills/<name>/references)", async () => {
    const nestedLocal = path.join(localDir, "skills", "my-skill", "references");
    const nestedIncoming = path.join(incomingDir, "skills", "my-skill", "references");
    await fs.mkdir(nestedLocal, { recursive: true });
    await fs.mkdir(nestedIncoming, { recursive: true });
    await fs.writeFile(path.join(nestedLocal, "phase-a.md"), "x", "utf-8");
    await fs.writeFile(path.join(nestedIncoming, "phase-a.md"), "y", "utf-8");
    const out = await collectCodiDirConflicts(localDir, incomingDir);
    expect(out.some((e) => e.label.endsWith("phase-a.md"))).toBe(true);
  });

  it("tolerates missing subdirs (readdir EACCES/ENOENT path)", async () => {
    // Remove mcp-servers and workflows from both sides so walk hits the catch
    // branch when listFilesUnder calls fs.readdir on a non-existent dir.
    const sparseLocal = path.join(root, "sparse-local");
    const sparseIncoming = path.join(root, "sparse-incoming");
    await fs.mkdir(path.join(sparseLocal, "rules"), { recursive: true });
    await fs.mkdir(path.join(sparseIncoming, "rules"), { recursive: true });
    await fs.writeFile(path.join(sparseLocal, "rules", "r.md"), "a", "utf-8");
    await fs.writeFile(path.join(sparseIncoming, "rules", "r.md"), "b", "utf-8");
    const out = await collectCodiDirConflicts(sparseLocal, sparseIncoming);
    expect(out).toHaveLength(1);
    expect(out[0]!.label).toBe("rules/r.md");
  });
});
