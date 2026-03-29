import * as p from "@clack/prompts";
import { formatHuman } from "../core/output/formatter.js";
import { regenerateConfigs } from "./shared.js";
import { initHandler } from "./init.js";
import { generateHandler } from "./generate.js";
import { docsHandler } from "./docs.js";
import { doctorHandler } from "./doctor.js";
import { cleanHandler } from "./clean.js";
import { updateHandler } from "./update.js";
import { verifyHandler } from "./verify.js";
import { complianceHandler } from "./compliance.js";
import { revertHandler } from "./revert.js";
import { contributeHandler } from "./contribute.js";
import { runSkillExportWizard } from "./skill-export-wizard.js";
import { skillExportHandler } from "./skill.js";
import {
  marketplaceSearchHandler,
  marketplaceInstallHandler,
} from "./marketplace.js";
import {
  presetListEnhancedHandler,
  presetExportHandler,
  presetRemoveHandler,
  presetEditHandler,
  presetInstallUnifiedHandler,
} from "./preset-handlers.js";
import { runPresetWizard } from "./preset-wizard.js";
import { selectArtifactType, runAddWizard } from "./add-wizard.js";
import {
  addRuleHandler,
  addSkillHandler,
  addAgentHandler,
  addCommandHandler,
  addBrandHandler,
} from "./add.js";
import { getAllAdapters } from "../core/generator/adapter-registry.js";
import { registerAllAdapters } from "../adapters/index.js";

// --- Helpers ---

export function isCancelled<T>(value: T | symbol): value is symbol {
  return p.isCancel(value);
}

export async function printResult(
  promise: Promise<{ exitCode: number }>,
): Promise<void> {
  const result = await promise;
  process.stdout.write(formatHuman(result as never) + "\n");
}

export function showCliOnly(command: string, usage: string): void {
  p.log.info(
    `"${command}" is a long-running process. Run it directly from the CLI:`,
  );
  p.log.info(`  ${usage}`);
  p.log.info("Use the CLI command above.");
}

// --- Route Handlers ---

export async function handleInit(projectRoot: string): Promise<void> {
  const force = await p.confirm({
    message: "Force reinitialize if .codi/ already exists?",
    initialValue: false,
  });
  if (isCancelled(force)) return;

  const result = await initHandler(projectRoot, { force: force || undefined });
  process.stdout.write(formatHuman(result) + "\n");
}

export async function handleAdd(projectRoot: string): Promise<void> {
  const type = await selectArtifactType();
  if (!type) return;

  const wizardResult = await runAddWizard(type);
  if (!wizardResult) return;

  const handlerMap = {
    rule: addRuleHandler,
    skill: addSkillHandler,
    agent: addAgentHandler,
    command: addCommandHandler,
    brand: addBrandHandler,
  };

  const handler = handlerMap[type];
  for (const name of wizardResult.names) {
    const opts = wizardResult.useTemplates ? { template: name } : {};
    const result = await handler(projectRoot, name, opts);
    process.stdout.write(formatHuman(result) + "\n");
  }

  await regenerateConfigs(projectRoot);
  p.outro("Done.");
}

export async function handleGenerate(projectRoot: string): Promise<void> {
  registerAllAdapters();
  const allAgents = getAllAdapters().map((a) => a.id);

  const agentFilter = await p.multiselect({
    message: "Generate for which agents? (select all for full rebuild)",
    options: allAgents.map((id) => ({ label: id, value: id })),
    initialValues: allAgents,
    required: true,
  });
  if (isCancelled(agentFilter)) return;

  const mode = await p.select({
    message: "Generation mode",
    options: [
      {
        label: "Normal",
        value: "normal" as const,
        hint: "Write files to disk",
      },
      {
        label: "Dry run",
        value: "dry-run" as const,
        hint: "Show what would be generated without writing",
      },
      {
        label: "Force",
        value: "force" as const,
        hint: "Regenerate even if unchanged",
      },
    ],
  });
  if (isCancelled(mode)) return;

  const selectedAgents =
    agentFilter.length === allAgents.length ? undefined : agentFilter;
  const result = await generateHandler(projectRoot, {
    agent: selectedAgents,
    dryRun: mode === "dry-run" || undefined,
    force: mode === "force" || undefined,
  });
  process.stdout.write(formatHuman(result) + "\n");
}

export async function handleDoctor(projectRoot: string): Promise<void> {
  const ci = await p.confirm({
    message: "CI mode? (exit non-zero on any failure)",
    initialValue: false,
  });
  if (isCancelled(ci)) return;

  const result = await doctorHandler(projectRoot, { ci: ci || undefined });
  process.stdout.write(formatHuman(result) + "\n");
}

export async function handleClean(projectRoot: string): Promise<void> {
  const cleanAll = await p.confirm({
    message: "Remove everything including .codi/? (full uninstall)",
    initialValue: false,
  });
  if (isCancelled(cleanAll)) return;

  const dryRun = await p.confirm({
    message: "Dry run? (show what would be deleted without deleting)",
    initialValue: false,
  });
  if (isCancelled(dryRun)) return;

  if (!dryRun) {
    const target = cleanAll
      ? ".codi/ and all generated files"
      : "generated agent config files";
    const confirmed = await p.confirm({
      message: `This will remove ${target}. Continue?`,
    });
    if (isCancelled(confirmed) || !confirmed) {
      p.log.info("Clean cancelled.");
      return;
    }
  }

  const result = await cleanHandler(projectRoot, {
    all: cleanAll || undefined,
    dryRun: dryRun || undefined,
    force: true,
  });
  process.stdout.write(formatHuman(result) + "\n");
}

export async function handleUpdate(projectRoot: string): Promise<void> {
  const layers = await p.multiselect({
    message: "What to update? (select all for full refresh)",
    options: [
      { label: "Rules", value: "rules" },
      { label: "Skills", value: "skills" },
      { label: "Agents", value: "agents" },
      { label: "Commands", value: "commands" },
      { label: "MCP servers", value: "mcp-servers" },
    ],
    initialValues: ["rules", "skills", "agents", "commands", "mcp-servers"],
    required: true,
  });
  if (isCancelled(layers)) return;

  const dryRun = await p.confirm({
    message: "Dry run? (show changes without writing)",
    initialValue: false,
  });
  if (isCancelled(dryRun)) return;

  const layerSet = new Set(layers);
  const result = await updateHandler(projectRoot, {
    rules: layerSet.has("rules") || undefined,
    skills: layerSet.has("skills") || undefined,
    agents: layerSet.has("agents") || undefined,
    commands: layerSet.has("commands") || undefined,
    dryRun: dryRun || undefined,
  });
  process.stdout.write(formatHuman(result) + "\n");
}

export async function handleVerify(projectRoot: string): Promise<void> {
  const mode = await p.select({
    message: "Verification mode",
    options: [
      {
        label: "Show verification prompt",
        value: "show",
        hint: "Display the prompt to paste into your agent",
      },
      {
        label: "Check agent response",
        value: "check",
        hint: "Validate a pasted agent response",
      },
    ],
  });
  if (isCancelled(mode)) return;

  if (mode === "check") {
    const response = await p.text({
      message: "Paste the agent response to verify",
    });
    if (isCancelled(response) || !response) return;
    const result = await verifyHandler(projectRoot, { check: response });
    process.stdout.write(formatHuman(result) + "\n");
  } else {
    const result = await verifyHandler(projectRoot, {});
    process.stdout.write(formatHuman(result) + "\n");
  }
}

export async function handleCompliance(projectRoot: string): Promise<void> {
  const ci = await p.confirm({
    message: "CI mode? (exit non-zero on any failure)",
    initialValue: false,
  });
  if (isCancelled(ci)) return;

  const result = await complianceHandler(projectRoot, { ci: ci || undefined });
  process.stdout.write(formatHuman(result) + "\n");
}

export async function handleRevert(projectRoot: string): Promise<void> {
  const mode = await p.select({
    message: "Revert mode",
    options: [
      {
        label: "List available backups",
        value: "list",
        hint: "Show all backup timestamps",
      },
      {
        label: "Restore most recent backup",
        value: "last",
        hint: "Quick restore to last state",
      },
      {
        label: "Restore specific backup",
        value: "specific",
        hint: "Choose a backup by timestamp",
      },
    ],
  });
  if (isCancelled(mode)) return;

  switch (mode) {
    case "list": {
      const result = await revertHandler(projectRoot, { list: true });
      process.stdout.write(formatHuman(result) + "\n");
      break;
    }
    case "last": {
      const confirmed = await p.confirm({
        message:
          "Restore from most recent backup? This overwrites current generated files.",
      });
      if (isCancelled(confirmed) || !confirmed) return;
      const result = await revertHandler(projectRoot, { last: true });
      process.stdout.write(formatHuman(result) + "\n");
      break;
    }
    case "specific": {
      const timestamp = await p.text({
        message: 'Backup timestamp (from "List available backups")',
      });
      if (isCancelled(timestamp) || !timestamp) return;
      const result = await revertHandler(projectRoot, { backup: timestamp });
      process.stdout.write(formatHuman(result) + "\n");
      break;
    }
  }
}

export async function handleSkillExport(projectRoot: string): Promise<void> {
  const wizardResult = await runSkillExportWizard(projectRoot);
  if (!wizardResult) return;

  const result = await skillExportHandler(
    projectRoot,
    wizardResult.name,
    wizardResult.format,
    wizardResult.outputDir,
  );
  process.stdout.write(formatHuman(result) + "\n");
}

export async function handleMarketplace(projectRoot: string): Promise<void> {
  const query = await p.text({
    message: "Search for skills",
    placeholder: "e.g., testing, security, react",
  });
  if (isCancelled(query) || !query) return;

  const result = await marketplaceSearchHandler(projectRoot, query, {});
  process.stdout.write(formatHuman(result) + "\n");

  if (
    result.success &&
    result.data?.results &&
    result.data.results.length > 0
  ) {
    const install = await p.confirm({
      message: "Install a skill from the results?",
    });
    if (isCancelled(install) || !install) return;

    const skillName = await p.text({ message: "Skill name to install" });
    if (isCancelled(skillName) || !skillName) return;

    const installResult = await marketplaceInstallHandler(
      projectRoot,
      skillName,
      {},
    );
    process.stdout.write(formatHuman(installResult) + "\n");
  }
}

export async function handleContribute(projectRoot: string): Promise<void> {
  const result = await contributeHandler(projectRoot);
  process.stdout.write(formatHuman(result) + "\n");
}

export async function handleDocs(projectRoot: string): Promise<void> {
  const result = await docsHandler(projectRoot, {});
  process.stdout.write(formatHuman(result) + "\n");
}

export async function handlePresetMenu(projectRoot: string): Promise<void> {
  while (true) {
    const action = await p.select({
      message: "Preset action",
      options: [
        {
          label: "List installed presets",
          value: "list",
          hint: "Show all available presets",
        },
        {
          label: "Create new preset",
          value: "create",
          hint: "Interactive preset builder",
        },
        {
          label: "Install from source",
          value: "install",
          hint: "ZIP, GitHub, or registry",
        },
        {
          label: "Export preset",
          value: "export",
          hint: "Package as ZIP for sharing",
        },
        {
          label: "Edit preset",
          value: "edit",
          hint: "Modify an installed preset",
        },
        {
          label: "Remove preset",
          value: "remove",
          hint: "Uninstall a preset",
        },
        {
          label: "Back to main menu",
          value: "_back",
          hint: "Return to Command Center",
        },
      ],
    });
    if (isCancelled(action) || action === "_back") return;

    switch (action) {
      case "list": {
        const includeBuiltin = await p.confirm({
          message: "Include built-in presets?",
          initialValue: true,
        });
        if (isCancelled(includeBuiltin)) break;
        const result = await presetListEnhancedHandler(
          projectRoot,
          includeBuiltin,
        );
        process.stdout.write(formatHuman(result) + "\n");
        break;
      }
      case "create": {
        await runPresetWizard(projectRoot);
        break;
      }
      case "install": {
        const source = await p.text({
          message:
            "Preset source (ZIP path, github:org/repo, or registry name)",
        });
        if (isCancelled(source) || !source) break;
        const result = await presetInstallUnifiedHandler(projectRoot, source);
        process.stdout.write(formatHuman(result) + "\n");
        break;
      }
      case "export": {
        const name = await p.text({ message: "Preset name to export" });
        if (isCancelled(name) || !name) break;
        const format = await p.select({
          message: "Export format",
          options: [{ label: "ZIP", value: "zip" }],
        });
        if (isCancelled(format)) break;
        const output = await p.text({
          message: "Output path",
          defaultValue: ".",
          placeholder: ".",
        });
        if (isCancelled(output)) break;
        const result = await presetExportHandler(
          projectRoot,
          name,
          format,
          output ?? ".",
        );
        process.stdout.write(formatHuman(result) + "\n");
        break;
      }
      case "edit": {
        const name = await p.text({ message: "Preset name to edit" });
        if (isCancelled(name) || !name) break;
        const result = await presetEditHandler(projectRoot, name);
        process.stdout.write(formatHuman(result) + "\n");
        break;
      }
      case "remove": {
        const name = await p.text({ message: "Preset name to remove" });
        if (isCancelled(name) || !name) break;
        const result = await presetRemoveHandler(projectRoot, name);
        process.stdout.write(formatHuman(result) + "\n");
        break;
      }
    }
  }
}
