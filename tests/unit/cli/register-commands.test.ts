import { describe, it, expect, beforeEach } from "vitest";
import { Command } from "commander";
import { Logger } from "#src/core/output/logger.js";

/**
 * Tests that registerXxxCommand functions correctly wire up
 * subcommands to Commander without crashing during registration.
 * The actual handler logic is tested in dedicated handler test files.
 */

describe("registerAddCommand", () => {
  beforeEach(() => {
    Logger.init({ level: "error", mode: "human", noColor: true });
  });

  it("registers add command with rule/skill/agent/mcp-server subcommands", async () => {
    const { registerAddCommand } = await import("../../../src/cli/add.js");
    const program = new Command();
    program.option("-j, --json");
    registerAddCommand(program);

    const addCmd = program.commands.find((c) => c.name() === "add");
    expect(addCmd).toBeDefined();

    const subNames = addCmd!.commands.map((c) => c.name());
    expect(subNames).toContain("rule");
    expect(subNames).toContain("skill");
    expect(subNames).toContain("agent");
    expect(subNames).toContain("mcp-server");
  }, 15000);
});

describe("registerPresetCommand", () => {
  beforeEach(() => {
    Logger.init({ level: "error", mode: "human", noColor: true });
  });

  it("registers preset command with all subcommands", async () => {
    const { registerPresetCommand } = await import("../../../src/cli/preset.js");
    const program = new Command();
    program.option("-j, --json");
    registerPresetCommand(program);

    const presetCmd = program.commands.find((c) => c.name() === "preset");
    expect(presetCmd).toBeDefined();

    const subNames = presetCmd!.commands.map((c) => c.name());
    expect(subNames).toContain("create");
    expect(subNames).toContain("list");
    expect(subNames).toContain("install");
    expect(subNames).toContain("export");
    expect(subNames).toContain("validate");
    expect(subNames).toContain("remove");
    expect(subNames).toContain("edit");
    expect(subNames).toContain("search");
    expect(subNames).toContain("update");
  });
});

describe("registerUpdateCommand", () => {
  beforeEach(() => {
    Logger.init({ level: "error", mode: "human", noColor: true });
  });

  it("registers update command with expected options", async () => {
    const { registerUpdateCommand } = await import("../../../src/cli/update.js");
    const program = new Command();
    program.option("-j, --json");
    registerUpdateCommand(program);

    const updateCmd = program.commands.find((c) => c.name() === "update");
    expect(updateCmd).toBeDefined();

    const optionNames = updateCmd!.options.map((o) => o.long);
    expect(optionNames).toContain("--preset");
    expect(optionNames).toContain("--rules");
    expect(optionNames).toContain("--skills");
    expect(optionNames).toContain("--dry-run");
  });
});

describe("registerRevertCommand", () => {
  it("registers revert command with --list, --last, --backup options", async () => {
    const { registerRevertCommand } = await import("../../../src/cli/revert.js");
    const program = new Command();
    program.option("-j, --json");
    registerRevertCommand(program);

    const revertCmd = program.commands.find((c) => c.name() === "revert");
    expect(revertCmd).toBeDefined();

    const optionNames = revertCmd!.options.map((o) => o.long);
    expect(optionNames).toContain("--list");
    expect(optionNames).toContain("--last");
    expect(optionNames).toContain("--backup");
  });
});

describe("registerHooksCommand", () => {
  it("registers hooks command with doctor and reinstall subcommands", async () => {
    const { registerHooksCommand } = await import("../../../src/cli/hooks.js");
    const program = new Command();
    program.option("-j, --json");
    registerHooksCommand(program);

    const hooksCmd = program.commands.find((c) => c.name() === "hooks");
    expect(hooksCmd).toBeDefined();

    const subNames = hooksCmd!.commands.map((c) => c.name());
    expect(subNames).toContain("doctor");
    expect(subNames).toContain("reinstall");
  });

  it("hooks doctor has --fix option", async () => {
    const { registerHooksCommand } = await import("../../../src/cli/hooks.js");
    const program = new Command();
    program.option("-j, --json");
    registerHooksCommand(program);

    const hooksCmd = program.commands.find((c) => c.name() === "hooks")!;
    const doctorSub = hooksCmd.commands.find((c) => c.name() === "doctor")!;
    const fixOpt = doctorSub.options.find((o) => o.long === "--fix");
    expect(fixOpt).toBeDefined();
  });
});

/**
 * Smoke tests: every remaining top-level register*Command should register a
 * sub-command on the supplied program without throwing. These cover the
 * `program.command(...).description(...).action(...)` chain that lives at
 * the bottom of every CLI source file. The .action callbacks themselves
 * are exercised by the per-command Handler tests; what we lock in here is
 * that registration itself stays wired and named correctly.
 */
describe("CLI command registrar smoke tests", () => {
  type Registrar = (program: Command) => void;
  const REGISTRARS: Array<{ commandName: string; load: () => Promise<Registrar> }> = [
    {
      commandName: "ci",
      load: async () => (await import("../../../src/cli/ci.js")).registerCiCommand,
    },
    {
      commandName: "clean",
      load: async () => (await import("../../../src/cli/clean.js")).registerCleanCommand,
    },
    {
      commandName: "compliance",
      load: async () => (await import("../../../src/cli/compliance.js")).registerComplianceCommand,
    },
    {
      commandName: "docs",
      load: async () => (await import("../../../src/cli/docs.js")).registerDocsCommand,
    },
    {
      commandName: "docs-check",
      load: async () => (await import("../../../src/cli/docs-check.js")).registerDocsCheckCommand,
    },
    {
      commandName: "docs-stamp",
      load: async () => (await import("../../../src/cli/docs-stamp.js")).registerDocsStampCommand,
    },
    {
      commandName: "docs-update",
      load: async () => (await import("../../../src/cli/docs-update.js")).registerDocsUpdateCommand,
    },
    {
      commandName: "doctor",
      load: async () => (await import("../../../src/cli/doctor.js")).registerDoctorCommand,
    },
    {
      commandName: "generate",
      load: async () => (await import("../../../src/cli/generate.js")).registerGenerateCommand,
    },
    {
      commandName: "init",
      load: async () => (await import("../../../src/cli/init.js")).registerInitCommand,
    },
    {
      commandName: "onboard",
      load: async () => (await import("../../../src/cli/onboard.js")).registerOnboardCommand,
    },
    {
      commandName: "skill",
      load: async () => (await import("../../../src/cli/skill.js")).registerSkillCommand,
    },
    {
      commandName: "status",
      load: async () => (await import("../../../src/cli/status.js")).registerStatusCommand,
    },
    {
      commandName: "validate",
      load: async () => (await import("../../../src/cli/validate.js")).registerValidateCommand,
    },
    {
      commandName: "verify",
      load: async () => (await import("../../../src/cli/verify.js")).registerVerifyCommand,
    },
    {
      commandName: "watch",
      load: async () => (await import("../../../src/cli/watch.js")).registerWatchCommand,
    },
  ];

  for (const { commandName, load } of REGISTRARS) {
    it(`register${commandName.replace(/(?:^|-)([a-z])/g, (_, c) => c.toUpperCase())}Command registers "${commandName}" with a description`, async () => {
      const program = new Command();
      program.option("-j, --json");
      const fn = await load();
      expect(() => fn(program)).not.toThrow();
      const cmd = program.commands.find((c) => c.name() === commandName);
      expect(cmd, `Expected sub-command "${commandName}" to be registered`).toBeDefined();
      expect(typeof cmd?.description()).toBe("string");
      expect((cmd?.description() ?? "").length).toBeGreaterThan(0);
    });
  }
});
