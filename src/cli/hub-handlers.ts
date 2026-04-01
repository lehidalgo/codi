import fs from "node:fs/promises";
import * as p from "@clack/prompts";
import { formatHuman } from "../core/output/formatter.js";
import { regenerateConfigs } from "./shared.js";
import { resolveProjectDir } from "../utils/paths.js";
import { initHandler } from "./init.js";
import { generateHandler } from "./generate.js";
import { docsHandler } from "./docs.js";
import { doctorHandler } from "./doctor.js";
import { statusHandler } from "./status.js";
import { cleanHandler } from "./clean.js";
import { updateHandler } from "./update.js";
import { verifyHandler } from "./verify.js";
import { complianceHandler } from "./compliance.js";
import { revertHandler } from "./revert.js";
import { contributeHandler } from "./contribute.js";
import { runSkillExportWizard } from "./skill-export-wizard.js";
import { skillExportHandler } from "./skill.js";

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
import { validateHandler } from "./validate.js";
import { PROJECT_DIR } from "../constants.js";
import { SUB_MENUS } from "./hub.js";

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

// --- Route Handlers ---

export async function handleInit(projectRoot: string): Promise<void> {
  let force: boolean | undefined;

  const configDir = resolveProjectDir(projectRoot);
  const projectExists = await fs
    .access(configDir)
    .then(() => true)
    .catch(() => false);

  if (projectExists) {
    const confirm = await p.select({
      message: `${PROJECT_DIR}/ already exists. Force reinitialize?`,
      options: [
        { value: false, label: "No", hint: "keep existing configuration" },
        { value: true, label: "Yes", hint: "wipe and start fresh" },
      ],
    });
    if (isCancelled(confirm)) return;
    force = confirm || undefined;
  }

  const result = await initHandler(projectRoot, { force });
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
  await printResult(doctorHandler(projectRoot, {}));
}

export async function handleStatus(projectRoot: string): Promise<void> {
  const showDiff = await p.select({
    message: "Show diffs for drifted files?",
    options: [
      { value: false, label: "No", hint: "show summary only" },
      { value: true, label: "Yes", hint: "display line-by-line changes" },
    ],
  });
  if (isCancelled(showDiff)) return;

  await printResult(
    statusHandler(projectRoot, { diff: showDiff || undefined }),
  );
}

export async function handleClean(projectRoot: string): Promise<void> {
  const cleanAll = await p.select({
    message: `Remove everything including ${PROJECT_DIR}/?`,
    options: [
      { value: false, label: "No", hint: "only remove generated agent files" },
      { value: true, label: "Yes", hint: "full uninstall, remove all config" },
    ],
  });
  if (isCancelled(cleanAll)) return;

  const dryRun = await p.select({
    message: "Dry run?",
    options: [
      { value: false, label: "No", hint: "delete files for real" },
      { value: true, label: "Yes", hint: "preview what would be deleted" },
    ],
  });
  if (isCancelled(dryRun)) return;

  if (!dryRun) {
    const target = cleanAll
      ? `${PROJECT_DIR}/ and all generated files`
      : "generated agent config files";
    const confirmed = await p.select({
      message: `This will remove ${target}. Continue?`,
      options: [
        { value: false, label: "No", hint: "cancel, keep files" },
        { value: true, label: "Yes", hint: "proceed with deletion" },
      ],
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

  const dryRun = await p.select({
    message: "Dry run?",
    options: [
      { value: false, label: "No", hint: "apply changes to disk" },
      { value: true, label: "Yes", hint: "preview changes without writing" },
    ],
  });
  if (isCancelled(dryRun)) return;

  const layerSet = new Set(layers);
  const result = await updateHandler(projectRoot, {
    rules: layerSet.has("rules") || undefined,
    skills: layerSet.has("skills") || undefined,
    agents: layerSet.has("agents") || undefined,
    commands: layerSet.has("commands") || undefined,
    mcpServers: layerSet.has("mcp-servers") || undefined,
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
  await printResult(complianceHandler(projectRoot, {}));
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
      const confirmed = await p.select({
        message: "Restore from most recent backup?",
        options: [
          { value: false, label: "No", hint: "cancel, keep current state" },
          {
            value: true,
            label: "Yes",
            hint: "overwrite current generated files",
          },
        ],
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

export async function handleContribute(projectRoot: string): Promise<void> {
  const result = await contributeHandler(projectRoot);
  process.stdout.write(formatHuman(result) + "\n");
}

export async function handleDocs(projectRoot: string): Promise<void> {
  const result = await docsHandler(projectRoot, {});
  process.stdout.write(formatHuman(result) + "\n");
}

// --- Sub-Menu Handlers ---

async function runSubMenu(
  groupKey: string,
  title: string,
  projectRoot: string,
  dispatch: Record<string, (root: string) => Promise<void>>,
): Promise<void> {
  const items = SUB_MENUS[groupKey];
  if (!items) return;

  while (true) {
    const selected = await p.select({
      message: title,
      options: [
        ...items.map((item) => ({
          label: item.label,
          value: item.value,
          hint: item.hint,
        })),
        {
          label: "Back to main menu",
          value: "_back",
          hint: "Return to Command Center",
        },
      ],
    });
    if (isCancelled(selected) || selected === "_back") return;

    const handler = dispatch[selected as string];
    if (handler) {
      try {
        await handler(projectRoot);
      } catch (error) {
        p.log.error(
          `Action failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }
}

export async function handleCreateConfigureMenu(
  projectRoot: string,
): Promise<void> {
  await runSubMenu("create-configure", "Create & configure", projectRoot, {
    add: handleAdd,
    generate: handleGenerate,
    preset: handlePresetMenu,
  });
}

export async function handleBuildShareMenu(projectRoot: string): Promise<void> {
  await runSubMenu("build-share", "Build & share", projectRoot, {
    "skill-export": handleSkillExport,
    contribute: handleContribute,
    docs: handleDocs,
  });
}

export async function handleDiagnosticsMenu(
  projectRoot: string,
): Promise<void> {
  await runSubMenu("diagnostics", "Diagnostics", projectRoot, {
    doctor: handleDoctor,
    status: handleStatus,
    validate: (root) => printResult(validateHandler(root)),
    verify: handleVerify,
    compliance: handleCompliance,
  });
}

export async function handleMaintenanceMenu(
  projectRoot: string,
): Promise<void> {
  await runSubMenu("maintenance", "Maintenance", projectRoot, {
    clean: handleClean,
    update: handleUpdate,
    revert: handleRevert,
  });
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
        const includeBuiltin = await p.select({
          message: "Include built-in presets?",
          options: [
            {
              value: true,
              label: "Yes",
              hint: "show built-in and custom presets",
            },
            { value: false, label: "No", hint: "show only custom presets" },
          ],
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
        const output = await p.text({
          message: "Output path",
          defaultValue: ".",
          placeholder: ".",
        });
        if (isCancelled(output)) break;
        const result = await presetExportHandler(
          projectRoot,
          name,
          "zip",
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
