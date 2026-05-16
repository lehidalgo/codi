import type { Result } from "#src/types/result.js";
import { loadTemplate } from "./template-loader.js";
import { replaceNamePlaceholder, writeArtifactFile } from "./common.js";

const DEFAULT_CONTENT = `---
name: {{name}}
description: Custom rule
priority: medium
alwaysApply: false
managed_by: user
version: 1
---

# {{name}}

Add your rule content here.`;

/** Options for {@link createRule}. */
export interface CreateRuleOptions {
  /** Rule name in kebab-case. */
  name: string;
  /** Absolute path to the `.codi/` configuration directory. */
  configDir: string;
  /** Optional built-in template name to scaffold from instead of the default stub. */
  template?: string;
  /** When `true`, overwrite an existing rule file without error. */
  force?: boolean;
}

/**
 * Scaffold a new rule Markdown file inside `<configDir>/rules/`.
 *
 * Pre-flight (name validation, mkdir, conflict-check, write) is delegated to
 * `writeArtifactFile`; this body only resolves the template-vs-default
 * content and applies the `{{name}}` placeholder replacement.
 */
export async function createRule(options: CreateRuleOptions): Promise<Result<string>> {
  const { name, configDir, template, force } = options;

  let content: string;
  if (template) {
    const templateResult = loadTemplate(template);
    if (!templateResult.ok) return templateResult;
    content = templateResult.data;
    // Guard: ensure loaded template has valid YAML frontmatter.
    if (!content.trimStart().startsWith("---")) content = DEFAULT_CONTENT;
  } else {
    content = DEFAULT_CONTENT;
  }
  content = replaceNamePlaceholder(content, name) + "\n";

  return writeArtifactFile({
    configDir,
    subdir: "rules",
    name,
    ext: "md",
    content,
    label: "Rule",
    force: Boolean(force),
  });
}
