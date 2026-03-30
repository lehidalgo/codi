import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { importAgentsMd } from "#src/core/migration/agents-md.js";
import { PROJECT_NAME, PROJECT_DIR } from "#src/constants.js";

const FIXTURE_DIR = path.join(
  __dirname,
  "../../fixtures/migration/sample-agents-md",
);
let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(
    path.join(os.tmpdir(), `${PROJECT_NAME}-migration-agents-`),
  );
  // Copy fixture AGENTS.md
  const src = path.join(FIXTURE_DIR, "AGENTS.md");
  await fs.copyFile(src, path.join(tmpDir, "AGENTS.md"));
  await fs.mkdir(path.join(tmpDir, PROJECT_DIR, "rules"), { recursive: true });
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe("importAgentsMd", () => {
  it("imports sections as rules", async () => {
    const result = await importAgentsMd(tmpDir);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.rules).toHaveLength(3);
    expect(result.data.rules.map((r) => r.name)).toEqual([
      "code-style",
      "testing",
      "security",
    ]);
  });

  it("preserves original content in rules", async () => {
    const result = await importAgentsMd(tmpDir);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const codeStyleRule = result.data.rules.find(
      (r) => r.name === "code-style",
    );
    expect(codeStyleRule?.content).toContain("camelCase");
  });

  it(`writes rule files to ${PROJECT_DIR}/rules/`, async () => {
    const result = await importAgentsMd(tmpDir);
    expect(result.ok).toBe(true);

    const rulesDir = path.join(tmpDir, PROJECT_DIR, "rules");
    const files = await fs.readdir(rulesDir);
    expect(files).toContain("code-style.md");
    expect(files).toContain("testing.md");
    expect(files).toContain("security.md");
  });

  it("generates frontmatter in rule files", async () => {
    await importAgentsMd(tmpDir);

    const content = await fs.readFile(
      path.join(tmpDir, PROJECT_DIR, "rules", "code-style.md"),
      "utf-8",
    );
    expect(content).toContain("---");
    expect(content).toContain("name: code-style");
    expect(content).toContain("priority: medium");
    expect(content).toContain("alwaysApply: true");
  });

  it("returns error when AGENTS.md not found", async () => {
    const emptyDir = await fs.mkdtemp(
      path.join(os.tmpdir(), `${PROJECT_NAME}-empty-`),
    );
    const result = await importAgentsMd(emptyDir);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]!.code).toBe("E_MIGRATION_FAILED");
    }
    await fs.rm(emptyDir, { recursive: true, force: true });
  });

  it("preserves 90%+ of original content", async () => {
    const originalContent = await fs.readFile(
      path.join(tmpDir, "AGENTS.md"),
      "utf-8",
    );
    const result = await importAgentsMd(tmpDir);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const allRuleContent = result.data.rules.map((r) => r.content).join("\n");
    // Check that key content is preserved
    expect(allRuleContent).toContain("camelCase");
    expect(allRuleContent).toContain("describe/it pattern");
    expect(allRuleContent).toContain("environment variables");

    // Count preserved characters (simple heuristic)
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
