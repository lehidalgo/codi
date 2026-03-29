import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import {
  saveVersion,
  listVersions,
  restoreVersion,
  diffVersions,
} from "../../../../src/core/skill/version-manager.js";

let tmpDir: string;
let skillDir: string;

const SKILL_CONTENT_V1 = "---\nname: commit\n---\n\n# commit\n\nStep 1: Do A\n";
const SKILL_CONTENT_V2 =
  "---\nname: commit\n---\n\n# commit\n\nStep 1: Do A\nStep 2: Do B\n";

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "codi-version-test-"));
  skillDir = path.join(tmpDir, "commit");
  await fs.mkdir(skillDir, { recursive: true });
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe("saveVersion", () => {
  it("saves first version as v1", async () => {
    await fs.writeFile(path.join(skillDir, "SKILL.md"), SKILL_CONTENT_V1);

    const result = await saveVersion(skillDir);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.version).toBe(1);
      const content = await fs.readFile(result.data.path, "utf-8");
      expect(content).toBe(SKILL_CONTENT_V1);
    }
  });

  it("increments version number", async () => {
    await fs.writeFile(path.join(skillDir, "SKILL.md"), SKILL_CONTENT_V1);

    await saveVersion(skillDir);
    await fs.writeFile(path.join(skillDir, "SKILL.md"), SKILL_CONTENT_V2);
    const result = await saveVersion(skillDir);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.version).toBe(2);
    }
  });

  it("returns error when SKILL.md does not exist", async () => {
    const result = await saveVersion(skillDir);
    expect(result.ok).toBe(false);
  });
});

describe("listVersions", () => {
  it("returns empty array when no versions exist", async () => {
    const result = await listVersions(skillDir);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual([]);
    }
  });

  it("lists saved versions in order", async () => {
    await fs.writeFile(path.join(skillDir, "SKILL.md"), SKILL_CONTENT_V1);
    await saveVersion(skillDir);
    await fs.writeFile(path.join(skillDir, "SKILL.md"), SKILL_CONTENT_V2);
    await saveVersion(skillDir);

    const result = await listVersions(skillDir);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveLength(2);
      expect(result.data[0]!.version).toBe(1);
      expect(result.data[1]!.version).toBe(2);
      expect(result.data[0]!.sizeBytes).toBeGreaterThan(0);
      expect(result.data[0]!.timestamp).toBeDefined();
    }
  });
});

describe("restoreVersion", () => {
  it("restores SKILL.md from a saved version", async () => {
    await fs.writeFile(path.join(skillDir, "SKILL.md"), SKILL_CONTENT_V1);
    await saveVersion(skillDir);
    await fs.writeFile(path.join(skillDir, "SKILL.md"), SKILL_CONTENT_V2);
    await saveVersion(skillDir);

    // Restore to v1
    const result = await restoreVersion(skillDir, 1);
    expect(result.ok).toBe(true);

    const restored = await fs.readFile(
      path.join(skillDir, "SKILL.md"),
      "utf-8",
    );
    expect(restored).toBe(SKILL_CONTENT_V1);
  });

  it("returns error for non-existent version", async () => {
    const result = await restoreVersion(skillDir, 99);
    expect(result.ok).toBe(false);
  });
});

describe("diffVersions", () => {
  it("shows differences between two versions", async () => {
    await fs.writeFile(path.join(skillDir, "SKILL.md"), SKILL_CONTENT_V1);
    await saveVersion(skillDir);
    await fs.writeFile(path.join(skillDir, "SKILL.md"), SKILL_CONTENT_V2);
    await saveVersion(skillDir);

    const result = await diffVersions(skillDir, 1, 2);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toContain("--- v1.SKILL.md");
      expect(result.data).toContain("+++ v2.SKILL.md");
      expect(result.data).toContain("+Step 2: Do B");
    }
  });

  it("returns 'No differences' for identical versions", async () => {
    await fs.writeFile(path.join(skillDir, "SKILL.md"), SKILL_CONTENT_V1);
    await saveVersion(skillDir);
    await saveVersion(skillDir);

    const result = await diffVersions(skillDir, 1, 2);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toBe("No differences found.");
    }
  });

  it("returns error for non-existent version", async () => {
    await fs.writeFile(path.join(skillDir, "SKILL.md"), SKILL_CONTENT_V1);
    await saveVersion(skillDir);

    const result = await diffVersions(skillDir, 1, 99);
    expect(result.ok).toBe(false);
  });

  it("produces multiple hunks for distant changes", async () => {
    // Create v1 with 20 lines
    const lines1 = Array.from({ length: 20 }, (_, i) => `Line ${i + 1}`);
    await fs.writeFile(path.join(skillDir, "SKILL.md"), lines1.join("\n"));
    await saveVersion(skillDir);

    // Create v2 with changes at line 2 and line 18 (separated by >6 lines)
    const lines2 = [...lines1];
    lines2[1] = "Line 2 CHANGED";
    lines2[17] = "Line 18 CHANGED";
    await fs.writeFile(path.join(skillDir, "SKILL.md"), lines2.join("\n"));
    await saveVersion(skillDir);

    const result = await diffVersions(skillDir, 1, 2);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toContain("-Line 2");
      expect(result.data).toContain("+Line 2 CHANGED");
      expect(result.data).toContain("-Line 18");
      expect(result.data).toContain("+Line 18 CHANGED");
      // Should have at least 2 @@ hunk headers
      const hunkCount = (result.data.match(/^@@/gm) ?? []).length;
      expect(hunkCount).toBeGreaterThanOrEqual(2);
    }
  });
});
