import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@clack/prompts", () => ({
  intro: vi.fn(),
  outro: vi.fn(),
  cancel: vi.fn(),
  multiselect: vi.fn(),
  select: vi.fn(),
  text: vi.fn(),
  confirm: vi.fn(),
  isCancel: vi.fn().mockReturnValue(false),
  log: {
    info: vi.fn(),
    warn: vi.fn(),
    step: vi.fn(),
  },
}));

vi.mock("../../../src/core/output/formatter.js", () => ({
  formatHuman: vi.fn().mockReturnValue("formatted output"),
}));

vi.mock("../../../src/cli/shared.js", () => ({
  regenerateConfigs: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../../src/cli/init.js", () => ({
  initHandler: vi.fn().mockResolvedValue({ exitCode: 0 }),
}));

vi.mock("../../../src/cli/add-wizard.js", () => ({
  selectArtifactType: vi.fn(),
  runAddWizard: vi.fn(),
}));

vi.mock("../../../src/cli/add.js", () => ({
  addRuleHandler: vi.fn().mockResolvedValue({ exitCode: 0 }),
  addSkillHandler: vi.fn().mockResolvedValue({ exitCode: 0 }),
  addAgentHandler: vi.fn().mockResolvedValue({ exitCode: 0 }),
  addCommandHandler: vi.fn().mockResolvedValue({ exitCode: 0 }),
  addBrandHandler: vi.fn().mockResolvedValue({ exitCode: 0 }),
}));

vi.mock("../../../src/cli/generate.js", () => ({
  generateHandler: vi.fn().mockResolvedValue({ exitCode: 0 }),
}));

vi.mock("../../../src/cli/doctor.js", () => ({
  doctorHandler: vi.fn().mockResolvedValue({ exitCode: 0 }),
}));

vi.mock("../../../src/cli/clean.js", () => ({
  cleanHandler: vi.fn().mockResolvedValue({ exitCode: 0 }),
}));

vi.mock("../../../src/cli/update.js", () => ({
  updateHandler: vi.fn().mockResolvedValue({ exitCode: 0 }),
}));

vi.mock("../../../src/cli/verify.js", () => ({
  verifyHandler: vi.fn().mockResolvedValue({ exitCode: 0 }),
}));

vi.mock("../../../src/cli/compliance.js", () => ({
  complianceHandler: vi.fn().mockResolvedValue({ exitCode: 0 }),
}));

vi.mock("../../../src/cli/revert.js", () => ({
  revertHandler: vi.fn().mockResolvedValue({ exitCode: 0 }),
}));

vi.mock("../../../src/cli/contribute.js", () => ({
  contributeHandler: vi.fn().mockResolvedValue({ exitCode: 0 }),
}));

vi.mock("../../../src/cli/skill-export-wizard.js", () => ({
  runSkillExportWizard: vi.fn(),
}));

vi.mock("../../../src/cli/skill.js", () => ({
  skillExportHandler: vi.fn().mockResolvedValue({ exitCode: 0 }),
}));

vi.mock("../../../src/cli/preset-handlers.js", () => ({
  presetListEnhancedHandler: vi.fn().mockResolvedValue({ exitCode: 0 }),
  presetExportHandler: vi.fn().mockResolvedValue({ exitCode: 0 }),
  presetRemoveHandler: vi.fn().mockResolvedValue({ exitCode: 0 }),
  presetEditHandler: vi.fn().mockResolvedValue({ exitCode: 0 }),
  presetInstallUnifiedHandler: vi.fn().mockResolvedValue({ exitCode: 0 }),
}));

vi.mock("../../../src/cli/preset-wizard.js", () => ({
  runPresetWizard: vi.fn().mockResolvedValue(null),
}));

vi.mock("../../../src/core/generator/adapter-registry.js", () => ({
  getAllAdapters: vi.fn().mockReturnValue([{ id: "claude-code" }]),
}));

vi.mock("../../../src/adapters/index.js", () => ({
  registerAllAdapters: vi.fn(),
}));

import * as p from "@clack/prompts";
import {
  isCancelled,
  handleInit,
  handleAdd,
  handlePresetMenu,
  showCliOnly,
} from "#src/cli/hub-handlers.js";
import { selectArtifactType, runAddWizard } from "#src/cli/add-wizard.js";
import { PROJECT_CLI } from "#src/constants.js";

describe("hub-handlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(p.isCancel).mockReturnValue(false);
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  });

  describe("isCancelled", () => {
    it("returns true for cancel symbols", () => {
      vi.mocked(p.isCancel).mockReturnValueOnce(true);
      expect(isCancelled(Symbol("cancel"))).toBe(true);
    });

    it("returns false for normal values", () => {
      vi.mocked(p.isCancel).mockReturnValueOnce(false);
      expect(isCancelled("value")).toBe(false);
    });
  });

  describe("showCliOnly", () => {
    it("displays CLI usage information", () => {
      showCliOnly("watch", `${PROJECT_CLI} watch`);
      expect(p.log.info).toHaveBeenCalledTimes(3);
    });
  });

  describe("handleInit", () => {
    it("returns when cancelled", async () => {
      vi.mocked(p.confirm).mockResolvedValueOnce(Symbol("cancel") as never);
      vi.mocked(p.isCancel).mockReturnValueOnce(true);

      await handleInit("/tmp/test");
      expect(process.stdout.write).not.toHaveBeenCalled();
    });

    it("runs init handler with force option", async () => {
      vi.mocked(p.confirm).mockResolvedValueOnce(true as never);

      await handleInit("/tmp/test");
      expect(process.stdout.write).toHaveBeenCalled();
    });
  });

  describe("handleAdd", () => {
    it("returns when artifact type selection is cancelled", async () => {
      vi.mocked(selectArtifactType).mockResolvedValueOnce(null);

      await handleAdd("/tmp/test");
      expect(runAddWizard).not.toHaveBeenCalled();
    });

    it("returns when wizard is cancelled", async () => {
      vi.mocked(selectArtifactType).mockResolvedValueOnce("rule");
      vi.mocked(runAddWizard).mockResolvedValueOnce(null);

      await handleAdd("/tmp/test");
      expect(p.outro).not.toHaveBeenCalled();
    });
  });

  describe("handlePresetMenu", () => {
    it("returns when Back is selected", async () => {
      vi.mocked(p.select).mockResolvedValueOnce("_back" as never);

      await handlePresetMenu("/tmp/test");
    });

    it("returns when cancelled", async () => {
      vi.mocked(p.select).mockResolvedValueOnce(Symbol("cancel") as never);
      vi.mocked(p.isCancel).mockReturnValueOnce(true);

      await handlePresetMenu("/tmp/test");
    });

    it("loops back to menu after sub-action completes", async () => {
      // First iteration: select "create", which runs and returns
      vi.mocked(p.select)
        .mockResolvedValueOnce("create" as never)
        // Second iteration: select "_back" to exit
        .mockResolvedValueOnce("_back" as never);

      await handlePresetMenu("/tmp/test");
      // p.select was called twice (once for create, once for back)
      expect(p.select).toHaveBeenCalledTimes(2);
    });
  });
});
