/**
 * ISSUE-044 rewrite — exercises skill handlers against real fs.
 *
 * Previously the file mocked `core/skill/skill-export`, `core/skill/
 * feedback-collector`, `core/skill/skill-stats`, `cli/skill-export-wizard`,
 * `cli/skill-evolve-handler`, `cli/shared`, `utils/paths`, and the
 * `Logger`. The tests asserted that the handlers wired up to those mocks —
 * they never verified the read/write semantics that downstream agents
 * actually rely on (e.g. the failure modes documented for `readAllFeedback`
 * are NOT failures: it returns `ok([])` when the directory is missing, so
 * the old "feedback read fails" test was exercising dead code).
 *
 * The rewrite uses a real `.codi/feedback/` directory per test, writes real
 * `*.json` feedback entries that pass the project schema, and runs the
 * handlers under test against them. All `vi.mock("#src/...")` calls are
 * removed.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { Command } from "commander";
import {
  skillExportHandler,
  skillFeedbackHandler,
  skillStatsHandler,
  registerSkillCommand,
} from "#src/cli/skill.js";
import { EXIT_CODES } from "#src/core/output/exit-codes.js";
import { FEEDBACK_DIR } from "#src/constants.js";

interface RawFeedbackEntry {
  id: string;
  skillName: string;
  timestamp: string;
  agent: string;
  taskSummary: string;
  outcome: "success" | "failure" | "partial";
  issues: unknown[];
  suggestions: string[];
}

let _idCounter = 0;
function uuid(): string {
  _idCounter++;
  // RFC 4122-shaped deterministic id good enough for z.string().uuid()
  const hex = _idCounter.toString(16).padStart(12, "0");
  return `00000000-0000-4000-8000-${hex}`;
}

function makeFeedbackEntry(skillName: string, suffix: string): RawFeedbackEntry {
  return {
    id: uuid(),
    skillName,
    timestamp: new Date().toISOString(),
    agent: "claude-code",
    taskSummary: `task-${suffix}`,
    outcome: "success",
    issues: [],
    suggestions: [],
  };
}

/** Write an in-repo feedback entry under <root>/.codi/feedback/<file>.json */
function writeEntry(configDir: string, fileName: string, entry: RawFeedbackEntry): void {
  writeFileSync(path.join(configDir, FEEDBACK_DIR, fileName), JSON.stringify(entry));
}

describe("skillExportHandler", () => {
  let tmpRoot: string;

  beforeEach(() => {
    tmpRoot = mkdtempSync(path.join(tmpdir(), "codi-skill-export-"));
  });

  afterEach(() => {
    rmSync(tmpRoot, { recursive: true, force: true });
  });

  it("rejects unsupported export format", async () => {
    const result = await skillExportHandler(tmpRoot, "my-skill", "invalid-fmt", tmpRoot);
    expect(result.success).toBe(false);
    expect(result.exitCode).toBe(EXIT_CODES.GENERAL_ERROR);
    expect(result.errors[0]!.message).toContain("Unsupported format");
  });

  it("returns failure when the skill does not exist on disk", async () => {
    const result = await skillExportHandler(tmpRoot, "missing-skill", "standard", tmpRoot);
    expect(result.success).toBe(false);
    expect(result.exitCode).toBe(EXIT_CODES.GENERAL_ERROR);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});

describe("skillFeedbackHandler", () => {
  let tmpRoot: string;
  let configDir: string;

  beforeEach(() => {
    tmpRoot = mkdtempSync(path.join(tmpdir(), "codi-skill-fb-"));
    configDir = path.join(tmpRoot, ".codi");
    mkdirSync(path.join(configDir, FEEDBACK_DIR), { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpRoot, { recursive: true, force: true });
  });

  it("returns an empty result when the feedback dir is empty (NOT a failure)", async () => {
    // readAllFeedback returns ok([]) when the dir is missing or empty —
    // there is no real failure path to test for this handler.
    const result = await skillFeedbackHandler(tmpRoot);
    expect(result.success).toBe(true);
    expect(result.data.entries).toHaveLength(0);
  });

  it("returns all feedback entries from disk", async () => {
    writeEntry(configDir, "001.json", makeFeedbackEntry("a", "1"));
    writeEntry(configDir, "002.json", makeFeedbackEntry("b", "2"));
    const result = await skillFeedbackHandler(tmpRoot);
    expect(result.success).toBe(true);
    expect(result.data.entries).toHaveLength(2);
  });

  it("filters feedback entries by skill name", async () => {
    writeEntry(configDir, "001.json", makeFeedbackEntry("target", "1"));
    writeEntry(configDir, "002.json", makeFeedbackEntry("other", "2"));
    const result = await skillFeedbackHandler(tmpRoot, "target");
    expect(result.success).toBe(true);
    expect(result.data.skillName).toBe("target");
    expect(result.data.entries).toHaveLength(1);
  });

  it("applies the limit when more entries exist than asked for", async () => {
    for (let i = 0; i < 10; i++) {
      writeEntry(configDir, `${String(i).padStart(3, "0")}.json`, makeFeedbackEntry("s", `${i}`));
    }
    const result = await skillFeedbackHandler(tmpRoot, undefined, 3);
    expect(result.success).toBe(true);
    expect(result.data.entries).toHaveLength(3);
  });
});

describe("skillStatsHandler", () => {
  let tmpRoot: string;
  let configDir: string;

  beforeEach(() => {
    tmpRoot = mkdtempSync(path.join(tmpdir(), "codi-skill-stats-"));
    configDir = path.join(tmpRoot, ".codi");
    mkdirSync(path.join(configDir, FEEDBACK_DIR), { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpRoot, { recursive: true, force: true });
  });

  it("returns stats for a specific skill with feedback present", async () => {
    writeEntry(configDir, "001.json", makeFeedbackEntry("target", "1"));
    writeEntry(configDir, "002.json", makeFeedbackEntry("other", "2"));
    const result = await skillStatsHandler(tmpRoot, "target");
    expect(result.success).toBe(true);
    expect(result.data.skillName).toBe("target");
  });

  it("handles a specific skill with no feedback gracefully", async () => {
    const result = await skillStatsHandler(tmpRoot, "no-such-skill");
    expect(result.success).toBe(true);
    expect(result.data.skillName).toBe("no-such-skill");
  });

  it("returns aggregated stats across all skills when name omitted", async () => {
    writeEntry(configDir, "001.json", makeFeedbackEntry("alpha", "1"));
    const result = await skillStatsHandler(tmpRoot);
    expect(result.success).toBe(true);
    expect(result.data.skillName).toBeUndefined();
  });

  it("returns success on an empty feedback set", async () => {
    const result = await skillStatsHandler(tmpRoot);
    expect(result.success).toBe(true);
  });
});

describe("registerSkillCommand", () => {
  it("registers the skill command with all subcommands", () => {
    const program = new Command();
    registerSkillCommand(program);
    const skillCmd = program.commands.find((c) => c.name() === "skill");
    expect(skillCmd).toBeDefined();
    expect(skillCmd!.description()).toBe("Manage skills");
    const subNames = skillCmd!.commands.map((c) => c.name());
    expect(subNames).toEqual(
      expect.arrayContaining(["export", "feedback", "stats", "evolve", "versions"]),
    );
  });
});
