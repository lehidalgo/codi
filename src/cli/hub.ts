import * as p from "@clack/prompts";
import fs from "node:fs/promises";
import {
  PROJECT_CLI,
  PROJECT_DIR,
  PROJECT_NAME_DISPLAY,
} from "../constants.js";
import { printWelcomeBanner } from "./banner.js";
import { resolveProjectDir } from "../utils/paths.js";
import { detectStack } from "../core/hooks/stack-detector.js";
import { registerAllAdapters } from "../adapters/index.js";
import {
  detectAdapters,
  getAllAdapters,
} from "../core/generator/adapter-registry.js";
import { statusHandler } from "./status.js";
import { ciHandler } from "./ci.js";
import { validateHandler } from "./validate.js";
import { docsUpdateHandler } from "./docs-update.js";
import {
  handleInit,
  handleAdd,
  handleGenerate,
  handleDoctor,
  handleClean,
  handleUpdate,
  handleVerify,
  handleCompliance,
  handleRevert,
  handleSkillExport,
  handleContribute,
  handlePresetMenu,
  handleDocs,
  printResult,
  showCliOnly,
} from "./hub-handlers.js";

export interface HubAction {
  value: string;
  label: string;
  hint: string;
  requiresProject: boolean;
  group: "setup" | "build" | "monitor";
}

export const HUB_ACTIONS: HubAction[] = [
  // Setup & Config
  {
    value: "init",
    label: "Initialize project",
    hint: `Set up ${PROJECT_DIR}/ with agents, presets, and rules`,
    requiresProject: false,
    group: "setup",
  },
  {
    value: "add",
    label: "Add artifact",
    hint: "Create a rule, skill, agent, or command",
    requiresProject: true,
    group: "setup",
  },
  {
    value: "generate",
    label: "Generate configs",
    hint: "Rebuild all agent configuration files",
    requiresProject: true,
    group: "setup",
  },
  {
    value: "preset",
    label: "Manage presets",
    hint: "List, create, install, or export presets",
    requiresProject: true,
    group: "setup",
  },
  // Build & Share
  {
    value: "skill-export",
    label: "Export skill",
    hint: "Package a skill for sharing",
    requiresProject: true,
    group: "build",
  },
  {
    value: "contribute",
    label: "Contribute to community",
    hint: `Share your artifacts with the ${PROJECT_NAME_DISPLAY} project`,
    requiresProject: true,
    group: "build",
  },
  {
    value: "docs",
    label: "Generate documentation",
    hint: "Build HTML skill catalog site",
    requiresProject: true,
    group: "build",
  },
  // Monitor & Maintain
  {
    value: "status",
    label: "Project status",
    hint: "Check drift and sync state",
    requiresProject: true,
    group: "monitor",
  },
  {
    value: "doctor",
    label: "Health check",
    hint: "Diagnose project issues",
    requiresProject: true,
    group: "monitor",
  },
  {
    value: "validate",
    label: "Validate config",
    hint: `Check ${PROJECT_DIR}/ configuration is valid`,
    requiresProject: true,
    group: "monitor",
  },
  {
    value: "verify",
    label: "Verify agent awareness",
    hint: "Check if agents loaded their configs",
    requiresProject: true,
    group: "monitor",
  },
  {
    value: "compliance",
    label: "Compliance report",
    hint: "Full check: doctor + status + verification",
    requiresProject: true,
    group: "monitor",
  },
  {
    value: "ci",
    label: "CI checks",
    hint: "Run all validation checks for CI pipelines",
    requiresProject: true,
    group: "monitor",
  },
  {
    value: "clean",
    label: "Clean generated files",
    hint: "Remove agent config files",
    requiresProject: true,
    group: "monitor",
  },
  {
    value: "update",
    label: "Update templates",
    hint: "Update rules, skills, and agents to latest",
    requiresProject: true,
    group: "monitor",
  },
  {
    value: "revert",
    label: "Revert to backup",
    hint: "Restore generated files from a previous backup",
    requiresProject: true,
    group: "monitor",
  },
  {
    value: "watch",
    label: "Watch for changes",
    hint: `Auto-regenerate on ${PROJECT_DIR}/ changes (long-running)`,
    requiresProject: true,
    group: "monitor",
  },
  {
    value: "docs-update",
    label: "Update docs counts",
    hint: "Sync documentation counts with templates",
    requiresProject: true,
    group: "monitor",
  },
];

/**
 * Returns actions available based on whether a project exists.
 */
export function getAvailableActions(hasProject: boolean): HubAction[] {
  return HUB_ACTIONS.filter((a) => !a.requiresProject || hasProject);
}

/**
 * Interactive Command Center — launched when user runs bare command.
 * Loops the main menu until the user selects Exit or presses Ctrl+C.
 */
export async function runCommandCenter(projectRoot: string): Promise<void> {
  const configDir = resolveProjectDir(projectRoot);

  registerAllAdapters();
  const detectedStack = await detectStack(projectRoot);
  const detectedAdapters = await detectAdapters(projectRoot);
  const allAgentIds = getAllAdapters().map((a) => a.id);

  printWelcomeBanner({
    detectedStack,
    detectedAgents: allAgentIds.filter((a) =>
      detectedAdapters.some((d) => d.id === a),
    ),
  });

  while (true) {
    const hasProject = await dirExists(configDir);

    if (!hasProject) {
      p.log.warn(
        `No ${PROJECT_DIR}/ directory found. Initialize a project first or select "Initialize project".`,
      );
    }

    const actions = getAvailableActions(hasProject);
    const selected = await p.select({
      message: "What would you like to do?",
      options: [
        ...actions.map((a) => ({
          label: a.label,
          value: a.value,
          hint: a.hint,
        })),
        { label: "Exit", value: "_exit", hint: "Leave Command Center" },
      ],
    });

    if (p.isCancel(selected) || selected === "_exit") {
      p.outro("Goodbye.");
      return;
    }

    p.log.step(
      `Running: ${actions.find((a) => a.value === selected)?.label ?? selected}`,
    );

    try {
      await routeAction(selected as string, projectRoot);
    } catch (error) {
      p.log.error(
        `Action failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

async function routeAction(action: string, projectRoot: string): Promise<void> {
  switch (action) {
    case "init":
      await handleInit(projectRoot);
      break;
    case "add":
      await handleAdd(projectRoot);
      break;
    case "generate":
      await handleGenerate(projectRoot);
      break;
    case "preset":
      await handlePresetMenu(projectRoot);
      break;
    case "skill-export":
      await handleSkillExport(projectRoot);
      break;
    case "contribute":
      await handleContribute(projectRoot);
      break;
    case "docs":
      await handleDocs(projectRoot);
      break;
    case "status":
      await printResult(statusHandler(projectRoot));
      break;
    case "doctor":
      await handleDoctor(projectRoot);
      break;
    case "validate":
      await printResult(validateHandler(projectRoot));
      break;
    case "verify":
      await handleVerify(projectRoot);
      break;
    case "compliance":
      await handleCompliance(projectRoot);
      break;
    case "ci":
      await printResult(ciHandler(projectRoot));
      break;
    case "clean":
      await handleClean(projectRoot);
      break;
    case "update":
      await handleUpdate(projectRoot);
      break;
    case "revert":
      await handleRevert(projectRoot);
      break;
    case "watch":
      showCliOnly("watch", `${PROJECT_CLI} watch`);
      break;
    case "docs-update":
      await printResult(docsUpdateHandler(projectRoot));
      break;
  }
}

async function dirExists(dir: string): Promise<boolean> {
  try {
    const stat = await fs.stat(dir);
    return stat.isDirectory();
  } catch {
    return false;
  }
}
