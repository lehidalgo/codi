import type { Result } from "#src/types/result.js";
import { loadAgentTemplate } from "./agent-template-loader.js";
import { replaceNamePlaceholder, writeArtifactFile } from "./common.js";

const DEFAULT_CONTENT = `---
name: {{name}}
description: Custom agent
tools: [Read, Grep, Glob, Bash]
model: inherit
managed_by: user
version: 1
---

# {{name}}

Add your agent system prompt here.`;

/** Options for {@link createAgent}. */
export interface CreateAgentOptions {
  /** Agent name in kebab-case. */
  name: string;
  /** Absolute path to the `.codi/` configuration directory. */
  configDir: string;
  /** Optional built-in agent template name. */
  template?: string;
  /** When `true`, overwrite an existing agent file without error. */
  force?: boolean;
}

/**
 * Scaffold a new agent Markdown file inside `<configDir>/agents/`.
 * Pre-flight delegated to `writeArtifactFile`; this body only resolves
 * template-vs-default content + `{{name}}` placeholder replacement.
 */
export async function createAgent(options: CreateAgentOptions): Promise<Result<string>> {
  const { name, configDir, template, force } = options;

  let content: string;
  if (template) {
    const templateResult = loadAgentTemplate(template);
    if (!templateResult.ok) return templateResult;
    content = templateResult.data;
  } else {
    content = DEFAULT_CONTENT;
  }
  content = replaceNamePlaceholder(content, name) + "\n";

  return writeArtifactFile({
    configDir,
    subdir: "agents",
    name,
    ext: "md",
    content,
    label: "Agent",
    force: Boolean(force),
  });
}
