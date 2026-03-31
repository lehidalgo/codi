import {
  AVAILABLE_TEMPLATES,
  loadTemplate,
} from "./template-loader.js";
import {
  AVAILABLE_SKILL_TEMPLATES,
  loadSkillTemplateContent,
} from "./skill-template-loader.js";
import {
  AVAILABLE_AGENT_TEMPLATES,
  loadAgentTemplate,
} from "./agent-template-loader.js";
import {
  AVAILABLE_COMMAND_TEMPLATES,
  loadCommandTemplate,
} from "./command-template-loader.js";
import {
  AVAILABLE_MCP_SERVER_TEMPLATES,
  loadMcpServerTemplate,
} from "./mcp-template-loader.js";

/**
 * Verifies every registered template can be loaded with non-empty content.
 * Returns a list of human-readable error strings — empty array means all clear.
 */
export function checkTemplateRegistry(): string[] {
  const errors: string[] = [];

  for (const name of AVAILABLE_TEMPLATES) {
    const r = loadTemplate(name);
    if (!r.ok || !r.data.trim()) {
      errors.push(`rule "${name}": failed to load or empty content`);
    }
  }

  for (const name of AVAILABLE_SKILL_TEMPLATES) {
    const r = loadSkillTemplateContent(name);
    if (!r.ok || !r.data.trim()) {
      errors.push(`skill "${name}": failed to load or empty content`);
    }
  }

  for (const name of AVAILABLE_AGENT_TEMPLATES) {
    const r = loadAgentTemplate(name);
    if (!r.ok || !r.data.trim()) {
      errors.push(`agent "${name}": failed to load or empty content`);
    }
  }

  for (const name of AVAILABLE_COMMAND_TEMPLATES) {
    const r = loadCommandTemplate(name);
    if (!r.ok || !r.data.trim()) {
      errors.push(`command "${name}": failed to load or empty content`);
    }
  }

  for (const name of AVAILABLE_MCP_SERVER_TEMPLATES) {
    const r = loadMcpServerTemplate(name);
    if (!r.ok || !r.data) {
      errors.push(`mcp "${name}": failed to load`);
    }
  }

  return errors;
}
