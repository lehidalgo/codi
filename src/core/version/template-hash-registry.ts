import { hashContent } from "../../utils/hash.js";
import { stringify as stringifyYaml } from "yaml";
import { AVAILABLE_TEMPLATES, loadTemplate } from "../scaffolder/template-loader.js";
import {
  AVAILABLE_SKILL_TEMPLATES,
  loadSkillTemplateContent,
} from "../scaffolder/skill-template-loader.js";
import {
  AVAILABLE_AGENT_TEMPLATES,
  loadAgentTemplate,
} from "../scaffolder/agent-template-loader.js";
import {
  AVAILABLE_MCP_SERVER_TEMPLATES,
  BUILTIN_MCP_SERVERS,
  getMcpServerTemplateVersion,
} from "../scaffolder/mcp-template-loader.js";
import { parseVersionFromFrontmatter } from "./artifact-version.js";

export type ArtifactType = "rule" | "skill" | "agent" | "mcp-server";

export interface TemplateFingerprint {
  name: string;
  type: ArtifactType;
  contentHash: string;
  artifactVersion: number;
}

export interface TemplateHashRegistry {
  cliVersion: string;
  generatedAt: string;
  templates: Record<string, TemplateFingerprint>;
}

let _registry: TemplateHashRegistry | null = null;

export function getCLIVersion(): string {
  // Resolved at build time via tsup — falls back to "0.0.0" in tests
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pkg = require("../../../package.json") as { version: string };
    return pkg.version;
  } catch {
    return "0.0.0";
  }
}

function buildRegistry(): TemplateHashRegistry {
  const cliVersion = getCLIVersion();
  const templates: Record<string, TemplateFingerprint> = {};

  for (const name of AVAILABLE_TEMPLATES) {
    const result = loadTemplate(name);
    if (result.ok) {
      templates[name] = {
        name,
        type: "rule",
        contentHash: hashContent(result.data),
        artifactVersion: parseVersionFromFrontmatter(result.data),
      };
    }
  }

  for (const name of AVAILABLE_SKILL_TEMPLATES) {
    const result = loadSkillTemplateContent(name);
    if (result.ok) {
      templates[name] = {
        name,
        type: "skill",
        contentHash: hashContent(result.data),
        artifactVersion: parseVersionFromFrontmatter(result.data),
      };
    }
  }

  for (const name of AVAILABLE_AGENT_TEMPLATES) {
    const result = loadAgentTemplate(name);
    if (result.ok) {
      templates[name] = {
        name,
        type: "agent",
        contentHash: hashContent(result.data),
        artifactVersion: parseVersionFromFrontmatter(result.data),
      };
    }
  }

  for (const name of AVAILABLE_MCP_SERVER_TEMPLATES) {
    const template = BUILTIN_MCP_SERVERS[name];
    const version = getMcpServerTemplateVersion(name);
    templates[name] = {
      name,
      type: "mcp-server",
      contentHash: hashContent(stringifyYaml(template)),
      artifactVersion: version ?? 1,
    };
  }

  return {
    cliVersion,
    generatedAt: new Date().toISOString(),
    templates,
  };
}

/** Returns the singleton template hash registry. Computed once per process. */
export function buildTemplateHashRegistry(): TemplateHashRegistry {
  if (!_registry) {
    _registry = buildRegistry();
  }
  return _registry;
}

export function getTemplateFingerprint(name: string): TemplateFingerprint | undefined {
  return buildTemplateHashRegistry().templates[name];
}

export function getAllFingerprints(): TemplateFingerprint[] {
  return Object.values(buildTemplateHashRegistry().templates);
}

/** Reset the registry cache — used in tests only. */
export function _resetRegistryCache(): void {
  _registry = null;
}
