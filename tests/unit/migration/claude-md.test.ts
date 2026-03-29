import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { importClaudeMd } from "#src/core/migration/claude-md.js";

const FIXTURE_DIR = path.join(
  __dirname,
  "../../fixtures/migration/sample-claude-md",
);
let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "codi-migration-claude-"));
  const src = path.join(FIXTURE_DIR, "CLAUDE.md");
  await fs.copyFile(src, path.join(tmpDir, "CLAUDE.md"));
  await fs.mkdir(path.join(tmpDir, ".codi", "rules"), { recursive: true });
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe("importClaudeMd", () => {
  it("imports sections as rules", async () => {
    const result = await importClaudeMd(tmpDir);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.rules).toHaveLength(3);
    expect(result.data.rules.map((r) => r.name)).toEqual([
      "general",
      "code-quality",
      "testing",
    ]);
  });

  it("keeps nested ### sections under parent ##", async () => {
    const result = await importClaudeMd(tmpDir);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const codeQualityRule = result.data.rules.find(
      (r) => r.name === "code-quality",
    );
    expect(codeQualityRule?.content).toContain("### Naming");
    expect(codeQualityRule?.content).toContain("### Structure");
    expect(codeQualityRule?.content).toContain("descriptive names");
    expect(codeQualityRule?.content).toContain("500 lines");
  });

  it("writes rule files to disk", async () => {
    await importClaudeMd(tmpDir);

    const rulesDir = path.join(tmpDir, ".codi", "rules");
    const files = await fs.readdir(rulesDir);
    expect(files).toContain("general.md");
    expect(files).toContain("code-quality.md");
    expect(files).toContain("testing.md");
  });

  it("generates frontmatter", async () => {
    await importClaudeMd(tmpDir);

    const content = await fs.readFile(
      path.join(tmpDir, ".codi", "rules", "general.md"),
      "utf-8",
    );
    expect(content).toContain("---");
    expect(content).toContain("name: general");
    expect(content).toContain("Imported from CLAUDE.md");
  });

  it("returns error when CLAUDE.md not found", async () => {
    const emptyDir = await fs.mkdtemp(path.join(os.tmpdir(), "codi-empty-"));
    const result = await importClaudeMd(emptyDir);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]!.code).toBe("E_MIGRATION_FAILED");
    }
    await fs.rm(emptyDir, { recursive: true, force: true });
  });

  it("preserves 90%+ of original content", async () => {
    const originalContent = await fs.readFile(
      path.join(tmpDir, "CLAUDE.md"),
      "utf-8",
    );
    const result = await importClaudeMd(tmpDir);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const allRuleContent = result.data.rules.map((r) => r.content).join("\n");
    expect(allRuleContent).toContain("helpful coding assistant");
    expect(allRuleContent).toContain("descriptive names");
    expect(allRuleContent).toContain("TDD");

    const originalLines = originalContent
      .split("\n")
      .filter((l) => l.trim() && !l.startsWith("#"));
    let preserved = 0;
    for (const line of originalLines) {
      if (allRuleContent.includes(line.trim())) {
        preserved++;
      }
    }
    const ratio = preserved / originalLines.length;
    expect(ratio).toBeGreaterThanOrEqual(0.9);
  });
});
