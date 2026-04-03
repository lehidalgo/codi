import { AVAILABLE_TEMPLATES } from "../scaffolder/template-loader.js";
import { AVAILABLE_SKILL_TEMPLATES } from "../scaffolder/skill-template-loader.js";
import { AVAILABLE_AGENT_TEMPLATES } from "../scaffolder/agent-template-loader.js";
import { FLAG_CATALOG } from "../flags/flag-catalog.js";
import { ERROR_CATALOG } from "../output/error-catalog.js";
import { getBuiltinPresetNames } from "../../templates/presets/index.js";
import { ALL_ADAPTERS } from "../../adapters/index.js";
import { CLI_COMMANDS } from "#src/constants.js";

export interface ProjectStats {
  rules: { count: number; names: string[] };
  skills: { count: number; names: string[] };
  agents: { count: number; names: string[] };
  flags: { count: number; names: string[] };
  presets: { count: number; names: string[] };
  errorCodes: number;
  cliCommands: number;
  adapters: number;
}

export function collectStats(): ProjectStats {
  return {
    rules: {
      count: AVAILABLE_TEMPLATES.length,
      names: [...AVAILABLE_TEMPLATES],
    },
    skills: {
      count: AVAILABLE_SKILL_TEMPLATES.length,
      names: [...AVAILABLE_SKILL_TEMPLATES],
    },
    agents: {
      count: AVAILABLE_AGENT_TEMPLATES.length,
      names: [...AVAILABLE_AGENT_TEMPLATES],
    },
    flags: {
      count: Object.keys(FLAG_CATALOG).length,
      names: Object.keys(FLAG_CATALOG),
    },
    presets: {
      count: getBuiltinPresetNames().length,
      names: [...getBuiltinPresetNames()],
    },
    errorCodes: Object.keys(ERROR_CATALOG).length,
    cliCommands: CLI_COMMANDS.length,
    adapters: ALL_ADAPTERS.length,
  };
}
