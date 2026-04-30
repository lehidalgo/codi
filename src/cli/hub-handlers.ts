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
import { backupListHandler, backupDeleteHandler, backupPruneHandler } from "./backup.js";
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
import { addRuleHandler, addSkillHandler, addAgentHandler, addBrandHandler } from "./add.js";
import { getAllAdapters } from "../core/generator/adapter-registry.js";
import { resolveConfig } from "../core/config/resolver.js";
import { runAddFromExternal, type ExternalSourceKind } from "./init-wizard-modify-add.js";
import { PROJECT_DIR } from "../constants.js";
import type { CommandResult } from "../core/output/types.js";
import { EXIT_CODES } from "../core/output/exit-codes.js";

// --- Helpers ---

export function isCancelled<T>(value: T | symbol): value is symbol {
  return p.isCancel(value);
}

/**
 * Hub session exit-code tracker.
 *
 * The Command Center is interactive: a single failure must NOT abort the
 * loop, but it also must not be silently swallowed (CI integrations gate on
 * the bare `codi` exit code). We aggregate the worst exit code seen across
 * every action the user performs, and surface it when `runCommandCenter`
 * returns. Mirrors `npm test` and `pre-commit` semantics: any failure means
 * the session exits non-zero.
 */
let worstHubExitCode: number = EXIT_CODES.SUCCESS;

/** Reset the hub exit-code tracker — call at the start of each session. */
export function resetHubExitCode(): void {
  worstHubExitCode = EXIT_CODES.SUCCESS;
}

/** Read the worst exit code observed during the current hub session. */
export function getHubExitCode(): number {
  return worstHubExitCode;
}

/**
 * Render a CommandResult to stdout AND track its exit code in the session
 * tracker. Replaces every ad-hoc `process.stdout.write(formatHuman(result))`
 * call in this file. Never calls process.exit — that's the dispatcher's
 * job (see src/cli.ts bare-action callback).
 */
export function renderResult(result: CommandResult<unknown>): void {
  process.stdout.write(formatHuman(result) + "\n");
  if (result.exitCode !== EXIT_CODES.SUCCESS && result.exitCode > worstHubExitCode) {
    worstHubExitCode = result.exitCode;
  }
}

/** Awaits a handler promise then renders + tracks. */
export async function printResult(promise: Promise<CommandResult<unknown>>): Promise<void> {
  const result = await promise;
  renderResult(result);
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
  renderResult(result);
}

/**
 * Hub entry for "Customize codi setup" — only shown when .codi/ exists.
 * Top-level dispatcher: in-place customize, add-from-external (local /
 * zip / github), or fall through to the wizard's full modify flow for
 * preset replacement. Add-from-external bypasses the wizard entirely
 * since adding artifacts does not change languages or agents.
 */
export async function handleCustomize(projectRoot: string): Promise<void> {
  const action = await p.select({
    message: "Customize codi setup — what would you like to do?",
    options: [
      {
        value: "customize",
        label: "Customize current artifacts",
        hint: "Edit installed rules, skills, agents (add or remove)",
      },
      {
        value: "add-local",
        label: "Add artifacts from local directory",
        hint: "Pick artifacts from any folder with rules/, skills/, agents/, mcp-servers/",
      },
      {
        value: "add-zip",
        label: "Add artifacts from ZIP file",
        hint: "Pick artifacts from a zipped preset bundle",
      },
      {
        value: "add-github",
        label: "Add artifacts from GitHub repo",
        hint: "Pick artifacts from a public repository",
      },
      {
        value: "replace",
        label: "Replace preset (advanced)...",
        hint: "Switch to a different preset, or import a full ZIP / GitHub preset",
      },
    ],
  });
  if (isCancelled(action)) return;

  const configDir = resolveProjectDir(projectRoot);

  if (action === "customize" || action === "replace") {
    const result = await initHandler(projectRoot, { customize: true });
    renderResult(result);
    return;
  }

  const kindMap: Record<string, ExternalSourceKind> = {
    "add-local": "local",
    "add-zip": "zip",
    "add-github": "github",
  };
  const kind = kindMap[action as string];
  if (kind) await runAddFromExternal(configDir, kind);
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
    brand: addBrandHandler,
  };

  const handler = handlerMap[type];
  for (const name of wizardResult.names) {
    const opts = wizardResult.useTemplates ? { template: name } : {};
    const result = await handler(projectRoot, name, opts);
    renderResult(result);
  }

  await regenerateConfigs(projectRoot);
  p.outro("Done.");
}

export async function handleGenerate(projectRoot: string): Promise<void> {
  const allAdapters = getAllAdapters().map((a) => a.id);

  // Restrict the multiselect to agents the project actually uses.
  // Manifest agents=undefined means "all detected" per the schema; empty array
  // means the user has no agents wired up — that's a hard error worth flagging.
  const cfg = await resolveConfig(projectRoot);
  let agentChoices: string[];
  if (!cfg.ok) {
    p.log.warn("Could not read .codi/codi.yaml — falling back to all registered adapters.");
    agentChoices = allAdapters;
  } else {
    const manifestAgents = cfg.data.manifest.agents;
    if (manifestAgents === undefined) {
      agentChoices = allAdapters;
    } else {
      const known = manifestAgents.filter((id) => allAdapters.includes(id));
      const unknown = manifestAgents.filter((id) => !allAdapters.includes(id));
      if (unknown.length > 0) {
        p.log.warn(`Manifest declares unknown adapter(s): ${unknown.join(", ")}. Skipping.`);
      }
      if (known.length === 0) {
        p.log.error(
          "No usable agents configured in .codi/codi.yaml. Run `codi init` to add at least one.",
        );
        return;
      }
      agentChoices = known;
    }
  }

  const agentFilter = await p.multiselect({
    message: "Generate for which agents? (select all for full rebuild)",
    options: agentChoices.map((id) => ({ label: id, value: id })),
    initialValues: agentChoices,
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

  const selectedAgents = agentFilter.length === agentChoices.length ? undefined : agentFilter;
  const result = await generateHandler(projectRoot, {
    agent: selectedAgents,
    dryRun: mode === "dry-run" || undefined,
    force: mode === "force" || undefined,
  });
  renderResult(result);
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

  await printResult(statusHandler(projectRoot, { diff: showDiff || undefined }));
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
  renderResult(result);
}

export async function handleUpdate(projectRoot: string): Promise<void> {
  const layers = await p.multiselect({
    message: "What to update? (select all for full refresh)",
    options: [
      { label: "Rules", value: "rules" },
      { label: "Skills", value: "skills" },
      { label: "Agents", value: "agents" },
      { label: "MCP servers", value: "mcp-servers" },
    ],
    initialValues: ["rules", "skills", "agents", "mcp-servers"],
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
    mcpServers: layerSet.has("mcp-servers") || undefined,
    dryRun: dryRun || undefined,
  });
  renderResult(result);
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
    renderResult(result);
  } else {
    const result = await verifyHandler(projectRoot, {});
    renderResult(result);
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
        label: "Pick a backup to restore",
        value: "pick",
        hint: "Interactive list of every sealed backup, newest first",
      },
      {
        label: "Restore the most recent backup",
        value: "last",
        hint: "Quick restore to last state",
      },
      {
        label: "Dry run",
        value: "dry-run",
        hint: "Show what would happen without writing",
      },
      {
        label: "List available backups",
        value: "list",
        hint: "Print all backup timestamps and exit",
      },
    ],
  });
  if (isCancelled(mode)) return;

  switch (mode) {
    case "list": {
      const result = await revertHandler(projectRoot, { list: true });
      renderResult(result);
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
            hint: "a pre-revert snapshot is taken first",
          },
        ],
      });
      if (isCancelled(confirmed) || !confirmed) return;
      const result = await revertHandler(projectRoot, { last: true });
      renderResult(result);
      break;
    }
    case "pick": {
      const result = await revertHandler(projectRoot, {});
      renderResult(result);
      break;
    }
    case "dry-run": {
      const result = await revertHandler(projectRoot, { dryRun: true });
      renderResult(result);
      break;
    }
  }
}

export async function handleBackup(projectRoot: string): Promise<void> {
  const mode = await p.select({
    message: "Backup management",
    options: [
      {
        label: "List sealed backups",
        value: "list",
        hint: "Print every backup with file count, newest first",
      },
      {
        label: "Prune (interactive)",
        value: "prune",
        hint: "Multi-select backups to delete, double-confirm",
      },
      {
        label: "Delete by timestamp",
        value: "delete",
        hint: "Type one or more timestamps to remove",
      },
    ],
  });
  if (isCancelled(mode)) return;

  switch (mode) {
    case "list": {
      const result = await backupListHandler(projectRoot);
      renderResult(result);
      break;
    }
    case "prune": {
      const result = await backupPruneHandler(projectRoot);
      renderResult(result);
      break;
    }
    case "delete": {
      const ts = await p.text({
        message: "Backup timestamps to delete (space-separated, e.g. 2026-04-30T22-02-29-800Z)",
      });
      if (isCancelled(ts) || !ts) return;
      const timestamps = String(ts)
        .split(/\s+/)
        .filter((s) => s.length > 0);
      if (timestamps.length === 0) return;
      const result = await backupDeleteHandler(projectRoot, timestamps);
      renderResult(result);
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
  renderResult(result);
}

export async function handleContribute(projectRoot: string): Promise<void> {
  const result = await contributeHandler(projectRoot);
  renderResult(result);
}

export async function handleDocs(projectRoot: string): Promise<void> {
  const result = await docsHandler(projectRoot, {});
  renderResult(result);
}

export async function handleImport(projectRoot: string): Promise<void> {
  const sourceType = await p.select({
    message: "Import from",
    options: [
      { value: "zip", label: "ZIP file", hint: "Local .zip archive with codi config" },
      { value: "github", label: "GitHub repository", hint: "Full GitHub repository URL" },
    ],
  });
  if (isCancelled(sourceType)) return;

  const placeholder = sourceType === "zip" ? "/path/to/config.zip" : "https://github.com/org/repo";

  const source = await p.text({
    message: "Source path or identifier",
    placeholder,
  });
  if (isCancelled(source) || !source) return;

  const result = await presetInstallUnifiedHandler(projectRoot, source);
  renderResult(result);
}

export async function handleExport(projectRoot: string): Promise<void> {
  const what = await p.select({
    message: "What to export",
    options: [
      { value: "skill", label: "Export a skill", hint: "Package as ZIP or plugin format" },
      { value: "preset", label: "Export a preset", hint: "Package as ZIP for sharing" },
      { value: "contribute", label: "Contribute to GitHub", hint: "Submit artifacts via PR" },
    ],
  });
  if (isCancelled(what)) return;

  switch (what) {
    case "skill":
      await handleSkillExport(projectRoot);
      break;
    case "preset": {
      const name = await p.text({ message: "Preset name to export" });
      if (isCancelled(name) || !name) return;
      const output = await p.text({
        message: "Output path",
        defaultValue: ".",
        placeholder: ".",
      });
      if (isCancelled(output)) return;
      const result = await presetExportHandler(projectRoot, name, "zip", output ?? ".");
      renderResult(result);
      break;
    }
    case "contribute":
      await handleContribute(projectRoot);
      break;
  }
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
        const result = await presetListEnhancedHandler(projectRoot, includeBuiltin);
        renderResult(result);
        break;
      }
      case "create": {
        await runPresetWizard(projectRoot);
        break;
      }
      case "install": {
        const source = await p.text({
          message: "Preset source (ZIP path, github:org/repo, or registry name)",
        });
        if (isCancelled(source) || !source) break;
        const result = await presetInstallUnifiedHandler(projectRoot, source);
        renderResult(result);
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
        const result = await presetExportHandler(projectRoot, name, "zip", output ?? ".");
        renderResult(result);
        break;
      }
      case "edit": {
        const name = await p.text({ message: "Preset name to edit" });
        if (isCancelled(name) || !name) break;
        const result = await presetEditHandler(projectRoot, name);
        renderResult(result);
        break;
      }
      case "remove": {
        const name = await p.text({ message: "Preset name to remove" });
        if (isCancelled(name) || !name) break;
        const result = await presetRemoveHandler(projectRoot, name);
        renderResult(result);
        break;
      }
    }
  }
}
