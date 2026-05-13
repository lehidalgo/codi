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
import { NORMAL_MENU, ADVANCED_MENU, buildFirstEntry } from "../core/hub-menu.js";

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
