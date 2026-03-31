import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { cleanupTmpDir } from "../../../helpers/fs.js";
import {
  checkDocSync,
  fixDocSync,
} from "../../../../src/core/docs/doc-sync.js";
import { collectStats } from "../../../../src/core/docs/stats-collector.js";

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "doc-sync-"));
});

afterEach(async () => {
  await cleanupTmpDir(tmpDir);
});

describe("collectStats", () => {
  it("returns non-zero counts for all categories", () => {
    const stats = collectStats();
    expect(stats.rules.count).toBeGreaterThan(0);
    expect(stats.skills.count).toBeGreaterThan(0);
    expect(stats.agents.count).toBeGreaterThan(0);
    expect(stats.commands.count).toBeGreaterThan(0);
    expect(stats.flags.count).toBeGreaterThan(0);
    expect(stats.errorCodes).toBeGreaterThan(0);
    expect(stats.cliCommands).toBeGreaterThan(0);
    expect(stats.adapters).toBeGreaterThan(0);
  });

  it("names arrays match counts", () => {
    const stats = collectStats();
    expect(stats.rules.names).toHaveLength(stats.rules.count);
    expect(stats.skills.names).toHaveLength(stats.skills.count);
    expect(stats.agents.names).toHaveLength(stats.agents.count);
    expect(stats.commands.names).toHaveLength(stats.commands.count);
  });
});

describe("checkDocSync", () => {
  it("returns no issues when all counts match", async () => {
    const stats = collectStats();
    await fs.writeFile(
      path.join(tmpDir, "STATUS.md"),
      [
        `| Rule templates | ${stats.rules.count} |`,
        `| Skill templates | ${stats.skills.count} |`,
        `| Agent templates | ${stats.agents.count} |`,
        `| Command templates | ${stats.commands.count} |`,
        `| Error codes | ${stats.errorCodes} |`,
        `| Flags | ${stats.flags.count} |`,
        `| Adapters | ${stats.adapters} |`,
        `| CLI commands | ${stats.cliCommands} |`,
      ].join("\n"),
    );
    const issues = await checkDocSync(tmpDir);
    const fixable = issues.filter((i) => i.fixable);
    expect(fixable).toHaveLength(0);
  });

  it("detects stale rule template count in STATUS.md", async () => {
    await fs.writeFile(
      path.join(tmpDir, "STATUS.md"),
      "| Rule templates | 9 |",
    );
    const issues = await checkDocSync(tmpDir);
    expect(
      issues.some((i) => i.fixable && i.description.includes("Rule templates")),
    ).toBe(true);
  });

  it("detects stale error code count in STATUS.md", async () => {
    await fs.writeFile(path.join(tmpDir, "STATUS.md"), "| Error codes | 5 |");
    const issues = await checkDocSync(tmpDir);
    expect(
      issues.some((i) => i.fixable && i.description.includes("Error codes")),
    ).toBe(true);
  });

  it("detects stale flag count in STATUS.md", async () => {
    await fs.writeFile(path.join(tmpDir, "STATUS.md"), "| Flags | 10 |");
    const issues = await checkDocSync(tmpDir);
    expect(
      issues.some((i) => i.fixable && i.description.includes("Flags")),
    ).toBe(true);
  });

  it("detects stale CLI command count", async () => {
    await fs.writeFile(path.join(tmpDir, "STATUS.md"), "| CLI commands | 5 |");
    const issues = await checkDocSync(tmpDir);
    expect(
      issues.some((i) => i.fixable && i.description.includes("CLI commands")),
    ).toBe(true);
  });

  it("detects stale CONTRIBUTING.md counts", async () => {
    await fs.writeFile(
      path.join(tmpDir, "CONTRIBUTING.md"),
      "    rules/            # 9 rule templates",
    );
    const issues = await checkDocSync(tmpDir);
    expect(issues.some((i) => i.fixable && i.file === "CONTRIBUTING.md")).toBe(
      true,
    );
  });

  it("detects stale inline counts", async () => {
    await fs.writeFile(
      path.join(tmpDir, "STATUS.md"),
      "- 9 rule templates, 5 skill templates, 3 agent templates, 2 command templates",
    );
    const issues = await checkDocSync(tmpDir);
    expect(
      issues.some((i) => i.fixable && i.description.includes("9 rules")),
    ).toBe(true);
  });

  it("detects missing template in writing-rules.md with action prompt", async () => {
    await fs.mkdir(path.join(tmpDir, "docs/guides"), { recursive: true });
    await fs.writeFile(
      path.join(tmpDir, "docs/guides/writing-rules.md"),
      "Available: `security`, `testing`.",
    );
    const issues = await checkDocSync(tmpDir);
    const missing = issues.filter((i) => !i.fixable && i.action);
    expect(missing.length).toBeGreaterThan(0);
    expect(missing[0].action).toContain("Read src/templates/");
    expect(missing[0].action).toContain("detailed description");
  });

  it("detects stale e2e-testing expected counts", async () => {
    await fs.mkdir(path.join(tmpDir, "src/templates/skills"), {
      recursive: true,
    });
    await fs.writeFile(
      path.join(tmpDir, "src/templates/skills/e2e-testing.ts"),
      "Expected: 9 rules, 5 skills, 3 agents, 2 commands.",
    );
    const issues = await checkDocSync(tmpDir);
    expect(
      issues.some((i) => !i.fixable && i.file.includes("e2e-testing")),
    ).toBe(true);
  });

  it("returns no issues when files do not exist", async () => {
    const issues = await checkDocSync(tmpDir);
    expect(issues).toHaveLength(0);
  });
});

describe("fixDocSync", () => {
  it("fixes stale counts in STATUS.md", async () => {
    await fs.writeFile(
      path.join(tmpDir, "STATUS.md"),
      "| Rule templates | 9 |\n| Error codes | 5 |\n| Flags | 10 |\n| CLI commands | 5 |",
    );
    const fixed = await fixDocSync(tmpDir);
    expect(fixed).toContain("STATUS.md");

    const stats = collectStats();
    const content = await fs.readFile(path.join(tmpDir, "STATUS.md"), "utf-8");
    expect(content).toContain(`| Rule templates | ${stats.rules.count} |`);
    expect(content).toContain(`| Error codes | ${stats.errorCodes} |`);
    expect(content).toContain(`| Flags | ${stats.flags.count} |`);
    expect(content).toContain(`| CLI commands | ${stats.cliCommands} |`);
  });

  it("fixes inline count prose", async () => {
    await fs.writeFile(
      path.join(tmpDir, "STATUS.md"),
      "- 9 rule templates, 5 skill templates, 3 agent templates, 2 command templates",
    );
    const fixed = await fixDocSync(tmpDir);
    expect(fixed).toContain("STATUS.md");

    const stats = collectStats();
    const content = await fs.readFile(path.join(tmpDir, "STATUS.md"), "utf-8");
    expect(content).toContain(`${stats.rules.count} rule templates`);
  });

  it("fixes CONTRIBUTING.md comment counts", async () => {
    await fs.writeFile(
      path.join(tmpDir, "CONTRIBUTING.md"),
      "    rules/            # 9 rule templates\n    skills/           # 5 skill templates",
    );
    const fixed = await fixDocSync(tmpDir);
    expect(fixed).toContain("CONTRIBUTING.md");

    const stats = collectStats();
    const content = await fs.readFile(
      path.join(tmpDir, "CONTRIBUTING.md"),
      "utf-8",
    );
    expect(content).toContain(`# ${stats.rules.count} rule templates`);
  });

  it("returns empty when nothing to fix", async () => {
    const stats = collectStats();
    await fs.writeFile(
      path.join(tmpDir, "STATUS.md"),
      `| Rule templates | ${stats.rules.count} |`,
    );
    const fixed = await fixDocSync(tmpDir);
    expect(fixed).toHaveLength(0);
  });
});
