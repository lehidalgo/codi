import * as p from "@clack/prompts";
import { wizardSelect } from "./wizard-prompts.js";
import fs from "node:fs/promises";
import { PROJECT_DIR } from "../constants.js";
import { printWelcomeBanner } from "./banner.js";
import { resolveProjectDir } from "../utils/paths.js";
import { detectStack } from "../core/hooks/stack-detector.js";
import { registerAllAdapters } from "../adapters/index.js";
import { detectAdapters, getAllAdapters } from "../core/generator/adapter-registry.js";
import {
  handleInit,
  handleCustomize,
  handleGenerate,
  handleExport,
  handleClean,
  handleAdd,
  handlePresetMenu,
  handleUpdate,
  handleDocs,
  handleDoctor,
  handleStatus,
  handleVerify,
  handleCompliance,
  handleRevert,
  handleBackup,
  printResult,
  resetHubExitCode,
  getHubExitCode,
} from "./hub-handlers.js";
import { validateHandler } from "./validate.js";

export interface HubAction {
  value: string;
  label: string;
  hint: string;
}

export interface HubTopLevelEntry {
  value: string;
  label: string;
  hint: string;
  requiresProject: boolean;
}

/**
 * Normal mode: the 4 entries that always behave the same way.
 * The first menu entry (init OR customize) is built at render time inside
 * runCommandCenter — it depends on whether .codi/ exists in the project.
 */
export const NORMAL_MENU: HubTopLevelEntry[] = [
  {
    value: "generate",
    label: "Generate configs",
    hint: "Normal, dry run, or force rebuild per agent",
    requiresProject: true,
  },
  {
    value: "update",
    label: "Update artifacts",
    hint: "Refresh rules, skills, agents, MCP servers from the current codi version",
    requiresProject: true,
  },
  {
    value: "revert",
    label: "Revert to a backup",
    hint: "Restore .codi/ and generated files from a snapshot taken before a destructive op",
    requiresProject: true,
  },
  {
    value: "export",
    label: "Export & share",
    hint: "Export skill, export preset, or contribute to GitHub",
    requiresProject: true,
  },
  {
    value: "clean",
    label: "Clean generated files",
    hint: "Remove agent configs or full uninstall with dry run",
    requiresProject: true,
  },
];

/**
 * Build the context-sensitive first entry — "Initialize project" when there
 * is no .codi/, "Customize codi setup" when one exists. Both are shown
 * regardless of project state (`requiresProject: false`); only the label,
 * hint, and target handler change.
 */
export function buildFirstEntry(hasProject: boolean): HubTopLevelEntry {
  return hasProject
    ? {
        value: "customize",
        label: "Customize codi setup",
        hint: "Add or remove artifacts, switch preset, import from external source",
        requiresProject: false,
      }
    : {
        value: "init",
        label: "Initialize project",
        hint: "Preset, import ZIP, import GitHub, or custom selection",
        requiresProject: false,
      };
}

/** Advanced mode: power-user actions, revealed via toggle. */
export const ADVANCED_MENU: HubTopLevelEntry[] = [
  {
    value: "add",
    label: "Add artifact",
    hint: "Rule, skill, agent, or brand from template or blank",
    requiresProject: true,
  },
  {
    value: "preset",
    label: "Manage presets",
    hint: "List, create, install, export, edit, or remove presets",
    requiresProject: true,
  },
  {
    value: "docs",
    label: "Generate documentation",
    hint: "Build HTML skill catalog site",
    requiresProject: true,
  },
  {
    value: "doctor",
    label: "Health check",
    hint: "Diagnose project issues",
    requiresProject: true,
  },
  {
    value: "status",
    label: "Project status",
    hint: "Summary or line-by-line diff of drifted files",
    requiresProject: true,
  },
  {
    value: "validate",
    label: "Validate config",
    hint: `Check ${PROJECT_DIR}/ configuration is valid`,
    requiresProject: true,
  },
  {
    value: "verify",
    label: "Verify agent awareness",
    hint: "Show prompt or check agent response",
    requiresProject: true,
  },
  {
    value: "compliance",
    label: "Compliance report",
    hint: "Full check: doctor + status + verification",
    requiresProject: true,
  },
  {
    value: "backup",
    label: "Manage backups",
    hint: "List sealed backups, delete by timestamp, or interactively prune",
    requiresProject: true,
  },
];

/**
 * Interactive Command Center — launched when user runs bare command.
 * Loops the main menu until the user selects Exit or presses Ctrl+C.
 * Toggle "Advanced options..." to reveal power-user actions.
 *
 * Returns the worst exit code observed across the session — `cli.ts` then
 * propagates that to `process.exit`. Mirrors `npm test` and `pre-commit`
 * semantics: any failure inside the loop yields a non-zero session exit.
 */
export async function runCommandCenter(projectRoot: string): Promise<number> {
  resetHubExitCode();

  const configDir = resolveProjectDir(projectRoot);

  registerAllAdapters();
  const detectedStack = await detectStack(projectRoot);
  const detectedAdapters = await detectAdapters(projectRoot);
  const allAgentIds = getAllAdapters().map((a) => a.id);

  printWelcomeBanner({
    detectedStack,
    detectedAgents: allAgentIds.filter((a) => detectedAdapters.some((d) => d.id === a)),
  });

  let advancedMode = false;

  while (true) {
    const hasProject = await dirExists(configDir);

    if (!hasProject) {
      p.log.warn(
        `No ${PROJECT_DIR}/ directory found. Initialize a project first or select "Initialize project".`,
      );
    }

    const visibleEntries = [
      buildFirstEntry(hasProject),
      ...NORMAL_MENU.filter((e) => !e.requiresProject || hasProject),
      ...(advancedMode ? ADVANCED_MENU.filter((e) => !e.requiresProject || hasProject) : []),
    ];

    const selected = await wizardSelect({
      message: "What would you like to do?",
      options: [
        ...visibleEntries.map((e) => ({
          label: e.label,
          value: e.value,
          hint: e.hint,
        })),
        {
          label: advancedMode ? "Hide advanced options" : "Advanced options...",
          value: "_toggle",
          hint: advancedMode ? "Show simplified menu" : "Show all features",
        },
        { label: "Exit", value: "_exit", hint: "Leave Command Center" },
      ],
    });

    if (typeof selected === "symbol" || selected === "_exit") {
      p.outro("Goodbye.");
      return getHubExitCode();
    }

    if (selected === "_toggle") {
      advancedMode = !advancedMode;
      continue;
    }

    try {
      await routeAction(selected as string, projectRoot);
    } catch (error) {
      p.log.error(`Action failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

async function routeAction(action: string, projectRoot: string): Promise<void> {
  const handlers: Record<string, (root: string) => Promise<void>> = {
    init: handleInit,
    customize: handleCustomize,
    generate: handleGenerate,
    export: handleExport,
    clean: handleClean,
    add: handleAdd,
    preset: handlePresetMenu,
    update: handleUpdate,
    docs: handleDocs,
    doctor: handleDoctor,
    status: handleStatus,
    validate: (root) => printResult(validateHandler(root)),
    verify: handleVerify,
    compliance: handleCompliance,
    revert: handleRevert,
    backup: handleBackup,
  };
  const handler = handlers[action];
  if (handler) await handler(projectRoot);
}

async function dirExists(dir: string): Promise<boolean> {
  try {
    const stat = await fs.stat(dir);
    return stat.isDirectory();
  } catch {
    return false;
  }
}
