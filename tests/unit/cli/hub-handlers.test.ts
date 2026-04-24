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
    error: vi.fn(),
    step: vi.fn(),
  },
}));

vi.mock("node:fs/promises", () => ({
  default: {
    access: vi.fn().mockRejectedValue(new Error("ENOENT")),
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
  getAllAdapters: vi
    .fn()
    .mockReturnValue([
      { id: "claude-code" },
      { id: "cursor" },
      { id: "codex" },
      { id: "windsurf" },
      { id: "cline" },
      { id: "copilot" },
    ]),
}));

vi.mock("../../../src/core/config/resolver.js", () => ({
  resolveConfig: vi.fn(),
}));

vi.mock("../../../src/adapters/index.js", () => ({
  registerAllAdapters: vi.fn(),
}));

import fs from "node:fs/promises";
import * as p from "@clack/prompts";
import {
  isCancelled,
  handleInit,
  handleAdd,
  handlePresetMenu,
  handleGenerate,
} from "#src/cli/hub-handlers.js";
import { selectArtifactType, runAddWizard } from "#src/cli/add-wizard.js";
import { resolveConfig } from "#src/core/config/resolver.js";
import { generateHandler } from "#src/cli/generate.js";

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

  describe("handleInit", () => {
    it("returns when cancelled on existing project", async () => {
      vi.mocked(fs.access).mockResolvedValueOnce(undefined);
      vi.mocked(p.select).mockResolvedValueOnce(Symbol("cancel") as never);
      vi.mocked(p.isCancel).mockReturnValueOnce(true);

      await handleInit("/tmp/test");
      expect(process.stdout.write).not.toHaveBeenCalled();
    });

    it("runs init handler when no project exists", async () => {
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

  describe("handleGenerate (agent filter)", () => {
    function mockManifestAgents(agents: string[] | undefined) {
      vi.mocked(resolveConfig).mockResolvedValueOnce({
        ok: true,
        data: { manifest: { agents } },
      } as never);
    }

    it("restricts the multiselect to agents declared in the manifest", async () => {
      mockManifestAgents(["claude-code", "cursor"]);
      vi.mocked(p.multiselect).mockResolvedValueOnce(["claude-code", "cursor"] as never);
      vi.mocked(p.select).mockResolvedValueOnce("normal" as never);

      await handleGenerate("/tmp/test");

      const multiselectCall = vi.mocked(p.multiselect).mock.calls[0]?.[0];
      expect(multiselectCall?.options).toHaveLength(2);
      expect(multiselectCall?.options.map((o) => o.value)).toEqual(["claude-code", "cursor"]);
      expect(multiselectCall?.initialValues).toEqual(["claude-code", "cursor"]);
    });

    it("falls back to all adapters and warns when manifest is unreadable", async () => {
      vi.mocked(resolveConfig).mockResolvedValueOnce({
        ok: false,
        errors: [],
      } as never);
      vi.mocked(p.multiselect).mockResolvedValueOnce([] as never);
      vi.mocked(p.select).mockResolvedValueOnce("normal" as never);

      await handleGenerate("/tmp/test");

      expect(p.log.warn).toHaveBeenCalledWith(
        expect.stringContaining("falling back to all registered adapters"),
      );
      const multiselectCall = vi.mocked(p.multiselect).mock.calls[0]?.[0];
      expect(multiselectCall?.options).toHaveLength(6);
    });

    it("errors and returns without prompting when manifest declares zero usable agents", async () => {
      mockManifestAgents([]);

      await handleGenerate("/tmp/test");

      expect(p.log.error).toHaveBeenCalledWith(
        expect.stringContaining("No usable agents configured"),
      );
      expect(p.multiselect).not.toHaveBeenCalled();
      expect(generateHandler).not.toHaveBeenCalled();
    });

    it("treats undefined manifest.agents as 'all detected' (use all adapters)", async () => {
      mockManifestAgents(undefined);
      vi.mocked(p.multiselect).mockResolvedValueOnce([] as never);
      vi.mocked(p.select).mockResolvedValueOnce("normal" as never);

      await handleGenerate("/tmp/test");

      const multiselectCall = vi.mocked(p.multiselect).mock.calls[0]?.[0];
      expect(multiselectCall?.options).toHaveLength(6);
    });

    it("filters unknown adapters from manifest and warns", async () => {
      mockManifestAgents(["claude-code", "made-up-adapter", "cursor"]);
      vi.mocked(p.multiselect).mockResolvedValueOnce([] as never);
      vi.mocked(p.select).mockResolvedValueOnce("normal" as never);

      await handleGenerate("/tmp/test");

      expect(p.log.warn).toHaveBeenCalledWith(expect.stringContaining("made-up-adapter"));
      const multiselectCall = vi.mocked(p.multiselect).mock.calls[0]?.[0];
      expect(multiselectCall?.options.map((o) => o.value)).toEqual(["claude-code", "cursor"]);
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
