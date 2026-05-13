import { PROJECT_DIR } from "#src/constants.js";
/**
 * Hub menu structure — pure data + types consumed by the interactive Command
 * Center (cli/hub.ts) AND by the documentation generator (core/docs/*).
 *
 * Lives in core/ rather than cli/ because the symbols are presentation-agnostic
 * data tables, not runtime CLI behaviour. The CLI hub builds @clack prompts
 * from these arrays; the docs generator renders them as Markdown tables. Both
 * are read-only consumers — there is no inversion of control here.
 */
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
