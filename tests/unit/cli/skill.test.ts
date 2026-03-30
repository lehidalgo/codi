import { describe, it, expect, vi, beforeEach } from "vitest";
import { Command } from "commander";
import {
  skillExportHandler,
  skillFeedbackHandler,
  skillStatsHandler,
  registerSkillCommand,
} from "#src/cli/skill.js";
import { EXIT_CODES } from "#src/core/output/exit-codes.js";

vi.mock("#src/utils/paths.js", () => ({
  resolveProjectDir: vi.fn((root: string) => `${root}/.codi`),
}));

vi.mock("#src/core/output/logger.js", () => {
  const instance = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  };
  return { Logger: { getInstance: () => instance, init: vi.fn() } };
});

vi.mock("#src/core/skill/skill-export.js", () => ({
  exportSkill: vi.fn(),
  EXPORT_FORMATS: ["standard", "claude-plugin", "codex-plugin"],
}));

vi.mock("#src/core/skill/feedback-collector.js", () => ({
  readAllFeedback: vi.fn(),
  readFeedbackForSkill: vi.fn(),
}));

vi.mock("#src/core/skill/skill-stats.js", () => ({
  aggregateAllStats: vi.fn(),
  aggregateStats: vi.fn(),
  formatStatsTable: vi.fn().mockReturnValue("table"),
  formatDetailedStats: vi.fn().mockReturnValue("details"),
}));

vi.mock("#src/cli/skill-export-wizard.js", () => ({
  runSkillExportWizard: vi.fn(),
}));

vi.mock("#src/cli/skill-evolve-handler.js", () => ({
  skillEvolveHandler: vi.fn(),
  skillVersionsHandler: vi.fn(),
}));

vi.mock("#src/cli/shared.js", () => ({
  initFromOptions: vi.fn(),
  handleOutput: vi.fn(),
}));

import { exportSkill } from "#src/core/skill/skill-export.js";
import {
  readAllFeedback,
  readFeedbackForSkill,
} from "#src/core/skill/feedback-collector.js";
import {
  aggregateAllStats,
  aggregateStats,
} from "#src/core/skill/skill-stats.js";

const mockExportSkill = vi.mocked(exportSkill);
const mockReadAllFeedback = vi.mocked(readAllFeedback);
const mockReadFeedbackForSkill = vi.mocked(readFeedbackForSkill);
const mockAggregateAllStats = vi.mocked(aggregateAllStats);
const mockAggregateStats = vi.mocked(aggregateStats);

describe("skillExportHandler", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects unsupported export format", async () => {
    const result = await skillExportHandler(
      "/tmp",
      "my-skill",
      "invalid-fmt",
      ".",
    );

    expect(result.success).toBe(false);
    expect(result.exitCode).toBe(EXIT_CODES.GENERAL_ERROR);
    expect(result.errors[0]!.message).toContain("Unsupported format");
    expect(mockExportSkill).not.toHaveBeenCalled();
  });

  it("returns failure when exportSkill fails", async () => {
    mockExportSkill.mockResolvedValue({
      ok: false,
      errors: [
        {
          code: "E_NOT_FOUND",
          message: "skill not found",
          hint: "",
          severity: "error",
          context: {},
        },
      ],
    });

    const result = await skillExportHandler("/tmp", "missing", "standard", ".");

    expect(result.success).toBe(false);
    expect(result.exitCode).toBe(EXIT_CODES.GENERAL_ERROR);
    expect(result.errors).toHaveLength(1);
  });

  it("returns success with output path on successful export", async () => {
    mockExportSkill.mockResolvedValue({
      ok: true,
      data: { outputPath: "/tmp/out/my-skill", sizeBytes: 2048 },
    });

    const result = await skillExportHandler(
      "/tmp",
      "my-skill",
      "standard",
      "/tmp/out",
    );

    expect(result.success).toBe(true);
    expect(result.exitCode).toBe(EXIT_CODES.SUCCESS);
    expect(result.data.outputPath).toBe("/tmp/out/my-skill");
    expect(result.data.format).toBe("standard");
  });

  it("handles export with zero sizeBytes", async () => {
    mockExportSkill.mockResolvedValue({
      ok: true,
      data: { outputPath: "/tmp/out/skill", sizeBytes: 0 },
    });

    const result = await skillExportHandler("/tmp", "skill", "standard", ".");

    expect(result.success).toBe(true);
  });
});

describe("skillFeedbackHandler", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns failure when feedback read fails", async () => {
    mockReadAllFeedback.mockResolvedValue({
      ok: false,
      errors: [
        {
          code: "E_READ",
          message: "cannot read",
          hint: "",
          severity: "error",
          context: {},
        },
      ],
    });

    const result = await skillFeedbackHandler("/tmp");

    expect(result.success).toBe(false);
    expect(result.exitCode).toBe(EXIT_CODES.GENERAL_ERROR);
  });

  it("returns all feedback entries", async () => {
    const entries = [
      { skillName: "a", rating: 5 },
      { skillName: "b", rating: 3 },
    ];
    mockReadAllFeedback.mockResolvedValue({ ok: true, data: entries });

    const result = await skillFeedbackHandler("/tmp");

    expect(result.success).toBe(true);
    expect(result.data.entries).toHaveLength(2);
    expect(mockReadAllFeedback).toHaveBeenCalled();
  });

  it("filters feedback by skill name", async () => {
    const entries = [{ skillName: "target", rating: 4 }];
    mockReadFeedbackForSkill.mockResolvedValue({ ok: true, data: entries });

    const result = await skillFeedbackHandler("/tmp", "target");

    expect(result.success).toBe(true);
    expect(result.data.skillName).toBe("target");
    expect(mockReadFeedbackForSkill).toHaveBeenCalledWith(
      "/tmp/.codi",
      "target",
    );
  });

  it("applies limit to feedback entries", async () => {
    const entries = Array.from({ length: 10 }, (_, i) => ({
      skillName: "s",
      rating: i,
    }));
    mockReadAllFeedback.mockResolvedValue({ ok: true, data: entries });

    const result = await skillFeedbackHandler("/tmp", undefined, 3);

    expect(result.success).toBe(true);
    expect(result.data.entries).toHaveLength(3);
  });
});

describe("skillStatsHandler", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns failure when feedback read fails", async () => {
    mockReadAllFeedback.mockResolvedValue({
      ok: false,
      errors: [
        {
          code: "E_READ",
          message: "no data",
          hint: "",
          severity: "error",
          context: {},
        },
      ],
    });

    const result = await skillStatsHandler("/tmp");

    expect(result.success).toBe(false);
    expect(result.exitCode).toBe(EXIT_CODES.GENERAL_ERROR);
  });

  it("returns stats for a specific skill", async () => {
    const entries = [
      { skillName: "target", rating: 5 },
      { skillName: "other", rating: 3 },
    ];
    mockReadAllFeedback.mockResolvedValue({ ok: true, data: entries });
    mockAggregateStats.mockReturnValue({ count: 1, avgRating: 5 });

    const result = await skillStatsHandler("/tmp", "target");

    expect(result.success).toBe(true);
    expect(result.data.skillName).toBe("target");
    expect(mockAggregateStats).toHaveBeenCalled();
  });

  it("handles specific skill with no feedback", async () => {
    mockReadAllFeedback.mockResolvedValue({ ok: true, data: [] });
    mockAggregateStats.mockReturnValue({ count: 0, avgRating: 0 });

    const result = await skillStatsHandler("/tmp", "empty-skill");

    expect(result.success).toBe(true);
    expect(result.data.skillName).toBe("empty-skill");
  });

  it("returns all stats when no skill specified", async () => {
    const entries = [{ skillName: "a", rating: 4 }];
    mockReadAllFeedback.mockResolvedValue({ ok: true, data: entries });
    mockAggregateAllStats.mockReturnValue([{ name: "a", count: 1 }]);

    const result = await skillStatsHandler("/tmp");

    expect(result.success).toBe(true);
    expect(result.data.skillName).toBeUndefined();
    expect(mockAggregateAllStats).toHaveBeenCalled();
  });

  it("handles empty stats gracefully", async () => {
    mockReadAllFeedback.mockResolvedValue({ ok: true, data: [] });
    mockAggregateAllStats.mockReturnValue([]);

    const result = await skillStatsHandler("/tmp");

    expect(result.success).toBe(true);
  });
});

describe("registerSkillCommand", () => {
  it("registers skill command with all subcommands", () => {
    const program = new Command();
    registerSkillCommand(program);

    const skillCmd = program.commands.find((c) => c.name() === "skill");
    expect(skillCmd).toBeDefined();
    expect(skillCmd!.description()).toBe("Manage skills");

    const subNames = skillCmd!.commands.map((c) => c.name());
    expect(subNames).toContain("export");
    expect(subNames).toContain("feedback");
    expect(subNames).toContain("stats");
    expect(subNames).toContain("evolve");
    expect(subNames).toContain("versions");
  });
});
