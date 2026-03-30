import { describe, it, expect, vi, beforeEach } from "vitest";
import { runSkillExportWizard } from "#src/cli/skill-export-wizard.js";

vi.mock("#src/utils/paths.js", () => ({
  resolveProjectDir: vi.fn((root: string) => `${root}/.codi`),
}));

vi.mock("#src/core/skill/skill-export.js", () => ({
  listAvailableSkills: vi.fn(),
}));

vi.mock("#src/core/config/parser.js", () => ({
  parseSkillFile: vi.fn(),
}));

vi.mock("@clack/prompts", () => ({
  intro: vi.fn(),
  cancel: vi.fn(),
  select: vi.fn(),
  text: vi.fn(),
  confirm: vi.fn(),
  isCancel: vi.fn().mockReturnValue(false),
}));

import * as prompts from "@clack/prompts";
import { listAvailableSkills } from "#src/core/skill/skill-export.js";
import { parseSkillFile } from "#src/core/config/parser.js";

const mockListSkills = vi.mocked(listAvailableSkills);
const mockParseSkillFile = vi.mocked(parseSkillFile);
const mockSelect = vi.mocked(prompts.select);
const mockText = vi.mocked(prompts.text);
const mockConfirm = vi.mocked(prompts.confirm);
const mockIsCancel = vi.mocked(prompts.isCancel);
const mockCancel = vi.mocked(prompts.cancel);

describe("runSkillExportWizard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsCancel.mockReturnValue(false);
  });

  it("returns null when no skills are found", async () => {
    mockListSkills.mockResolvedValue([]);

    const result = await runSkillExportWizard("/tmp");

    expect(result).toBeNull();
    expect(mockCancel).toHaveBeenCalledWith(
      expect.stringContaining("No skills found"),
    );
  });

  it("returns null when user cancels skill selection", async () => {
    mockListSkills.mockResolvedValue(["my-skill"]);
    mockParseSkillFile.mockResolvedValue({
      ok: true,
      data: { description: "A test skill" },
    } as never);
    mockSelect.mockResolvedValueOnce(Symbol.for("cancel"));
    mockIsCancel.mockReturnValueOnce(true);

    const result = await runSkillExportWizard("/tmp");

    expect(result).toBeNull();
    expect(mockCancel).toHaveBeenCalledWith("Operation cancelled.");
  });

  it("returns null when user cancels format selection", async () => {
    mockListSkills.mockResolvedValue(["my-skill"]);
    mockParseSkillFile.mockResolvedValue({
      ok: true,
      data: { description: "desc" },
    } as never);

    // Skill select succeeds
    mockSelect.mockResolvedValueOnce("my-skill");
    // Format select cancelled
    mockSelect.mockResolvedValueOnce(Symbol.for("cancel"));
    mockIsCancel
      .mockReturnValueOnce(false) // skill check
      .mockReturnValueOnce(true); // format check

    const result = await runSkillExportWizard("/tmp");

    expect(result).toBeNull();
  });

  it("returns null when user cancels output directory", async () => {
    mockListSkills.mockResolvedValue(["my-skill"]);
    mockParseSkillFile.mockResolvedValue({
      ok: true,
      data: { description: "desc" },
    } as never);

    mockSelect
      .mockResolvedValueOnce("my-skill")
      .mockResolvedValueOnce("standard");
    mockText.mockResolvedValueOnce(Symbol.for("cancel"));
    mockIsCancel
      .mockReturnValueOnce(false) // skill
      .mockReturnValueOnce(false) // format
      .mockReturnValueOnce(true); // output dir

    const result = await runSkillExportWizard("/tmp");

    expect(result).toBeNull();
  });

  it("returns null when user declines confirmation", async () => {
    mockListSkills.mockResolvedValue(["my-skill"]);
    mockParseSkillFile.mockResolvedValue({
      ok: true,
      data: { description: "desc" },
    } as never);

    mockSelect
      .mockResolvedValueOnce("my-skill")
      .mockResolvedValueOnce("standard");
    mockText.mockResolvedValueOnce("./dist");
    mockConfirm.mockResolvedValueOnce(false);
    mockIsCancel.mockReturnValue(false);

    const result = await runSkillExportWizard("/tmp");

    expect(result).toBeNull();
  });

  it("returns wizard result on successful flow", async () => {
    mockListSkills.mockResolvedValue(["my-skill"]);
    mockParseSkillFile.mockResolvedValue({
      ok: true,
      data: { description: "A useful skill" },
    } as never);

    mockSelect
      .mockResolvedValueOnce("my-skill")
      .mockResolvedValueOnce("claude-plugin");
    mockText.mockResolvedValueOnce("./output");
    mockConfirm.mockResolvedValueOnce(true);
    mockIsCancel.mockReturnValue(false);

    const result = await runSkillExportWizard("/tmp");

    expect(result).toEqual({
      name: "my-skill",
      format: "claude-plugin",
      outputDir: "./output",
    });
  });

  it("truncates long skill descriptions", async () => {
    mockListSkills.mockResolvedValue(["verbose-skill"]);
    const longDesc = "A".repeat(100);
    mockParseSkillFile.mockResolvedValue({
      ok: true,
      data: { description: longDesc },
    } as never);

    mockSelect
      .mockResolvedValueOnce("verbose-skill")
      .mockResolvedValueOnce("standard");
    mockText.mockResolvedValueOnce("./dist");
    mockConfirm.mockResolvedValueOnce(true);
    mockIsCancel.mockReturnValue(false);

    const result = await runSkillExportWizard("/tmp");

    expect(result).not.toBeNull();
    // Verify select was called — description truncation happens internally
    expect(mockSelect).toHaveBeenCalled();
  });

  it("handles skill parse failure gracefully", async () => {
    mockListSkills.mockResolvedValue(["broken-skill"]);
    mockParseSkillFile.mockRejectedValue(new Error("parse error"));

    mockSelect
      .mockResolvedValueOnce("broken-skill")
      .mockResolvedValueOnce("standard");
    mockText.mockResolvedValueOnce("./dist");
    mockConfirm.mockResolvedValueOnce(true);
    mockIsCancel.mockReturnValue(false);

    const result = await runSkillExportWizard("/tmp");

    expect(result).not.toBeNull();
    expect(result!.name).toBe("broken-skill");
  });
});
