import * as p from "@clack/prompts";
import fs from "node:fs/promises";
import { PROJECT_DIR, PROJECT_NAME_DISPLAY } from "../constants.js";
import { printWelcomeBanner } from "./banner.js";
import { resolveProjectDir } from "../utils/paths.js";
import { detectStack } from "../core/hooks/stack-detector.js";
import { registerAllAdapters } from "../adapters/index.js";
import {
  detectAdapters,
  getAllAdapters,
} from "../core/generator/adapter-registry.js";
import {
  handleInit,
  handleCreateConfigureMenu,
  handleBuildShareMenu,
  handleDiagnosticsMenu,
  handleMaintenanceMenu,
} from "./hub-handlers.js";

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

/** Top-level menu entries displayed in the Command Center. */
export const TOP_LEVEL_MENU: HubTopLevelEntry[] = [
  {
    value: "init",
    label: "Initialize project",
    hint: `Set up ${PROJECT_DIR}/ with agents, presets, and rules`,
    requiresProject: false,
  },
  {
    value: "create-configure",
    label: "Create & configure",
    hint: "Add artifacts, manage presets, generate configs",
    requiresProject: true,
  },
  {
    value: "build-share",
    label: "Build & share",
    hint: "Export skills, contribute, generate docs",
    requiresProject: true,
  },
  {
    value: "diagnostics",
    label: "Diagnostics",
    hint: "Health check, status, validate, verify, compliance",
    requiresProject: true,
  },
  {
    value: "maintenance",
    label: "Maintenance",
    hint: "Clean, update, revert",
    requiresProject: true,
  },
];

/** Sub-menu items grouped by category. */
export const SUB_MENUS: Record<string, HubAction[]> = {
  "create-configure": [
    {
      value: "add",
      label: "Add artifact",
      hint: "Create a rule, skill, agent, command, or brand",
    },
    {
      value: "generate",
      label: "Generate configs",
      hint: "Rebuild all agent configuration files",
    },
    {
      value: "preset",
      label: "Manage presets",
      hint: "List, create, install, or export presets",
    },
  ],
  "build-share": [
    {
      value: "skill-export",
      label: "Export skill",
      hint: "Package a skill for sharing",
    },
    {
      value: "contribute",
      label: "Contribute to community",
      hint: `Share your artifacts with the ${PROJECT_NAME_DISPLAY} project`,
    },
    {
      value: "docs",
      label: "Generate documentation",
      hint: "Build HTML skill catalog site",
    },
  ],
  diagnostics: [
    {
      value: "doctor",
      label: "Health check",
      hint: "Diagnose project issues",
    },
    {
      value: "status",
      label: "Project status",
      hint: "Check if generated files are up to date",
    },
    {
      value: "validate",
      label: "Validate config",
      hint: `Check ${PROJECT_DIR}/ configuration is valid`,
    },
    {
      value: "verify",
      label: "Verify agent awareness",
      hint: "Test if your AI agent received its instructions",
    },
    {
      value: "compliance",
      label: "Compliance report",
      hint: "Full check: doctor + status + verification",
    },
  ],
  maintenance: [
    {
      value: "clean",
      label: "Clean generated files",
      hint: "Remove agent config files",
    },
    {
      value: "update",
      label: "Update templates",
      hint: "Update rules, skills, and agents to latest",
    },
    {
      value: "revert",
      label: "Revert to backup",
      hint: "Restore generated files from a previous backup",
    },
  ],
};

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

    const entries = TOP_LEVEL_MENU.filter(
      (e) => !e.requiresProject || hasProject,
    );

    const selected = await p.select({
      message: "What would you like to do?",
      options: [
        ...entries.map((e) => ({
          label: e.label,
          value: e.value,
          hint: e.hint,
        })),
        { label: "Exit", value: "_exit", hint: "Leave Command Center" },
      ],
    });

    if (p.isCancel(selected) || selected === "_exit") {
      p.outro("Goodbye.");
      return;
    }

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
    case "create-configure":
      await handleCreateConfigureMenu(projectRoot);
      break;
    case "build-share":
      await handleBuildShareMenu(projectRoot);
      break;
    case "diagnostics":
      await handleDiagnosticsMenu(projectRoot);
      break;
    case "maintenance":
      await handleMaintenanceMenu(projectRoot);
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
